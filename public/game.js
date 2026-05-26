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
  idle: { name:'待命', area:'lounge' },
  writing: { name:'整理文檔', area:'desk_big_left' },
  researching: { name:'搜尋資訊', area:'desk_small_1' },
  executing: { name:'執行任務', area:'desk_big_right' },
  syncing: { name:'同步備份', area:'desk_small_3' },
  error: { name:'出錯了', area:'lounge' }
};
const BTEXTS = {
  idle:['待命中','喝杯咖啡','放個風','找靈感'],
  writing:['進入專注模式','跑關鍵路徑','關 bug 進籠子'],
  researching:['挖證據鏈','定位問題','找關鍵'],
  executing:['執行中','跑 pipeline','看結果'],
  syncing:['同步到雲端','備份中','多一份安心'],
  error:['別慌','找到 bug','錯誤是線索']
};

const MEMBERS = [
  { id:'hermes',   label:'Hermes',     role:'🏢 經理',   area:'manager_desk',  offset:{x:0,y:0} },
  { id:'codex',    label:'Codex',      role:'📐 架構',   area:'lounge',        offset:{x:-60,y:0} },
  { id:'openclaw', label:'OpenClaw',   role:'🧪 測試',   area:'lounge',        offset:{x:0,y:0} },
  { id:'gemini',   label:'Gemini',     role:'🔍 研究',   area:'desk_small_1',  offset:{x:0,y:0} },
  { id:'manus',    label:'Manus',      role:'🎨 UI/UX',  area:'desk_small_2',  offset:{x:0,y:0} },
  { id:'claude',   label:'Claude Code',role:'💻 開發',   area:'desk_small_3',  offset:{x:0,y:0} },
  { id:'opencode', label:'OpenCode',   role:'🔧 優化',   area:'lounge',        offset:{x:60,y:0} }
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
  lounge:        { x: 340, y: 505 },     // sofa area (center) - seat level
  desk_big_left: { x: 750,  y: 380 },    // reserved for writing state
  desk_big_right:{ x: 920, y: 380 },     // reserved for executing state
  desk_small_1:  { x: 120,  y: 390 },    // Gemini - left desk
  desk_small_2:  { x: 250, y: 390 },     // Manus - left desk
  desk_small_3:  { x: 1050, y: 470 },    // Claude Code - right desk
  desk_small_4:  { x: 1150, y: 475 },    // reserved
  breakroom:     { x: 340, y: 505 },
  manager_desk:  { x: 640, y: 280 }      // Hermes - center top
};

let game, star, areas={}, currentState='idle', pendingState=null;
let lastFetch=0, lastClickFetch=0, lastBubble=0, targetX=640, targetY=280;
let bubble=null, bubbleTimer=null, ttText='', ttTarget='', ttIdx=0, lastTT=0;
const FETCH_INT=3000, BUBBLE_INT=8000, TT_DELAY=50;
let mainCamera;
const spriteData = {};

// ===================== ROOM DRAWING =====================

