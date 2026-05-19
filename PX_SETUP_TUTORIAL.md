# Pixel Office 雙電腦設定教學

---

## 🎯 目標

將**另一台電腦**的 Hermes Agent Workers 註冊到同一個 Pixel Office，兩台電腦的團隊狀態都能在同一個網頁看到。

---

## 📍 登入資訊

```
🌐 Pixel Office：https://pixel-office-production-03db.up.railway.app
👤 帳號：dicoge
🔑 密碼：Zxc999871
```

---

## 📡 API 資訊

```
🔑 Worker API Key：s3cr3t_t4sk_k3y_2026
```

---

## 🚀 設定步驟

### Step 1：Clone 專案（如果還沒有）

```bash
cd ~
git clone https://github.com/dicoge/pixel-office.git
cd pixel-office
npm install
```

---

### Step 2：手動註冊 Worker

找到這台電腦的名字（可用 hostname），然後執行：

```bash
curl -X POST https://pixel-office-production-03db.up.railway.app/api/workers/register \
  -H "Content-Type: application/json" \
  -H "X-API-Key: s3cr3t_t4sk_k3y_2026" \
  -d '{
    "name": "OpenClaw",
    "department_id": "dept-gaming",
    "machine_id": "你的電腦名稱"
  }'
```

**注意**：把 `"你的電腦名稱"` 改成這台電腦的識別名稱，例如：
- `Desktop-A`
- `Desktop-B`
- `Laptop-Home`

**department_id 選項**：

| ID | 部門 |
|----|------|
| `dept-gaming` | 🎮 遊戲開發部 |
| `dept-investment` | 📊 投資研究部 |
| `dept-execution` | 🎯 任務執行部 |
| `dept-audit` | 📋 稽核日誌部 |
| `dept-system` | ⚙️ 系統狀態 |

---

### Step 3：設定自動 Ping（每 30 秒更新狀態）

把 `WORKER_ID` 換成 Step 2 回傳的 ID。

```bash
# 每 30 秒更新一次狀態
while true; do
  curl -X POST https://pixel-office-production-03db.up.railway.app/api/workers/ping/WORKER_ID \
    -H "Content-Type: application/json" \
    -H "X-API-Key: s3cr3t_t4sk_k3y_2026" \
    -d '{"status": "active"}'
  sleep 30
done
```

**建議**：用 `screen` 或 `tmux` 讓這個程序在背景持續執行。

```bash
# 安裝 cron（如果還沒有）
sudo apt install cron

# 編輯 crontab
crontab -e

# 加上這行（每分鐘 ping 一次）
* * * * * curl -s -X POST https://pixel-office-production-03db.up.railway.app/api/workers/ping/WORKER_ID \
  -H "Content-Type: application/json" \
  -H "X-API-Key: s3cr3t_t4sk_k3y_2026" \
  -d '{"status": "active"}' > /dev/null 2>&1
```

---

### Step 4：多個 Worker 註冊

如果這台電腦有多個 Worker（例如 OpenClaw、Codex、OpenCode），每個都要註冊一次：

```bash
# OpenClaw
curl -X POST https://pixel-office-production-03db.up.railway.app/api/workers/register \
  -H "Content-Type: application/json" \
  -H "X-API-Key: s3cr3t_t4sk_k3y_2026" \
  -d '{"name": "OpenClaw", "department_id": "dept-gaming", "machine_id": "Desktop-B"}'

# Codex
curl -X POST https://pixel-office-production-03db.up.railway.app/api/workers/register \
  -H "Content-Type: application/json" \
  -H "X-API-Key: s3cr3t_t4sk_k3y_2026" \
  -d '{"name": "Codex", "department_id": "dept-gaming", "machine_id": "Desktop-B"}'

# OpenCode
curl -X POST https://pixel-office-production-03db.up.railway.app/api/workers/register \
  -H "Content-Type: application/json" \
  -H "X-API-Key: s3cr3t_t4sk_k3y_2026" \
  -d '{"name": "OpenCode", "department_id": "dept-gaming", "machine_id": "Desktop-B"}'
```

---

## 🔍 驗證

用瀏覽器打開 https://pixel-office-production-03db.up.railley.app，用 `dicoge` / `Zxc999871` 登入，點「⚙️ 系統狀態」頁籤，確認兩台電腦的 Worker 都出現了。

---

## ❓ 常見問題

**Q：Worker 狀態變成 ⚫ 離線？**
A：確認 cron job 或 while loop 還在執行，網路有連線。

**Q：需要開 Railway 帳號嗎？**
A：不用，Pixel Office 已經在 Railway 執行了，另一台電腦只需要能上網 call API 就行。

**Q：可以自動化 Worker 啟動時自動註冊嗎？**
A：可以，在 Hermes 的 startup script 裡加入註冊邏輯，Worker 重啟後自動重新註冊。