// Pixel Office v6 — Programmatic Clean Room
// Warm cozy room with NO background image cats

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
  { id:'hermes',   label:'Hermes',     role:'🏢 經理',   area:'manager_desk',  offset:{x:0,y:-20} },
  { id:'codex',    label:'Codex',      role:'📐 架構',   area:'desk_big_left', offset:{x:-20,y:-10} },
  { id:'openclaw', label:'OpenClaw',   role:'🧪 測試',   area:'desk_big_right',offset:{x:20,y:-10} },
  { id:'gemini',   label:'Gemini',     role:'🔍 研究',   area:'desk_small_1',  offset:{x:0,y:-10} },
  { id:'manus',    label:'Manus',      role:'🎨 UI/UX',  area:'desk_small_2',  offset:{x:0,y:-10} },
  { id:'claude',   label:'Claude Code',role:'💻 開發',   area:'desk_small_3',  offset:{x:0,y:-10} },
  { id:'opencode', label:'OpenCode',   role:'🔧 優化',   area:'desk_small_4',  offset:{x:0,y:-10} }
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

const AREAS = {
  lounge:        { x: 340, y: 500 },     // sofa area (center-left)
  desk_big_left: { x: 750,  y: 380 },    // Codex - large right desk
  desk_big_right:{ x: 920, y: 380 },     // OpenClaw - large right desk
  desk_small_1:  { x: 120,  y: 400 },    // Gemini - left wall desk
  desk_small_2:  { x: 250, y: 400 },     // Manus - left wall desk
  desk_small_3:  { x: 1050, y: 480 },    // Claude - right wall desk
  desk_small_4:  { x: 1150, y: 480 },    // OpenCode - right wall desk
  breakroom:     { x: 340, y: 500 },
  manager_desk:  { x: 640, y: 280 }      // Hermes - center
};

let game, star, areas={}, currentState='idle', pendingState=null;
let lastFetch=0, lastClickFetch=0, lastBubble=0, targetX=640, targetY=280;
let bubble=null, bubbleTimer=null, ttText='', ttTarget='', ttIdx=0, lastTT=0;
const FETCH_INT=3000, BUBBLE_INT=8000, TT_DELAY=50;
let mainCamera;
const spriteData = {};

// ===================== ROOM DRAWING =====================

