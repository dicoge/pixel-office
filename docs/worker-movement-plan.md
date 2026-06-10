# Pixel Office — Worker Dynamic Movement & Real-Time Status Plan

## 1. 現狀分析 Summary

| 層面 | 已有 | 缺少 |
|------|------|------|
| **前端動畫** | Phaser 3 canvas, guest_anim_N spritesheets (6 幀 idle), 線性移動 (1.2px/frame) | 無 walk 動畫, 無路徑系統, 無方向性 |
| **狀態管理** | 6 種前端狀態映射 + mood bubble | 缺少「slacking」狀態, 無狀態機, 無行為序列表 |
| **後端 API** | GET /api/workers, POST /api/workers/ping/:id | 缺少專用 status/batch 更新端點 |
| **即時通訊** | WebSocket 已存在! `worker_ping` broadcast, 前端已接收 | 缺少 movement 事件通道, 無 movement broadcast |
| **資料庫** | workers 表有 status, mood, avatar, last_ping | 需新增 position_x, position_y, target_x, target_y, activity |

---

## 2. Worker 狀態定義（擴充）

### 2.1 狀態機 (Frontend State Machine)

```
                    ┌──────────┐
         ┌─────────>│  WORKING │<──────────┐
         │          │  🟢 工作  │           │
         │          └────┬─────┘           │
         │               │                 │
    ┌────┴────┐    ┌────▼─────┐     ┌─────┴─────┐
    │  IDLE   │    │  BUSY    │     │  SLACKING  │
    │  🟡 清閒 │<──>│  🔴 忙碌  │     │  🐟 摸魚   │
    └────┬────┘    └────┬─────┘     └─────┬─────┘
         │               │                 │
         │          ┌────▼─────┐          │
         └──────────│  ERROR   │<─────────┘
                    │  ❌ 出錯  │
                    └──────────┘
```

**狀態轉換規則：**
- WORKING → IDLE: 任務完成
- WORKING → BUSY: 接到高優任務
- IDLE → WORKING: 被指派任務
- IDLE → SLACKING: 閒置過久 (>60s)，自動觸發
- SLACKING → WORKING: 被指派任務 / 上級提醒
- BUSY → WORKING: 忙碌任務完成後
- BUSY → ERROR: 任務執行失敗
- ERROR → IDLE: 錯誤被處理

### 2.2 四個核心狀態顏色與標籤

```javascript
const WORKER_STATUS = {
  working:  { icon: '🟢', label: '工作中', color: '#2ecc71' },
  idle:     { icon: '🟡', label: '清閒中', color: '#f1c40f' },
  busy:     { icon: '🔴', label: '忙碌中', color: '#e74c3c' },
  slacking: { icon: '🐟', label: '摸魚中', color: '#9b59b6' }
};
```

---

## 3. 前端 Phaser 3 改造方案

### 3.1 Walk Animation System（新增 walk.js）

**Spritesheet 需求：** 每個 agent 需要 walk 動畫 sprite sheet
- 4 方向 × 4 幀 = 16 frames per agent
- Frame size: 32×32 (同 idle spritesheet)
- 檔案命名: `guest_walk_N.webp` (N = 1..7)

**動畫註冊（create 階段）：**
```javascript
// 4 方向 walk animations per guest
['down', 'left', 'right', 'up'].forEach((dir, di) => {
  if (!this.anims.exists(`guest_walk_${i}_${dir}`)) {
    this.anims.create({
      key: `guest_walk_${i}_${dir}`,
      frames: this.anims.generateFrameNumbers(`guest_walk_${i}`, {
        start: di * 4, end: di * 4 + 3
      }),
      frameRate: 8, repeat: -1
    });
  }
});
```

### 3.2 Waypoint/Pathfinding System（新增 pathfinding.js）

