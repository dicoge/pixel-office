# Pixel Office UI/UX 改造方案

**版本**: v2.0  
**更新日期**: 2026-05-20  
**狀態**: 規劃中

---

## 1. 設計目標與原則

### 1.1 核心問題

| 問題 | 現況 | 目標 |
|------|------|------|
| 無 RWD | 固定寬度，手機體驗差 | 三段式響應式適配 |
| 字體不清 | 像素字體過小、渲染不佳 | 層次化字體系統 |
| 像素風格不足 | 僅部分元素像素化 | 全面像素美學 |
| 導航混亂 | Tab 過多，佔用空間大 | 適應性底部導航 |

### 1.2 設計原則

1. **Mobile-First**: 從最小螢幕開始，逐步增強
2. **像素一致性**: 所有元素對齊 4px / 8px 網格
3. **16 色 Palette**: 嚴格遵守像素調色盤
4. **效能優先**: 減少 DOM 節點，避免過度動畫

---

## 2. 16 色像素調色盤 (CSS Variables)

### 2.1 完整調色盤

```css
:root {
  /* === 基本色 === */
  --c-black:      #1a1a2e;  /* 主背景 */
  --c-darkblue:   #16213e;  /* 面板背景 */
  --c-purple:     #4a2c7a;  /* 強調色 */
  --c-green:      #0f9b0f;  /* 主要動作 */
  --c-brown:      #8b4513;  /* 邊框/陰影 */
  
  /* === 灰階 === */
  --c-darkgray:   #2d2d2d;  /* 次要背景 */
  --c-gray:       #6b6b6b;  /* 禁用/次要文字 */
  --c-silver:     #a0a0a0;  /* 標籤/提示 */
  --c-white:      #f0f0f0;  /* 主要文字 */
  
  /* === 狀態色 === */
  --c-red:        #e74c3c;  /* 錯誤/危險 */
  --c-orange:     #e67e22;  /* 警告 */
  --c-yellow:     #f1c40f;  /* 主要強調 */
  --c-lime:       #2ecc71;  /* 成功/在線 */
  
  /* === 裝飾色 === */
  --c-cyan:       #00d4aa;  /* 資訊/連結 */
  --c-blue:       #3498db;  /* 進行中 */
  --c-pink:       #ff69b4;  /* 特殊強調 */
  --c-peach:      #ffb347;  /* 熱門/提示 */
}
```

### 2.2 調色盤應用規則

| 用途 | 顏色 | 範例 |
|------|------|------|
| 主按鈕 | `--c-green` | 登入、主要動作 |
| 警告按鈕 | `--c-orange` | 取消、危險操作 |
| 錯誤/刪除 | `--c-red` | 錯誤狀態 |
| 成功/在線 | `--c-lime` | 完成狀態、連線中 |
| 標題強調 | `--c-yellow` | Logo、標題 |
| 資訊/連結 | `--c-cyan` | 戳記、資訊 |

---

## 3. 響應式設計 (RWD)

### 3.1 斷點系統

```
┌─────────────────────────────────────────┐
│  Mobile      < 768px    → 單欄 / 底部導航  │
├─────────────────────────────────────────┤
│  Tablet      768-1024px  → 雙欄 / 側邊折疊  │
├─────────────────────────────────────────┤
│  Desktop     > 1024px   → 多欄 / 完整視圖  │
└─────────────────────────────────────────┘
```

### 3.2 各斷點詳細規格

#### Mobile (<768px)

```css
/* === 佈局 === */
- 單欄佈局，全寬卡片
- 底部固定導航列 (56px 高)
- 頂部標題列收納 (44px 高)
- 內距: 12px

/* === 導航 === */
- 漢堡選單按鈕 (左側)
- Logo 居中
- 公司切換下拉 (右側)
- 底部 5 個 Tab 圖示導航

/* === 卡片 === */
- 全寬，無陰影
- 邊框: 2px solid
- 圓角: 0px (像素風格)
- 內距: 12px

/* === 字體 === */
- 主標題: 10px
- 副標題: 8px
- 內文: 7px
- 標籤: 6px
```

#### Tablet (768-1024px)

