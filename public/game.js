// Pixel Office v2 — 完全重構
// 茶水間(0-400) | 辦公室(400-2050) | 經理室(2050-2560)

let supportsWebP = false;
function checkWebPSupport() {
  return new Promise(r => {
    const c = document.createElement('canvas');
    if (c.getContext && c.getContext('2d')) r(c.toDataURL('image/webp').indexOf('data:image/webp') === 0);
    else r(false);
  });
}
function getExt(f) {
  if (f === 'star-working-spritesheet.png') return '.png';
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
  writing: { name:'整理文檔', area:'desk_small_3' },
  researching: { name:'搜尋資訊', area:'desk_small_1' },
  executing: { name:'執行任務', area:'desk_small_4' },
  syncing: { name:'同步備份', area:'serverroom' },
  error: { name:'出錯了', area:'desk_big_right' }
};
const BTEXTS = {
  idle:['待命中','喝杯咖啡','放個風','找靈感'],
  writing:['進入專注模式','跑關鍵路徑','關 bug 進籠子'],
  researching:['挖證據鏈','定位問題','找關鍵'],
  executing:['執行中','跑 pipeline','看結果'],
  syncing:['同步到雲端','備份中','多一份安心'],
  error:['別慌','找到 bug','錯誤是線索'],
  cat:['喵~','咕嚕…','吉祥物在此']
};

const MEMBERS = [
  { id:'hermes',   label:'Hermes',     role:'🏢 經理',   area:'manager_desk',  offset:{x:0,y:10},  spriteIdx:0 },
  { id:'codex',    label:'Codex',      role:'📐 架構',   area:'desk_big_left', offset:{x:-10,y:-5} },
  { id:'openclaw', label:'OpenClaw',   role:'🧪 測試',   area:'desk_big_right',offset:{x:10,y:-5} },
  { id:'gemini',   label:'Gemini',     role:'🔍 研究',   area:'desk_small_1',  offset:{x:-5,y:-5} },
  { id:'manus',    label:'Manus',      role:'🎨 UI/UX',  area:'desk_small_2',  offset:{x:5,y:-5} },
  { id:'claude',   label:'Claude Code',role:'💻 開發',   area:'desk_small_3',  offset:{x:-5,y:5} },
  { id:'opencode', label:'OpenCode',   role:'🔧 優化',   area:'desk_small_4',  offset:{x:5,y:5} }
];

let game, star, areas={}, currentState='idle', pendingState=null, statusText;
let lastFetch=0, lastBubble=0, lastCatBubble=0, targetX=1225, targetY=340;
let bubble=null, ttText='', ttTarget='', ttIdx=0, lastTT=0, catSprite=null;
const FETCH_INT=3000, BUBBLE_INT=8000, CAT_INT=18000, TT_DELAY=50;
let mainCamera;

// Draw checkered floor
function drawFloor(g, rx, rw, rh, c1, c2, fy) {
  fy = fy || 400;
  const ts = 16;
  for (let y=fy; y<rh; y+=ts) {
    for (let x=rx; x<rx+rw; x+=ts) {
      g.fillStyle(((x-rx)/ts+(y-fy)/ts)%2===0 ? c1 : c2, 1);
      g.fillRect(x, y, ts, ts);
    }
  }
}

// ===== ROOM 1: 茶水間 =====
function drawPantry(scene) {
  const g = scene.add.graphics();
  g.fillStyle(0x3e2723,1); g.fillRect(0,0,400,720);
  drawFloor(g,0,400,720,0x8d6e63,0xa1887f,400);
  g.fillStyle(0x5d4037,1); g.fillRect(0,390,400,10);

  // Window
  g.fillStyle(0x1a237e,0.5); g.fillRect(60,50,80,100);
  g.lineStyle(2,0x5d4037,1); g.strokeRect(60,50,80,100);
  g.strokeRect(60,100,80,1); g.strokeRect(100,50,1,100);

  // Shelf
  g.fillStyle(0x5d4037,1); g.fillRect(10,120,20,100);
  for (let i=0;i<4;i++) { g.fillStyle(0x6d4c41,1); g.fillRect(10,130+i*25,20,3); }

  // Label
  scene.add.text(200,10,'☕ 茶水間',{fontFamily:'monospace',fontSize:'12px',fill:'#ffd700',stroke:'#000',strokeThickness:2}).setOrigin(0.5).setDepth(10);
  return g;
}

