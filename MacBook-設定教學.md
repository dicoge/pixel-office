# 🏢 Pixel Office — MacBook 端設定教學

## 前提
這個 Pixel Office 是 **MiniPC 那邊**部署的，你們共用同一個網站：
👉 https://pixel-office-eanf.onrender.com

你們只需要設定自己的 worker（掛在 company-b 底下），然後下拉選單就能切換看了。

---

## Step 1：登入 Pixel Office

1. 打開瀏覽器 → https://pixel-office-eanf.onrender.com
2. 輸入帳號密碼登入
3. 右上角下拉選單選 **💻 MacBook**（第一次用預設是 MiniPC，手動切換一次）
4. 登入後只會看到自己的 worker，不會看到對方的

> ⚠️ **下拉選單的選擇會自動存到 localStorage**，下次重整會記住。

---

## Step 2：註冊你的 Workers

用 `curl` 註冊 7 個 worker（複製整段貼到 MacBook 的終端機）：

```bash
# 設定變數（一次就好）
PIXEL_URL="https://pixel-office-eanf.onrender.com"
API_KEY="s3cr3t_t4sk_k3y_2026"

# 註冊 7 個 worker（指定 x-company-id: company-b）
curl -X POST "$PIXEL_URL/api/workers/register" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "x-company-id: company-b" \
  -d '{"name":"OpenClaw","department_id":"dept-dungeon","machine_id":"MacBook"}'

curl -X POST "$PIXEL_URL/api/workers/register" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "x-company-id: company-b" \
  -d '{"name":"Codex","department_id":"dept-stock","machine_id":"MacBook"}'

curl -X POST "$PIXEL_URL/api/workers/register" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "x-company-id: company-b" \
  -d '{"name":"OpenCode","department_id":"dept-pixeloffice","machine_id":"MacBook"}'

curl -X POST "$PIXEL_URL/api/workers/register" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "x-company-id: company-b" \
  -d '{"name":"Gemini","machine_id":"MacBook"}'

curl -X POST "$PIXEL_URL/api/workers/register" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "x-company-id: company-b" \
  -d '{"name":"Manus","machine_id":"MacBook"}'

curl -X POST "$PIXEL_URL/api/workers/register" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "x-company-id: company-b" \
  -d '{"name":"Claude Code","machine_id":"MacBook"}'

curl -X POST "$PIXEL_URL/api/workers/register" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "x-company-id: company-b" \
  -d '{"name":"Hermes","machine_id":"MacBook"}'
```

---

## Step 3：設定 Mood（心情對話框）

用瀏覽器 DevTools 一次設定所有 mood：

```javascript
// 複製貼到瀏覽器 DevTools Console（需先登入 Pixel Office）
const token = localStorage.getItem('pixel_office_token');
const moods = {
  'Hermes': '協調一切進行中',
  'OpenClaw': '測試案例撰寫中',
  'Codex': '架構規劃中',
  'Gemini': '搜尋相關資料',
  'Manus': '設計 UI 流程',
  'Claude Code': '程式碼撰寫中',
  'OpenCode': '優化現有功能'
};

fetch('/api/workers?company_id=company-b', {
  headers: { 'Authorization': 'Bearer ' + token }
}).then(r => r.json()).then(workers => {
  workers.forEach(w => {
    const mood = moods[w.name];
    if (mood) {
      fetch('/api/workers/ping/' + w.id, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active', mood: mood })
      }).then(r => console.log('✅', w.name, mood + (r.ok ? '' : ' ❌')));
    }
  });
});
```

---

## Step 4：查看結果

1. 重整 Pixel Office 頁面
2. 右上角下拉選單選 **💻 MacBook**
3. 應該可以看到 7 個角色出現在辦公室畫面，角色頭上會有 mood 對話框

下拉選單切換到 **🖥️ MiniPC** 就可以看對方的辦公室狀態。

---

## 注意事項

- ⚠️ **每次 Render 重新部署後**，SQLite 資料庫重置，需要重新註冊 workers
- 建議把 Step 2 的 curl 存成 `register-macbook.sh`，部署完直接跑
- API Key: `s3cr3t_t4sk_k3y_2026`

## 懶人包：完整註冊腳本

存成 `register-macbook.sh`：

```bash
#!/bin/bash
PIXEL_URL="https://pixel-office-eanf.onrender.com"
API_KEY="s3cr3t_t4sk_k3y_2026"

for w in \
  '{"name":"OpenClaw","department_id":"dept-dungeon","machine_id":"MacBook"}' \
  '{"name":"Codex","department_id":"dept-stock","machine_id":"MacBook"}' \
  '{"name":"OpenCode","department_id":"dept-pixeloffice","machine_id":"MacBook"}' \
  '{"name":"Gemini","machine_id":"MacBook"}' \
  '{"name":"Manus","machine_id":"MacBook"}' \
  '{"name":"Claude Code","machine_id":"MacBook"}' \
  '{"name":"Hermes","machine_id":"MacBook"}'; do
  curl -X POST "$PIXEL_URL/api/workers/register" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -H "x-company-id: company-b" \
    -d "$w"
  echo ""
done
echo "✅ Workers registered for MacBook!"
```

執行：
```bash
chmod +x register-macbook.sh
./register-macbook.sh
```