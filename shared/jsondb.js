const fs = require('fs');
const path = require('path');

class JsonDB {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {};
    this.pool = null;
    this.pending = Promise.resolve();
  }

  async init() {
    if (process.env.DATABASE_URL) {
      const { Pool } = require('pg');
      this.pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
      await this.pool.query(`CREATE TABLE IF NOT EXISTS app_document (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await this.pool.query("INSERT INTO app_document (id) VALUES (1) ON CONFLICT (id) DO NOTHING");
      const result = await this.pool.query('SELECT data FROM app_document WHERE id = 1');
      this.data = result.rows[0]?.data || {};
    } else {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      this._load();
    }
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      }
    } catch { this.data = {}; }
  }

  _save() {
    if (this.pool) {
      const snapshot = JSON.stringify(this.data);
      this.pending = this.pending.catch(() => undefined).then(() => this.pool.query(
        'UPDATE app_document SET data = $1::jsonb, updated_at = NOW() WHERE id = 1',
        [snapshot]
      ));
      return;
    }
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  async flush() { await this.pending; }

  async health() {
    if (this.pool) await this.pool.query('SELECT 1');
    else await fs.promises.access(path.dirname(this.filePath), fs.constants.W_OK);
  }

  _ensureTable(table) {
    if (!this.data[table]) { this.data[table] = []; this.data[`${table}_seq`] = 0; }
  }

  insert(table, record) {
    this._ensureTable(table);
    this.data[`${table}_seq`]++;
    const id = this.data[`${table}_seq`];
    const entry = { id, ...record, created_at: record.created_at || new Date().toISOString() };
    this.data[table].push(entry);
    this._save();
    return { lastInsertRowid: id, changes: 1 };
  }

  findAll(table, filter = null) {
    this._ensureTable(table);
    if (!filter) return [...this.data[table]];
    return this.data[table].filter(filter);
  }

  findOne(table, filter) {
    this._ensureTable(table);
    return this.data[table].find(filter) || null;
  }

  update(table, filter, updates) {
    this._ensureTable(table);
    let changes = 0;
    this.data[table] = this.data[table].map(row => {
      if (filter(row)) { changes++; return { ...row, ...updates }; }
      return row;
    });
    this._save();
    return { changes };
  }

  delete(table, filter) {
    this._ensureTable(table);
    const before = this.data[table].length;
    this.data[table] = this.data[table].filter(row => !filter(row));
    this._save();
    return { changes: before - this.data[table].length };
  }

  count(table, filter = null) {
    return this.findAll(table, filter).length;
  }

  sum(table, field, filter = null) {
    return this.findAll(table, filter).reduce((s, r) => s + (r[field] || 0), 0);
  }

  avg(table, field, filter = null) {
    const items = this.findAll(table, filter);
    if (items.length === 0) return 0;
    return items.reduce((s, r) => s + (r[field] || 0), 0) / items.length;
  }
}

module.exports = JsonDB;
