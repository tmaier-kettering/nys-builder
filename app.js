const PAGE_CONFIGS = {
  policies: {
    itemKey: 'policies',
    columnsKey: 'policyColumns',
    primaryField: 'Policy',
    relationField: 'Tools',
    hiddenColumns: ['#', 'Policy ID', 'ID', 'Policy Identifier', 'Approval Status', 'Archived', 'Type'],
    cardColumnsByView: {
      skim: ['Policy'],
      peruse: ['Policy', 'Commentary'],
      'deep-dive': 'ALL'
    },
    pdfColumnsByView: {
      skim: ['Policy'],
      peruse: ['Policy', 'Scope', 'Jurisdiction', 'UNFCCC Pillar', 'Topic', 'Subtopic', 'Commentary', 'Draft Year'],
      'deep-dive': 'ALL'
    },
    pdfEnabled: true,
    pdfFilePrefix: 'selected-policies'
  },
  tools: {
    itemKey: 'tools',
    columnsKey: 'toolColumns',
    primaryField: 'Tool Title',
    relationField: 'Policies',
    hiddenColumns: ['#', 'Tool ID', 'ID', 'Tool Identifier', 'Approval Status', 'Archived'],
    cardColumnsByView: {
      skim: ['Tool Title'],
      peruse: ['Tool Title', 'Tool Explanation'],
      'deep-dive': 'ALL'
    },
    pdfColumnsByView: {},
    pdfEnabled: false,
    pdfFilePrefix: 'selected-tools'
  }
};

const CHIP_FIELDS = ['Scope', 'Jurisdiction', 'UNFCCC Pillar', 'Topic', 'Subtopic', 'Draft Year'];
const AIRTABLE_ISSUES_FORM_PAGE_ID = 'pagKTnIMYpGFugulQ';
// Read formatting values from pdf-config.js (window.PDF_CONFIG) with hard-coded fallbacks.
const _pdfCfg = window.PDF_CONFIG || {};
const _pdfColors = _pdfCfg.colors || {};
const _pdfType = _pdfCfg.typography || {
  lineHeightMultiplier: 1.15,
  paragraphSpacing: 6,
  normal:   { size: 11, style: 'regular' },
  policy:   { size: 12, style: 'regular' },
  title:    { size: 24, style: 'black' },
  subtitle: { size: 14, style: 'light' },
  heading1: { size: 20, style: 'extraBold' },
  heading2: { size: 18, style: 'regular' },
  heading3: { size: 14, style: 'italic' }
};

const PDF_PAGE_MARGIN          = _pdfCfg.pageMargin          ?? 40;
const PDF_LINE_HEIGHT          = 14; // legacy fallback used by splitTextForPdf
const PDF_CONTENT_BOTTOM_MARGIN = _pdfCfg.contentBottomMargin ?? 75;
const PDF_TOC_TITLE_SIZE       = _pdfCfg.tocTitleSize         ?? 22;
const PDF_FOOTER_TEXT_SIZE     = _pdfCfg.footerTextSize       ?? 10;
const PDF_PAGE_WIDTH           = _pdfCfg.pageWidth            ?? 612;
const PDF_PAGE_HEIGHT          = _pdfCfg.pageHeight           ?? 792;
const PDF_FOOTER_LOGO_Y        = _pdfCfg.footerLogoY          ?? 18;
const PDF_FOOTER_PAGE_NUMBER_Y = _pdfCfg.footerPageNumberY    ?? 24;
const PDF_LOGO_MAX_WIDTH       = _pdfCfg.footerLogoMaxWidth   ?? 90;
const PDF_LABEL_COLUMN_WIDTH   = _pdfCfg.labelColumnWidth     ?? 108;
const PDF_TABLE_COLUMN_GAP     = _pdfCfg.tableColumnGap       ?? 12;
const PDF_TABLE_INDENT         = _pdfCfg.tableIndent          ?? 36;
const PDF_BRAND_COLORS         = _pdfColors;
const PDF_BRAND_TYPE           = _pdfType;
const PDF_FONT_ASSETS          = _pdfCfg.fonts || {};
const PDF_ASSETS = {
  coverPage: './assets/first_page.pdf',
  tableOfContentsBackground: './assets/table_of_contents_background.svg',
  logo: './assets/LCOY_USA_Logo.png'
};
const FILE_PROTOCOL_ASSET_HINT =
  ' (Tip: serve the app over HTTP, e.g. `python3 -m http.server 8000`, instead of opening index.html directly.)';

const pageType = document.body.dataset.page === 'tools' ? 'tools' : 'policies';
const pageConfig = PAGE_CONFIGS[pageType];
const sourceData = window.NYS_BUILDER_DATA || {};

const els = {
  viewLevelSelector: document.getElementById('viewLevelSelector'),
  groupBy: document.getElementById('groupBy'),
  filterScope: document.getElementById('filterScope'),
  topicSubtopicFilter: document.getElementById('topicSubtopicFilter'),
  cardSearch: document.getElementById('itemSearch'),
  selectAllVisible: document.getElementById('selectAllVisible'),
  shareBtn: document.getElementById('shareBtn'),
  pdfBtn: document.getElementById('pdfBtn'),
  cardGroups: document.getElementById('itemGroups')
};

const state = {
  policies: [],
  tools: [],
  items: [],
  itemColumns: [],
  toolsById: new Map(),
  policiesById: new Map(),
  selectedIds: new Set(),
  visibleIds: [],
  onlySelectedFromLink: false,
  viewMode: 'skim',
  cardViewLevels: new Map(),
  topicSubtopicFilter: new Set(),
  topicsData: [],
  searchQuery: '',
  openToolId: ''
};

let activePanelItemId = null;
let tooltipEl = null;
let sidePanelEl = null;

function splitMulti(value) {
  return String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatFieldValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
      .join(', ');
  }
  if (value == null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }
  return String(value).trim();
}

function normalizeFieldName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getColumnKey(columns, fieldName) {
  if (!columns || typeof columns !== 'object' || Array.isArray(columns)) return null;
  if (Object.hasOwn(columns, fieldName)) return fieldName;

  const normalizedTarget = normalizeFieldName(fieldName);
  return Object.keys(columns).find((key) => normalizeFieldName(key) === normalizedTarget) || null;
}

function getColumnValue(columns, fieldName) {
  const key = getColumnKey(columns, fieldName);
  return key ? columns[key] : '';
}

function asArrayValues(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  return splitMulti(formatFieldValue(value));
}

function buildFilterOptions(values) {
  return ['All', ...[...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))];
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightMatches(text, query) {
  const source = String(text ?? '');
  if (!query) return escapeHtml(source);
  const matcher = new RegExp(`(${escapeRegExp(query)})`, 'gi');
  return escapeHtml(source).replace(matcher, '<mark class="search-highlight">$1</mark>');
}

function normalizePdfText(value) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').trim();
}

function hexToPdfRgb(hex, rgb) {
  const normalized = String(hex || '').trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return rgb(0.1, 0.1, 0.1);
  }
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  return rgb(red, green, blue);
}

function formatPdfValue(value) {
  const normalized = normalizePdfText(value);
  return normalized || 'N/A';
}

