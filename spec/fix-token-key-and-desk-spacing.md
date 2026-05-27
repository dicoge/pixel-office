# Spec: 修復 QA 發現的 Bug + 桌面間距調整

## 修改 1：修復 token key bug 🔴

### 問題
`fetchStatus()` 函數（game.js 第531行）使用：
```javascript
const token = localStorage.getItem('token');  // → null
```
但登入時 token 存入的是 `pixel_office_token`。這導致：
- token 永遠為 null
- fetchStatus 在 if(!token) return 直接返回
- 狀態永遠停在「載入中...」
- 角色不會根據 worker 狀態更新位置

### 修復
改成：
```javascript
const token = localStorage.getItem('pixel_office_token');
```
或在 game.js 中確認實際儲存的 key 名稱。

## 修改 2：桌面間距調整 🪑

### 問題
兩列桌子位置：
- col1: x=220（3張，角度 -90°）
- col2: x=280（3張，角度 90°）
- 間距僅 60px

桌子 sprite 寬 276px（scale=0.45 時約 124px），導致兩列嚴重重疊。

### 要求
拉開兩列桌子距離，Manus 決定最佳間距（建議至少 130px 以上）。
- col1 維持在較左位置（如 x=200）
- col2 移到適當位置（如 x=350 或其他 Manus 判斷的最佳值）
- 三行 y 位置保持不變（280/410/540）
- 角色 AREA 跟著桌子移動

## 附帶調整
- 暖光左側位置跟著 col1 微調
- 角色 col1_top/mid/bot 和 col2_top/mid/bot 的 x 位置跟著桌子
- 確保角色 offset 也跟著調整（Codex offset.x=-60、OpenCode offset.x=60）
- 兩排桌子角度不變（col1=-90°, col2=90°）

## 不能動到的東西 ⛔
- ❌ 不要改角色 sprite、動畫
- ❌ 不要改登入系統
- ❌ 不要改 layout.js、index.html、server.js
- ❌ 不要改 floor 繪製
- ❌ 不要改背景圖位置（x=640）
- ❌ 不要改咖啡機、植物位置（已經用戶確認）
- ❌ 不要改招牌、plaque、對話泡泡位置

## 修改範圍
僅修改 **`public/game.js`**：
1. token key 字串改正
2. col1/col2 桌子 x 座標拉開間距
3. AREA col1/col2 x 座標跟著調整
4. 暖光左側跟著微調