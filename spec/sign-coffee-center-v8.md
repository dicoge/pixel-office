# Pixel Office v8 — 招牌置中 + 咖啡機移到書櫃旁(檯燈右方)

## 修改目標

### 1. 上方招牌 (CENTRAL PERK) — 置中於 x=640 + 往上
**當前位置（v7）：** text(695, 52)，sign board 中心 x=695
**目標：** text(640, 40)，sign board 中心 x=640

修改範圍（drawRoom 內）：
- 陰影：fillRect(605, 42, 180, 24) → **fillRect(550, 30, 180, 24)**（左 55、上 12）
- 外框：fillRect(603, 40, 184, 24) → **fillRect(548, 28, 184, 24)**
- 內框：fillRect(605, 42, 180, 20) → **fillRect(550, 30, 180, 20)**
- 邊框：strokeRect(604, 41, 182, 22) → **strokeRect(549, 29, 182, 22)**
- 左螺絲：fillCircle(610, 46, 2) → **fillCircle(555, 34, 2)**
- 右螺絲：fillCircle(780, 46, 2) → **fillCircle(725, 34, 2)**
- 文字：text(695, 52, 'CENTRAL PERK') → **text(640, 40, 'CENTRAL PERK')**
- 註解改為：`// CENTRAL PERK sign — depth 3 — centered at x=640`

### 2. 下方招牌 (plaque) — 置中於 x=640
**當前位置（v7）：** shift right 10px → x=650
**目標：** 回到 x=640（canvas 正中央）

修改範圍（drawPlaque 內）：所有 x 座標 -10
- 陰影：rect(652, 702, ...) → **rect(642, 702, ...)**
- 外框：rect(650, 700, 260, 28, ...) → **rect(640, 700, 260, 28, ...)**
- 內框：rect(650, 700, 252, 20, ...) → **rect(640, 700, 252, 20, ...)**
- 文字：text(650, 700, ...) → **text(640, 700, ...)**
- 左星：text(535, 700, ...) → **text(525, 700, ...)**
- 右星：text(765, 700, ...) → **text(755, 700, ...)**
- 左點：text(575, 700, ...) → **text(565, 700, ...)**
- 右點：text(725, 700, ...) → **text(715, 700, ...)**

### 3. 咖啡機 — 移到書櫃旁邊(檯燈右方)
**背景分析：** 左側背景圖中：
- 書櫃約在 x=0~130
- 檯燈在約 x=150~240（純白燈罩區域）
- 咖啡機應放在檯燈右下方，緊鄰書櫃/檯燈區域，而非 desk 之間

**當前位置：** sprite(280, 370) — 在 col2 桌子右側（x=270 desks 之間）
**目標位置：** sprite(220, 360) — 左邊房間檯燈(x~200)的右方、書櫃旁

### 4. 暖光 overlay 同步調整（配合咖啡機新位置）
- 左側暖光中心目前在 fillCircle(160, 380, 350)
- 可保持不變（暖光範圍夠大）

## ⛔ 不能動到的東西
- ❌ AREAS / MEMBERS / TOOL_COLORS / 角色位置
- ❌ desks 位置（col1=160, col2=270 不動）
- ❌ plant 位置（x=1090 不動）
- ❌ 任何 sprite 動畫
- ❌ 背景圖片

## 驗證
```bash
cd /home/dicoge/pixel-office && node -e "try{new Function(require('fs').readFileSync('public/game.js','utf8'));console.log('✅ Syntax OK')}catch(e){console.log('❌',e.message)}"
```