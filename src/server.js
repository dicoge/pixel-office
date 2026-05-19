const express = requ$2a$12$slub8wYxmWSuYnmc7LOnH.hF7uOM4T1yPfFv56VlieJTAdaMam8Ja'express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('./db');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const path = require('path');
const fs = require('fs');

// ============ CONFIG ============
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'pixel-office-secret-change-me';
const JWT_EXPIRES_IN = '7d';
const BCRYPT_ROUNDS = 12;
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'tasks.db');
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX = 20;

// Task Queue API Key for worker registration
const TASK_QUEUE_API_KEY = process.env.TASK_QUEUE_API_KEY || 's3cr3t_t4sk_k3y_2026';

// Admin credentials (hardcoded - Railway env var override disabled to prevent hash corruption)
const ADMIN_USERNAME = 'dicoge';
const ADMIN_PASSWORD_HASH = '$2a$12$2F2UHCzUjNHyzOE1wsz7vuSLiS/aRj1.aijJI3nYp4KUXpmx9D3Pi';

// ============ INIT ============
const app = express();
const server = http.createServer(app);

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============ CORS ============
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true
};

// ============ DATABASE ============
const db = new Database(DB_PATH);

// Initialize schema
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      assigned_to TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'idle',
      department_id TEXT,
      machine_id TEXT,
      last_ping TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      user_id TEXT,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration: Add company_id columns if they don't exist (for existing databases)
  try {
    db.exec("ALTER TABLE workers ADD COLUMN company_id TEXT DEFAULT 'company-a'");
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec("ALTER TABLE departments ADD COLUMN company_id TEXT DEFAULT 'company-a'");
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec("ALTER TABLE tasks ADD COLUMN company_id TEXT DEFAULT 'company-a'");
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec("ALTER TABLE users ADD COLUMN company_ids TEXT DEFAULT 'company-a'");
  } catch (e) {
    // Column already exists, ignore
  }
  // Migration: Add machine_id column if it doesn't exist (for existing databases)
  try {
    db.exec("ALTER TABLE workers ADD COLUMN machine_id TEXT");
  } catch (e) {
    // Column already exists, ignore
  }

  // Companies table (for custom company names)
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT DEFAULT '🏢',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Seed companies if not exist
  const companyStmt = db.prepare('INSERT OR IGNORE INTO companies (id, name, emoji) VALUES (?, ?, ?)');
  companyStmt.run('company-a', 'MiniPc', '🖥️');
  companyStmt.run('company-b', 'MacBook', '💻');

  // Companies definition (kept for fallback/initialization)
  const COMPANIES = [
    { id: 'company-a', name: 'MiniPc', emoji: '🖥️' },
    { id: 'company-b', name: 'MacBook', emoji: '💻' }
  ];

  // Seed 3 departments (shared across all companies)
  const deptStmt = db.prepare('INSERT OR IGNORE INTO departments (id, name, emoji, description, company_id) VALUES (?, ?, ?, ?, ?)');
  const departments = [
    ['dept-dungeon', 'DungeonD3', '🎮', '地城爬塔遊戲開發', 'company-a'],
    ['dept-stock', '每日台股報告', '📊', '股票研究與每日報告', 'company-a'],
    ['dept-pixeloffice', 'Pixel Office', '🎮', 'AI Agent 管理系統維護', 'company-a']
  ];
  departments.forEach(d => deptStmt.run(...d));

  // Seed 7 workers (shared across all companies)
  const workerStmt = db.prepare('INSERT OR IGNORE INTO workers (id, name, status, department_id, company_id, machine_id) VALUES (?, ?, ?, ?, ?, ?)');
  // 7 workers for both companies
  workerStmt.run('worker-1', 'OpenClaw', 'active', 'dept-dungeon', 'company-a', 'MiniPc');
  workerStmt.run('worker-2', 'Codex', 'idle', 'dept-stock', 'company-a', 'MiniPc');
  workerStmt.run('worker-3', 'OpenCode', 'idle', 'dept-pixeloffice', 'company-a', 'MiniPc');
  workerStmt.run('worker-4', 'DungeonBot', 'idle', null, 'company-a', 'MiniPc');
  workerStmt.run('worker-5', 'PixelCoder', 'idle', null, 'company-a', 'MiniPc');
  workerStmt.run('worker-6', 'ServerBot', 'idle', null, 'company-a', 'MiniPc');
  workerStmt.run('worker-7', 'AgentSmith', 'idle', null, 'company-a', 'MiniPc');

  // Messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      sender_id TEXT,
      sender_type TEXT DEFAULT 'user',
      sender_name TEXT,
      content TEXT NOT NULL,
      room_type TEXT,
      room_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

