// Star Office — Transform Pixel Office to Central Perk Style
// Single room scene (1280x720), no scrolling, Hermes star doesn't follow camera.
// Characters visible in one fixed view with cozy coffee shop theme.

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
  { id:'hermes',   label:'Hermes',     role:'🏢 經理',   area:'manager_desk',  offset:{x:0,y:10} },
  { id:'codex',    label:'Codex',      role:'📐 架構',   area:'desk_big_left', offset:{x:-10,y:-5} },
  { id:'openclaw', label:'OpenClaw',   role:'🧪 測試',   area:'desk_big_right',offset:{x:10,y:-5} },
  { id:'gemini',   label:'Gemini',     role:'🔍 研究',   area:'desk_small_1',  offset:{x:-5,y:-5} },
  { id:'manus',    label:'Manus',      role:'🎨 UI/UX',  area:'desk_small_2',  offset:{x:5,y:-5} },
  { id:'claude',   label:'Claude Code',role:'💻 開發',   area:'desk_small_3',  offset:{x:-5,y:5} },
  { id:'opencode', label:'OpenCode',   role:'🔧 優化',   area:'desk_small_4',  offset:{x:5,y:5} }
];

let game, star, areas={}, currentState='idle', pendingState=null;
let lastFetch=0, lastClickFetch=0, lastBubble=0, lastCatBubble=0, targetX=640, targetY=360;
let bubble=null, bubbleTimer=null, catBubbleTimer=null, ttText='', ttTarget='', ttIdx=0, lastTT=0, catSprite=null;
const FETCH_INT=3000, BUBBLE_INT=8000, CAT_INT=18000, TT_DELAY=50;
let mainCamera;

// Store character sprite data for badge tracking
const spriteData = {};

// ===================== DRAWING HELPERS =====================

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

function drawCozyRoomBackground(scene) {
  const g = scene.add.graphics();

  // Room dimensions:
  // Width: 1280px, Height: 720px

  // WALLS: Warm beige (exact color from specs)
  g.fillStyle(0xd4a574,1);
  g.fillRect(0, 0, 1280, 720);

  // CEILING TRIM: Dark brown
  g.fillStyle(0x5d4037, 1);
  g.fillRect(0, 0, 1280, 20);

  // BASEBOARD: Dark brown
  g.fillStyle(0x5d4037, 1);
  g.fillRect(0, 700, 1280, 20);

  return g;
}

