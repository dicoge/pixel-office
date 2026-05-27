# Pixel Office v7 — 招牌微調 + 咖啡機定位到左邊房間檯燈右方

## 修改目標

### 1. 上方招牌 (CENTRAL PERK) — 往左 5px、往上 10px
**當前位置：**
- Sign 木框：fillRect(608, 50, 184, 24) / fillRect(610, 52, 180, 20)
- 陰影：fillRect(610, 52, 180, 24)
- 金色邊框：strokeRect(609, 51, 182, 22)
- 螺絲：fillCircle(615, 56, 2) / fillCircle(785, 56, 2)
- 文字：scene.add.text(700, 62, 'CENTRAL PERK', ...)

**修改後：** 所有 x 座標 -5，所有 y 座標 -10
- Sign 外框：fillRect(603, 40, 184, 24)
- Sign 內框：fillRect(605, 42, 180, 20)
- 陰影：fillRect(605, 42, 180, 24)
- 邊框：strokeRect(604, 41, 182, 22)
- 螺絲左：fillCircle(610, 46, 2)
- 螺絲右：fillCircle(780, 46, 2)
- 文字：scene.add.text(695, 52, 'CENTRAL PERK', ...)

### 2. 下方招牌 (plaque) — 往右 10px
**當前位置（drawPlaque 函數）：**
- 陰影：scene.add.rectangle(642, 702, 266, 30, ...)
- plaque：scene.add.rectangle(640, 700, 260, 28, ...)
- 內框：scene.add.rectangle(640, 700, 252, 20, ...)
- 文字：scene.add.text(640, 700, '☕ Pixel Office — Central Perk', ...)
- 左星：scene.add.text(525, 700, '⭐', ...)
- 右星：scene.add.text(755, 700, '⭐', ...)
- 左點：scene.add.text(565, 700, '·', ...)
- 右點：scene.add.text(715, 700, '·', ...)

**修改後：** 所有 x 座標 +10
- 陰影：scene.add.rectangle(652, 702, 266, 30, ...)
- plaque：scene.add.rectangle(650, 700, 260, 28, ...)
- 內框：scene.add.rectangle(650, 700, 252, 20, ...)
- 文字：scene.add.text(650, 700, '☕ Pixel Office — Central Perk', ...)
- 左星：scene.add.text(535, 700, '⭐', ...)
- 右星：scene.add.text(765, 700, '⭐', ...)
- 左點：scene.add.text(575, 700, '·', ...)
- 右點：scene.add.text(725, 700, '·', ...)

### 3. 咖啡機 — 移到左邊房間檯燈右方
**當前位置：** x=480, y=370（在中央走道，不在左邊房間）
**背景分析：** 左邊房間的檯燈在背景圖中約 x=200~210, y=200~240（白色燈罩區域）
**目標位置：** x=280, y=370（左邊房間內，col2 桌子 x=270 右側，檯燈右方）

修改：`scene.add.sprite(280, 370, 'coffee_machine', 0)`

### 驗證方式
```bash
cd /home/dicoge/pixel-office
node -e "try{new Function(require('fs').readFileSync('public/game.js','utf8'));console.log('✅ Syntax OK')}catch(e){console.log('❌',e.message)}"
```