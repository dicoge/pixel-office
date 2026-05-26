# Pixel Office v9 — 角色坐沙發 + 辨識度優化

## 問題
1. **沙發區角色在罰站** — Codex、OpenClaw、OpenCode 在沙發區域看起來是站著的，應該要坐著
2. **Claude Code 跟 OpenCode 長一樣** — guest_anim_5.webp 和 guest_anim_6.webp 是**完全相同的精靈圖**
3. **辨識度不足** — 需要讓 7 個角色各有不同外觀，一眼能認出

## 技術分析（已確認）
### 精靈圖比對
| Sprite | 上下像素比 | 角色型態 | 外觀顏色 |
|--------|-----------|---------|---------|
| guest_anim_1 | 0.98 | 站立 | 藍+黃 |
| guest_anim_2 | **0.16** | **坐著** | 淺綠 |
| guest_anim_3 | 0.67 | 平衡 | 金色 |
| guest_anim_4 | 1.33 | 站立 | 深綠 |
| guest_anim_5 | 1.76 | 站立 | 紅色 |
| guest_anim_6 | 1.76 | 站立 | 紅色（與5完全相同）|
| guest_role_5 | 獨立 | 不同角色 | 不同顏色設計 |

- guest_anim_5 和 guest_anim_6 像素完全一致 → 造成 Claude 和 OpenCode 長一樣
- guest_role_5.png 是**不同的 spritesheet**（8 幀動畫），可替代 guest_anim_6

### 沙發區域
- 紅色沙發在 (200,470)~(480,528) 之間
- 沙發坐墊高度約 y=505
- 角色要像「坐著」需要：使用坐姿精靈圖 + 正確的 Y 座標 + 適當縮放

## 修改方案

### 1. 角色精靈圖重新分配
| 成員 | 區域 | 使用精靈圖 | 原因 |
|------|------|-----------|------|
| Codex | 沙發左 | guest_anim_2 | 唯一真正的坐姿精靈 (upper/lower=0.16) |
| OpenClaw | 沙發中 | guest_role_5 | 不同於 guest_anim_5/6 的獨立設計 |
| OpenCode | 沙發右 | guest_anim_3 | 平衡型精靈，適合坐著 |
| Gemini | 左桌 1 | guest_anim_1 | 站立型，符合桌邊工作 |
| Manus | 左桌 2 | guest_anim_4 | 站立型，符合桌邊工作 |
| Claude Code | 右桌 | guest_anim_5 | 紅色站立型 |

### 2. 沙發區角色坐姿調整
- **Codex** → y=505（坐墊高度），scale=1.2（略小顯坐著）
- **OpenClaw** → y=505（坐墊高度），scale=1.2
- **OpenCode** → y=505（坐墊高度），scale=1.2

### 3. 桌邊角色站立
- **Gemini** → y=390（桌面高度），scale=1.5
- **Manus** → y=390，scale=1.5
- **Claude Code** → y=470，scale=1.5

### 4. guest_role_5 載入
- guest_role_5.png 是 128x64 的 spritesheet（同 guest_anim 格式）
- 載入方式：`this.load.spritesheet('guest_anim_7', '/guest_role_5.png', { frameWidth: 32, frameHeight: 32 })`
- 動畫：frames 0~5，frameRate 6，repeat -1
- 使用 `guest_anim_7` 作為 key

### 5. 移除重複載入
- 不要載入 `guest_anim_6.webp`（跟 guest_anim_5 一樣）
- 改載入 `guest_role_5.png` 作為替代

## 修改檔案
- `/tmp/pixel-office/public/game.js` — preload, placeCharacters (精靈圖分配、位置、縮放)

## 不修改
- 背景、家具、狀態面板、API 整合、氣泡系統 — 維持 v8 不變

## 驗收條件
1. 沙發區 3 個角色看起來是坐著的（y 在坐墊高度）
2. 桌邊 3 個角色是站立的（y 在桌面高度）
3. Claude Code 和 OpenCode 外觀不同
4. 7 個角色各有不同顏色/外觀
5. 載入無錯誤