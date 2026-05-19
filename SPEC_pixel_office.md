# SPEC: Pixel Office — 像素風格 AI Agent 工作團隊管理視圖

## 1. 概述

**專案名稱**: Pixel Office  
**版本**: 1.0.0  
**描述**: 像素風格 AI Agent 工作團隊管理視圖，提供多部門任務管理、Worker 狀態監控、稽核日誌等功能  
**目標用戶**: AI Agent 團隊管理者、開發者、任務執行者

---

## 2. 技術架構

### 2.1 技術棧
- **後端**: Node.js + Express 4.18
- **認證**: JWT (jsonwebtoken) + bcryptjs (12 rounds)
- **資料庫**: SQLite (better-sqlite3)
- **即時通訊**: WebSocket (ws library)
- **前端**: 純 HTML/CSS/JS (無 framework)
- **部署**: Railway / Render

### 2.2 目錄結構
```
/home/dicoge/pixel-office/
├── package.json           # 專案設定
├── src/
│   └── server.js          # 主伺服器
├── public/
│   └── index.html         # 前端頁面
├── data/                  # SQLite 資料庫 (不在 public)
│   └── tasks.db
├── SPEC_pixel_office.md   # 本規格書
└── deployment/
    ├── railway.json       # Railway 部署設定
    └── render.yaml        # Render 部署設定
```

---

## 3. 安全性設定

### 3.1 認證機制
- **密碼雜湊**: bcryptjs，12 rounds
- **JWT Token**: 
  - 過期時間: 7 days
  - Secret: 從環境變數 `JWT_SECRET` 讀取
- **公開 endpoint**: 只有 `/auth/login` 和 `/auth/register` 無需驗證
- **保護 endpoint**: 所有 `/api/*` 需要 Bearer JWT

### 3.2 CORS 設定
- 允許的域名: 從環境變數 `ALLOWED_ORIGINS` 讀取
- 支援 Telegram WebApp 和自定義網域
- 預設值: `*` (允許所有，開發用)

### 3.3 Rate Limiting
- 限制: 同一 IP 5 分鐘內最多 20 次請求
- 套件: express-rate-limit
- 套用範圍: `/api/*` 所有路由

### 3.4 資料庫安全
- SQLite 資料庫位於 `data/tasks.db`
- 不在 public 目錄，無法直接存取
- 路徑: `~/pixel-office/data/tasks.db`

---

## 4. 資料 Schema

### 4.1 users 表
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 4.2 departments 表
```sql
CREATE TABLE departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 4.3 tasks 表
```sql
CREATE TABLE tasks (
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
  completed_at TEXT
);
```

### 4.4 workers 表
```sql
CREATE TABLE workers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'idle',
  department_id TEXT,
  last_ping TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 4.5 audit_logs 表
