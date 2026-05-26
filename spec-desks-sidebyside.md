# 桌子重排：右排移到左邊並排（Spec for OpenCode）

## 目標
把右排 3 張桌子移到左邊，與左排桌子並排。共 6 張桌子都在左側，所有角色也都在左側工作、面朝右。

## 新佈局

原本左排是 3 張垂直排列（x=240），右排 3 張原本在 x=1040。現在全部移到左側：

### 左側第 1 列（原有）
- (240, 280) — 面朝右
- (240, 410) — 面朝右
- (240, 540) — 面朝右

### 左側第 2 列（右排移過來）  
- (380, 280) — 面朝右（從右排搬來，角度改回 +90°）
- (380, 410) — 面朝右
- (380, 540) — 面朝右

也就是 6 張分成兩列，各 3 行，全部在左側，全部面朝右（angle=90°）。

## 需要修改的檔案

### public/game.js

#### 1. drawRoom() — 更新 6 張桌子的位置

```js
// === 6 desks (2 columns x 3 rows, all facing right) ===
if (scene.textures.exists('desk')) {
  // Column 1
  scene.add.image(240, 280, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(90);
  scene.add.image(240, 410, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(90);
  scene.add.image(240, 540, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(90);
  // Column 2
  scene.add.image(380, 280, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(90);
  scene.add.image(380, 410, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(90);
  scene.add.image(380, 540, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(90);
}
```

#### 2. AREAS — 更新位置

```js
const AREAS = {
  col1_top: { x: 240, y: 280 },
  col1_mid: { x: 240, y: 410 },
  col1_bot: { x: 240, y: 540 },
  col2_top: { x: 380, y: 280 },
  col2_mid: { x: 380, y: 410 },
  col2_bot: { x: 380, y: 540 },
  center:  { x: 640, y: 360 },
  lounge:  { x: 640, y: 360 },
};
```

#### 3. MEMBERS — 更新站位

```js
const MEMBERS = [
  { id:'hermes',   label:'Hermes',     role:'🏢 經理',   area:'center',        offset:{x:0,y:0} },
  { id:'codex',    label:'Codex',      role:'📐 架構',   area:'col1_top',      offset:{x:-60,y:0} },
  { id:'openclaw', label:'OpenClaw',   role:'🧪 測試',   area:'col1_mid',      offset:{x:0,y:0} },
  { id:'gemini',   label:'Gemini',     role:'🔍 研究',   area:'col1_bot',      offset:{x:0,y:0} },
  { id:'manus',    label:'Manus',      role:'🎨 UI/UX',  area:'col2_top',      offset:{x:0,y:0} },
  { id:'claude',   label:'Claude Code',role:'💻 開發',   area:'col2_mid',      offset:{x:0,y:0} },
  { id:'opencode', label:'OpenCode',   role:'🔧 優化',   area:'col2_bot',      offset:{x:60,y:0} }
];
```

#### 4. STATES — 更新 area 名稱

```js
const STATES = {
  idle: { name:'待命', area:'center' },
  writing: { name:'整理文檔', area:'col1_top' },
  researching: { name:'搜尋資訊', area:'col1_mid' },
  executing: { name:'執行任務', area:'col2_top' },
  syncing: { name:'同步備份', area:'col2_mid' },
  error: { name:'出錯了', area:'center' }
};
```

#### 5. getAreaLabel — 更新

```js
getAreaLabel: {
  col1_top: '📐 左1上', col1_mid: '🔍 左1中', col1_bot: '🎨 左1下',
  col2_top: '💻 左2上', col2_mid: '🟢 左2中', col2_bot: '🔧 左2下',
  center: '⭐ 中央',
  lounge: '☕ 中央'
}
```

## 檢查
- [ ] 6 張桌子都在左側，分成兩列
- [ ] 全部面朝右（angle=90）
- [ ] 角色站在對應位置
- [ ] Hermes 在中間
- [ ] 無 JS error