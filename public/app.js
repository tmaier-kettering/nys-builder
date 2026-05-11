const state = {
  policies: [],
  actionsById: new Map(),
  selected: new Set(),
  viewLevel: 'skim',
  groupBy: 'scope',
  filters: {
    scope: 'all',
    type: 'all',
    issue: 'all'
  },
  sharedMode: false
};

const elements = {
  viewLevel: document.getElementById('viewLevel'),
  groupBy: document.getElementById('groupBy'),
  filterScope: document.getElementById('filterScope'),
  filterType: document.getElementById('filterType'),
  filterIssue: document.getElementById('filterIssue'),
  cardsContainer: document.getElementById('cardsContainer'),
  selectAllVisible: document.getElementById('selectAllVisible'),
  shareLinkBtn: document.getElementById('shareLinkBtn'),
  downloadPdfBtn: document.getElementById('downloadPdfBtn'),
  sharedModeBanner: document.getElementById('sharedModeBanner')
};

function splitCsvList(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function setSelectOptions(selectEl, options, currentValue = 'all') {
  const normalized = options.map((item) => item.trim()).filter(Boolean);
  const all = ['all', ...normalized];
  const currentStillExists = all.includes(currentValue);

  selectEl.innerHTML = all
    .map((value) => {
      const label = value === 'all' ? 'All' : value;
      const selected = (currentStillExists ? currentValue : 'all') === value ? 'selected' : '';
      return `<option value="${value}" ${selected}>${label}</option>`;
    })
    .join('');
}

function policyMatchesFilters(policy) {
  if (state.filters.scope !== 'all' && policy.scope !== state.filters.scope) return false;
  if (state.filters.type !== 'all' && policy.type !== state.filters.type) return false;

  if (state.filters.issue !== 'all') {
    const issues = splitCsvList(policy.issueAreas);
    if (!issues.includes(state.filters.issue)) return false;
  }

  if (state.sharedMode && state.selected.size > 0) {
    return state.selected.has(policy.id);
  }

  return true;
}

function getVisiblePolicies() {
  return state.policies.filter(policyMatchesFilters);
}

function cardHtml(policy) {
  const isChecked = state.selected.has(policy.id) ? 'checked' : '';
  const showPeruse = state.viewLevel === 'peruse' || state.viewLevel === 'deep-dive';
  const showDeepDive = state.viewLevel === 'deep-dive';

  const actionTitles = splitCsvList(policy.actions)
    .map((actionId) => state.actionsById.get(actionId)?.title || actionId)
    .filter(Boolean)
    .join('; ');

  return `
    <article class="card" data-policy-id="${policy.id}">
      <div class="card-top">
        <input type="checkbox" class="card-checkbox" data-policy-id="${policy.id}" ${isChecked} />
        <span class="card-id">${policy.id}</span>
      </div>
      <p><span class="label">Policy:</span> ${policy.policy}</p>
      <p><span class="label">Scope:</span> ${policy.scope || '—'}</p>
      <p><span class="label">Type:</span> ${policy.type || '—'}</p>
      <p><span class="label">Issue Areas:</span> ${policy.issueAreas || '—'}</p>
      ${showPeruse ? `<p><span class="label">Commentary:</span> ${policy.commentary || '—'}</p>` : ''}
      ${showDeepDive ? `<p><span class="label">Related Action Titles:</span> ${actionTitles || '—'}</p>` : ''}
    </article>
  `;
}

function groupPolicies(policies) {
  if (state.groupBy === 'issueAreas') {
    const grouped = new Map();
    policies.forEach((policy) => {
      const issues = splitCsvList(policy.issueAreas);
      const keys = issues.length ? issues : ['Unspecified'];
      keys.forEach((key) => {
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(policy);
      });
    });
    return [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }

  const grouped = new Map();
  policies.forEach((policy) => {
    const key = state.groupBy === 'scope' ? policy.scope || 'Unspecified' : policy.type || 'Unspecified';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(policy);
  });
  return [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function updateSelectAllState(visiblePolicies) {
  if (visiblePolicies.length === 0) {
    elements.selectAllVisible.checked = false;
    elements.selectAllVisible.indeterminate = false;
    return;
  }

  const selectedVisibleCount = visiblePolicies.filter((policy) => state.selected.has(policy.id)).length;
  elements.selectAllVisible.checked = selectedVisibleCount === visiblePolicies.length;
  elements.selectAllVisible.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visiblePolicies.length;
}

function render() {
  const visiblePolicies = getVisiblePolicies();
  updateSelectAllState(visiblePolicies);

  if (visiblePolicies.length === 0) {
    elements.cardsContainer.innerHTML = '<div class="empty-state">No cards match your current filters.</div>';
    return;
  }

  const grouped = groupPolicies(visiblePolicies);

  elements.cardsContainer.innerHTML = grouped
    .map(
      ([groupName, policies]) => `
        <section class="group-section">
          <h3 class="group-title">${groupName}</h3>
          ${policies.map((policy) => cardHtml(policy)).join('')}
        </section>
      `
    )
    .join('');

  elements.cardsContainer.querySelectorAll('.card-checkbox').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const id = event.target.getAttribute('data-policy-id');
      if (!id) return;
      if (event.target.checked) state.selected.add(id);
      else state.selected.delete(id);
      updateSelectAllState(getVisiblePolicies());
    });
  });
}