function drawRoom(scene) {
  // 1. Background image (depth 0) — Central Perk coffee shop scene
  if (scene.textures.exists('office_bg')) {
    scene.add.image(640, 360, 'office_bg').setOrigin(0.5).setDepth(0);
  }

  // === WARM LIGHTING OVERLAY (depth 1) — subtle, complements background ===
  const lightG = scene.add.graphics().setDepth(1);
  // Warm glow from fireplace (left-center) — matches winter cabin mood
  lightG.fillStyle(0xff8844, 0.04);
  lightG.fillCircle(300, 380, 350);
  lightG.fillStyle(0xffaa66, 0.025);
  lightG.fillCircle(300, 380, 500);
  // Gentle warm wash from the right side
  lightG.fillStyle(0xffcc66, 0.02);
  lightG.fillCircle(1150, 250, 280);
  // Ultra-subtle overall warmth
  lightG.fillStyle(0xffdd99, 0.015);
  lightG.fillRect(0, 0, 1280, 720);

  // === FLOOR (depth 2) — checkerboard pattern ===
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

  // Warm rug under sofa area
  const rugG = scene.add.graphics().setDepth(2);
  rugG.fillStyle(0x5d4037, 0.25);
  rugG.fillEllipse(340, 520, 320, 50);
  rugG.lineStyle(1, 0x8d6e63, 0.2);
  rugG.strokeEllipse(340, 520, 318, 48);

  // CENTRAL PERK sign — depth 3 — wall-mounted plaque
  const signG = scene.add.graphics().setDepth(3);
  // Sign shadow
  signG.fillStyle(0x000000, 0.12);
  signG.fillRect(555, 62, 180, 24);
  // Sign board — warm wood, fully opaque
  signG.fillStyle(0x3e2723, 1);
  signG.fillRect(553, 60, 184, 24);
  signG.fillStyle(0x5d4037, 1);
  signG.fillRect(555, 62, 180, 20);
  // Gold border
  signG.lineStyle(1, 0xffd700, 0.7);
  signG.strokeRect(554, 61, 182, 22);
  // Sign screws
  signG.fillStyle(0xffd700, 0.8);
  signG.fillCircle(560, 66, 2);
  signG.fillCircle(730, 66, 2);
  scene.add.text(640, 72, 'CENTRAL PERK', {
    fontFamily: 'monospace', fontSize: '11px',
    fill: '#ffd700', stroke: '#000', strokeThickness: 1
  }).setOrigin(0.5).setDepth(4).setAlpha(1);

  // Coffee machine (left side) — depth 5
  const coffeeCompat = scene.add.sprite(120, 220, 'coffee_machine', 0)
    .setOrigin(0.5).setDepth(5).setScale(0.4);
  if (scene.anims.exists('cf_machine')) coffeeCompat.play('cf_machine', true);

  // Plant (right side) — depth 5 — with pot shadow
  if (scene.textures.exists('plants')) {
    // Plant pot shadow
    const pG = scene.add.graphics().setDepth(4);
    pG.fillStyle(0x000000, 0.15);
    pG.fillEllipse(1210, 215, 40, 10);
    scene.add.sprite(1210, 200, 'plants',
      Math.floor(Math.random() * 16))
      .setOrigin(0.5).setDepth(5).setScale(0.4);
  }

  // === SUBTLE VIGNETTE CORNERS (depth 50) — just frames the scene ===
  const vigG = scene.add.graphics().setDepth(50);
  // Very soft corner darkening
  vigG.fillStyle(0x000000, 0.04);
  vigG.fillRect(0, 0, 40, 720);
  vigG.fillRect(1240, 0, 40, 720);
  vigG.fillRect(0, 0, 1280, 15);
  vigG.fillRect(0, 705, 1280, 15);
}

// ===================== CHARACTERS =====================