// ===== ROOM 2: 辦公室 =====
function drawOffice(scene) {
  // Walls
  const g = scene.add.graphics();
  g.fillStyle(0x2c1810,1); g.fillRect(400,0,5,720);
  g.fillStyle(0x1a2332,1); g.fillRect(2045,0,5,720);
  g.setDepth(0);

  // Background image
  scene.add.image(1225, 360, 'office_bg').setDepth(0);

  // Large desk labels
  scene.add.text(800, 300, '📐 Codex 架構', {fontFamily:'monospace',fontSize:'10px',fill:'#90caf9',stroke:'#000',strokeThickness:2}).setOrigin(0.5).setDepth(200);
  scene.add.text(1200, 300, '🧪 OpenClaw 測試', {fontFamily:'monospace',fontSize:'10px',fill:'#ef9a9a',stroke:'#000',strokeThickness:2}).setOrigin(0.5).setDepth(200);

  // Desk labels
  scene.add.text(600, 175, '🔍 Gemini', {fontFamily:'monospace',fontSize:'9px',fill:'#ce93d8',stroke:'#000',strokeThickness:2}).setOrigin(0.5).setDepth(100);
  scene.add.text(1400, 175, '🎨 Manus', {fontFamily:'monospace',fontSize:'9px',fill:'#ffab91',stroke:'#000',strokeThickness:2}).setOrigin(0.5).setDepth(100);
  scene.add.text(600, 455, '💻 Claude Code', {fontFamily:'monospace',fontSize:'9px',fill:'#a5d6a7',stroke:'#000',strokeThickness:2}).setOrigin(0.5).setDepth(100);
  scene.add.text(1400, 455, '🔧 OpenCode', {fontFamily:'monospace',fontSize:'9px',fill:'#ffe082',stroke:'#000',strokeThickness:2}).setOrigin(0.5).setDepth(100);

  // Room label
  scene.add.text(1225, 8, '🏢 辦公室', {fontFamily:'monospace',fontSize:'14px',fill:'#ffd700',stroke:'#000',strokeThickness:2}).setOrigin(0.5).setDepth(10);

  return g;
}

// ===== ROOM 3: 經理室 =====
function drawManagerRoom(scene) {
  const g = scene.add.graphics();
  g.fillStyle(0x1a0a2e,1); g.fillRect(2050,0,510,720);
  drawFloor(g,2050,510,720,0x4a0072,0x6a1b9a,400);
  g.fillStyle(0x311b92,1); g.fillRect(2050,390,510,10);

  // Window with view
  g.fillStyle(0x0d47a1,0.4); g.fillRect(2110,60,80,120);
  g.lineStyle(2,0x5d4037,1); g.strokeRect(2110,60,80,120);
  g.strokeRect(2110,120,80,1); g.strokeRect(2150,60,1,120);
  // Stars visible through window
  for (let i=0;i<5;i++) { g.fillStyle(0xffffff,0.3+Math.random()*0.3); g.fillRect(2120+Math.random()*60,70+Math.random()*100,3,3); }

  // Bookshelf
  g.fillStyle(0x4e342e,1); g.fillRect(2480,100,40,120);
  for (let i=0;i<5;i++) { g.fillStyle(0x6d4c41,1); g.fillRect(2482,110+i*22,36,4); g.fillStyle(Math.random()>0.5?0xc62828:0x1565c0,1); g.fillRect(2484,112+i*22,6,2); }

  // Decorative star on wall
  g.fillStyle(0xffd700,0.7); g.fillRect(2250,80,20,20);

  // Label
  scene.add.text(2300,10,'⭐ 經理室',{fontFamily:'monospace',fontSize:'12px',fill:'#ffd700',stroke:'#000',strokeThickness:3}).setOrigin(0.5).setDepth(10);
  return g;
}

// ===== Room dividers =====
function drawDividers(scene) {
  const g = scene.add.graphics();
  // Pantry → Office wall
  g.fillStyle(0x4e342e,1); g.fillRect(398,0,4,720);
  g.fillStyle(0x3e2723,1); g.fillRect(398,290,4,100); // door
  g.fillStyle(0x8d6e63,1); g.fillRect(370,340,60,6); g.fillRect(370,348,60,6); // door mat
  scene.add.text(365,355,'→ 辦公室',{fontFamily:'monospace',fontSize:'8px',fill:'#ffe0b2',stroke:'#000',strokeThickness:1}).setOrigin(0.5).setDepth(3);

  // Office → Manager wall
  g.fillStyle(0x311b92,1); g.fillRect(2048,0,4,720);
  g.fillStyle(0x1a0a2e,1); g.fillRect(2048,290,4,100); // door
  g.fillStyle(0x5d4037,1); g.fillRect(2020,340,60,6); g.fillRect(2020,348,60,6);
  scene.add.text(2040,355,'→ 經理室',{fontFamily:'monospace',fontSize:'8px',fill:'#e1bee7',stroke:'#000',strokeThickness:1}).setOrigin(0.5).setDepth(3);
  g.setDepth(1);
  return g;
}

