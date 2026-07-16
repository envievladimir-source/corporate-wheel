const crypto = require('crypto');

// Мінімальна інтеграція з Google Sheets API через service account —
// без важких залежностей (googleapis/google-auth-library), лише вбудовані
// crypto (підпис JWT) та fetch (є в Node 18+).

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlFromBuffer(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let cachedToken = null; // { token, expiresAt }

async function getAccessToken(clientEmail, privateKey) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30000) {
    return cachedToken.token;
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const unsigned = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(claim));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = base64urlFromBuffer(signer.sign(privateKey));
  const jwt = unsigned + '.' + signature;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error('Google auth failed: ' + JSON.stringify(data));
  }

  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

// Захист від CSV/formula injection, якщо хтось відкриє таблицю в редакторі,
// де значення, що починається з =, +, -, @ могло б бути сприйняте як формула.
function sanitizeCell(value) {
  const str = String(value);
  return /^[=+\-@]/.test(str) ? "'" + str : str;
}

async function appendRow({ spreadsheetId, range, clientEmail, privateKey, values }) {
  const token = await getAccessToken(clientEmail, privateKey);
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
    `/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values.map(sanitizeCell)] }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error('Sheets append failed: ' + text);
  }

  return res.json();
}

module.exports = { appendRow };