// ===================== STAR OFFICE SINGLE ROOM =====================
function drawStarOfficeRoom(scene) {
  drawCozyRoomBackground(scene);

  // Draw checkered floor pattern (light/dark brown tiles)
  drawFloor(scene.add.graphics(), 0, 1280, 720, 0x956541, 0x6b3b20, 40);

  // Create central furniture grouping
  const centerX = 640;
  const centerY = 360;

  // ===================== FURNITURE =====================

  // ===== Office area (left-center) - desks for team members =====

  // Big desks (Codex and OpenClaw)
  // Codex desk (left side)
  scene.add.rectangle(300, 200, 200, 60, 0x4e3523, 1).setDepth(1).setStrokeStyle(1, 0x3e2a1c);

  // OpenClaw desk (right side)
  scene.add.rectangle(900, 200, 200, 60, 0x4e3523, 1).setDepth(1).setStrokeStyle(1, 0x3e2a1c);

  // Small desks (Gemini, Manus, Claude Code, OpenCode)
  // Gemini desk (top left)
  scene.add.rectangle(200, 450, 100, 40, 0x4e3523, 1).setDepth(1).setStrokeStyle(1, 0x3e2a1c);

  // Manus desk (bottom left)
  scene.add.rectangle(350, 450, 100, 40, 0x4e3523, 1).setDepth(1).setStrokeStyle(1, 0x3e2a1c);

  // Claude Code desk (top right)
  scene.add.rectangle(1050, 450, 100, 40, 0x4e3523, 1).setDepth(1).setStrokeStyle(1, 0x3e2a1c);

  // OpenCode desk (bottom right)
  scene.add.rectangle(1200, 450, 100, 40, 0x4e3523, 1).setDepth(1).setStrokeStyle(1, 0x3e2a1c);

  // ===== Manager area (center-right) - Hermes desk =====
  scene.add.rectangle(1000, 100, 200, 80, 0x4e3523, 1).setDepth(1).setStrokeStyle(1, 0x3e2a1c);

  // ===== Sofa area =====
  // Red sofa with cushions
  scene.add.rectangle(500, 600, 300, 80, 0xd32f2f, 0.9).setDepth(1).setStrokeStyle(1, 0x8b0000);

  // Couch cushions
  scene.add.rectangle(520, 580, 80, 20, 0xf44336, 0.9).setDepth(2);
  scene.add.rectangle(600, 580, 80, 20, 0xf44336, 0.9).setDepth(2);
  scene.add.rectangle(680, 580, 80, 20, 0xf44336, 0.9).setDepth(2);

  // ===== Bookshelf on the wall =====
  scene.add.rectangle(200, 50, 30, 100, 0x4e3523, 1).setDepth(1).setStrokeStyle(1, 0x3e2a1c);
  scene.add.rectangle(200, 50, 30, 100, 0x4e3523, 1).setDepth(1).setStrokeStyle(1, 0x3e2a1c);

  // Bookshelf books - using various colors
  for (let i = 0; i < 5; i++) {
    scene.add.rectangle(195, 55 + i * 20, 20, 10, Math.random() > 0.5 ? 0x1565c0 : 0xc62828, 1).setDepth(2);
  }

  // ===== Coffee machine =====
  const cm = scene.add.sprite(250, 300, 'coffee_machine', 0)
    .setOrigin(0.5).setDepth(5).setScale(0.5);
  if (scene.anims.exists('cf_machine')) cm.play('cf_machine', true);

  // ===== Lamp =====
  scene.add.rectangle(700, 100, 20, 60, 0x5d4037, 1).setDepth(2);
  scene.add.rectangle(690, 90, 40, 10, 0x5d4037, 1).setDepth(2);

  // ===== Plant =====
  if (scene.textures.exists('plants')) {
    const plant = scene.add.sprite(1040, 200, 'plants', Math.floor(Math.random() * Math.min(scene.textures.get('plants').frameTotal || 16, 16)))
      .setOrigin(0.5).setDepth(6).setScale(0.6);
  }

  // ===== Central Perk Posters =====
  scene.add.rectangle(700, 50, 200, 40, 0x6d4c41, 0.9).setDepth(1).setStrokeStyle(1, 0x4e342e);
  scene.add.text(800, 70, 'CENTRAL PERK', {
    fontFamily: 'monospace', fontSize: '12px',
    fill: '#ffd700', stroke: '#000', strokeThickness: 1
  }).setOrigin(0.5).setDepth(2);

  // ===== Cat sprite =====
  if (scene.textures.exists('cats')) {
    window.catSprite = scene.add.sprite(200, 600, 'cats', Math.floor(Math.random() * Math.min(scene.textures.get('cats').frameTotal || 16, 16)))
      .setOrigin(0.5).setDepth(10).setScale(0.5);
    window.catSprite.setInteractive({ useHandCursor: true });
    window.catSprite.on('pointerdown', () => {
      window.catSprite.setFrame(Math.floor(Math.random() * Math.min(scene.textures.get('cats').frameTotal || 16, 16)));
      showCatBubble(true);
    });
  }

  return scene.add.graphics().setDepth(0);
}