function placeCharacters(scene) {
  window.memberSprites = {};
  window.memberLabels = {};
  window.memberStates = {};
  window.memberTargets = {};
  window.memberBadges = {};
  window.memberBadgeBgs = {};
  window.memberShadows = {};
  window.guestSprites = {};

  MEMBERS.forEach((m) => {
    const area = AREAS[m.area] || AREAS.lounge;
    const bx = area.x + m.offset.x;
    const by = area.y + m.offset.y;
    const tc = TOOL_COLORS[m.id] || { color: 0x888888, icon: '👤' };
    let sprite, badge, badgeBg;

    // === Shadow beneath character ===
    const shadowG = scene.add.graphics().setDepth(9);
    if (m.id === 'hermes') {
      // Wider shadow for Hermes (he's bigger)
      shadowG.fillStyle(0x000000, 0.15);
      shadowG.fillEllipse(0, 0, 38, 10);
      shadowG.setPosition(bx, by + 38);
    } else {
      const sw = m.area === 'lounge' ? 26 : 20;
      shadowG.fillStyle(0x000000, 0.14);
      shadowG.fillEllipse(0, 0, sw, 7);
      shadowG.setPosition(bx, by + 24);
    }
    window.memberShadows[m.id] = shadowG;

    if (m.id === 'hermes') {
      // Hermes uses star-idle-v5 spritesheet (2048x1536, 256x256 frames)
      sprite = scene.add.sprite(bx, by, 'star_idle', 0).setOrigin(0.5);
      sprite.setScale(0.33);
      sprite.setDepth(10);
      if (scene.anims.exists('star_idle_anim')) {
        sprite.play('star_idle_anim', true);
      }
      star = sprite;

      // Glow aura behind Hermes badge
      const glowG = scene.add.graphics().setDepth(11);
      glowG.fillStyle(0xffd700, 0.15);
      glowG.fillCircle(bx, by - 22, 18);
      glowG.fillStyle(0xffd700, 0.08);
      glowG.fillCircle(bx, by - 22, 26);
      window.hermesGlow = glowG;

      // Gold star badge above — enhanced
      badgeBg = scene.add.rectangle(bx, by - 22, 22, 22, 0xffd700, 0.95)
        .setOrigin(0.5).setDepth(12).setStrokeStyle(2, 0xffaa00, 1);
      badge = scene.add.text(bx, by - 22, '⭐', {
        fontFamily: 'monospace', fontSize: '13px',
        stroke: '#000', strokeThickness: 2
      }).setOrigin(0.5).setDepth(12);
    } else {
      // Guest agents use guest_anim_N spritesheets (128x64, 32x32 frames)
      const guestIdx = GUEST_SPRITE_INDEX[m.id];
      const spriteKey = 'guest_anim_' + guestIdx;
      const animKey = 'guest_idle_' + guestIdx;

      sprite = scene.add.sprite(bx, by, spriteKey, 0).setOrigin(0.5);
      // Sofa characters sit lower with smaller scale; desk characters stand tall
      const scale = m.area === 'lounge' ? 1.2 : 1.5;
      sprite.setScale(scale);
      sprite.setDepth(10);
      if (scene.anims.exists(animKey)) {
        sprite.play(animKey, true);
      }

      // Store reference for animation restart on re-create
      window.guestSprites[m.id] = sprite;

      // Colored badge — enhanced with glow
      badgeBg = scene.add.rectangle(bx, by - 20, 18, 18, tc.color, 0.85)
        .setOrigin(0.5).setDepth(12).setStrokeStyle(2, 0x000000, 0.6);
      badge = scene.add.text(bx, by - 20, tc.icon, {
        fontFamily: 'monospace', fontSize: '11px',
        stroke: '#000', strokeThickness: 2
      }).setOrigin(0.5).setDepth(12);
    }

    window.memberSprites[m.id] = sprite;
    window.memberBadges[m.id] = badge;
    window.memberBadgeBgs[m.id] = badgeBg;
    window.memberStates[m.id] = 'idle';
    window.memberTargets[m.id] = { x: bx, y: by };

    // Name label — enhanced with pointer arrow
    const labelBg = scene.add.rectangle(bx, by + 18, m.label.length * 6 + 10, 14, 0x1a1a2e, 0.55)
      .setOrigin(0.5).setDepth(11).setStrokeStyle(1, 0xffd700, 0.25);
    // Small arrow pointing up to character
    const arrowG = scene.add.graphics().setDepth(11);
    arrowG.fillStyle(0x1a1a2e, 0.45);
    arrowG.fillTriangle(-3, 0, 3, 0, 0, 3);
    arrowG.setPosition(bx, by + 11);
    window.memberLabelBgs = window.memberLabelBgs || {};
    window.memberLabelBgs[m.id] = labelBg;
    window.memberArrows = window.memberArrows || {};
    window.memberArrows[m.id] = arrowG;

    const label = scene.add.text(bx, by + 18, m.label, {
      fontFamily: 'monospace', fontSize: '8px', fill: '#fff',
      fontStyle: 'bold',
      stroke: '#000', strokeThickness: 1
    }).setOrigin(0.5).setDepth(12);
    window.memberLabels[m.id] = label;
    spriteData[m.id] = { badge, label };
  });
  window.starSprite = star;
}

