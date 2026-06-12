# 戰情室修復規格書

## 問題清單

### 1. 辦公室切換選單失效
- [ ] 下拉選單 `<select id="office-switcher">` 切換 MiniPC/MacBook 時，背景圖片跟所有家具沒有跟著切換
- [ ] 原因是 index.html 跟 game.js 各有獨立的 `setOfficeTheme` 函數，切換時只觸發了 index.html 的簡化版（只切背景，沒切家具/燈光/員工）
- [ ] **解法**：把 game.js 的 `setOfficeTheme` 改寫成 `window.setOfficeTheme`，讓下拉選單能夠完整觸發包括背景、家具、燈光、員工在內的所有主題切換

### 2. 戰情室只出現在 MacBook
- [ ] 目前戰情室按鈕（game.js 第 728-772 行）在任何辦公室都顯示
- [ ] **解法**：只在 `window.currentOffice === 'company-b'`（MacBook）時建立戰情室按鈕
- [ ] 切換到 MiniPC 時移除/隱藏戰情室按鈕
- [ ] 切換到 MacBook 時建立/顯示戰情室按鈕

### 3. 戰情室後端 API（最關鍵）
- [ ] DB 已有 `agents`、`agent_tasks`、`agent_task_logs`、`schedules` 四個 SwarmClaw tables
- [ ] DB 已有 seed agent 資料（agent-hermes, agent-ccr, agent-codex, agent-opencode, agent-openclaw, agent-gemini, agent-openmanus, agent-swarmclaw）
- [ ] **但完全沒有任何 API routes 來存取這些資料！**
- [ ] 需要新增以下 routes（全部在 `src/server.js`）：

#### 需要的 API Routes

**Agents API**
- `GET /api/agents` — 列出所有 agents，支援 `?company_id=company-b` 過濾
- `POST /api/agents` — 新增 agent
- `PATCH /api/agents/:id` — 更新 agent 狀態/角色等

**Agent Tasks API**
- `GET /api/agent-tasks` — 列出所有 agent tasks，支援 `?company_id=` 過濾
- `POST /api/agent-tasks` — 新增 agent task（使用者建立任務用）
- `PATCH /api/agent-tasks/:id` — 更新 task 狀態
- `POST /api/agent-tasks/:id/retry` — 重試 task（重設 retry_count，狀態改為 pending）
- `GET /api/agent-tasks/:id/logs` — 取得 task 的 logs（從 agent_task_logs 查）

### 4. 戰情室新增任務 UI
- [ ] 戰情室目前只有顯示任務表格 + 按鈕（開始/完成/失敗/重試/日誌）
- [ ] 缺少「建立新任務」的按鈕和表單
- [ ] **解法**：在任務區塊上方加一個「＋ 建立任務」按鈕
- [ ] 點擊後跳出 modal，包含：
  - 任務標題（必填）
  - 任務描述（選填）
  - 指派給哪個 Agent（下拉選單，從 agents list 載入）
  - 優先級：normal / high / low
  - 提交後 POST 到 `/api/agent-tasks`
  - 成功後重新載入戰情室資料

### 5. 戰情室初始資料
- [ ] seed agents 目前只有 `company-a`（MiniPC）
- [ ] 需要在 `initDatabase()` 中也 seed `company-b`（MacBook）的 agents
- [ ] 新增幾個範例 task 作為展示

## 實作順序

1. **CCR** → 實作所有改動（server.js API routes + index.html UI + game.js 調整）
2. **Codex** → Code Review
3. 若 review 有問題 → 回 CCR 修
4. **OpenClaw** → 測試
5. **我** → 最終審查 + push 部署