// ===================== FURNITURE =====================
function drawFurniture(scene) {
  const f = LAYOUT.furniture;
  function rect(x,y,w,h,c,d,a) { return scene.add.rectangle(x,y,w,h,c,a||1).setDepth(d||10); }

  // ===== Pantry furniture =====
  // Counter & sink
  rect(f.counter.x, f.counter.y, f.counter.w, f.counter.h, f.counter.color, f.counter.depth);
  rect(f.sink.x, f.sink.y, f.sink.w, f.sink.h, f.sink.color, f.sink.depth);
  rect(f.sink.x+2, f.sink.y-4, 8, 6, 0x90caf9, f.sink.depth+1, 0.4);
  // Counter shadow
  rect(f.counter.x-2, f.counter.y+f.counter.h, f.counter.w+4, 3, 0x000000, f.counter.depth-1, 0.2);

  // Fridge
  rect(f.fridge.x, f.fridge.y, f.fridge.w, f.fridge.h, f.fridge.color, f.fridge.depth);
  rect(f.fridge.x, f.fridge.y-3, 20, 4, 0xeeeeee, f.fridge.depth+1);
  // Fridge shadow
  rect(f.fridge.x-2, f.fridge.y+f.fridge.h, f.fridge.w+4, 3, 0x000000, f.fridge.depth-1, 0.2);
  // Fridge highlight
  rect(f.fridge.x+2, f.fridge.y+2, 4, 10, 0xffffff, f.fridge.depth+2, 0.15);

  // Pantry table
  rect(f.pantryTable.x, f.pantryTable.y, f.pantryTable.w, f.pantryTable.h, f.pantryTable.color, f.pantryTable.depth);
  rect(f.pantryTable.x, f.pantryTable.y-8, f.pantryTable.w+6, 4, 0x4e342e, f.pantryTable.depth+1);
  // Table shadow
  rect(f.pantryTable.x-2, f.pantryTable.y+f.pantryTable.h, f.pantryTable.w+4, 3, 0x000000, f.pantryTable.depth-1, 0.2);

  // Pantry sofa
  rect(f.pantrySofa.x, f.pantrySofa.y, f.pantrySofa.w, f.pantrySofa.h, f.pantrySofa.color, f.pantrySofa.depth);
  rect(f.pantrySofa.x-45, f.pantrySofa.y-5, 8, 12, 0x6d4c41, f.pantrySofa.depth+1);
  // Sofa shadow
  rect(f.pantrySofa.x-2, f.pantrySofa.y+f.pantrySofa.h, f.pantrySofa.w+4, 3, 0x000000, f.pantrySofa.depth-1, 0.2);

  // Pantry lamp
  rect(f.pantryLamp.x, f.pantryLamp.y, f.pantryLamp.w, f.pantryLamp.h, f.pantryLamp.color, f.pantryLamp.depth);
  rect(f.pantryLamp.x-8, f.pantryLamp.y-15, 22, 5, 0xffd54f, f.pantryLamp.depth+1, 0.5);

  // ===== Office furniture =====
  // Big desks
  const bdl = f.bigDeskLeft, bdr = f.bigDeskRight;
  rect(bdl.x, bdl.y, bdl.w, bdl.h, bdl.color, bdl.depth);
  rect(bdl.x, bdl.y-12, bdl.w+8, 6, bdl.accent, bdl.depth+1);
  rect(bdl.x-30, bdl.y-18, 20, 12, 0x212121, bdl.depth+1); // monitor
  // Desk shadow
  rect(bdl.x-2, bdl.y+bdl.h/2, bdl.w+4, 3, 0x000000, bdl.depth-1, 0.2);
  // Monitor screen glow
  rect(bdl.x-28, bdl.y-16, 16, 8, 0x64b5f6, bdl.depth, 0.3);

  rect(bdr.x, bdr.y, bdr.w, bdr.h, bdr.color, bdr.depth);
  rect(bdr.x, bdr.y-12, bdr.w+8, 6, bdr.accent, bdr.depth+1);
  rect(bdr.x+30, bdr.y-18, 20, 12, 0x212121, bdr.depth+1); // monitor
  // Desk shadow
  rect(bdr.x-2, bdr.y+bdr.h/2, bdr.w+4, 3, 0x000000, bdr.depth-1, 0.2);
  // Monitor screen glow
  rect(bdr.x+32, bdr.y-16, 16, 8, 0xef9a9a, bdr.depth, 0.3);

  // Small desks
  [f.smallDeskTL, f.smallDeskTR, f.smallDeskBL, f.smallDeskBR].forEach(d => {
    rect(d.x, d.y, d.w, d.h, d.color, d.depth);
    rect(d.x, d.y-8, d.w+4, 4, 0x121212, d.depth+1);
    // Desk shadow
    rect(d.x-2, d.y+d.h/2, d.w+4, 3, 0x000000, d.depth-1, 0.2);
  });

  // Server rack
  rect(f.serverRack.x, f.serverRack.y, f.serverRack.w, f.serverRack.h, f.serverRack.color, f.serverRack.depth);
  for (let i=0;i<3;i++) rect(f.serverRack.x, f.serverRack.y-35+i*25, 40, 4, 0x455a64, f.serverRack.depth+1);

  // Coffee machine (spritesheet animation)
  const cm = scene.add.sprite(f.coffeeMachine.x, f.coffeeMachine.y, 'coffee_machine', 0)
    .setOrigin(0.5).setDepth(99).setScale(f.coffeeMachine.scale);
  if (scene.anims.exists('cf_machine')) cm.play('cf_machine', true);

  // Office sofa
  rect(f.officeSofa.x, f.officeSofa.y, f.officeSofa.w, f.officeSofa.h, f.officeSofa.color, f.officeSofa.depth);

  // ===== Manager room furniture =====
  // Manager desk
  rect(f.managerDesk.x, f.managerDesk.y, f.managerDesk.w, f.managerDesk.h, f.managerDesk.color, f.managerDesk.depth);
  rect(f.managerDesk.x, f.managerDesk.y-10, f.managerDesk.w+6, 5, 0x795548, f.managerDesk.depth+1);
  // Gold trim on manager desk
  rect(f.managerDesk.x-2, f.managerDesk.y-12, f.managerDesk.w+10, 2, 0xffd700, f.managerDesk.depth+2, 0.7);
  rect(f.managerDesk.x-2, f.managerDesk.y+14, f.managerDesk.w+10, 2, 0xffd700, f.managerDesk.depth+2, 0.5);
  // Desk shadow
  rect(f.managerDesk.x-2, f.managerDesk.y+18, f.managerDesk.w+4, 3, 0x000000, f.managerDesk.depth-1, 0.3);

  // Manager chair
  rect(f.managerChair.x, f.managerChair.y, f.managerChair.w, f.managerChair.h, f.managerChair.color, f.managerChair.depth);

  // Bookshelf
  rect(f.managerBookshelf.x, f.managerBookshelf.y, f.managerBookshelf.w, f.managerBookshelf.h, f.managerBookshelf.color, f.managerBookshelf.depth);

  // Window
  rect(f.managerWindow.x, f.managerWindow.y, f.managerWindow.w, f.managerWindow.h, f.managerWindow.color, f.managerWindow.depth);
  rect(f.managerWindow.x, f.managerWindow.y-6, f.managerWindow.w+8, 4, 0x5d4037, f.managerWindow.depth+1);

  // Lamp
  rect(f.managerLamp.x, f.managerLamp.y, f.managerLamp.w, f.managerLamp.h, f.managerLamp.color, f.managerLamp.depth);
  rect(f.managerLamp.x-7, f.managerLamp.y-12, 22, 4, f.managerLamp.color, f.managerLamp.depth+1, 0.4);

  // ===== Plants =====
  [f.officePlant1, f.officePlant2].forEach(p => {
    if (scene.textures.exists('plants')) {
      const pl = scene.add.sprite(p.x, p.y, 'plants', Math.floor(Math.random() * Math.min(scene.textures.get('plants').frameTotal || 16, 16)))
        .setOrigin(0.5).setDepth(p.depth).setScale(p.scale || 0.3);
    }
  });

  // ===== Cat =====
  const cat = f.officeCat;
  if (scene.textures.exists('cats')) {
    window.catSprite = scene.add.sprite(cat.x, cat.y, 'cats', Math.floor(Math.random() * Math.min(scene.textures.get('cats').frameTotal || 16, 16)))
      .setOrigin(0.5).setDepth(cat.depth).setScale(cat.scale || 0.3);
    window.catSprite.setInteractive({ useHandCursor: true });
    window.catSprite.on('pointerdown', () => {
      window.catSprite.setFrame(Math.floor(Math.random() * Math.min(scene.textures.get('cats').frameTotal || 16, 16)));
      showCatBubble(true);
    });
  }
}

