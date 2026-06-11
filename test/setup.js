const initSqlJs = require('sql.js');
const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = 'pixel-office-secret-change-me';
const VALID_API_KEY = 's3cr3t_t4sk_k3y_2026';
const ADMIN_USERNAME = 'dicoge';
const ADMIN_PASSWORD_HASH = '$2a$12$3sLjJGsUF.0aE.h5gI2tbeQYZSpe0bCrQyEHoxcP1kfb3FlU/M9ee';

function parseCommand(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  const assignMatch = trimmed.match(/^[派指派]?\s*(.+?)\s*(?:去|去做|去修|去執行|去處理|去完成)\s*(.+)/);
  if (assignMatch) {
    return { type: 'assign', worker: assignMatch[1].trim(), task: assignMatch[2].trim() };
  }
  const createTaskMatch = trimmed.match(/^(?:開新任務|新建任務|建立任務|建立新任務)\s*(.+)/i);
  if (createTaskMatch) {
    return { type: 'create_task', title: createTaskMatch[1].trim() };
  }
  const queryMatch = trimmed.match(/^(?:查看|查詢|看看|看一下)\s*(.+)/i);
  if (queryMatch) {
    return { type: 'query', target: queryMatch[1].trim() };
  }
  if (/^(?:狀態|系統狀態|看一下狀態|查狀態)$/.test(trimmed)) {
    return { type: 'stats' };
  }
  if (/^(?:worker列表|員工列表|workers?|workers\s+list)$/i.test(trimmed)) {
    return { type: 'list_workers' };
  }
  if (/^(?:任務列表|所有任務|tasks?|tasks\s+list)$/i.test(trimmed)) {
    return { type: 'list_tasks' };
  }
  return null;
}

