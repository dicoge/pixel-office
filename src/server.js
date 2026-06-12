     1|const express = require('express');
     2|const bcrypt = require('bcryptjs');
     3|const jwt = require('jsonwebtoken');
     4|const Database = require('./db');
     5|const { WebSocketServer } = require('ws');
     6|const cors = require('cors');
     7|const rateLimit = require('express-rate-limit');
     8|const { v4: uuidv4 } = require('uuid');
     9|const http = require('http');
    10|const path = require('path');
    11|const fs = require('fs');
    12|
    13|// ============ CONFIG ============
    14|const PORT = process.env.PORT || 3000;
    15|const JWT_SECRET=proces...CRET || 'pixel-office-secret-change-me';
    16|const JWT_EXPIRES_IN = '7d';
    17|const BCRYPT_ROUNDS = 12;
    18|const DATA_DIR = path.join(__dirname, '..', 'data');
    19|const DB_PATH = path.join(DATA_DIR, 'tasks.db');
    20|const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
    21|const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
    22|const RATE_LIMIT_MAX = 300;
    23|
    24|// Task Queue API Key for worker registration
    25|const TASK_QUEUE_API_KEY=proces..._KEY || 's3cr3t_t4sk_k3y_2026';
    26|
    27|// SwarmClaw tunnel URL for proxying to local SwarmClaw
    28|const SWARMCLAW_TUNNEL_URL = process.env.SWARMCLAW_TUNNEL_URL || 'http://localhost:3456';
    29|
    30|// Hermes WebSocket Auth Token
    31|const HERMES_AUTH_TOKEN=proces...OKEN || 'hermes-secret-token-2026';
    32|
    33|// Admin credentials (hardcoded - Railway env var override disabled to prevent hash corruption)
    34|const ADMIN_USERNAME = 'dicoge';
    35|const ADMIN_PASSWORD_HASH='$2a$12...M9ee';
    36|
    37|// ============ PROCESS-LEVEL ERROR HANDLING ============
    38|process.on('uncaughtException', (err) => {
    39|  console.error('UNCAUGHT EXCEPTION:', err.message, err.stack);
    40|  // Give logger time to flush, then exit with non-zero code
    41|  setTimeout(() => process.exit(1), 1000);
    42|});
    43|
    44|process.on('unhandledRejection', (reason, promise) => {
    45|  console.error('UNHANDLED REJECTION:', reason instanceof Error ? reason.message : reason);
    46|});
    47|
    48|// ============ INIT ============
    49|const app = express();
    50|const server = http.createServer(app);
    51|
    52|// Ensure data directory exists
    53|if (!fs.existsSync(DATA_DIR)) {
    54|  fs.mkdirSync(DATA_DIR, { recursive: true });
    55|}
    56|
    57|// ============ CORS ============
    58|const corsOptions = {
    59|  origin: (origin, callback) => {
    60|    if (!origin || ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
    61|      callback(null, true);
    62|    } else {
    63|      callback(new Error('CORS not allowed'));
    64|    }
    65|  },
    66|  credentials: true
    67|};
    68|
    69|// ============ DATABASE ============
    70|const db = new Database(DB_PATH);
    71|
    72|// Initialize schema
    73|function initDatabase() {
    74|  db.exec(`
    75|    CREATE TABLE IF NOT EXISTS users (
    76|      id TEXT PRIMARY KEY,
    77|      username TEXT UNIQUE NOT NULL,
    78|      password_hash TEXT NOT NULL,
    79|      role TEXT DEFAULT 'user',
    80|      created_at TEXT DEFAULT (datetime('now'))
    81|    );
    82|
    83|    CREATE TABLE IF NOT EXISTS departments (
    84|      id TEXT PRIMARY KEY,
    85|      name TEXT NOT NULL,
    86|      emoji TEXT NOT NULL,
    87|      description TEXT,
    88|      created_at TEXT DEFAULT (datetime('now'))
    89|    );
    90|
    91|    CREATE TABLE IF NOT EXISTS tasks (
    92|      id TEXT PRIMARY KEY,
    93|      department_id TEXT NOT NULL,
    94|      title TEXT NOT NULL,
    95|      description TEXT,
    96|      status TEXT DEFAULT 'pending',
    97|      priority TEXT DEFAULT 'normal',
    98|      assigned_to TEXT,
    99|      created_by TEXT,
   100|      created_at TEXT DEFAULT (datetime('now')),
   101|      updated_at TEXT DEFAULT (datetime('now')),
   102|      completed_at TEXT,
   103|      FOREIGN KEY (department_id) REFERENCES departments(id)
   104|    );
   105|
   106|    CREATE TABLE IF NOT EXISTS workers (
   107|      id TEXT PRIMARY KEY,
   108|      name TEXT NOT NULL,
   109|      status TEXT DEFAULT 'idle',
   110|      department_id TEXT,
   111|      machine_id TEXT,
   112|      last_ping TEXT DEFAULT (datetime('now')),
   113|      created_at TEXT DEFAULT (datetime('now'))
   114|    );
   115|
   116|    CREATE TABLE IF NOT EXISTS audit_logs (
   117|      id TEXT PRIMARY KEY,
   118|      action TEXT NOT NULL,
   119|      entity_type TEXT NOT NULL,
   120|      entity_id TEXT,
   121|      user_id TEXT,
   122|      details TEXT,
   123|      created_at TEXT DEFAULT (datetime('now'))
   124|    );
   125|  `);
   126|
   127|  // Migration: Add company_id columns if they don't exist (for existing databases)
   128|  try {
   129|    db.exec("ALTER TABLE workers ADD COLUMN company_id TEXT DEFAULT 'company-a'");
   130|  } catch (e) {
   131|    // Column already exists, ignore
   132|  }
   133|  try {
   134|    db.exec("ALTER TABLE departments ADD COLUMN company_id TEXT DEFAULT 'company-a'");
   135|  } catch (e) {
   136|    // Column already exists, ignore
   137|  }
   138|  try {
   139|    db.exec("ALTER TABLE tasks ADD COLUMN company_id TEXT DEFAULT 'company-a'");
   140|  } catch (e) {
   141|    // Column already exists, ignore
   142|  }
   143|  try {
   144|    db.exec("ALTER TABLE users ADD COLUMN company_ids TEXT DEFAULT 'company-a'");
   145|  } catch (e) {
   146|    // Column already exists, ignore
   147|  }
   148|  // Migration: Add machine_id column if it doesn't exist (for existing databases)
   149|  try {
   150|    db.exec("ALTER TABLE workers ADD COLUMN machine_id TEXT");
   151|  } catch (e) {
   152|    // Column already exists, ignore
   153|  }
   154|  // Migration: Add mood column for hourly mood messages
   155|  try {
   156|    db.exec("ALTER TABLE workers ADD COLUMN mood TEXT DEFAULT NULL");
   157|  } catch (e) {
   158|    // Column already exists, ignore
   159|  }
   160|  // Migration: Add avatar column for worker self-portraits (base64 PNG)
   161|  try {
   162|    db.exec("ALTER TABLE workers ADD COLUMN avatar TEXT DEFAULT NULL");
   163|  } catch (e) {
   164|    // Column already exists, ignore
   165|  }
   166|
   167|  // Companies table (for custom company names)
   168|  db.exec(`
   169|    CREATE TABLE IF NOT EXISTS companies (
   170|      id TEXT PRIMARY KEY,
   171|      name TEXT NOT NULL,
   172|      emoji TEXT DEFAULT '🏢',
   173|      created_at TEXT DEFAULT (datetime('now')),
   174|      updated_at TEXT DEFAULT (datetime('now'))
   175|    )
   176|  `);
   177|
   178|  // Seed companies if not exist
   179|  const companyStmt = db.prepare('INSERT OR IGNORE INTO companies (id, name, emoji) VALUES (?, ?, ?)');
   180|  companyStmt.run('company-a', 'MiniPc', '🖥️');
   181|  companyStmt.run('company-b', 'MacBook', '💻');
   182|
   183|  // Companies definition (kept for fallback/initialization)
   184|  const COMPANIES = [
   185|    { id: 'company-a', name: 'MiniPc', emoji: '🖥️' },
   186|    { id: 'company-b', name: 'MacBook', emoji: '💻' }
   187|  ];
   188|
   189|  // Seed 3 departments (shared across all companies)
   190|  const deptStmt = db.prepare('INSERT OR IGNORE INTO departments (id, name, emoji, description, company_id) VALUES (?, ?, ?, ?, ?)');
   191|  const departments = [
   192|    ['dept-dungeon', 'DungeonD3', '🎮', '地城爬塔遊戲開發', 'company-a'],
   193|    ['dept-stock', '每日台股報告', '📊', '股票研究與每日報告', 'company-a'],
   194|    ['dept-pixeloffice', 'Pixel Office', '🎮', 'AI Agent 管理系統維護', 'company-a']
   195|  ];
   196|  departments.forEach(d => deptStmt.run(...d));
   197|
   198|  // Seed workers — use name-based IDs to survive INSERT OR IGNORE
   199|  // Migration: delete old seed workers with wrong names
   200|  try {
   201|    // Check if old seed workers exist (OpenClaw should not be worker-1 in new schema)
   202|    const oldWorker = db.prepare('SELECT id, name FROM workers WHERE id = ?').get('worker-1');
   203|    if (oldWorker && oldWorker.name !== 'Hermes') {
   204|      console.log('🐛 Migration: Removing old seed workers (name mismatch), re-seeding fresh...');
   205|      const oldIds = ['worker-1','worker-2','worker-3','worker-4','worker-5','worker-6','worker-7'];
   206|      oldIds.forEach(id => db.prepare('DELETE FROM workers WHERE id = ?').run(id));
   207|    }
   208|  } catch(e) { /* ignore migration errors */ }
   209|  
   210|  const workerStmt = db.prepare('INSERT OR IGNORE INTO workers (id, name, status, department_id, company_id, machine_id, mood) VALUES (?, ?, ?, ?, ?, ?, ?)');
   211|  // 7 workers — all 'idle' so they stay at their designated desks
   212|  workerStmt.run('worker-1', 'Hermes', 'idle', 'dept-pixeloffice', 'company-a', 'MiniPc', '協調一切進行中');
   213|  workerStmt.run('worker-2', 'OpenClaw', 'idle', 'dept-dungeon', 'company-a', 'MiniPc', '測試案例撰寫中');
   214|  workerStmt.run('worker-3', 'Codex', 'idle', 'dept-stock', 'company-a', 'MiniPc', '架構規劃中');
   215|  workerStmt.run('worker-4', 'Gemini', 'idle', null, 'company-a', 'MiniPc', '搜尋相關資料');
   216|  workerStmt.run('worker-5', 'Manus', 'idle', null, 'company-a', 'MiniPc', '設計 UI 流程');
   217|  workerStmt.run('worker-6', 'Claude Code', 'idle', null, 'company-a', 'MiniPc', '程式碼撰寫中');
   218|  workerStmt.run('worker-7', 'OpenCode', 'idle', null, 'company-a', 'MiniPc', '優化現有功能');
   219|
   220|  // Company-b workers (MacBook) — different moods from MiniPC
   221|  // Note: IDs use worker-b prefix to avoid collision with company-a
   222|  workerStmt.run('worker-b1', 'Hermes', 'idle', null, 'company-b', 'MacBook', '編輯設定中...');
   223|  workerStmt.run('worker-b2', 'OpenClaw', 'idle', null, 'company-b', 'MacBook', '測試 MacBook 環境');
   224|  workerStmt.run('worker-b3', 'Codex', 'idle', null, 'company-b', 'MacBook', '架構轉移評估');
   225|  workerStmt.run('worker-b4', 'Gemini', 'idle', null, 'company-b', 'MacBook', '資料比對中');
   226|  workerStmt.run('worker-b5', 'Manus', 'idle', null, 'company-b', 'MacBook', 'UI 適配調整');
   227|  workerStmt.run('worker-b6', 'Claude Code', 'idle', null, 'company-b', 'MacBook', 'Mac 端開發');
   228|  workerStmt.run('worker-b7', 'OpenCode', 'idle', null, 'company-b', 'MacBook', '效能優化中');
   229|
   230|      // ============ SWARMCLAW TABLES (戰情室) ============
  // Agents table (org chart hierarchy)
  db.exec(\`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'worker',
      parent_id TEXT,
      status TEXT DEFAULT 'idle',
      department_id TEXT,
      capabilities TEXT DEFAULT '[]',
      avatar TEXT,
      company_id TEXT DEFAULT 'company-a',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (parent_id) REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS agent_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      assigned_agent_id TEXT,
      depends_on TEXT DEFAULT '[]',
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      schedule_at TEXT,
      created_by TEXT,
      company_id TEXT DEFAULT 'company-a',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (assigned_agent_id) REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS agent_task_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES agent_tasks(id)
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      agent_id TEXT,
      task_template TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      last_run_at TEXT,
      next_run_at TEXT,
      company_id TEXT DEFAULT 'company-a',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );
  \`);

  // Seed real team agents
  const agentStmt = db.prepare('INSERT OR IGNORE INTO agents (id, name, role, parent_id, status, department_id, capabilities, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  agentStmt.run('agent-hermes',     '🧿 Hermes',      'coordinator', null,                'active', 'dept-pixeloffice', '["調度","驗證","記憶","分配"]', 'company-a');
  agentStmt.run('agent-ccr',        '🐚 CCR',         'worker',  'agent-hermes',        'idle',   'dept-dungeon',     '["開發","實作","Claude-Code"]', 'company-a');
  agentStmt.run('agent-codex',      '🤖 Codex',       'reviewer','agent-hermes',        'idle',   'dept-stock',       '["Code-Review","審查","QA"]', 'company-a');
  agentStmt.run('agent-opencode',   '🔓 OpenCode',    'worker',  'agent-hermes',        'idle',   'dept-pixeloffice', '["開發","實作","DeepSeek"]', 'company-a');
  agentStmt.run('agent-openclaw',   '🐾 OpenClaw',    'tester',  'agent-hermes',        'idle',   'dept-dungeon',     '["測試","驗證","自動化"]', 'company-a');
  agentStmt.run('agent-gemini',     '🔮 Gemini',      'analyst', 'agent-hermes',        'idle',   'dept-stock',       '["分析","研究","監控"]', 'company-a');
  agentStmt.run('agent-openmanus',  '🦾 Manus',       'worker',  'agent-hermes',        'idle',   'dept-pixeloffice', '["通用任務","網頁操作","文件"]', 'company-a');
  agentStmt.run('agent-swarmclaw',  '🐝 SwarmClaw',   'hub',     'agent-hermes',        'active', 'dept-pixeloffice', '["會議室","戰情","協作"]', 'company-a');

// Messages table
   231|  db.exec(`
   232|    CREATE TABLE IF NOT EXISTS messages (
   233|      id TEXT PRIMARY KEY,
   234|      company_id TEXT NOT NULL,
   235|      sender_id TEXT,
   236|      sender_type TEXT DEFAULT 'user',
   237|      sender_name TEXT,
   238|      content TEXT NOT NULL,
   239|      room_type TEXT,
   240|      room_id TEXT,
   241|      created_at TEXT DEFAULT (datetime('now'))
   242|    )
   243|  `);
   244|
   245|  // Activity logs table (per-department activity tracking)
   246|  db.exec(`
   247|    CREATE TABLE IF NOT EXISTS activity_logs (
   248|      id TEXT PRIMARY KEY,
   249|      department_id TEXT NOT NULL,
   250|      action TEXT NOT NULL,
   251|      description TEXT,
   252|      user_id TEXT,
   253|      user_name TEXT,
   254|      entity_type TEXT,
   255|      entity_id TEXT,
   256|      metadata TEXT,
   257|      created_at TEXT DEFAULT (datetime('now')),
   258|      FOREIGN KEY (department_id) REFERENCES departments(id)
   259|    )
   260|  `);
   261|
   262|  // Seed initial activity logs for demo departments
   263|  const activityStmt = db.prepare('INSERT OR IGNORE INTO activity_logs (id, department_id, action, description, user_name, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
   264|  activityStmt.run(uuidv4(), 'dept-dungeon', 'created', '部門建立', 'system', 'department', 'dept-dungeon');
   265|  activityStmt.run(uuidv4(), 'dept-dungeon', 'task_created', '任務「修補遊戲BUG」已建立', 'dicoge', 'task', null);
   266|  activityStmt.run(uuidv4(), 'dept-dungeon', 'task_completed', '任務「測試戰鬥系統」已完成', 'dicoge', 'task', null);
   267|  activityStmt.run(uuidv4(), 'dept-stock', 'created', '部門建立', 'system', 'department', 'dept-stock');
   268|  activityStmt.run(uuidv4(), 'dept-stock', 'task_created', '任務「分析台積電走势」已建立', 'dicoge', 'task', null);
   269|  activityStmt.run(uuidv4(), 'dept-pixeloffice', 'created', '部門建立', 'system', 'department', 'dept-pixeloffice');
   270|}
   271|
   272|// ============ MIDDLEWARE ============
   273|app.use(cors(corsOptions));
   274|app.use(express.json());
   275|app.use(express.static(path.join(__dirname, '..', 'public')));
   276|
   277|// Rate limiting
   278|const limiter = rateLimit({
   279|  windowMs: RATE_LIMIT_WINDOW,
   280|  max: RATE_LIMIT_MAX,
   281|  standardHeaders: true,
   282|  legacyHeaders: false,
   283|  message: { error: 'Too many requests, please try again later.' }
   284|});
   285|app.use('/api/', limiter);
   286|
   287|// ============ NATURAL LANGUAGE COMMAND PARSER ============
   288|/**
   289| * Parses natural language commands from chat messages.
   290| * Returns null if not a command, or an object with command type and parameters.
   291| */
   292|function parseCommand(text) {
   293|  if (!text || typeof text !== 'string') return null;
   294|  
   295|  const trimmed = text.trim();
   296|  
   297|  // Pattern 1: "派 XXX 去 YYY" → assign task to worker
   298|  // Matches: 派 OpenClaw 去修bug, 派Codex去做報告, 派 DungeonBot 去執行任務
   299|  const assignMatch = trimmed.match(/^[派指派]?\s*(.+?)\s*(?:去|去做|去修|去執行|去處理|去完成)\s*(.+)/);
   300|  if (assignMatch) {
   301|    return {
   302|      type: 'assign',
   303|      worker: assignMatch[1].trim(),
   304|      task: assignMatch[2].trim()
   305|    };
   306|  }
   307|  
   308|  // Pattern 2: "開新任務 XXX" or "新建任務 XXX" → create task
   309|  const createTaskMatch = trimmed.match(/^(?:開新任務|新建任務|建立任務|建立新任務)\s*(.+)/i);
   310|  if (createTaskMatch) {
   311|    return {
   312|      type: 'create_task',
   313|      title: createTaskMatch[1].trim()
   314|    };
   315|  }
   316|  
   317|  // Pattern 3: "查看 XXX" or "查詢 XXX" → query status
   318|  const queryMatch = trimmed.match(/^(?:查看|查詢|看看|看一下)\s*(.+)/i);
   319|  if (queryMatch) {
   320|    return {
   321|      type: 'query',
   322|      target: queryMatch[1].trim()
   323|    };
   324|  }
   325|  
   326|  // Pattern 4: "狀態" or "系統狀態" → overall stats
   327|  if (/^(?:狀態|系統狀態|看一下狀態|查狀態)$/.test(trimmed)) {
   328|    return {
   329|      type: 'stats'
   330|    };
   331|  }
   332|  
   333|  // Pattern 5: "worker列表" or "員工列表" → list workers
   334|  if (/^(?:worker列表|員工列表|workers?|workers\s+list)$/i.test(trimmed)) {
   335|    return {
   336|      type: 'list_workers'
   337|    };
   338|  }
   339|  
   340|  // Pattern 6: "任務列表" or "所有任務" → list tasks
   341|  if (/^(?:任務列表|所有任務|tasks?|tasks\s+list)$/i.test(trimmed)) {
   342|    return {
   343|      type: 'list_tasks'
   344|    };
   345|  }
   346|  
   347|  return null;
   348|}
   349|
   350|/**
   351| * Executes a parsed command and returns a response message.
   352| */
   353|async function executeCommand(command, companyId, db) {
   354|  switch (command.type) {
   355|    case 'assign': {
   356|      // Find worker by name
   357|      const worker = db.prepare(`
   358|        SELECT w.*, d.name as department_name, d.emoji as department_emoji
   359|        FROM workers w
   360|        LEFT JOIN departments d ON w.department_id = d.id
   361|        WHERE w.company_id = ? AND w.name LIKE ?
   362|        LIMIT 1
   363|      `).get(companyId, `%${command.worker}%`);
   364|      
   365|      if (!worker) {
   366|        // List available workers
   367|        const workers = db.prepare('SELECT name FROM workers WHERE company_id = ?').all(companyId);
   368|        const workerNames = workers.map(w => w.name).join(', ');
   369|        return `❌ 找不到 worker "${command.worker}"，可用 worker: ${workerNames || '無'}`;
   370|      }
   371|      
   372|      // Determine department - use worker's current department or default to first
   373|      const department = worker.department_id || 
   374|        db.prepare('SELECT id FROM departments WHERE company_id = ? LIMIT 1').get(companyId)?.id;
   375|      
   376|      if (!department) {
   377|        return '❌ 沒有可用的部門，請先建立部門';
   378|      }
   379|      
   380|      // Create task and assign to worker
   381|      const taskId = require('uuid').v4();
   382|      db.prepare(`
   383|        INSERT INTO tasks (id, department_id, title, status, assigned_to, created_by, company_id)
   384|        VALUES (?, ?, ?, 'pending', ?, ?, ?)
   385|      `).run(taskId, department, command.task, worker.id, 'system', companyId);
   386|      
   387|      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
   388|      
   389|      // Update worker status to busy
   390|      db.prepare("UPDATE workers SET status = 'busy' WHERE id = ?").run(worker.id);
   391|      
   392|      return `✅ 已指派任務給 ${worker.name}${worker.department_name ? ` (${worker.department_emoji} ${worker.department_name})` : ''}:\n📋 ${command.task}\n🔖 任務ID: ${taskId.slice(0, 8)}`;
   393|    }
   394|    
   395|    case 'create_task': {
   396|      // Use first department as default
   397|      const department = db.prepare('SELECT id, name, emoji FROM departments WHERE company_id = ? LIMIT 1').get(companyId);
   398|      
   399|      if (!department) {
   400|        return '❌ 沒有可用的部門，請先建立部門';
   401|      }
   402|      
   403|      const taskId = require('uuid').v4();
   404|      db.prepare(`
   405|        INSERT INTO tasks (id, department_id, title, status, created_by, company_id)
   406|        VALUES (?, ?, ?, 'pending', ?, ?)
   407|      `).run(taskId, department.id, command.title, 'system', companyId);
   408|      
   409|      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
   410|      
   411|      return `✅ 已建立新任務 ${department.emoji} ${department.name}:\n📋 ${command.title}\n🔖 任務ID: ${taskId.slice(0, 8)}`;
   412|    }
   413|    
   414|    case 'query': {
   415|      const target = command.target.toLowerCase();
   416|      
   417|      // Query department
   418|      const dept = db.prepare(`
   419|        SELECT d.*, COUNT(t.id) as task_count
   420|        FROM departments d
   421|        LEFT JOIN tasks t ON t.department_id = d.id AND t.company_id = ?
   422|        WHERE d.company_id = ? AND (d.name LIKE ? OR d.id LIKE ?)
   423|        GROUP BY d.id
   424|        LIMIT 1
   425|      `).get(companyId, companyId, `%${target}%`, `%${target}%`);
   426|      
   427|      if (dept) {
   428|        const tasks = db.prepare(`
   429|          SELECT status, COUNT(*) as count FROM tasks 
   430|          WHERE department_id = ? AND company_id = ?
   431|          GROUP BY status
   432|        `).all(dept.id, companyId);
   433|        
   434|        const taskCounts = {};
   435|        tasks.forEach(t => { taskCounts[t.status] = t.count; });
   436|        
   437|        const pending = taskCounts.pending || 0;
   438|        const inProgress = taskCounts.in_progress || 0;
   439|        const completed = taskCounts.completed || 0;
   440|        
   441|        return `${dept.emoji} ${dept.name}\n📊 任務: ${pending} 待處理, ${inProgress} 進行中, ${completed} 已完成\n💬 ${dept.description || '無描述'}`;
   442|      }
   443|      
   444|      // Query task by title
   445|      const task = db.prepare(`
   446|        SELECT t.*, d.name as department_name, d.emoji as department_emoji
   447|        FROM tasks t
   448|        JOIN departments d ON t.department_id = d.id
   449|        WHERE t.company_id = ? AND t.title LIKE ?
   450|        ORDER BY t.created_at DESC LIMIT 1
   451|      `).get(companyId, `%${target}%`);
   452|      
   453|      if (task) {
   454|        const statusEmoji = task.status === 'completed' ? '✅' : 
   455|                           task.status === 'in_progress' ? '🔄' : '⏳';
   456|        return `${task.department_emoji} ${task.title}\n📌 狀態: ${statusEmoji} ${task.status}\n🏷️ 部門: ${task.department_name}`;
   457|      }
   458|      
   459|      return `❌ 找不到 "${command.target}" 相關的部門或任務`;
   460|    }
   461|    
   462|    case 'stats': {
   463|      const taskStats = db.prepare(`
   464|        SELECT status, COUNT(*) as count FROM tasks WHERE company_id = ? GROUP BY status
   465|      `).all(companyId);
   466|      const workerStats = db.prepare(`
   467|        SELECT status, COUNT(*) as count FROM workers WHERE company_id = ? GROUP BY status
   468|      `).all(companyId);
   469|      const totalWorkers = db.prepare('SELECT COUNT(*) as count FROM workers WHERE company_id = ?').get(companyId);
   470|      
   471|      const taskCounts = {};
   472|      taskStats.forEach(s => { taskCounts[s.status] = s.count; });
   473|      const workerCounts = {};
   474|      workerStats.forEach(s => { workerCounts[s.status] = s.count; });
   475|      
   476|      return `📊 Pixel Office 系統狀態\n\n` +
   477|        `👥 Workers: ${totalWorkers.count} 總數 | ` +
   478|        `🟢 ${workerCounts.active || 0} 活躍 | ` +
   479|        `🟡 ${workerCounts.idle || 0} 閒置 | ` +
   480|        `🔵 ${workerCounts.busy || 0} 忙碌\n` +
   481|        `📋 Tasks: ` +
   482|        `⏳ ${taskCounts.pending || 0} 待處理 | ` +
   483|        `🔄 ${taskCounts.in_progress || 0} 進行中 | ` +
   484|        `✅ ${taskCounts.completed || 0} 已完成`;
   485|    }
   486|    
   487|    case 'list_workers': {
   488|      const workers = db.prepare(`
   489|        SELECT w.*, d.name as department_name, d.emoji as department_emoji
   490|        FROM workers w
   491|        LEFT JOIN departments d ON w.department_id = d.id
   492|        WHERE w.company_id = ?
   493|        ORDER BY w.status, w.name
   494|      `).all(companyId);
   495|      
   496|      if (workers.length === 0) {
   497|        return '📋 沒有 workers';
   498|      }
   499|      
   500|      const lines = ['👥 Worker 列表:\n'];
   501|      workers.forEach(w => {
   502|        const statusIcon = w.status === 'active' ? '🟢' : w.status === 'busy' ? '🔵' : '🟡';
   503|        const dept = w.department_name ? ` (${w.department_emoji} ${w.department_name})` : ' (無部門)';
   504|        lines.push(`${statusIcon} ${w.name}${dept} - ${w.status}`);
   505|      });
   506|      
   507|      return lines.join('\n');
   508|    }
   509|    
   510|    case 'list_tasks': {
   511|      const tasks = db.prepare(`
   512|        SELECT t.*, d.name as department_name, d.emoji as department_emoji
   513|        FROM tasks t
   514|        JOIN departments d ON t.department_id = d.id
   515|        WHERE t.company_id = ?
   516|        ORDER BY t.created_at DESC LIMIT 10
   517|      `).all(companyId);
   518|      
   519|      if (tasks.length === 0) {
   520|        return '📋 沒有任務';
   521|      }
   522|      
   523|      const lines = ['📋 最近任務:\n'];
   524|      tasks.forEach(t => {
   525|        const statusIcon = t.status === 'completed' ? '✅' : 
   526|                          t.status === 'in_progress' ? '🔄' : '⏳';
   527|        lines.push(`${statusIcon} [${t.department_emoji}] ${t.title} (${t.status})`);
   528|      });
   529|      
   530|      return lines.join('\n');
   531|    }
   532|    
   533|    default:
   534|      return null;
   535|  }
   536|}
   537|
   538|// ============ WEBSOCKET ============
   539|const wss = new WebSocketServer({ server, path: '/ws' });
   540|const clients = new Set();
   541|const hermesClients = new Set(); // Hermes-connected clients
   542|
   543|wss.on('connection', (ws, req) => {
   544|  try {
   545|    // Guard against missing req or req.url
   546|    if (!req || !req.url) {
   547|      console.error('WS connection rejected: missing request or URL');
   548|      ws.close(1011, 'Missing request data');
   549|      return;
   550|    }
   551|
   552|    // Parse token from query string with defensive host fallback
   553|    const host = req.headers && req.headers.host ? req.headers.host : 'localhost';
   554|    let url;
   555|    try {
   556|      url = new URL(req.url, `http://${host}`);
   557|    } catch (urlErr) {
   558|      console.error('WS connection rejected: invalid URL:', req.url, urlErr.message);
   559|      ws.close(1011, 'Invalid request URL');
   560|      return;
   561|    }
   562|
   563|    const token = url.searchParams.get('token');
   564|
   565|    // Check if this is a Hermes connection with valid token
   566|    if (token === HERMES_AUTH_TOKEN) {
   567|      hermesClients.add(ws);
   568|      ws.hermesId = 'hermes-' + uuidv4().slice(0, 8);
   569|      ws.isHermes = true;
   570|      console.log(`🔗 Hermes client connected: ${ws.hermesId}. Total Hermes clients: ${hermesClients.size}, IP: ${req.socket ? req.socket.remoteAddress : 'unknown'}`);
   571|    } else {
   572|      // Regular client
   573|      clients.add(ws);
   574|      console.log(`WS client connected. Total clients: ${clients.size}, IP: ${req.socket ? req.socket.remoteAddress : 'unknown'}`);
   575|    }
   576|
   577|    ws.on('close', () => {
   578|      if (ws.isHermes) {
   579|        hermesClients.delete(ws);
   580|        console.log(`🔓 Hermes client disconnected: ${ws.hermesId}. Total Hermes clients: ${hermesClients.size}`);
   581|      } else {
   582|        clients.delete(ws);
   583|        console.log(`WS client disconnected. Total clients: ${clients.size}`);
   584|      }
   585|    });
   586|
   587|    ws.on('error', (err) => {
   588|      console.error(`WebSocket error for ${ws.isHermes ? ws.hermesId : 'client'}:`, err.message);
   589|    });
   590|  } catch (err) {
   591|    console.error('WS connection handler error:', err);
   592|    try { ws.close(1011, 'Internal server error'); } catch (_) {}
   593|  }
   594|});
   595|
   596|function broadcast(data) {
   597|  const msg = JSON.stringify(data);
   598|  clients.forEach(client => {
   599|    if (client.readyState === 1) client.send(msg);
   600|  });
   601|}
   602|
   603|// Broadcast to all connected Hermes clients
   604|function broadcastToHermes(data) {
   605|  const msg = JSON.stringify(data);
   606|  hermesClients.forEach(client => {
   607|    if (client.readyState === 1) client.send(msg);
   608|  });
   609|  console.log(`📡 Broadcast to Hermes: ${data.type}, recipients: ${hermesClients.size}`);
   610|}
   611|
   612|// ============ AUTH HELPERS ============
   613|function generateToken(user) {
   614|  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
   615|}
   616|
   617|function authMiddleware(req, res, next) {
   618|  const authHeader = req.headers.authorization;
   619|  if (!authHeader || !authHeader.startsWith('Bearer ')) {
   620|    return res.status(401).json({ error: 'Missing or invalid authorization header' });
   621|  }
   622|  const token = authHeader.slice(7);
   623|  try {
   624|    req.user = jwt.verify(token, JWT_SECRET);
   625|    next();
   626|  } catch (err) {
   627|    res.status(401).json({ error: 'Invalid or expired token' });
   628|  }
   629|}
   630|
   631|// ============ AUDIT LOG ============
   632|function logAudit(action, entityType, entityId, userId, details) {
   633|  const stmt = db.prepare('INSERT INTO audit_logs (id, action, entity_type, entity_id, user_id, details) VALUES (?, ?, ?, ?, ?, ?)');
   634|  stmt.run(uuidv4(), action, entityType, entityId, userId, JSON.stringify(details));
   635|}
   636|
   637|// ============ COMPANY HELPER ============
   638|function getCompanyId(req) {
   639|  return req.headers['x-company-id'] || req.query.company_id || 'company-a';
   640|}
   641|
   642|// ============ AUTH ROUTES (PUBLIC) ============
   643|app.post('/auth/register', async (req, res) => {
   644|  try {
   645|    // If admin account is configured, disable public registration
   646|    if (ADMIN_USERNAME) {
   647|      return res.status(403).json({ error: 'Public registration is disabled. Contact administrator.' });
   648|    }
   649|
   650|    const { username, password } = req.body;
   651|    if (!username || !password) {
   652|      return res.status(400).json({ error: 'Username and password required' });
   653|    }
   654|    if (username.length < 3 || password.length < 6) {
   655|      return res.status(400).json({ error: 'Username must be 3+ chars, password 6+ chars' });
   656|    }
   657|
   658|    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
   659|    if (existing) {
   660|      return res.status(409).json({ error: 'Username already exists' });
   661|    }
   662|
   663|    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
   664|    const id = uuidv4();
   665|    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(id, username, password_hash);
   666|
   667|    const user = { id, username, role: 'user' };
   668|    const token = generateToken(user);
   669|    logAudit('register', 'user', id, id, { username });
   670|    
   671|    broadcast({ type: 'user_registered', user: { id, username } });
   672|    res.status(201).json({ token, user: { id, username, role: user.role } });
   673|  } catch (err) {
   674|    console.error('Register error:', err);
   675|    res.status(500).json({ error: 'Registration failed' });
   676|  }
   677|});
   678|
   679|app.post('/auth/login', async (req, res) => {
   680|  try {
   681|    const { username, password } = req.body;
   682|    if (!username || !password) {
   683|      return res.status(400).json({ error: 'Username and password required' });
   684|    }
   685|
   686|    let user;
   687|
   688|    // Check if this is the admin login
   689|    if (ADMIN_USERNAME && username === ADMIN_USERNAME && ADMIN_PASSWORD_HASH) {
   690|      const valid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
   691|      if (valid) {
   692|        user = { id: 'admin', username: ADMIN_USERNAME, role: 'admin', company_ids: 'company-a,company-b' };
   693|        const token = generateToken(user);
   694|        logAudit('login', 'user', 'admin', 'admin', { username, type: 'admin' });
   695|        broadcast({ type: 'user_login', user: { id: user.id, username } });
   696|        return res.json({ token, user: { id: user.id, username, role: user.role, company_ids: user.company_ids } });
   697|      }
   698|    }
   699|
   700|    // Normal database authentication
   701|    user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
   702|    if (!user) {
   703|      return res.status(401).json({ error: 'Invalid credentials' });
   704|    }
   705|
   706|    const valid = await bcrypt.compare(password, user.password_hash);
   707|    if (!valid) {
   708|      return res.status(401).json({ error: 'Invalid credentials' });
   709|    }
   710|
   711|    const token = generateToken(user);
   712|    logAudit('login', 'user', user.id, user.id, { username });
   713|    broadcast({ type: 'user_login', user: { id: user.id, username } });
   714|    res.json({ token, user: { id: user.id, username, role: user.role } });
   715|  } catch (err) {
   716|    console.error('Login error:', err);
   717|    res.status(500).json({ error: 'Login failed' });
   718|  }
   719|});
   720|
   721|// ============ WORKER REGISTRATION API (API Key Auth) ============
   722|app.post('/api/workers/register', (req, res) => {
   723|  const apiKey = req.headers['x-api-key'];
   724|  if (!apiKey || apiKey !== TASK_QUEUE_API_KEY) {
   725|    return res.status(401).json({ error: 'Invalid API key' });
   726|  }
   727|
   728|  const { name, department_id, machine_id } = req.body;
   729|  const company_id = getCompanyId(req);
   730|  if (!name) {
   731|    return res.status(400).json({ error: 'Worker name is required' });
   732|  }
   733|
   734|  const id = uuidv4();
   735|  const finalMachineId = machine_id || `machine-${id.slice(0, 8)}`;
   736|
   737|  db.prepare(`
   738|    INSERT INTO workers (id, name, department_id, machine_id, status, company_id, last_ping)
   739|    VALUES (?, ?, ?, ?, 'active', ?, datetime('now'))
   740|  `).run(id, name, department_id || null, finalMachineId, company_id);
   741|
   742|  const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(id);
   743|  logAudit('register', 'worker', id, null, { name, machine_id: finalMachineId, company_id });
   744|  broadcast({ type: 'worker_registered', worker });
   745|
   746|  res.status(201).json(worker);
   747|});
   748|
   749|app.post('/api/workers/ping/:id', (req, res) => {
   750|  const apiKey = req.headers['x-api-key'];
   751|  if (!apiKey || apiKey !== TASK_QUEUE_API_KEY) {
   752|    return res.status(401).json({ error: 'Invalid API key' });
   753|  }
   754|
   755|  const { status, mood } = req.body;
   756|  const company_id = getCompanyId(req);
   757|  const validStatuses = ['active', 'idle', 'busy', 'slacking', 'working'];
   758|  const newStatus = validStatuses.includes(status) ? status : 'active';
   759|
   760|  const existing = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
   761|  if (!existing) {
   762|    return res.status(404).json({ error: 'Worker not found' });
   763|  }
   764|
   765|  if (mood !== undefined) {
   766|    db.prepare(`
   767|      UPDATE workers SET status = ?, mood = ?, last_ping = datetime('now') WHERE id = ?
   768|    `).run(newStatus, mood, req.params.id);
   769|  } else {
   770|    db.prepare(`
   771|      UPDATE workers SET status = ?, last_ping = datetime('now') WHERE id = ?
   772|    `).run(newStatus, req.params.id);
   773|  }
   774|
   775|  const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
   776|  broadcast({ type: 'worker_ping', worker });
   777|
   778|  res.json(worker);
   779|});
   780|
   781|// POST /api/workers/:id/state — Update a single worker's status (including slacking)
   782|app.post('/api/workers/:id/state', (req, res) => {
   783|  const apiKey = req.headers['x-api-key'];
   784|  if (!apiKey || apiKey !== TASK_QUEUE_API_KEY) {
   785|    return res.status(401).json({ error: 'Invalid API key' });
   786|  }
   787|
   788|  const { status, mood } = req.body;
   789|  const company_id = getCompanyId(req);
   790|  const validStatuses = ['active', 'idle', 'busy', 'slacking', 'working'];
   791|  const newStatus = validStatuses.includes(status) ? status : 'idle';
   792|
   793|  const existing = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
   794|  if (!existing) {
   795|    return res.status(404).json({ error: 'Worker not found' });
   796|  }
   797|
   798|  const oldStatus = existing.status;
   799|
   800|  if (mood !== undefined) {
   801|    db.prepare(`
   802|      UPDATE workers SET status = ?, mood = ?, last_ping = datetime('now') WHERE id = ?
   803|    `).run(newStatus, mood, req.params.id);
   804|  } else {
   805|    db.prepare(`
   806|      UPDATE workers SET status = ?, last_ping = datetime('now') WHERE id = ?
   807|    `).run(newStatus, req.params.id);
   808|  }
   809|
   810|  const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
   811|  broadcast({ type: 'worker_state_change', worker: { id: worker.id, name: worker.name, from_status: oldStatus, to_status: newStatus, mood: worker.mood } });
   812|  broadcast({ type: 'worker_ping', worker });
   813|
   814|  res.json(worker);
   815|});
   816|
   817|// POST /api/workers/batch-status — Batch update multiple workers' statuses
   818|app.post('/api/workers/batch-status', (req, res) => {
   819|  const apiKey = req.headers['x-api-key'];
   820|  if (!apiKey || apiKey !== TASK_QUEUE_API_KEY) {
   821|    return res.status(401).json({ error: 'Invalid API key' });
   822|  }
   823|
   824|  const { updates } = req.body;
   825|  if (!Array.isArray(updates) || updates.length === 0) {
   826|    return res.status(400).json({ error: 'updates array is required and must not be empty' });
   827|  }
   828|
   829|  const validStatuses = ['active', 'idle', 'busy', 'slacking', 'working'];
   830|  const updatedWorkers = [];
   831|
   832|  updates.forEach(u => {
   833|    const { id, status, mood } = u;
   834|    if (!id) return;
   835|    const existing = db.prepare('SELECT * FROM workers WHERE id = ?').get(id);
   836|    if (!existing) return;
   837|
   838|    const newStatus = validStatuses.includes(status) ? status : existing.status;
   839|    if (mood !== undefined) {
   840|      db.prepare(`
   841|        UPDATE workers SET status = ?, mood = ?, last_ping = datetime('now') WHERE id = ?
   842|      `).run(newStatus, mood, id);
   843|    } else {
   844|      db.prepare(`
   845|        UPDATE workers SET status = ?, last_ping = datetime('now') WHERE id = ?
   846|      `).run(newStatus, id);
   847|    }
   848|
   849|    const worker = db.prepare('SELECT id, name, status, mood FROM workers WHERE id = ?').get(id);
   850|    updatedWorkers.push(worker);
   851|  });
   852|
   853|  if (updatedWorkers.length > 0) {
   854|    broadcast({ type: 'worker_batch_update', updates: updatedWorkers });
   855|    // Also send individual worker_ping for each
   856|    updatedWorkers.forEach(w => {
   857|      broadcast({ type: 'worker_ping', worker: w });
   858|    });
   859|  }
   860|
   861|  res.json({ success: true, updated: updatedWorkers.length, workers: updatedWorkers });
   862|});
   863|
   864|app.get('/api/workers/status', (req, res) => {
   865|  const company_id = getCompanyId(req);
   866|  const workers = db.prepare(`
   867|    SELECT w.*, d.name as department_name, d.emoji as department_emoji
   868|    FROM workers w
   869|    LEFT JOIN departments d ON w.department_id = d.id
   870|    WHERE w.company_id = ?
   871|    ORDER BY w.machine_id, w.name
   872|  `).all(company_id);
   873|  res.json(workers);
   874|});
   875|
   876|// ============ AVATAR ENDPOINTS ============
   877|
   878|// POST /api/workers/:id/avatar — upload self-portrait (base64 PNG), x-api-key protected
   879|app.post('/api/workers/:id/avatar', (req, res) => {
   880|  const apiKey = req.headers['x-api-key'];
   881|  if (!apiKey || apiKey !== TASK_QUEUE_API_KEY) {
   882|    return res.status(401).json({ error: 'Invalid API key' });
   883|  }
   884|
   885|  const { avatar } = req.body; // base64 PNG string
   886|  if (!avatar || typeof avatar !== 'string') {
   887|    return res.status(400).json({ error: 'Missing avatar field (base64 PNG string)' });
   888|  }
   889|
   890|  // Validate it's a reasonable PNG base64
   891|  if (!avatar.startsWith('iVBOR') && !avatar.startsWith('/9j/')) {
   892|    return res.status(400).json({ error: 'Avatar must be base64 PNG (starts with iVBOR) or JPEG' });
   893|  }
   894|
   895|  const existing = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
   896|  if (!existing) {
   897|    return res.status(404).json({ error: 'Worker not found' });
   898|  }
   899|
   900|  db.prepare('UPDATE workers SET avatar = ? WHERE id = ?').run(avatar, req.params.id);
   901|  const worker = db.prepare('SELECT id, name, avatar FROM workers WHERE id = ?').get(req.params.id);
   902|  broadcast({ type: 'worker_avatar_update', worker: { id: worker.id, hasAvatar: !!worker.avatar } });
   903|
   904|  console.log(`🎨 Avatar updated for ${worker.name} (${worker.id})`);
   905|  res.json({ success: true, id: worker.id, name: worker.name, avatarLength: avatar.length });
   906|});
   907|
   908|// GET /api/workers/:id/avatar — retrieve avatar image (public, returns raw image)
   909|app.get('/api/workers/:id/avatar', (req, res) => {
   910|  const worker = db.prepare('SELECT id, name, avatar FROM workers WHERE id = ?').get(req.params.id);
   911|  if (!worker || !worker.avatar) {
   912|    return res.status(404).json({ error: 'Avatar not found' });
   913|  }
   914|
   915|  const imgBuffer = Buffer.from(worker.avatar, 'base64');
   916|  const mime = worker.avatar.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
   917|  res.writeHead(200, {
   918|    'Content-Type': mime,
   919|    'Content-Length': imgBuffer.length,
   920|    'Cache-Control': 'public, max-age=3600'
   921|  });
   922|  res.end(imgBuffer);
   923|});
   924|
   925|// ============ API ROUTES (PROTECTED) ============
   926|app.use('/api/', authMiddleware);
   927|
   928|// Departments
   929|app.get('/api/departments', (req, res) => {
   930|  const company_id = getCompanyId(req);
   931|  const depts = db.prepare('SELECT * FROM departments ORDER BY created_at').all();
   932|  const tasks = db.prepare('SELECT department_id, status, COUNT(*) as count FROM tasks GROUP BY department_id, status').all();
   933|  const deptTasks = {};
   934|  tasks.forEach(t => {
   935|    if (!deptTasks[t.department_id]) deptTasks[t.department_id] = {};
   936|    deptTasks[t.department_id][t.status] = t.count;
   937|  });
   938|  res.json(depts.map(d => ({
   939|    ...d,
   940|    task_counts: deptTasks[d.id] || {}
   941|  })));
   942|});
   943|
   944|// POST /api/departments - Create new department
   945|app.post('/api/departments', (req, res) => {
   946|  const { name, emoji, description } = req.body;
   947|  if (!name || !emoji) {
   948|    return res.status(400).json({ error: 'name and emoji are required' });
   949|  }
   950|  const id = 'dept-' + uuidv4().slice(0, 8);
   951|  db.prepare(`INSERT INTO departments (id, name, emoji, description, company_id) VALUES (?, ?, ?, ?, 'company-a')`)
   952|    .run(id, name, emoji, description || '');
   953|  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
   954|  broadcast({ type: 'department_updated', department: dept });
   955|  res.status(201).json(dept);
   956|});
   957|
   958|// PATCH Department (editable names)
   959|app.patch('/api/departments/:id', (req, res) => {
   960|  const company_id = getCompanyId(req);
   961|  const { name, emoji } = req.body;
   962|  const existing = db.prepare('SELECT * FROM departments WHERE id = ? AND company_id = ?').get(req.params.id, company_id);
   963|  if (!existing) return res.status(404).json({ error: 'Department not found' });
   964|
   965|  const updates = [];
   966|  const params = [];
   967|  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
   968|  if (emoji !== undefined) { updates.push('emoji = ?'); params.push(emoji); }
   969|  if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });
   970|
   971|  params.push(req.params.id);
   972|  db.prepare(`UPDATE departments SET ${updates.join(', ')} WHERE id = ?`).run(...params);
   973|
   974|  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
   975|  broadcast({ type: 'department_updated', department: dept });
   976|  res.json(dept);
   977|});
   978|
   979|// DELETE Department
   980|app.delete('/api/departments/:id', (req, res) => {
   981|  const company_id = getCompanyId(req);
   982|  const existing = db.prepare('SELECT * FROM departments WHERE id = ? AND company_id = ?').get(req.params.id, company_id);
   983|  if (!existing) return res.status(404).json({ error: 'Department not found' });
   984|
   985|  // Delete related activity logs first
   986|  db.prepare('DELETE FROM activity_logs WHERE department_id = ?').run(req.params.id);
   987|  // Delete related tasks
   988|  db.prepare('DELETE FROM tasks WHERE department_id = ?').run(req.params.id);
   989|  // Delete the department
   990|  db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
   991|
   992|  logAudit('delete', 'department', req.params.id, req.user.id, { name: existing.name });
   993|  broadcast({ type: 'department_deleted', department_id: req.params.id });
   994|  res.json({ success: true });
   995|});
   996|
   997|// Tasks
   998|app.get('/api/tasks', (req, res) => {
   999|  const company_id = getCompanyId(req);
  1000|  const { department_id, status, priority } = req.query;
  1001|  let query = 'SELECT * FROM tasks WHERE company_id = ?';
  1002|  const params = [company_id];
  1003|  if (department_id) { query += ' AND department_id = ?'; params.push(department_id); }
  1004|  if (status) { query += ' AND status = ?'; params.push(status); }
  1005|  if (priority) { query += ' AND priority = ?'; params.push(priority); }
  1006|  query += ' ORDER BY created_at DESC';
  1007|  res.json(db.prepare(query).all(...params));
  1008|});
  1009|
  1010|app.post('/api/tasks', (req, res) => {
  1011|  const company_id = getCompanyId(req);
  1012|  const { department_id, title, description, priority, assigned_to } = req.body;
  1013|  if (!department_id || !title) {
  1014|    return res.status(400).json({ error: 'department_id and title required' });
  1015|  }
  1016|  const id = uuidv4();
  1017|  db.prepare(`
  1018|    INSERT INTO tasks (id, department_id, title, description, priority, assigned_to, created_by, company_id)
  1019|    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  1020|  `).run(id, department_id, title, description || '', priority || 'normal', assigned_to || null, req.user.id, company_id);
  1021|  
  1022|  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  1023|  logAudit('create', 'task', id, req.user.id, { title, department_id, company_id });
  1024|  // Log to activity_logs
  1025|  logActivity(department_id, 'task_created', `任務「${title}」已建立`, req.user.id, req.user.username, 'task', id, { priority, assigned_to });
  1026|  broadcast({ type: 'task_created', task });
  1027|  res.status(201).json(task);
  1028|});
  1029|
  1030|app.get('/api/tasks/:id', (req, res) => {
  1031|  const company_id = getCompanyId(req);
  1032|  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND company_id = ?').get(req.params.id, company_id);
  1033|  if (!task) return res.status(404).json({ error: 'Task not found' });
  1034|  res.json(task);
  1035|});
  1036|
  1037|app.patch('/api/tasks/:id', (req, res) => {
  1038|  const company_id = getCompanyId(req);
  1039|  const { status, priority, assigned_to, title, description } = req.body;
  1040|  const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND company_id = ?').get(req.params.id, company_id);
  1041|  if (!existing) return res.status(404).json({ error: 'Task not found' });
  1042|
  1043|  const updates = [];
  1044|  const params = [];
  1045|  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  1046|  if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
  1047|  if (assigned_to !== undefined) { updates.push('assigned_to = ?'); params.push(assigned_to); }
  1048|  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  1049|  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  1050|  updates.push("updated_at = datetime('now')");
  1051|  if (status === 'completed') updates.push("completed_at = datetime('now')");
  1052|
  1053|  params.push(req.params.id);
  1054|  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  1055|
  1056|  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  1057|  logAudit('update', 'task', task.id, req.user.id, { changes: req.body });
  1058|
  1059|  // Log status changes to activity_logs
  1060|  if (status !== undefined) {
  1061|    const statusLabels = { pending: '待處理', in_progress: '進行中', completed: '已完成', failed: '失敗' };
  1062|    let actionType = 'status_changed';
  1063|    let desc = `任務「${task.title}」狀態變更為 ${statusLabels[status] || status}`;
  1064|    if (status === 'completed') actionType = 'task_completed';
  1065|    if (status === 'in_progress') actionType = 'task_started';
  1066|    logActivity(task.department_id, actionType, desc, req.user.id, req.user.username, 'task', task.id, { old_status: existing.status, new_status: status });
  1067|  }
  1068|
  1069|  // Log assignment changes
  1070|  if (assigned_to !== undefined && assigned_to !== existing.assigned_to) {
  1071|    const worker = assigned_to ? db.prepare('SELECT name FROM workers WHERE id = ?').get(assigned_to) : null;
  1072|    const workerName = worker ? worker.name : '無';
  1073|    logActivity(task.department_id, 'task_assigned', `任務「${task.title}」已指派給 ${workerName}`, req.user.id, req.user.username, 'task', task.id, { assigned_to });
  1074|  }
  1075|
  1076|  broadcast({ type: 'task_updated', task });
  1077|  res.json(task);
  1078|});
  1079|
  1080|// DELETE task
  1081|app.delete('/api/tasks/:id', (req, res) => {
  1082|  const company_id = getCompanyId(req);
  1083|  const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND company_id = ?').get(req.params.id, company_id);
  1084|  if (!existing) return res.status(404).json({ error: 'Task not found' });
  1085|
  1086|  const deptId = existing.department_id;
  1087|  const taskTitle = existing.title;
  1088|  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  1089|  logAudit('delete', 'task', req.params.id, req.user.id, { title: taskTitle });
  1090|  logActivity(deptId, 'task_deleted', `任務「${taskTitle}」已刪除`, req.user.id, req.user.username, 'task', req.params.id);
  1091|  broadcast({ type: 'task_deleted', task_id: req.params.id });
  1092|  res.json({ success: true });
  1093|});
  1094|
  1095|// ============ ACTIVITY LOGS ============
  1096|function logActivity(departmentId, action, description, userId, userName, entityType, entityId, metadata) {
  1097|  const id = uuidv4();
  1098|  db.prepare(`
  1099|    INSERT INTO activity_logs (id, department_id, action, description, user_id, user_name, entity_type, entity_id, metadata)
  1100|    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  1101|  `).run(id, departmentId, action, description || '', userId || 'system', userName || 'system', entityType || '', entityId || '', metadata ? JSON.stringify(metadata) : null);
  1102|  return id;
  1103|}
  1104|
  1105|// GET activities (by department or all)
  1106|app.get('/api/activities', (req, res) => {
  1107|  const company_id = getCompanyId(req);
  1108|  const { department_id, limit } = req.query;
  1109|  let query = `
  1110|    SELECT a.*, d.name as department_name, d.emoji as department_emoji
  1111|    FROM activity_logs a
  1112|    JOIN departments d ON a.department_id = d.id
  1113|    WHERE d.company_id = ?
  1114|  `;
  1115|  const params = [company_id];
  1116|  if (department_id) {
  1117|    query += ' AND a.department_id = ?';
  1118|    params.push(department_id);
  1119|  }
  1120|  query += ' ORDER BY a.created_at DESC';
  1121|  if (limit) {
  1122|    query += ` LIMIT ${parseInt(limit, 10)}`;
  1123|  } else {
  1124|    query += ' LIMIT 50';
  1125|  }
  1126|  res.json(db.prepare(query).all(...params));
  1127|});
  1128|
  1129|// POST activity (manual log entry)
  1130|app.post('/api/activities', (req, res) => {
  1131|  const company_id = getCompanyId(req);
  1132|  const { department_id, action, description, entity_type, entity_id, metadata } = req.body;
  1133|  if (!department_id || !action) {
  1134|    return res.status(400).json({ error: 'department_id and action are required' });
  1135|  }
  1136|  // Verify department exists
  1137|  const dept = db.prepare('SELECT * FROM departments WHERE id = ? AND company_id = ?').get(department_id, company_id);
  1138|  if (!dept) return res.status(404).json({ error: 'Department not found' });
  1139|
  1140|  const id = logActivity(department_id, action, description || action, req.user?.id, req.user?.username || 'user', entity_type, entity_id, metadata);
  1141|  const activity = db.prepare('SELECT * FROM activity_logs WHERE id = ?').get(id);
  1142|  broadcast({ type: 'activity_logged', activity });
  1143|  res.status(201).json(activity);
  1144|});
  1145|
  1146|// DELETE activity (cleanup)
  1147|app.delete('/api/activities/:id', (req, res) => {
  1148|  const existing = db.prepare('SELECT * FROM activity_logs WHERE id = ?').get(req.params.id);
  1149|  if (!existing) return res.status(404).json({ error: 'Activity not found' });
  1150|  db.prepare('DELETE FROM activity_logs WHERE id = ?').run(req.params.id);
  1151|  res.json({ success: true });
  1152|});
  1153|
  1154|// Workers
  1155|app.get('/api/workers', (req, res) => {
  1156|  const company_id = getCompanyId(req);
  1157|  const workers = db.prepare('SELECT * FROM workers WHERE company_id = ? ORDER BY name').all(company_id);
  1158|  res.json(workers);
  1159|});
  1160|
  1161|// Companies
  1162|app.get('/api/companies', (req, res) => {
  1163|  // Read companies from database
  1164|  const companies = db.prepare('SELECT * FROM companies ORDER BY id').all();
  1165|  res.json({ companies });
  1166|});
  1167|
  1168|// Stats
  1169|app.get('/api/stats', (req, res) => {
  1170|  const company_id = getCompanyId(req);
  1171|  const taskStats = db.prepare(`
  1172|    SELECT status, COUNT(*) as count FROM tasks WHERE company_id = ? GROUP BY status
  1173|  `).all(company_id);
  1174|  const workerStats = db.prepare(`
  1175|    SELECT status, COUNT(*) as count FROM workers WHERE company_id = ? GROUP BY status
  1176|  `).all(company_id);
  1177|  const totalWorkers = db.prepare('SELECT COUNT(*) as count FROM workers WHERE company_id = ?').get(company_id);
  1178|  const recentTasks = db.prepare(`
  1179|    SELECT t.*, d.name as department_name, d.emoji as department_emoji
  1180|    FROM tasks t
  1181|    JOIN departments d ON t.department_id = d.id
  1182|    WHERE t.company_id = ?
  1183|    ORDER BY t.created_at DESC LIMIT 5
  1184|  `).all(company_id);
  1185|  const auditLogs = db.prepare(`
  1186|    SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10
  1187|  `).all();
  1188|
  1189|  res.json({
  1190|    tasks: Object.fromEntries(taskStats.map(s => [s.status, s.count])),
  1191|    workers: Object.fromEntries(workerStats.map(s => [s.status, s.count])),
  1192|    total_workers: totalWorkers.count,
  1193|    recent_tasks: recentTasks,
  1194|    audit_logs: auditLogs
  1195|  });
  1196|});
  1197|
  1198|// Webhook (optional)
  1199|app.post('/api/webhook/test', (req, res) => {
  1200|  const { url, type } = req.body;
  1201|  if (!url) return res.status(400).json({ error: 'URL required' });
  1202|  // Placeholder - implement webhook sending
  1203|  res.json({ message: 'Webhook test sent (mock)', url, type });
  1204|});
  1205|
  1206|// GET messages (chat history)
  1207|app.get('/api/messages', (req, res) => {
  1208|  const company_id = getCompanyId(req);
  1209|  const { room_type, room_id } = req.query;
  1210|  if (!room_type || !room_id) return res.status(400).json({ error: 'room_type and room_id required' });
  1211|
  1212|  const messages = db.prepare(`
  1213|    SELECT * FROM messages
  1214|    WHERE company_id = ? AND room_type = ? AND room_id = ?
  1215|    ORDER BY created_at ASC
  1216|  `).all(company_id, room_type, room_id);
  1217|  res.json(messages);
  1218|});
  1219|
  1220|// POST message (send chat)
  1221|app.post('/api/messages', async (req, res) => {
  1222|  try {
  1223|    const company_id = getCompanyId(req);
  1224|    const { sender_id, sender_type, sender_name, content, room_type, room_id } = req.body;
  1225|    if (!content || !room_type || !room_id) return res.status(400).json({ error: 'content, room_type, room_id required' });
  1226|
  1227|    const id = uuidv4();
  1228|    db.prepare(`
  1229|      INSERT INTO messages (id, company_id, sender_id, sender_type, sender_name, content, room_type, room_id)
  1230|      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  1231|    `).run(id, company_id, sender_id || 'dicoge', sender_type || 'user', sender_name || 'dicoge', content, room_type, room_id);
  1232|
  1233|    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  1234|    broadcast({ type: 'message_sent', message: msg });
  1235|
  1236|    // Try to parse and execute natural language commands
  1237|    const command = parseCommand(content);
  1238|    let botResponse = null;
  1239|
  1240|    console.log('📝 Parsed command:', JSON.stringify(command));
  1241|    if (command) {
  1242|      // Command matched - execute it
  1243|      try {
  1244|        botResponse = await executeCommand(command, company_id, db);
  1245|        console.log('✅ Command response:', botResponse);
  1246|      } catch (cmdErr) {
  1247|        console.error('❌ ExecuteCommand error:', cmdErr.message, cmdErr.stack);
  1248|        botResponse = '❌ 指令執行失敗: ' + cmdErr.message;
  1249|      }
  1250|    } else {
  1251|      // No command matched - broadcast to Hermes clients for AI response
  1252|      if (hermesClients.size > 0) {
  1253|        console.log(`📨 No command matched, broadcasting to ${hermesClients.size} Hermes client(s)`);
  1254|        broadcastToHermes({
  1255|          type: 'user_message',
  1256|          message: msg,
  1257|          room_type: room_type,
  1258|          room_id: room_id
  1259|        });
  1260|        // Don't set botResponse here - Hermes will reply via /api/hermes-reply
  1261|        // Return early so we don't send a pending response
  1262|        return res.status(201).json({ ...msg, pending_hermes: true });
  1263|      } else {
  1264|        // No Hermes clients connected, return a message indicating waiting for Hermes
  1265|        console.log('⚠️ No Hermes clients connected, message queued');
  1266|        return res.status(201).json({ ...msg, waiting_hermes: true });
  1267|      }
  1268|    }
  1269|
  1270|    if (botResponse) {
  1271|      // Send bot response message
  1272|      const botId = 'bot-' + uuidv4().slice(0, 8);
  1273|db.prepare(`
  1274|        INSERT INTO messages (id, company_id, sender_id, sender_type, sender_name, content, room_type, room_id)
  1275|  VALUES (?, ?, 'hermes', 'bot', ?, ?, ?, ?)
  1276|      `).run(botId, company_id, '🤖 Hermes', botResponse, room_type, room_id);
  1277|
  1278|      const botMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(botId);
  1279|      broadcast({ type: 'message_sent', message: botMsg });
  1280|    }
  1281|
  1282|    res.status(201).json(msg);
  1283|  } catch (err) {
  1284|    console.error('POST /api/messages error:', err);
  1285|    res.status(500).json({ error: 'Internal server error' });
  1286|  }
  1287|});
  1288|
  1289|// POST /api/hermes-reply - Hermes replies to a user message
  1290|app.post('/api/hermes-reply', authMiddleware, (req, res) => {
  1291|  const company_id = getCompanyId(req);
  1292|  const { message_id, content, hermes_id } = req.body;
  1293|
  1294|  if (!message_id || !content) {
  1295|    return res.status(400).json({ error: 'message_id and content are required' });
  1296|  }
  1297|
  1298|  // Verify the original message exists and belongs to this company
  1299|  const originalMsg = db.prepare(
  1300|    'SELECT * FROM messages WHERE id = ? AND company_id = ?'
  1301|  ).get(message_id, company_id);
  1302|
  1303|  if (!originalMsg) {
  1304|    return res.status(404).json({ error: 'Original message not found' });
  1305|  }
  1306|
  1307|  // Insert Hermes reply as a bot message
  1308|  const replyId = 'bot-' + uuidv4().slice(0, 8);
  1309|  const senderName = hermes_id ? `🤖 ${hermes_id}` : '🤖 Hermes';
  1310|
  1311|  db.prepare(`
  1312|    INSERT INTO messages (id, company_id, sender_id, sender_type, sender_name, content, room_type, room_id)
  1313|    VALUES (?, ?, ?, 'bot', ?, ?, ?, ?)
  1314|  `).run(replyId, company_id, 'hermes', senderName, content, originalMsg.room_type, originalMsg.room_id);
  1315|
  1316|  const botMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(replyId);
  1317|
  1318|  // Broadcast the reply to all connected clients (including the sender)
  1319|  broadcast({ type: 'message_sent', message: botMsg });
  1320|
  1321|  console.log(`📬 Hermes reply sent: ${replyId} for original message: ${message_id}`);
  1322|
  1323|  res.status(201).json(botMsg);
  1324|});
  1325|
  1326|
  1327|
  1328|