// ===================== CHARACTERS =====================
function drawCharacters(scene) {
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
    let sprite;
    const si = LAYOUT.toolColors[m.id] ? LAYOUT.toolColors[m.id].spriteIdx : 1;

    if (m.id === 'hermes') {
      // Hermes uses the star image
      sprite = scene.add.image(bx, by, 'star_idle_static').setOrigin(0.5);
      sprite.setScale(0.4);
      sprite.setDepth(20);
      star = sprite;
    } else {
      // Guest sprites (use spriteIdx from toolColors, 1-indexed for guest_anim)
      const guestIdx = (si % 6) || 6; // 1-6 range
      if (scene.textures.exists('guest_anim_'+guestIdx)) {
        sprite = scene.add.sprite(bx, by, 'guest_anim_'+guestIdx, 0).setOrigin(0.5);
        sprite.setScale(1.2);
        sprite.setDepth(20);
        if (scene.anims.exists('g_idle_'+guestIdx)) {
          sprite.play('g_idle_'+guestIdx, true);
        }
      } else {
        // Fallback: colored rectangle
        const tc = LAYOUT.toolColors[m.id] || { color: 0x888888 };
        sprite = scene.add.rectangle(bx, by, 12, 20, tc.color).setOrigin(0.5).setDepth(20);
      }
    }

    window.memberSprites[m.id] = sprite;
    window.memberStates[m.id] = 'idle';
    window.memberTargets[m.id] = { x: bx, y: by };

    // Tool icon badge (above character) with background color block
    const tc = LAYOUT.toolColors[m.id] || { icon: '👤', color: '#ccc', colorCode: 0x888888 };
    const badgeColor = LAYOUT.toolColors[m.id] ? LAYOUT.toolColors[m.id].color : 0x888888;
    const badgeBg = scene.add.rectangle(bx, by - 22, 18, 18, badgeColor, 0.7)
      .setOrigin(0.5).setDepth(24).setStrokeStyle(1, 0x000000, 0.8);
    const badge = scene.add.text(bx, by - 22, tc.icon, {
      fontFamily: 'monospace', fontSize: '12px',
      stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(25);
    window.memberBadges[m.id] = badge;
    window.memberBadgeBgs[m.id] = badgeBg;

    // Name label (below character)
    const label = scene.add.text(bx, by + 18, m.label, {
      fontFamily: 'monospace', fontSize: '8px', fill: '#fff',
      stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(21);
    window.memberLabels[m.id] = label;

    // Store sprite data for badge tracking
    spriteData[m.id] = { badge, label };
  });

  window.starSprite = star;
}

// ===================== PLAQUE =====================
function drawPlaque(scene) {
  const px = LAYOUT.plaque.x, py = LAYOUT.plaque.y;
  const bg = scene.add.rectangle(px, py, LAYOUT.plaque.width, LAYOUT.plaque.height, 0x5d4037).setDepth(30);
  bg.setStrokeStyle(3, 0x3e2723);
  scene.add.text(px, py, 'Pixel Office v3', {
    fontFamily: 'monospace', fontSize: '16px', fill: '#ffd700',
    fontWeight: 'bold', stroke: '#000', strokeThickness: 2
  }).setOrigin(0.5).setDepth(31);
  scene.add.text(px-140, py, '⭐', {fontFamily:'monospace',fontSize:'16px'}).setOrigin(0.5).setDepth(31);
  scene.add.text(px+140, py, '⭐', {fontFamily:'monospace',fontSize:'16px'}).setOrigin(0.5).setDepth(31);
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

  // Inject loading bar pulse animation
  const pulseStyle = document.createElement('style');
  pulseStyle.textContent = '@keyframes loadingPulse {' +
    '0%,100%{box-shadow:0 0 5px #ffd700,0 0 10px #ffd700}' +
    '50%{box-shadow:0 0 15px #ffd700,0 0 30px #ff8c00}}' +
    '#loading-progress-bar{transition:width 0.3s ease;animation:loadingPulse 1.5s ease-in-out infinite}';
  document.head.appendChild(pulseStyle);
  this.load.on('filecomplete', updateLoadingProgress);
  this.load.on('complete', hideLoadingOverlay);

  // Load all assets
  this.load.image('office_bg', '/office_bg.webp');
  this.load.image('star_idle_static', '/star-idle-v5.png');
  this.load.spritesheet('coffee_machine', '/coffee-machine-v3-grid.webp', { frameWidth: 230, frameHeight: 230 });
  this.load.spritesheet('plants', '/plants-spritesheet.webp', { frameWidth: 160, frameHeight: 160 });
  this.load.spritesheet('cats', '/cats-spritesheet.webp', { frameWidth: 160, frameHeight: 160 });

  // Load 6 guest animation spritesheets (32x32 frames, 6 frames each)
  for (let i = 1; i <= 6; i++) {
    this.load.spritesheet('guest_anim_'+i, '/guest_anim_'+i+'.webp', { frameWidth: 32, frameHeight: 32 });
  }
}

// ===================== CREATE =====================
function create() {
  game = this;
  areas = LAYOUT.areas;

  // Draw single Star Office room (1280x720) - no rooms or dividers
  drawStarOfficeRoom(this);

  // ===== Create animations =====
  if (!this.anims.exists('cf_machine')) {
    this.anims.create({
      key: 'cf_machine',
      frames: this.anims.generateFrameNumbers('coffee_machine', { start: 0, end: 95 }),
      frameRate: 12,
      repeat: -1
    });
  }
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

  // Draw characters
  drawCharacters(this);

  // Draw plaque
  drawPlaque(this);

  // ===== Camera setup =====
  mainCamera = this.cameras.main;
  mainCamera.setBounds(0, 0, 1280, 720); // Single room, no scrolling

  // Hermes star is no longer followed by camera in single room layout
  // Camera stays centered on the scene with no movement

  // ===== Load remote data =====
  loadMemo();
  fetchStatus();
  loadDepartments();
  renderMemberStatus();

  // Click anywhere refreshes status (debounced 300ms)
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
  // Periodic status fetch
  if (time - lastFetch > FETCH_INT) {
    fetchStatus();
    lastFetch = time;
  }

  // Periodic member status render (once per 2s)
  if (time - lastStatusRender > 2000) {
    renderMemberStatus();
    lastStatusRender = time;
  }

  // Bubble display
  if (time - lastBubble > BUBBLE_INT) {
    showBubble();
    lastBubble = time;
  }
  if (time - lastCatBubble > CAT_INT) {
    showCatBubble();
    lastCatBubble = time;
  }

  // Typewriter effect for status text
  if (ttIdx < ttTarget.length && time - lastTT > TT_DELAY) {
    ttText += ttTarget[ttIdx];
    const st = document.getElementById('status-text');
    if (st) st.textContent = ttText;
    ttIdx++;
    lastTT = time;
  }

  // Move guest characters toward their targets
  if (window.memberSprites) {
    MEMBERS.forEach(m => {
      if (m.id === 'hermes') return; // Hermes handled separately
      const sp = window.memberSprites[m.id];
      const t = window.memberTargets[m.id];
      if (!sp || !t) return;

      const dx = t.x - sp.x;
      const dy = t.y - sp.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 3) {
        const speed = 1.4;
        sp.x += (dx/dist) * speed;
        sp.y += (dy/dist) * speed;
      }

      // Update badge (tool icon) above character
      const badge = window.memberBadges[m.id];
      const badgeBg = window.memberBadgeBgs && window.memberBadgeBgs[m.id];
      if (badge) {
        badge.setPosition(sp.x, sp.y - 22);
        // Subtle floating animation
        badge.setY(sp.y - 22 + Math.sin(time/300 + parseFloat('0.'+m.id.charCodeAt(0)))*1.5);
      }
      if (badgeBg) {
        badgeBg.setPosition(sp.x, sp.y - 22);
        badgeBg.setY(sp.y - 22 + Math.sin(time/300 + parseFloat('0.'+m.id.charCodeAt(0)))*1.5);
      }

      // Update name label below character
      const lbl = window.memberLabels[m.id];
      if (lbl) lbl.setPosition(sp.x, sp.y + 18);
    });
  }

  // Move Hermes star
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
  .then(r => {
    if (!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  })
  .then(data => {
    if (!Array.isArray(data) || !data.length) return;

    // Hermes state
    const hw = data.find(w => (w.name||'').toLowerCase() === 'hermes') || data[0];
    const ns = normalizeState(hw.status||'idle');
    const si = STATES[ns] || STATES.idle;
    const changed = (pendingState === null) && (ns !== currentState);
    const det = hw.task_name || hw.task_message || '...';
    const nl = '['+si.name+'] '+det;

    if (changed) {
      ttTarget = nl;
      ttText = '';
      ttIdx = 0;
      pendingState = null;
      currentState = ns;
      if (star) star.setVisible(true);
      targetX = (areas[si.area] || areas.lounge).x;
      targetY = (areas[si.area] || areas.lounge).y;
    } else if (ttTarget !== nl) {
      ttTarget = nl;
      ttText = '';
      ttIdx = 0;
    }

    // Update all member states
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
        window.memberTargets[mm.id] = {
          x: areas[ta].x + mm.offset.x,
          y: areas[ta].y + mm.offset.y
        };
      }
    });
    renderMemberStatus();
  })
  .catch(() => {
    ttTarget = '連線失敗';
    ttText = '';
    ttIdx = 0;
    pendingState = null;
  });
}