```css
/* === 佈局 === */
- 雙欄佈局 (側邊欄 280px + 主內容)
- 側邊欄可折疊
- 內距: 16px

/* === 導航 === */
- 左側圖示+文字垂直導航
- 可折疊為僅圖示模式
- 頂部保持公司切換

/* === 卡片 === */
- 雙欄網格 (repeat-2)
- 陰影: 4px offset
- 邊框: 3px solid
- 內距: 16px

/* === 字體 === */
- 主標題: 11px
- 副標題: 9px
- 內文: 8px
- 標籤: 7px
```

#### Desktop (>1024px)

```css
/* === 佈局 === */
- 三欄/四欄佈局
- 側邊欄固定 300px
- 主內容區域彈性

/* === 導航 === */
- 完整水平 Tab 導航
- 搜尋框
- 通知鈴鐺

/* === 卡片 === */
- 三欄網格 (repeat-3)
- 四欄統計卡片
- 懸停效果

/* === 字體 === */
- 主標題: 12px
- 副標題: 10px
- 內文: 9px
- 標籤: 8px
```

### 3.3 網格系統

```css
/* === 間距 === */
--space-1: 4px;   /* 元素內 */
--space-2: 8px;   /* 元素間 */
--space-3: 12px;  /* 區塊內 */
--space-4: 16px;  /* 區塊間 */
--space-5: 24px;  /* 區塊外 */
--space-6: 32px;  /* 大區塊 */

/* === 卡片網格 === */
.grid {
  display: grid;
  gap: var(--space-4);
}

.grid-mobile { grid-template-columns: 1fr; }
.grid-tablet  { grid-template-columns: repeat(2, 1fr); }
.grid-desktop { grid-template-columns: repeat(3, 1fr); }
.grid-wide   { grid-template-columns: repeat(4, 1fr); }
```

---

## 4. 像素風格優化

### 4.1 字體層次系統

```css
/* === Press Start 2P 層次 === */
.font-hero    { font-size: clamp(12px, 4vw, 16px); }  /* Logo 主要標題 */
.font-title   { font-size: clamp(10px, 3vw, 12px); }  /* 頁面標題 */
.font-heading { font-size: clamp(9px, 2.5vw, 10px); } /* 卡片標題 */
.font-body    { font-size: clamp(8px, 2vw, 9px); }    /* 內文 */
.font-caption { font-size: clamp(7px, 1.8vw, 8px); }  /* 說明文字 */
.font-micro   { font-size: clamp(6px, 1.5vw, 7px); }  /* 標籤/元資料 */
```

### 4.2 像素化渲染

```css
/* === 圖像渲染 === */
img, canvas, svg {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

/* === 文字渲染優化 === */
.pixel-text {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
}
```

### 4.3 按鈕像素樣式

```css
/* === 基本像素按鈕 === */
.pixel-btn {
  /* 尺寸 */
  padding: 10px 16px;
  min-height: 44px;  /* 觸控目標 */
  
  /* 框線 - 像素風格關鍵 */
  border: 3px solid var(--c-white);
  border-top-color: var(--c-white);
  border-right-color: var(--c-white);
  border-bottom-color: var(--c-darkgray);  /* 陰影 */
  border-left-color: var(--c-darkgray);
  
  /* 背景 */
  background: var(--c-green);
  
  /* 文字 */
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  color: var(--c-white);
  text-transform: uppercase;
  
  /* 陰影 */
  box-shadow: 
    inset -2px -2px 0 rgba(0,0,0,0.2),
    2px 2px 0 var(--c-darkgray);
  
  /* 像素化過渡 */
  transition: transform 50ms, box-shadow 50ms;
}

.pixel-btn:hover {
  background: var(--c-lime);
  transform: translate(-1px, -1px);
  box-shadow: 
    inset -2px -2px 0 rgba(0,0,0,0.2),
    3px 3px 0 var(--c-darkgray);
}

.pixel-btn:active {
  transform: translate(2px, 2px);
  box-shadow: 
    inset 2px 2px 0 rgba(0,0,0,0.2),
    none;
}

/* === 按鈕變體 === */
.pixel-btn--danger  { background: var(--c-red); }
.pixel-btn--warning { background: var(--c-orange); }
.pixel-btn--ghost   { 
  background: transparent; 
  border-color: var(--c-white);
}
```