```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  user_id TEXT,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 5. 部門設定

| ID | 名稱 | Emoji | 描述 |
|---|---|---|---|
| dept-gaming | 遊戲開發部 | 🎮 | DungeonD3（Codex/OpenCode/OpenClaw） |
| dept-investment | 投資研究部 | 📊 | 股票/每日報告/停損監控 |
| dept-execution | 任務執行部 | 🎯 | 一般任務 |
| dept-audit | 稽核日誌部 | 📋 | 派工記錄（JSONL+Markdown） |
| dept-system | 系統狀態 | ⚙️ | Worker 健康狀態 |

---

## 6. API Endpoints

### 6.1 認證 (公開)
| Method | Path | 描述 |
|---|---|---|
| POST | /auth/register | 註冊 (username, password) |
| POST | /auth/login | 登入取得 JWT |

### 6.2 部門 (需 JWT)
| Method | Path | 描述 |
|---|---|---|
| GET | /api/departments | 取得所有部門狀態 |

### 6.3 任務 (需 JWT)
| Method | Path | 描述 |
|---|---|---|
| GET | /api/tasks | 任務列表 (可篩選 department_id, status, priority) |
| POST | /api/tasks | 建立任務 |
| GET | /api/tasks/:id | 任務詳情 |
| PATCH | /api/tasks/:id | 更新任務 |

### 6.4 Worker (需 JWT)
| Method | Path | 描述 |
|---|---|---|
| GET | /api/workers | Worker 狀態列表 |

### 6.5 統計 (需 JWT)
| Method | Path | 描述 |
|---|---|---|
| GET | /api/stats | 全域統計 (tasks by status, workers by status, recent tasks, audit logs) |

### 6.6 WebSocket
| Path | 描述 |
|---|---|
| /ws | 即時廣播 (task_created, task_updated, user_login, user_registered) |

---

## 7. UI 設計規範

### 7.1 像素 16 色彩色盤
```css
--c-black: #1a1a2e;
--c-darkblue: #16213e;
--c-purple: #4a2c7a;
--c-green: #0f9b0f;
--c-brown: #8b4513;
--c-darkgray: #2d2d2d;
--c-gray: #6b6b6b;
--c-silver: #a0a0a0;
--c-white: #f0f0f0;
--c-red: #e74c3c;
--c-orange: #e67e22;
--c-yellow: #f1c40f;
--c-lime: #2ecc71;
--c-cyan: #00d4aa;
--c-blue: #3498db;
--c-pink: #ff69b4;
--c-peach: #ffb347;
```

### 7.2 字體
- 主字體: Press Start 2P (Google Fonts)
- 備用: monospace

### 7.3 版面配置
- **Header**: 像素風格標題列，含使用者資訊與登出按鈕
- **Nav Tabs**: 5 個麵包導航 (Dashboard / Departments / Tasks / Workers / Audit Log)
- **Main Content**: 各麵包內容區
- **Footer**: 狀態列，含系統狀態、WebSocket 連線狀態、時鐘

### 7.4 任務狀態標籤
| 狀態 | 顏色 |
|---|---|
| pending | 黃色 |
| in_progress | 藍色 |
| completed | 綠色 |
| failed | 紅色 |

---

## 8. 功能清單

### 8.1 認證系統
- ✅ 使用者註冊 (bcrypt 12 rounds)
- ✅ 使用者登入 (JWT 7 days)
- ✅ JWT 驗證 middleware
- ✅ 登出 (localStorage 清除)

### 8.2 部門管理
- ✅ 顯示所有部門狀態
- ✅ 各部門任務計數 (pending/in_progress/completed)

### 8.3 任務管理
- ✅ 建立新任務
- ✅ 編輯任務
- ✅ 更新任務狀態 (pending → in_progress → completed/failed)
- ✅ 依部門/狀態篩選
- ✅ 任務詳情檢視

### 8.4 Worker 狀態
- ✅ 顯示 Worker 列表
- ✅ Worker 狀態 (active/idle/offline)

### 8.5 稽核日誌
- ✅ 記錄所有操作 (register, login, create, update)
- ✅ 顯示時間、動作、Entity、相關使用者

### 8.6 即時更新
- ✅ WebSocket 即時廣播
- ✅ 任務變更自動更新 UI
- ✅ 連線中斷自動重連

### 8.7 可選功能 (Webhook)
- ⏳ Discord/Telegram 推播 (預留 API，未實作)

---

## 9. 環境變數

| 變數 | 預設值 | 描述 |
|---|---|---|
| PORT | 3000 | 監聽端口 |
| JWT_SECRET | pixel-office-secret-change-me | JWT 加密密鑰 |
| ALLOWED_ORIGINS | * | 允許的 CORS 域名 (逗號分隔) |
| NODE_ENV | development | 環境模式 |

---

## 10. 部署設定

### 10.1 Railway
- 設定檔: `deployment/railway.json`
- Build command: `npm install`
- Start command: `npm start`
- 環境變數需設定: `JWT_SECRET`, `ALLOWED_ORIGINS`

### 10.2 Render
- 設定檔: `deployment/render.yaml`
- Build command: `npm install`
- Start command: `npm start`

---

## 11. 測試清單

- [ ] 使用者註冊成功
- [ ] 使用者登入取得 JWT
- [ ] 錯誤密碼無法登入
- [ ] JWT 過期被拒絕
- [ ] 建立任務成功
- [ ] 更新任務狀態
- [ ] WebSocket 即時接收更新
- [ ] Rate limiting 觸發 (21+ 請求/5分鐘)
- [ ] 部門正確顯示任務計數
- [ ] Worker 狀態顯示正確

---

## 12. 已知限制

- Webhook 功能僅預留 API，未實作實際推播
- Worker ping 機制未實作 (last_ping 固定)
- 無法刪除任務 (僅狀態更新)
- 無管理員權限差異 (role 欄位未使用)

---

## 13. 版本歷史

| 版本 | 日期 | 變更 |
|---|---|---|
| 1.0.0 | 2026-05-18 | 初始版本 |