// ===== Furniture drawing =====
function drawFurniture(scene) {
  const f = LAYOUT.furniture;
  function rect(x,y,w,h,c,d,a) { return scene.add.rectangle(x,y,w,h,c,a||1).setDepth(d||10); }
  function tri(x,y,w,h,c,d) { const g=scene.add.graphics(); g.fillStyle(c,1); g.fillTriangle(x,y,x-w/2,y+h,x+w/2,y+h); g.setDepth(d||10); return g; }
  
  // Pantry
  rect(f.counter.x,f.counter.y,f.counter.w,f.counter.h,f.counter.color,f.counter.depth);
  rect(f.sink.x,f.sink.y,f.sink.w,f.sink.h,f.sink.color,f.sink.depth);
  rect(f.fridge.x,f.fridge.y,f.fridge.w,f.fridge.h,f.fridge.color,f.fridge.depth);
  rect(f.fridge.x,f.fridge.y-3,20,4,0xeeeeee,f.fridge.depth+1);
  rect(f.pantryTable.x,f.pantryTable.y,f.pantryTable.w,f.pantryTable.h,f.pantryTable.color,f.pantryTable.depth);
  rect(f.pantryTable.x,f.pantryTable.y-8,f.pantryTable.w+6,4,0x4e342e,f.pantryTable.depth+1);
  rect(f.pantrySofa.x,f.pantrySofa.y,f.pantrySofa.w,f.pantrySofa.h,f.pantrySofa.color,f.pantrySofa.depth);
  rect(f.pantrySofa.x-45,f.pantrySofa.y-5,8,12,0x6d4c41,f.pantrySofa.depth+1);
  rect(f.pantryLamp.x,f.pantryLamp.y,f.pantryLamp.w,f.pantryLamp.h,f.pantryLamp.color,f.pantryLamp.depth);
  rect(f.pantryLamp.x-8,f.pantryLamp.y-15,22,5,0xffd54f,f.pantryLamp.depth+1,0.5);

  // Office - Big Desks
  const bdl = f.bigDeskLeft, bdr = f.bigDeskRight;
  rect(bdl.x,bdl.y,bdl.w,bdl.h,bdl.color,bdl.depth);
  rect(bdl.x,bdl.y-12,bdl.w+8,6,bdl.accent,bdl.depth+1);
  rect(bdl.x-30,bdl.y-18,20,12,0x212121,bdl.depth+1); // monitor
  rect(bdr.x,bdr.y,bdr.w,bdr.h,bdr.color,bdr.depth);
  rect(bdr.x,bdr.y-12,bdr.w+8,6,bdr.accent,bdr.depth+1);
  rect(bdr.x+30,bdr.y-18,20,12,0x212121,bdr.depth+1);

  // Office - Small desks
  const desks = [f.smallDeskTL,f.smallDeskTR,f.smallDeskBL,f.smallDeskBR];
  desks.forEach(d => { rect(d.x,d.y,d.w,d.h,d.color,d.depth); rect(d.x,d.y-8,d.w+4,4,0x121212,d.depth+1); });

  // Server rack
  rect(f.serverRack.x,f.serverRack.y,f.serverRack.w,f.serverRack.h,f.serverRack.color,f.serverRack.depth);
  for (let i=0;i<3;i++) { rect(f.serverRack.x,f.serverRack.y-35+i*25,40,4,0x455a64,f.serverRack.depth+1); }

  // Coffee machine
  const cm = scene.add.sprite(f.coffeeMachine.x,f.coffeeMachine.y,'coffee_machine').setOrigin(0.5).setDepth(99);
  cm.setScale(f.coffeeMachine.scale);
  if (scene.anims.exists('cf_machine')) cm.anims.play('cf_machine',true);

  // Sofa
  rect(f.officeSofa.x,f.officeSofa.y,f.officeSofa.w,f.officeSofa.h,f.officeSofa.color,f.officeSofa.depth);

  // Manager room furniture
  rect(f.managerDesk.x,f.managerDesk.y,f.managerDesk.w,f.managerDesk.h,f.managerDesk.color,f.managerDesk.depth);
  rect(f.managerDesk.x,f.managerDesk.y-10,f.managerDesk.w+6,5,0x795548,f.managerDesk.depth+1);
  rect(f.managerChair.x,f.managerChair.y,f.managerChair.w,f.managerChair.h,f.managerChair.color,f.managerChair.depth);
  rect(f.managerBookshelf.x,f.managerBookshelf.y,f.managerBookshelf.w,f.managerBookshelf.h,f.managerBookshelf.color,f.managerBookshelf.depth);
  rect(f.managerWindow.x,f.managerWindow.y,f.managerWindow.w,f.managerWindow.h,f.managerWindow.color,f.managerWindow.depth);
  rect(f.managerWindow.x,f.managerWindow.y-6,f.managerWindow.w+8,4,0x5d4037,f.managerWindow.depth+1);
  rect(f.managerLamp.x,f.managerLamp.y,f.managerLamp.w,f.managerLamp.h,f.managerLamp.color,f.managerLamp.depth);
  rect(f.managerLamp.x-7,f.managerLamp.y-12,22,4,f.managerLamp.color,f.managerLamp.depth+1,0.4);

  // Plants
  const plants = [f.officePlant1,f.officePlant2];
  plants.forEach((p,i) => {
    if (scene.textures.exists('plants')) {
      const pl = scene.add.sprite(p.x,p.y,'plants',Math.floor(Math.random()*16)).setOrigin(0.5).setDepth(p.depth);
      pl.setScale(0.4);
    }
  });

  // Cat
  if (scene.textures.exists('cats')) {
    catSprite = scene.add.sprite(f.officeCat.x,f.officeCat.y,'cats',Math.floor(Math.random()*16)).setOrigin(0.5).setDepth(2000);
    catSprite.setScale(0.4);
    catSprite.setInteractive({useHandCursor:true});
    catSprite.on('pointerdown',()=>{catSprite.setFrame(Math.floor(Math.random()*16));});
    window.catSprite = catSprite;
  }
}

