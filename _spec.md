# Spec: 改下拉選單為同站 company_id 過濾

## 背景
目前下拉選單用「遠端 URL proxy」切換辦公室（local/remote），這是錯的。
正確：**同一個 Pixel Office 網站**，下拉選單只需切換 `company_id` 參數過濾 worker。

伺服器已支援：
- `company-a` = MiniPC
- `company-b` = MacBook
- `GET /api/workers?company_id=company-a` → 只看 MiniPC
- `GET /api/workers?company_id=company-b` → 只看 MacBook

## 修改 1：public/index.html

### 1A. 下拉選單選項（line 182-185）
改前：
<option value="local">MiniPC</option>
<option value="remote">MacBook</option>
改後：
<option value="company-a">MiniPC</option>
<option value="company-b">MacBook</option>

### 1B. 刪除設定 modal（lines 258-269）
整塊刪掉：從 `<!-- Settings Modal -->` 到 `</div>`（包含 modal-overlay 整段）

### 1C. 刪除 ⚙️ 設定按鈕（line 189）
刪掉：`<button id="settings-btn" ...>⚙️</button>`

### 1D. 刪除 .settings-btn CSS（lines 126-130）
刪掉 `.settings-btn {` 以及 `.settings-btn:hover {`

### 1E. 修改內嵌 script（lines 271-309）
改為：
```javascript
window.currentOffice = localStorage.getItem("current_office") || "company-a";

// 載入已儲存的辦公室選擇
const savedOffice = localStorage.getItem("current_office");
if (savedOffice) {
  window.currentOffice = savedOffice;
  document.getElementById("office-switcher").value = savedOffice;
}

// 下拉選單切換
document.getElementById("office-switcher").onchange = function() {
  window.currentOffice = this.value;
  localStorage.setItem("current_office", this.value);
  if (typeof fetchStatus === "function") {
    lastFetch = 0;
    ttTarget = window.currentOffice === "company-a" ? "已切換到 MiniPC" : "已切換到 MacBook";
    ttText = "";
    ttIdx = 0;
  }
};
```

## 修改 2：public/game.js

### 2A. line 113
改前：`window.currentOffice = localStorage.getItem("current_office") || "local";`
改後：`window.currentOffice = localStorage.getItem("current_office") || "company-a";`

### 2B. fetchStatus()（lines 558-579）
改前（去掉了 remote proxy 邏輯）：
function fetchStatus() {
  const token = localStorage.getItem("pixel_office_token");
  if (!token) return;
  const companyId = window.currentOffice || "company-a";
  const fetchPromise = fetch("/api/workers?t="+Date.now()+"&company_id="+companyId, {
    headers: { "Authorization": "Bearer "+token }, cache: "no-store"
  }).then(r => { if (!r.ok) throw new Error("HTTP "+r.status); return r.json(); });
  // 後續的 .then(data => ...) 不動

## 修改 3：src/server.js

### 3A. 刪除 proxy endpoint（lines 1157-1167）
整段刪掉：
```
app.post('/api/proxy/workers', (req, res) => {
  const { url, token } = req.body;
  ...
});
```

## 不能動到的東西
- 不要改 game.js 的 MEMBERS、角色邏輯、Phaser Canvas
- 不要改 login/登出邏輯
- 不要改 server.js 的資料庫或 worker API

## 驗證
完成後執行：
cd /home/dicoge/pixel-office
node -e "try{new Function(require('fs').readFileSync('public/game.js','utf8'));console.log('OK game.js')}catch(e){console.log('FAIL',e.message)}"
node -e "try{new Function(require('fs').readFileSync('public/index.html','utf8'));console.log('OK index.html')}catch(e){console.log('FAIL',e.message)}"
node -e "try{require('./src/server.js')}catch(e){console.log('FAIL',e.message)}"
