# v22: 座位分配 + 狀態顯示

## 背景
Pixel Office 有 7 個 AI Agent，原本都擠在左側桌子區。現在右上角房間多了一張沙發，要重新分配座位。

## 隊伍成員（7人）
| ID | 角色 | 目前位置 |
|---|---|---|
| hermes | ⭐ 經理（大星星） | 中央 |
| openclaw | 🧪 測試 | 左排桌子 → **搬到沙發** |
| codex | 📐 架構 | 左排桌子（不動） |
| gemini | 🔍 研究 | 左排桌子底部 → **搬到左排中間** |
| manus | ✍️ UI/UX | 右排桌子頂部 → **搬到左排底部** |
| claude | 💻 開發 | 右排桌子中間 → **搬到右排頂部** |
| opencode | 🔧 優化 | 右排桌子底部 → **搬到右排中間** |

右排底部（col2_bot）保持空位。

## 沙發位置
sofa 圖片在遊戲中座標為 `x=1092, y=280`，scale=0.45。
OpenClaw 的 guest sprite 應該出現在沙發上方附近（x=1092, y=230 左右）。

## 修改項目

### 【1】AREAS — 新增 sofa 區域
在 game.js 的 AREAS 物件中新增：
```js
sofa: { x: 1092, y: 230 },  // OpenClaw 在沙發正上方
```
保留其他 AREAS 不變。

### 【2】MEMBERS — 重新分配座位
修改 game.js 的 MEMBERS 陣列，將 area 欄位改為：
- hermes: 'center'（不變）
- openclaw: 'sofa'（從 col1_mid 改過來）
- codex: 'col1_top'（不變）
- gemini: 'col1_mid'（從 col1_bot 改過來）
- manus: 'col1_bot'（從 col2_top 改過來）
- claude: 'col2_top'（從 col2_mid 改過來）
- opencode: 'col2_mid'（從 col2_bot 改過來）

### 【3】renderMemberStatus() — 實作狀態顯示
此函式目前在 game.js 第 593~595 行是空的（stub）。

請實作完整功能：
1. 建立一個全域物件 `window.statusIndicators` 存放每個 member 的狀態指示器
2. 在 `renderMemberStatus()` 中，遍歷所有 MEMBERS，為每個 agent 建立一個小型的狀態 LED 燈
3. 狀態 LED 燈的位置：在每個 agent 的 badge（頭頂徽章）右側約 18px
4. LED 燈樣式：4x4 像素正方形（使用 Phaser graphics）
5. 顏色對應：
   - 'idle': #2ecc71（綠色）
   - 'writing': #f1c40f（黃色）
   - 'researching': #f1c40f（黃色）
   - 'executing': #f1c40f（黃色）
   - 'syncing': #3498db（藍色）
   - 'error': #e74c3c（紅色）
6. 狀態指示器也要跟著 agent sprite 移動（在 update 迴圈中更新位置）
7. 如果已建立過指示器，只更新顏色和位置，不要重複建立

註：`window.memberStates` 已經由 fetchStatus() 每 3 秒更新一次，裡面存有每個 member 的當前狀態字串。

### 【4】update() 中更新狀態指示器位置
在 game.js 的 update() 函式中，找到遍歷 MEMBERS 的區塊（第 472~511 行），在 badge 位置更新的後面加入：
```js
// Update status indicator position
const si = window.statusIndicators && window.statusIndicators[m.id];
if (si) {
  si.setPosition(sp.x + 14, sp.y - 20);
}
```

## 驗證
```bash
cd /home/dicoge/pixel-office
node -e "try{new Function(require('fs').readFileSync('public/game.js','utf8'));console.log('✅ Syntax OK')}catch(e){console.log('❌',e.message)}"
```

## Git 提交
```bash
cd /home/dicoge/pixel-office
git add public/game.js
git commit -m "v22: agents reassigned - openclaw on sofa, 5 at desks + status indicators"
git push origin master
```