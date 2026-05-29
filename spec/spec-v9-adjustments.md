# Spec v9 — Office 微調

## 調整項目

### 1. 咖啡機位置

檔案：`public/game.js`
目前：`scene.add.sprite(220, 220, 'coffee_machine', 0)`（約第 167 行）
需求：Y 再往上。根據用戶多次反映「看沒變」，請 Manus 判斷適當的 Y 值（建議試 y=200 或 y=180），讓咖啡機明顯比現在更高。

### 2. 底部牌匾

檔案：`public/game.js`
目前：有 stars 的 PIXEL OFFICE 牌匾在深度 51-52。
需求：**底部只留這一塊**。若還有其他底部元素（如狀態文字 `#status-text` 的重疊、另一層陰影等）造成「兩塊」的視覺感，請 Manus 判斷如何消除。

### 3. 不能動的東西 ⛔
- ❌ 不要改角色座標（AREAS、MEMBERS）
- ❌ 不要改桌子位置
- ❌ 不要改背景圖
- ❌ 不要改暖光
- ❌ 不要改上方 CENTRAL PERK 招牌位置（x=660 不動）
- ❌ 不要改 index.html / CSS / server.js / layout.js
- ❌ 不要刪除任何功能
- ❌ 不要修改 Coffee machine 腳本動畫

### 4. 驗證方式
```bash
cd /home/dicoge/pixel-office
node -e "try{new Function(require('fs').readFileSync('public/game.js','utf8'));console.log('✅ Syntax OK')}catch(e){console.log('❌',e.message)}"
```
