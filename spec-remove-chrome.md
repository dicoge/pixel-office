# Pixel Office — 移除所有 UI Chrome（Spec for OpenCode）

## 目標
移除 Manus 之前加的所有 UI Chrome（頂部導航、底部面板、側邊欄），讓畫面只保留：
1. 登入畫面（必要，保留 auth）
2. Phaser 遊戲畫面（#game-container + canvas）
3. 載入動畫（#loading-overlay）

## 需要修改的檔案

### 1. public/index.html

全部替換為精簡版本。HTML 結構：
```
loading-overlay (保留)
login-screen (保留，簡化 CSS)
app → 只含 main-stage → game-container + status-text (保留但隱藏/簡化)
```

**刪除以下元素**（整段刪除，含對應 HTML + CSS + JS）：
- `#top-nav`（整段：頂部導航列，含 title、company-select、department button、logout button）
- `#bottom-panels`（整段：memo-panel + control-bar）
- `#sidebar-backdrop`（整段）
- `#sidebar`（整段：aside + header + body + department-list + dept-detail-panel）
- `#sidebar-header`、`#sidebar-body`、`#department-list`、`#dept-detail-panel`

**保留但簡化**：
- `#status-text` → 保留 HTML element 但移除 border-left、cursor、梯度背景等花俏 CSS（game.js 有 `document.getElementById('status-text')` 引用，不能刪）
- `body` → padding 改為 0（原本 padding: 20px 0）

**刪除的 CSS（對應元素移除後，整段 style 可刪）**：
- `#top-nav` 及其子元素 CSS（#top-nav-left, #top-nav-right, .top-btn, .logout-btn）
- `#company-select` CSS
- `#bottom-panels` CSS
- `#memo-panel` 及其子元素 CSS
- `#control-bar` 及其子元素 CSS（.control-row, .hermes-row, #member-status-list）
- `.member-status-row`、`.member-status-dot`、`.member-status-name`、`.member-status-area`
- `#sidebar-backdrop` CSS
- `#sidebar` 及其子元素 CSS（#sidebar-header, #sidebar-body, #department-list, .dept-item, #dept-detail-panel）
- `body.sidebar-open` CSS
- `@keyframes pulse-dot`（無引用就刪）

**保留的 CSS**：
- 全域 reset、body 基本樣式（但 body padding→0, gap→0）
- @keyframes fadeInUp, star-rotate, blink-cursor, shimmer（登入畫面用）
- `#login-screen` 相關全部
- `.login-logo`、`.login-subtitle`、`.login-box`、`.login-input`、`.login-btn`、`.login-error`
- `#app`（`display: flex` 改為 `display: block`）
- `#main-stage`（簡化，移除 transform transition 和 body.sidebar-open 相關）
- `#game-container`（保留但移除 box-shadow: inset... 這行）
- `#game-skeleton`
- `#loading-overlay` 相關全部
- `#loading-text`、`#loading-progress-container`、`#loading-progress-bar`
- `#status-text`（簡化：純文字，無邊框游標）

### 2. public/game.js

**移除的程式碼**：
- `renderMemberStatus()` 函式整個移除（定義 + 呼叫）
- `lastStatusRender` 變數宣告
- update() 中的 `renderMemberStatus()` 呼叫（第 480 行 `if (time - lastStatusRender > 2000)` 整行刪除）

**保留不變**：
- 所有 `#status-text` 引用（第 484-486 行）
- 其他所有遊戲邏輯

## 確認事項
1. 登入依然正常運作（handleLogin, enterOffice, autoLogin）
2. handleLogout 保留但移除 sidebar close 邏輯
3. 進入辦公室後，畫面只顯示 Phaser 遊戲畫面（1280x720），無任何額外 UI 元素
4. game.js 無報錯（已移除 renderMemberStatus 和 lastStatusRender 引用）
5. CSS 無殘留未使用的選擇器

## 完成標準
- 沒有 `#top-nav`、`#bottom-panels`、`#sidebar`、`#memo-panel`、`#control-bar` 的 HTML/CSS/JS
- 登入後畫面乾淨，只有遊戲 canvas
- `#status-text` 單純顯示文字，無花俏樣式