function drawRoom(scene) {
  // Warm beige wall
  let g = scene.add.graphics().setDepth(0);
  g.fillStyle(0xd4a574, 1);
  g.fillRect(0, 0, 1280, 720);

  // Ceiling trim (dark brown stripe at top)
  g.fillStyle(0x5d4037, 1);
  g.fillRect(0, 0, 1280, 12);

  // Baseboard (dark brown stripe at bottom of wall area)
  g.fillStyle(0x5d4037, 1);
  g.fillRect(0, 360, 1280, 6);

  // Floor border
  g.fillStyle(0x3e2723, 1);
  g.fillRect(0, 366, 1280, 3);

  // Checkered floor (y: 369 to 720)
  const fy = 369;
  const ts = 20;
  for (let y = fy; y < 720; y += ts) {
    for (let x = 0; x < 1280; x += ts) {
      g.fillStyle(((x/ts) + Math.floor((y-fy)/ts)) % 2 === 0 ? 0xa0724e : 0x7a4e2d, 1);
      g.fillRect(x, y, ts, ts);
    }
  }

  // === FURNITURE ===

  // Red sofa (center-left area)
  const sofaG = scene.add.graphics().setDepth(3);
  // Sofa back
  sofaG.fillStyle(0xb71c1c, 1);
  sofaG.fillRect(200, 470, 280, 18);
  // Sofa seat
  sofaG.fillStyle(0xc62828, 1);
  sofaG.fillRect(200, 488, 280, 40);
  // Cushions
  sofaG.fillStyle(0xd32f2f, 1);
  sofaG.fillRect(210, 492, 80, 16);
  sofaG.fillRect(300, 492, 80, 16);
  sofaG.fillRect(390, 492, 80, 16);
  // Sofa arms
  sofaG.fillStyle(0xb71c1c, 1);
  sofaG.fillRect(195, 470, 10, 58);
  sofaG.fillRect(475, 470, 10, 58);
  // Sofa shadow
  sofaG.fillStyle(0x000000, 0.15);
  sofaG.fillRect(200, 528, 280, 8);

  // Large table (right-center) — for Codex & OpenClaw
  const tableG = scene.add.graphics().setDepth(3);
  tableG.fillStyle(0x5d4037, 1);
  tableG.fillRect(710, 365, 240, 8);
  tableG.fillStyle(0x6d4c41, 1);
  tableG.fillRect(710, 360, 240, 5);
  // Table legs
  tableG.fillStyle(0x4e342e, 1);
  tableG.fillRect(720, 373, 4, 12);
  tableG.fillRect(936, 373, 4, 12);

  // Bookshelf (left wall)
  const shelfG = scene.add.graphics().setDepth(3);
  shelfG.fillStyle(0x4e342e, 1);
  shelfG.fillRect(25, 140, 30, 200);
  // Shelves
  const shelfColors = [0xc62828, 0x1565c0, 0x2e7d32, 0xf9a825, 0x6a1b9a, 0x00897b];
  for (let i = 0; i < 6; i++) {
    const sy = 150 + i * 30;
    shelfG.fillStyle(0x6d4c41, 1);
    shelfG.fillRect(28, sy, 24, 3);
    // Books
    shelfG.fillStyle(shelfColors[i % shelfColors.length], 1);
    shelfG.fillRect(31, sy - 12, 6, 12);
    shelfG.fillStyle(shelfColors[(i+2) % shelfColors.length], 1);
    shelfG.fillRect(40, sy - 10, 5, 10);
    shelfG.fillStyle(shelfColors[(i+4) % shelfColors.length], 1);
    shelfG.fillRect(48, sy - 8, 4, 8);
  }

  // CENTRAL PERK sign
  const signG = scene.add.graphics().setDepth(3);
  signG.fillStyle(0x5d4037, 0.9);
  signG.fillRect(540, 55, 200, 30);
  signG.lineStyle(2, 0x3e2723);
  signG.strokeRect(540, 55, 200, 30);
  signG.fillStyle(0x4e342e, 0.7);
  signG.fillRect(544, 59, 192, 22);

  scene.add.text(640, 70, 'CENTRAL PERK', {
    fontFamily: 'monospace', fontSize: '14px',
    fill: '#ffd700', stroke: '#000', strokeThickness: 2
  }).setOrigin(0.5).setDepth(4);

  // Small desk 1 (left) — Gemini
  scene.add.rectangle(120, 395, 80, 8, 0x5d4037).setDepth(3);
  scene.add.rectangle(120, 391, 80, 4, 0x6d4c41).setDepth(4);

  // Small desk 2 (left) — Manus
  scene.add.rectangle(250, 395, 80, 8, 0x5d4037).setDepth(3);
  scene.add.rectangle(250, 391, 80, 4, 0x6d4c41).setDepth(4);

  // Small desk 3 (right) — Claude Code
  scene.add.rectangle(1050, 475, 80, 8, 0x5d4037).setDepth(3);
  scene.add.rectangle(1050, 471, 80, 4, 0x6d4c41).setDepth(4);

  // Small desk 4 (right) — OpenCode
  scene.add.rectangle(1150, 475, 80, 8, 0x5d4037).setDepth(3);
  scene.add.rectangle(1150, 471, 80, 4, 0x6d4c41).setDepth(4);

  // Coffee machine (left side, above bookshelf)
  const coffeeCompat = scene.add.sprite(120, 220, 'coffee_machine', 0)
    .setOrigin(0.5).setDepth(10).setScale(0.4);
  if (scene.anims.exists('cf_machine')) coffeeCompat.play('cf_machine', true);

  // Plant (right side)
  if (scene.textures.exists('plants')) {
    scene.add.sprite(1210, 200, 'plants',
      Math.floor(Math.random() * 16))
      .setOrigin(0.5).setDepth(10).setScale(0.4);
  }
}

// ===================== CHARACTERS =====================