// ===== Character drawing =====
// Use guest sprites with tool-colored badges
function drawCharacters(scene) {
  window.memberSprites = {};
  window.memberLabels = {};
  window.memberStates = {};
  window.memberTargets = {};

  MEMBERS.forEach((m, idx) => {
    const area = areas[m.area] || areas.lounge;
    let sprite;
    
    if (m.id === 'hermes') {
      // Hermes uses the star sprite
      sprite = scene.add.image(area.x+m.offset.x, area.y+m.offset.y, 'star_idle_static').setOrigin(0.5);
      sprite.setScale(0.4);
      sprite.setDepth(20);
      star = sprite;
    } else {
      // Guest sprites (1-indexed)
      const si = m.spriteIdx || (idx % 6) + 1;
      if (scene.textures.exists('guest_anim_'+si)) {
        sprite = scene.add.sprite(area.x+m.offset.x, area.y+m.offset.y, 'guest_anim_'+si, 0).setOrigin(0.5);
        sprite.setScale(1.2);
        sprite.setDepth(20);
        if (scene.anims.exists('g_idle_'+si)) sprite.anims.play('g_idle_'+si, true);
      } else {
        sprite = scene.add.rectangle(area.x+m.offset.x, area.y+m.offset.y, 12, 20, 0x888888).setOrigin(0.5).setDepth(20);
      }
    }

    window.memberSprites[m.id] = sprite;
    window.memberStates[m.id] = 'idle';
    window.memberTargets[m.id] = { x: area.x+m.offset.x, y: area.y+m.offset.y };

    // Role badge (small text above character)
    const tc = LAYOUT.toolColors[m.id] || { color: '#ccc', icon: '👤' };
    const badge = scene.add.text(
      area.x+m.offset.x, area.y+m.offset.y - 18,
      tc.icon,
      { fontFamily: 'monospace', fontSize: '10px', stroke: '#000', strokeThickness: 2 }
    ).setOrigin(0.5).setDepth(25);
    window['badge_'+m.id] = badge;

    // Name label
    const label = scene.add.text(
      area.x+m.offset.x, area.y+m.offset.y + 16,
      m.label,
      { fontFamily: 'monospace', fontSize: '8px', fill: '#fff', stroke: '#000', strokeThickness: 2 }
    ).setOrigin(0.5).setDepth(21);
    window.memberLabels[m.id] = label;
  });

  window.starSprite = star;
}

