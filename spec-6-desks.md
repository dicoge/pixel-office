# 添加 6 張旋轉桌子 + 角色配置（Spec for OpenCode）

## 目標
將 `desk-v3.webp`（276x214px，已存在於 public/ 目錄）在遊戲中放置 6 張，每張旋轉 90°，分左右兩排各 3 張，讓代理商面對面坐。

## 佈局規劃

中央區（Hermes 站）保持在 x=640, y=360 左右。

### 左排（面朝右，rotation=90°）
- desk L1: x=240, y=280  （上）
- desk L2: x=240, y=410  （中）
- desk L3: x=240, y=540  （下）

### 右排（面朝左，rotation=-90°）
- desk R1: x=1040, y=280  （上）
- desk R2: x=1040, y=410  （中）
- desk R3: x=1040, y=540  （下）

每張 desk scale=0.45（配合版面大小）

## 需要修改的檔案

### public/game.js

#### 1. preload() — 已存在 desk 載入
```js
this.load.image('desk', '/desk-v3.webp');  // already added
```

#### 2. drawRoom() — 在 Plant 後、VIGNETTE 前加入 6 張桌子

用 Phaser image 方式，refer to existing texture：

```js
// === 6 desks (3 left facing right, 3 right facing left) ===
if (scene.textures.exists('desk')) {
  // Left row — face right
  scene.add.image(240, 280, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(90);
  scene.add.image(240, 410, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(90);
  scene.add.image(240, 540, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(90);
  
  // Right row — face left
  scene.add.image(1040, 280, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(-90);
  scene.add.image(1040, 410, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(-90);
  scene.add.image(1040, 540, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(-90);
}
```

替換現有的單張桌子（目前 drawRoom 中有 `scene.add.image(340, 490, 'desk')`），換成 6 張。

#### 3. AREAS — 調整角色站位

在 game.js 中，找到 AREAS 定義。左排角色站在左桌右側（面朝右），右排角色站在右桌左側（面朝左）。

目前 AREAS 有 lounge, desk_gemini, desk_manus, desk_claude, desk_reserved 等。改為：

```js
const AREAS = {
  left_top:    { x: 240, y: 280, label: '左列上' },
  left_mid:    { x: 240, y: 410, label: '左列中' },
  left_bot:    { x: 240, y: 540, label: '左列下' },
  right_top:   { x: 1040, y: 280, label: '右列上' },
  right_mid:   { x: 1040, y: 410, label: '右列中' },
  right_bot:   { x: 1040, y: 540, label: '右列下' },
  center:      { x: 640, y: 360, label: '中央' },
};
```

#### 4. MEMBERS — 分配角色到新站位

MEMBERS 陣列中每個 member 有 `area` 和 `offset`。分配：

- Hermes (hermes) → center
- Codex (codex) → left_top
- OpenClaw (openclaw) → left_mid
- Gemini (gemini) → left_bot
- Manus (manus) → right_top
- Claude Code (claude) → right_mid
- OpenCode (opencode) → right_bot

保留原本的 offset。注意角色 sprite 大小（32x32），站位在桌子旁邊適當位置。

#### 5. 移除咖啡機（選擇性）
目前的咖啡機 `scene.add.sprite(120, 220, 'coffee_machine')` 如果不符合新佈局可以保留或移除。

## 檢查事項
- [ ] 6 張桌子都顯示，方向正確（左排→右、右排→左）
- [ ] 7 個角色站在正確位置
- [ ] 無 JS console error
- [ ] 所有角色有陰影
- [ ] 桌子和角色 depth 正確（桌子 depth=3，角色 depth=10+）