function buildPdfFilename() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${pageConfig.pdfFilePrefix}-${state.viewMode}-${year}-${month}-${day}.pdf`;
}

function getAssetFetchModeHint() {
  return window.location.protocol === 'file:' ? FILE_PROTOCOL_ASSET_HINT : '';
}

async function fetchAssetBytes(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    throw new Error(`Failed to load ${path}: ${error.message}${getAssetFetchModeHint()}`);
  }
}

async function fetchAssetText(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    throw new Error(`Failed to load ${path}: ${error.message}${getAssetFetchModeHint()}`);
  }
}

async function loadSvgAsPngBytes(path, width, height) {
  const svgText = await fetchAssetText(path);
  const blob = new Blob([svgText], { type: 'image/svg+xml' });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Unable to decode SVG asset at ${path}`));
      img.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error(
        'Failed to create 2D canvas context for rendering the table-of-contents background. This may indicate a browser compatibility issue.'
      );
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1] || '';
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function splitTextForPdf(text, font, fontSize, maxWidth) {
  const value = formatPdfValue(text);
  const result = [];
  const paragraphs = value.split(/\r?\n/);

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);

    if (!words.length) {
      result.push('');
    } else {
      let line = words[0];
      for (let i = 1; i < words.length; i += 1) {
        const candidate = `${line} ${words[i]}`;
        if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
          line = candidate;
        } else {
          result.push(line);
          line = words[i];
        }
      }
      result.push(line);
    }

    if (paragraphIndex < paragraphs.length - 1 && result.length > 0 && result[result.length - 1] !== '') {
      result.push('');
    }
  });

  return result;
}

function downloadPdfBlob(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function setSelectOptions(selectEl, options) {
  const current = selectEl.value;
  selectEl.replaceChildren();
  options.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    selectEl.append(option);
  });
  if (options.includes(current)) {
    selectEl.value = current;
  }
}

function isHiddenColumn(columnName) {
  const normalized = normalizeFieldName(columnName);
  return pageConfig.hiddenColumns.some((name) => normalizeFieldName(name) === normalized);
}

function isChipField(columnName) {
  const normalized = normalizeFieldName(columnName);
  return CHIP_FIELDS.some((name) => normalizeFieldName(name) === normalized);
}

function getEntityPrimaryText(item, kind) {
  const config = PAGE_CONFIGS[kind];
  return formatFieldValue(getColumnValue(item.columns, config.primaryField) || item.primaryText);
}

function getItemSearchText(item) {
  return getEntityPrimaryText(item, pageType);
}

function getRelationshipText(item, label) {
  if (normalizeFieldName(label) !== normalizeFieldName(pageConfig.relationField)) {
    return null;
  }

  const relatedTitles = (pageType === 'policies' ? item.toolIds : item.policyIds)
    .map((id) => (pageType === 'policies' ? state.toolsById.get(id) : state.policiesById.get(id)))
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return relatedTitles.join(', ');
}

function getRelatedItems(item) {
  if (pageType === 'policies') {
    return item.toolIds.map((id) => state.tools.find((tool) => tool.id === id)).filter(Boolean);
  }
  return item.policyIds.map((id) => state.policies.find((p) => p.id === id)).filter(Boolean);
}

function getRelatedTooltip(relatedItem) {
  const text =
    pageType === 'policies'
      ? formatFieldValue(getColumnValue(relatedItem.columns, 'Tool Explanation'))
      : formatFieldValue(getColumnValue(relatedItem.columns, 'Commentary'));
  if (!text) return '';
  return text.length > 220 ? `${text.slice(0, 220)}\u2026` : text;
}

function renderRelationField(label, item) {
  const relatedKind = pageType === 'policies' ? 'tools' : 'policies';
  const relatedItems = getRelatedItems(item);
  if (!relatedItems.length) {
    return `<div class="field"><span class="field-label">${escapeHtml(label)}:</span><span class="field-value"><span class="muted">N/A</span></span></div>`;
  }
  const listItems = relatedItems
    .map((relatedItem) => {
      const primaryText = getEntityPrimaryText(relatedItem, relatedKind);
      const tooltip = getRelatedTooltip(relatedItem);
      return `<li class="related-list-item" data-related-id="${escapeHtml(relatedItem.id)}" data-related-kind="${escapeHtml(relatedKind)}" data-tooltip="${escapeHtml(tooltip)}">${escapeHtml(primaryText)}</li>`;
    })
    .join('');
  return `<div class="field"><span class="field-label">${escapeHtml(label)}:</span><span class="field-value"><ul class="related-list">${listItems}</ul></span></div>`;
}

function buildSidePanelHtml(item, kind) {
  const config = PAGE_CONFIGS[kind];
  const metaCols = Array.isArray(sourceData?.metadata?.[config.columnsKey])
    ? sourceData.metadata[config.columnsKey].map((n) => String(n || '').trim()).filter(Boolean)
    : [];
  const orderedCols = [...new Set([...metaCols, ...Object.keys(item.columns)])];
  const fields = orderedCols
    .filter((col) => {
      if (config.hiddenColumns.some((h) => normalizeFieldName(h) === normalizeFieldName(col))) return false;
      if (shouldHideColumnForItem(item, col)) return false;
      if (isChipField(col)) return false;
      return true;
    })
    .map((col) => {
      const formatted = formatFieldValue(getColumnValue(item.columns, col));
      if (!formatted) return '';
      return `<div class="field"><span class="field-label">${escapeHtml(col)}:</span><span class="field-value">${escapeHtml(formatted)}</span></div>`;
    })
    .filter(Boolean)
    .join('');
  const chips = CHIP_FIELDS.flatMap((fieldName) => {
    if (shouldHideColumnForItem(item, fieldName)) return [];
    const value = getColumnValue(item.columns, fieldName);
    if (!value) return [];
    return asArrayValues(value).map((chipValue) => `<span class="${chipClass(fieldName)}">${escapeHtml(chipValue)}</span>`);
  }).join('');
  return `${fields}${chips ? `<div class="card-chips">${chips}</div>` : ''}`;
}

function openRelatedPanel(itemId, kind) {
  const relatedItem =
    kind === 'tools' ? state.tools.find((tool) => tool.id === itemId) : state.policies.find((p) => p.id === itemId);
  if (!relatedItem) return;

  document.querySelectorAll('.related-list-item--active').forEach((el) => el.classList.remove('related-list-item--active'));
  document.querySelectorAll(`.related-list-item[data-related-id="${CSS.escape(itemId)}"]`).forEach((el) =>
    el.classList.add('related-list-item--active')
  );
  activePanelItemId = itemId;

  const kindLabel = kind === 'tools' ? 'Related Tool' : 'Related Policy';
  sidePanelEl.querySelector('.related-side-panel-kind').textContent = kindLabel;
  sidePanelEl.querySelector('.related-side-panel-body').innerHTML = buildSidePanelHtml(relatedItem, kind);
  sidePanelEl.hidden = false;
  if (tooltipEl) tooltipEl.hidden = true;
}