// ===== Plaque =====
function drawPlaque(scene) {
  const px = LAYOUT.plaque.x, py = LAYOUT.plaque.y;
  const bg = scene.add.rectangle(px, py, LAYOUT.plaque.width, LAYOUT.plaque.height, 0x5d4037).setDepth(30);
  bg.setStrokeStyle(3, 0x3e2723);
  scene.add.text(px, py, 'Pixel Office', {
    fontFamily: 'monospace', fontSize: '16px', fill: '#ffd700',
    fontWeight: 'bold', stroke: '#000', strokeThickness: 2
  }).setOrigin(0.5).setDepth(31);
  scene.add.text(px-140, py, '⭐', {fontFamily:'monospace',fontSize:'16px'}).setOrigin(0.5).setDepth(31);
  scene.add.text(px+140, py, '⭐', {fontFamily:'monospace',fontSize:'16px'}).setOrigin(0.5).setDepth(31);
}

async function initGame() {
  try { supportsWebP = await checkWebPSupport(); } catch(e) { supportsWebP = false; }
  new Phaser.Game(config);
  setTimeout(connectHermes, 1000);
}

function preload() {
  lpOverlay = document.getElementById('loading-overlay');
  lpBar = document.getElementById('loading-progress-bar');
  lpText = document.getElementById('loading-text');
  totalAssets = LAYOUT.totalAssets || 15;
  loadedAssets = 0;
  this.load.on('filecomplete', updateLoadingProgress);
  this.load.on('complete', hideLoadingOverlay);

  this.load.image('office_bg', '/office_bg.webp');
  this.load.image('star_idle_static', '/star-idle-v5.png');
  this.load.spritesheet('coffee_machine', '/coffee-machine-v3-grid.webp', {frameWidth:230,frameHeight:230});
  this.load.spritesheet('plants', '/plants-spritesheet.webp', {frameWidth:160,frameHeight:160});
  this.load.spritesheet('cats', '/cats-spritesheet.webp', {frameWidth:160,frameHeight:160});
  for (let i=1;i<=6;i++) this.load.spritesheet('guest_anim_'+i, '/guest_anim_'+i+'.webp', {frameWidth:32,frameHeight:32});
}

function create() {
  game = this;
  areas = LAYOUT.areas;

  // Draw rooms
  drawPantry(this);
  drawOffice(this);
  drawManagerRoom(this);
  drawDividers(this);

  // Animations
  if (!this.anims.exists('cf_machine')) {
    this.anims.create({key:'cf_machine',frames:this.anims.generateFrameNumbers('coffee_machine',{start:0,end:95}),frameRate:12,repeat:-1});
  }
  for (let i=1;i<=6;i++) {
    if (!this.anims.exists('g_idle_'+i)) {
      this.anims.create({key:'g_idle_'+i,frames:this.anims.generateFrameNumbers('guest_anim_'+i,{start:0,end:5}),frameRate:6,repeat:-1});
    }
  }

  // Furniture
  drawFurniture(this);

  // Characters
  drawCharacters(this);

  // Plaque
  drawPlaque(this);

  // Status text
  statusText = document.getElementById('status-text');

  // Camera
  mainCamera = this.cameras.main;
  mainCamera.setBounds(0, 0, LAYOUT.game.width, LAYOUT.game.height);
  if (star) mainCamera.startFollow(star, false, LAYOUT.camera.lerp, LAYOUT.camera.lerp);

  // Load data
  loadMemo();
  fetchStatus();
  loadDepartments();
  renderMemberStatus();

  game.input.on('pointerdown', () => { fetchStatus(); fetchDepartments(); });
}

function update(time) {
  if (time-lastFetch>FETCH_INT) { fetchStatus(); lastFetch=time; }
  if (time%2000<50) renderMemberStatus();

  if (time-lastBubble>BUBBLE_INT) { showBubble(); lastBubble=time; }
  if (time-lastCatBubble>CAT_INT) { showCatBubble(); lastCatBubble=time; }

  if (ttIdx<ttTarget.length && time-lastTT>TT_DELAY) {
    ttText += ttTarget[ttIdx];
    if (statusText) statusText.textContent = ttText;
    ttIdx++;
    lastTT=time;
  }

  // Move members
  if (window.memberSprites) {
    MEMBERS.forEach(m => {
      if (m.id==='hermes') return;
      const sp = window.memberSprites[m.id];
      const t = window.memberTargets[m.id];
      if (!sp||!t) return;
      const dx=t.x-sp.x, dy=t.y-sp.y;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if (dist>3) {
        const speed=1.4;
        sp.x+=(dx/dist)*speed; sp.y+=(dy/dist)*speed;
      }
      // Update badge and label
      const badge = window['badge_'+m.id];
      if (badge) badge.setPosition(sp.x, sp.y-18);
      const lbl = window.memberLabels[m.id];
      if (lbl) lbl.setPosition(sp.x, sp.y+16);
    });
  }

  if (star) moveStar(time);
}