function moveStar(time) {
  // In Star Office layout, Hermes star is static in the manager area
  // No movement needed - we simply ensure it remains visible
  if (star) {
    star.setVisible(true);
  }
}

// ===================== BUBBLES =====================
function showBubble() {
  if (bubbleTimer) clearTimeout(bubbleTimer);
  if (bubble) { bubble.destroy(); bubble = null; }
  const texts = BTEXTS[currentState] || BTEXTS.idle;
  const anchorX = 640; // Center of single room
  const anchorY = 360 - 50; // Above center
  const text = texts[Math.floor(Math.random()*texts.length)];
  const by = anchorY - 40;
  const bg = game.add.rectangle(anchorX, by, text.length*8+16, 22, 0xffffff, 0.95)
    .setStrokeStyle(2, 0x000);
  const txt = game.add.text(anchorX, by, text, {
    fontFamily: 'monospace', fontSize: '10px', fill: '#000'
  }).setOrigin(0.5);
  bubble = game.add.container(0, 0, [bg, txt]).setDepth(1200);
  bubbleTimer = setTimeout(() => {
    if (bubble) { bubble.destroy(); bubble = null; }
    bubbleTimer = null;
  }, 3000);
}

function showCatBubble(force) {
  if (!window.catSprite) return;
  if (catBubbleTimer) clearTimeout(catBubbleTimer);
  if (window.catBubble) { window.catBubble.destroy(); window.catBubble = null; }
  const texts = BTEXTS.cat || ['喵~'];
  const text = texts[Math.floor(Math.random()*texts.length)];
  const ax = window.catSprite.x;
  const ay = window.catSprite.y - 40;
  const bg = game.add.rectangle(ax, ay, text.length*8+16, 20, 0xfffbeb, 0.95)
    .setStrokeStyle(2, 0xd4a574);
  const txt = game.add.text(ax, ay, text, {
    fontFamily: 'monospace', fontSize: '9px', fill: '#8b6914'
  }).setOrigin(0.5);
  window.catBubble = game.add.container(0, 0, [bg, txt]).setDepth(2100);
  catBubbleTimer = setTimeout(() => {
    if (window.catBubble) { window.catBubble.destroy(); window.catBubble = null; }
    catBubbleTimer = null;
  }, 3000);
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
    breakroom: '🏢 辦公室',
    manager_desk: '⭐ 經理位'
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
  '遊戲開發部':'🎮','投資研究部':'📊','任務執行部':'🎯',
  '稽核日誌部':'📋','系統狀態':'⚙️'
};