**導航圖 (NavGraph) — 辦公室可走區域：**
```javascript
const NAV_POINTS = {
  // === 辦公桌區域 ===
  desk_col1_top:    { x: 160, y: 280, label: 'Gemini 桌', connections: ['hall_left', 'cross_mid'] },
  desk_col1_mid:    { x: 160, y: 410, label: 'Manus 桌', connections: ['hall_left', 'cross_mid'] },
  desk_col1_bot:    { x: 160, y: 540, label: 'Codex 桌', connections: ['hall_left', 'cross_bot'] },
  desk_col2_top:    { x: 270, y: 280, label: 'Claude 桌', connections: ['hall_mid', 'cross_mid'] },
  desk_col2_mid:    { x: 270, y: 410, label: 'OpenCode 桌', connections: ['hall_mid', 'cross_mid'] },
  desk_col2_bot:    { x: 270, y: 540, label: 'OpenCode 桌', connections: ['hall_mid', 'cross_bot'] },
  
  // === 公共區域 ===
  center_desk:      { x: 490, y: 360, label: '中央桌', connections: ['cross_mid', 'hall_mid', 'hall_left'] },
  coffee_machine:   { x: 235, y: 190, label: '咖啡機', connections: ['hall_left'] },
  bookshelf:        { x: 120, y: 250, label: '書架', connections: ['hall_left'] },
  sofa:             { x: 1092, y: 270, label: '沙發', connections: ['hall_right'] },
  plant:            { x: 1090, y: 200, label: '盆栽', connections: ['hall_right'] },
  lounge:           { x: 1100, y: 500, label: '休息區', connections: ['hall_right', 'cross_bot'] },
  
  // === 走廊交叉點 ===
  hall_left:        { x: 120, y: 360, label: '左走廊', connections: ['coffee_machine', 'desk_col1_top', 'desk_col1_mid', 'desk_col1_bot', 'cross_mid'] },
  hall_mid:         { x: 300, y: 360, label: '中走廊', connections: ['desk_col2_top', 'desk_col2_mid', 'desk_col2_bot', 'cross_mid', 'cross_bot'] },
  hall_right:       { x: 1000, y: 360, label: '右走廊', connections: ['sofa', 'plant', 'lounge', 'cross_mid', 'cross_bot'] },
  cross_mid:        { x: 400, y: 360, label: '十字中', connections: ['hall_left', 'hall_mid', 'hall_right', 'center_desk'] },
  cross_bot:        { x: 400, y: 500, label: '十字下', connections: ['hall_mid', 'hall_right', 'lounge', 'desk_col1_bot', 'desk_col2_bot'] }
};
```

**A* Pathfinding：**
```javascript
function findPath(fromId, toId) {
  // Standard A* on NAV_POINTS graph
  // Returns array of waypoint IDs: ['desk_col1_top', 'hall_left', 'coffee_machine']
}
```

### 3.3 Movement Engine（改進 update()）

**每個 worker 的移動狀態：**
```javascript
// 新結構 — 取代現有 memberTargets
window.memberMovement[m.id] = {
  path: [],           // waypoint IDs to traverse
  currentTarget: null, // { x, y }
  speed: 1.2,          // px per frame
  state: 'idle',       // 'idle' | 'walking' | 'arriving'
  facing: 'down',      // 'down' | 'left' | 'right' | 'up'
  arrived: false
};
```

**update() 改進邏輯：**
```javascript
function updateWorkerMovement(m, time) {
  const sp = window.memberSprites[m.id];
  const mv = window.memberMovement[m.id];
  if (!sp || !mv || mv.state === 'idle') return;

  if (mv.path.length > 0) {
    // Pop next waypoint
    const nextId = mv.path[0];
    const nextPt = NAV_POINTS[nextId];
    if (!nextPt) { mv.path.shift(); return; }
    
    // Move toward waypoint
    const dx = nextPt.x - sp.x;
    const dy = nextPt.y - sp.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    if (dist < 3) {
      mv.path.shift(); // reached waypoint
      if (mv.path.length === 0) {
        mv.state = 'arriving';
        // Play idle animation
        playIdleAnim(m.id);
      }
    } else {
      mv.state = 'walking';
      // Determine facing direction
      mv.facing = getFacing(dx, dy);
      // Play walk animation in correct direction
      playWalkAnim(m.id, mv.facing);
      // Move
      sp.x += (dx/dist) * mv.speed;
      sp.y += (dy/dist) * mv.speed;
    }
  }
}
```

### 3.4 Autonomous Behavior Engine（新增 behaviors.js）

**每個 worker 的行為序列（狀態機）：**
```javascript
// 當 worker 處於 idle 或 slacking 時，自動觸發行為
const BEHAVIORS = {
  hermes: {
    idle: [
      { action: 'wander', area: 'center_desk', duration: 5000 },
      { action: 'check_coffee', area: 'coffee_machine', duration: 8000 },
      { action: 'return_desk', area: 'center_desk', duration: 10000 }
    ],
    slacking: [
      { action: 'walk_to_bookshelf', area: 'bookshelf', duration: 6000 },
      { action: 'browse', area: 'bookshelf', duration: 12000 },
      { action: 'wander_hall', area: 'hall_left', duration: 5000 }
    ]
  },
  openclaw: {
    idle: [
      { action: 'sit_sofa', area: 'sofa', duration: 15000 },
      { action: 'stretch', area: 'sofa', duration: 5000 }
    ],
    slacking: [
      { action: 'play_plant', area: 'plant', duration: 10000 },
      { action: 'sleep_sofa', area: 'sofa', duration: 20000 }
    ]
  },
  // ... per-agent personalities
};
```

