# Pixel Office 戰情室 — Implementation Spec

> **Goal:** 在 Pixel Office Phaser 遊戲畫面中，新增一個「🐝 戰情室」HTML overlay 面板，顯示所有 AI Agent 的即時狀態、組織圖、任務佇列，並可遠端操控（手機/桌機皆適用）

## 技術方案

### 架構
```
Pixel Office Phaser 遊戲 (canvas)
    ↓ 點擊「戰情室」按鈕
HTML Overlay 面板 (絕對定位, z-index 高於 game canvas)
    ↓ fetch API
Pixel Office Backend (/api/agents, /api/agent-tasks, /api/swarmclaw/...)
```

### 為什麼用 HTML overlay 而不是 Phaser scene？
- 手機/桌機相容性更好（響應式）
- 可以塞大量文字內容（agent 列表、任務表格）
- 開發速度快，團隊成員熟悉 HTML/CSS/JS
- 保留 Phaser 遊戲當背景，戰情室像「彈出式控制台」

## UI 設計

### 觸發方式
在 Phaser 遊戲畫面中加一個「🐝 戰情室」按鈕（類似現有的 btn-*.png 按鈕風格）
- 點擊後顯示 overlay 面板
- 面板右上角有關閉按鈕（✕）

### 戰情室面板內容

#### 1. 頂部統計列
```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ Agent 總數 │ 指揮官數  │ 工作中   │ 閒置中   │ 任務佇列   │
│    8     │    2     │    3     │    3     │    5     │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

#### 2. 全員一覽（戰情網格）
每個 Agent 顯示：
- 名稱（含 emoji，如 🧿 Hermes）
- 角色標籤（coordinator / reviewer / worker / tester / analyst / hub）
- 狀態指示燈（🟢 active / 🔵 busy / 🟡 idle）
- 能力標籤（調度、開發、測試...）
- 狀態切換下拉選單

佈局：`display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`

#### 3. Agent 組織圖（樹狀結構）
- Hermes → CCR / Codex / OpenCode / OpenClaw / Gemini / Manus / SwarmClaw
- 每個節點顯示名稱 + 角色 + 狀態
- 可展開/收起子節點

#### 4. 任務佇列
- 表格顯示：標題、指派給誰、狀態、優先級、重試次數
- 可過濾（全部/待處理/進行中/已完成/失敗）
- 操作按鈕：開始、完成、失敗、重試、日誌

#### 5. SwarmClaw 控制
- 顯示 SwarmClaw config（provider、model、路由）
- 透過 Tunnel Proxy 連接到本機 SwarmClaw API
- 顯示 Tunnel 連線狀態

### API 端點（已存在於 server.js）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | /api/agents | 列出所有 Agent（含部門資訊） |
| POST | /api/agents | 新增 Agent |
| PATCH | /api/agents/:id | 更新 Agent（狀態、角色等） |
| GET | /api/agent-tasks | 列出 Agent 任務佇列 |
| POST | /api/agent-tasks | 建立新任務 |
| PATCH | /api/agent-tasks/:id | 更新任務狀態 |
| POST | /api/agent-tasks/:id/retry | 重試失敗任務 |
| GET | /api/agent-tasks/:id/logs | 任務執行日誌 |
| GET | /api/schedules | 列出排程 |
| POST | /api/schedules | 建立排程 |
| POST | /api/swarmclaw/proxy | 代理到本機 SwarmClaw |
| GET | /api/stats | 系統統計 |

### 樣式
- 像素風格（Press Start 2P 字體）
- 顏色：深色背景 (#1a1a2e)，cyan 標題 (#00d4aa)，金色強調 (#ffd700)
- 響應式：手機上 auto-fill 減少為 1-2 欄
- scrollable（戰情室內容可能超出螢幕高度）

## 檔案修改

### 1. public/index.html
在 `<!-- ===== APP ===== -->` 區塊內加入：
- 戰情室 overlay 的 HTML 結構
- 所有 agent cards 的渲染容器
- 任務佇列表格
- CSS 樣式（像素風格）

### 2. public/game.js
在 Phaser 遊戲中加一個「戰情室」按鈕：
- 在 create() 中加入點擊區域
- 點擊時顯示 overlay（`document.getElementById('war-room-overlay').classList.add('active')`）

### 3. 新增 JS 邏輯（可直接放在 index.html 的 `<script>` 中）
- `loadWarRoom()` — 載入所有 agent 資料
- `renderWarRoomGrid()` — 渲染戰情網格
- `renderOrgTree()` — 渲染組織圖
- `loadAgentTasks()` — 載入任務佇列
- `updateAgentStatus()` — 更新 agent 狀態
- `createAgentTask()` — 建立新任務

## 執行順序

1. 修改 `public/index.html` — 加 overlay HTML + CSS + JS 邏輯
2. 修改 `public/game.js` — 加戰情室按鈕
3. 驗證：`node src/server.js` 啟動後，瀏覽器打開檢查
4. Codex Code Review
5. OpenClaw 自動化測試
6. git push → Render 自動部屬