# Pixel Office → Star Office 移植計畫

## 目標
將現有 Pixel Office (Node.js + Express + sql.js) 的**前端 UI** 全面替換成 Star Office UI 的像素風格辦公室場景，保留後端所有功能（Auth、部門、任務、Worker、稽核、Hermes Bridge）。

## 核心原則
1. **後端完全不動** — `src/server.js`, `src/db.js` 不修改
2. **前端全面翻新** — 只改 `public/` 目錄
3. **採用 Phaser 3 遊戲引擎** — 繪製像素辦公室場景 + 角色動畫
4. **保留所有管理功能** — 部門/任務/Worker/稽核仍可從側邊欄/overlay 存取

## 技術架構

```
瀏覽器                          Render.com
┌──────────────────┐          ┌──────────────┐
│ index.html       │   HTTP   │ Node.js      │
│  (single page)   │◄────────►│ Express      │
│                  │ REST API │ Server       │
│ ┌──────────────┐ │          │ (port 3000)  │
│ │ Phaser 3     │ │          │              │
│ │ Canvas       │ │          │ sql.js DB    │
│ │ (辦公室場景) │ │          │ 部門/任務/    │
│ └──────────────┘ │          │ Worker/稽核   │
│                  │◄────────►│              │
│ ┌──────────────┐ │ WebSocket│ Hermes       │
│ │ HTML Overlay │ │ Bridge   │ Bridge       │
│ │ (側欄/模態框)│ │          │ (WS Server)  │
│ └──────────────┘ │          └──────────────┘
└──────────────────┘
```

## 辦公室區域映射（部門 → 房間）

| 部門 | Star Office 區域 | 像素角色動畫 |
|------|-----------------|-------------|
| 🎮 遊戲開發部 | 工作區（辦公桌） | 打字/寫 code 動畫 |
| 📊 投資研究部 | 工作區（書櫃側） | 翻書/搜尋動畫 |
| 🎯 任務執行部 | 伺服器區 | 同步動畫 |
| 📋 稽核日誌部 | 休息區 | 待命動畫 |
| ⚙️ 系統狀態 | Bug 區 | 修 bug 動畫 |

## 6 種狀態 → 位置映射

| 狀態 | 辦公室區域 | 觸發場景 |
|------|-----------|---------|
| `idle` | 🛋 休息區（沙發） | 待命 / 任務完成 |
| `writing` | 💻 工作區（辦公桌） | 寫 code / 寫文件 |
| `researching` | 💻 工作區（書櫃側） | 搜尋 / 調研 |
| `executing` | 💻 工作區（辦公桌） | 執行命令 / 跑任務 |
| `syncing` | 💻 伺服器區 | 同步數據 / 推送 |
| `error` | 🐛 Bug 區 | 報錯 / 異常排查 |

## 現有前端 API 保持不變

所有現有後端 endpoint 保持不變：
- `POST /auth/login` — JWT 登入
- `POST /auth/register` — 註冊
- `GET /api/tasks` — 任務列表
- `POST /api/tasks` — 新增任務
- `GET /api/departments` — 部門列表
- `GET /api/stats` — 全域統計
- `GET /api/workers` — Worker 狀態
- `GET /api/audit` — 稽核日誌
- `POST /api/hermes-reply` — Hermes 回覆端點
- WebSocket — Hermes Bridge

## 檔案改動清單（只改 public/ 目錄）

### 新增檔案
1. `public/game.js` — Phaser 3 遊戲主邏輯（參考 Star Office UI 的 game.js + layout.js）
2. `public/layout.js` — 座標與佈局配置
3. `public/office_bg.webp` — 辦公室背景圖（可先沿用 Star Office UI 的或自製）
4. `public/cats-spritesheet.webp` — 角色 sprite sheet
5. `public/desk-v3.webp` — 辦公桌圖
6. `public/sofa-idle-v3.png` — 沙發圖
7. `public/coffee-machine-v3-grid.webp` — 咖啡機
8. `public/flowers-bloom-v2.webp` — 花盆
9. `public/posters-spritesheet.webp` — 海報
10. `public/error-bug-spritesheet-grid.webp` — Bug 動畫
11. `public/sync-animation-v3-grid.webp` — 同步動畫
12. `public/serverroom-spritesheet.webp` — 伺服器區
13. `public/star-working-spritesheet-grid.webp` — 工作角色動畫
14. `public/memo-bg.webp` — 備忘錄背景
15. `public/plants-spritesheet.webp` — 植物
16. `public/star-idle-v5.png` — 待命角色

