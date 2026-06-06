// Pixel Office v8 — Star Office UI (Central Perk Coffee Shop)
// Background image + pixel art sprites + programmatic furniture

let supportsWebP = false;
function checkWebPSupport() {
  return new Promise(r => {
    const c = document.createElement('canvas');
    if (c.getContext && c.getContext('2d')) r(c.toDataURL('image/webp').indexOf('data:image/webp') === 0);
    else r(false);
  });
}

const config = {
  type: Phaser.CANVAS, width: 1280, height: 720,
  parent: 'game-container', pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: { preload, create, update }
};

let totalAssets=0, loadedAssets=0, lpBar, lpText, lpOverlay;
let loadingTimeout = setTimeout(hideLoadingOverlay, 15000);

function updateLoadingProgress() {
  loadedAssets++;
  const p = Math.min(100, Math.round(loadedAssets/totalAssets*100));
  if (lpBar) lpBar.style.width = p+'%';
  if (lpText) lpText.textContent = `載入中... ${p}%`;
}
function hideLoadingOverlay() {
  clearTimeout(loadingTimeout);
  setTimeout(() => {
    if (lpOverlay) { lpOverlay.style.opacity='0'; setTimeout(() => lpOverlay.style.display='none', 500); }
  }, 300);
}

const STATES = {
  idle: { name:'待命', area:'center' },
  writing: { name:'整理文檔', area:'col1_top' },
  researching: { name:'搜尋資訊', area:'col1_mid' },
  executing: { name:'執行任務', area:'col2_top' },
  syncing: { name:'同步備份', area:'col2_mid' },
  error: { name:'出錯了', area:'center' }
};
const BTEXTS = {
  idle:['待命中','喝杯咖啡','放個風','找靈感'],
  writing:['進入專注模式','跑關鍵路徑','關 bug 進籠子'],
  researching:['挖證據鏈','定位問題','找關鍵'],
  executing:['執行中','跑 pipeline','看結果'],
  syncing:['同步到雲端','備份中','多一份安心'],
  error:['別慌','找到 bug','錯誤是線索']
};

const STATUS_LABELS = {
  idle: '閒置中',
  writing: '工作中',
  researching: '搜尋中',
  executing: '執行中',
  syncing: '同步中',
  error: '出錯'
};

function getStatusColor(state) {
  switch(state) {
    case 'writing': case 'researching': case 'executing': return '#f1c40f'; // 黃色
    case 'syncing': return '#3498db';  // 藍色
    case 'error': return '#e74c3c';    // 紅色
    default: return '#2ecc71';         // 綠色（idle）
  }
}

const MEMBERS = [
  { id:'hermes',   label:'Hermes',     role:'🏢 經理',   area:'center',        offset:{x:170,y:10} },
  { id:'openclaw', label:'OpenClaw',   role:'🧪 測試',   area:'sofa',          offset:{x:0,y:0} },
  { id:'codex',    label:'Codex',      role:'📐 架構',   area:'col2_mid',      offset:{x:50,y:20} },
  { id:'gemini',   label:'Gemini',     role:'🔍 研究',   area:'col1_mid',      offset:{x:-20,y:20} },
  { id:'manus',    label:'Manus',      role:'🎨 UI/UX',  area:'col1_bot',      offset:{x:-20,y:20} },
  { id:'claude',   label:'Claude Code',role:'💻 開發',   area:'col2_top',      offset:{x:50,y:25} },
  { id:'opencode', label:'OpenCode',   role:'🔧 優化',   area:'col2_bot',      offset:{x:50,y:20} }
];

const TOOL_COLORS = {
  hermes:   { color: 0xffd700, icon: '⭐', spriteIdx: 0 },
  gemini:   { color: 0x9c27b0, icon: '🔮', spriteIdx: 4 },
  manus:    { color: 0xff6b35, icon: '✍️', spriteIdx: 1 },
  codex:    { color: 0x2196f3, icon: '📘', spriteIdx: 3 },
  claude:   { color: 0x4caf50, icon: '🟢', spriteIdx: 2 },
  opencode: { color: 0xffeb3b, icon: '🔧', spriteIdx: 5 },
  openclaw: { color: 0xf44336, icon: '🦞', spriteIdx: 6 }
};

// Guest sprite index mapping: member id → guest_anim_N number
const GUEST_SPRITE_INDEX = {
  codex: 2,
  openclaw: 7,
  gemini: 1,
  manus: 4,
  claude: 5,
  opencode: 3
};