function drawPlaque(scene) {
  // Shadow
  const pShadow = scene.add.rectangle(642, 702, 266, 30, 0x000000, 0.2).setDepth(30);
  const p = scene.add.rectangle(640, 700, 260, 28, 0x3e2723, 1).setDepth(30);
  p.setStrokeStyle(2, 0xffd700, 0.5);
  // Inner border
  const pInner = scene.add.rectangle(640, 700, 252, 20, 0x5d4037, 1).setDepth(30);
  scene.add.text(640, 700, '☕ Pixel Office — Central Perk', {
    fontFamily: 'monospace', fontSize: '13px', fill: '#ffd700',
    fontWeight: 'bold', stroke: '#000', strokeThickness: 2
  }).setOrigin(0.5).setDepth(31);
  scene.add.text(525, 700, '⭐', {fontFamily:'monospace',fontSize:'12px'}).setOrigin(0.5).setDepth(31);
  scene.add.text(755, 700, '⭐', {fontFamily:'monospace',fontSize:'12px'}).setOrigin(0.5).setDepth(31);
  // Small dots
  scene.add.text(565, 700, '·', {fontFamily:'monospace',fontSize:'12px',fill:'#ffd700'}).setOrigin(0.5).setDepth(31);
  scene.add.text(715, 700, '·', {fontFamily:'monospace',fontSize:'12px',fill:'#ffd700'}).setOrigin(0.5).setDepth(31);
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
  totalAssets = 1 + 1 + 1 + 1 + 6; // bg + star + coffee + plants + 6 guests
  loadedAssets = 0;

  const ps = document.createElement('style');
  ps.textContent = '@keyframes lp{0%,100%{box-shadow:0 0 5px #ffd700}50%{box-shadow:0 0 15px #ffd700}}' +
    '#loading-progress-bar{transition:width 0.3s ease;animation:lp 1.5s ease-in-out infinite}';
  document.head.appendChild(ps);
  this.load.on('filecomplete', updateLoadingProgress);
  this.load.on('complete', hideLoadingOverlay);

  // Background image — Central Perk coffee shop scene
  this.load.image('office_bg', '/office_bg_small.webp');

  // Hermes spritesheet — star idle animation (2048x1536, 256x256 frames)
  this.load.spritesheet('star_idle', '/star-idle-v5.png', { frameWidth: 256, frameHeight: 256 });

  // Coffee machine spritesheet
  this.load.spritesheet('coffee_machine', '/coffee-machine-v3-grid.webp', { frameWidth: 230, frameHeight: 230 });
  // Plants spritesheet
  this.load.spritesheet('plants', '/plants-spritesheet.webp', { frameWidth: 160, frameHeight: 160 });

  // Guest agent spritesheets (128x64, 32x32 frames, 4x2 grid = 8 frames each)
  for (let i = 1; i <= 5; i++) {
    this.load.spritesheet('guest_anim_' + i, '/guest_anim_' + i + '.webp', { frameWidth: 32, frameHeight: 32 });
  }
  // guest_role_5.png is a different spritesheet used as guest_anim_7
  this.load.spritesheet('guest_anim_7', '/guest_role_5.png', { frameWidth: 32, frameHeight: 32 });
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
  // Note: guest_anim_6 is skipped (identical to guest_anim_5), guest_anim_7 = guest_role_5.png
  for (let i = 1; i <= 7; i++) {
    if (i === 6) continue; // guest_anim_6 not loaded (duplicate of 5)
    if (!this.anims.exists('guest_idle_' + i)) {
      this.anims.create({
        key: 'guest_idle_' + i,
        frames: this.anims.generateFrameNumbers('guest_anim_' + i, { start: 0, end: 5 }),
        frameRate: 6,
        repeat: -1
      });
    }
  }

  // 2. Draw room background + furniture
  drawRoom(this);

  // 3. Characters
  areas = AREAS;
  placeCharacters(this);
  drawPlaque(this);

  // 4. Camera
  mainCamera = this.cameras.main;
  mainCamera.setBounds(0, 0, 1280, 720);

  // 5. Remote data
  loadMemo();
  fetchStatus();
  loadDepartments();
  renderMemberStatus();

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
  if (time - lastFetch > FETCH_INT) { fetchStatus(); lastFetch = time; }
  if (time - lastBubble > BUBBLE_INT) { showBubble(); lastBubble = time; }
  if (ttIdx < ttTarget.length && time - lastTT > TT_DELAY) {
    ttText += ttTarget[ttIdx];
    const st = document.getElementById('status-text');
    if (st) st.textContent = ttText;
    ttIdx++; lastTT = time;
  }

  if (window.memberSprites) {
    MEMBERS.forEach(m => {
      if (m.id === 'hermes') return; // Hermes stays at center desk
      const sp = window.memberSprites[m.id];
      const t = window.memberTargets[m.id];
      if (!sp || !t) return;
      const dx = t.x - sp.x, dy = t.y - sp.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 3) { sp.x += (dx/dist) * 1.2; sp.y += (dy/dist) * 1.2; }

      // Update shadow to follow sprite
      const shadow = window.memberShadows && window.memberShadows[m.id];
      if (shadow) {
        const sy = m.id === 'hermes' ? sp.y + 38 : sp.y + 24;
        shadow.setPosition(sp.x, sy);
      }

      // Update label background to follow sprite
      const lblBg = window.memberLabelBgs && window.memberLabelBgs[m.id];
      if (lblBg) lblBg.setPosition(sp.x, sp.y + 18);
      // Update arrow to follow sprite
      const arr = window.memberArrows && window.memberArrows[m.id];
      if (arr) {
        arr.setPosition(sp.x, sp.y + 11);
      }

      // Update badge position to follow sprite
      const badge = window.memberBadges[m.id];
      if (badge) {
        badge.setPosition(sp.x, sp.y - 20);
        badge.setY(sp.y - 20 + Math.sin(time/300 + parseFloat('0.'+m.id.charCodeAt(0)))*1.5);
      }
      const badgeBg = window.memberBadgeBgs && window.memberBadgeBgs[m.id];
      if (badgeBg) {
        badgeBg.setPosition(sp.x, sp.y - 20);
        badgeBg.setY(sp.y - 20 + Math.sin(time/300 + parseFloat('0.'+m.id.charCodeAt(0)))*1.5);
      }
      const lbl = window.memberLabels[m.id];
      if (lbl) lbl.setPosition(sp.x, sp.y + 18);
    });
  }
  if (star) moveStar(time);

  // Animate Hermes glow
  if (window.hermesGlow && star) {
    const pulse = 0.12 + Math.sin(time/600) * 0.06;
    window.hermesGlow.clear();
    window.hermesGlow.fillStyle(0xffd700, pulse);
    window.hermesGlow.fillCircle(star.x, star.y - 22, 18);
    window.hermesGlow.fillStyle(0xffd700, pulse * 0.6);
    window.hermesGlow.fillCircle(star.x, star.y - 22, 26);
  }

  // Animate badge glows (pulse effect)
  MEMBERS.forEach(m => {
    const bbg = window.memberBadgeBgs && window.memberBadgeBgs[m.id];
    if (bbg) {
      const pulse = 0.7 + Math.sin(time/500 + parseFloat('0.'+m.id.charCodeAt(0)))*0.15;
      bbg.setAlpha(pulse);
    }
  });
}

