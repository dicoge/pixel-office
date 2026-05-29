# v37: 狀態文字取代 LED 燈

## 目標
移除 agent 頭上的彩色狀態 LED 燈（小方塊），改為文字顯示工作狀態。

## 修改檔案
`/home/dicoge/pixel-office/public/game.js`

## 修改項目

### 【1】移除狀態 LED 燈相關程式碼

(1a) 移除 `renderMemberStatus()` 函式的全部內容（約第599~631行），將函式本體清空或改為新的實作。

(1b) 移除 `window.statusIndicators` 的所有引用：
- 移除 `window.statusIndicators = {};`（在 renderMemberStatus 開頭）
- 移除 `window.statusIndicators[m.id]` 的建立和更新

(1c) 在 `update()` 中移除狀態指示器位置更新的程式碼：
```js
const si = window.statusIndicators && window.statusIndicators[m.id];
if (si) {
  si.setPosition(sp.x + 14, sp.y - 20);
}
```

### 【2】新增狀態文字顯示

(2a) 在全域變數區（約第94~100行附近）宣告：
```js
let memberStatusTexts = {};
```

(2b) 在 `placeCharacters()` 函式中，在建立 name label 的附近（每個 agent 的迴圈內），新增狀態文字：
```js
// Status text above head
const statusText = scene.add.text(bx, by - 35, '閒置中', {
  fontFamily: 'monospace', fontSize: '9px',
  fill: '#2ecc71',  // 預設綠色
  stroke: '#000', strokeThickness: 2,
  align: 'center'
}).setOrigin(0.5).setDepth(12);
memberStatusTexts[m.id] = statusText;
```

注意 Hermes 比較大顆，y 偏移用 -45。

(2c) 狀態文字到顏色的對應：
```js
function getStatusColor(state) {
  switch(state) {
    case 'writing': case 'researching': case 'executing': return '#f1c40f'; // 黃色
    case 'syncing': return '#3498db';  // 藍色
    case 'error': return '#e74c3c';    // 紅色
    default: return '#2ecc71';         // 綠色（idle）
  }
}
```

(2d) 狀態文字到中文的對應：
```js
const STATUS_LABELS = {
  idle: '閒置中',
  writing: '工作中',
  researching: '搜尋中',
  executing: '執行中',
  syncing: '同步中',
  error: '出錯'
};
```

### 【3】改寫 renderMemberStatus() 更新文字

將 `renderMemberStatus()` 改為更新每個人頭上的狀態文字：

```js
function renderMemberStatus() {
  MEMBERS.forEach(m => {
    const sp = window.memberSprites[m.id];
    if (!sp) return;
    const state = window.memberStates[m.id] || 'idle';
    const label = STATUS_LABELS[state] || '閒置中';
    const txt = memberStatusTexts[m.id];
    if (txt) {
      txt.setText(label);
      txt.setFill(getStatusColor(state));
    }
  });
}
```

### 【4】在 update() 中更新狀態文字位置

在 update() 中 badge 位置更新的地方（約第500~515行附近），加入：
```js
// Update status text position
const stxt = memberStatusTexts[m.id];
if (stxt) {
  const yOff = m.id === 'hermes' ? -45 : -35;
  stxt.setPosition(sp.x, sp.y + yOff);
}
```

### 【5】fetchStatus() 結束後自動更新

`renderMemberStatus()` 已經在 fetchStatus() 結尾被呼叫（第594行），所以狀態文字會自動隨 fetch 結果更新。

### 【6】放置 STATUS_LABELS 和 getStatusColor

建議放在 STATES 和 BTEXTS 附近（約第36~51行之間），或放在 renderMemberStatus 上方。

## 語法驗證
```bash
cd /home/dicoge/pixel-office
node -e "try{new Function(require('fs').readFileSync('public/game.js','utf8'));console.log('✅ Syntax OK')}catch(e){console.log('❌',e.message)}"
```

## Git 提交
```bash
cd /home/dicoge/pixel-office
git add public/game.js
git commit -m "v37: replace status LED dots with text labels above heads"
git push origin master
```