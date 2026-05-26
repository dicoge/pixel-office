# 桌子重排：左排轉180° + 兩排併攏放中間（Spec for OpenCode）

## 目標
1. 左排（第1列）桌子轉 180°：從 angle=90 改成 angle=-90（面朝左）
2. 兩排桌子併在一起（間距縮小到約 40px）
3. 整組移到畫面中央（x 約 560~620）

## 新佈局

原本在 x=240 和 x=380。現在移到中央：

```
Col 1 (面朝左, angle=-90):  x=580, y=280,410,540
Col 2 (面朝右, angle=90):   x=640, y=280,410,540
```

兩排間距 60px，置中於 x=610 左右，放在畫面中央區域。

## 需要修改

### public/game.js — drawRoom()

```js
// Column 1 — facing LEFT
scene.add.image(580, 280, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(-90);
scene.add.image(580, 410, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(-90);
scene.add.image(580, 540, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(-90);
// Column 2 — facing RIGHT
scene.add.image(640, 280, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(90);
scene.add.image(640, 410, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(90);
scene.add.image(640, 540, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(90);
```

### AREAS

```js
const AREAS = {
  col1_top: { x: 580, y: 280 },
  col1_mid: { x: 580, y: 410 },
  col1_bot: { x: 580, y: 540 },
  col2_top: { x: 640, y: 280 },
  col2_mid: { x: 640, y: 410 },
  col2_bot: { x: 640, y: 540 },
  center:  { x: 640, y: 360 },
  lounge:  { x: 640, y: 360 },
};
```

### MEMBERS, STATES, getAreaLabel — 都保持 col1/col2 名稱不變

只改桌子的 x 位置和 angle。

## 檢查
- [ ] 左排面朝左（-90°）、右排保持面朝右（90°）
- [ ] 兩排緊貼中央
- [ ] 角色站位正確
- [ ] 無 JS error