### 取代檔案
17. `public/index.html` — **完全重寫**（現有 2738 行 → 新的單頁應用）
18. `public/db.js` — **不變**（前端 DB 工具函數）

### 不修改
- `src/server.js` — 後端完全不動
- `src/db.js` — 後端 DB 層不動
- `package.json` — 依賴不動
- `Dockerfile` — 部署配置不動
- `render.yaml` — Render 配置不動

## Phaser 3 整合方式

1. **初始化**：`index.html` 載入 Phaser CDN (`https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js`)
2. **Canvas**：Phaser 建立 1280×720 像素畫布，放在 `#game-container` div
3. **Overlay**：HTML 元素（狀態面板、側邊欄、按鈕）疊在 Canvas 上方，使用 `position: absolute` + `pointer-events`
4. **資料流**：前端 fetch 後端 API → 更新 Phaser 角色狀態/位置

## 使用者流程

1. **登入頁**（改為像素風格登入畫面，仍保留 JWT auth）
2. **登入後** → 進入辦公室主畫面（Phaser Canvas）
   - 背景：辦公室場景
   - 角色：根據登入使用者顯示一個像素角色
   - 角色位置：根據當前狀態自動走到對應區域
3. **側邊欄**（點擊「☰」展開）
   - 部門列表（遊戲開發部/投資研究部/任務執行部/稽核日誌部/系統狀態）
   - 每部門顯示：名稱 + 狀態 + 當前任務數
4. **點擊部門** → 切換視角到該部門區域 + 顯示詳細疊加層
5. **底部狀態列**：顯示目前 Agent 狀態、Hermes 連線狀態
6. **右側資訊面板**：顯示昨日小記、即時任務資訊

## 實作優先順序

### P0 — 必須有（核心可運作）
1. [ ] Phaser 3 初始化 + Canvas 渲染
2. [ ] 辦公室背景 + 家具（沙發、辦公桌、咖啡機、伺服器）
3. [ ] 像素角色顯示 + 基本動畫（待命/工作）
4. [ ] 角色根據狀態走到對應區域（idle→沙發, working→辦公桌, error→bug區）
5. [ ] 登入流程整合（保留 JWT）
6. [ ] 側邊欄顯示部門列表

### P1 — 重要（體驗完整）
7. [ ] 角色動畫 spritesheet（走路、工作、休息）
8. [ ] 對話氣泡顯示狀態描述
9. [ ] 點擊部門切換視角/顯示資訊
10. [ ] 昨日小記功能
11. [ ] Hermes 連線狀態指示器

### P2 — 加分（美觀升級）
12. [ ] 裝飾物件（花盆、海報、貓）
13. [ ] 背景動畫（時鐘、飄動）
14. [ ] 多語言支援
15. [ ] 移動端適配（響應式）
16. [ ] 管理者後台存取（原有的任務/Worker/稽核頁面）

## 美術資源版權注意
- Star Office UI 的美術資產**禁止商用**（MIT code, art non-commercial）
- 我們只是學習/改造用途，可以先用 Star Office UI 的 asset
- 如果要上生產環境商用，需要替換為自製素材

## 技術決策
- **Phaser 3.60+** — 穩定、支援 pixelArt mode
- **不引入額外前端框架** — 保持輕量，純 JS + Phaser
- **CSS 變數** — 沿用現有像素色板系統
- **Image rendering** — `image-rendering: pixelated` 確保像素清晰
- **WebP 優先** — 不透明圖片用 WebP，透明圖片用 PNG