function closeRelatedPanel() {
  if (!sidePanelEl) return;
  sidePanelEl.hidden = true;
  activePanelItemId = null;
  document.querySelectorAll('.related-list-item--active').forEach((el) => el.classList.remove('related-list-item--active'));
}

function initRelatedPanels() {
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'related-tooltip';
  tooltipEl.hidden = true;
  document.body.appendChild(tooltipEl);

  sidePanelEl = document.createElement('div');
  sidePanelEl.className = 'related-side-panel';
  sidePanelEl.hidden = true;
  sidePanelEl.innerHTML =
    '<div class="related-side-panel-overlay"></div>' +
    '<div class="related-side-panel-drawer">' +
    '<div class="related-side-panel-header">' +
    '<span class="related-side-panel-kind"></span>' +
    '<button class="related-side-panel-close" type="button" aria-label="Close panel">\u00d7</button>' +
    '</div>' +
    '<div class="related-side-panel-body"></div>' +
    '</div>';
  document.body.appendChild(sidePanelEl);

  document.addEventListener('mouseover', (e) => {
    const listItem = e.target.closest('.related-list-item');
    if (!listItem || listItem.classList.contains('related-list-item--active')) return;
    const tip = listItem.dataset.tooltip || '';
    if (!tip) return;
    tooltipEl.textContent = tip;
    tooltipEl.hidden = false;
  });

  document.addEventListener('mouseout', (e) => {
    const listItem = e.target.closest('.related-list-item');
    if (listItem && !listItem.contains(e.relatedTarget)) {
      tooltipEl.hidden = true;
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (tooltipEl && !tooltipEl.hidden) {
      tooltipEl.style.left = `${Math.min(e.clientX + 14, window.innerWidth - 320)}px`;
      tooltipEl.style.top = `${Math.min(e.clientY + 14, window.innerHeight - 60)}px`;
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('.related-side-panel-close')) {
      closeRelatedPanel();
      return;
    }

    const listItem = e.target.closest('.related-list-item');
    if (listItem) {
      const id = listItem.dataset.relatedId;
      const kind = listItem.dataset.relatedKind;
      if (id === activePanelItemId) {
        closeRelatedPanel();
      } else {
        openRelatedPanel(id, kind);
      }
      return;
    }

    const drawer = sidePanelEl && sidePanelEl.querySelector('.related-side-panel-drawer');
    if (!sidePanelEl.hidden && drawer && !drawer.contains(e.target)) {
      closeRelatedPanel();
    }
  });
}

function shouldHideJurisdiction(item) {
  return normalizeFieldName(item?.scope) === 'international';
}

function shouldHideColumnForItem(item, columnName) {
  return shouldHideJurisdiction(item) && normalizeFieldName(columnName) === normalizeFieldName('Jurisdiction');
}

function renderField(label, value, item) {
  if (shouldHideColumnForItem(item, label)) return '';

  if (normalizeFieldName(label) === normalizeFieldName(pageConfig.relationField)) {
    return renderRelationField(label, item);
  }

  const text = formatFieldValue(value);
  const normalizedSearchQuery = state.searchQuery.trim();
  const shouldHighlight = normalizeFieldName(label) === normalizeFieldName(pageConfig.primaryField) && normalizedSearchQuery;

  return `<div class="field"><span class="field-label">${escapeHtml(label)}:</span><span class="field-value">${
    text ? (shouldHighlight ? highlightMatches(text, normalizedSearchQuery) : escapeHtml(text)) : '<span class="muted">N/A</span>'
  }</span></div>`;
}

function getFilteredItems() {
  let filtered = state.items.filter((item) => {
    const scopePass = els.filterScope.value === 'All' || item.scope === els.filterScope.value;

    let topicPass = true;
    if (state.topicSubtopicFilter.size > 0) {
      const itemTopics = asArrayValues(getColumnValue(item.columns, 'Topic') || item.issueAreas);
      const itemSubtopics = asArrayValues(getColumnValue(item.columns, 'Subtopic'));
      topicPass =
        itemTopics.some((topic) => state.topicSubtopicFilter.has(topic)) ||
        itemSubtopics.some((subtopic) => state.topicSubtopicFilter.has(subtopic));
    }

    const normalizedSearchQuery = state.searchQuery.trim().toLowerCase();
    const itemText = getItemSearchText(item).toLowerCase();
    const searchPass = !normalizedSearchQuery || itemText.includes(normalizedSearchQuery);

    return scopePass && topicPass && searchPass;
  });

  if (state.onlySelectedFromLink) {
    filtered = filtered.filter((item) => state.selectedIds.has(item.id));
  }

  return filtered;
}

function buildGroups(items) {
  const groups = new Map();
  const keyName = els.groupBy.value;

  items.forEach((item) => {
    let keys;
    if (keyName === 'issueAreas') {
      keys = item.issueAreas.length ? item.issueAreas : ['Unspecified'];
    } else {
      keys = [item.scope || 'Unspecified'];
    }

    keys.forEach((key) => {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
  });

  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function chipClass(fieldName) {
  return `chip chip-${normalizeFieldName(fieldName).replace(/\s+/g, '-')}`;
}

function cardHtml(item, viewMode) {
  const itemId = escapeHtml(item.id);
  const checked = state.selectedIds.has(item.id) ? 'checked' : '';
  const cardView = viewMode || state.viewMode;
  const configuredColumns = pageConfig.cardColumnsByView[cardView] || pageConfig.cardColumnsByView.skim;
  const availableColumns = new Set(state.itemColumns.map((column) => normalizeFieldName(column)));
  const bodyColumns =
    configuredColumns === 'ALL'
      ? state.itemColumns.filter((column) => !isHiddenColumn(column) && !isChipField(column))
      : configuredColumns.filter((column) => availableColumns.has(normalizeFieldName(column)));

  const seenColumns = new Set();

  const regularFields = bodyColumns
    .map((column) => {
      const actualColumn = getColumnKey(item.columns, column) || column;
      return [actualColumn, getColumnValue(item.columns, actualColumn)];
    })
    .filter(([column, value]) => {
      if (!formatFieldValue(value)) return false;
      const normalizedColumn = normalizeFieldName(column);
      if (seenColumns.has(normalizedColumn)) return false;
      if (shouldHideColumnForItem(item, column)) return false;
      seenColumns.add(normalizedColumn);
      return true;
    })
    .map(([column, value]) => renderField(column, value, item))
    .join('');

  const chips = CHIP_FIELDS.flatMap((fieldName) => {
    if (shouldHideColumnForItem(item, fieldName)) return [];
    const value = getColumnValue(item.columns, fieldName);
    if (!value) return [];
    return asArrayValues(value).map((chipValue) => `<span class="${chipClass(fieldName)}">${escapeHtml(chipValue)}</span>`);
  }).join('');

  let expandButtons = '';
  if (cardView === 'skim') {
    expandButtons = `<button class="card-expand-btn" data-item-id="${itemId}" data-target="peruse" title="Expand to Peruse">â–¼</button>`;
  } else if (cardView === 'peruse') {
    expandButtons =
      `<button class="card-expand-btn" data-item-id="${itemId}" data-target="skim" title="Collapse to Skim">â–²</button>` +
      `<button class="card-expand-btn" data-item-id="${itemId}" data-target="deep-dive" title="Expand to Deep Dive">â–¼</button>`;
  } else if (cardView === 'deep-dive') {
    expandButtons = `<button class="card-expand-btn" data-item-id="${itemId}" data-target="peruse" title="Collapse to Peruse">â–²</button>`;
  }

  let suggestEditBtn = '';
  if (pageType === 'policies' && item.airtableId) {
    const baseId = sourceData.metadata?.baseId || '';
    const formUrl = `https://airtable.com/${baseId}/${AIRTABLE_ISSUES_FORM_PAGE_ID}/form?prefill_Issue+Type=Policy&prefill_Policy=${encodeURIComponent(item.airtableId)}`;
    suggestEditBtn = `<a class="card-suggest-edit-btn" href="${escapeHtml(formUrl)}" target="_blank" rel="noopener noreferrer">âœ Suggest Edit</a>`;
  }

  let viewAllBtn = '';
  if (cardView === 'deep-dive') {
    const visibleRelated = getRelatedItems(item);
    if (visibleRelated.length > 0) {
      const targetPage = pageType === 'policies' ? './tools.html' : './index.html';
      const targetLabel = pageType === 'policies' ? 'tools' : 'policies';
      const url = `${targetPage}?selected=${visibleRelated.map((r) => r.id).join(',')}&onlySelected=1`;
      viewAllBtn = `<a class="card-view-all-btn" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">View all ${escapeHtml(targetLabel)} on this card \u2192</a>`;
    }
  }

  return `<article class="card" data-item-id="${itemId}" data-view="${escapeHtml(cardView)}">
    <div class="card-header">
      <input class="card-checkbox" type="checkbox" data-item-id="${itemId}" ${checked} />
      <div class="card-expand-controls">${expandButtons}</div>
    </div>
    ${regularFields}
    ${viewAllBtn ? `<div class="card-view-all-row">${viewAllBtn}</div>` : ''}
    ${chips ? `<div class="card-chips">${chips}</div>` : ''}
    ${suggestEditBtn ? `<div class="card-footer">${suggestEditBtn}</div>` : ''}
  </article>`;
}

function updateSelectAllVisible() {
  const ids = state.visibleIds;
  if (!ids.length) {
    els.selectAllVisible.checked = false;
    els.selectAllVisible.indeterminate = false;
    return;
  }

  const selectedCount = ids.filter((id) => state.selectedIds.has(id)).length;
  els.selectAllVisible.checked = selectedCount === ids.length;
  els.selectAllVisible.indeterminate = selectedCount > 0 && selectedCount < ids.length;
}

function render() {
  const filtered = getFilteredItems();
  const groups = buildGroups(filtered);
  state.visibleIds = [...new Set(filtered.map((item) => item.id))];

  if (!groups.length) {
    els.cardGroups.innerHTML = '<p class="muted">No cards match the current filters.</p>';
    updateSelectAllVisible();
    return;
  }

  els.cardGroups.innerHTML = groups
    .map(
      ([title, items]) => `
        <section class="group">
          <h3>${escapeHtml(title)}</h3>
          <div class="cards">
            ${items.map((item) => cardHtml(item, state.cardViewLevels.get(item.id) || state.viewMode)).join('')}
          </div>
        </section>
      `
    )
    .join('');

  if (activePanelItemId) {
    els.cardGroups.querySelectorAll(`.related-list-item[data-related-id="${CSS.escape(activePanelItemId)}"]`).forEach((el) => {
      el.classList.add('related-list-item--active');
    });
  }

  updateSelectAllVisible();
}

function renderTopicFilter() {
  const container = els.topicSubtopicFilter;
  container.innerHTML = '';

  state.topicsData.forEach((topic) => {
    const topicWrapper = document.createElement('div');
    topicWrapper.className = 'topic-item';

    const allSubChecked = topic.subtopics.length > 0 && topic.subtopics.every((subtopic) => state.topicSubtopicFilter.has(subtopic));
    const someSubChecked = topic.subtopics.some((subtopic) => state.topicSubtopicFilter.has(subtopic));

    const topicLabel = document.createElement('label');
    topicLabel.className = 'topic-label';

    const topicCheckbox = document.createElement('input');
    topicCheckbox.type = 'checkbox';
    topicCheckbox.className = 'topic-checkbox';
    topicCheckbox.checked = allSubChecked;
    topicCheckbox.indeterminate = !allSubChecked && someSubChecked;

    topicCheckbox.addEventListener('change', () => {
      if (topicCheckbox.checked) {
        topic.subtopics.forEach((subtopic) => state.topicSubtopicFilter.add(subtopic));
      } else {
        topic.subtopics.forEach((subtopic) => state.topicSubtopicFilter.delete(subtopic));
      }
      renderTopicFilter();
      render();
    });

    topicLabel.append(topicCheckbox, document.createTextNode(`\u00a0${topic.name}`));
    topicWrapper.appendChild(topicLabel);

    if (topic.subtopics.length > 0) {
      const subtopicList = document.createElement('div');
      subtopicList.className = 'subtopic-list';

      topic.subtopics.forEach((subtopicName) => {
        const subLabel = document.createElement('label');
        subLabel.className = 'subtopic-label';

        const subCheckbox = document.createElement('input');
        subCheckbox.type = 'checkbox';
        subCheckbox.className = 'subtopic-checkbox';
        subCheckbox.checked = state.topicSubtopicFilter.has(subtopicName);

        subCheckbox.addEventListener('change', () => {
          if (subCheckbox.checked) {
            state.topicSubtopicFilter.add(subtopicName);
          } else {
            state.topicSubtopicFilter.delete(subtopicName);
          }
          renderTopicFilter();
          render();
        });

        subLabel.append(subCheckbox, document.createTextNode(`\u00a0${subtopicName}`));
        subtopicList.appendChild(subLabel);
      });

      topicWrapper.appendChild(subtopicList);
    }

    container.appendChild(topicWrapper);
  });
}

function copyShareLink() {
  if (!state.selectedIds.size) {
    alert('Select at least one card first.');
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set('view', state.viewMode);
  url.searchParams.set('selected', [...state.selectedIds].join(','));
  url.searchParams.set('onlySelected', '1');

  const link = url.toString();

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(link).then(
      () => alert('Share link copied to clipboard.'),
      () => prompt('Clipboard unavailable - copy this share link manually:', link)
    );
  } else {
    prompt('Clipboard unavailable - copy this share link manually:', link);
  }
}

function promptPdfCommentaryMode() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'pdf-export-modal';
    overlay.innerHTML =
      '<div class="pdf-export-modal-overlay"></div>' +
      '<div class="pdf-export-modal-dialog" role="dialog" aria-modal="true" aria-label="PDF export options">' +
      '<h3 class="pdf-export-modal-title">Export PDF options</h3>' +
      '<p class="pdf-export-modal-subtitle">Choose how policy commentary should be handled in the export.</p>' +
      '<div class="pdf-export-modal-actions">' +
      '<button class="pdf-export-option-btn pdf-export-option-btn--with-commentary" data-pdf-option="with" type="button">With commentary</button>' +
      '<button class="pdf-export-option-btn" data-pdf-option="without" type="button">Without commentary</button>' +
      '<button class="pdf-export-cancel-btn" data-pdf-option="cancel" type="button">Cancel</button>' +
      '</div>' +
      '</div>';

    const cleanup = (result) => {
      document.removeEventListener('keydown', handleKeyDown);
      overlay.remove();
      resolve(result);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        cleanup(null);
      }
    };

    overlay.addEventListener('click', (event) => {
      const optionButton = event.target.closest('[data-pdf-option]');
      if (optionButton) {
        const selected = optionButton.getAttribute('data-pdf-option');
        if (selected === 'with') {
          cleanup('with');
        } else if (selected === 'without') {
          cleanup('without');
        } else {
          cleanup(null);
        }
        return;
      }

      if (event.target.classList.contains('pdf-export-modal-overlay')) {
        cleanup(null);
      }
    });

    document.addEventListener('keydown', handleKeyDown);
    document.body.appendChild(overlay);
  });
}

