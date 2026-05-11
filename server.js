const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = '0.0.0.0';
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

function parseCsv(content) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell.trim());
      cell = '';
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((value) => value.length > 0)) rows.push(row);
  }

  return rows;
}

function toRecords(rows) {
  if (!rows || rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = (row[index] || '').trim();
    });
    return record;
  });
}

function loadData() {
  const readCsvFile = (fileName) => {
    const filePath = path.join(ROOT_DIR, fileName);
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read ${fileName}: ${error.message}`);
    }
  };

  const actionsCsv = readCsvFile('actions.csv');
  const policiesCsv = readCsvFile('policies.csv');

  const actionRows = parseCsv(actionsCsv);
  const policyRows = parseCsv(policiesCsv);

  const rawActions = toRecords(actionRows);
  const rawPolicies = toRecords(policyRows);

  const actions = rawActions
    .filter((item) => /^A[0-9]+$/i.test(item['#'] || ''))
    .map((item) => ({
      id: item['#'],
      title: item['Action Title'],
      explanation: item['Action Explanation'],
      policyLinks: item['Policy'],
      scope: item['Scope']
    }));

  const policies = rawPolicies
    .filter((item) => /^P[0-9]+$/i.test(item['#'] || ''))
    .map((item) => ({
      id: item['#'],
      policy: item['Policy'],
      scope: item['Scope'],
      type: item['Type'],
      issueAreas: item['Issue Areas'],
      commentary: item['Commentary'],
      actions: item['Actions']
    }));

  return { actions, policies };
}

let cachedData = null;
let startupError = null;

try {
  cachedData = loadData();
} catch (error) {
  startupError = error;
  // eslint-disable-next-line no-console
  console.error('Failed to read or parse CSV files at startup.', error);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.ico') return 'image/x-icon';
  return 'text/plain; charset=utf-8';
}

function serveStatic(reqPath, res) {
  const safePath = reqPath === '/' ? '/index.html' : reqPath;
  const normalized = path.normalize(safePath).replace(/^\.\.(\/|\\|$)+/, '');
  const filePath = path.join(PUBLIC_DIR, normalized);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);

  if (parsedUrl.pathname === '/api/data') {
    if (!cachedData) {
      sendJson(res, 500, {
        error: startupError?.message || 'Failed to read or parse CSV files.'
      });
      return;
    }
    sendJson(res, 200, cachedData);
    return;
  }

  serveStatic(parsedUrl.pathname, res);
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running at http://${HOST}:${PORT}`);
});
