const express = require('express');
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
const RATE_LIMIT_MAX = 300;

// Task Queue API Key for worker registration
const TASK_QUEUE_API_KEY=process.env.TASK_QUEUE_API_KEY || 's3cr3t_t4sk_k3y_2026';

// Hermes WebSocket Auth Token
const HERMES_AUTH_TOKEN=process.env.HERMES_AUTH_TOKEN || 'hermes-secret-token-2026';

// Admin credentials (hardcoded - Railway env var override disabled to prevent hash corruption)
const ADMIN_USERNAME = 'dicoge';
const ADMIN_PASSWORD_HASH = '$2a$12$2F2UHCzUjNHyzOE1wsz7vuSLiS/aRj1.aijJI3nYp4KUXpmx9D3Pi';

// ============ PROCESS-LEVEL ERROR HANDLING ============
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message, err.stack);
  // Give logger time to flush, then exit with non-zero code
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason instanceof Error ? reason.message : reason);
});

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
  // Migration: Add mood column for hourly mood messages
  try {
    db.exec("ALTER TABLE workers ADD COLUMN mood TEXT DEFAULT NULL");
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

  // Activity logs table (per-department activity tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL,
      action TEXT NOT NULL,
      description TEXT,
      user_id TEXT,
      user_name TEXT,
      entity_type TEXT,
      entity_id TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )
  `);

  // Seed initial activity logs for demo departments
  const activityStmt = db.prepare('INSERT OR IGNORE INTO activity_logs (id, department_id, action, description, user_name, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
  activityStmt.run(uuidv4(), 'dept-dungeon', 'created', '部門建立', 'system', 'department', 'dept-dungeon');
  activityStmt.run(uuidv4(), 'dept-dungeon', 'task_created', '任務「修補遊戲BUG」已建立', 'dicoge', 'task', null);
  activityStmt.run(uuidv4(), 'dept-dungeon', 'task_completed', '任務「測試戰鬥系統」已完成', 'dicoge', 'task', null);
  activityStmt.run(uuidv4(), 'dept-stock', 'created', '部門建立', 'system', 'department', 'dept-stock');
  activityStmt.run(uuidv4(), 'dept-stock', 'task_created', '任務「分析台積電走势」已建立', 'dicoge', 'task', null);
  activityStmt.run(uuidv4(), 'dept-pixeloffice', 'created', '部門建立', 'system', 'department', 'dept-pixeloffice');
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

// ============ NATURAL LANGUAGE COMMAND PARSER ============
/**
 * Parses natural language commands from chat messages.
 * Returns null if not a command, or an object with command type and parameters.
 */
function parseCommand(text) {
  if (!text || typeof text !== 'string') return null;
  
  const trimmed = text.trim();
  
  // Pattern 1: "派 XXX 去 YYY" → assign task to worker
  // Matches: 派 OpenClaw 去修bug, 派Codex去做報告, 派 DungeonBot 去執行任務
  const assignMatch = trimmed.match(/^[派指派]?\s*(.+?)\s*(?:去|去做|去修|去執行|去處理|去完成)\s*(.+)/);
  if (assignMatch) {
    return {
      type: 'assign',
      worker: assignMatch[1].trim(),
      task: assignMatch[2].trim()
    };
  }
  
  // Pattern 2: "開新任務 XXX" or "新建任務 XXX" → create task
  const createTaskMatch = trimmed.match(/^(?:開新任務|新建任務|建立任務|建立新任務)\s*(.+)/i);
  if (createTaskMatch) {
    return {
      type: 'create_task',
      title: createTaskMatch[1].trim()
    };
  }
  
  // Pattern 3: "查看 XXX" or "查詢 XXX" → query status
  const queryMatch = trimmed.match(/^(?:查看|查詢|看看|看一下)\s*(.+)/i);
  if (queryMatch) {
    return {
      type: 'query',
      target: queryMatch[1].trim()
    };
  }
  
  // Pattern 4: "狀態" or "系統狀態" → overall stats
  if (/^(?:狀態|系統狀態|看一下狀態|查狀態)$/.test(trimmed)) {
    return {
      type: 'stats'
    };
  }
  
  // Pattern 5: "worker列表" or "員工列表" → list workers
  if (/^(?:worker列表|員工列表|workers?|workers\s+list)$/i.test(trimmed)) {
    return {
      type: 'list_workers'
    };
  }
  
  // Pattern 6: "任務列表" or "所有任務" → list tasks
  if (/^(?:任務列表|所有任務|tasks?|tasks\s+list)$/i.test(trimmed)) {
    return {
      type: 'list_tasks'
    };
  }
  
  return null;
}

/**
 * Executes a parsed command and returns a response message.
 */
async function executeCommand(command, companyId, db) {
  switch (command.type) {
    case 'assign': {
      // Find worker by name
      const worker = db.prepare(`
        SELECT w.*, d.name as department_name, d.emoji as department_emoji
        FROM workers w
        LEFT JOIN departments d ON w.department_id = d.id
        WHERE w.company_id = ? AND w.name LIKE ?
        LIMIT 1
      `).get(companyId, `%${command.worker}%`);
      
      if (!worker) {
        // List available workers
        const workers = db.prepare('SELECT name FROM workers WHERE company_id = ?').all(companyId);
        const workerNames = workers.map(w => w.name).join(', ');
        return `❌ 找不到 worker "${command.worker}"，可用 worker: ${workerNames || '無'}`;
      }
      
      // Determine department - use worker's current department or default to first
      const department = worker.department_id || 
        db.prepare('SELECT id FROM departments WHERE company_id = ? LIMIT 1').get(companyId)?.id;
      
      if (!department) {
        return '❌ 沒有可用的部門，請先建立部門';
      }
      
      // Create task and assign to worker
      const taskId = require('uuid').v4();
      db.prepare(`
        INSERT INTO tasks (id, department_id, title, status, assigned_to, created_by, company_id)
        VALUES (?, ?, ?, 'pending', ?, ?, ?)
      `).run(taskId, department, command.task, worker.id, 'system', companyId);
      
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      
      // Update worker status to busy
      db.prepare("UPDATE workers SET status = 'busy' WHERE id = ?").run(worker.id);
      
      return `✅ 已指派任務給 ${worker.name}${worker.department_name ? ` (${worker.department_emoji} ${worker.department_name})` : ''}:\n📋 ${command.task}\n🔖 任務ID: ${taskId.slice(0, 8)}`;
    }
    
    case 'create_task': {
      // Use first department as default
      const department = db.prepare('SELECT id, name, emoji FROM departments WHERE company_id = ? LIMIT 1').get(companyId);
      
      if (!department) {
        return '❌ 沒有可用的部門，請先建立部門';
      }
      
      const taskId = require('uuid').v4();
      db.prepare(`
        INSERT INTO tasks (id, department_id, title, status, created_by, company_id)
        VALUES (?, ?, ?, 'pending', ?, ?)
      `).run(taskId, department.id, command.title, 'system', companyId);
      
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      
      return `✅ 已建立新任務 ${department.emoji} ${department.name}:\n📋 ${command.title}\n🔖 任務ID: ${taskId.slice(0, 8)}`;
    }
    
    case 'query': {
      const target = command.target.toLowerCase();
      
      // Query department
      const dept = db.prepare(`
        SELECT d.*, COUNT(t.id) as task_count
        FROM departments d
        LEFT JOIN tasks t ON t.department_id = d.id AND t.company_id = ?
        WHERE d.company_id = ? AND (d.name LIKE ? OR d.id LIKE ?)
        GROUP BY d.id
        LIMIT 1
      `).get(companyId, companyId, `%${target}%`, `%${target}%`);
      
      if (dept) {
        const tasks = db.prepare(`
          SELECT status, COUNT(*) as count FROM tasks 
          WHERE department_id = ? AND company_id = ?
          GROUP BY status
        `).all(dept.id, companyId);
        
        const taskCounts = {};
        tasks.forEach(t => { taskCounts[t.status] = t.count; });
        
        const pending = taskCounts.pending || 0;
        const inProgress = taskCounts.in_progress || 0;
        const completed = taskCounts.completed || 0;
        
        return `${dept.emoji} ${dept.name}\n📊 任務: ${pending} 待處理, ${inProgress} 進行中, ${completed} 已完成\n💬 ${dept.description || '無描述'}`;
      }
      
      // Query task by title
      const task = db.prepare(`
        SELECT t.*, d.name as department_name, d.emoji as department_emoji
        FROM tasks t
        JOIN departments d ON t.department_id = d.id
        WHERE t.company_id = ? AND t.title LIKE ?
        ORDER BY t.created_at DESC LIMIT 1
      `).get(companyId, `%${target}%`);
      
      if (task) {
        const statusEmoji = task.status === 'completed' ? '✅' : 
                           task.status === 'in_progress' ? '🔄' : '⏳';
        return `${task.department_emoji} ${task.title}\n📌 狀態: ${statusEmoji} ${task.status}\n🏷️ 部門: ${task.department_name}`;
      }
      
      return `❌ 找不到 "${command.target}" 相關的部門或任務`;
    }
    
    case 'stats': {
      const taskStats = db.prepare(`
        SELECT status, COUNT(*) as count FROM tasks WHERE company_id = ? GROUP BY status
      `).all(companyId);
      const workerStats = db.prepare(`
        SELECT status, COUNT(*) as count FROM workers WHERE company_id = ? GROUP BY status
      `).all(companyId);
      const totalWorkers = db.prepare('SELECT COUNT(*) as count FROM workers WHERE company_id = ?').get(companyId);
      
      const taskCounts = {};
      taskStats.forEach(s => { taskCounts[s.status] = s.count; });
      const workerCounts = {};
      workerStats.forEach(s => { workerCounts[s.status] = s.count; });
      
      return `📊 Pixel Office 系統狀態\n\n` +
        `👥 Workers: ${totalWorkers.count} 總數 | ` +
        `🟢 ${workerCounts.active || 0} 活躍 | ` +
        `🟡 ${workerCounts.idle || 0} 閒置 | ` +
        `🔵 ${workerCounts.busy || 0} 忙碌\n` +
        `📋 Tasks: ` +
        `⏳ ${taskCounts.pending || 0} 待處理 | ` +
        `🔄 ${taskCounts.in_progress || 0} 進行中 | ` +
        `✅ ${taskCounts.completed || 0} 已完成`;
    }
    
    case 'list_workers': {
      const workers = db.prepare(`
        SELECT w.*, d.name as department_name, d.emoji as department_emoji
        FROM workers w
        LEFT JOIN departments d ON w.department_id = d.id
        WHERE w.company_id = ?
        ORDER BY w.status, w.name
      `).all(companyId);
      
      if (workers.length === 0) {
        return '📋 沒有 workers';
      }
      
      const lines = ['👥 Worker 列表:\n'];
      workers.forEach(w => {
        const statusIcon = w.status === 'active' ? '🟢' : w.status === 'busy' ? '🔵' : '🟡';
        const dept = w.department_name ? ` (${w.department_emoji} ${w.department_name})` : ' (無部門)';
        lines.push(`${statusIcon} ${w.name}${dept} - ${w.status}`);
      });
      
      return lines.join('\n');
    }
    
    case 'list_tasks': {
      const tasks = db.prepare(`
        SELECT t.*, d.name as department_name, d.emoji as department_emoji
        FROM tasks t
        JOIN departments d ON t.department_id = d.id
        WHERE t.company_id = ?
        ORDER BY t.created_at DESC LIMIT 10
      `).all(companyId);
      
      if (tasks.length === 0) {
        return '📋 沒有任務';
      }
      
      const lines = ['📋 最近任務:\n'];
      tasks.forEach(t => {
        const statusIcon = t.status === 'completed' ? '✅' : 
                          t.status === 'in_progress' ? '🔄' : '⏳';
        lines.push(`${statusIcon} [${t.department_emoji}] ${t.title} (${t.status})`);
      });
      
      return lines.join('\n');
    }
    
    default:
      return null;
  }
}

// ============ WEBSOCKET ============
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();
const hermesClients = new Set(); // Hermes-connected clients

wss.on('connection', (ws, req) => {
  try {
    // Guard against missing req or req.url
    if (!req || !req.url) {
      console.error('WS connection rejected: missing request or URL');
      ws.close(1011, 'Missing request data');
      return;
    }

    // Parse token from query string with defensive host fallback
    const host = req.headers && req.headers.host ? req.headers.host : 'localhost';
    let url;
    try {
      url = new URL(req.url, `http://${host}`);
    } catch (urlErr) {
      console.error('WS connection rejected: invalid URL:', req.url, urlErr.message);
      ws.close(1011, 'Invalid request URL');
      return;
    }

    const token = url.searchParams.get('token');

    // Check if this is a Hermes connection with valid token
    if (token === HERMES_AUTH_TOKEN) {
      hermesClients.add(ws);
      ws.hermesId = 'hermes-' + uuidv4().slice(0, 8);
      ws.isHermes = true;
      console.log(`🔗 Hermes client connected: ${ws.hermesId}. Total Hermes clients: ${hermesClients.size}, IP: ${req.socket ? req.socket.remoteAddress : 'unknown'}`);
    } else {
      // Regular client
      clients.add(ws);
      console.log(`WS client connected. Total clients: ${clients.size}, IP: ${req.socket ? req.socket.remoteAddress : 'unknown'}`);
    }

    ws.on('close', () => {
      if (ws.isHermes) {
        hermesClients.delete(ws);
        console.log(`🔓 Hermes client disconnected: ${ws.hermesId}. Total Hermes clients: ${hermesClients.size}`);
      } else {
        clients.delete(ws);
        console.log(`WS client disconnected. Total clients: ${clients.size}`);
      }
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error for ${ws.isHermes ? ws.hermesId : 'client'}:`, err.message);
    });
  } catch (err) {
    console.error('WS connection handler error:', err);
    try { ws.close(1011, 'Internal server error'); } catch (_) {}
  }
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

// Broadcast to all connected Hermes clients
function broadcastToHermes(data) {
  const msg = JSON.stringify(data);
  hermesClients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
  console.log(`📡 Broadcast to Hermes: ${data.type}, recipients: ${hermesClients.size}`);
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

  const { status, mood } = req.body;
  const company_id = getCompanyId(req);
  const validStatuses = ['active', 'idle', 'busy'];
  const newStatus = validStatuses.includes(status) ? status : 'active';

  const existing = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  if (mood !== undefined) {
    db.prepare(`
      UPDATE workers SET status = ?, mood = ?, last_ping = datetime('now') WHERE id = ?
    `).run(newStatus, mood, req.params.id);
  } else {
    db.prepare(`
      UPDATE workers SET status = ?, last_ping = datetime('now') WHERE id = ?
    `).run(newStatus, req.params.id);
  }

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

// DELETE Department
app.delete('/api/departments/:id', (req, res) => {
  const company_id = getCompanyId(req);
  const existing = db.prepare('SELECT * FROM departments WHERE id = ? AND company_id = ?').get(req.params.id, company_id);
  if (!existing) return res.status(404).json({ error: 'Department not found' });

  // Delete related activity logs first
  db.prepare('DELETE FROM activity_logs WHERE department_id = ?').run(req.params.id);
  // Delete related tasks
  db.prepare('DELETE FROM tasks WHERE department_id = ?').run(req.params.id);
  // Delete the department
  db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);

  logAudit('delete', 'department', req.params.id, req.user.id, { name: existing.name });
  broadcast({ type: 'department_deleted', department_id: req.params.id });
  res.json({ success: true });
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
  logAudit('create', 'task', id, req.user.id, { title, department_id, company_id });
  // Log to activity_logs
  logActivity(department_id, 'task_created', `任務「${title}」已建立`, req.user.id, req.user.username, 'task', id, { priority, assigned_to });
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

  // Log status changes to activity_logs
  if (status !== undefined) {
    const statusLabels = { pending: '待處理', in_progress: '進行中', completed: '已完成', failed: '失敗' };
    let actionType = 'status_changed';
    let desc = `任務「${task.title}」狀態變更為 ${statusLabels[status] || status}`;
    if (status === 'completed') actionType = 'task_completed';
    if (status === 'in_progress') actionType = 'task_started';
    logActivity(task.department_id, actionType, desc, req.user.id, req.user.username, 'task', task.id, { old_status: existing.status, new_status: status });
  }

  // Log assignment changes
  if (assigned_to !== undefined && assigned_to !== existing.assigned_to) {
    const worker = assigned_to ? db.prepare('SELECT name FROM workers WHERE id = ?').get(assigned_to) : null;
    const workerName = worker ? worker.name : '無';
    logActivity(task.department_id, 'task_assigned', `任務「${task.title}」已指派給 ${workerName}`, req.user.id, req.user.username, 'task', task.id, { assigned_to });
  }

  broadcast({ type: 'task_updated', task });
  res.json(task);
});

// DELETE task
app.delete('/api/tasks/:id', (req, res) => {
  const company_id = getCompanyId(req);
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND company_id = ?').get(req.params.id, company_id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const deptId = existing.department_id;
  const taskTitle = existing.title;
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  logAudit('delete', 'task', req.params.id, req.user.id, { title: taskTitle });
  logActivity(deptId, 'task_deleted', `任務「${taskTitle}」已刪除`, req.user.id, req.user.username, 'task', req.params.id);
  broadcast({ type: 'task_deleted', task_id: req.params.id });
  res.json({ success: true });
});

// ============ ACTIVITY LOGS ============
function logActivity(departmentId, action, description, userId, userName, entityType, entityId, metadata) {
  const id = uuidv4();
  db.prepare(`
    INSERT INTO activity_logs (id, department_id, action, description, user_id, user_name, entity_type, entity_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, departmentId, action, description || '', userId || 'system', userName || 'system', entityType || '', entityId || '', metadata ? JSON.stringify(metadata) : null);
  return id;
}

// GET activities (by department or all)
app.get('/api/activities', (req, res) => {
  const company_id = getCompanyId(req);
  const { department_id, limit } = req.query;
  let query = `
    SELECT a.*, d.name as department_name, d.emoji as department_emoji
    FROM activity_logs a
    JOIN departments d ON a.department_id = d.id
    WHERE d.company_id = ?
  `;
  const params = [company_id];
  if (department_id) {
    query += ' AND a.department_id = ?';
    params.push(department_id);
  }
  query += ' ORDER BY a.created_at DESC';
  if (limit) {
    query += ` LIMIT ${parseInt(limit, 10)}`;
  } else {
    query += ' LIMIT 50';
  }
  res.json(db.prepare(query).all(...params));
});

// POST activity (manual log entry)
app.post('/api/activities', (req, res) => {
  const company_id = getCompanyId(req);
  const { department_id, action, description, entity_type, entity_id, metadata } = req.body;
  if (!department_id || !action) {
    return res.status(400).json({ error: 'department_id and action are required' });
  }
  // Verify department exists
  const dept = db.prepare('SELECT * FROM departments WHERE id = ? AND company_id = ?').get(department_id, company_id);
  if (!dept) return res.status(404).json({ error: 'Department not found' });

  const id = logActivity(department_id, action, description || action, req.user?.id, req.user?.username || 'user', entity_type, entity_id, metadata);
  const activity = db.prepare('SELECT * FROM activity_logs WHERE id = ?').get(id);
  broadcast({ type: 'activity_logged', activity });
  res.status(201).json(activity);
});

// DELETE activity (cleanup)
app.delete('/api/activities/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM activity_logs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Activity not found' });
  db.prepare('DELETE FROM activity_logs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
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
    broadcast({ type: 'message_sent', message: msg });

    // Try to parse and execute natural language commands
    const command = parseCommand(content);
    let botResponse = null;

    if (command) {
      // Command matched - execute it
      botResponse = await executeCommand(command, company_id, db);
    } else {
      // No command matched - broadcast to Hermes clients for AI response
      if (hermesClients.size > 0) {
        console.log(`📨 No command matched, broadcasting to ${hermesClients.size} Hermes client(s)`);
        broadcastToHermes({
          type: 'user_message',
          message: msg,
          room_type: room_type,
          room_id: room_id
        });
        // Don't set botResponse here - Hermes will reply via /api/hermes-reply
        // Return early so we don't send a pending response
        return res.status(201).json({ ...msg, pending_hermes: true });
      } else {
        // No Hermes clients connected, return a message indicating waiting for Hermes
        console.log('⚠️ No Hermes clients connected, message queued');
        return res.status(201).json({ ...msg, waiting_hermes: true });
      }
    }

    if (botResponse) {
      // Send bot response message
      const botId = 'bot-' + uuidv4().slice(0, 8);
      db.prepare(`
        INSERT INTO messages (id, company_id, sender_id, sender_type, sender_name, content, room_type, room_id)
  VALUES (?, ?, 'hermes', 'bot', '🤖 Hermes', ?, ?, ?)
      `).run(botId, company_id, 'bot', botResponse, room_type, room_id);

      const botMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(botId);
      broadcast({ type: 'message_sent', message: botMsg });
    }

    res.status(201).json(msg);
  } catch (err) {
    console.error('POST /api/messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/hermes-reply - Hermes replies to a user message
app.post('/api/hermes-reply', authMiddleware, (req, res) => {
  const company_id = getCompanyId(req);
  const { message_id, content, hermes_id } = req.body;

  if (!message_id || !content) {
    return res.status(400).json({ error: 'message_id and content are required' });
  }

  // Verify the original message exists and belongs to this company
  const originalMsg = db.prepare(
    'SELECT * FROM messages WHERE id = ? AND company_id = ?'
  ).get(message_id, company_id);

  if (!originalMsg) {
    return res.status(404).json({ error: 'Original message not found' });
  }

  // Insert Hermes reply as a bot message
  const replyId = 'bot-' + uuidv4().slice(0, 8);
  const senderName = hermes_id ? `🤖 ${hermes_id}` : '🤖 Hermes';

  db.prepare(`
    INSERT INTO messages (id, company_id, sender_id, sender_type, sender_name, content, room_type, room_id)
    VALUES (?, ?, ?, 'bot', ?, ?, ?, ?)
  `).run(replyId, company_id, 'hermes', senderName, content, originalMsg.room_type, originalMsg.room_id);

  const botMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(replyId);

  // Broadcast the reply to all connected clients (including the sender)
  broadcast({ type: 'message_sent', message: botMsg });

  console.log(`📬 Hermes reply sent: ${replyId} for original message: ${message_id}`);

  res.status(201).json(botMsg);
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