async function downloadPdf() {
  if (!pageConfig.pdfEnabled) return;

  const selectedItems = state.items.filter((item) => state.selectedIds.has(item.id));
  if (!selectedItems.length) {
    alert('Select at least one card first.');
    return;
  }

  const commentaryMode = await promptPdfCommentaryMode();
  if (!commentaryMode) return;
  const includeCommentary = commentaryMode === 'with';

  const grouped = buildGroups(selectedItems);
  const pdfLib = window.PDFLib;
  if (!pdfLib?.PDFDocument || !pdfLib?.StandardFonts || !pdfLib?.rgb) {
    alert('PDF download is temporarily unavailable. Please refresh and try again.');
    return;
  }

  try {
    const { PDFDocument, StandardFonts, rgb } = pdfLib;
    const pdfDoc = await PDFDocument.create();
    const pageWidth = PDF_PAGE_WIDTH;
    const pageHeight = PDF_PAGE_HEIGHT;
    const textWidth = pageWidth - PDF_PAGE_MARGIN * 2;
    const cfgPalette = _pdfCfg.palette || { heading: 'marineBlue', body: 'black', accent: 'turquoise', alert: 'unionRed' };
    const palette = {
      heading: hexToPdfRgb(PDF_BRAND_COLORS[cfgPalette.heading], rgb),
      body: hexToPdfRgb(PDF_BRAND_COLORS[cfgPalette.body], rgb),
      accent: hexToPdfRgb(PDF_BRAND_COLORS[cfgPalette.accent], rgb),
      alert: hexToPdfRgb(PDF_BRAND_COLORS[cfgPalette.alert], rgb)
    };

    const policyBlocksCfg = _pdfCfg.policyBlocks || {};
    const bandA = hexToPdfRgb(policyBlocksCfg.bandAColor || '#fcfcfc', rgb);
    const bandB = hexToPdfRgb(policyBlocksCfg.bandBColor || '#f1f1f1', rgb);
    const commentaryColor = hexToPdfRgb(policyBlocksCfg.commentaryTextColor || '#595959', rgb);

    const defaultFonts = {
      regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
      light: await pdfDoc.embedFont(StandardFonts.Helvetica),
      italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
      extraBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
      black: await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    };
    const fonts = { ...defaultFonts };
    try {
      if (window.fontkit && typeof pdfDoc.registerFontkit === 'function') {
        pdfDoc.registerFontkit(window.fontkit);
        const fontEntries = await Promise.all(
          Object.entries(PDF_FONT_ASSETS).map(async ([key, path]) => [key, await fetchAssetBytes(path)])
        );
        for (const [key, bytes] of fontEntries) {
          fonts[key] = await pdfDoc.embedFont(bytes);
        }
      }
    } catch (error) {
      console.warn('Montserrat fonts could not be loaded. Continuing with fallback fonts.', error);
    }

    const getFont = (styleName) => fonts[styleName] || fonts.regular;
    const lineHeight = (fontSize) => fontSize * PDF_BRAND_TYPE.lineHeightMultiplier;
    const splitWords = (text) => normalizePdfText(text).split(/\s+/).filter(Boolean);

    const buildWrappedWordLines = (words, font, size, maxWidth) => {
      if (!words.length) return [[]];
      const lines = [];
      let currentLine = [words[0]];
      for (let index = 1; index < words.length; index += 1) {
        const candidate = [...currentLine, words[index]].join(' ');
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
          currentLine.push(words[index]);
        } else {
          lines.push(currentLine);
          currentLine = [words[index]];
        }
      }
      lines.push(currentLine);
      return lines;
    };

    let logoImage = null;
    let logoWidth = 0;
    let logoHeight = 0;

    try {
      const coverPdfBytes = await fetchAssetBytes(PDF_ASSETS.coverPage);
      const coverSource = await PDFDocument.load(coverPdfBytes);
      const [coverPage] = await pdfDoc.copyPages(coverSource, [0]);
      pdfDoc.addPage(coverPage);
    } catch (error) {
      console.warn('Cover page asset failed to load. Using fallback cover page.', error);
      const fallbackCover = pdfDoc.addPage([pageWidth, pageHeight]);
      fallbackCover.drawText('Policies from the National Youth Statement on Climate', {
        x: PDF_PAGE_MARGIN,
        y: pageHeight - PDF_PAGE_MARGIN - 40,
        size: PDF_BRAND_TYPE.title.size,
        font: getFont(PDF_BRAND_TYPE.title.style),
        color: palette.heading
      });
    }

    try {
      const logoBytes = await fetchAssetBytes(PDF_ASSETS.logo);
      logoImage = await pdfDoc.embedPng(logoBytes);
      const logoScale = Math.min(1, PDF_LOGO_MAX_WIDTH / logoImage.width);
      logoWidth = logoImage.width * logoScale;
      logoHeight = logoImage.height * logoScale;
    } catch (error) {
      console.warn('Logo asset failed to load. Continuing without footer logo.', error);
      logoImage = null;
    }

    let tocBackground = null;
    try {
      const tocBackgroundBytes = await loadSvgAsPngBytes(PDF_ASSETS.tableOfContentsBackground, pageWidth, pageHeight);
      tocBackground = await pdfDoc.embedPng(tocBackgroundBytes);
    } catch (error) {
      console.warn('TOC background asset failed to load. Continuing without TOC background.', error);
      tocBackground = null;
    }

    const tocPage = pdfDoc.addPage([pageWidth, pageHeight]);
    if (tocBackground) {
      tocPage.drawImage(tocBackground, { x: 0, y: 0, width: pageWidth, height: pageHeight });
    }
    tocPage.drawText('Table of Contents', {
      x: PDF_PAGE_MARGIN,
      y: pageHeight - PDF_PAGE_MARGIN - PDF_TOC_TITLE_SIZE,
      size: PDF_TOC_TITLE_SIZE,
      font: getFont('extraBold'),
      color: palette.heading
    });

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let cursorY = pageHeight - PDF_PAGE_MARGIN;
    const groupStartPages = new Map();
    let currentContentPageNumber = 1;

    const ensureSpace = (requiredHeight) => {
      if (cursorY - requiredHeight < PDF_CONTENT_BOTTOM_MARGIN) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        currentContentPageNumber += 1;
        cursorY = pageHeight - PDF_PAGE_MARGIN;
      }
    };

    const drawWordLine = ({ words, x, y, width, font, fontSize, color, justify }) => {
      if (!words.length) return;
      if (!justify || words.length < 2) {
        page.drawText(words.join(' '), { x, y, size: fontSize, font, color });
        return;
      }
      const spaceWidth = font.widthOfTextAtSize(' ', fontSize);
      const wordsWidth = words.reduce((sum, word) => sum + font.widthOfTextAtSize(word, fontSize), 0);
      const baseWidth = wordsWidth + spaceWidth * (words.length - 1);
      const extra = Math.max(0, (width - baseWidth) / (words.length - 1));
      let cursorX = x;
      words.forEach((word, index) => {
        page.drawText(word, { x: cursorX, y, size: fontSize, font, color });
        cursorX += font.widthOfTextAtSize(word, fontSize);
        if (index < words.length - 1) cursorX += spaceWidth + extra;
      });
    };

    const writeSimpleWrapped = (text, options = {}) => {
      const {
        style = 'normal',
        color = palette.body,
        indent = 0,
        width = textWidth - indent,
        justify = false,
        spacingAfter = 4,
        underline = false
      } = options;
      const typeSpec = PDF_BRAND_TYPE[style] || PDF_BRAND_TYPE.normal;
      const fontSize = typeSpec.size;
      const font = getFont(typeSpec.style);
      const words = splitWords(text);
      const lines = words.length ? buildWrappedWordLines(words, font, fontSize, width) : [[]];
      const neededHeight = Math.max(lines.length, 1) * lineHeight(fontSize) + spacingAfter;
      ensureSpace(neededHeight);
      lines.forEach((lineWords, index) => {
        drawWordLine({
          words: lineWords,
          x: PDF_PAGE_MARGIN + indent,
          y: cursorY,
          width,
          font,
          fontSize,
          color,
          justify: justify && index !== lines.length - 1
        });
        if (underline && lineWords.length) {
          const lineText = lineWords.join(' ');
          const underlineWidth = font.widthOfTextAtSize(lineText, fontSize);
          page.drawLine({
            start: { x: PDF_PAGE_MARGIN + indent, y: cursorY - 1 },
            end: { x: PDF_PAGE_MARGIN + indent + underlineWidth, y: cursorY - 1 },
            thickness: 0.7,
            color
          });
        }
        cursorY -= lineHeight(fontSize);
      });
      cursorY -= spacingAfter;
    };

    const writePolicyBlock = (policyNumber, policyText, commentaryText, groupPolicyIndex) => {
      const policyFontSize = (PDF_BRAND_TYPE.policy && PDF_BRAND_TYPE.policy.size) || 12;
      const numberPrefix = `${policyNumber}. `;
      const regularFont = getFont((PDF_BRAND_TYPE.policy && PDF_BRAND_TYPE.policy.style) || PDF_BRAND_TYPE.normal.style);
      const boldFont = getFont('extraBold');
      const lh = lineHeight(policyFontSize);
      const policyWords = splitWords(policyText);

      const firstWord = policyWords[0] || '';
      const remainingWords = firstWord ? policyWords.slice(1) : [];
      const spaceWidth = regularFont.widthOfTextAtSize(' ', policyFontSize);
      const numberWidth = boldFont.widthOfTextAtSize(numberPrefix, policyFontSize);
      const firstWordWidth = boldFont.widthOfTextAtSize(firstWord, policyFontSize);
      const firstLineAvailable = Math.max(40, textWidth - numberWidth - firstWordWidth - spaceWidth);

      const firstLineWords = [];
      let currentWidth = 0;
      for (let index = 0; index < remainingWords.length; index += 1) {
        const wordWidth = regularFont.widthOfTextAtSize(remainingWords[index], policyFontSize);
        const addition = (firstLineWords.length ? spaceWidth : 0) + wordWidth;
        if (currentWidth + addition <= firstLineAvailable) {
          firstLineWords.push(remainingWords[index]);
          currentWidth += addition;
        } else {
          break;
        }
      }
      const trailingWords = remainingWords.slice(firstLineWords.length);
      const trailingPolicyLines = trailingWords.length
        ? buildWrappedWordLines(trailingWords, regularFont, policyFontSize, textWidth)
        : [];

      const commentary = formatFieldValue(commentaryText);
      const showCommentary = includeCommentary && commentary;
      const commentaryInset = policyBlocksCfg.commentaryInset ?? 30;
      const commentaryQuoteArea = policyBlocksCfg.commentaryQuoteArea ?? 24;
      const commentaryWidth = textWidth - commentaryInset * 2 - commentaryQuoteArea;
      const commentaryQuoteSize = policyBlocksCfg.commentaryQuoteSize ?? 34;
      const commentaryQuoteOffsetX = policyBlocksCfg.commentaryQuoteOffsetX ?? 0;
      const commentaryQuoteOffsetY = policyBlocksCfg.commentaryQuoteOffsetY ?? 8;
      const commentaryFontSize = PDF_BRAND_TYPE.normal.size;
      const commentaryFont = getFont(PDF_BRAND_TYPE.normal.style);
      const commentaryWords = splitWords(commentary);
      const commentaryLines = showCommentary
        ? buildWrappedWordLines(commentaryWords, commentaryFont, commentaryFontSize, commentaryWidth)
        : [];

      const policyLineCount = 1 + trailingPolicyLines.length;
      const commentaryBlockHeight = showCommentary
        ? 8 + Math.max(1, commentaryLines.length) * lineHeight(commentaryFontSize) + 12
        : 0;
      const blockPaddingTop = 8;
      const blockPaddingBottom = 10;
      const blockHeight = blockPaddingTop + policyLineCount * lh + commentaryBlockHeight + blockPaddingBottom;
      const bandInsetX = policyBlocksCfg.bandInsetX ?? 6;
      const bandWidthExtra = policyBlocksCfg.bandWidthExtra ?? 12;
      const bandOffsetY = policyBlocksCfg.bandOffsetY ?? 0;
      const bandHeightExtra = policyBlocksCfg.bandHeightExtra ?? 0;

      ensureSpace(blockHeight + 2);

      const firstPolicyBaseline = cursorY - blockPaddingTop;
      const lastPolicyBaseline = firstPolicyBaseline - (policyLineCount - 1) * lh;
      const policyBandTop = firstPolicyBaseline + policyFontSize * 0.82;
      const policyBandBottom = lastPolicyBaseline - policyFontSize * 0.28;
      let contentBandBottom = policyBandBottom;
      if (showCommentary && commentaryLines.length) {
        const commentaryGap = 8;
        const commentaryLineStep = lineHeight(commentaryFontSize);
        const firstCommentaryBaseline = firstPolicyBaseline - policyLineCount * lh - commentaryGap;
        const lastCommentaryBaseline = firstCommentaryBaseline - (commentaryLines.length - 1) * commentaryLineStep;
        contentBandBottom = lastCommentaryBaseline - commentaryFontSize * 0.28;
      }
      const blockBottom = contentBandBottom + bandOffsetY;
      const bandHeight = Math.max(1, policyBandTop - contentBandBottom + bandHeightExtra);
      page.drawRectangle({
        x: PDF_PAGE_MARGIN - bandInsetX,
        y: blockBottom,
        width: textWidth + bandWidthExtra,
        height: bandHeight,
        color: groupPolicyIndex % 2 === 0 ? bandA : bandB
      });

      cursorY -= blockPaddingTop;

      if (!firstWord) {
        page.drawText(numberPrefix.trim(), {
          x: PDF_PAGE_MARGIN,
          y: cursorY,
          size: policyFontSize,
          font: boldFont,
          color: palette.body
        });
        cursorY -= lh;
      } else {
        page.drawText(numberPrefix, {
          x: PDF_PAGE_MARGIN,
          y: cursorY,
          size: policyFontSize,
          font: boldFont,
          color: palette.body
        });
        page.drawText(firstWord, {
          x: PDF_PAGE_MARGIN + numberWidth,
          y: cursorY,
          size: policyFontSize,
          font: boldFont,
          color: palette.body
        });
        if (firstLineWords.length) {
          drawWordLine({
            words: firstLineWords,
            x: PDF_PAGE_MARGIN + numberWidth + firstWordWidth + spaceWidth,
            y: cursorY,
            width: firstLineAvailable,
            font: regularFont,
            fontSize: policyFontSize,
            color: palette.body,
            justify: false
          });
        }
        cursorY -= lh;
      }

      trailingPolicyLines.forEach((lineWords, index) => {
        drawWordLine({
          words: lineWords,
          x: PDF_PAGE_MARGIN,
          y: cursorY,
          width: textWidth,
          font: regularFont,
          fontSize: policyFontSize,
          color: palette.body,
          justify: index !== trailingPolicyLines.length - 1
        });
        cursorY -= lh;
      });

      if (showCommentary) {
        cursorY -= 8;
        const commentX = PDF_PAGE_MARGIN + commentaryInset;
        const quoteX = commentX;
        const textX = commentX + commentaryQuoteArea;

        page.drawText('“', {
          x: quoteX + commentaryQuoteOffsetX,
          y: cursorY + commentaryQuoteOffsetY,
          size: commentaryQuoteSize,
          font: getFont('light'),
          color: commentaryColor
        });

        commentaryLines.forEach((lineWords, index) => {
          drawWordLine({
            words: lineWords,
            x: textX,
            y: cursorY,
            width: commentaryWidth,
            font: commentaryFont,
            fontSize: commentaryFontSize,
            color: commentaryColor,
            justify: index !== commentaryLines.length - 1
          });
          cursorY -= lineHeight(commentaryFontSize);
        });
      }

      cursorY -= blockPaddingBottom;
    };

    writeSimpleWrapped('Policies from the National Youth Statement on Climate', {
      style: 'heading1',
      color: palette.heading,
      justify: false,
      spacingAfter: 6
    });

    let policyNumber = 1;
    grouped.forEach(([title, items]) => {
      if (!groupStartPages.has(title)) groupStartPages.set(title, currentContentPageNumber);
      writeSimpleWrapped(title, {
        style: 'heading2',
        color: palette.heading,
        underline: false,
        spacingAfter: 6
      });

      items.forEach((item, groupPolicyIndex) => {
        writePolicyBlock(
          policyNumber,
          getColumnValue(item.columns, pageConfig.primaryField),
          getColumnValue(item.columns, 'Commentary'),
          groupPolicyIndex
        );
        policyNumber += 1;
      });
    });

    let tocCursorY = pageHeight - PDF_PAGE_MARGIN - PDF_TOC_TITLE_SIZE - 28;
    let tocTruncated = false;
    for (const [title] of grouped) {
      const numberLabel = groupStartPages.has(title) ? String(groupStartPages.get(title)) : '-';
      const tocFont = getFont(PDF_BRAND_TYPE.normal.style);
      const numberWidth = tocFont.widthOfTextAtSize(numberLabel, 12);
      const maxEntryWidth = pageWidth - PDF_PAGE_MARGIN * 2 - numberWidth - 20;
      const entryLines = splitTextForPdf(title, tocFont, 12, maxEntryWidth);
      const blockHeight = Math.max(entryLines.length, 1) * lineHeight(12) + 4;
      if (tocCursorY - blockHeight < PDF_CONTENT_BOTTOM_MARGIN) {
        tocTruncated = true;
        break;
      }

      for (let index = 0; index < entryLines.length; index += 1) {
        const line = entryLines[index];
        if (tocCursorY - lineHeight(12) < PDF_CONTENT_BOTTOM_MARGIN) {
          tocTruncated = true;
          break;
        }
        tocPage.drawText(line, {
          x: PDF_PAGE_MARGIN,
          y: tocCursorY,
          size: 12,
          font: tocFont,
          color: palette.heading
        });

        if (index === 0) {
          tocPage.drawText(numberLabel, {
            x: pageWidth - PDF_PAGE_MARGIN - numberWidth,
            y: tocCursorY,
            size: 12,
            font: getFont('extraBold'),
            color: palette.heading
          });
        }

        tocCursorY -= lineHeight(12);
      }

      if (tocTruncated) break;
      tocCursorY -= 4;
    }

    if (tocTruncated) {
      tocPage.drawText('Additional sections omitted from this page.', {
        x: PDF_PAGE_MARGIN,
        y: PDF_CONTENT_BOTTOM_MARGIN - 12,
        size: 10,
        font: getFont(PDF_BRAND_TYPE.normal.style),
        color: palette.heading
      });
    }

    pdfDoc.getPages().forEach((pdfPage, index) => {
      if (index < 2) return;

      const pageNumberLabel = String(index - 1);
      const pageNumberWidth = getFont(PDF_BRAND_TYPE.normal.style).widthOfTextAtSize(pageNumberLabel, PDF_FOOTER_TEXT_SIZE);
      if (logoImage) {
        pdfPage.drawImage(logoImage, {
          x: PDF_PAGE_MARGIN,
          y: PDF_FOOTER_LOGO_Y,
          width: logoWidth,
          height: logoHeight
        });
      }
      pdfPage.drawText(pageNumberLabel, {
        x: pageWidth - PDF_PAGE_MARGIN - pageNumberWidth,
        y: PDF_FOOTER_PAGE_NUMBER_Y,
        size: PDF_FOOTER_TEXT_SIZE,
        font: getFont(PDF_BRAND_TYPE.normal.style),
        color: palette.heading
      });
    });

    const pdfBytes = await pdfDoc.save();
    downloadPdfBlob(pdfBytes, buildPdfFilename());
  } catch (error) {
    alert(`Unable to generate PDF: ${error.message}`);
  }
}
function setViewMode(view) {
  state.viewMode = view;
  els.viewLevelSelector.querySelectorAll('.view-level-btn').forEach((button) => {
    button.classList.toggle('active', button.getAttribute('data-view') === view);
  });
}