// ============ MIDDLEWARE ============
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ============ WEBSOCKET ============
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

// ============ AUTH HELPERS ============
function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
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

// ============ AUDIT LOG ============
function logAudit(action, entityType, entityId, userId, details) {
  const stmt = db.prepare('INSERT INTO audit_logs (id, action, entity_type, entity_id, user_id, details) VALUES (?, ?, ?, ?, ?, ?)');
  stmt.run(uuidv4(), action, entityType, entityId, userId, JSON.stringify(details));
}

// ============ COMPANY HELPER ============
function getCompanyId(req) {
  return req.headers['x-company-id'] || req.query.company_id || 'company-a';
}

// ============ AUTH ROUTES (PUBLIC) ============
app.post('/auth/register', async (req, res) => {
  try {
    // If admin account is configured, disable public registration
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

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const id = uuidv4();
    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(id, username, password_hash);

    const user = { id, username, role: 'user' };
    const token = generateToken(user);
    logAudit('register', 'user', id, id, { username });
    
    broadcast({ type: 'user_registered', user: { id, username } });
    res.status(201).json({ token, user: { id, username, role: user.role } });
  } catch (err) {
    console.error('Register error:', err);
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

    // Check if this is the admin login
    if (ADMIN_USERNAME && username === ADMIN_USERNAME && ADMIN_PASSWORD_HASH) {
      const valid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
      if (valid) {
        user = { id: 'admin', username: ADMIN_USERNAME, role: 'admin', company_ids: 'company-a,company-b' };
        const token = generateToken(user);
        logAudit('login', 'user', 'admin', 'admin', { username, type: 'admin' });
        broadcast({ type: 'user_login', user: { id: user.id, username } });
        return res.json({ token, user: { id: user.id, username, role: user.role, company_ids: user.company_ids } });
      }
    }

    // Normal database authentication
    user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    logAudit('login', 'user', user.id, user.id, { username });
    broadcast({ type: 'user_login', user: { id: user.id, username } });
    res.json({ token, user: { id: user.id, username, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============ WORKER REGISTRATION API (API Key Auth) ============
app.post('/api/workers/register', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== TASK_QUEUE_API_KEY) {
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
  logAudit('register', 'worker', id, null, { name, machine_id: finalMachineId, company_id });
  broadcast({ type: 'worker_registered', worker });

  res.status(201).json(worker);
});

app.post('/api/workers/ping/:id', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== TASK_QUEUE_API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const { status } = req.body;
  const company_id = getCompanyId(req);
  const validStatuses = ['active', 'idle', 'busy'];
  const newStatus = validStatuses.includes(status) ? status : 'active';

  const existing = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  db.prepare(`
    UPDATE workers SET status = ?, last_ping = datetime('now') WHERE id = ?
  `).run(newStatus, req.params.id);

  const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
  broadcast({ type: 'worker_ping', worker });

  res.json(worker);
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

// ============ API ROUTES (PROTECTED) ============
app.use('/api/', authMiddleware);

// Departments
app.get('/api/departments', (req, res) => {
  const company_id = getCompanyId(req);
  const depts = db.prepare('SELECT * FROM departments ORDER BY created_at').all();
  const tasks = db.prepare('SELECT department_id, status, COUNT(*) as count FROM tasks GROUP BY department_id, status').all();
  const deptTasks = {};
  tasks.forEach(t => {
    if (!deptTasks[t.department_id]) deptTasks[t.department_id] = {};
    deptTasks[t.department_id][t.status] = t.count;
  });
  res.json(depts.map(d => ({
    ...d,
    task_counts: deptTasks[d.id] || {}
  })));
});

// POST /api/departments - Create new department
app.post('/api/departments', (req, res) => {
  const { name, emoji, description } = req.body;
  if (!name || !emoji) {
    return res.status(400).json({ error: 'name and emoji are required' });
  }
  const id = 'dept-' + uuidv4().slice(0, 8);
  db.prepare(`INSERT INTO departments (id, name, emoji, description, company_id) VALUES (?, ?, ?, ?, 'company-a')`)
    .run(id, name, emoji, description || '');
  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
  broadcast({ type: 'department_updated', department: dept });
  res.status(201).json(dept);
});

// PATCH Department (editable names)
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
  broadcast({ type: 'department_updated', department: dept });
  res.json(dept);
});

// Tasks
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
  const { department_id, title, description, priority } = req.body;
  if (!department_id || !title) {
    return res.status(400).json({ error: 'department_id and title required' });
  }
  const id = uuidv4();
  db.prepare(`
    INSERT INTO tasks (id, department_id, title, description, priority, created_by, company_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, department_id, title, description || '', priority || 'normal', req.user.id, company_id);
  
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  logAudit('create', 'task', id, req.user.id, { title, department_id, company_id });
  broadcast({ type: 'task_created', task });
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
  logAudit('update', 'task', task.id, req.user.id, { changes: req.body });
  broadcast({ type: 'task_updated', task });
  res.json(task);
});

// Workers
app.get('/api/workers', (req, res) => {
  const company_id = getCompanyId(req);
  const workers = db.prepare('SELECT * FROM workers WHERE company_id = ? ORDER BY name').all(company_id);
  res.json(workers);
});

// Companies
app.get('/api/companies', (req, res) => {
  // Read companies from database
  const companies = db.prepare('SELECT * FROM companies ORDER BY id').all();
  res.json({ companies });
});

// Stats
app.get('/api/stats', (req, res) => {
  const company_id = getCompanyId(req);
  const taskStats = db.prepare(`
    SELECT status, COUNT(*) as count FROM tasks WHERE company_id = ? GROUP BY status
  `).all(company_id);
  const workerStats = db.prepare(`
    SELECT status, COUNT(*) as count FROM workers WHERE company_id = ? GROUP BY status
  `).all(company_id);
  const totalWorkers = db.prepare('SELECT COUNT(*) as count FROM workers WHERE company_id = ?').get(company_id);
  const recentTasks = db.prepare(`
    SELECT t.*, d.name as department_name, d.emoji as department_emoji
    FROM tasks t
    JOIN departments d ON t.department_id = d.id
    WHERE t.company_id = ?
    ORDER BY t.created_at DESC LIMIT 5
  `).all(company_id);
  const auditLogs = db.prepare(`
    SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10
  `).all();

  res.json({
    tasks: Object.fromEntries(taskStats.map(s => [s.status, s.count])),
    workers: Object.fromEntries(workerStats.map(s => [s.status, s.count])),
    total_workers: totalWorkers.count,
    recent_tasks: recentTasks,
    audit_logs: auditLogs
  });
});

// Webhook (optional)
app.post('/api/webhook/test', (req, res) => {
  const { url, type } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  // Placeholder - implement webhook sending
  res.json({ message: 'Webhook test sent (mock)', url, type });
});

// GET messages (chat history)
app.get('/api/messages', (req, res) => {
  const company_id = getCompanyId(req);
  const { room_type, room_id } = req.query;
  if (!room_type || !room_id) return res.status(400).json({ error: 'room_type and room_id required' });

  const messages = db.prepare(`
    SELECT * FROM messages
    WHERE company_id = ? AND room_type = ? AND room_id = ?
    ORDER BY created_at ASC
  `).all(company_id, room_type, room_id);
  res.json(messages);
});

// POST message (send chat)
app.post('/api/messages', (req, res) => {
  const company_id = getCompanyId(req);
  const { sender_id, sender_type, sender_name, content, room_type, room_id } = req.body;
  if (!content || !room_type || !room_id) return res.status(400).json({ error: 'content, room_type, room_id required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO messages (id, company_id, sender_id, sender_type, sender_name, content, room_type, room_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, company_id, sender_id || 'dicoge', sender_type || 'user', sender_name || 'dicoge', content, room_type, room_id);

  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  broadcast({ type: 'message_sent', message: msg });
  res.status(201).json(msg);
});

// ============ SERVE FRONTEND ============
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ============ START ============
async function start() {
  try {
    await db.init();
    initDatabase();
    server.listen(PORT, () => {
      console.log(`🎮 Pixel Office running on port ${PORT}`);
      console.log(`📁 Database: ${DB_PATH}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();