function renderDepartmentSidebar() {
  const list = document.getElementById('department-list');
  if (!list) return;
  list.innerHTML = '';
  if (!departments || !departments.length) {
    list.innerHTML = '<div style="color:#9ca3af;font-size:12px;padding:20px;text-align:center;">暫無部門</div>';
    return;
  }
  departments.forEach(d => {
    const icon = DEPT_ICONS[d.name] || '📁';
    const item = document.createElement('div');
    item.className = 'dept-item' + (currentDepartmentView === d.id ? ' active' : '');
    item.innerHTML = `<span class="dept-icon">${icon}</span>` +
      `<span class="dept-name">${d.name}</span>` +
      `<span class="dept-status ${d.status||'active'}">${d.status||'active'}</span>`;
    item.onclick = () => openDepartmentView(d);
    list.appendChild(item);
  });
}

async function openDepartmentView(dept) {
  currentDepartmentView = dept.id;
  renderDepartmentSidebar();
  const panel = document.getElementById('dept-detail-panel');
  const content = document.getElementById('dept-detail-content');
  if (!panel || !content) return;
  panel.style.display = 'block';
  content.innerHTML = '<div style="color:#9ca3af;font-size:12px;text-align:center;padding:20px;">載入中...</div>';
  const tk = localStorage.getItem('token');
  try {
    const [tr, wr] = await Promise.all([
      fetch('/api/tasks?department_id='+dept.id+'&t='+Date.now(), {
        headers: { 'Authorization': 'Bearer '+tk }, cache: 'no-store'
      }),
      fetch('/api/workers?t='+Date.now(), {
        headers: { 'Authorization': 'Bearer '+tk }, cache: 'no-store'
      })
    ]);
    // Parse responses separately to avoid double-read
    const dt = tr.ok ? await tr.json() : [];
    const aw = wr.ok ? await wr.json() : [];
    const dw = Array.isArray(aw) ? aw.filter(w => w.department_id === dept.id) : [];

    const icon = DEPT_ICONS[dept.name] || '📁';
    let html = `<div class="dept-detail-header">${icon} ${dept.name}</div>` +
      `<div class="dept-detail-meta">狀態: ${dept.status||'active'} | ID: ${dept.id}</div>`;
    html += `<div class="dept-detail-section-title">📋 任務 (${Array.isArray(dt)?dt.length:0})</div>`;
    if (Array.isArray(dt) && dt.length) {
      dt.slice(0,10).forEach(t => {
        const sc = t.status==='completed'?'#2ecc71':t.status==='running'?'#f1c40f':'#e74c3c';
        html += `<div class="dept-detail-item"><span style="color:${sc}">●</span>` +
          `<span>${t.title||t.name||'任務'}</span>` +
          `<span style="color:#9ca3af;font-size:10px;">${t.status||'pending'}</span></div>`;
      });
    } else {
      html += '<div style="color:#9ca3af;font-size:11px;padding:8px;">暫無任務</div>';
    }
    html += `<div class="dept-detail-section-title">👷 Worker (${dw.length})</div>`;
    if (dw.length) {
      dw.slice(0,5).forEach(w => {
        const sc = w.status==='online'?'#2ecc71':'#9ca3af';
        html += `<div class="dept-detail-item"><span style="color:${sc}">●</span>` +
          `<span>${w.name||w.id||'Worker'}</span>` +
          `<span style="color:#9ca3af;font-size:10px;">${w.status||'offline'}</span></div>`;
      });
    } else {
      html += '<div style="color:#9ca3af;font-size:11px;padding:8px;">暫無 Worker</div>';
    }
    content.innerHTML = html;
  } catch(e) {
    content.innerHTML = '<div style="color:#e74c3c;font-size:12px;">載入失敗</div>';
  }
}