**行為調度器（每秒執行一次）：**
```javascript
function tickBehaviors(time) {
  MEMBERS.forEach(m => {
    const state = window.memberStates[m.id];
    if (state !== 'idle' && state !== 'slacking') return;
    
    // Check if current behavior is done
    const mv = window.memberMovement[m.id];
    if (mv && mv.state !== 'idle') return; // already moving
    
    // Pick a random behavior
    const personality = BEHAVIORS[m.id] || BEHAVIORS.hermes;
    const behaviors = personality[state] || personality.idle;
    const choice = behaviors[Math.floor(Math.random() * behaviors.length)];
    
    // Navigate to target area
    navigateTo(m.id, choice.area);
  });
}
```

### 3.5 狀態轉換視覺反饋

當 worker 狀態變更時：
```javascript
function onStatusChange(memberId, oldState, newState) {
  const sprite = window.memberSprites[memberId];
  
  // 1. Flash effect
  sprite.scene.tweens.add({
    targets: sprite,
    alpha: { from: 0.3, to: 1 },
    duration: 300,
    ease: 'Sine.easeInOut'
  });
  
  // 2. Status emoji floating up
  const emoji = WORKER_STATUS[newState].icon;
  const floatText = sprite.scene.add.text(sprite.x, sprite.y - 60, emoji, {
    fontSize: '24px'
  }).setOrigin(0.5).setDepth(20);
  
  sprite.scene.tweens.add({
    targets: floatText,
    y: floatText.y - 30,
    alpha: 0,
    duration: 1500,
    ease: 'Power2',
    onComplete: () => floatText.destroy()
  });
  
  // 3. Slacking special — weird behavior
  if (newState === 'slacking') {
    showSlackingAnimation(memberId);
  }
}

function showSlackingAnimation(memberId) {
  const sprite = window.memberSprites[memberId];
  // e.g., spin around, do a little dance
  sprite.scene.tweens.add({
    targets: sprite,
    angle: { from: -10, to: 10 },
    yoyo: true,
    repeat: 3,
    duration: 200
  });
}
```

### 3.6 game.js 改動匯總

| 檔案 | 改動內容 |
|------|---------|
| `public/game.js` | 新增 `WORKER_STATUS` 常數（取代舊 STATES） |
| | `normalizeState()` 擴充支援 'slacking' |
| | `update()` 改寫：調用 `updateWorkerMovement()` |
| | `handleWorkerUpdate()` 保持不變（WS already works） |
| | `renderMemberStatus()` 改為使用新狀態顏色 |
| | `fetchStatus()` 保留 polling 作為 fallback |
| `public/walk.js` | **新檔案** — walk animation 系統、方向判斷 |
| `public/pathfinding.js` | **新檔案** — NAV_POINTS、A* pathfinding |
| `public/behaviors.js` | **新檔案** — 自主行為引擎、行為調度 |
| `public/layout.js` | 可以整合 NAV_POINTS（或刪除，合併到 pathfinding.js） |

### 3.7 index.html 改動

在 `enterOffice()` 中載入新 JS 檔案：
```javascript
function enterOffice() {
  // ... existing ...
  const scripts = ['/game.js', '/walk.js', '/pathfinding.js', '/behaviors.js'];
  scripts.forEach(src => {
    const s = document.createElement('script');
    s.src = src + '?_t=' + Date.now();
    document.body.appendChild(s);
  });
}
```

---

## 4. 後端 API 設計

### 4.1 現有 API（保持不變）

| Method | Path | Auth | Use |
|--------|------|------|-----|
| `GET` | `/api/workers` | JWT | 查詢 workers |
| `POST` | `/api/workers/ping/:id` | API Key | 更新 worker 狀態 |

### 4.2 新增 API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/workers/:id/move` | API Key | 設定 worker 移動目標 |
| `POST` | `/api/workers/batch-status` | API Key | 批次更新多個 worker 狀態 |
| `POST` | `/api/workers/:id/state` | API Key | 更新單一 worker 狀態（含 slacking） |

**POST /api/workers/:id/move**
```json
// Request
{
  "target_x": 235,
  "target_y": 190,
  "reason": "coffee"
}

// Response
{
  "id": "worker-1",
  "name": "Hermes",
  "status": "idle",
  "target_x": 235,
  "target_y": 190,
  "position_x": 490,
  "position_y": 360
}

// Broadcast via WS
{
  "type": "worker_movement",
  "worker": {
    "id": "worker-1",
    "name": "Hermes",
    "target_x": 235,
    "target_y": 190
  }
}
```

