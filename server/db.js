const path = require('path');
const fs = require('fs');

const isPkg = typeof process.pkg !== 'undefined';
const baseDir = isPkg ? path.dirname(process.execPath) : path.join(__dirname, '..');
const dataDir = path.join(baseDir, 'data');
const dataFile = path.join(dataDir, 'entries.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, JSON.stringify({ entries: [], nextId: 1 }, null, 2));

function readStore() {
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function writeStore(store) {
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
}

function findByToken(token) {
  if (!token) return null;
  return readStore().entries.find((e) => e.token === token) || null;
}

function findByEmail(email) {
  return readStore().entries.find((e) => e.email === email) || null;
}

function findByIp(ip) {
  return readStore().entries.find((e) => e.ip === ip) || null;
}

function insert({ token, email, country, ip }) {
  const store = readStore();
  const entry = {
    id: store.nextId,
    token,
    email,
    country,
    ip,
    prize: null,
    created_at: new Date().toISOString(),
    spun_at: null,
  };
  store.entries.push(entry);
  store.nextId += 1;
  writeStore(store);
  return entry;
}

function markSpun(id, prize) {
  const store = readStore();
  const entry = store.entries.find((e) => e.id === id);
  if (!entry) return null;
  entry.spun_at = new Date().toISOString();
  entry.prize = prize;
  writeStore(store);
  return entry;
}

function resetAll() {
  writeStore({ entries: [], nextId: 1 });
}

module.exports = { findByToken, findByEmail, findByIp, insert, markSpun, resetAll };