function selectedPolicies() {
  return state.policies.filter((policy) => state.selected.has(policy.id));
}

function applyUrlState() {
  const params = new URLSearchParams(window.location.search);

  const view = params.get('view');
  if (view && ['skim', 'peruse', 'deep-dive'].includes(view)) {
    state.viewLevel = view;
  }

  const group = params.get('group');
  if (group && ['scope', 'type', 'issueAreas'].includes(group)) {
    state.groupBy = group;
  }

  const scope = params.get('scope');
  if (scope) state.filters.scope = scope;

  const type = params.get('type');
  if (type) state.filters.type = type;

  const issue = params.get('issue');
  if (issue) state.filters.issue = issue;

  const selected = splitCsvList(params.get('selected') || '');
  selected.forEach((id) => state.selected.add(id));

  state.sharedMode = params.get('shared') === '1' && state.selected.size > 0;
}

function syncControls() {
  elements.viewLevel.value = state.viewLevel;
  elements.groupBy.value = state.groupBy;
  elements.filterScope.value = state.filters.scope;
  elements.filterType.value = state.filters.type;
  elements.filterIssue.value = state.filters.issue;

  elements.sharedModeBanner.hidden = !state.sharedMode;
}

function populateFilterOptions() {
  const scopeOptions = uniqSorted(state.policies.map((policy) => policy.scope));
  const typeOptions = uniqSorted(state.policies.map((policy) => policy.type));
  const issueOptions = uniqSorted(state.policies.flatMap((policy) => splitCsvList(policy.issueAreas)));

  setSelectOptions(elements.filterScope, scopeOptions, state.filters.scope);
  setSelectOptions(elements.filterType, typeOptions, state.filters.type);
  setSelectOptions(elements.filterIssue, issueOptions, state.filters.issue);

  if (!['all', ...scopeOptions].includes(state.filters.scope)) state.filters.scope = 'all';
  if (!['all', ...typeOptions].includes(state.filters.type)) state.filters.type = 'all';
  if (!['all', ...issueOptions].includes(state.filters.issue)) state.filters.issue = 'all';
}

function buildShareUrl() {
  const selectedIds = [...state.selected];
  if (selectedIds.length === 0) return null;

  const params = new URLSearchParams();
  params.set('view', state.viewLevel);
  params.set('group', state.groupBy);
  params.set('scope', state.filters.scope);
  params.set('type', state.filters.type);
  params.set('issue', state.filters.issue);
  params.set('selected', selectedIds.join(','));
  params.set('shared', '1');

  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

async function handleShare() {
  const url = buildShareUrl();
  if (!url) {
    window.alert(
      'Please select at least one policy card using the checkboxes before generating a share link.'
    );
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      window.alert('Share link copied to clipboard.');
    } else {
      window.prompt('Copy this share link:', url);
    }
  } catch (err) {
    window.prompt('Copy this share link:', url);
  }
}