function normalizeState(s) {
  if (!s) return 'idle';
  if (s==='working') return 'writing';
  if (s==='run'||s==='running') return 'executing';
  if (s==='sync') return 'syncing';
  if (s==='research') return 'researching';
  return s;
}

function fetchStatus() {
  const token = localStorage.getItem('token');
  if (!token) return;
  fetch('/api/workers?t='+Date.now(), {
    headers: {'Authorization':'Bearer '+token}, cache:'no-store'
  }).then(r=>r.json()).then(data => {
    if (!Array.isArray(data)||!data.length) return;
    const hw = data.find(w=>(w.name||'').toLowerCase()==='hermes')||data[0];
    const ns = normalizeState(hw.status||'idle');
    const si = STATES[ns]||STATES.idle;
    const changed = (pendingState===null)&&(ns!==currentState);
    const det = hw.task_name||hw.task_message||'...';
    const nl = '['+si.name+'] '+det;
    if (changed) {
      ttTarget=nl; ttText=''; ttIdx=0; pendingState=null; currentState=ns;
      if (star) star.setVisible(ns==='idle');
      targetX = (areas[si.area]||areas.lounge).x;
      targetY = (areas[si.area]||areas.lounge).y;
    } else if (ttTarget!==nl) {
      ttTarget=nl; ttText=''; ttIdx=0;
    }
    // Update members
    data.forEach(w => {
      const wn = (w.name||'').toLowerCase();
      let mm=null, bs=0;
      MEMBERS.forEach(m=>{
        let sc=0;
        if (wn===m.id) sc=3; else if (wn.includes(m.id)) sc=2; else if (m.id.includes(wn)) sc=1;
        if (sc>bs){bs=sc;mm=m;}
      });
      if (!mm) return;
      const ws = normalizeState(w.status||'idle');
      window.memberStates[mm.id]=ws;
      let ta = (STATES[ws]||STATES.idle).area;
      if (mm.id==='hermes') ta='manager_desk';
      if (areas[ta]) window.memberTargets[mm.id]={x:areas[ta].x+mm.offset.x,y:areas[ta].y+mm.offset.y};
    });
    renderMemberStatus();
  }).catch(()=>{ttTarget='連線失敗';ttText='';ttIdx=0;});
}

function moveStar(time) {
  const es = pendingState||currentState;
  const si = STATES[es]||STATES.idle;
  const dx=targetX-star.x, dy=targetY-star.y;
  const dist=Math.sqrt(dx*dx+dy*dy);
  if (dist>3) {
    star.x+=(dx/dist)*1.6; star.y+=(dy/dist)*1.6;
    star.setY(star.y+Math.sin(time/200)*0.6);
  }
}

function showBubble() {
  if (bubble) { bubble.destroy(); bubble=null; }
  const texts = BTEXTS[currentState]||BTEXTS.idle;
  const anchorX = star?star.x:1225, anchorY=star?star.y-50:300;
  const text = texts[Math.floor(Math.random()*texts.length)];
  const by = anchorY-40;
  const bg = game.add.rectangle(anchorX,by,text.length*8+16,22,0xffffff,0.95).setStrokeStyle(2,0x000);
  const txt = game.add.text(anchorX,by,text,{fontFamily:'monospace',fontSize:'10px',fill:'#000'}).setOrigin(0.5);
  bubble = game.add.container(0,0,[bg,txt]).setDepth(1200);
  setTimeout(()=>{if(bubble){bubble.destroy();bubble=null;}},3000);
}

