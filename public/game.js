// Pixel Office v5 — Single-room coffee shop using pre-drawn background
// Pattern: background image + character overlays (Star Office UI approach)

let supportsWebP = false;
function checkWebPSupport() {
  return new Promise(r => {
    const c = document.createElement('canvas');
    if (c.getContext && c.getContext('2d')) r(c.toDataURL('image/webp').indexOf('data:image/webp') === 0);
    else r(false);
  });
}
function getExt(f) {
  if (LAYOUT.forcePng[f.replace(/\.(png|webp)$/,'')]) return '.png';
  return supportsWebP ? '.webp' : '.png';
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
  { id:'hermes',   label:'Hermes',     role:'🏢 經理',   area:'manager_desk',  offset:{x:0,y:10} },
  { id:'codex',    label:'Codex',      role:'📐 架構',   area:'desk_big_left', offset:{x:-30,y:-5} },
  { id:'openclaw', label:'OpenClaw',   role:'🧪 測試',   area:'desk_big_right',offset:{x:30,y:-5} },
  { id:'gemini',   label:'Gemini',     role:'🔍 研究',   area:'desk_small_1',  offset:{x:0,y:10} },
  { id:'manus',    label:'Manus',      role:'🎨 UI/UX',  area:'desk_small_2',  offset:{x:0,y:10} },
  { id:'claude',   label:'Claude Code',role:'💻 開發',   area:'desk_small_3',  offset:{x:0,y:10} },
  { id:'opencode', label:'OpenCode',   role:'🔧 優化',   area:'desk_small_4',  offset:{x:0,y:10} }
];

let game, star, areas={}, currentState='idle', pendingState=null;
let lastFetch=0, lastClickFetch=0, lastBubble=0, targetX=640, targetY=340;
let bubble=null, bubbleTimer=null, ttText='', ttTarget='', ttIdx=0, lastTT=0;
const FETCH_INT=3000, BUBBLE_INT=8000, TT_DELAY=50;
let mainCamera;
const spriteData = {};

// ===================== BACKGROUND + CHARACTERS =====================

