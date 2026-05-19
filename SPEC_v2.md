# Pixel Office — Enhancement Specification v2.0

## Overview

This document describes Phase 1 enhancements for Pixel Office covering five major features:
1. Custom Company Names
2. Dynamic Worker Count
3. Editable Department Names
4. Chat Window Per Worker/Department
5. Worker Registration Updates

---

## 1. Custom Company Names

### Problem
Company names are hardcoded as "公司 A" / "公司 B" in both backend and frontend, with no flexibility for display names.

### Solution
Store company display names in the database, allowing future user editing (Phase 2).

### Database Changes

#### New `companies` Table
```sql
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '🏢',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

#### Migration (for existing DBs)
```sql
-- Insert default companies if not exist
INSERT OR IGNORE INTO companies (id, name, emoji) VALUES ('company-a', 'MiniPc', '🏢');
INSERT OR IGNORE INTO companies (id, name, emoji) VALUES ('company-b', 'MacBook', '🏢');
```

### API Changes

#### `GET /api/companies`
**Auth:** Protected (JWT required)

**Response:**
```json
{
  "companies": [
    { "id": "company-a", "name": "MiniPc", "emoji": "🏢" },
    { "id": "company-b", "name": "MacBook", "emoji": "🏢" }
  ]
}
```

**Notes:**
- Remove the hardcoded `COMPANIES` array from server.js
- Query the `companies` table instead
- Phase 2 will add `PATCH /api/companies/:id` for renaming

### Frontend Changes

#### Company Select Dropdown
**File:** `public/index.html`

**Before:**
```html
<select id="company-select" class="company-select" onchange="switchCompany(this.value)">
  <option value="company-a">🏢 公司 A</option>
  <option value="company-b">🏢 公司 B</option>
</select>
```

**After:**
```html
<select id="company-select" class="company-select" onchange="switchCompany(this.value)">
  <!-- Populated dynamically from /api/companies -->
</select>
```

**JavaScript Changes:**
```javascript
// Load companies on app initialization
async function loadCompanies() {
  try {
    const data = await API('/api/companies');
    const select = document.getElementById('company-select');
    select.innerHTML = data.companies.map(c => 
      `<option value="${c.id}">${c.emoji} ${c.name}</option>`
    ).join('');
  } catch (e) { console.error('Companies error:', e); }
}

// Call loadCompanies() in showApp() after authentication
```

**Behavior:**
- On company switch, update the select display name
- No changes to `currentCompany` logic (still uses company IDs for routing)

---

## 2. Dynamic Worker Count

### Problem
The "WORKERS" stat card in the dashboard shows `totalWorkers` computed from `stats.workers` but may not reflect actual database counts if workers aren't properly registered.

### Solution
Ensure the stats API correctly counts workers from the `workers` table per company, and the frontend uses the actual count.

### Backend Changes

#### `GET /api/stats` Enhancement
**File:** `src/server.js`

**Current behavior:**
```javascript
const workerStats = db.prepare(`
  SELECT status, COUNT(*) as count FROM workers WHERE company_id = ? GROUP BY status
`).all(company_id);
```

**Add total worker count:**
```javascript
// Add total workers count (all statuses combined)
const totalWorkersResult = db.prepare(`
  SELECT COUNT(*) as total FROM workers WHERE company_id = ?
`).get(company_id);

// Return total_workers in stats response
res.json({
  tasks: Object.fromEntries(taskStats.map(s => [s.status, s.count])),
  workers: Object.fromEntries(workerStats.map(s => [s.status, s.count])),
  total_workers: totalWorkersResult.total,
  recent_tasks: recentTasks,
  audit_logs: auditLogs
});
```

### Frontend Changes

#### Dashboard Stats Display
**File:** `public/index.html`

**Current (lines 977-979):**
```javascript
const totalWorkers = (stats.workers.active || 0) + (stats.workers.idle || 0) + 
                      (stats.workers.offline || 0);