### 4.4 卡片像素樣式

```css
/* === 像素卡片 === */
.pixel-card {
  background: var(--c-darkblue);
  border: 3px solid var(--c-gray);
  
  /* 像素陰影 - 右下 */
  box-shadow: 
    4px 4px 0 var(--c-black),
    inset -2px -2px 0 rgba(0,0,0,0.1);
  
  /* 內距 */
  padding: var(--space-4);
}

.pixel-card:hover {
  border-color: var(--c-cyan);
  box-shadow: 
    4px 4px 0 var(--c-cyan),
    inset -2px -2px 0 rgba(0,0,0,0.1);
}

/* === 等寬框線 === */
.pixel-card--outlined {
  background: transparent;
  border: 3px solid var(--c-purple);
}
```

### 4.5 動畫與微互動

```css
/* === 像素過渡 === */
:root {
  --transition-fast: 50ms;
  --transition-normal: 150ms;
}

/* === 打字機效果 === */
@keyframes typewriter {
  from { width: 0; }
  to { width: 100%; }
}

/* === 閃爍效果 === */
@keyframes pixel-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* === 彈跳效果 === */
@keyframes pixel-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

/* === 掃描線效果 === */
@keyframes scanline {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}

/* === 狀態指示燈 === */
.status-pulse {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

---

## 5. 導航結構改造

### 5.1 移動端 - 底部 Tab 導航

```
┌────────────────────────────────────┐
│  ≡  PIXEL OFFICE      [公司 ▼]  × │  ← 頂部列 (44px)
├────────────────────────────────────┤
│                                    │
│         主要內容區域                 │
│                                    │
│                                    │
├────────────────────────────────────┤
│  📊   🏢    📋    ⚙️    📜        │  ← 底部導航 (56px)
│  控制台 部門 任務 Worker 稽核        │
└────────────────────────────────────┘
```

**規格**:
- 高度: 56px (含安全區域)
- 圖示大小: 24px
- 文字: 6px (僅作用中顯示)
- 間距: 平均分配
- 作用中状態: 上边框 3px `--c-yellow`

### 5.2 平板端 - 側邊欄折疊導航

```
┌────────┬─────────────────────────────────┐
│        │  PIXEL OFFICE    [公司 ▼]  ×  │
│ ≡      ├─────────────────────────────────┤
│        │                                 │
│ 📊     │         主要內容                 │
│ 控制台  │                                 │
│        │                                 │
│ 🏢     │                                 │
│ 部門    │                                 │
│        │                                 │
│ 📋     │                                 │
│ 任務    │                                 │
│        │                                 │
│ ⚙️     │                                 │
│ Worker │                                 │
│        │                                 │
│ 📜     │                                 │
│ 稽核    │                                 │
├────────┴─────────────────────────────────┤
│  ● 系統上線      WS: 已連線    12:34     │
└─────────────────────────────────────────┘
  ↑ 280px，折疊後 64px (僅圖示)