function closeDepartmentView() {
  currentDepartmentView = null;
  document.getElementById('dept-detail-panel').style.display = 'none';
  renderDepartmentSidebar();
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sidebar-backdrop');
  const isOpen = sb.classList.contains('open');
  sb.classList.toggle('open');
  if (bd) bd.classList.toggle('open');
  if (!isOpen) loadDepartments();
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('open');
}

// ===================== WEB SOCKET =====================
let hermesWs = null, hermesConnected = false, wsReconnectDelay = 1000;

function connectHermes() {
  const tk = localStorage.getItem('token');
  if (!tk) return;
  const p = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = p+'//'+window.location.host+'/ws?token='+encodeURIComponent(tk);
  try {
    hermesWs = new WebSocket(url);
    hermesWs.onopen = () => { hermesConnected = true; wsReconnectDelay = 1000; updateHermesIndicator(true); };
    hermesWs.onclose = () => {
      hermesConnected = false;
      updateHermesIndicator(false);
      const delay = wsReconnectDelay;
      wsReconnectDelay = Math.min(wsReconnectDelay * 2, 30000);
      setTimeout(connectHermes, delay);
    };
    hermesWs.onerror = () => {
      hermesConnected = false;
      updateHermesIndicator(false);
    };
    hermesWs.onmessage = e => {
      try {
        const m = JSON.parse(e.data);
        if (m.type === 'status_update' || m.type === 'state_change') {
          fetchStatus();
          loadDepartments();
        }
      } catch(e) {}
    };
  } catch(e) {
    const delay = wsReconnectDelay;
    wsReconnectDelay = Math.min(wsReconnectDelay * 2, 30000);
    setTimeout(connectHermes, delay);
  }
}