```

**After:**
```javascript
// Use total_workers from API if available, fallback to sum
const totalWorkers = stats.total_workers !== undefined 
  ? stats.total_workers 
  : ((stats.workers.active || 0) + (stats.workers.idle || 0) + (stats.workers.offline || 0));
```

---

## 3. Editable Department Names

### Problem
Department names are hardcoded during seeding (e.g., "🎮 遊戲開發部-A") and cannot be updated through the UI.

### Solution
Add a PATCH endpoint to update department names, and add an edit button to the department card in the frontend.

### Database Changes

#### Department Table (already exists)
```sql
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  description TEXT,
  company_id TEXT DEFAULT 'company-a',
  created_at TEXT DEFAULT (datetime('now'))
);
```
The `name` field already exists and is editable.

### API Changes

#### `PATCH /api/departments/:id`
**Auth:** Protected (JWT required)
**Content-Type:** `application/json`

**Request Body:**
```json
{
  "name": "新部門名稱",
  "emoji": "🎯"
}
```

**Response (200 OK):**
```json
{
  "id": "dept-gaming-a",
  "name": "新部門名稱",
  "emoji": "🎯",
  "description": "DungeonD3（Codex/OpenCode/OpenClaw）",
  "company_id": "company-a",
  "created_at": "2026-01-15 10:00:00"
}
```

**Error Responses:**
- `400 Bad Request` — Missing or invalid name
- `404 Not Found` — Department not found or doesn't belong to company
- `403 Forbidden` — Attempting to modify department of other company

**Implementation:**
```javascript
app.patch('/api/departments/:id', (req, res) => {
  const company_id = getCompanyId(req);
  const { name, emoji } = req.body;
  
  const existing = db.prepare('SELECT * FROM departments WHERE id = ? AND company_id = ?')
    .get(req.params.id, company_id);
  
  if (!existing) {
    return res.status(404).json({ error: 'Department not found' });
  }
  
  const updates = [];
  const params = [];
  
  if (name !== undefined) {
    if (name.length < 1 || name.length > 50) {
      return res.status(400).json({ error: 'Name must be 1-50 characters' });
    }
    updates.push('name = ?');
    params.push(name);
  }
  
  if (emoji !== undefined) {
    updates.push('emoji = ?');
    params.push(emoji);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  params.push(req.params.id);
  db.prepare(`UPDATE departments SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  
  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  logAudit('update', 'department', dept.id, req.user.id, { name, emoji });
  broadcast({ type: 'department_updated', department: dept });
  
  res.json(dept);
});
```

### Frontend Changes

#### Department Card with Edit Button
**File:** `public/index.html`

**New CSS:**
```css
/* Department edit button */
.dept-edit-btn {
  margin-left: auto;
  background: var(--c-purple);
  border: 2px solid var(--c-white);
  color: var(--c-white);
  padding: 4px 8px;
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  cursor: pointer;
}

.dept-edit-btn:hover {
  background: var(--c-pink);
}
```

**Modified department card HTML (in loadDepartments):**
```javascript
// Each dept-card should have:
<div class="dept-card">
  <div class="dept-header">
    <span class="dept-emoji">${d.emoji}</span>
    <span class="dept-name">${d.name}</span>
    <button class="dept-edit-btn" onclick="openDeptEditModal('${d.id}')">✎</button>
  </div>
  <!-- ... rest of card -->
</div>
```

**Department Edit Modal:**
```html
<div class="modal" id="dept-edit-modal">
  <div class="modal-content">
    <button class="modal-close" onclick="closeDeptEditModal()">X</button>
    <h3 class="modal-title">✎ EDIT DEPARTMENT</h3>
    <form id="dept-edit-form">
      <input type="hidden" id="dept-edit-id">
      <div class="form-group">
        <label>NAME</label>
        <input type="text" id="dept-edit-name" required maxlength="50">
      </div>
      <div class="form-group">
        <label>EMOJI</label>
        <input type="text" id="dept-edit-emoji" maxlength="10" placeholder="🎮">
      </div>
      <button type="submit" class="pixel-btn">✓ SAVE</button>
    </form>
  </div>
</div>
```

**JavaScript:**
```javascript
function openDeptEditModal(id) {
  const dept = departments.find(d => d.id === id);
  if (!dept) return;
  
  document.getElementById('dept-edit-id').value = id;
  document.getElementById('dept-edit-name').value = dept.name;
  document.getElementById('dept-edit-emoji').value = dept.emoji;
  document.getElementById('dept-edit-modal').classList.add('active');
}

function closeDeptEditModal() {
  document.getElementById('dept-edit-modal').classList.remove('active');
}

document.getElementById('dept-edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('dept-edit-id').value;
  const data = {
    name: document.getElementById('dept-edit-name').value,
    emoji: document.getElementById('dept-edit-emoji').value
  };
  
  try {
    await API(`/api/departments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    closeDeptEditModal();
    loadDepartments();
  } catch (err) {
    alert('Update failed: ' + err.message);
  }
});
```

**WebSocket Broadcast Handling:**
```javascript
// Add to handleBroadcast():
if (data.type === 'department_updated') loadDepartments();
```

---

## 4. Chat Window Per Worker/Department

### Problem
No cross-company chat functionality exists. Users need to communicate with workers and across departments.

### Solution
Implement a messages table and chat UI that allows users to chat with:
- Individual workers (room_type: 'worker', room_id: worker_id)
- Departments (room_type: 'department', room_id: department_id)

### Database Changes

#### New `messages` Table
```sql
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_type TEXT NOT NULL,      -- 'user' or 'worker'
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  room_type TEXT NOT NULL,        -- 'department' or 'worker'
  room_id TEXT NOT NULL,          -- department_id or worker_id
  created_at TEXT DEFAULT (datetime('now'))
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(company_id, room_type, room_id);
```

### API Changes

#### `GET /api/messages`
**Auth:** Protected (JWT required)
**Query Parameters:**
- `room_type` (required): 'worker' | 'department'
- `room_id` (required): The ID of the worker or department

**Request Example:**
```
GET /api/messages?room_type=worker&room_id=worker-1
X-Company-ID: company-a
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "messages": [
    {
      "id": "msg-uuid-1",
      "company_id": "company-a",
      "sender_id": "dicoge",
      "sender_type": "user",
      "sender_name": "dicoge",
      "content": "Hello worker!",
      "room_type": "worker",
      "room_id": "worker-1",
      "created_at": "2026-01-15 10:30:00"
    },
    {
      "id": "msg-uuid-2",
      "company_id": "company-a",
      "sender_id": "worker-1",
      "sender_type": "worker",
      "sender_name": "Pixel Worker α",
      "content": "Hi there!",
      "room_type": "worker",
      "room_id": "worker-1",
      "created_at": "2026-01-15 10:31:00"
    }
  ]
}
```

#### `POST /api/messages`
**Auth:** Protected (JWT required)
**Content-Type:** `application/json`

**Request Body:**
```json
{
  "room_type": "worker",
  "room_id": "worker-1",
  "content": "Hello!"
}
```

**Response (201 Created):**
```json
{
  "id": "msg-uuid-3",
  "company_id": "company-a",
  "sender_id": "dicoge",
  "sender_type": "user",
  "sender_name": "dicoge",
  "content": "Hello!",
  "room_type": "worker",
  "room_id": "worker-1",
  "created_at": "2026-01-15 10:32:00"
}
```

**Error Responses:**
- `400 Bad Request` — Missing room_type, room_id, or content
- `400 Bad Request` — Invalid room_type
- `404 Not Found` — room_id doesn't exist in the company

**Implementation in server.js:**
```javascript
// Messages endpoints (after auth middleware)
// GET /api/messages
app.get('/api/messages', (req, res) => {
  const company_id = getCompanyId(req);
  const { room_type, room_id } = req.query;
  
  if (!room_type || !room_id) {
    return res.status(400).json({ error: 'room_type and room_id are required' });
  }
  
  if (!['worker', 'department'].includes(room_type)) {
    return res.status(400).json({ error: 'Invalid room_type' });
  }
  
  // Verify room exists in company
  if (room_type === 'worker') {
    const worker = db.prepare('SELECT id FROM workers WHERE id = ? AND company_id = ?')
      .get(room_id, company_id);
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found in this company' });
    }
  } else if (room_type === 'department') {
    const dept = db.prepare('SELECT id FROM departments WHERE id = ? AND company_id = ?')
      .get(room_id, company_id);
    if (!dept) {
      return res.status(404).json({ error: 'Department not found in this company' });
    }
  }
  
  const messages = db.prepare(`
    SELECT * FROM messages 
    WHERE company_id = ? AND room_type = ? AND room_id = ?
    ORDER BY created_at ASC
  `).all(company_id, room_type, room_id);
  
  res.json({ messages });
});

