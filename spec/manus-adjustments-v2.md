# Spec: Manus 調整 — 移除小櫃子 + 咖啡機右移 + 長桌左移 + 黑邊修復

## 背景
上一步已將所有元素左移 80px，但造成**右邊出現黑邊**（背景圖偏左）。用戶要求：
1. 修復右邊黑邊（背景圖置中）
2. 移除上次新增的右牆壁畫裝飾（用戶說是小櫃子）
3. 咖啡機移到右側靠牆
4. 中央長桌（Hermes 桌）往左移
5. 美學讓 Manus 調整

## 現狀（public/game.js）

### 背景圖（第106行）
```javascript
scene.add.image(560, 360, 'office_bg').setOrigin(0.5).setDepth(0);
```
因為 center 從 640 被移到 560，背景圖偏移造成右邊 80px 黑邊。

### 小櫃子（第199-224行，上次新增的裝飾畫）
```javascript
// Right wall decoration — framed picture
decorG.fillStyle(0x000000, 0.12);
decorG.fillRect(1197, 142, 52, 42);
// ... more framed picture drawing code
```
用戶視為「小櫃子」，要求移除。

### 咖啡機（第167行）
```javascript
const coffeeCompat = scene.add.sprite(60, 220, 'coffee_machine', 0)
  .setOrigin(0.5).setDepth(5).setScale(0.4);
```
原本在左側 (x=120)，上次被左移到 x=60。用戶要求移到右側靠牆。

### 長桌 / 中央區域（第89行）
```javascript
center: { x: 560, y: 360 },
```
指 Hermes 站的中央桌子。用戶要求往左移動。

### 所有 Areas（第84-91行）
```javascript
col1_top: { x: 220, y: 280 },
col1_mid: { x: 220, y: 410 },
col1_bot: { x: 220, y: 540 },
col2_top: { x: 280, y: 280 },
col2_mid: { x: 280, y: 410 },
col2_bot: { x: 280, y: 540 },
center:  { x: 560, y: 360 },
lounge:  { x: 560, y: 360 },
```

## 需求

### 1. 修復右邊黑邊 ⬛
- 背景圖 `scene.add.image(...)` 從 x=560 改回 **x=640**（畫布正中央）
- 讓背景圖完整填滿 1280x720 畫布

### 2. 移除小櫃子（壁畫）❌
- 刪除 game.js 中「Right wall decoration」相關的全部程式碼（第199-224行左右）
- 只刪除這個 framed picture 區塊，不動其他任何東西

### 3. 咖啡機移到右側靠牆 ☕
- 從目前 (x=60) 移到右側牆邊，約 **x=1150~1180**（Manus 決定最佳位置）
- 保持 y=220 和 scale=0.4
- 如果咖啡機 animation 有方向和位置問題，Manus 調整

### 4. 中央長桌往左移 🪑
- `center` AREA 從 x=560 再往左移到 **x=480~500**（Manus 決定最佳視覺位置）
- `lounge` AREA 跟著 center 一起移動
- 底部 plaque 位置跟著 center 對齊

### 5. 視覺平衡（Manus 自由發揮 🎨）
- 檢查兩排桌子 (col1 x=220, col2 x=280) 與新的中央長桌 (x~480-500) 是否視覺協調
- 調整暖光位置配合新布局
- 調整招牌位置保持對齊
- 右邊牆壁空出來後，Manus 判斷是否要放裝飾或留白
- 整體色調、深度層次保持水準

## 不能動到的東西 ⛔
- ❌ 不要改角色 sprite、動畫、名稱
- ❌ 不要改登入系統
- ❌ 不要改 layout.js
- ❌ 不要改 index.html
- ❌ 不要改 server.js 或後端
- ❌ 不要改 floor checkerboard 繪製
- ❌ 不要移除咖啡機 sprite（只是搬位置）
- ❌ 不要移除植物、招牌、6張桌子

## 修改範圍
僅修改：**`public/game.js`**

## 驗證方式
1. 部署後截圖確認右邊無黑邊
2. 確認小櫃子（壁畫）已消失
3. 確認咖啡機在右側
4. 確認中央長桌已左移
5. 確認無 JS console 錯誤
6. 所有角色正確出現在各自位置上