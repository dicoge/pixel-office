# Pixel Office v3 — 完整重構規格書

## 目標
將現有 Pixel Office (Phaser 3 像素辦公室) 完全重構，符合以下需求：

1. **三房間布局**（左到右）：☕茶水間(0-400) → 🏢辦公室(400-2050) → ⭐經理室(2050-2560)
2. **比例協調**：角色與家具比例要一致，不要角色小家具大
3. **角色外觀**：每個角色不同，參考各 tool logo 配色
4. **地圖可滾動**：Phaser 攝影機跟隨 Hermes

## 技術棧
- Phaser 3.60 (Canvas mode)
- Phaser Scale.FIT + CENTER_BOTH（手機適配）
- Phaser Camera 跟隨 Star 角色
- 世界大小：2560 x 720
- 視口大小：1280 x 720（Scale.FIT 自動縮放）

## 房間配置細節

### Room 1: ☕ 茶水間 (x: 0-400, 寬 400px)
- 背景：深棕色系牆壁 (#3e2723)，棋盤格地板 (16px)
- 家具：小沙發、茶几、冰箱、吧台、窗戶、架子、檯燈
- 區域：lounge (x:200, y:340)、pantry_table (x:120, y:420)

### Room 2: 🏢 辦公室 (x: 400-2050, 寬 1650px)
- 背景：使用 office_bg.webp 置於 (1225, 360)
- **2 大桌（中間區）**：
  - 左大桌：Codex 架構 — 藍色主題 (#1565c0)
  - 右大桌：OpenClaw 測試 — 紅色主題 (#c62828)
- **4 小桌（四角）**：
  - 左上小桌：Gemini 研究 — 紫色 (#6a1b9a)
  - 右上小桌：Manus UI/UX — 橙色 (#e65100)
  - 左下小桌：Claude Code 開發 — 綠色 (#2e7d32)
  - 右下小桌：OpenCode 優化 — 黃色 (#f9a825)
- 其他：咖啡機 (scale 0.5)、伺服器機架、沙發、植物、貓
- 區域：desk_big_left/right、desk_small_1~4、serverroom、breakroom

### Room 3: ⭐ 經理室 (x: 2050-2560, 寬 510px)
- 背景：深紫色系牆壁 (#1a0a2e)，棋盤格地板 (深紫)
- 家具：辦公桌、書櫃、觀景窗（含星星）、金黃色檯燈
- 區域：manager_desk (x:2300, y:340)
- 角色：Hermes 專屬

## 角色系統

7 位成員，每位有：
1. **角色 Sprite**（32x32 guest_anim spritesheet 縮放至適中比例）
2. **Tool Logo Badge**（角色頭頂顯示對應 emoji/icon）
3. **名字標籤**（角色下方 monospace 白色文字）
4. **狀態燈號**（底部面板顯示 idle/writing/error 狀態）

### 角色配色對照
| 角色 | ID | Logo Icon | spriteIdx | 站點 |
|------|-----|-----------|-----------|------|
| Hermes | hermes | ⭐ | 0 (star sprite) | manager_desk |
| Codex | codex | 📘 | 3 (藍色) | desk_big_left |
| OpenClaw | openclaw | 🦞 | 6 (青色) | desk_big_right |
| Gemini | gemini | 🔮 | 4 (紫色) | desk_small_1 |
| Manus | manus | ✍️ | 1 (粉紅) | desk_small_2 |
| Claude Code | claude | 🟢 | 2 (綠色) | desk_small_3 |
| OpenCode | opencode | 🔧 | 5 (黃色) | desk_small_4 |

- **guest_anim spritesheet**：32x32 像素，使用 scale 1.2
- **Hermes (star)**：star-idle-v5.png，scale 0.4
- **角色走動**：根據 worker status 在不同區域間移動

## 狀態系統
- idle → lounge（茶水間休息）
- writing → desk_small_3（寫程式）
- researching → desk_small_1（研究）
- executing → desk_small_4（執行任務）
- syncing → serverroom（同步）
- error → desk_big_right（出錯）

## 互動元素
- 貓咪點擊：換造型（cats spritesheet 隨機 frame）
- 點擊畫面：重新整理 worker 狀態

## 攝影機
- 跟隨對象：star (Hermes)
- lerp：0.08（平滑跟隨）
- 世界邊界：0,0 ~ 2560,720

## 底部面板
- 顯示全部 7 位成員的即時狀態
- 燈號顏色：綠(idle) / 黃(working) / 紅(error) / 藍(syncing)
- 顯示當前所在區域名稱

## 檔案結構
- `public/layout.js` — 所有座標、區域、家具配置
- `public/game.js` — Phaser 場景邏輯、繪圖、互動
- `public/index.html` — 入口頁面（保持現有，通常不動）

## 現有問題（本次需要修的）
1. ⬜ 角色與家具比例不協調 — 所有家具縮小，scale 統一
2. ⬜ 房間區隔不明顯 — 加入牆壁/門口通道視覺
3. ⬜ 角色 badge 位置可能偏移 — 確保跟隨角色移動
4. ⬜ 茶水間和經理室的自繪背景需完善 — 家具更豐富
5. ⬜ 貓咪不在正確位置
6. ⬜ 房間標籤不明顯