const AREAS = {
  col1_top: { x: 160, y: 280 },
  col1_mid: { x: 160, y: 410 },
  col1_bot: { x: 160, y: 540 },
  col2_top: { x: 270, y: 280 },
  col2_mid: { x: 270, y: 410 },
  col2_bot: { x: 270, y: 540 },
  center:  { x: 490, y: 360 },
  lounge:  { x: 490, y: 360 },
  sofa:    { x: 1092, y: 270 },  // OpenClaw 在沙發正上方
};

window.currentOffice = localStorage.getItem("current_office") || "company-a";
let game, star, areas={}, currentState='idle', pendingState=null;
let lastFetch=0, lastClickFetch=0, targetX=490, targetY=280;
let ttText='', ttTarget='', ttIdx=0, lastTT=0;
const FETCH_INT=15000, TT_DELAY=50;
let mainCamera;
const spriteData = {};
let memberStatusTexts = {};
let memberMoodBubbles = {};  // { id: { bg, text } }

// ===================== ROOM DRAWING =====================

function drawRoom(scene) {
  // 1. Background — office-specific
  window.officeBg = scene.add.image(640, 360, 'office_bg').setOrigin(0.5).setDepth(0).setVisible(window.currentOffice !== 'company-b');

  window.officeBgMac = scene.add.image(640, 360, 'office_bg_full').setOrigin(0.5).setDepth(0).setVisible(window.currentOffice === 'company-b');

  window.officeLighting = scene.add.graphics().setDepth(1);
  // Warm glow from left side (shifted left with desks) — matches winter cabin mood
  window.officeLighting.fillStyle(0xff8844, 0.04);
  window.officeLighting.fillCircle(160, 380, 350);
  window.officeLighting.fillStyle(0xffaa66, 0.025);
  window.officeLighting.fillCircle(160, 380, 500);
  // Gentle warm wash from right side (moved slightly left for balance after coffee machine relocation)
  window.officeLighting.fillStyle(0xffcc66, 0.02);
  window.officeLighting.fillCircle(1090, 250, 280);
  // Ultra-subtle overall warmth
  window.officeLighting.fillStyle(0xffdd99, 0.015);
  window.officeLighting.fillRect(0, 0, 1280, 720);

  // === FLOOR (depth 2) — checkerboard pattern (company-a only) ===
  const floorG = scene.add.graphics().setDepth(2);
  const tileW = 40, tileH = 30;
  for (let row = 0; row < 24; row++) {
    for (let col = 0; col < 32; col++) {
      // Fade in gradually from the wall line
      const fadeFactor = Math.min(1, row / 3);
      const isLight = (row + col) % 2 === 0;
      floorG.fillStyle(isLight ? 0xb8845c : 0x9e6d46, 0.45 * fadeFactor);
      floorG.fillRect(col * tileW, 545 + row * tileH, tileW, tileH);
    }
  }
  // Transition gradient — blends wall into floor
  floorG.fillStyle(0x000000, 0.06);
  floorG.fillRect(0, 545, 1280, 8);
  // Gentle floor shine gradient
  floorG.fillStyle(0xffffff, 0.02);
  floorG.fillRect(0, 545, 1280, 720 - 545);

  // === FURNITURE (depth 3~5) ===

  // CENTRAL PERK sign — depth 3 — centered at x=665 (company-a only)
  const signG = scene.add.graphics().setDepth(3);
  // Sign shadow
  signG.fillStyle(0x000000, 0.12);
  signG.fillRect(575, 15, 180, 24);
  // Sign board — warm wood, fully opaque
  signG.fillStyle(0x3e2723, 1);
  signG.fillRect(573, 13, 184, 24);
  signG.fillStyle(0x5d4037, 1);
  signG.fillRect(575, 15, 180, 20);
  // Gold border
  signG.lineStyle(1, 0xffd700, 0.7);
  signG.strokeRect(574, 14, 182, 22);
  // Sign screws
  signG.fillStyle(0xffd700, 0.8);
  signG.fillCircle(580, 19, 2);
  signG.fillCircle(750, 19, 2);
  scene.add.text(665, 25, 'CENTRAL PERK', {
    fontFamily: 'monospace', fontSize: '11px',
    fill: '#ffd700', stroke: '#000', strokeThickness: 1
  }).setOrigin(0.5).setDepth(4).setAlpha(1);

  // Coffee machine (left room, next to bookshelf, right of desk lamp) — company-a only
  const coffeeCompat = scene.add.sprite(235, 190, 'coffee_machine', 0)
    .setOrigin(0.5).setDepth(5).setScale(0.35);
  if (scene.anims.exists('cf_machine')) coffeeCompat.play('cf_machine', true);

  // Plant (right side) — depth 5 — with pot shadow (company-a only)
  if (scene.textures.exists('plants')) {
    // Plant pot shadow
    const pG = scene.add.graphics().setDepth(4);
    pG.fillStyle(0x000000, 0.15);
    pG.fillEllipse(1090, 215, 40, 10);
    scene.add.sprite(1090, 200, 'plants',
      Math.floor(Math.random() * 16))
      .setOrigin(0.5).setDepth(5).setScale(0.4);
  }

  // Sofa (v18) — top-right room area (x=1050, y=200, scale=0.45) — company-a only
  if (scene.textures.exists('sofa')) {
    // Sofa shadow (depth 4, behind sofa)
    scene.add.image(1092, 280, 'sofa_shadow').setOrigin(0.5).setDepth(4).setScale(0.45);
    // Sofa sprite (depth 5)
    scene.add.image(1092, 280, 'sofa').setOrigin(0.5).setDepth(5).setScale(0.45);
  }

  // === 6 desks (2 columns x 3 rows) — company-a only ===
  if (scene.textures.exists('desk')) {
    // Column 1 — facing LEFT (v17: x=205, y=310/440/570)
    scene.add.image(205, 310, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(-90);
    scene.add.image(205, 440, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(-90);
    scene.add.image(205, 570, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(-90);
    // Column 2 — facing RIGHT (v16: x=260, y=310/440/570)
    scene.add.image(260, 310, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(90);
    scene.add.image(260, 440, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(90);
    scene.add.image(260, 570, 'desk').setOrigin(0.5).setDepth(3).setScale(0.45).setAngle(90);
  }

  // === SUBTLE VIGNETTE CORNERS (depth 50) — company-a only ===
  const vigG = scene.add.graphics().setDepth(50);
  // Very soft corner darkening
  vigG.fillStyle(0x000000, 0.04);
  vigG.fillRect(0, 0, 40, 720);
  vigG.fillRect(1240, 0, 40, 720);
  vigG.fillRect(0, 0, 1280, 15);

  // === BOTTOM PLAQUE (depth 51) — PIXEL OFFICE with star decorations (company-a only) ===
  const plaqueG = scene.add.graphics().setDepth(51);
  const plX = 675;  // aligned with top sign center
  const plY = 705;  // very bottom edge
  // Dark background bar
  plaqueG.fillStyle(0x1a1a2e, 0.85);
  plaqueG.fillRoundedRect(plX - 180, plY - 18, 360, 36, 8);
  // Gold border
  plaqueG.lineStyle(2, 0xffd700, 0.5);
  plaqueG.strokeRoundedRect(plX - 180, plY - 18, 360, 36, 8);
  // Left star decoration
  scene.add.text(plX - 150, plY, '⭐', {
    fontFamily: 'monospace', fontSize: '16px'
  }).setOrigin(0.5).setDepth(52);
  // Right star decoration
  scene.add.text(plX + 150, plY, '⭐', {
    fontFamily: 'monospace', fontSize: '16px'
  }).setOrigin(0.5).setDepth(52);
  // PIXEL OFFICE text
  window.plaqueText = scene.add.text(plX, plY, window.currentOffice === 'company-b' ? 'MACBOOK OFFICE' : 'MINIPC OFFICE', {
    fontFamily: 'monospace', fontSize: '13px',
    fill: '#ffd700', stroke: '#000', strokeThickness: 1
  }).setOrigin(0.5).setDepth(52).setAlpha(0.95);
}

// ===================== OFFICE THEME SWITCHING =====================

function setOfficeTheme(office) {
  if (window.officeBg) window.officeBg.setVisible(office !== 'company-b');
  if (window.officeBgMac) window.officeBgMac.setVisible(office === 'company-b');
  if (window.officeLighting) {
    window.officeLighting.clear();
    if (office === 'company-b') {
      // Cool blue lighting for MacBook
      window.officeLighting.fillStyle(0x3a86ff, 0.03);
      window.officeLighting.fillCircle(640, 360, 400);
      window.officeLighting.fillStyle(0x0066cc, 0.02);
      window.officeLighting.fillCircle(640, 360, 600);
    } else {
      // Warm lighting for MiniPC
      window.officeLighting.fillStyle(0xff8844, 0.04);
      window.officeLighting.fillCircle(160, 380, 350);
      window.officeLighting.fillStyle(0xffaa66, 0.025);
      window.officeLighting.fillCircle(160, 380, 500);
      window.officeLighting.fillStyle(0xffcc66, 0.02);
      window.officeLighting.fillCircle(1090, 250, 280);
      window.officeLighting.fillStyle(0xffdd99, 0.015);
      window.officeLighting.fillRect(0, 0, 1280, 720);
    }
  }
  if (window.plaqueText) {
    window.plaqueText.setText(office === 'company-b' ? 'MACBOOK OFFICE' : 'MINIPC OFFICE');
  }
}

// ===================== CHARACTERS =====================

function placeCharacters(scene) {
  window.memberSprites = {};
  window.memberLabels = {};
  window.memberStates = {};
  window.memberMoods = {};
  window.memberTargets = {};
  window.memberShadows = {};
  window.guestSprites = {};

  MEMBERS.forEach((m) => {
    const area = AREAS[m.area] || AREAS.lounge;
    const bx = area.x + m.offset.x;
    const by = area.y + m.offset.y;
    const tc = TOOL_COLORS[m.id] || { color: 0x888888, icon: '👤' };
    let sprite;

    // === Shadow beneath character ===
    const shadowG = scene.add.graphics().setDepth(9);
    if (m.id === 'hermes') {
      // Wider shadow for Hermes (he's bigger)
      shadowG.fillStyle(0x000000, 0.15);
      shadowG.fillEllipse(0, 0, 72, 20);
      shadowG.setPosition(bx, by + 58);
    } else {
      const sw = 24;
      shadowG.fillStyle(0x000000, 0.14);
      shadowG.fillEllipse(0, 0, sw, 8);
      shadowG.setPosition(bx, by + 28);
    }
    window.memberShadows[m.id] = shadowG;

    if (m.id === 'hermes') {
      // 使用靜態 ⭐ emoji — 不用 spritesheet 動畫，避免殘影
      sprite = scene.add.text(bx, by, '⭐', {
        fontFamily: 'monospace', fontSize: '32px'
      }).setOrigin(0.5).setDepth(10);
      star = sprite;

      // Glow aura behind Hermes badge
      const glowG = scene.add.graphics().setDepth(9);
      glowG.fillStyle(0xffd700, 0.08);
      glowG.fillCircle(bx, by - 10, 28);
      glowG.fillStyle(0xffd700, 0.04);
      glowG.fillCircle(bx, by - 10, 40);
      window.hermesGlow = glowG;

    } else {
      // Guest agents use guest_anim_N spritesheets (128x64, 32x32 frames)
      const guestIdx = GUEST_SPRITE_INDEX[m.id];
      const spriteKey = 'guest_anim_' + guestIdx;
      const animKey = 'guest_idle_' + guestIdx;

      sprite = scene.add.sprite(bx, by, spriteKey, 0).setOrigin(0.5);
      // Sofa characters sit lower with smaller scale; desk characters stand tall
      const scale = 1.8;
      sprite.setScale(1.8);
      sprite.setDepth(10);
      if (scene.anims.exists(animKey)) {
        sprite.play(animKey, true);
      }

      // Store reference for animation restart on re-create
      window.guestSprites[m.id] = sprite;
    }

    window.memberSprites[m.id] = sprite;
    window.memberStates[m.id] = 'idle';
    window.memberTargets[m.id] = { x: bx, y: by };

    // Name label — text only (no background box or arrow)
    const label = scene.add.text(bx, by + 22, m.label, {
      fontFamily: 'monospace', fontSize: '10px', fill: '#fff',
      fontStyle: 'bold',
      stroke: '#000', strokeThickness: 1
    }).setOrigin(0.5).setDepth(12);
    window.memberLabels[m.id] = label;

    // Status text above head
    const yOff = m.id === 'hermes' ? -54 : -42;
    const statusText = scene.add.text(bx, by + yOff, '閒置中', {
      fontFamily: 'monospace', fontSize: '11px',
      fill: '#2ecc71',
      stroke: '#000', strokeThickness: 2,
      align: 'center'
    }).setOrigin(0.5).setDepth(12);
    memberStatusTexts[m.id] = statusText;

    // Mood speech bubble — dialog bubble above status text
    const moodBubbleBg = scene.add.graphics().setDepth(11);
    const moodBubbleText = scene.add.text(bx, by + yOff + 12, '', {
      fontFamily: 'monospace', fontSize: '11px',
      fill: '#333', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 0,
      align: 'center'
    }).setOrigin(0.5).setDepth(12);
    memberMoodBubbles[m.id] = { bg: moodBubbleBg, text: moodBubbleText };

    spriteData[m.id] = { label };
  });
  window.starSprite = star;
}

// ===================== INIT =====================

async function initGame() {
  try { supportsWebP = await checkWebPSupport(); } catch(e) { supportsWebP = false; }
  new Phaser.Game(config);
  setTimeout(connectHermes, 1000);
}

function preload() {
  lpOverlay = document.getElementById('loading-overlay');
  lpBar = document.getElementById('loading-progress-bar');
  lpText = document.getElementById('loading-text');
  // Count all assets to load
  totalAssets = 1 + 1 + 1 + 1 + 6 + 1 + 2; // bg + star + coffee + plants + 6 guests + desk + sofa
  loadedAssets = 0;

  const ps = document.createElement('style');
  ps.textContent = '@keyframes lp{0%,100%{box-shadow:0 0 5px #ffd700}50%{box-shadow:0 0 15px #ffd700}}' +
    '#loading-progress-bar{transition:width 0.3s ease;animation:lp 1.5s ease-in-out infinite}';
  document.head.appendChild(ps);
  this.load.on('filecomplete', updateLoadingProgress);
  this.load.on('complete', hideLoadingOverlay);

  // Background image — Central Perk coffee shop scene
  this.load.image('office_bg', '/office_bg_small.webp');
  this.load.image('office_bg_full', '/office_bg.webp');

  // Hermes spritesheet — star idle animation (2048x1536, 256x256 frames)
  this.load.spritesheet('star_idle', '/star-idle-v5.png', { frameWidth: 256, frameHeight: 256 });

  // Custom animated spritesheets (company-a specific)
  this.load.spritesheet('custom_hermes', '/custom_hermes.webp', { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet('coffee_machine', '/coffee-machine-v3-grid.webp', { frameWidth: 230, frameHeight: 230 });
  // Plants spritesheet
  this.load.spritesheet('plants', '/plants-spritesheet.webp', { frameWidth: 160, frameHeight: 160 });

  // Guest agent spritesheets (128x64, 32x32 frames, 4x2 grid = 8 frames each)
  for (let i = 1; i <= 5; i++) {
    this.load.spritesheet('guest_anim_' + i, '/guest_anim_' + i + '.webp', { frameWidth: 32, frameHeight: 32 });
  }
  // guest_role_1.png is used as guest_anim_7 for OpenClaw (distinct from Manus's guest_anim_4)
  this.load.spritesheet('guest_anim_7', '/guest_role_1.png', { frameWidth: 32, frameHeight: 32 });

  // Desk sprite for center-left area
  this.load.image('desk', '/desk-v3.webp');

  // Sofa (v18) — top-right room area
  this.load.image('sofa', '/sofa-idle-v3.png');
  this.load.image('sofa_shadow', '/sofa-shadow-v1.png');
}

function create() {
  game = this;

  // 1. Create animations
  // Star idle animation — 48 frames (8 cols × 6 rows)
  if (!this.anims.exists('star_idle_anim')) {
    this.anims.create({
      key: 'star_idle_anim',
      frames: this.anims.generateFrameNumbers('star_idle', { start: 0, end: 47 }),
      frameRate: 12,
      repeat: -1
    });
  }

  // Coffee machine animation
  if (!this.anims.exists('cf_machine')) {
    this.anims.create({
      key: 'cf_machine',
      frames: this.anims.generateFrameNumbers('coffee_machine', { start: 0, end: 95 }),
      frameRate: 12, repeat: -1
    });
  }

  // Guest idle animations — frames 0~5 (6 frames), frameRate 6, repeat -1
  // Note: guest_anim_6 is skipped (identical to guest_anim_5), guest_anim_7 = guest_role_1.png (blue, for OpenClaw)
  for (let i = 1; i <= 7; i++) {
    if (i === 6) continue;
    if (!this.anims.exists('guest_idle_' + i)) {
      this.anims.create({
        key: 'guest_idle_' + i,
        frames: this.anims.generateFrameNumbers('guest_anim_' + i, { start: 0, end: 5 }),
        frameRate: 6,
        repeat: -1
      });
    }
  }

  // Custom character animations (company-a)
  if (!this.anims.exists('custom_hermes_idle')) {
    this.anims.create({
      key: 'custom_hermes_idle',
      frames: this.anims.generateFrameNumbers('custom_hermes', { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1
    });
  }

  // 2. Draw room background + furniture
  drawRoom(this);

  // 3. Characters
  areas = AREAS;
  placeCharacters(this);

  // 4. Camera
  mainCamera = this.cameras.main;
  mainCamera.setBounds(0, 0, 1280, 720);

  // 5. Fetch agent status
  fetchStatus();

  game.input.on('pointerdown', () => {
    const n = Date.now();
    if (n - lastClickFetch < 300) return;
    lastClickFetch = n;
    fetchStatus();
    fetchDepartments();
  });
}

let lastStatusRender = 0;

function update(time) {
  // Ensure office mode is synced to localStorage
  if (typeof window.currentOffice !== 'undefined') {
    localStorage.setItem('current_office', window.currentOffice);
  }
  if (time - lastFetch > FETCH_INT) { fetchStatus(); lastFetch = time; }
  if (ttIdx < ttTarget.length && time - lastTT > TT_DELAY) {
    ttText += ttTarget[ttIdx];
    const st = document.getElementById('status-text');
    if (st) st.textContent = ttText;
    ttIdx++; lastTT = time;
  }

  if (window.memberSprites) {
    MEMBERS.forEach(m => {
      const sp = window.memberSprites[m.id];
      const t = window.memberTargets[m.id];
      if (!sp || !t) return;

      // Update shadow to follow sprite
      const shadow = window.memberShadows && window.memberShadows[m.id];
      if (shadow) {
        const sy = m.id === 'hermes' ? sp.y + 44 : sp.y + 28;
        shadow.setPosition(sp.x, sy);
      }

      // Update status text position
      const stxt = memberStatusTexts[m.id];
      if (stxt) {
        const yOff = m.id === 'hermes' ? -54 : -42;
        stxt.setPosition(sp.x, sp.y + yOff);
      }
      // Update mood bubble position (redraw at current position)
      const moodBubble = memberMoodBubbles[m.id];
      if (moodBubble && moodBubble.text.text.length > 0) {
        const display = moodBubble.text.text;
        const lines = display.split('\n');
        const maxLen = Math.max(...lines.map(l => l.length));
        const tw = maxLen * 9 + 20;
        const numLines = lines.length;
        const lineH = 18;
        const bh = numLines * lineH + 4;
        const yOff = m.id === "hermes" ? -54 : -42;
        const statusY = sp.y + yOff;
        moodBubble.bg.clear();
        moodBubble.bg.fillStyle(0xf0ead6, 0.95);
        moodBubble.bg.fillRoundedRect(sp.x - tw/2, statusY - 8 - bh, tw, bh, 4);
        moodBubble.bg.lineStyle(1, 0x888888, 0.6);
        moodBubble.bg.strokeRoundedRect(sp.x - tw/2, statusY - 8 - bh, tw, bh, 4);
        moodBubble.bg.fillStyle(0xf0ead6, 0.95);
        moodBubble.bg.fillTriangle(sp.x - 3, statusY - 4, sp.x + 3, statusY - 4, sp.x, statusY);
        moodBubble.text.setPosition(sp.x, statusY - 6 - bh/2);
      }
      const lbl = window.memberLabels[m.id];
      if (lbl) lbl.setPosition(sp.x, sp.y + 22);

      if (m.id === 'hermes') return; // Hermes stays at center desk — skip movement but still update UI

      const dx = t.x - sp.x, dy = t.y - sp.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 3) { sp.x += (dx/dist) * 1.2; sp.y += (dy/dist) * 1.2; }
    });
  }
  if (star) moveStar(time);

  // Animate Hermes glow
  if (window.hermesGlow && star) {
    const pulse = 0.06 + Math.sin(time/600) * 0.03;
    window.hermesGlow.clear();
    window.hermesGlow.fillStyle(0xffd700, pulse);
    window.hermesGlow.fillCircle(star.x, star.y - 26, 22);
    window.hermesGlow.fillStyle(0xffd700, pulse * 0.5);
    window.hermesGlow.fillCircle(star.x, star.y - 26, 32);
  }

  }

// ===================== STATE =====================

function normalizeState(s) {
  if (!s) return 'idle';
  if (s === 'active' || s === 'idle') return 'idle';
  if (s === 'working') return 'writing';
  if (s === 'run' || s === 'running') return 'executing';
  if (s === 'sync') return 'syncing';
  if (s === 'research') return 'researching';
  return s;
}

function fetchStatus() {
  const token = localStorage.getItem('pixel_office_token');
  if (!token) return;
  const companyId = window.currentOffice || "company-a";
  const fetchPromise = fetch("/api/workers?t="+Date.now()+"&company_id="+companyId, {
    headers: { "Authorization": "Bearer "+token }, cache: "no-store"
  }).then(r => { if (!r.ok) throw new Error("HTTP "+r.status); return r.json(); });

  fetchPromise.then(data => {
    if (!Array.isArray(data) || !data.length) {
      if (window.memberStates) {
        MEMBERS.forEach(m => { window.memberStates[m.id] = 'idle'; window.memberMoods[m.id] = ''; });
        renderMemberStatus();
      }
      const companyLabel = companyId === 'company-a' ? 'MiniPC' : 'MacBook';
      ttTarget = '['+companyLabel+'] 尚無 workers，請先註冊';
      ttText = '';
      ttIdx = 0;
      pendingState = null;
      currentState = 'idle';
      if (star) star.setVisible(true);
      targetX = AREAS.center.x;
      targetY = AREAS.center.y;
      return;
    }
    const hw = data.find(w => (w.name||'').toLowerCase() === 'hermes') || data[0];
    const ns = normalizeState(hw.status||'idle');
    const si = STATES[ns] || STATES.idle;
    const changed = (pendingState === null) && (ns !== currentState);
    const det = hw.task_name || hw.task_message || '...';
    const nl = '['+si.name+'] '+det;
    if (changed) {
      ttTarget = nl; ttText = ''; ttIdx = 0; pendingState = null;
      currentState = ns;
      if (star) star.setVisible(true);
      targetX = (AREAS[si.area] || AREAS.lounge).x;
      targetY = (AREAS[si.area] || AREAS.lounge).y;
    } else if (ttTarget !== nl) { ttTarget = nl; ttText = ''; ttIdx = 0; }

    data.forEach(w => {
      const wn = (w.name||'').toLowerCase();
      let mm = null, bs = 0;
      MEMBERS.forEach(m => {
        let sc = 0;
        if (wn === m.id) sc = 3;
        else if (wn.includes(m.id)) sc = 2;
        else if (m.id.includes(wn)) sc = 1;
        if (sc > bs) { bs = sc; mm = m; }
      });
      if (!mm) return;
      const ws = normalizeState(w.status||'idle');
      window.memberStates[mm.id] = ws;
      window.memberMoods[mm.id] = w.mood || '';
      // Custom avatar: if worker has avatar data, load it
      // DISABLED: user prefers animated default sprites over static pixel art
      // if (w.avatar && !window.workerIdMap[mm.id]) {
      //   window.workerIdMap[mm.id] = w.id;
      //   loadCustomAvatar(w.id, mm.id);
      // }
      let ta = (STATES[ws] || STATES.idle).area;
      if (ws === 'idle') ta = mm.area;  // idle 時留在自己的書桌
      if (mm.id === 'hermes') ta = 'center';
      if (mm.id === 'openclaw') ta = 'sofa';
      if (AREAS[ta]) {
        window.memberTargets[mm.id] = { x: AREAS[ta].x + mm.offset.x, y: AREAS[ta].y + mm.offset.y };
      }
    });
    renderMemberStatus();
  })
  .catch(() => { ttTarget = '連線失敗'; ttText = ''; ttIdx = 0; pendingState = null; });
}

function wrapMoodText(text, maxLen) {
  maxLen = maxLen || 10;
  const result = [];
  for (let i = 0; i < text.length; i += maxLen) {
    result.push(text.substring(i, i + maxLen));
  }
  return result.join('\n');
}

function renderMemberStatus() {
  MEMBERS.forEach(m => {
    const sp = window.memberSprites[m.id];
    if (!sp) return;
    const state = window.memberStates[m.id] || 'idle';
    const label = STATUS_LABELS[state] || '閒置中';
    const txt = memberStatusTexts[m.id];
    if (txt) {
      txt.setText(label);
      txt.setFill(getStatusColor(state));
      
      // Update mood bubble (dialog bubble)
      const bubble = memberMoodBubbles[m.id];
      const mood = window.memberMoods[m.id] || '';
      if (bubble) {
        // Format mood with tildes
        const m = mood ? mood.trim() : '';
        const display = m ? (m.startsWith('~') && m.endsWith('~') ? m : '~ ' + m.replace(/^~+\s*|\s*~+$/g, '') + ' ~') : '';
        bubble.text.setText(wrapMoodText(display, 10));
      }
    }
  });
}

// ===================== CUSTOM AVATARS =====================

// Map worker DB ID → member ID (for custom avatar loading)
window.workerIdMap = {};

function loadCustomAvatar(workerId, memberId) {
  const sp = window.memberSprites[memberId];
  if (!sp || !sp.scene) return;
  const scene = sp.scene;
  const avKey = 'avatar_' + memberId;
  if (scene.textures.exists(avKey)) return; // Already loaded

  // Load the avatar image and create a sprite
  scene.load.image(avKey, '/api/workers/' + workerId + '/avatar');
  scene.load.start();
  scene.load.once('complete', () => {
    try {
      if (!scene.textures.exists(avKey)) return;
      const bx = sp.x, by = sp.y, depth = sp.depth;
      sp.destroy();

      const newSprite = scene.add.sprite(bx, by, avKey).setOrigin(0.5);
      newSprite.setScale(memberId === 'hermes' ? 0.83 : 0.6);
      newSprite.setDepth(depth);
      window.memberSprites[memberId] = newSprite;
      window.guestSprites[memberId] = newSprite;
      if (memberId === 'hermes') window.starSprite = newSprite;
    } catch(e) { console.warn('Avatar apply error:', memberId, e); }
  });
}

function moveStar(time) {
  if (star) star.setVisible(true);
}

// ===================== STATUS PANEL =====================

const MEMBER_ICONS = {
  hermes:'⭐', gemini:'🔮', manus:'✍️', codex:'📘',
  claude:'🟢', opencode:'🔧', openclaw:'🦞'
};

function getAreaLabel(target) {
  if (!target) return '⋯';
  const labels = {
    col1_top: '📐 左1上', col1_mid: '🔍 左1中', col1_bot: '🎨 左1下',
    col2_top: '💻 左2上', col2_mid: '🟢 左2中', col2_bot: '🔧 左2下',
    center: '⭐ 中央',
    lounge: '☕ 中央'
  };
  for (const [n, p] of Object.entries(AREAS)) {
    if (Math.abs(p.x - target.x) < 60 && Math.abs(p.y - target.y) < 60) {
      return labels[n] || n;
    }
  }
  return '🚶 移動中';
}

// ===================== WEBSOCKET =====================

function connectHermes() {
  const token = localStorage.getItem('pixel_office_token');
  if (!token) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${proto}//${location.host}/ws?token=${token}`);
  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (data.type === 'worker_ping' && data.worker) {
        handleWorkerUpdate(data.worker);
      }
    } catch(e) {}
  };
  ws.onclose = () => setTimeout(connectHermes, 5000); // auto-reconnect
}

function handleWorkerUpdate(worker) {
  if (!worker || !worker.name) return;
  const wn = worker.name.toLowerCase();
  let mm = null, bs = 0;
  MEMBERS.forEach(m => {
    let sc = 0;
    if (wn === m.id) sc = 3;
    else if (wn.includes(m.id)) sc = 2;
    else if (m.id.includes(wn)) sc = 1;
    if (sc > bs) { bs = sc; mm = m; }
  });
  if (!mm) return;
  window.memberStates[mm.id] = normalizeState(worker.status);
  window.memberMoods[mm.id] = worker.mood || '';
  // Custom avatar update via WebSocket — DISABLED (user prefers animated defaults)\n  // if (worker.avatar && !window.workerIdMap[mm.id]) {\n  //   window.workerIdMap[mm.id] = worker.id;\n  //   loadCustomAvatar(worker.id, mm.id);\n  // }
  renderMemberStatus();
}

// ===== BOOTSTRAP =====
initGame();