**POST /api/workers/batch-status**
```json
// Request
{
  "updates": [
    { "id": "worker-3", "status": "working", "mood": "專注寫 code" },
    { "id": "worker-5", "status": "slacking", "mood": "研究新的 UI 框架" }
  ]
}

// Broadcast via WS
{
  "type": "worker_batch_update",
  "updates": [
    { "id": "worker-3", "name": "Codex", "status": "working", "mood": "專注寫 code" },
    { "id": "worker-5", "name": "Manus", "status": "slacking", "mood": "研究新的 UI 框架" }
  ]
}
```

**POST /api/workers/:id/state**
```json
// Request
{
  "status": "slacking",  // 新增 'slacking' 狀態
  "mood": "研究新的 UI 框架"
}

// Response + WS broadcast same as ping
```

### 4.3 後端驗證新增 slacking 狀態

在 `server.js` 的 `POST /api/workers/ping/:id` 中：
```javascript
const validStatuses = ['active', 'idle', 'busy', 'slacking', 'working'];
```

---

## 5. 即時通訊方案

### 5.1 建議：WebSocket（已存在，擴充）

**為什麼選 WebSocket（而非 SSE 或 polling）：**
- ✅ 已實作 WebSocket (`ws` library, `/ws` endpoint)
- ✅ 前端已有 `connectHermes()` + auto-reconnect
- ✅ 已有 `broadcast()` 和 `broadcastToHermes()`
- ✅ 支援雙向通訊（Hermes agent → server → browser clients）
- ❌ SSE 為單向，無法從 browser 發送
- ❌ Polling 延遲高 (15s)，不符合即時移動需求

### 5.2 新 WS 事件類型

| 事件 type | 方向 | 用途 |
|-----------|------|------|
| `worker_movement` | Server → Browser | Worker 移動目標更新 |
| `worker_batch_update` | Server → Browser | 批次狀態更新 |
| `worker_state_change` | Server → Browser | 單個 worker 狀態變化 |
| `worker_slacking` | Server → Browser | Worker 摸魚事件（含動畫觸發） |

**消息格式範例：**
```javascript
// Server → Browser: worker 開始摸魚
{
  type: 'worker_slacking',
  worker: {
    id: 'worker-5',
    name: 'Manus',
    status: 'slacking',
    mood: '研究新的 UI 框架',
    animation: 'dance'  // 前端可以播放對應動畫
  }
}

// Server → Browser: 狀態變化
{
  type: 'worker_state_change',
  worker: {
    id: 'worker-3',
    name: 'Codex',
    from_status: 'idle',
    to_status: 'working',
    mood: '專注寫 code 中',
    task: '重構 auth 模組'
  }
}
```

### 5.3 SSE 的替代方案（如果不想擴充 WS）

如果希望保持 WS 僅供 Hermes 使用，可在 Express 上新增 SSE 端點：

```javascript
// server.js 新增
app.get('/api/events', authMiddleware, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  
  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  sseClients.add(sendEvent);
  
  req.on('close', () => sseClients.delete(sendEvent));
});

// 替代 broadcast() — 同時發送 WS + SSE
function broadcast(data) {
  const msg = JSON.stringify(data);
  // WS broadcast (existing)
  clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
  // SSE broadcast
  sseClients.forEach(sendEvent => sendEvent(data));
}
```

**結論：優先擴充現有 WS，不需要 SSE。**

---

## 6. 資料庫 Schema 變更

### 6.1 workers 表新增欄位

```sql
ALTER TABLE workers ADD COLUMN position_x REAL DEFAULT NULL;
ALTER TABLE workers ADD COLUMN position_y REAL DEFAULT NULL;
ALTER TABLE workers ADD COLUMN target_x REAL DEFAULT NULL;
ALTER TABLE workers ADD COLUMN target_y REAL DEFAULT NULL;
ALTER TABLE workers ADD COLUMN activity TEXT DEFAULT NULL;  -- 'coffee', 'browsing', 'working', 'sleeping'
```

### 6.2 選擇性：新增 worker_locations 表（歷史軌跡）

```sql
CREATE TABLE IF NOT EXISTS worker_locations (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  area_name TEXT,
  recorded_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (worker_id) REFERENCES workers(id)
);
```

---

## 7. 推薦實作順序

### Phase 1: 核心移動（1-2 天）

| Step | 檔案 | 說明 |
|------|------|------|
| 1 | `public/pathfinding.js` | 建立 NAV_POINTS 地圖 + A* 演算法 |
| 2 | `public/walk.js` | 建立 walk animation 系統（方向判斷 + 動畫切換） |
| 3 | `public/game.js` | 改寫 `update()` → 調用 `updateWorkerMovement()` |
| 4 | `public/index.html` | 加載新 JS |