// ===================== STATE =====================

function normalizeState(s) {
  if (!s) return 'idle';
  if (s === 'working') return 'writing';
  if (s === 'run' || s === 'running') return 'executing';
  if (s === 'sync') return 'syncing';
  if (s === 'research') return 'researching';
  return s;
}

function fetchStatus() {
  const token = localStorage.getItem('token');
  if (!token) return;
  fetch('/api/workers?t='+Date.now(), {
    headers: { 'Authorization': 'Bearer '+token }, cache: 'no-store'
  })
  .then(r => { if (!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
  .then(data => {
    if (!Array.isArray(data) || !data.length) return;
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
      let ta = (STATES[ws] || STATES.idle).area;
      if (mm.id === 'hermes') ta = 'manager_desk';
      if (AREAS[ta]) {
        window.memberTargets[mm.id] = { x: AREAS[ta].x + mm.offset.x, y: AREAS[ta].y + mm.offset.y };
      }
    });
    renderMemberStatus();
  })
  .catch(() => { ttTarget = '連線失敗'; ttText = ''; ttIdx = 0; pendingState = null; });
}

function moveStar(time) {
  if (star) star.setVisible(true);
}

// ===================== BUBBLES =====================

function showBubble() {
  if (bubbleTimer) clearTimeout(bubbleTimer);
  if (bubble) { bubble.destroy(); bubble = null; }
  const texts = BTEXTS[currentState] || BTEXTS.idle;
  const text = texts[Math.floor(Math.random()*texts.length)];
  const by = 280;
  const tw = text.length * 8 + 20;
  // Speech bubble with tail
  const bg = game.add.graphics();
  bg.fillStyle(0xffffff, 0.95);
  bg.fillRoundedRect(-tw/2, -11, tw, 22, 4);
  bg.fillStyle(0xffd700, 0.3);
  bg.fillRoundedRect(-tw/2, -11, tw/3, 22, 4);
  bg.lineStyle(2, 0x000000, 0.8);
  bg.strokeRoundedRect(-tw/2, -11, tw, 22, 4);
  // Bubble tail (triangle pointing down)
  bg.fillStyle(0xffffff, 0.95);
  bg.fillTriangle(-4, 11, 4, 11, 0, 16);
  const txt = game.add.text(0, 0, text, {
    fontFamily: 'monospace', fontSize: '11px', fill: '#1a1a2e',
    fontStyle: 'bold'
  }).setOrigin(0.5);
  bubble = game.add.container(640, by, [bg, txt]).setDepth(1200);
  bubbleTimer = setTimeout(() => { if (bubble) { bubble.destroy(); bubble = null; } bubbleTimer = null; }, 3000);
}

// ===================== STATUS PANEL =====================

const MEMBER_ICONS = {
  hermes:'⭐', gemini:'🔮', manus:'✍️', codex:'📘',
  claude:'🟢', opencode:'🔧', openclaw:'🦞'
};

function getStatusColor(mid) {
  const s = window.memberStates?.[mid] || 'idle';
  switch(s) {
    case 'error': return '#e74c3c';
    case 'writing': case 'researching': case 'executing': return '#f1c40f';
    case 'syncing': return '#3498db';
    default: return '#2ecc71';
  }
}

function getAreaLabel(target) {
  if (!target) return '⋯';
  const labels = {
    lounge: '☕ 沙發區',
    desk_big_left: '📐 大桌', desk_big_right: '🧪 大桌',
    desk_small_1: '🔍 小桌', desk_small_2: '🎨 小桌',
    desk_small_3: '💻 小桌', desk_small_4: '🔧 小桌',
    breakroom: '🏢 辦公室', manager_desk: '⭐ 經理位'
  };
  for (const [n, p] of Object.entries(AREAS)) {
    if (Math.abs(p.x - target.x) < 60 && Math.abs(p.y - target.y) < 60) {
      return labels[n] || n;
    }
  }
  return '🚶 移動中';
}

// ===================== WEBSOCKET =====================

function connectHermes() {}

// ===== BOOTSTRAP =====
initGame();