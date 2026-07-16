import { writeFile } from 'node:fs/promises';

const AIRTABLE_API_ROOT = 'https://api.airtable.com/v0';
const META_API_ROOT = 'https://api.airtable.com/v0/meta';
const OUTPUT_FILE = new URL('../data.js', import.meta.url);

const REQUIRED_TABLES = ['policies', 'actions', 'topics', 'subtopics', 'scope', 'jurisdiction'];

const token = process.env.AIRTABLE_TOKEN;
const baseId = process.env.AIRTABLE_BASE_ID;

if (!token || !baseId) {
  console.error('Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID.');
  process.exit(1);
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value == null) return [];
  return [value].filter(Boolean);
}

function splitTextList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => toText(item)).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    if (typeof value.name === 'string' && value.name.trim()) return value.name.trim();
    if (typeof value.url === 'string' && value.url.trim()) return value.url.trim();
    return JSON.stringify(value);
  }
  return String(value).trim();
}

function pickFirstField(fields, candidates) {
  for (const candidate of candidates) {
    if (Object.hasOwn(fields, candidate) && fields[candidate] != null && fields[candidate] !== '') {
      return fields[candidate];
    }
  }
  return '';
}

function titleCase(text) {
  return String(text || '')
    .replace(/[-_]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPrimaryFieldName(tableMeta) {
  if (!tableMeta?.primaryFieldId || !Array.isArray(tableMeta.fields)) {
    return null;
  }

  const primaryField = tableMeta.fields.find((field) => field.id === tableMeta.primaryFieldId);
  return primaryField?.name || null;
}

function getTableRecordName(record, tableMeta) {
  const primaryFieldName = getPrimaryFieldName(tableMeta);
  if (primaryFieldName) {
    const primaryValue = record?.fields?.[primaryFieldName];
    const primaryText = toText(primaryValue);
    if (primaryText) return primaryText;
  }

  return (
    pickFirstField(record.fields || {}, ['Name', 'Title', 'Label', 'Value', '#', 'ID']) ||
    record.id
  );
}

async function airtableGetJson(url) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Airtable request failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function fetchSchema() {
  const schema = await airtableGetJson(`${META_API_ROOT}/bases/${baseId}/tables`);
  return Array.isArray(schema.tables) ? schema.tables : [];
}

async function fetchTableRecords(tableName) {
  const encodedName = encodeURIComponent(tableName);
  let offset;
  const records = [];

  do {
    const url = new URL(`${AIRTABLE_API_ROOT}/${baseId}/${encodedName}`);
    url.searchParams.set('pageSize', '100');
    if (offset) {
      url.searchParams.set('offset', offset);
    }

    const payload = await airtableGetJson(url.toString());
    records.push(...(payload.records || []));
    offset = payload.offset;
  } while (offset);

  return records;
}

function mapNamedTables(schemaTables) {
  const tableMap = new Map();
  for (const table of schemaTables) {
    tableMap.set(normalizeName(table.name), table);
  }

  const missing = REQUIRED_TABLES.filter((name) => !tableMap.has(name));
  if (missing.length > 0) {
    throw new Error(`Missing required Airtable tables: ${missing.join(', ')}`);
  }

  return Object.fromEntries(REQUIRED_TABLES.map((name) => [name, tableMap.get(name)]));
}

function buildSourceMaps(recordsByTable, namedTables) {
  const topicsById = new Map();
  const subtopicsById = new Map();
  const scopeById = new Map();
  const jurisdictionById = new Map();

  for (const record of recordsByTable.topics) {
    topicsById.set(record.id, getTableRecordName(record, namedTables.topics));
  }

  for (const record of recordsByTable.scope) {
    scopeById.set(record.id, getTableRecordName(record, namedTables.scope));
  }

  for (const record of recordsByTable.jurisdiction) {
    jurisdictionById.set(record.id, getTableRecordName(record, namedTables.jurisdiction));
  }

  for (const record of recordsByTable.subtopics) {
    const fields = record.fields || {};
    const parentTopicLinks = asArray(
      pickFirstField(fields, ['Topic', 'Topics', 'Parent Topic', 'Parent Topics'])
    );

    subtopicsById.set(record.id, {
      name: getTableRecordName(record, namedTables.subtopics),
      topicIds: parentTopicLinks
    });
  }

  return {
    topicsById,
    subtopicsById,
    scopeById,
    jurisdictionById
  };
}

function buildRecordNamesByTableId(recordsByTable, namedTables) {
  const recordsByTableId = new Map();

  for (const tableName of REQUIRED_TABLES) {
    const tableMeta = namedTables[tableName];
    if (!tableMeta) continue;
    recordsByTableId.set(
      tableMeta.id,
      new Map(
        recordsByTable[tableName].map((record) => [record.id, toText(getTableRecordName(record, tableMeta))])
      )
    );
  }

  return recordsByTableId;
}

function inferLinkedTableName(fieldName) {
  const normalized = normalizeName(fieldName);

  if (['scope', 'scopes'].includes(normalized)) return 'scope';
  if (['jurisdiction', 'jurisdictions'].includes(normalized)) return 'jurisdiction';
  if (['topic', 'topics', 'issue area', 'issue areas'].includes(normalized)) return 'topics';
  if (['subtopic', 'subtopics'].includes(normalized)) return 'subtopics';
  if (['action', 'actions'].includes(normalized)) return 'actions';
  if (['policy', 'policies', 'related policies'].includes(normalized)) return 'policies';

  return null;
}

function getLinkedRecordNameMap(fieldDefinition, recordNamesByTableId, namedTables) {
  const linkedTableId = fieldDefinition?.options?.linkedTableId;
  if (linkedTableId && recordNamesByTableId.has(linkedTableId)) {
    return recordNamesByTableId.get(linkedTableId);
  }

  const inferredTableName = inferLinkedTableName(fieldDefinition?.name || '');
  const inferredTable = inferredTableName ? namedTables[inferredTableName] : null;
  if (inferredTable?.id && recordNamesByTableId.has(inferredTable.id)) {
    return recordNamesByTableId.get(inferredTable.id);
  }

  return null;
}

function normalizeFieldValue(value, fieldDefinition, recordNamesByTableId, namedTables) {
  if (value == null || value === '') {
    return '';
  }

  const linkedRecordNameMap = getLinkedRecordNameMap(fieldDefinition, recordNamesByTableId, namedTables);

  const mapLinkedIds = (items) => {
    const ids = asArray(items).map((item) => toText(item)).filter(Boolean);
    if (!ids.length) return '';
    return ids.map((id) => linkedRecordNameMap?.get(id) || id).filter(Boolean);
  };

  if (linkedRecordNameMap) {
    if (Array.isArray(value)) {
      return mapLinkedIds(value);
    }

    const textValue = toText(value);
    if (/^rec[a-zA-Z0-9]+$/.test(textValue)) {
      return linkedRecordNameMap.get(textValue) || textValue;
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => toText(item)).filter(Boolean);
  }

  return toText(value);
}

function getResolvedTopicNames(fields, sourceMaps) {
  const topicRecordIds = asArray(pickFirstField(fields, ['Topic', 'Topics']));
  const subtopicRecordIds = asArray(pickFirstField(fields, ['Subtopic', 'Subtopics']));
  const topicNames = new Set();

  for (const topicId of topicRecordIds) {
    const topic = sourceMaps.topicsById.get(topicId);
    if (topic) topicNames.add(String(topic));
  }

  for (const subtopicId of subtopicRecordIds) {
    const subtopic = sourceMaps.subtopicsById.get(subtopicId);
    if (!subtopic) continue;
    if (subtopic.topicIds.length) {
      for (const topicId of subtopic.topicIds) {
        const topic = sourceMaps.topicsById.get(topicId);
        if (topic) topicNames.add(String(topic));
      }
    } else if (subtopic.name) {
      topicNames.add(String(subtopic.name));
    }
  }

  splitTextList(pickFirstField(fields, ['Issue Areas', 'Issue Area'])).forEach((name) => topicNames.add(name));
  return topicNames;
}

function getResolvedScope(fields, sourceMaps) {
  const scopeRecordIds = asArray(pickFirstField(fields, ['Scope', 'Scopes']));
  const jurisdictionRecordIds = asArray(pickFirstField(fields, ['Jurisdiction', 'Jurisdictions']));

  const scopeNames = scopeRecordIds
    .map((id) => sourceMaps.scopeById.get(id))
    .filter(Boolean)
    .map((value) => String(value));

  const jurisdictionNames = jurisdictionRecordIds
    .map((id) => sourceMaps.jurisdictionById.get(id))
    .filter(Boolean)
    .map((value) => String(value));

  const directScope = String(pickFirstField(fields, ['Scope', 'Policy Scope']) || '').trim();
  const directJurisdiction = String(pickFirstField(fields, ['Jurisdiction']) || '').trim();

  return [scopeNames.join(', '), jurisdictionNames.join(', '), directScope, directJurisdiction]
    .map((value) => String(value || '').trim())
    .find(Boolean) || '';
}

function normalizeAction(record, sourceMaps, actionTable, recordNamesByTableId, namedTables) {
  const fields = record.fields || {};
  const actionColumns = {};

  for (const field of actionTable.fields || []) {
    actionColumns[field.name] = normalizeFieldValue(fields[field.name], field, recordNamesByTableId, namedTables);
  }

  const title = String(
    pickFirstField(fields, ['Action Title', 'Action', 'Name', 'Title', 'Policy Action']) || 'Untitled Action'
  ).trim();
  const policyRecordIds = asArray(pickFirstField(fields, ['Policies', 'Policy', 'Related Policies']));
  const topicNames = getResolvedTopicNames(fields, sourceMaps);
  const scope = getResolvedScope(fields, sourceMaps);

  return {
    recordId: record.id,
    id: String(pickFirstField(fields, ['Action Identifier', '#', 'Action ID', 'ID']) || record.id).trim(),
    title,
    scope,
    issueAreas: [...topicNames].sort((a, b) => a.localeCompare(b)),
    policyRecordIds,
    columns: actionColumns
  };
}

function normalizePolicy(record, sourceMaps, policyTable, recordNamesByTableId, namedTables) {
  const fields = record.fields || {};
  const policyColumns = {};

  for (const field of policyTable.fields || []) {
    policyColumns[field.name] = normalizeFieldValue(fields[field.name], field, recordNamesByTableId, namedTables);
  }

  const policyRecordActionIds = asArray(pickFirstField(fields, ['Actions', 'Action']));
  const topicNames = getResolvedTopicNames(fields, sourceMaps);
  const scope = getResolvedScope(fields, sourceMaps);

  return {
    recordId: record.id,
    id: String(
      pickFirstField(fields, ['Policy Identifier', '#', 'Policy ID', 'ID']) || getTableRecordName(record, policyTable) || record.id
    ).trim(),
    policyText: String(
      pickFirstField(fields, ['Policy', 'Policy Text', 'Full policy language', 'Recommendation']) || ''
    ).trim(),
    scope: scope || '',
    type: String(pickFirstField(fields, ['Type', 'Policy Type']) || '').trim(),
    issueAreas: [...topicNames].sort((a, b) => a.localeCompare(b)),
    commentary: String(pickFirstField(fields, ['Commentary', 'Notes', 'Description']) || '').trim(),
    actionRecordIds: policyRecordActionIds,
    columns: policyColumns
  };
}

function buildOutputData(recordsByTable, namedTables) {
  const sourceMaps = buildSourceMaps(recordsByTable, namedTables);
  const recordNamesByTableId = buildRecordNamesByTableId(recordsByTable, namedTables);
  const policyTable = namedTables.policies;
  const actionTable = namedTables.actions;

  const actions = recordsByTable.actions.map((record) =>
    normalizeAction(record, sourceMaps, actionTable, recordNamesByTableId, namedTables)
  );
  const policies = recordsByTable.policies.map((record) =>
    normalizePolicy(record, sourceMaps, policyTable, recordNamesByTableId, namedTables)
  );

  const actionByRecordId = new Map(actions.map((action) => [action.recordId, action]));
  const policyByRecordId = new Map(policies.map((policy) => [policy.recordId, policy]));

  for (const action of actions) {
    for (const policyRecordId of action.policyRecordIds) {
      const policy = policyByRecordId.get(policyRecordId);
      if (!policy) continue;
      policy.actionRecordIds.push(action.recordId);
    }
  }

  for (const policy of policies) {
    for (const actionRecordId of policy.actionRecordIds) {
      const action = actionByRecordId.get(actionRecordId);
      if (!action) continue;
      action.policyRecordIds.push(policy.recordId);
    }
  }

  const actionList = actions
    .map((action) => {
      const linkedPolicyIds = [
        ...new Set(
          action.policyRecordIds
            .map((policyRecordId) => policyByRecordId.get(policyRecordId))
            .filter(Boolean)
            .map((policy) => policy.id)
        )
      ];

      return {
        id: action.id,
        title: action.title,
        scope: action.scope,
        issueAreas: action.issueAreas,
        policyIds: linkedPolicyIds.sort((a, b) => a.localeCompare(b)),
        columns: action.columns
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const policyList = policies
    .map((policy) => {
      const linkedActionIds = [
        ...new Set(
          policy.actionRecordIds
            .map((actionRecordId) => actionByRecordId.get(actionRecordId))
            .filter(Boolean)
            .map((action) => action.id)
        )
      ];

      return {
        id: policy.id,
        airtableId: policy.recordId,
        policyText: policy.policyText,
        scope: policy.scope,
        type: policy.type,
        issueAreas: policy.issueAreas,
        commentary: policy.commentary,
        actionIds: linkedActionIds.sort((a, b) => a.localeCompare(b)),
        columns: policy.columns
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  // Build topics hierarchy: [{name, subtopics: [name]}]
  const topicSubtopicsMap = new Map();
  for (const [topicId, topicName] of sourceMaps.topicsById) {
    topicSubtopicsMap.set(topicId, { name: String(topicName), subtopics: [] });
  }
  for (const [, subtopic] of sourceMaps.subtopicsById) {
    if (!subtopic.name) continue;
    for (const topicId of subtopic.topicIds) {
      const topicEntry = topicSubtopicsMap.get(topicId);
      if (topicEntry) topicEntry.subtopics.push(String(subtopic.name));
    }
  }
  const topicsList = [...topicSubtopicsMap.values()]
    .filter((t) => t.name)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({ name: t.name, subtopics: t.subtopics.sort((a, b) => a.localeCompare(b)) }));

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      source: 'Airtable',
      baseId,
      tables: REQUIRED_TABLES.map((name) => titleCase(name)),
      policyColumns: (policyTable.fields || []).map((field) => field.name),
      actionColumns: (actionTable.fields || []).map((field) => field.name)
    },
    actions: actionList,
    policies: policyList,
    topics: topicsList
  };
}

async function main() {
  const schemaTables = await fetchSchema();
  const namedTables = mapNamedTables(schemaTables);

  const recordsByTable = {};
  for (const tableName of REQUIRED_TABLES) {
    recordsByTable[tableName] = await fetchTableRecords(namedTables[tableName].name);
  }

  const outputData = buildOutputData(recordsByTable, namedTables);
  const jsContent = `window.NYS_BUILDER_DATA = ${JSON.stringify(outputData, null, 2)};\n`;
  await writeFile(OUTPUT_FILE, jsContent, 'utf8');

  console.log(`Wrote ${outputData.policies.length} policies and ${outputData.actions.length} actions to data.js`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});