// POST /api/messages
app.post('/api/messages', (req, res) => {
  const company_id = getCompanyId(req);
  const { room_type, room_id, content } = req.body;
  
  if (!room_type || !room_id || !content) {
    return res.status(400).json({ error: 'room_type, room_id, and content are required' });
  }
  
  if (!['worker', 'department'].includes(room_type)) {
    return res.status(400).json({ error: 'Invalid room_type' });
  }
  
  if (content.length > 2000) {
    return res.status(400).json({ error: 'Content must be 2000 characters or less' });
  }
  
  // Verify room exists in company
  if (room_type === 'worker') {
    const worker = db.prepare('SELECT id, name FROM workers WHERE id = ? AND company_id = ?')
      .get(room_id, company_id);
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found in this company' });
    }
  } else if (room_type === 'department') {
    const dept = db.prepare('SELECT id, name FROM departments WHERE id = ? AND company_id = ?')
      .get(room_id, company_id);
    if (!dept) {
      return res.status(404).json({ error: 'Department not found in this company' });
    }
  }
  
  const id = uuidv4();
  const sender_id = req.user.id;
  const sender_type = 'user';
  const sender_name = req.user.username;
  
  db.prepare(`
    INSERT INTO messages (id, company_id, sender_id, sender_type, sender_name, content, room_type, room_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, company_id, sender_id, sender_type, sender_name, content, room_type, room_id);
  
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  
  // Broadcast new message to all clients in same company
  broadcast({ 
    type: 'new_message', 
    message,
    company_id
  });
  
  res.status(201).json(message);
});
```

### Frontend Changes

#### Chat Panel Overlay
**File:** `public/index.html`

**New CSS:**
```css
/* Chat Panel */
.chat-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 360px;
  height: 100vh;
  background: var(--c-darkblue);
  border-left: 4px solid var(--c-purple);
  box-shadow: -8px 0 20px rgba(0,0,0,0.5);
  display: none;
  flex-direction: column;
  z-index: 200;
}

.chat-panel.active {
  display: flex;
}

.chat-header {
  background: var(--c-purple);
  padding: 15px;
  border-bottom: 3px solid var(--c-white);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chat-title {
  font-size: 10px;
  color: var(--c-yellow);
}

.chat-close {
  background: var(--c-red);
  border: 2px solid var(--c-white);
  color: var(--c-white);
  width: 24px;
  height: 24px;
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  cursor: pointer;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chat-bubble {
  max-width: 80%;
  padding: 10px 12px;
  font-size: 8px;
  line-height: 1.6;
  word-wrap: break-word;
}

.chat-bubble.user {
  background: var(--c-green);
  border: 2px solid var(--c-lime);
  align-self: flex-end;
  color: var(--c-white);
}

.chat-bubble.worker {
  background: var(--c-darkgray);
  border: 2px solid var(--c-gray);
  align-self: flex-start;
  color: var(--c-white);
}

.chat-sender {
  font-size: 6px;
  color: var(--c-silver);
  margin-bottom: 4px;
}

.chat-time {
  font-size: 5px;
  color: var(--c-gray);
  margin-top: 4px;
  text-align: right;
}

.chat-input-area {
  padding: 15px;
  border-top: 3px solid var(--c-purple);
  display: flex;
  gap: 10px;
}

.chat-input {
  flex: 1;
  padding: 10px;
  background: var(--c-black);
  border: 3px solid var(--c-gray);
  color: var(--c-white);
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
}

.chat-input:focus {
  border-color: var(--c-yellow);
}

.chat-send-btn {
  background: var(--c-green);
  border: 3px solid var(--c-white);
  color: var(--c-white);
  padding: 10px 15px;
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  cursor: pointer;
}

.chat-send-btn:hover {
  background: var(--c-lime);
}

/* Clickable worker/dept cards */
.worker-card, .dept-card {
  cursor: pointer;
}

.worker-card:hover, .dept-card:hover {
  border-color: var(--c-yellow);
}
```

**HTML Addition (before closing </div> of #app or after footer):**
```html
<!-- Chat Panel -->
<div class="chat-panel" id="chat-panel">
  <div class="chat-header">
    <span class="chat-title" id="chat-title">💬 CHAT</span>
    <button class="chat-close" onclick="closeChat()">X</button>
  </div>
  <div class="chat-messages" id="chat-messages"></div>
  <div class="chat-input-area">
    <input type="text" class="chat-input" id="chat-input" placeholder="TYPE MESSAGE..." maxlength="2000">
    <button class="chat-send-btn" onclick="sendChatMessage()">➤</button>
  </div>
</div>
```

**JavaScript State Additions:**
```javascript
let currentChatRoom = null;  // { type: 'worker'|'department', id: string }
let chatRefreshInterval = null;
```

**Open Chat Functions:**
```javascript
function openWorkerChat(workerId, workerName) {
  currentChatRoom = { type: 'worker', id: workerId };
  document.getElementById('chat-title').textContent = `💬 ${workerName}`;
  document.getElementById('chat-panel').classList.add('active');
  loadChatMessages();
  startChatRefresh();
}

function openDepartmentChat(deptId, deptName, deptEmoji) {
  currentChatRoom = { type: 'department', id: deptId };
  document.getElementById('chat-title').textContent = `${deptEmoji} ${deptName}`;
  document.getElementById('chat-panel').classList.add('active');
  loadChatMessages();
  startChatRefresh();
}

function closeChat() {
  document.getElementById('chat-panel').classList.remove('active');
  currentChatRoom = null;
  stopChatRefresh();
}

async function loadChatMessages() {
  if (!currentChatRoom) return;
  
  try {
    const url = `/api/messages?room_type=${currentChatRoom.type}&room_id=${currentChatRoom.id}`;
    const data = await API(url);
    renderChatMessages(data.messages);
  } catch (e) { console.error('Chat load error:', e); }
}

function renderChatMessages(messages) {
  const container = document.getElementById('chat-messages');
  
  if (messages.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--c-gray);font-size:8px;padding:20px;">NO MESSAGES YET</div>';
    return;
  }
  
  container.innerHTML = messages.map(m => {
    const isUser = m.sender_type === 'user';
    return `
      <div class="chat-bubble ${isUser ? 'user' : 'worker'}">
        ${!isUser ? `<div class="chat-sender">${m.sender_name}</div>` : ''}
        <div>${escapeHtml(m.content)}</div>
        <div class="chat-time">${formatChatTime(m.created_at)}</div>
      </div>
    `;
  }).join('');
  
  // Auto-scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatChatTime(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}

async function sendChatMessage() {
  if (!currentChatRoom) return;
  
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  
  if (!content) return;
  
  try {
    await API('/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        room_type: currentChatRoom.type,
        room_id: currentChatRoom.id,
        content: content
      })
    });
    
    input.value = '';
    loadChatMessages();
  } catch (e) {
    alert('Send failed: ' + e.message);
  }
}

// Enter key to send
document.getElementById('chat-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendChatMessage();
  }
});

// Chat auto-refresh every 3 seconds
function startChatRefresh() {
  stopChatRefresh();
  chatRefreshInterval = setInterval(() => {
    if (document.getElementById('chat-panel').classList.contains('active')) {
      loadChatMessages();
    }
  }, 3000);
}

function stopChatRefresh() {
  if (chatRefreshInterval) {
    clearInterval(chatRefreshInterval);
    chatRefreshInterval = null;
  }
}
```

**Connect Worker/Department Cards to Chat:**
```javascript
// Modify renderWorkerCard to include onclick
function renderWorkerCard(w) {
  const status = getWorkerStatus(w);
  const statusIcon = status === 'active' ? '🟢' : status === 'stale' ? '🟡' : '⚫';
  const deptInfo = w.department_name ? `${w.department_emoji || ''} ${w.department_name}` : '—';
  return `
    <div class="worker-card worker-${status}" onclick="openWorkerChat('${w.id}', '${w.name}')">
      <div class="worker-name">${w.machine_id ? `[${w.machine_id}] ` : ''}${w.name}</div>
      <div class="worker-status worker-${w.status || 'idle'}">
        <span class="dot"></span>${w.status.toUpperCase() || 'IDLE'}
      </div>
      <div style="font-size:7px;color:var(--c-silver);margin-top:8px;">
        <div>⏱ ${formatLastPing(w.last_ping)}</div>
        <div>🏢 ${deptInfo}</div>
      </div>
    </div>
  `;
}

// Modify department card in loadDepartments to include onclick and chat button
// Update the dept-card to have a click handler:
document.getElementById('dept-grid').innerHTML = departments.map(d => `
  <div class="dept-card" onclick="openDepartmentChat('${d.id}', '${d.name}', '${d.emoji}')">
    <div class="dept-header">
      <span class="dept-emoji">${d.emoji}</span>
      <span class="dept-name">${d.name}</span>
      <button class="dept-edit-btn" onclick="event.stopPropagation(); openDeptEditModal('${d.id}')">✎</button>
    </div>
    <div class="dept-desc">${d.description}</div>
    <div class="dept-stats">
      <div class="dept-stat">📋 TOTAL: <span>${Object.values(d.task_counts).reduce((a,b)=>a+b,0)}</span></div>
      <div class="dept-stat">⏳ PENDING: <span>${d.task_counts.pending||0}</span></div>
      <div class="dept-stat">🔄 ACTIVE: <span>${d.task_counts.in_progress||0}</span></div>
      <div class="dept-stat">✅ DONE: <span>${d.task_counts.completed||0}</span></div>
    </div>
    <div style="margin-top:10px;text-align:right;">
      <button class="pixel-btn" style="padding:6px 10px;font-size:6px;" onclick="event.stopPropagation(); openDepartmentChat('${d.id}', '${d.name}', '${d.emoji}')">💬 CHAT</button>
    </div>
  </div>
`).join('');
```

**WebSocket Message Handling:**
```javascript
// In handleBroadcast():
if (data.type === 'new_message' && data.company_id === currentCompany) {
  if (currentChatRoom && 
      currentChatRoom.type === data.message.room_type && 
      currentChatRoom.id === data.message.room_id) {
    loadChatMessages();
  }
}
```

---

## 5. Worker Registration Updates

### Problem
Workers from MiniPc (company-a) and MacBook (company-b) need to register with machine_id containing their source machine name for proper identification.

### Solution
- Update seed data to include machine_id with company identifier
- Ensure worker registration derives machine_id from company context

### Database Changes

#### Update Seed Data
**File:** `src/server.js`

**Before:**
```javascript
// Company A workers
workerStmt.run('worker-1', 'Pixel Worker α', 'active', 'dept-gaming-a', 'company-a');
workerStmt.run('worker-2', 'Pixel Worker β', 'idle', 'dept-investment-a', 'company-a');
// Company B workers
workerStmt.run('worker-3', 'Pixel Worker γ', 'active', 'dept-gaming-b', 'company-b');
workerStmt.run('worker-4', 'Pixel Worker δ', 'idle', 'dept-investment-b', 'company-b');
```

**After:**
```javascript
// Company A (MiniPc) workers with machine_id
workerStmt.run('worker-1', 'Pixel Worker α', 'active', 'dept-gaming-a', 'company-a');
db.prepare('UPDATE workers SET machine_id = ? WHERE id = ?').run('MiniPc-001', 'worker-1');

workerStmt.run('worker-2', 'Pixel Worker β', 'idle', 'dept-investment-a', 'company-a');
db.prepare('UPDATE workers SET machine_id = ? WHERE id = ?').run('MiniPc-002', 'worker-2');

// Company B (MacBook) workers with machine_id
workerStmt.run('worker-3', 'Pixel Worker γ', 'active', 'dept-gaming-b', 'company-b');
db.prepare('UPDATE workers SET machine_id = ? WHERE id = ?').run('MacBook-001', 'worker-3');

workerStmt.run('worker-4', 'Pixel Worker δ', 'idle', 'dept-investment-b', 'company-b');
db.prepare('UPDATE workers SET machine_id = ? WHERE id = ?').run('MacBook-002', 'worker-4');
```

### API Changes (Worker Registration)

#### `POST /api/workers/register`
**File:** `src/server.js`

**Current behavior derives machine_id from provided value or generates one:**
```javascript
const finalMachineId = machine_id || `machine-${id.slice(0, 8)}`;
```

**Enhanced behavior - prepend company identifier if machine_id doesn't contain it:**
```javascript
// Get company name for machine_id prefix
const companyName = company_id === 'company-a' ? 'MiniPc' : 'MacBook';

// If machine_id is provided but doesn't contain company identifier, prepend it
let finalMachineId;
if (machine_id) {
  // Check if machine_id already contains company identifier
  const companyPrefix = companyName.toLowerCase();
  if (machine_id.toLowerCase().includes(companyPrefix)) {
    finalMachineId = machine_id;  // Already has company identifier
  } else {
    finalMachineId = `${companyName}-${machine_id}`;  // Prepend company identifier
  }
} else {
  // Generate with company identifier
  finalMachineId = `${companyName}-${id.slice(0, 8)}`;
}
```

---

## Summary of File Changes

| File | Changes |
|------|---------|
| `src/server.js` | 1. Add `companies` table and migration<br>2. Remove hardcoded `COMPANIES` array<br>3. Update `/api/companies` to query DB<br>4. Add `total_workers` to `/api/stats`<br>5. Add `PATCH /api/departments/:id`<br>6. Add `messages` table<br>7. Add `GET /api/messages` and `POST /api/messages`<br>8. Update worker seed data with machine_ids<br>9. Enhance worker registration with company-aware machine_id |
| `public/index.html` | 1. Load companies dynamically in select<br>2. Use `stats.total_workers` in dashboard<br>3. Add department edit modal and functionality<br>4. Add chat panel CSS and HTML<br>5. Add click handlers on worker/dept cards to open chat<br>6. Implement chat messaging functions with 3s auto-refresh<br>7. Add WebSocket handling for new messages |

---

## Implementation Order

1. **Database migrations** (companies table, messages table)
2. **Backend API changes** (all endpoints)
3. **Frontend API integration** (loadCompanies, stats.total_workers)
4. **Department editing** (modal + PATCH)
5. **Chat system** (panel, messages, auto-refresh)
6. **Worker registration enhancement**

---

## Testing Checklist

- [ ] Company names display correctly in switcher
- [ ] Worker count matches actual DB records
- [ ] Department names can be edited and persist
- [ ] Chat opens when clicking worker/department cards
- [ ] Messages persist and reload correctly
- [ ] Chat auto-refreshes every 3 seconds
- [ ] Worker registration generates correct machine_id with company prefix
- [ ] WebSocket broadcasts new messages to chat panel
- [ ] All data correctly scoped by company_id