function updateHermesIndicator(connected) {
  const i = document.getElementById('hermes-indicator');
  const t = document.getElementById('hermes-text');
  if (i) i.style.background = connected ? '#2ecc71' : '#e74c3c';
  if (t) t.textContent = connected ? 'Hermes 已連線' : 'Hermes 離線';
}

// ===================== MEMO =====================
async function loadMemo() {
  const md = document.getElementById('memo-date');
  const mc = document.getElementById('memo-content');
  try {
    const tk = localStorage.getItem('token');
    const r = await fetch('/api/messages?limit=5&t='+Date.now(), {
      headers: tk ? { 'Authorization': 'Bearer '+tk } : {},
      cache: 'no-store'
    });
    if (!r.ok) {
      mc.innerHTML = '<div id="memo-placeholder">暫無記錄</div>';
      return;
    }
    const d = await r.json();
    if (Array.isArray(d) && d.length) {
      const l = d[d.length-1];
      md.textContent = l.created_at || '';
      mc.innerHTML = (l.content || '暫無內容').replace(/\n/g, '<br>');
    } else {
      mc.innerHTML = '<div id="memo-placeholder">暫無昨日日記</div>';
    }
  } catch(e) {
    mc.innerHTML = '<div id="memo-placeholder">載入失敗</div>';
  }
}

// ===================== START =====================
initGame();