function placeCharacters(scene) {
  window.memberSprites = {};
  window.memberLabels = {};
  window.memberStates = {};
  window.memberTargets = {};
  window.memberBadges = {};
  window.memberBadgeBgs = {};

  MEMBERS.forEach((m) => {
    const area = AREAS[m.area] || AREAS.lounge;
    const bx = area.x + m.offset.x;
    const by = area.y + m.offset.y;
    const tc = TOOL_COLORS[m.id] || { color: 0x888888, icon: '👤' };
    let sprite, badge, badgeBg;

    if (m.id === 'hermes') {
      sprite = scene.add.image(bx, by, 'star_idle_static').setOrigin(0.5);
      sprite.setScale(0.33);
      sprite.setDepth(20);
      star = sprite;
      // Gold star badge
      badgeBg = scene.add.rectangle(bx, by - 22, 20, 20, 0xffd700, 0.9)
        .setOrigin(0.5).setDepth(24).setStrokeStyle(1, 0x5d4037, 1);
      badge = scene.add.text(bx, by - 22, '⭐', {
        fontFamily: 'monospace', fontSize: '12px',
        stroke: '#000', strokeThickness: 2
      }).setOrigin(0.5).setDepth(25);
    } else {
      const idx = tc.spriteIdx || 1;
      const guestIdx = (idx % 6) || 6;
      if (scene.textures.exists('guest_anim_' + guestIdx)) {
        sprite = scene.add.sprite(bx, by, 'guest_anim_' + guestIdx, 0).setOrigin(0.5);
        sprite.setScale(1.0);
        sprite.setDepth(20);
        if (scene.anims.exists('g_idle_' + guestIdx)) {
          sprite.play('g_idle_' + guestIdx, true);
        }
      } else {
        sprite = scene.add.rectangle(bx, by, 12, 18, tc.color).setOrigin(0.5).setDepth(20);
      }
      // Colored badge
      badgeBg = scene.add.rectangle(bx, by - 20, 16, 16, tc.color, 0.8)
        .setOrigin(0.5).setDepth(24).setStrokeStyle(1, 0x000000, 0.8);
      badge = scene.add.text(bx, by - 20, tc.icon, {
        fontFamily: 'monospace', fontSize: '10px',
        stroke: '#000', strokeThickness: 2
      }).setOrigin(0.5).setDepth(25);
    }

    window.memberSprites[m.id] = sprite;
    window.memberBadges[m.id] = badge;
    window.memberBadgeBgs[m.id] = badgeBg;
    window.memberStates[m.id] = 'idle';
    window.memberTargets[m.id] = { x: bx, y: by };

    const label = scene.add.text(bx, by + 18, m.label, {
      fontFamily: 'monospace', fontSize: '7px', fill: '#fff',
      stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(21);
    window.memberLabels[m.id] = label;
    spriteData[m.id] = { badge, label };
  });
  window.starSprite = star;
}

function drawPlaque(scene) {
  const p = scene.add.rectangle(640, 700, 260, 26, 0x5d4037, 0.92).setDepth(30);
  p.setStrokeStyle(2, 0x3e2723);
  scene.add.text(640, 700, 'Pixel Office', {
    fontFamily: 'monospace', fontSize: '13px', fill: '#ffd700',
    fontWeight: 'bold', stroke: '#000', strokeThickness: 2
  }).setOrigin(0.5).setDepth(31);
  scene.add.text(530, 700, '⭐', {fontFamily:'monospace',fontSize:'12px'}).setOrigin(0.5).setDepth(31);
  scene.add.text(750, 700, '⭐', {fontFamily:'monospace',fontSize:'12px'}).setOrigin(0.5).setDepth(31);
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
  totalAssets = 9;
  loadedAssets = 0;

  const ps = document.createElement('style');
  ps.textContent = '@keyframes lp{0%,100%{box-shadow:0 0 5px #ffd700}50%{box-shadow:0 0 15px #ffd700}}' +
    '#loading-progress-bar{transition:width 0.3s ease;animation:lp 1.5s ease-in-out infinite}';
  document.head.appendChild(ps);
  this.load.on('filecomplete', updateLoadingProgress);
  this.load.on('complete', hideLoadingOverlay);

  this.load.image('star_idle_static', '/star-idle-v5.png');
  this.load.spritesheet('coffee_machine', '/coffee-machine-v3-grid.webp', { frameWidth: 230, frameHeight: 230 });
  this.load.spritesheet('plants', '/plants-spritesheet.webp', { frameWidth: 160, frameHeight: 160 });

  for (let i = 1; i <= 6; i++) {
    this.load.spritesheet('guest_anim_' + i, '/guest_anim_' + i + '.webp', { frameWidth: 32, frameHeight: 32 });
  }
}

function create() {
  game = this;

  // 1. Draw room background + furniture
  drawRoom(this);

  // 2. Coffee machine animation
  if (!this.anims.exists('cf_machine')) {
    this.anims.create({
      key: 'cf_machine',
      frames: this.anims.generateFrameNumbers('coffee_machine', { start: 0, end: 95 }),
      frameRate: 12, repeat: -1
    });
  }

  // 3. Guest animations
  for (let i = 1; i <= 6; i++) {
    if (!this.anims.exists('g_idle_' + i)) {
      this.anims.create({
        key: 'g_idle_' + i,
        frames: this.anims.generateFrameNumbers('guest_anim_' + i, { start: 0, end: 5 }),
        frameRate: 6, repeat: -1
      });
    }
  }

  // 4. Characters
  areas = AREAS;
  placeCharacters(this);
  drawPlaque(this);

  // 5. Camera
  mainCamera = this.cameras.main;
  mainCamera.setBounds(0, 0, 1280, 720);

  // 6. Remote data
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
  if (time - lastStatusRender > 2000) { renderMemberStatus(); lastStatusRender = time; }
  if (time - lastBubble > BUBBLE_INT) { showBubble(); lastBubble = time; }
  if (ttIdx < ttTarget.length && time - lastTT > TT_DELAY) {
    ttText += ttTarget[ttIdx];
    const st = document.getElementById('status-text');
    if (st) st.textContent = ttText;
    ttIdx++; lastTT = time;
  }

  if (window.memberSprites) {
    MEMBERS.forEach(m => {
      if (m.id === 'hermes') return;
      const sp = window.memberSprites[m.id];
      const t = window.memberTargets[m.id];
      if (!sp || !t) return;
      const dx = t.x - sp.x, dy = t.y - sp.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 3) { sp.x += (dx/dist) * 1.2; sp.y += (dy/dist) * 1.2; }
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
  const bg = game.add.rectangle(640, by, text.length*8+16, 22, 0xffffff, 0.95).setStrokeStyle(2, 0x000);
  const txt = game.add.text(640, by, text, { fontFamily: 'monospace', fontSize: '10px', fill: '#000' }).setOrigin(0.5);
  bubble = game.add.container(0, 0, [bg, txt]).setDepth(1200);
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

function renderMemberStatus() {
  const list = document.getElementById('member-status-list');
  if (!list) return;
  let html = '';
  MEMBERS.forEach(m => {
    const s = window.memberStates?.[m.id] || 'idle';
    const c = getStatusColor(m.id);
    const icon = MEMBER_ICONS[m.id] || '👤';
    const target = window.memberTargets?.[m.id];
    const area = getAreaLabel(target);
    html += `<div class="member-status-row">` +
      `<span class="member-status-dot" style="background:${c}"></span>` +
      `<span class="member-status-name">${icon} ${m.label}</span>` +
      `<span class="member-status-area">${area}</span></div>`;
  });
  list.innerHTML = html;
}

// ===================== SIDEBAR =====================

let departments = [];

async function loadDepartments() {
  const tk = localStorage.getItem('token');
  if (!tk) return;
  try {
    const r = await fetch('/api/departments?t='+Date.now(), {
      headers: { 'Authorization': 'Bearer '+tk }, cache: 'no-store'
    });
    if (!r.ok) return;
    const d = await r.json();
    departments = Array.isArray(d) ? d : [];
  } catch(e) { /* silent */ }
}
async function fetchDepartments() { await loadDepartments(); }

// ===================== MEMO =====================

async function loadMemo() {
  try {
    const r = await fetch('/api/memo?t='+Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const d = await r.json();
    const el = document.getElementById('memo-content');
    if (el && d.content) el.innerHTML = d.content.replace(/\n/g, '<br>');
  } catch(e) { /* silent */ }
}

// ===================== WEBSOCKET =====================

function connectHermes() {}

// ===== BOOTSTRAP =====
initGame();