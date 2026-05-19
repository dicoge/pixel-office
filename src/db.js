const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// sql.js wrapper to mimic better-sqlite3 API
class Database {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this._ready = false;
  }

  // Initialize DB (load from file or create new)
  async init() {
    const wasmPath = path.join(__dirname, '..', 'public', 'sql-wasm.wasm');
    const SQL = await initSqlJs({
      locateFile: () => wasmPath
    });

    // Load existing database if exists
    if (fs.existsSync(this.dbPath)) {
      try {
        const buffer = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(buffer);
      } catch (e) {
        console.warn('DB file corrupt, creating new:', e.message);
        this.db = new SQL.Database();
      }
    } else {
      this.db = new SQL.Database();
    }

    this._ready = true;
  }

  // Run a single SQL statement safely
  _runSql(sql, params = []) {
    try {
      this.db.run(sql, params);
      this._persist();
    } catch (e) {
      // Ignore errors (e.g., column already exists, table already exists)
      console.warn('SQL warning:', e.message);
    }
  }

  // Synchronous prepare - sql.js stmt wrapper
  prepare(sql) {
    const self = this;

    return {
      run(...params) {
        try {
          self.db.run(sql, params);
          self._persist();
          return { changes: self.db.getRowsModified() };
        } catch (e) {
          console.error('SQL run error:', e.message, 'SQL:', sql, 'params:', params);
          throw e;
        }
      },
      get(...params) {
        try {
          const stmt = self.db.prepare(sql);
          stmt.bind(params);
          const hasRow = stmt.step();
          let result = null;
          if (hasRow) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            result = {};
            cols.forEach((c, i) => result[c] = vals[i]);
          }
          stmt.free();
          return result;
        } catch (e) {
          console.error('SQL get error:', e.message, 'SQL:', sql, 'params:', params);
          throw e;
        }
      },
      all(...params) {
        try {
          const stmt = self.db.prepare(sql);
          stmt.bind(params);
          const results = [];
          const cols = stmt.getColumnNames();
          while (stmt.step()) {
            const vals = stmt.get();
            const row = {};
            cols.forEach((c, i) => row[c] = vals[i]);
            results.push(row);
          }
          stmt.free();
          return results;
        } catch (e) {
          console.error('SQL all error:', e.message, 'SQL:', sql, 'params:', params);
          throw e;
        }
      }
    };
  }

  exec(sql) {
    try {
      this.db.run(sql);
      this._persist();
    } catch (e) {
      console.warn('SQL exec warning:', e.message);
    }
  }

  // Persist DB to disk
  _persist() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  getRowsModified() {
    return this.db.getRowsModified();
  }
}

module.exports = Database;