function showCatBubble() {
  if (!window.catSprite) return;
  if (window.catBubble) { window.catBubble.destroy(); window.catBubble=null; }
  const texts = BTEXTS.cat||['喵~'];
  const text = texts[Math.floor(Math.random()*texts.length)];
  const ax=window.catSprite.x, ay=window.catSprite.y-40;
  const bg = game.add.rectangle(ax,ay,text.length*8+16,20,0xfffbeb,0.95).setStrokeStyle(2,0xd4a574);
  const txt = game.add.text(ax,ay,text,{fontFamily:'monospace',fontSize:'9px',fill:'#8b6914'}).setOrigin(0.5);
  window.catBubble = game.add.container(0,0,[bg,txt]).setDepth(2100);
  setTimeout(()=>{if(window.catBubble){window.catBubble.destroy();window.catBubble=null;}},3000);
}

// ===== MEMBER STATUS PANEL =====
const MEMBER_ICONS = {
  hermes:'⭐',gemini:'🔮',manus:'✍️',codex:'📘',claude:'🟢',opencode:'🔧',openclaw:'🦞'
};
function getStatusColor(mid) {
  const s=window.memberStates?.[mid]||'idle';
  switch(s){case'error':return'#e74c3c';case'writing':case'researching':case'executing':return'#f1c40f';case'syncing':return'#3498db';default:return'#2ecc71';}
}
function getAreaLabel(target) {
  if (!target) return '⋯';
  const labels = {lounge:'☕ 茶水間',pantry_table:'🍴 茶水間',desk_big_left:'📐 大桌',desk_big_right:'🧪 大桌',
    desk_small_1:'🔍 小桌',desk_small_2:'🎨 小桌',desk_small_3:'💻 小桌',desk_small_4:'🔧 小桌',
    serverroom:'🖥️ 伺服器',breakroom:'🏢 辦公室',manager_desk:'⭐ 經理室'};
  for (const [n,p] of Object.entries(areas)) {
    if (Math.abs(p.x-target.x)<40&&Math.abs(p.y-target.y)<40) return labels[n]||n;
  }
  return '🚶 移動中';
}
function renderMemberStatus() {
  const list = document.getElementById('member-status-list');
  if (!list) return;
  let html='';
  MEMBERS.forEach(m=>{
    const s=window.memberStates?.[m.id]||'idle';
    const c=getStatusColor(m.id);
    const icon=MEMBER_ICONS[m.id]||'👤';
    const target=window.memberTargets?.[m.id];
    const area=getAreaLabel(target);
    html+=`<div class="member-status-row"><span class="member-status-dot" style="background:${c}"></span><span class="member-status-name">${icon} ${m.label}</span><span class="member-status-area">${area}</span></div>`;
  });
  list.innerHTML=html;
}