```

**規格**:
- 寬度: 280px (展開) / 64px (折疊)
- 高度: 全屏 - 頂部列 - 底部狀態列
- 點擊漢堡或滑動來折疊
- 作用中状態: 左边框 4px `--c-yellow` + 背景 `--c-darkblue`

### 5.3 桌面端 - 完整水平導航

```
┌───────────────────────────────────────────────────────────────────┐
│  🎮 PIXEL OFFICE    │ [搜尋...]  │ 📣  │ [公司 ▼]  │  👤 dicoge │
├───────────────────────────────────────────────────────────────────┤
│  📊控制台  │  🏢部門  │  📋任務  │  ⚙️Worker  │  📜稽核  │  💬聊天  │
└───────────────────────────────────────────────────────────────────┘
```

**規格**:
- 高度: 48px
- Tab 間距: 24px
- 作用中状態: 底部边框 3px `--c-yellow`
- 懸停: 背景 `--c-darkgray`

---

## 6. 各頁面佈局規劃

### 6.1 控制台 (Dashboard)

```
┌──────────────────────────────────────────────────────┐
│  📊 全域統計                              [重新整理] │
├──────────────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                │
│  │  12  │ │  8   │ │  3   │ │  7   │                │
│  │ 部門 │ │ Worker│ │任務  │ │ 完成 │                │
│  └──────┘ └──────┘ └──────┘ └──────┘                │
├──────────────────────────────────────────────────────┤
│  📋 最近任務                                  [更多] │
├──────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────┐     │
│  │ 🔄 優化戰鬥系統   [進行中]   DungeonD3     │     │
│  ├────────────────────────────────────────────┤     │
│  │ ⏳ 每日報告生成   [待處理]   每日台股報告   │     │
│  └────────────────────────────────────────────┘     │
├──────────────────────────────────────────────────────┤
│  👥 Worker 狀態                                  [更多] │
├──────────────────────────────────────────────────────┤
│  🟢 OpenClaw    🔄 Codex    🟡 OpenCode...          │
└──────────────────────────────────────────────────────┘
```

**響應式**:
- Mobile: 單欄，統計 2x2 網格
- Tablet: 雙欄，統計 4x1 網格
- Desktop: 四欄統計網格

### 6.2 部門頁面 (Departments)

```
┌──────────────────────────────────────────────────────┐
│  🏢 部門專案                          [+ 新增部門]  │
├──────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ 🎮          │  │ 📊          │  │ 🎮          │  │
│  │ DungeonD3  │  │ 每日台股報告│  │ PixelOffice │  │
│  │             │  │             │  │             │  │
│  │ 📋 任務: 5 │  │ 📋 任務: 3 │  │ 📋 任務: 2 │  │
│  │ 👥 Worker:2│  │ 👥 Worker:1│  │ 👥 Worker:3│  │
│  │             │  │             │  │             │  │
│  │ [✎] [🗑️]  │  │ [✎] [🗑️]  │  │ [✎] [🗑️]  │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└──────────────────────────────────────────────────────┘
```

### 6.3 任務頁面 (Tasks)

```
┌──────────────────────────────────────────────────────┐
│  📋 任務管理                                        │
├──────────────────────────────────────────────────────┤
│  [全部部門 ▼]  [全部狀態 ▼]  [+ 新增任務]           │
├──────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐   │
│  │ 📌 優化戰鬥系統動畫                          │   │
│  │    部門: DungeonD3 | 優先權: 高              │   │
│  │    狀態: 🔄 進行中 | 建立: 2小時前            │   │
│  │    [改狀態] [編輯] [刪除]                    │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📌 每日台股報告生成                          │   │
│  │    部門: 每日台股報告 | 優先權: 普通          │   │
│  │    狀態: ⏳ 待處理 | 建立: 1天前              │   │
│  │    [開始] [編輯] [刪除]                      │   │
│  └─────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### 6.4 Worker 頁面 (Workers)

```
┌──────────────────────────────────────────────────────┐
│  ⚙️ Worker 狀態                      [全部] [雙電腦] │
├──────────────────────────────────────────────────────┤
│  ┌─── MiniPc ────────────────────────────┐          │
│  │  🖥️ Machine-1 │ 狀態: 🟢 活跃         │          │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ │          │
│  │  │OpenClaw │ │  Codex  │ │OpenCode │ │          │
│  │  │ 🟢 活跃 │ │ 🟡 閒置 │ │ 🟡 閒置 │ │          │
│  │  └─────────┘ └─────────┘ └─────────┘ │          │
│  └────────────────────────────────────────┘          │
│  ┌─── MacBook ───────────────────────────┐          │
│  │  💻 Machine-2 │ 狀態: 🔵 忙碌        │          │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ │          │
│  │  │Dungeon  │ │ Pixel   │ │Server   │ │          │
│  │  │ 🔵 忙碌 │ │ 🔵 忙碌 │ │ 🔵 忙碌 │ │          │
│  │  └─────────┘ └─────────┘ └─────────┘ │          │
│  └────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────┘
```

### 6.5 聊天室 (Chat) - 疊加面板