function bindEvents() {
  els.viewLevelSelector.querySelectorAll('.view-level-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const newView = button.getAttribute('data-view');
      if (newView === state.viewMode) return;
      setViewMode(newView);
      state.cardViewLevels.clear();
      render();
    });
  });

  [els.groupBy, els.filterScope].forEach((element) => element.addEventListener('change', render));

  els.cardSearch.addEventListener('input', (event) => {
    state.searchQuery = event.target.value || '';
    render();
  });

  els.selectAllVisible.addEventListener('change', (event) => {
    state.visibleIds.forEach((id) => {
      if (event.target.checked) {
        state.selectedIds.add(id);
      } else {
        state.selectedIds.delete(id);
      }
    });
    render();
  });

  els.cardGroups.addEventListener('change', (event) => {
    const checkbox = event.target.closest('.card-checkbox');
    if (!checkbox) return;
    const id = checkbox.getAttribute('data-item-id');
    if (checkbox.checked) {
      state.selectedIds.add(id);
    } else {
      state.selectedIds.delete(id);
    }
    updateSelectAllVisible();
  });

  const validViewModes = new Set(['skim', 'peruse', 'deep-dive']);
  els.cardGroups.addEventListener('click', (event) => {
    const button = event.target.closest('.card-expand-btn');
    if (!button) return;
    const itemId = button.getAttribute('data-item-id');
    const target = button.getAttribute('data-target');
    if (!validViewModes.has(target)) return;
    state.cardViewLevels.set(itemId, target);
    const item = state.items.find((entry) => entry.id === itemId);
    const cardEl = els.cardGroups.querySelector(`.card[data-item-id="${CSS.escape(itemId)}"]`);
    if (item && cardEl) {
      const temp = document.createElement('div');
      temp.innerHTML = cardHtml(item, target);
      const newCard = temp.firstElementChild;
      if (newCard) {
        cardEl.replaceWith(newCard);
        if (activePanelItemId) {
          newCard.querySelectorAll(`.related-list-item[data-related-id="${CSS.escape(activePanelItemId)}"]`).forEach((el) => {
            el.classList.add('related-list-item--active');
          });
        }
      }
    }
  });

  els.shareBtn.addEventListener('click', copyShareLink);
  if (els.pdfBtn) {
    els.pdfBtn.addEventListener('click', downloadPdf);
  }
}

function initializeFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  if (['skim', 'peruse', 'deep-dive'].includes(view)) {
    setViewMode(view);
  }

  splitMulti(params.get('selected')).forEach((id) => state.selectedIds.add(id));
  state.onlySelectedFromLink = params.get('onlySelected') === '1' && state.selectedIds.size > 0;
  if (pageType === 'tools') {
    state.openToolId = (params.get('openTool') || '').trim();
  }
}

function isApprovedAndActive(item) {
  return getColumnValue(item.columns, 'Approval Status') === 'Approved' && getColumnValue(item.columns, 'Archived') === 'No';
}

function normalizePolicy(policy) {
  const columns = policy.columns && typeof policy.columns === 'object' && !Array.isArray(policy.columns) ? policy.columns : {};
  return {
    id: String(policy.id || '').trim(),
    primaryText: policy.policyText || '',
    scope: formatFieldValue(getColumnValue(columns, 'Scope') || policy.scope),
    issueAreas: asArrayValues(getColumnValue(columns, 'Topic') || policy.issueAreas),
    toolIds: Array.isArray(policy.toolIds)
      ? policy.toolIds.map((item) => String(item).trim()).filter(Boolean)
      : splitMulti(policy.toolIds),
    columns
  };
}

function normalizeTool(tool) {
  const columns = tool.columns && typeof tool.columns === 'object' && !Array.isArray(tool.columns) ? tool.columns : {};
  return {
    id: String(tool.id || '').trim(),
    primaryText:
      tool.title ||
      formatFieldValue(getColumnValue(columns, 'Tool Title')),
    scope: formatFieldValue(getColumnValue(columns, 'Scope') || tool.scope),
    issueAreas: asArrayValues(getColumnValue(columns, 'Topic') || tool.issueAreas),
    policyIds: Array.isArray(tool.policyIds) ? tool.policyIds.map((item) => String(item).trim()).filter(Boolean) : splitMulti(tool.policyIds),
    columns
  };
}

