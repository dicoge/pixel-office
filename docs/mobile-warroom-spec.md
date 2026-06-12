# 手機版戰情室規格

## 需求
手機瀏覽 Pixel Office 時，跳過 Phaser 遊戲畫面，直接進入戰情室。
戰情室要完整支援手機操作（新增任務、刪除、重試、看任務列表）。

## 技術方案

### 1. 手機偵測（public/index.html login flow）
在 `enterOffice()` 函數中，登入成功後判斷是否為手機：
- `window.innerWidth < 768` or `navigator.maxTouchPoints > 0`
- 如果是手機 → 不載入 `initGame()`，直接顯示戰情室全螢幕
- 如果是桌機 → 保持現有流程（載入 Phaser 遊戲）

### 2. 手機戰情室 UI 調整（public/index.html CSS + HTML）

**現有問題**：戰情室原本是 overlay（浮在遊戲上層），手機不需要 overlay
**改法**：
- 新增 CSS class `.mobile-mode` 套用在 `#war-room-overlay`
- 手機模式：背景不透明、無關閉按鈕、無 overlay 效果、當作主頁面顯示
- 所有表格/卡片改成垂直堆疊（現有 media query 已部分支援，但需要加強）

**手機專用 CSS 加強**：
```css
@media (max-width: 767px) {
  /* 隱藏遊戲相關元素 */
  #game-container canvas, #game-skeleton, #top-bar { display: none; }
  
  /* 戰情室改為主頁面 */
  #war-room-overlay {
    position: relative;
    background: #1a1a2e;
    display: flex !important;
    z-index: 10;
  }
  #war-room-panel {
    width: 100vw; max-width: 100vw;
    max-height: none; height: 100vh;
    border: none; border-radius: 0;
    padding: 10px;
    overflow-y: auto;
  }
  #war-close-btn { display: none; }
  
  /* 任務表格改卡片式 */
  .wr-task-table thead { display: none; }
  .wr-task-table tr {
    display: block;
    border: 1px solid rgba(255,215,0,0.15);
    border-radius: 6px;
    padding: 8px;
    margin-bottom: 8px;
    background: rgba(22,33,62,0.6);
  }
  .wr-task-table td {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    border: none;
    font-size: 11px;
  }
  .wr-task-table td::before {
    content: attr(data-label);
    color: #8899aa;
    font-weight: bold;
  }
  
  /* 卡片網格 2 列 */
  .wr-agent-grid { grid-template-columns: repeat(2, 1fr); gap: 6px; }
  .wr-stats { grid-template-columns: repeat(3, 1fr); gap: 4px; }
  
  /* 建立任務 modal 滿版 */
  #wr-create-task-modal > div {
    width: 94vw !important;
    max-width: 94vw !important;
  }
}
```

### 3. 任務表格 td 加 data-label
每欄 td 要加 `data-label` 屬性，讓手機版可以顯示欄位名稱：
```html
<td data-label="標題">任務名稱</td>
<td data-label="指派">hermes</td>
<td data-label="狀態">pending</td>
<td data-label="優先級">normal</td>
<td data-label="重試">0</td>
<td data-label="操作">🗑 刪除</td>
```

這需要在 `renderTasks()` 函數中修改每個 `<td>` 加上 `data-label="..."` 屬性。

### 4. 手機登入頁面優化
登入框在手機上應該更寬、字更大：
```css
@media (max-width: 767px) {
  .login-box { width: 90vw; padding: 20px; }
  .login-input { font-size: 16px; padding: 14px; }
  .login-btn { padding: 16px; font-size: 16px; }
}
```

## 實作步驟（CCR 負責）

1. 在 `public/index.html` 的 `<style>` 區塊加入手機版 CSS
2. 在 `enterOffice()` 函數中加入手機偵測邏輯
3. 修改 `renderTasks()` 函數，每個 `<td>` 加上 `data-label`
4. 手機模式下隱藏關閉按鈕、頂部欄、遊戲容器
5. 讓登入頁面在手機上更好操作

## 注意
- 不要破壞桌機版現有功能
- 手機判斷用 `window.innerWidth < 768`
- `initGame()` 在手機上不要呼叫，節省頻寬
- 任務篩選按鈕在手機上要可滑動（overflow-x: auto）