```
┌──────────────────────────────────────────────────────┐
│                                    ┌───────────────┐ │
│         主要內容                    │ 💬 聊天室      │ │
│                                    │               │ │
│                                    │ ┌───────────┐ │ │
│                                    │ │ OpenClaw  │ │ │
│                                    │ │ 報告已生成│ │ │
│                                    │ └───────────┘ │ │
│                                    │ ┌───────────┐ │ │
│                                    │ │ 你         │ │
│                                    │ │ 好的       │ │
│                                    │ └───────────┘ │ │
│                                    │ [輸入...][送出]│ │
│                                    └───────────────┘ │
└──────────────────────────────────────────────────────┘
```

**響應式**:
- Mobile: 底部彈出式，半屏
- Tablet: 右側面板，380px 寬
- Desktop: 側邊固定，420px 寬

---

## 7. 組件庫規格

### 7.1 輸入框

```css
.pixel-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--c-black);
  border: 3px solid var(--c-gray);
  color: var(--c-white);
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  
  /* 像素焦點效果 */
  outline: none;
}

.pixel-input:focus {
  border-color: var(--c-yellow);
  box-shadow: 
    0 0 0 1px var(--c-yellow),
    4px 4px 0 var(--c-orange);
}

.pixel-input::placeholder {
  color: var(--c-gray);
}
```

### 7.2 下拉選單

```css
.pixel-select {
  appearance: none;
  width: 100%;
  padding: 10px 36px 10px 12px;
  background: var(--c-black) 
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Cpath fill='%23f0f0f0' d='M6 9L1 4h10z'/%3E%3C/svg%3E") 
    no-repeat right 12px center;
  border: 3px solid var(--c-gray);
  color: var(--c-white);
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  cursor: pointer;
}

.pixel-select:focus {
  border-color: var(--c-yellow);
  box-shadow: 4px 4px 0 var(--c-orange);
}
```

### 7.3 Modal 對話框

```css
.pixel-modal {
  position: fixed;
  inset: 0;
  background: rgba(26, 26, 46, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.pixel-modal__content {
  background: var(--c-darkblue);
  border: 4px solid var(--c-yellow);
  padding: var(--space-5);
  width: 100%;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
  
  /* 像素陰影 */
  box-shadow: 
    8px 8px 0 var(--c-purple),
    inset -2px -2px 0 rgba(0,0,0,0.2);
}

.pixel-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 3px solid var(--c-gray);
}

.pixel-modal__title {
  font-size: 10px;
  color: var(--c-yellow);
}

.pixel-modal__close {
  width: 28px;
  height: 28px;
  background: var(--c-red);
  border: 2px solid var(--c-white);
  color: var(--c-white);
  font-size: 10px;
  cursor: pointer;
}
```

### 7.4 狀態標籤

```css
.pixel-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 6px;
  border: 2px solid;
}

.pixel-badge--pending {
  color: var(--c-yellow);
  border-color: var(--c-yellow);
  background: rgba(241, 196, 15, 0.1);
}

.pixel-badge--in-progress {
  color: var(--c-blue);
  border-color: var(--c-blue);
  background: rgba(52, 152, 219, 0.1);
}

.pixel-badge--completed {
  color: var(--c-lime);
  border-color: var(--c-lime);
  background: rgba(46, 204, 113, 0.1);
}

.pixel-badge--failed {
  color: var(--c-red);
  border-color: var(--c-red);
  background: rgba(231, 76, 60, 0.1);
}
```

### 7.5 指示燈

```css
.pixel-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border: 2px solid;
}

.pixel-indicator--active {
  background: var(--c-lime);
  border-color: var(--c-lime);
}

.pixel-indicator--idle {
  background: var(--c-yellow);
  border-color: var(--c-yellow);
}

.pixel-indicator--offline {
  background: var(--c-red);
  border-color: var(--c-red);
}

.pixel-indicator--busy {
  background: var(--c-blue);
  border-color: var(--c-blue);
  animation: pulse 1.5s infinite;
}
```

---

## 8. 互動模式

### 8.1 手機滑動手勢

| 手勢 | 區域 | 動作 |
|------|------|------|
| 左滑 | 任務卡片 | 刪除按鈕 |
| 右滑 | 側邊欄 | 展開導航 |
| 下拉 | 任務列表 | 重新整理 |
| 雙擊 | Worker 卡片 | 開始聊天 |

### 8.2 鍵盤快捷鍵 (桌面端)

