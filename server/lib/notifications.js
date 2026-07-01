const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'notifications.json');
let nextId = 1;

function load() {
  if (!fs.existsSync(FILE)) return [];
  try {
    const items = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    nextId = items.reduce((m, n) => Math.max(m, n.id), 0) + 1;
    return items;
  } catch (e) { return []; }
}

function save(items) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(items, null, 2));
}

function add({ tag, title, body }) {
  const items = load();
  const n = { id: nextId++, tag, title, body, time: new Date().toISOString(), unread: true };
  items.unshift(n);
  save(items.slice(0, 200));
  return n;
}

function list() { return load(); }

function markRead(id) {
  const items = load();
  const n = items.find(x => x.id === Number(id));
  if (n) n.unread = false;
  save(items);
  return n;
}

module.exports = { add, list, markRead };
