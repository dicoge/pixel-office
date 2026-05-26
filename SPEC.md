# Pixel Office Redesign Spec — 致敬 Star Office UI

## 目標
把當前的 Pixel Office 改造成 Star Office UI 風格：
- 使用原始 Star Office 背景圖（Central Perk 咖啡店場景）
- 7 個像素角色（Hermes + 6 位成員）疊在背景上
- 完全沒有多餘的動物/貓（只有 Hermes 角色可保留貓造型）

## Background 處理
1. 載入 `office_bg_small.webp` (1280×720) 作為房間背景圖
   - 這是 Star Office 原始的 16:9 場景底圖
   - 設定在 depth 0，先於所有家具/角色
2. 在背景上疊加程式繪製的家具（深度 3~5）：
   - 紅色沙發（lounge/sofa 區域）
   - 書架（左牆）
   - CENTRAL PERK 招牌（正上方）
   - 4 張小桌子（左右兩側）
   - 咖啡機（左上）
   - 盆栽（右上）

## 角色系統
共有 7 個角色，用原始 pixel art sprites：

### Hermes（⭐ 經理）
- 使用 `star-idle-v5.png` spritesheet (2048×1536)
- 256×256 分幀，共 48 幀待機動畫
- 位置：畫面中央上方（manager_desk）

### 6 位成員（使用 guest_anim_1~6）
| 成員 | Sprite | 顏色 | Figure | 位置 |
|------|--------|------|--------|------|
| Codex | guest_anim_1 | 藍色 #2196f3 | 📘 | 沙發區（左） |
| OpenClaw | guest_anim_2 | 紅色 #f44336 | 🦞 | 沙發區（中） |
| Gemini | guest_anim_3 | 紫色 #9c27b0 | 🔮 | 左側小桌 |
| Manus | guest_anim_4 | 橘色 #ff6b35 | ✍️ | 左側小桌 |
| Claude Code | guest_anim_5 | 綠色 #4caf50 | 🟢 | 右側小桌 |
| OpenCode | guest_anim_6 | 黃色 #ffeb3b | 🔧 | 右側小桌 |

- guest_anim 尺寸：32×32 分幀，128×64 整張（4×2=8 幀）
- 動畫：idle 動畫循環（frame 0~5）

## 角色位置對照
| 角色 | 區域 | 座標 | 備註 |
|------|------|------|------|
| Hermes | manager_desk (中央) | (640, 280) | 最上方中央 |
| Codex | lounge (沙發區左) | (280, 490) | 靠近沙發左端 |
| OpenClaw | lounge (沙發區中) | (340, 490) | 沙發中央 |
| OpenCode | lounge (沙發區右) | (400, 490) | 靠近沙發右端 |
| Gemini | desk_small_1 (左桌 1) | (120, 395) | |
| Manus | desk_small_2 (左桌 2) | (250, 395) | |
| Claude Code | desk_small_3 (右桌 1) | (1050, 475) | |
| 空 (保留位) | desk_small_4 (右桌 2) | (1150, 475) | |

## 技術實作

### Preload 載入
```
this.load.image('office_bg', '/office_bg_small.webp')
this.load.image('star_idle_static', '/star-idle-v5.png')
this.load.spritesheet('coffee_machine', '/coffee-machine-v3-grid.webp', { frameWidth: 230, frameHeight: 230 })
this.load.spritesheet('plants', '/plants-spritesheet.webp', { frameWidth: 160, frameHeight: 160 })
for (let i = 1; i <= 6; i++) {
  this.load.spritesheet('guest_anim_' + i, '/guest_anim_' + i + '.webp', { frameWidth: 32, frameHeight: 32 })
}
```

### 動畫建立
- star_idle: 從 star-idle-v5.png 讀取 48 幀動畫（256×256 分幀）
- guest_anim: 每組 8 幀（32×32 分幀），用 frame 0~5 idle 循環播放

### 渲染順序（depth）
| depth | 內容 |
|-------|------|
| 0 | 背景圖 office_bg |
| 3 | 程式家具（沙發、桌子、書架） |
| 5 | 咖啡機、盆栽 |
| 10 | 角色 Sprite |
| 12 | 角色名稱標籤 |
| 15 | 對話氣泡 |

## 禁止事項
- ❌ 不要載入 cats-spritesheet.webp
- ❌ 不要載入 desk-v3.webp（用程式繪製桌子）
- ❌ 不要有任何動物/寵物圖案
- ❌ 不要保留舊的 guest_anim 相關的 preload（如果已經有）
- ❌ 角色數量必須等於 7，不多不少

## 驗收條件
1. 瀏覽器打開看到 Cafe / Central Perk 場景
2. 7 個像素角色在正確位置
3. 角色有基礎 idle 動畫
4. 背景乾淨沒有額外動物
5. console 無 JS error