async function createApp() {
  const wasmPath = path.join(__dirname, '..', 'public', 'sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const sqlDb = new SQL.Database();

  const db = {
    exec(sql) { sqlDb.run(sql); },
    prepare(sql) {
      return {
        run(...params) { sqlDb.run(sql, params); },
        get(...params) {
          const stmt = sqlDb.prepare(sql);
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
        },
        all(...params) {
          const stmt = sqlDb.prepare(sql);
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
        }
      };
    }
  };

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user', created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, emoji TEXT NOT NULL, description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, department_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
      status TEXT DEFAULT 'pending', priority TEXT DEFAULT 'normal', assigned_to TEXT,
      created_by TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT, FOREIGN KEY (department_id) REFERENCES departments(id)
    );
    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT DEFAULT 'idle', department_id TEXT,
      machine_id TEXT, last_ping TEXT DEFAULT (datetime('now')), created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT,
      user_id TEXT, details TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  try { db.exec("ALTER TABLE workers ADD COLUMN company_id TEXT DEFAULT 'company-a'"); } catch (e) {}
  try { db.exec("ALTER TABLE departments ADD COLUMN company_id TEXT DEFAULT 'company-a'"); } catch (e) {}
  try { db.exec("ALTER TABLE tasks ADD COLUMN company_id TEXT DEFAULT 'company-a'"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN company_ids TEXT DEFAULT 'company-a'"); } catch (e) {}
  try { db.exec("ALTER TABLE workers ADD COLUMN machine_id TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE workers ADD COLUMN mood TEXT DEFAULT NULL"); } catch (e) {}
  try { db.exec("ALTER TABLE workers ADD COLUMN avatar TEXT DEFAULT NULL"); } catch (e) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, emoji TEXT DEFAULT ':briefcase:',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL, sender_id TEXT,
      sender_type TEXT DEFAULT 'user', sender_name TEXT, content TEXT NOT NULL,
      room_type TEXT, room_id TEXT, created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY, department_id TEXT NOT NULL, action TEXT NOT NULL, description TEXT,
      user_id TEXT, user_name TEXT, entity_type TEXT, entity_id TEXT, metadata TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )
  `);

  const companyStmt = db.prepare('INSERT OR IGNORE INTO companies (id, name, emoji) VALUES (?, ?, ?)');
  companyStmt.run('company-a', 'MiniPc', '🖥️');
  companyStmt.run('company-b', 'MacBook', '💻');

  const deptStmt = db.prepare('INSERT OR IGNORE INTO departments (id, name, emoji, description, company_id) VALUES (?, ?, ?, ?, ?)');
  deptStmt.run('dept-dungeon', 'DungeonD3', '🎮', '地城爬塔遊戲開發', 'company-a');
  deptStmt.run('dept-stock', '每日台股報告', '📊', '股票研究與每日報告', 'company-a');
  deptStmt.run('dept-pixeloffice', 'Pixel Office', '🎮', 'AI Agent 管理系統維護', 'company-a');

  const workerStmt = db.prepare('INSERT OR IGNORE INTO workers (id, name, status, department_id, company_id, machine_id, mood) VALUES (?, ?, ?, ?, ?, ?, ?)');
  workerStmt.run('worker-1', 'Hermes', 'idle', 'dept-pixeloffice', 'company-a', 'MiniPc', '協調一切進行中');
  workerStmt.run('worker-2', 'OpenClaw', 'idle', 'dept-dungeon', 'company-a', 'MiniPc', '測試案例撰寫中');
  workerStmt.run('worker-3', 'Codex', 'idle', 'dept-stock', 'company-a', 'MiniPc', '架構規劃中');
  workerStmt.run('worker-4', 'Gemini', 'idle', null, 'company-a', 'MiniPc', '搜尋相關資料');
  workerStmt.run('worker-5', 'Manus', 'idle', null, 'company-a', 'MiniPc', '設計 UI 流程');
  workerStmt.run('worker-6', 'Claude Code', 'idle', null, 'company-a', 'MiniPc', '程式碼撰寫中');
  workerStmt.run('worker-7', 'OpenCode', 'idle', null, 'company-a', 'MiniPc', '優化現有功能');
  workerStmt.run('worker-b1', 'Hermes', 'idle', null, 'company-b', 'MacBook', '編輯設定中...');
  workerStmt.run('worker-b2', 'OpenClaw', 'idle', null, 'company-b', 'MacBook', '測試 MacBook 環境');
  workerStmt.run('worker-b3', 'Codex', 'idle', null, 'company-b', 'MacBook', '架構轉移評估');
  workerStmt.run('worker-b4', 'Gemini', 'idle', null, 'company-b', 'MacBook', '資料比對中');
  workerStmt.run('worker-b5', 'Manus', 'idle', null, 'company-b', 'MacBook', 'UI 適配調整');
  workerStmt.run('worker-b6', 'Claude Code', 'idle', null, 'company-b', 'MacBook', 'Mac 端開發');
  workerStmt.run('worker-b7', 'OpenCode', 'idle', null, 'company-b', 'MacBook', '效能優化中');

  function generateToken(user) {
    return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  }

  function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    const token = authHeader.slice(7);
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  function getCompanyId(req) {
    return req.headers['x-company-id'] || req.query.company_id || 'company-a';
  }

  function logAudit(action, entityType, entityId, userId, details) {
    const stmt = db.prepare('INSERT INTO audit_logs (id, action, entity_type, entity_id, user_id, details) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(uuidv4(), action, entityType, entityId, userId, JSON.stringify(details));
  }

  function logActivity(departmentId, action, description, userId, userName, entityType, entityId, metadata) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO activity_logs (id, department_id, action, description, user_id, user_name, entity_type, entity_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, departmentId, action, description || '', userId || 'system', userName || 'system', entityType || '', entityId || '', metadata ? JSON.stringify(metadata) : null);
  }

  function broadcast(data) {}

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post('/auth/register', async (req, res) => {
    try {
      if (ADMIN_USERNAME) {
        return res.status(403).json({ error: 'Public registration is disabled. Contact administrator.' });
      }
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }
      if (username.length < 3 || password.length < 6) {
        return res.status(400).json({ error: 'Username must be 3+ chars, password 6+ chars' });
      }
      const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (existing) {
        return res.status(409).json({ error: 'Username already exists' });
      }
      const password_hash = await bcrypt.hash(password, 12);
      const id = uuidv4();
      db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(id, username, password_hash);
      const user = { id, username, role: 'user' };
      const token = generateToken(user);
      res.status(201).json({ token, user: { id, username, role: user.role } });
    } catch (err) {
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  app.post('/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }
      let user;
      if (ADMIN_USERNAME && username === ADMIN_USERNAME && ADMIN_PASSWORD_HASH) {
        const valid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
        if (valid) {
          user = { id: 'admin', username: ADMIN_USERNAME, role: 'admin', company_ids: 'company-a,company-b' };
          const token = generateToken(user);
          return res.json({ token, user: { id: user.id, username, role: user.role, company_ids: user.company_ids } });
        }
      }
      user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const token = generateToken(user);
      res.json({ token, user: { id: user.id, username, role: user.role } });
    } catch (err) {
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.post('/api/workers/register', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== VALID_API_KEY) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    const { name, department_id, machine_id } = req.body;
    const company_id = getCompanyId(req);
    if (!name) {
      return res.status(400).json({ error: 'Worker name is required' });
    }
    const id = uuidv4();
    const finalMachineId = machine_id || `machine-${id.slice(0, 8)}`;
    db.prepare(`
      INSERT INTO workers (id, name, department_id, machine_id, status, company_id, last_ping)
      VALUES (?, ?, ?, ?, 'active', ?, datetime('now'))
    `).run(id, name, department_id || null, finalMachineId, company_id);
    const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(id);
    res.status(201).json(worker);
  });

  app.post('/api/workers/ping/:id', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== VALID_API_KEY) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    const { status, mood } = req.body;
    const validStatuses = ['active', 'idle', 'busy', 'slacking', 'working'];
    const newStatus = validStatuses.includes(status) ? status : 'active';
    const existing = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    if (mood !== undefined) {
      db.prepare("UPDATE workers SET status = ?, mood = ?, last_ping = datetime('now') WHERE id = ?").run(newStatus, mood, req.params.id);
    } else {
      db.prepare("UPDATE workers SET status = ?, last_ping = datetime('now') WHERE id = ?").run(newStatus, req.params.id);
    }
    const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
    res.json(worker);
  });

  app.post('/api/workers/:id/state', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== VALID_API_KEY) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    const { status, mood } = req.body;
    const validStatuses = ['active', 'idle', 'busy', 'slacking', 'working'];
    const newStatus = validStatuses.includes(status) ? status : 'idle';
    const existing = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    if (mood !== undefined) {
      db.prepare("UPDATE workers SET status = ?, mood = ?, last_ping = datetime('now') WHERE id = ?").run(newStatus, mood, req.params.id);
    } else {
      db.prepare("UPDATE workers SET status = ?, last_ping = datetime('now') WHERE id = ?").run(newStatus, req.params.id);
    }
    const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
    res.json(worker);
  });

  app.post('/api/workers/batch-status', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== VALID_API_KEY) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'updates array is required and must not be empty' });
    }
    const validStatuses = ['active', 'idle', 'busy', 'slacking', 'working'];
    const updatedWorkers = [];
    updates.forEach(u => {
      const { id, status, mood } = u;
      if (!id) return;
      const existing = db.prepare('SELECT * FROM workers WHERE id = ?').get(id);
      if (!existing) return;
      const newStatus = validStatuses.includes(status) ? status : existing.status;
      if (mood !== undefined) {
        db.prepare("UPDATE workers SET status = ?, mood = ?, last_ping = datetime('now') WHERE id = ?").run(newStatus, mood, id);
      } else {
        db.prepare("UPDATE workers SET status = ?, last_ping = datetime('now') WHERE id = ?").run(newStatus, id);
      }
      const worker = db.prepare('SELECT id, name, status, mood FROM workers WHERE id = ?').get(id);
      updatedWorkers.push(worker);
    });
    res.json({ success: true, updated: updatedWorkers.length, workers: updatedWorkers });
  });

  app.get('/api/workers/status', (req, res) => {
    const company_id = getCompanyId(req);
    const workers = db.prepare(`
      SELECT w.*, d.name as department_name, d.emoji as department_emoji
      FROM workers w
      LEFT JOIN departments d ON w.department_id = d.id
      WHERE w.company_id = ?
      ORDER BY w.machine_id, w.name
    `).all(company_id);
    res.json(workers);
  });

  app.post('/api/workers/:id/avatar', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== VALID_API_KEY) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    const { avatar } = req.body;
    if (!avatar || typeof avatar !== 'string') {
      return res.status(400).json({ error: 'Missing avatar field (base64 PNG string)' });
    }
    if (!avatar.startsWith('iVBOR') && !avatar.startsWith('/9j/')) {
      return res.status(400).json({ error: 'Avatar must be base64 PNG (starts with iVBOR) or JPEG' });
    }
    const existing = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    db.prepare('UPDATE workers SET avatar = ? WHERE id = ?').run(avatar, req.params.id);
    const worker = db.prepare('SELECT id, name, avatar FROM workers WHERE id = ?').get(req.params.id);
    res.json({ success: true, id: worker.id, name: worker.name, avatarLength: avatar.length });
  });

  app.get('/api/workers/:id/avatar', (req, res) => {
    const worker = db.prepare('SELECT id, name, avatar FROM workers WHERE id = ?').get(req.params.id);
    if (!worker || !worker.avatar) {
      return res.status(404).json({ error: 'Avatar not found' });
    }
    const imgBuffer = Buffer.from(worker.avatar, 'base64');
    const mime = worker.avatar.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': imgBuffer.length,
      'Cache-Control': 'public, max-age=3600'
    });
    res.end(imgBuffer);
  });

  app.use('/api/', authMiddleware);

  app.get('/api/departments', (req, res) => {
    const depts = db.prepare('SELECT * FROM departments ORDER BY created_at').all();
    const tasks = db.prepare('SELECT department_id, status, COUNT(*) as count FROM tasks GROUP BY department_id, status').all();
    const deptTasks = {};
    tasks.forEach(t => {
      if (!deptTasks[t.department_id]) deptTasks[t.department_id] = {};
      deptTasks[t.department_id][t.status] = t.count;
    });
    res.json(depts.map(d => ({ ...d, task_counts: deptTasks[d.id] || {} })));
  });

  app.post('/api/departments', (req, res) => {
    const { name, emoji, description } = req.body;
    if (!name || !emoji) {
      return res.status(400).json({ error: 'name and emoji are required' });
    }
    const id = 'dept-' + uuidv4().slice(0, 8);
    db.prepare(`INSERT INTO departments (id, name, emoji, description, company_id) VALUES (?, ?, ?, ?, 'company-a')`).run(id, name, emoji, description || '');
    const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
    res.status(201).json(dept);
  });

  app.patch('/api/departments/:id', (req, res) => {
    const company_id = getCompanyId(req);
    const { name, emoji } = req.body;
    const existing = db.prepare('SELECT * FROM departments WHERE id = ? AND company_id = ?').get(req.params.id, company_id);
    if (!existing) return res.status(404).json({ error: 'Department not found' });
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (emoji !== undefined) { updates.push('emoji = ?'); params.push(emoji); }
    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });
    params.push(req.params.id);
    db.prepare(`UPDATE departments SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
    res.json(dept);
  });

  app.delete('/api/departments/:id', (req, res) => {
    const company_id = getCompanyId(req);
    const existing = db.prepare('SELECT * FROM departments WHERE id = ? AND company_id = ?').get(req.params.id, company_id);
    if (!existing) return res.status(404).json({ error: 'Department not found' });
    db.prepare('DELETE FROM activity_logs WHERE department_id = ?').run(req.params.id);
    db.prepare('DELETE FROM tasks WHERE department_id = ?').run(req.params.id);
    db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.get('/api/tasks', (req, res) => {
    const company_id = getCompanyId(req);
    const { department_id, status, priority } = req.query;
    let query = 'SELECT * FROM tasks WHERE company_id = ?';
    const params = [company_id];
    if (department_id) { query += ' AND department_id = ?'; params.push(department_id); }
    if (status) { query += ' AND status = ?'; params.push(status); }
    if (priority) { query += ' AND priority = ?'; params.push(priority); }
    query += ' ORDER BY created_at DESC';
    res.json(db.prepare(query).all(...params));
  });

  app.post('/api/tasks', (req, res) => {
    const company_id = getCompanyId(req);
    const { department_id, title, description, priority, assigned_to } = req.body;
    if (!department_id || !title) {
      return res.status(400).json({ error: 'department_id and title required' });
    }
    const id = uuidv4();
    db.prepare(`
      INSERT INTO tasks (id, department_id, title, description, priority, assigned_to, created_by, company_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, department_id, title, description || '', priority || 'normal', assigned_to || null, req.user.id, company_id);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    logActivity(department_id, 'task_created', `任務「${title}」已建立`, req.user.id, req.user.username, 'task', id, { priority, assigned_to });
    res.status(201).json(task);
  });

  app.get('/api/tasks/:id', (req, res) => {
    const company_id = getCompanyId(req);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND company_id = ?').get(req.params.id, company_id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  app.patch('/api/tasks/:id', (req, res) => {
    const company_id = getCompanyId(req);
    const { status, priority, assigned_to, title, description } = req.body;
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND company_id = ?').get(req.params.id, company_id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    const updates = [];
    const params = [];
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
    if (assigned_to !== undefined) { updates.push('assigned_to = ?'); params.push(assigned_to); }
    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    updates.push("updated_at = datetime('now')");
    if (status === 'completed') updates.push("completed_at = datetime('now')");
    params.push(req.params.id);
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json(task);
  });

  app.delete('/api/tasks/:id', (req, res) => {
    const company_id = getCompanyId(req);
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND company_id = ?').get(req.params.id, company_id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.get('/api/companies', (req, res) => {
    const companies = db.prepare('SELECT * FROM companies ORDER BY id').all();
    res.json({ companies });
  });

  app.get('/api/stats', (req, res) => {
    const company_id = getCompanyId(req);
    const taskStats = db.prepare('SELECT status, COUNT(*) as count FROM tasks WHERE company_id = ? GROUP BY status').all(company_id);
    const workerStats = db.prepare('SELECT status, COUNT(*) as count FROM workers WHERE company_id = ? GROUP BY status').all(company_id);
    const totalWorkers = db.prepare('SELECT COUNT(*) as count FROM workers WHERE company_id = ?').get(company_id);
    const recentTasks = db.prepare(`
      SELECT t.*, d.name as department_name, d.emoji as department_emoji
      FROM tasks t JOIN departments d ON t.department_id = d.id
      WHERE t.company_id = ? ORDER BY t.created_at DESC LIMIT 5
    `).all(company_id);
    const auditLogs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10').all();
    res.json({
      tasks: Object.fromEntries(taskStats.map(s => [s.status, s.count])),
      workers: Object.fromEntries(workerStats.map(s => [s.status, s.count])),
      total_workers: totalWorkers.count,
      recent_tasks: recentTasks,
      audit_logs: auditLogs
    });
  });

  app.get('/api/messages', (req, res) => {
    const company_id = getCompanyId(req);
    const { room_type, room_id } = req.query;
    if (!room_type || !room_id) return res.status(400).json({ error: 'room_type and room_id required' });
    const messages = db.prepare(`
      SELECT * FROM messages WHERE company_id = ? AND room_type = ? AND room_id = ?
      ORDER BY created_at ASC
    `).all(company_id, room_type, room_id);
    res.json(messages);
  });

  app.post('/api/messages', async (req, res) => {
    try {
      const company_id = getCompanyId(req);
      const { sender_id, sender_type, sender_name, content, room_type, room_id } = req.body;
      if (!content || !room_type || !room_id) return res.status(400).json({ error: 'content, room_type, room_id required' });
      const id = uuidv4();
      db.prepare(`
        INSERT INTO messages (id, company_id, sender_id, sender_type, sender_name, content, room_type, room_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, company_id, sender_id || 'dicoge', sender_type || 'user', sender_name || 'dicoge', content, room_type, room_id);
      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
      res.status(201).json(msg);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/hermes-reply', authMiddleware, (req, res) => {
    const company_id = getCompanyId(req);
    const { message_id, content, hermes_id } = req.body;
    if (!message_id || !content) {
      return res.status(400).json({ error: 'message_id and content are required' });
    }
    const originalMsg = db.prepare('SELECT * FROM messages WHERE id = ? AND company_id = ?').get(message_id, company_id);
    if (!originalMsg) {
      return res.status(404).json({ error: 'Original message not found' });
    }
    const replyId = 'bot-' + uuidv4().slice(0, 8);
    const senderName = hermes_id ? `🤖 ${hermes_id}` : '🤖 Hermes';
    db.prepare(`
      INSERT INTO messages (id, company_id, sender_id, sender_type, sender_name, content, room_type, room_id)
      VALUES (?, ?, ?, 'bot', ?, ?, ?, ?)
    `).run(replyId, company_id, 'hermes', senderName, content, originalMsg.room_type, originalMsg.room_id);
    const botMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(replyId);
    res.status(201).json(botMsg);
  });

  function getAuthToken() {
    return jwt.sign(
      { id: 'admin', username: ADMIN_USERNAME, role: 'admin', company_ids: 'company-a,company-b' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  function getCompanyHeader(companyId) {
    return { 'x-company-id': companyId };
  }

  return { app, db, VALID_API_KEY, getAuthToken, getCompanyHeader, parseCommand };
}

module.exports = createApp;
module.exports.parseCommand = parseCommand;
