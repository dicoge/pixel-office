# 桌子重排：左排轉180° + 兩排併攏放左邊中間（Spec for OpenCode）

## 目標
1. 左排（第1列）桌子轉 180°：從 angle=90 改成 angle=-90（面朝左）
2. 兩排桌子併在一起（間距約 60px）
3. 整組放在「左邊房間的中間」（x 約 300~360）

## 新佈局

兩排併攏，放在畫面左半邊的中央區域：

```
Col 1 (面朝左, angle=-90):  x=300, y=280,410,540
Col 2 (面朝右, angle=90):   x=360, y=280,410,540
```

兩排間距 60px，放在左半邊（x=0~640）的中間區域。

## 需要修改

### public/game.js — drawRoom()

把原本的：
```
scene.add.image(580, 280, 'desk')...setAngle(90)
scene.add.image(580, 410, 'desk')...setAngle(90)
scene.add.image(580, 540, 'desk')...setAngle(90)
scene.add.image(640, 280, 'desk')...setAngle(90)
scene.add.image(640, 410, 'desk')...setAngle(90)
scene.add.image(640, 540, 'desk')...setAngle(90)
```

改成：
```js
  // Column 1 — facing LEFT
  scene.add.image(300, 280, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(-90);
  scene.add.image(300, 410, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(-90);
  scene.add.image(300, 540, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(-90);
  // Column 2 — facing RIGHT
  scene.add.image(360, 280, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(90);
  scene.add.image(360, 410, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(90);
  scene.add.image(360, 540, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(90);
```

### AREAS — 更新 x 位置

```js
const AREAS = {
  col1_top: { x: 300, y: 280 },
  col1_mid: { x: 300, y: 410 },
  col1_bot: { x: 300, y: 540 },
  col2_top: { x: 360, y: 280 },
  col2_mid: { x: 360, y: 410 },
  col2_bot: { x: 360, y: 540 },
  center:  { x: 640, y: 360 },
  lounge:  { x: 640, y: 360 },
};
```

## 檢查
- [ ] 左排面朝左（-90°）、右排面朝右（90°）
- [ ] 兩排併在左半邊中間（x=300,360）
- [ ] 角色站位在對應位置
- [ ] 無 JS error