function placeCharacters(scene) {
  window.memberSprites = {};
  window.memberLabels = {};
  window.memberStates = {};
  window.memberTargets = {};
  window.memberBadges = {};
  window.memberBadgeBgs = {};

  MEMBERS.forEach((m) => {
    const area = areas[m.area] || areas.lounge;
    const bx = area.x + m.offset.x;
    const by = area.y + m.offset.y;
    const tc = LAYOUT.toolColors[m.id] || { color: 0x888888, icon: '👤' };
    let sprite, badge, badgeBg;

    if (m.id === 'hermes') {
      // Hermes is the big star — static image overlay
      sprite = scene.add.image(bx, by, 'star_idle_static').setOrigin(0.5);
      sprite.setScale(0.35);
      sprite.setDepth(20);
      star = sprite;
      // Gold glow badge for Hermes
      badgeBg = scene.add.rectangle(bx, by-24, 20, 20, 0xffd700, 0.9)
        .setOrigin(0.5).setDepth(24).setStrokeStyle(1, 0x5d4037, 1);
      badge = scene.add.text(bx, by-24, '⭐', {
        fontFamily: 'monospace', fontSize: '13px',
        stroke: '#000', strokeThickness: 2
      }).setOrigin(0.5).setDepth(25);
      window.memberBadges[m.id] = badge;
      window.memberBadgeBgs[m.id] = badgeBg;
    } else {
      // Guest agents — animated sprites
      const idx = tc.spriteIdx || 1;
      const guestIdx = (idx % 6) || 6;
      if (scene.textures.exists('guest_anim_'+guestIdx)) {
        sprite = scene.add.sprite(bx, by, 'guest_anim_'+guestIdx, 0).setOrigin(0.5);
        sprite.setScale(1.0);
        sprite.setDepth(20);
        if (scene.anims.exists('g_idle_'+guestIdx)) {
          sprite.play('g_idle_'+guestIdx, true);
        }
      } else {
        sprite = scene.add.rectangle(bx, by, 12, 20, tc.color).setOrigin(0.5).setDepth(20);
      }
      // Colored badge for each agent
      badgeBg = scene.add.rectangle(bx, by-22, 18, 18, tc.color, 0.8)
        .setOrigin(0.5).setDepth(24).setStrokeStyle(1, 0x000000, 0.8);
      badge = scene.add.text(bx, by-22, tc.icon, {
        fontFamily: 'monospace', fontSize: '11px',
        stroke: '#000', strokeThickness: 2
      }).setOrigin(0.5).setDepth(25);
      window.memberBadges[m.id] = badge;
      window.memberBadgeBgs[m.id] = badgeBg;
    }

    window.memberSprites[m.id] = sprite;
    window.memberStates[m.id] = 'idle';
    window.memberTargets[m.id] = { x: bx, y: by };

    // Name label below character
    const label = scene.add.text(bx, by + 18, m.label, {
      fontFamily: 'monospace', fontSize: '8px', fill: '#fff',
      stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(21);
    window.memberLabels[m.id] = label;
    spriteData[m.id] = { badge, label };
  });
  window.starSprite = star;
}

function placePlaque(scene) {
  const p = LAYOUT.plaque;
  const bg = scene.add.rectangle(p.x, p.y, p.width, p.height, 0x5d4037, 0.92).setDepth(30);
  bg.setStrokeStyle(2, 0x3e2723);
  scene.add.text(p.x, p.y, 'Pixel Office', {
    fontFamily: 'monospace', fontSize: '15px', fill: '#ffd700',
    fontWeight: 'bold', stroke: '#000', strokeThickness: 2
  }).setOrigin(0.5).setDepth(31);
  scene.add.text(p.x-115, p.y, '⭐', {fontFamily:'monospace',fontSize:'14px'}).setOrigin(0.5).setDepth(31);
  scene.add.text(p.x+115, p.y, '⭐', {fontFamily:'monospace',fontSize:'14px'}).setOrigin(0.5).setDepth(31);
}

// ===================== INIT =====================
async function initGame() {
  try { supportsWebP = await checkWebPSupport(); } catch(e) { supportsWebP = false; }
  new Phaser.Game(config);
  setTimeout(connectHermes, 1000);
}

// ===================== PRELOAD =====================
function preload() {
  lpOverlay = document.getElementById('loading-overlay');
  lpBar = document.getElementById('loading-progress-bar');
  lpText = document.getElementById('loading-text');
  totalAssets = LAYOUT.totalAssets || 10;
  loadedAssets = 0;

  const pulseStyle = document.createElement('style');
  pulseStyle.textContent = '@keyframes loadingPulse {' +
    '0%,100%{box-shadow:0 0 5px #ffd700,0 0 10px #ffd700}' +
    '50%{box-shadow:0 0 15px #ffd700,0 0 30px #ff8c00}}' +
    '#loading-progress-bar{transition:width 0.3s ease;animation:loadingPulse 1.5s ease-in-out infinite}';
  document.head.appendChild(pulseStyle);
  this.load.on('filecomplete', updateLoadingProgress);
  this.load.on('complete', hideLoadingOverlay);

  // Background image (the whole room — pre-drawn)
  this.load.image('office_bg', '/office_bg.webp');

  // Character sprites
  this.load.image('star_idle_static', '/star-idle-v5.png');
  this.load.spritesheet('coffee_machine', '/coffee-machine-v3-grid.webp', { frameWidth: 230, frameHeight: 230 });

  for (let i = 1; i <= 6; i++) {
    this.load.spritesheet('guest_anim_'+i, '/guest_anim_'+i+'.webp', { frameWidth: 32, frameHeight: 32 });
  }
}

// ===================== CREATE =====================
function create() {
  game = this;
  areas = LAYOUT.areas;

  // 1. Background image (the whole room)
  this.add.image(640, 360, 'office_bg');

  // 2. Coffee machine animation overlay
  if (!this.anims.exists('cf_machine')) {
    this.anims.create({
      key: 'cf_machine',
      frames: this.anims.generateFrameNumbers('coffee_machine', { start: 0, end: 95 }),
      frameRate: 12,
      repeat: -1
    });
  }
  const cm = this.add.sprite(
    LAYOUT.furniture.coffeeMachine.x,
    LAYOUT.furniture.coffeeMachine.y,
    'coffee_machine', 0
  ).setOrigin(0.5).setDepth(10).setScale(LAYOUT.furniture.coffeeMachine.scale);
  if (this.anims.exists('cf_machine')) cm.play('cf_machine', true);

// 3. Guest character animations
  for (let i = 1; i <= 6; i++) {
    if (!this.anims.exists('g_idle_'+i)) {
      this.anims.create({
        key: 'g_idle_'+i,
        frames: this.anims.generateFrameNumbers('guest_anim_'+i, { start: 0, end: 5 }),
        frameRate: 6,
        repeat: -1
      });
    }
  }

  // 5. Characters + plaque
  placeCharacters(this);
  placePlaque(this);

  // 6. Camera
  mainCamera = this.cameras.main;
  mainCamera.setBounds(0, 0, 1280, 720);

  // 7. Remote data
  loadMemo();
  fetchStatus();
  loadDepartments();
  renderMemberStatus();

  game.input.on('pointerdown', () => {
    const now = Date.now();
    if (now - lastClickFetch < 300) return;
    lastClickFetch = now;
    fetchStatus();
    fetchDepartments();
  });
}

let lastStatusRender = 0;

// ===================== UPDATE =====================
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

  // Move guest agents toward their targets
  if (window.memberSprites) {
    MEMBERS.forEach(m => {
      if (m.id === 'hermes') return;
      const sp = window.memberSprites[m.id];
      const t = window.memberTargets[m.id];
      if (!sp || !t) return;
      const dx = t.x - sp.x, dy = t.y - sp.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 3) { sp.x += (dx/dist) * 1.4; sp.y += (dy/dist) * 1.4; }
      // Animate badge bobbing
      const badge = window.memberBadges[m.id];
      if (badge) {
        badge.setPosition(sp.x, sp.y - 22);
        badge.setY(sp.y - 22 + Math.sin(time/300 + parseFloat('0.'+m.id.charCodeAt(0)))*1.5);
      }
      const badgeBg = window.memberBadgeBgs && window.memberBadgeBgs[m.id];
      if (badgeBg) {
        badgeBg.setPosition(sp.x, sp.y - 22);
        badgeBg.setY(sp.y - 22 + Math.sin(time/300 + parseFloat('0.'+m.id.charCodeAt(0)))*1.5);
      }
      const lbl = window.memberLabels[m.id];
      if (lbl) lbl.setPosition(sp.x, sp.y + 18);
    });
  }
  if (star) moveStar(time);
}

// ===================== STATE MANAGEMENT =====================
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
      targetX = (areas[si.area] || areas.lounge).x;
      targetY = (areas[si.area] || areas.lounge).y;
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
      if (areas[ta]) {
        window.memberTargets[mm.id] = { x: areas[ta].x + mm.offset.x, y: areas[ta].y + mm.offset.y };
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

// ===================== MEMBER STATUS PANEL =====================
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
  for (const [n, p] of Object.entries(areas)) {
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
let currentDepartmentView = null;

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
    renderDepartmentSidebar();
  } catch(e) { console.error(e); }
}
async function fetchDepartments() { await loadDepartments(); }

const DEPT_ICONS = {
  '遊戲開發部':'🎮', '投資研究部':'📊', '任務執行部':'🎯',
  '稽核日誌部':'📋', '系統狀態':'⚙️', 'default':'📁'
};

function renderDepartmentSidebar() {
  // Kept from original for compatibility
}

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
function connectHermes() {
  // WebSocket connection stub — kept for future integration
}

// ===== BOOTSTRAP =====
initGame();