function policyTextForPdf(policy) {
  const lines = [
    `${policy.id}`,
    `Policy: ${policy.policy || '—'}`,
    `Scope: ${policy.scope || '—'}`,
    `Type: ${policy.type || '—'}`,
    `Issue Areas: ${policy.issueAreas || '—'}`
  ];

  if (state.viewLevel === 'peruse' || state.viewLevel === 'deep-dive') {
    lines.push(`Commentary: ${policy.commentary || '—'}`);
  }

  if (state.viewLevel === 'deep-dive') {
    const titles = splitCsvList(policy.actions)
      .map((actionId) => state.actionsById.get(actionId)?.title || actionId)
      .filter(Boolean)
      .join('; ');
    lines.push(`Related Action Titles: ${titles || '—'}`);
  }

  return lines;
}

function handlePdfDownload() {
  const selected = selectedPolicies();
  if (selected.length === 0) {
    window.alert(
      'Please select at least one policy card using the checkboxes before downloading PDF.'
    );
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    window.alert('PDF library failed to load.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setFontSize(14);
  doc.text(`Selected Policies (${state.viewLevel})`, margin, y);
  y += 22;

  doc.setFontSize(11);

  selected.forEach((policy, index) => {
    const lines = policyTextForPdf(policy);
    lines.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, maxWidth);
      if (y + wrapped.length * 14 > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(wrapped, margin, y);
      y += wrapped.length * 14 + 4;
    });

    if (index < selected.length - 1) {
      y += 6;
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.line(margin, y, pageWidth - margin, y);
      y += 12;
    }
  });

  doc.save(`selected-policies-${state.viewLevel}.pdf`);
}

function bindEvents() {
  elements.viewLevel.addEventListener('change', (event) => {
    state.viewLevel = event.target.value;
    render();
  });

  elements.groupBy.addEventListener('change', (event) => {
    state.groupBy = event.target.value;
    render();
  });

  elements.filterScope.addEventListener('change', (event) => {
    state.filters.scope = event.target.value;
    render();
  });

  elements.filterType.addEventListener('change', (event) => {
    state.filters.type = event.target.value;
    render();
  });

  elements.filterIssue.addEventListener('change', (event) => {
    state.filters.issue = event.target.value;
    render();
  });

  elements.selectAllVisible.addEventListener('change', (event) => {
    const visible = getVisiblePolicies();
    if (event.target.checked) {
      visible.forEach((policy) => state.selected.add(policy.id));
    } else {
      visible.forEach((policy) => state.selected.delete(policy.id));
    }
    render();
  });

  elements.shareLinkBtn.addEventListener('click', handleShare);
  elements.downloadPdfBtn.addEventListener('click', handlePdfDownload);
}

async function init() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error('Failed to load data.');
    const data = await response.json();

    state.policies = (data.policies || []).map((policy) => ({
      id: (policy.id || '').trim(),
      policy: (policy.policy || '').trim(),
      scope: (policy.scope || '').trim(),
      type: (policy.type || '').trim(),
      issueAreas: (policy.issueAreas || '').trim(),
      commentary: (policy.commentary || '').trim(),
      actions: (policy.actions || '').trim()
    }));

    (data.actions || []).forEach((action) => {
      state.actionsById.set((action.id || '').trim(), {
        title: (action.title || '').trim()
      });
    });

    applyUrlState();
    populateFilterOptions();
    syncControls();
    bindEvents();
    render();
  } catch (error) {
    elements.cardsContainer.innerHTML =
      '<div class="empty-state">Unable to load policy data right now. Please try again.</div>';
  }
}

init();