| 快捷鍵 | 動作 |
|--------|------|
| `Ctrl + K` | 開啟搜尋 |
| `Ctrl + N` | 新增任務 |
| `1-5` | 切換 Tab |
| `Esc` | 關閉 Modal |

### 8.3 觸控回饋

```css
/* 點擊回饋 */
.pixel-touchable {
  position: relative;
  overflow: hidden;
}

.pixel-touchable::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0.1);
  transform: scale(0);
  transition: transform 100ms;
}

.pixel-touchable:active::after {
  transform: scale(1);
}
```

---

## 9. 載入與空狀態

### 9.1 載入動畫

```css
/* 像素方塊跳動 */
.pixel-loader {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.pixel-loader__block {
  width: 12px;
  height: 12px;
  background: var(--c-yellow);
  animation: loader-bounce 0.6s infinite;
}

.pixel-loader__block:nth-child(2) { animation-delay: 0.1s; }
.pixel-loader__block:nth-child(3) { animation-delay: 0.2s; }

@keyframes loader-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
```

### 9.2 空狀態

```css
.pixel-empty {
  text-align: center;
  padding: var(--space-6);
  color: var(--c-gray);
}

.pixel-empty__icon {
  font-size: 48px;
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

.pixel-empty__title {
  font-size: 9px;
  color: var(--c-silver);
  margin-bottom: var(--space-2);
}

.pixel-empty__desc {
  font-size: 7px;
  color: var(--c-gray);
}
```

---

## 10. 實作檢查清單

### Phase 1: 基礎建設
- [ ] 更新 CSS Variables 定義
- [ ] 建立響應式網格系統
- [ ] 實作像素字體層次
- [ ] 統一按鈕/卡片樣式

### Phase 2: 導航改造
- [ ] 實作底部 Tab 導航 (Mobile)
- [ ] 實作側邊折疊導航 (Tablet)
- [ ] 更新桌面水平導航
- [ ] 新增漢堡選單按鈕

### Phase 3: 頁面優化
- [ ] 控制台響應式佈局
- [ ] 部門卡片網格
- [ ] 任務列表響應式
- [ ] Worker 狀態顯示優化

### Phase 4: 互動與動畫
- [ ] 按鈕點擊回饋
- [ ] 頁面切換過渡
- [ ] 載入動畫
- [ ] 空狀態設計

### Phase 5: 測試與調整
- [ ] Chrome DevTools 響應式測試
- [ ] 觸控裝置測試
- [ ] 效能檢測
- [ ] 無障礙初步檢查

---

## 11. 技術備註

### 11.1 CSS 結構

```css
/* 組織結構 */
styles/
├── variables.css    # CSS Variables + 斷點
├── reset.css       # 基本重設
├── typography.css  # 字體層次
├── components.css  # 組件樣式
├── layout.css      # 佈局系統
├── animations.css  # 動畫定義
└── responsive.css  # 響應式規則
```

### 11.2 兼容性目標

- Chrome 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+
- Samsung Internet 14+

### 11.3 效能目標

- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1
- 總 DOM 節點: < 500

---

## 12. 配色速查表

```
┌─────────────────────────────────────────────────────┐
│  PIXEL OFFICE 顏色系統                              │
├─────────────────────────────────────────────────────┤
│  ■ 黑色 #1a1a2e  (背景)                             │
│  ■ 深藍 #16213e  (面板)                             │
│  ■ 紫色 #4a2c7a  (強調)                             │
│  ■ 綠色 #0f9b0f  (主要動作)                         │
│  ■ 棕色 #8b4513  (邊框/陰影)                        │
├─────────────────────────────────────────────────────┤
│  ■ 白 #f0f0f0  │ ■ 銀 #a0a0a0  │ ■ 灰 #6b6b6b     │
│  ■ 暗灰 #2d2d2d                                        │
├─────────────────────────────────────────────────────┤
│  ■ 紅 #e74c3c  │ ■ 橙 #e67e22  │ ■ 黃 #f1c40f     │
│  ■ 青 #00d4aa  │ ■ 藍 #3498db  │ ■ 粉 #ff69b4     │
│  ■ 桃 #ffb347  │ ■ 青綠 #2ecc71                   │
└─────────────────────────────────────────────────────┘
```