function buildTopicsData() {
  if (Array.isArray(sourceData.topics) && sourceData.topics.length > 0) {
    return sourceData.topics
      .map((topic) => ({
        name: String(topic.name || '').trim(),
        subtopics: Array.isArray(topic.subtopics) ? topic.subtopics.map((subtopic) => String(subtopic || '').trim()).filter(Boolean) : []
      }))
      .filter((topic) => topic.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const topicSubtopicMap = new Map();
  state.items.forEach((item) => {
    const topics = asArrayValues(getColumnValue(item.columns, 'Topic') || item.issueAreas);
    const subtopics = asArrayValues(getColumnValue(item.columns, 'Subtopic'));
    topics.forEach((topic) => {
      if (!topicSubtopicMap.has(topic)) topicSubtopicMap.set(topic, new Set());
      subtopics.forEach((subtopic) => topicSubtopicMap.get(topic).add(subtopic));
    });
  });

  return [...topicSubtopicMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, subtopics]) => ({ name, subtopics: [...subtopics].sort((a, b) => a.localeCompare(b)) }));
}

async function load() {
  const rawPolicies = Array.isArray(sourceData.policies) ? sourceData.policies : [];
  const rawTools = Array.isArray(sourceData.tools) ? sourceData.tools : [];

  if (!rawPolicies.length && !rawTools.length) {
    throw new Error('No Airtable data is available in data.js');
  }

  const allPolicies = rawPolicies.map(normalizePolicy);
  const allTools = rawTools.map(normalizeTool);

  state.policies = allPolicies.filter(isApprovedAndActive);
  state.tools = allTools.filter(isApprovedAndActive);
  state.policiesById = new Map(state.policies.map((policy) => [policy.id, getEntityPrimaryText(policy, 'policies') || 'Untitled Policy']));
  state.toolsById = new Map(state.tools.map((tool) => [tool.id, getEntityPrimaryText(tool, 'tools') || 'Untitled Tool']));
  state.items = pageType === 'policies' ? state.policies : state.tools;

  let metadataColumns = Array.isArray(sourceData?.metadata?.[pageConfig.columnsKey])
    ? sourceData.metadata[pageConfig.columnsKey].map((name) => String(name || '').trim()).filter(Boolean)
    : [];
  const derivedColumns = [...new Set(state.items.flatMap((item) => Object.keys(item.columns || {})))];
  state.itemColumns = [...new Set([...metadataColumns, ...derivedColumns])];
  state.topicsData = buildTopicsData();

  setSelectOptions(els.filterScope, buildFilterOptions(state.items.map((item) => item.scope)));

  renderTopicFilter();
  initializeFromQuery();
  initRelatedPanels();
  bindEvents();
  render();

  if (pageType === 'tools' && state.openToolId) {
    openRelatedPanel(state.openToolId, 'tools');
  }
}

load().catch((error) => {
  const errorEl = document.createElement('p');
  errorEl.className = 'muted';
  errorEl.textContent = `Unable to load Airtable data: ${error.message}`;
  els.cardGroups.replaceChildren(errorEl);
});