// ===== SIDEBAR =====
let departments=[];
let currentDepartmentView=null;
async function loadDepartments() {
  const tk=localStorage.getItem('token');
  if(!tk)return;
  try{const r=await fetch('/api/departments?t='+Date.now(),{headers:{'Authorization':'Bearer '+tk},cache:'no-store'});
  if(!r.ok)return;departments=Array.isArray(await r.json())?await r.json():[];renderDepartmentSidebar();
  }catch(e){console.error(e);}
}
async function fetchDepartments(){await loadDepartments();}
const DEPT_ICONS={'遊戲開發部':'🎮','投資研究部':'📊','任務執行部':'🎯','稽核日誌部':'📋','系統狀態':'⚙️'};
function renderDepartmentSidebar(){
  const list=document.getElementById('department-list');
  if(!list)return;
  list.innerHTML='';
  if(!departments||!departments.length){list.innerHTML='<div style="color:#9ca3af;font-size:12px;padding:20px;text-align:center;">暫無部門</div>';return;}
  departments.forEach(d=>{
    const icon=DEPT_ICONS[d.name]||'📁';
    const item=document.createElement('div');
    item.className='dept-item'+(currentDepartmentView===d.id?' active':'');
    item.innerHTML=`<span class="dept-icon">${icon}</span><span class="dept-name">${d.name}</span><span class="dept-status ${d.status||'active'}">${d.status||'active'}</span>`;
    item.onclick=()=>openDepartmentView(d);
    list.appendChild(item);
  });
}
async function openDepartmentView(dept){
  currentDepartmentView=dept.id;renderDepartmentSidebar();
  const panel=document.getElementById('dept-detail-panel'),content=document.getElementById('dept-detail-content');
  if(!panel||!content)return;
  panel.style.display='block';content.innerHTML='<div style="color:#9ca3af;font-size:12px;text-align:center;padding:20px;">載入中...</div>';
  const tk=localStorage.getItem('token');
  try{
    const [tr,wr]=await Promise.all([
      fetch('/api/tasks?department_id='+dept.id+'&t='+Date.now(),{headers:{'Authorization':'Bearer '+tk},cache:'no-store'}),
      fetch('/api/workers?t='+Date.now(),{headers:{'Authorization':'Bearer '+tk},cache:'no-store'})
    ]);
    const dt=tr.ok?await tr.json():[],aw=wr.ok?await wr.json():[],dw=Array.isArray(aw)?aw.filter(w=>w.department_id===dept.id):[];
    const icon=DEPT_ICONS[dept.name]||'📁';
    let html=`<div class="dept-detail-header">${icon} ${dept.name}</div><div class="dept-detail-meta">狀態: ${dept.status||'active'} | ID: ${dept.id}</div>`;
    html+=`<div class="dept-detail-section-title">📋 任務 (${Array.isArray(dt)?dt.length:0})</div>`;
    if(Array.isArray(dt)&&dt.length) dt.slice(0,10).forEach(t=>{const sc=t.status==='completed'?'#2ecc71':t.status==='running'?'#f1c40f':'#e74c3c';html+=`<div class="dept-detail-item"><span style="color:${sc}">●</span><span>${t.title||t.name||'任務'}</span><span style="color:#9ca3af;font-size:10px;">${t.status||'pending'}</span></div>`;});
    else html+='<div style="color:#9ca3af;font-size:11px;padding:8px;">暫無任務</div>';
    html+=`<div class="dept-detail-section-title">👷 Worker (${dw.length})</div>`;
    if(dw.length) dw.slice(0,5).forEach(w=>{const sc=w.status==='online'?'#2ecc71':'#9ca3af';html+=`<div class="dept-detail-item"><span style="color:${sc}">●</span><span>${w.name||w.id||'Worker'}</span><span style="color:#9ca3af;font-size:10px;">${w.status||'offline'}</span></div>`;});
    else html+='<div style="color:#9ca3af;font-size:11px;padding:8px;">暫無 Worker</div>';
    content.innerHTML=html;
  }catch(e){content.innerHTML='<div style="color:#e74c3c;font-size:12px;">載入失敗</div>';}
}
function closeDepartmentView(){currentDepartmentView=null;document.getElementById('dept-detail-panel').style.display='none';renderDepartmentSidebar();}
function toggleSidebar(){
  const sb=document.getElementById('sidebar'),bd=document.getElementById('sidebar-backdrop');
  const isOpen=sb.classList.contains('open');
  sb.classList.toggle('open');if(bd)bd.classList.toggle('open');
  if(!isOpen)loadDepartments();
}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sidebar-backdrop').classList.remove('open');}

// ===== WS =====
let hermesWs=null,hermesConnected=false;
function connectHermes(){
  const tk=localStorage.getItem('token');if(!tk)return;
  const p=window.location.protocol==='https:'?'wss:':'ws:';
  const url=p+'//'+window.location.host+'/ws?token='+encodeURIComponent(tk);
  try{
    hermesWs=new WebSocket(url);
    hermesWs.onopen=()=>{hermesConnected=true;uH(true);};
    hermesWs.onclose=()=>{hermesConnected=false;uH(false);setTimeout(connectHermes,5000);};
    hermesWs.onerror=()=>{hermesConnected=false;uH(false);};
    hermesWs.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==='status_update'||m.type==='state_change'){fetchStatus();loadDepartments();}}catch(e){}};
  }catch(e){setTimeout(connectHermes,5000);}
}
function uH(c){const i=document.getElementById('hermes-indicator'),t=document.getElementById('hermes-text');if(i)i.style.background=c?'#2ecc71':'#e74c3c';if(t)t.textContent=c?'Hermes 已連線':'Hermes 離線';}

// ===== MEMO =====
async function loadMemo() {
  const md=document.getElementById('memo-date'),mc=document.getElementById('memo-content');
  try{
    const tk=localStorage.getItem('token');
    const r=await fetch('/api/messages?limit=5&t='+Date.now(),{headers:tk?{'Authorization':'Bearer '+tk}:{},cache:'no-store'});
    if(!r.ok){mc.innerHTML='<div id="memo-placeholder">暫無記錄</div>';return;}
    const d=await r.json();
    if(Array.isArray(d)&&d.length){const l=d[d.length-1];md.textContent=l.created_at||'';mc.innerHTML=(l.content||'暫無內容').replace(/\n/g,'<br>');}
    else mc.innerHTML='<div id="memo-placeholder">暫無昨日日記</div>';
  }catch(e){mc.innerHTML='<div id="memo-placeholder">載入失敗</div>';}
}

initGame();