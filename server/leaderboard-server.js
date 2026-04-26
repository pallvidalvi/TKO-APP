const http = require('http');
const fsp = require('fs/promises');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const STORE_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(STORE_DIR, 'leaderboard-snapshot.json');

const MIME_TYPES = {
  json: 'application/json; charset=utf-8',
  html: 'text/html; charset=utf-8',
  text: 'text/plain; charset=utf-8',
};

const ensureStoreDir = async () => {
  await fsp.mkdir(STORE_DIR, { recursive: true });
};

const readSnapshot = async () => {
  try {
    const raw = await fsp.readFile(STORE_FILE, 'utf8');
    const snapshot = JSON.parse(raw);
    return snapshot && typeof snapshot === 'object' ? snapshot : null;
  } catch (error) {
    return null;
  }
};

const writeSnapshot = async snapshot => {
  await ensureStoreDir();
  await fsp.writeFile(STORE_FILE, JSON.stringify(snapshot, null, 2), 'utf8');
};

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': MIME_TYPES.json,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
};

const sendHtml = (res, statusCode, html) => {
  res.writeHead(statusCode, {
    'Content-Type': MIME_TYPES.html,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(html);
};

const escapeHtml = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatCell = value => {
  if (value === null || value === undefined || value === '') {
    return '--';
  }

  return escapeHtml(value);
};

const renderLeaderboardHtml = snapshot => {
  const title = escapeHtml(snapshot?.focusCategory || 'Leaderboard');
  const generatedAt = escapeHtml(snapshot?.generatedAt || new Date().toISOString());
  const categories = Array.isArray(snapshot?.leaderboard?.categories) ? snapshot.leaderboard.categories : [];

  const sections = categories.length
    ? categories
        .map(category => {
          const rows = Array.isArray(category?.rows) ? category.rows : [];
          const trackHeaders = Array.isArray(category?.tracks) ? category.tracks : [];

          return `
            <section class="card">
              <div class="card-header">
                <div>
                  <h2>${escapeHtml(category?.label || category?.key || 'Category')}</h2>
                  <p>${rows.length} vehicles</p>
                </div>
              </div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Sticker</th>
                      <th>Driver</th>
                      <th>Co-Driver</th>
                      <th>Total</th>
                      ${trackHeaders.map(track => `<th>${escapeHtml(track)}</th>`).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${rows
                      .map(row => {
                        const trackCells = (row.trackSummaries || [])
                          .map(summary => {
                            const entries = Array.isArray(summary?.entries) ? summary.entries : [];
                            const lines = entries.length
                              ? entries
                                  .map(
                                    entry =>
                                      `<div class="track-entry"><strong>${formatCell(entry.dayLabel)}</strong> ${formatCell(
                                        entry.timingLabel
                                      )} | ${formatCell(entry.pointsLabel)} | ${formatCell(entry.rankLabel)}</div>`
                                  )
                                  .join('')
                              : '<div class="track-entry muted">NA</div>';

                            return `<td><div class="track-cell">${lines}</div></td>`;
                          })
                          .join('');

                        return `
                          <tr>
                            <td>${formatCell(`#${row.stickerNumber}`)}</td>
                            <td>${formatCell(row.driverName)}</td>
                            <td>${formatCell(row.coDriverName)}</td>
                            <td><strong>${formatCell(row.totalPoints)} pts</strong></td>
                            ${trackCells}
                          </tr>
                        `;
                      })
                      .join('')}
                  </tbody>
                </table>
              </div>
            </section>
          `;
        })
        .join('')
    : '<div class="card"><p>No leaderboard snapshot has been imported yet.</p></div>';

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>TKO Leaderboard - ${title}</title>
      <style>
        :root {
          color-scheme: dark;
          --bg: #080b10;
          --card: #10151d;
          --card-2: #0d1218;
          --border: #24303f;
          --text: #f7f1e8;
          --muted: #c7b89a;
          --accent: #ff7a00;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Arial, Helvetica, sans-serif;
          background: radial-gradient(circle at top, #121923, var(--bg));
          color: var(--text);
          overflow-x: hidden;
        }
        .wrap {
          max-width: 1400px;
          margin: 0 auto;
          padding: 28px 18px 48px;
        }
        .floating-support-card {
          position: fixed;
          top: 92px;
          right: 18px;
          z-index: 30;
          width: min(260px, calc(100vw - 36px));
          background: rgba(16, 21, 29, 0.96);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 14px 16px;
          box-shadow: 0 16px 30px rgba(0, 0, 0, 0.32);
          backdrop-filter: blur(10px);
        }
        .floating-support-card h3 {
          margin: 0;
          font-size: 15px;
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .floating-support-card p {
          margin: 8px 0 0;
          font-size: 13px;
          line-height: 1.45;
          color: var(--text);
        }
        .floating-support-card .support-meta {
          margin-top: 10px;
          font-size: 12px;
          color: var(--muted);
        }
        h1 {
          margin: 0 0 6px;
          font-size: 30px;
        }
        .meta {
          color: var(--muted);
          margin-bottom: 22px;
        }
        .card {
          background: rgba(16, 21, 29, 0.96);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 18px;
          margin-bottom: 18px;
          overflow: hidden;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 14px;
        }
        .card-header h2 {
          margin: 0;
          font-size: 22px;
        }
        .card-header p {
          margin: 4px 0 0;
          color: var(--muted);
        }
        .table-wrap { overflow-x: auto; }
        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 900px;
        }
        th, td {
          border-top: 1px solid rgba(36, 48, 63, 0.8);
          padding: 12px 10px;
          text-align: left;
          vertical-align: top;
          font-size: 14px;
        }
        th {
          color: var(--muted);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .track-cell { min-width: 170px; }
        .track-entry { margin-bottom: 6px; line-height: 1.35; }
        .track-entry strong { color: var(--accent); }
        .muted { color: var(--muted); }
      </style>
    </head>
    <body>
      <aside class="floating-support-card" aria-label="Hotel Support">
        <h3>Hotel Support</h3>
        <p>Need help with stay or check-in details? Contact the support desk for assistance.</p>
        <div class="support-meta">Available during event hours</div>
      </aside>
      <div class="wrap">
        <h1>TKO Leaderboard</h1>
        <div class="meta">${title}</div>
        <div class="meta">Generated: ${generatedAt}</div>
        ${sections}
      </div>
    </body>
  </html>`;
};

const readJsonBody = req =>
  new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', chunk => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 10 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!chunks.length) {
        resolve(null);
        return;
      }

      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });

const handler = async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && pathname === '/health') {
    sendJson(res, 200, { ok: true, service: 'tko-leaderboard', timestamp: new Date().toISOString() });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/leaderboard') {
    const snapshot = await readSnapshot();
    sendJson(res, 200, { ok: true, snapshot });
    return;
  }

  if (req.method === 'GET' && pathname === '/leaderboard') {
    const snapshot = await readSnapshot();
    sendHtml(res, 200, renderLeaderboardHtml(snapshot));
    return;
  }

  if (req.method === 'GET' && pathname === '/') {
    const snapshot = await readSnapshot();
    sendHtml(res, 200, renderLeaderboardHtml(snapshot));
    return;
  }

  if (
    req.method === 'POST' &&
    (pathname === '/leaderboard' || pathname === '/api/leaderboard' || pathname === '/api/leaderboard-sync')
  ) {
    try {
      const body = await readJsonBody(req);
      if (!body || typeof body !== 'object') {
        sendJson(res, 400, { ok: false, error: 'Request body must be a JSON object.' });
        return;
      }

      const snapshot = {
        ...body,
        receivedAt: new Date().toISOString(),
      };

      await writeSnapshot(snapshot);

      sendJson(res, 200, {
        ok: true,
        saved: true,
        endpoint: pathname,
        snapshot,
      });
      return;
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message || 'Unable to save leaderboard snapshot.' });
      return;
    }
  }

  sendJson(res, 404, { ok: false, error: 'Route not found' });
};

const server = http.createServer((req, res) => {
  handler(req, res).catch(error => {
    console.error('Leaderboard server error:', error);
    sendJson(res, 500, { ok: false, error: 'Internal server error' });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`TKO leaderboard server running at http://${HOST}:${PORT}`);
  console.log(`Leaderboard page: http://${HOST}:${PORT}/leaderboard`);
});