**驗收：** Hermes 可以從中央桌走到咖啡機再走回來

### Phase 2: 狀態機 + Slacking（1 天）

| Step | 檔案 | 說明 |
|------|------|------|
| 5 | `public/game.js` | 新增 `WORKER_STATUS` + `normalizeState('slacking')` |
| 6 | `public/game.js` | 新增 `WORKER_STATUS` 顏色（紫色 slacking） |
| 7 | `src/server.js` | 擴充 `validStatuses` 加入 'slacking' |
| 8 | `src/server.js` | 新增 `POST /api/workers/:id/state` 端點 |
| 9 | `public/game.js` | 狀態變化動畫（tween flash + emoji float） |

**驗收：** 可以呼叫 API 讓任一 worker 變成 slacking，前端閃紫光 + 浮動 🐟

### Phase 3: 自主行為（1-2 天）

| Step | 檔案 | 說明 |
|------|------|------|
| 10 | `public/behaviors.js` | 建立 BEHAVIORS 定義（每人 idle/slacking 行為） |
| 11 | `public/behaviors.js` | 行為調度器 `tickBehaviors()` |
| 12 | `public/game.js` | 在 update() 中每 5s 調用行為調度 |
| 13 | `public/walk.js` | 摸魚動畫（spin, bounce, dance） |

**驗收：** Worker 閒置久了自己走去喝咖啡、看書、或去沙發躺

### Phase 4: 後端強化 + 即時通訊（1 天）

| Step | 檔案 | 說明 |
|------|------|------|
| 14 | `src/server.js` | 新增 `POST /api/workers/:id/move` + WS broadcast |
| 15 | `src/server.js` | 新增 `POST /api/workers/batch-status` + WS broadcast |
| 16 | `src/db.js` | 新增 position/target/activity 欄位 migration |
| 17 | `src/server.js` | 新增 `POST /api/workers/:id/state` 含 slacking |
| 18 | `public/game.js` | WS handler 處理新事件類型 |
| 19 | `public/game.js` | 降低 polling interval (optional, rely more on WS) |

**驗收：** Hermes agent 可以通過 WS 推送 worker 移動和狀態，前端即時反應

### Phase 5: 打磨（0.5 天）

| Step | 說明 |
|------|------|
| 20 | 調試碰撞 / 重疊（多人同時走向同一點） |
| 21 | 效能優化（60fps 時 7 個 worker + GPU 開銷） |
| 22 | 加入隨機延遲，避免所有 worker 同時行動 |
| 23 | 摸魚訊息加入到 mood bubble（「~ 研究新框架 ~」） |

---

## 8. 技術注意事項

### 8.1 Phaser 效能
- Phaser.CANVAS mode（目前使用）對 sprite 動畫友好
- 7 個 worker 的 walk animation 大約 4×4×7 = 112 frames 記憶體
- 建議使用 spritesheet atlas（單一 PNG + JSON）而非多個檔案

### 8.2 sql.js 限制
- sql.js 是 wasm-based，每次寫入都需 `_persist()` → 寫入磁碟
- 高頻 position 更新（每秒）會導致效能問題
- **建議：** position 只透過 WS broadcast，不寫入 DB；DB 只在狀態變更時寫入

### 8.3 WS 重連
- 現有 `connectHermes()` 有 5s auto-reconnect
- 重連後需重新 sync 所有 worker 當前位置 + 狀態
- `fetchStatus()` 在重連後自動執行（已實作）

### 8.4 安全性
- `POST /api/workers/:id/move` 需 API Key 保護（同現有模式）
- position 資訊敏感度低，但避免 DoS（限制 1 req/s per worker）

---

## 9. 檔案結構（最終）

```
pixel-office/
├── public/
│   ├── index.html          # (修改) 載入新 JS
│   ├── game.js             # (修改) 主邏輯 + 狀態機 + 行為調度
│   ├── walk.js             # (新增) 行走動畫 + 方向系統
│   ├── pathfinding.js      # (新增) NAV_POINTS + A* 尋路
│   ├── behaviors.js        # (新增) 自主行為 + 摸魚動畫
│   ├── layout.js           # (保留，可刪除或合併)
│   └── guest_walk_*.webp   # (新增) 行走 spritesheets
├── src/
│   ├── server.js           # (修改) 新增 API + WS 事件
│   └── db.js               # (修改) migration 支援新欄位
└── docs/
    └── worker-movement-plan.md  # 本文件
```