// ============ SWARMCLAW PROXY (via Cloudflare Tunnel) ============
app.post('/api/swarmclaw/proxy', async (req, res) => {
  try {
    const { method, path, headers, body } = req.body;
    if (!path) return res.status(400).json({ error: 'path required' });
    const tunnelUrl = SWARMCLAW_TUNNEL_URL;
    const url = `${tunnelUrl}${path}`;
    const fetchOptions = {
      method: method || 'GET',
      headers: { 'x-api-key': 'huntercard-secret', 'Content-Type': 'application/json', ...(headers || {}) }
    };
    if (body && method !== 'GET') fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, fetchOptions);
    const data = await response.text();
    let parsed; try { parsed = JSON.parse(data); } catch { parsed = data; }
    res.json({ success: response.ok, status: response.status, data: parsed });
  } catch (err) {
    console.error('SwarmClaw proxy error:', err.message);
    res.status(502).json({ success: false, error: err.message });
  }
});

// ============ SWARMCLAW INTEGRATION: UNIFIED API ============
app.get('/api/swarmclaw/agents', (req, res) => {
  const company_id = getCompanyId(req);
  const agents = db.prepare(\`
    SELECT a.*, d.name as department_name, d.emoji as department_emoji,
      (SELECT COUNT(*) FROM agent_tasks WHERE assigned_agent_id = a.id AND status IN ('pending','in_progress')) as active_task_count
    FROM agents a LEFT JOIN departments d ON a.department_id = d.id
    WHERE a.company_id = ? ORDER BY a.parent_id, a.name
  \`).all(company_id);
  const result = agents.map(a => ({
    id: a.id, name: a.name, role: a.role, status: a.status, parent_id: a.parent_id,
    department: a.department_id ? { id: a.department_id, name: a.department_name, emoji: a.department_emoji } : null,
    capabilities: JSON.parse(a.capabilities || '[]'), active_tasks: a.active_task_count, created_at: a.created_at
  }));
  res.json({ success: true, data: result, total: result.length });
});

app.get('/api/swarmclaw/tasks', (req, res) => {
  const company_id = getCompanyId(req);
  const { status, agent_id } = req.query;
  let query = 'SELECT * FROM agent_tasks WHERE company_id = ?'; const params = [company_id];
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (agent_id) { query += ' AND assigned_agent_id = ?'; params.push(agent_id); }
  query += ' ORDER BY created_at DESC LIMIT 50';
  const tasks = db.prepare(query).all(...params);
  const enriched = tasks.map(t => {
    const agent = t.assigned_agent_id ? db.prepare('SELECT id, name, status FROM agents WHERE id = ?').get(t.assigned_agent_id) : null;
    const deps = JSON.parse(t.depends_on || '[]');
    const depTasks = deps.length > 0 ? db.prepare('SELECT id, title, status FROM agent_tasks WHERE id IN (' + deps.map(()=>'?').join(',') + ')').all(...deps) : [];
    const logs = db.prepare('SELECT * FROM agent_task_logs WHERE task_id = ? ORDER BY created_at DESC LIMIT 5').all(t.id);
    return {
      id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority,
      agent: agent ? { id: agent.id, name: agent.name, status: agent.status } : null,
      retry: { count: t.retry_count, max: t.max_retries },
      depends_on: depTasks.map(d => ({ id: d.id, title: d.title, status: d.status })),
      schedule_at: t.schedule_at, logs: logs.map(l => ({ action: l.action, detail: l.detail, created_at: l.created_at })),
      created_at: t.created_at, updated_at: t.updated_at, completed_at: t.completed_at
    };
  });
  const stats = {}; tasks.forEach(t => { stats[t.status] = (stats[t.status] || 0) + 1; });
  res.json({ success: true, data: enriched, stats, total: enriched.length });
});

// ============ SWARMCLAW AGENTS CRUD ============
app.get('/api/agents', (req, res) => {
  const company_id = getCompanyId(req);
  const agents = db.prepare(\`SELECT a.*, d.name as department_name, d.emoji as department_emoji
    FROM agents a LEFT JOIN departments d ON a.department_id = d.id
    WHERE a.company_id = ? ORDER BY a.parent_id, a.name\`).all(company_id);
  res.json(agents);
});

app.post('/api/agents', (req, res) => {
  const company_id = getCompanyId(req);
  const { name, role, parent_id, department_id, capabilities } = req.body;
  if (!name) return res.status(400).json({ error: 'Agent name is required' });
  const id = 'agent-' + uuidv4().slice(0, 8);
  db.prepare('INSERT INTO agents (id, name, role, parent_id, department_id, capabilities, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, name, role || 'worker', parent_id || null, department_id || null, JSON.stringify(capabilities || []), company_id);
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  broadcast({ type: 'agent_created', agent });
  res.status(201).json(agent);
});

app.patch('/api/agents/:id', (req, res) => {
  const company_id = getCompanyId(req);
  const { name, role, status, parent_id, department_id, capabilities } = req.body;
  const existing = db.prepare('SELECT * FROM agents WHERE id = ? AND company_id = ?').get(req.params.id, company_id);
  if (!existing) return res.status(404).json({ error: 'Agent not found' });
  const updates = []; const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (role !== undefined) { updates.push('role = ?'); params.push(role); }
  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  if (parent_id !== undefined) { updates.push('parent_id = ?'); params.push(parent_id); }
  if (department_id !== undefined) { updates.push('department_id = ?'); params.push(department_id); }
  if (capabilities !== undefined) { updates.push('capabilities = ?'); params.push(JSON.stringify(capabilities)); }
  if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });
  params.push(req.params.id);
  db.prepare(\`UPDATE agents SET \${updates.join(', ')} WHERE id = ?\`).run(...params);
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  broadcast({ type: 'agent_updated', agent });
  res.json(agent);
});

// ============ SWARMCLAW AGENT TASKS CRUD ============
app.get('/api/agent-tasks', (req, res) => {
  const company_id = getCompanyId(req);
  const { status, agent_id } = req.query;
  let query = 'SELECT * FROM agent_tasks WHERE company_id = ?'; const params = [company_id];
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (agent_id) { query += ' AND assigned_agent_id = ?'; params.push(agent_id); }
  query += ' ORDER BY created_at DESC';
  const tasks = db.prepare(query).all(...params);
  const enriched = tasks.map(t => {
    const deps = JSON.parse(t.depends_on || '[]');
    const depTasks = deps.length > 0 ? db.prepare('SELECT id, title, status FROM agent_tasks WHERE id IN (' + deps.map(()=>'?').join(',') + ')').all(...deps) : [];
    const agent = t.assigned_agent_id ? db.prepare('SELECT id, name, status FROM agents WHERE id = ?').get(t.assigned_agent_id) : null;
    return { ...t, depends_on_tasks: depTasks, agent };
  });
  res.json(enriched);
});

app.post('/api/agent-tasks', (req, res) => {
  const company_id = getCompanyId(req);
  const { title, description, assigned_agent_id, depends_on, priority, schedule_at, max_retries } = req.body;
  if (!title) return res.status(400).json({ error: 'Task title is required' });
  const id = uuidv4();
  db.prepare('INSERT INTO agent_tasks (id, title, description, assigned_agent_id, depends_on, priority, schedule_at, max_retries, company_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, title, description || '', assigned_agent_id || null, JSON.stringify(depends_on || []), priority || 'normal', schedule_at || null, max_retries || 3, company_id, req.user.id);
  const task = db.prepare('SELECT * FROM agent_tasks WHERE id = ?').get(id);
  logAudit('create', 'agent_task', id, req.user.id, { title });
  broadcast({ type: 'agent_task_created', task });
  res.status(201).json(task);
});

app.patch('/api/agent-tasks/:id', (req, res) => {
  const company_id = getCompanyId(req);
  const { status, assigned_agent_id, priority, title, description } = req.body;
  const existing = db.prepare('SELECT * FROM agent_tasks WHERE id = ? AND company_id = ?').get(req.params.id, company_id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  const updates = []; const params = [];
  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  if (assigned_agent_id !== undefined) { updates.push('assigned_agent_id = ?'); params.push(assigned_agent_id); }
  if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  updates.push("updated_at = datetime('now')");
  if (status === 'completed' || status === 'failed') updates.push("completed_at = datetime('now')");
  params.push(req.params.id);
  db.prepare(\`UPDATE agent_tasks SET \${updates.join(', ')} WHERE id = ?\`).run(...params);
  const task = db.prepare('SELECT * FROM agent_tasks WHERE id = ?').get(req.params.id);
  logAudit('update', 'agent_task', task.id, req.user.id, { changes: req.body });
  broadcast({ type: 'agent_task_updated', task });
  res.json(task);
});

app.post('/api/agent-tasks/:id/retry', (req, res) => {
  const company_id = getCompanyId(req);
  const existing = db.prepare('SELECT * FROM agent_tasks WHERE id = ? AND company_id = ?').get(req.params.id, company_id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  if (existing.status !== 'failed') return res.status(400).json({ error: 'Only failed tasks can be retried' });
  if (existing.retry_count >= existing.max_retries) return res.status(400).json({ error: 'Max retries reached' });
  const newRetryCount = existing.retry_count + 1;
  db.prepare(\`UPDATE agent_tasks SET status = 'pending', retry_count = ?, updated_at = datetime('now') WHERE id = ?\`).run(newRetryCount, req.params.id);
  db.prepare('INSERT INTO agent_task_logs (id, task_id, action, detail) VALUES (?, ?, ?, ?)').run(uuidv4(), req.params.id, 'retry', \`Retry #\${newRetryCount}\`);
  const task = db.prepare('SELECT * FROM agent_tasks WHERE id = ?').get(req.params.id);
  broadcast({ type: 'agent_task_updated', task });
  res.json(task);
});

app.get('/api/agent-tasks/:id/logs', (req, res) => {
  const logs = db.prepare('SELECT * FROM agent_task_logs WHERE task_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(logs);
});

// ============ SWARMCLAW SCHEDULES CRUD ============
app.get('/api/schedules', (req, res) => {
  const company_id = getCompanyId(req);
  const schedules = db.prepare('SELECT s.*, a.name as agent_name FROM schedules s LEFT JOIN agents a ON s.agent_id = a.id WHERE s.company_id = ? ORDER BY s.created_at DESC').all(company_id);
  res.json(schedules);
});

app.post('/api/schedules', (req, res) => {
  const company_id = getCompanyId(req);
  const { name, description, agent_id, task_template, cron_expression } = req.body;
  if (!name || !task_template || !cron_expression) return res.status(400).json({ error: 'name, task_template, and cron_expression required' });
  const id = 'sched-' + uuidv4().slice(0, 8);
  db.prepare('INSERT INTO schedules (id, name, description, agent_id, task_template, cron_expression, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, name, description || '', agent_id || null, task_template, cron_expression, company_id);
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
  broadcast({ type: 'schedule_created', schedule });
  res.status(201).json(schedule);
});

app.patch('/api/schedules/:id', (req, res) => {
  const company_id = getCompanyId(req);
  const { name, description, agent_id, task_template, cron_expression, enabled } = req.body;
  const existing = db.prepare('SELECT * FROM schedules WHERE id = ? AND company_id = ?').get(req.params.id, company_id);
  if (!existing) return res.status(404).json({ error: 'Schedule not found' });
  const updates = []; const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (agent_id !== undefined) { updates.push('agent_id = ?'); params.push(agent_id); }
  if (task_template !== undefined) { updates.push('task_template = ?'); params.push(task_template); }
  if (cron_expression !== undefined) { updates.push('cron_expression = ?'); params.push(cron_expression); }
  if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0); }
  updates.push("updated_at = datetime('now')");
  if (updates.length <= 1) return res.status(400).json({ error: 'No updates provided' });
  params.push(req.params.id);
  db.prepare(\`UPDATE schedules SET \${updates.join(', ')} WHERE id = ?\`).run(...params);
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id);
  broadcast({ type: 'schedule_updated', schedule });
  res.json(schedule);
});

app.delete('/api/schedules/:id', (req, res) => {
  const company_id = getCompanyId(req);
  const existing = db.prepare('SELECT * FROM schedules WHERE id = ? AND company_id = ?').get(req.params.id, company_id);
  if (!existing) return res.status(404).json({ error: 'Schedule not found' });
  db.prepare('DELETE FROM schedules WHERE id = ?').run(req.params.id);
  broadcast({ type: 'schedule_deleted', schedule_id: req.params.id });
  res.json({ message: 'Schedule deleted' });
});

// ============ SERVE FRONTEND ============
  1329|app.get('/', (req, res) => {
  1330|  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  1331|});
  1332|
  1333|// ============ START ============
  1334|async function start() {
  1335|  try {
  1336|    await db.init();
  1337|    initDatabase();
  1338|    server.listen(PORT, () => {
  1339|      console.log(`🎮 Pixel Office running on port ${PORT}`);
  1340|      console.log(`📁 Database: ${DB_PATH}`);
  1341|    });
  1342|  } catch (err) {
  1343|    console.error('Failed to start server:', err);
  1344|    process.exit(1);
  1345|