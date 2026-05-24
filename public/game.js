// Pixel Office - Phaser 3 game logic
// Adapted from Star Office UI game.js
// Depends on layout.js (must load first)

let supportsWebP = false;

function checkWebPSupport() {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
      resolve(canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0);
    } else {
      resolve(false);
    }
  });
}

function checkWebPSupportFallback() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = 'data:image/webp;base64,UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAABBxAR/Q9ERP8DAABWUDggGAAAADABAJ0BKgEAAQADADQlpAADcAD++/1QAA==';
  });
}

function getExt(pngFile) {
  if (pngFile === 'star-working-spritesheet.png') return '.png';
  if (LAYOUT.forcePng && LAYOUT.forcePng[pngFile.replace(/\.(png|webp)$/, '')]) return '.png';
  return supportsWebP ? '.webp' : '.png';
}

const config = {
  type: Phaser.AUTO,
  width: LAYOUT.game.width,
  height: LAYOUT.game.height,
  parent: 'game-container',
  pixelArt: true,
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: { preload: preload, create: create, update: update }
};

let totalAssets = 0;
let loadedAssets = 0;
let loadingProgressBar, loadingProgressContainer, loadingOverlay, loadingText;

async function loadMemo() {
  const memoDate = document.getElementById('memo-date');
  const memoContent = document.getElementById('memo-content');
  try {
    const token = localStorage.getItem('token');
    const resp = await fetch('/api/messages?limit=5&t=' + Date.now(), {
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
      cache: 'no-store'
    });
    if (!resp.ok) {
      memoContent.innerHTML = '<div id="memo-placeholder">暫無記錄</div>';
      return;
    }
    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) {
      const latest = data[data.length - 1];
      memoDate.textContent = latest.created_at || '';
      memoContent.innerHTML = (latest.content || '暫無內容').replace(/\n/g, '<br>');
    } else {
      memoContent.innerHTML = '<div id="memo-placeholder">暫無昨日日記</div>';
    }
  } catch (e) {
    console.error('載入訊息失敗:', e);
    memoContent.innerHTML = '<div id="memo-placeholder">載入失敗</div>';
  }
}

function updateLoadingProgress() {
  loadedAssets++;
  const percent = Math.min(100, Math.round((loadedAssets / totalAssets) * 100));
  if (loadingProgressBar) loadingProgressBar.style.width = percent + '%';
  if (loadingText) loadingText.textContent = `正在載入像素辦公室... ${percent}%`;
}

function hideLoadingOverlay() {
  setTimeout(() => {
    if (loadingOverlay) {
      loadingOverlay.style.transition = 'opacity 0.5s ease';
      loadingOverlay.style.opacity = '0';
      setTimeout(() => { loadingOverlay.style.display = 'none'; }, 500);
    }
  }, 300);
}

const STATES = {
  idle: { name: '待命', area: 'breakroom' },
  writing: { name: '整理文檔', area: 'writing' },
  researching: { name: '搜尋資訊', area: 'researching' },
  executing: { name: '執行任務', area: 'writing' },
  syncing: { name: '同步備份', area: 'writing' },
  error: { name: '出錯了', area: 'error' }
};

const BUBBLE_TEXTS = {
  idle: ['待命中：隨時可以開工', '先把桌面收拾乾淨', '呼——給大腦放個風', '咖啡還熱，靈感也還在'],
  writing: ['進入專注模式：勿擾', '先把關鍵路徑跑通', '把 bug 關進籠子裡', '今天的進度，明天的底氣'],
  researching: ['我在挖證據鏈', '找到關鍵在這裏', '先定位，再優化'],
  executing: ['執行中：不要眨眼', '開始跑 pipeline', '讓結果自己說話'],
  syncing: ['同步中：把今天鎖進雲裡', '備份不是儀式，是安全感', '多一份備份，少一份後悔'],
  error: ['警報響了：先別慌', '我聞到 bug 的味道了', '錯誤不是敵人，是線索'],
  cat: ['喵~', '咕嚕咕嚕…', '尾巴搖一搖', '我是這個辦公室的吉祥物']
};

let game, star, sofa, serverroom, areas = {}, currentState = 'idle', pendingDesiredState = null, statusText, lastFetch = 0, lastBlink = 0, lastBubble = 0, targetX = 660, targetY = 170, bubble = null, typewriterText = '', typewriterTarget = '', typewriterIndex = 0, lastTypewriter = 0, syncAnimSprite = null, catBubble = null;
let isMoving = false;
let waypoints = [];
const FETCH_INTERVAL = 3000;
const BUBBLE_INTERVAL = 8000;
const CAT_BUBBLE_INTERVAL = 18000;
let lastCatBubble = 0;
const TYPEWRITER_DELAY = 50;

// Helper: get auth headers
function authHeaders() {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return headers;
}

async function initGame() {
  try { supportsWebP = await checkWebPSupport(); }
  catch (e) { try { supportsWebP = await checkWebPSupportFallback(); } catch (e2) { supportsWebP = false; } }
  console.log('WebP 支援:', supportsWebP);
  new Phaser.Game(config);
  // Connect Hermes WebSocket
  setTimeout(connectHermes, 1000);
}

function preload() {
  loadingOverlay = document.getElementById('loading-overlay');
  loadingProgressBar = document.getElementById('loading-progress-bar');
  loadingText = document.getElementById('loading-text');
  loadingProgressContainer = document.getElementById('loading-progress-container');

  totalAssets = LAYOUT.totalAssets || 15;
  loadedAssets = 0;

  this.load.on('filecomplete', () => { updateLoadingProgress(); });
  this.load.on('complete', () => { hideLoadingOverlay(); });

  this.load.image('office_bg', '/office_bg.webp');
  this.load.image('sofa_idle', '/sofa-idle-v3.png');
  this.load.image('desk', '/desk-v3.webp');
  this.load.image('memo_bg', '/memo-bg.webp');
  this.load.image('star_idle_static', '/star-idle-v5.png');

  this.load.spritesheet('plants', '/plants-spritesheet.webp', { frameWidth: 160, frameHeight: 160 });
  this.load.spritesheet('posters', '/posters-spritesheet.webp', { frameWidth: 160, frameHeight: 160 });
  this.load.spritesheet('coffee_machine', '/coffee-machine-v3-grid.webp', { frameWidth: 230, frameHeight: 230 });
  this.load.spritesheet('serverroom', '/serverroom-spritesheet.webp', { frameWidth: 180, frameHeight: 251 });
  this.load.spritesheet('error_bug', '/error-bug-spritesheet-grid.webp', { frameWidth: 180, frameHeight: 180 });
  this.load.spritesheet('cats', '/cats-spritesheet.webp', { frameWidth: 160, frameHeight: 160 });
  this.load.spritesheet('star_working', '/star-working-spritesheet-grid.webp', { frameWidth: 230, frameHeight: 144 });
  this.load.spritesheet('sync_anim', '/sync-animation-v3-grid.webp', { frameWidth: 256, frameHeight: 256 });
  this.load.spritesheet('flowers', '/flowers-bloom-v2.webp', { frameWidth: 65, frameHeight: 65 });
}

function create() {
  game = this;
  this.add.image(640, 360, 'office_bg');

  // === Sofa ===
  sofa = this.add.sprite(
    LAYOUT.furniture.sofa.x, LAYOUT.furniture.sofa.y, 'sofa_idle'
  ).setOrigin(LAYOUT.furniture.sofa.origin.x, LAYOUT.furniture.sofa.origin.y);
  sofa.setDepth(LAYOUT.furniture.sofa.depth);

  areas = LAYOUT.areas;

  // === Star idle sprite ===
  star = this.add.image(areas.breakroom.x, areas.breakroom.y, 'star_idle_static').setOrigin(0.5);
  star.setDepth(20);
  star.setVisible(false); // Hidden until status is fetched

  // === Plaque ===
  const plaqueX = LAYOUT.plaque.x;
  const plaqueY = LAYOUT.plaque.y;
  const plaqueBg = game.add.rectangle(plaqueX, plaqueY, LAYOUT.plaque.width, LAYOUT.plaque.height, 0x5d4037);
  plaqueBg.setStrokeStyle(3, 0x3e2723);
  const plaqueText = game.add.text(plaqueX, plaqueY, 'Pixel Office', {
    fontFamily: 'monospace',
    fontSize: '18px',
    fill: '#ffd700',
    fontWeight: 'bold',
    stroke: '#000',
    strokeThickness: 2
  }).setOrigin(0.5);
  game.add.text(plaqueX - 190, plaqueY, '⭐', { fontFamily: 'monospace', fontSize: '20px' }).setOrigin(0.5);
  game.add.text(plaqueX + 190, plaqueY, '⭐', { fontFamily: 'monospace', fontSize: '20px' }).setOrigin(0.5);

  // === Plants ===
  for (let i = 0; i < LAYOUT.furniture.plants.length; i++) {
    const p = LAYOUT.furniture.plants[i];
    const plant = game.add.sprite(p.x, p.y, 'plants', Math.floor(Math.random() * 16)).setOrigin(0.5);
    plant.setDepth(p.depth);
    plant.setInteractive({ useHandCursor: true });
    plant.on('pointerdown', () => { plant.setFrame(Math.floor(Math.random() * 16)); });
  }

  // === Poster ===
  const poster = game.add.sprite(LAYOUT.furniture.poster.x, LAYOUT.furniture.poster.y, 'posters', Math.floor(Math.random() * 32)).setOrigin(0.5);
  poster.setDepth(LAYOUT.furniture.poster.depth);
  poster.setInteractive({ useHandCursor: true });
  poster.on('pointerdown', () => { poster.setFrame(Math.floor(Math.random() * 32)); });

  // === Cat ===
  const cat = game.add.sprite(LAYOUT.furniture.cat.x, LAYOUT.furniture.cat.y, 'cats', Math.floor(Math.random() * 16)).setOrigin(LAYOUT.furniture.cat.origin.x, LAYOUT.furniture.cat.origin.y);
  cat.setDepth(LAYOUT.furniture.cat.depth);
  cat.setInteractive({ useHandCursor: true });
  cat.on('pointerdown', () => { cat.setFrame(Math.floor(Math.random() * 16)); });

  // === Coffee Machine ===
  this.anims.create({
    key: 'coffee_machine',
    frames: this.anims.generateFrameNumbers('coffee_machine', { start: 0, end: 95 }),
    frameRate: 12.5,
    repeat: -1
  });
  const coffeeMachine = this.add.sprite(LAYOUT.furniture.coffeeMachine.x, LAYOUT.furniture.coffeeMachine.y, 'coffee_machine')
    .setOrigin(LAYOUT.furniture.coffeeMachine.origin.x, LAYOUT.furniture.coffeeMachine.origin.y);
  coffeeMachine.setDepth(LAYOUT.furniture.coffeeMachine.depth);
  coffeeMachine.anims.play('coffee_machine', true);

  // === Server Room ===
  this.anims.create({
    key: 'serverroom_on',
    frames: this.anims.generateFrameNumbers('serverroom', { start: 0, end: 39 }),
    frameRate: 6,
    repeat: -1
  });
  serverroom = this.add.sprite(LAYOUT.furniture.serverroom.x, LAYOUT.furniture.serverroom.y, 'serverroom', 0)
    .setOrigin(LAYOUT.furniture.serverroom.origin.x, LAYOUT.furniture.serverroom.origin.y);
  serverroom.setDepth(LAYOUT.furniture.serverroom.depth);
  serverroom.anims.stop();
  serverroom.setFrame(0);

  // === Desk ===
  const desk = this.add.image(LAYOUT.furniture.desk.x, LAYOUT.furniture.desk.y, 'desk')
    .setOrigin(LAYOUT.furniture.desk.origin.x, LAYOUT.furniture.desk.origin.y);
  desk.setDepth(LAYOUT.furniture.desk.depth);

  // === Flower ===
  const flower = this.add.sprite(LAYOUT.furniture.flower.x, LAYOUT.furniture.flower.y, 'flowers', Math.floor(Math.random() * 16))
    .setOrigin(LAYOUT.furniture.flower.origin.x, LAYOUT.furniture.flower.origin.y);
  flower.setScale(LAYOUT.furniture.flower.scale || 1);
  flower.setDepth(LAYOUT.furniture.flower.depth);
  flower.setInteractive({ useHandCursor: true });
  flower.on('pointerdown', () => { flower.setFrame(Math.floor(Math.random() * 16)); });

  // === Star Working ===
  this.anims.create({
    key: 'star_working',
    frames: this.anims.generateFrameNumbers('star_working', { start: 0, end: 99 }),
    frameRate: 12,
    repeat: -1
  });
  this.anims.create({
    key: 'error_bug',
    frames: this.anims.generateFrameNumbers('error_bug', { start: 0, end: 98 }),
    frameRate: 12,
    repeat: -1
  });

  // === Error Bug ===
  const errorBug = this.add.sprite(LAYOUT.furniture.errorBug.x, LAYOUT.furniture.errorBug.y, 'error_bug', 0)
    .setOrigin(LAYOUT.furniture.errorBug.origin.x, LAYOUT.furniture.errorBug.origin.y);
  errorBug.setDepth(LAYOUT.furniture.errorBug.depth);
  errorBug.setVisible(false);
  errorBug.setScale(LAYOUT.furniture.errorBug.scale);
  errorBug.anims.play('error_bug', true);
  window.errorBug = errorBug;
  window.errorBugDir = 1;

  const starWorking = this.add.sprite(LAYOUT.furniture.starWorking.x, LAYOUT.furniture.starWorking.y, 'star_working', 0)
    .setOrigin(LAYOUT.furniture.starWorking.origin.x, LAYOUT.furniture.starWorking.origin.y);
  starWorking.setVisible(false);
  starWorking.setScale(LAYOUT.furniture.starWorking.scale);
  starWorking.setDepth(LAYOUT.furniture.starWorking.depth);
  window.starWorking = starWorking;

  // === Sync Animation ===
  this.anims.create({
    key: 'sync_anim',
    frames: this.anims.generateFrameNumbers('sync_anim', { start: 1, end: 48 }),
    frameRate: 12,
    repeat: -1
  });
  syncAnimSprite = this.add.sprite(LAYOUT.furniture.syncAnim.x, LAYOUT.furniture.syncAnim.y, 'sync_anim', 0)
    .setOrigin(LAYOUT.furniture.syncAnim.origin.x, LAYOUT.furniture.syncAnim.origin.y);
  syncAnimSprite.setDepth(LAYOUT.furniture.syncAnim.depth);
  syncAnimSprite.anims.stop();
  syncAnimSprite.setFrame(0);

  window.starSprite = star;
  statusText = document.getElementById('status-text');

  loadMemo();
  fetchStatus();
  loadDepartments();

  // Track mouse for delayed click refresh
  game.input.on('pointerdown', () => {
    // Refresh data on click
    fetchStatus();
    fetchDepartments();
  });
}

function update(time) {
  if (time - lastFetch > FETCH_INTERVAL) { fetchStatus(); lastFetch = time; }

  const effectiveState = pendingDesiredState || currentState;

  // Server room animation
  if (serverroom) {
    if (effectiveState === 'idle') {
      if (serverroom.anims.isPlaying) { serverroom.anims.stop(); serverroom.setFrame(0); }
    } else {
      if (!serverroom.anims.isPlaying || serverroom.anims.currentAnim?.key !== 'serverroom_on') {
        serverroom.anims.play('serverroom_on', true);
      }
    }
  }

  // Error bug animation
  if (window.errorBug) {
    if (effectiveState === 'error') {
      window.errorBug.setVisible(true);
      if (!window.errorBug.anims.isPlaying || window.errorBug.anims.currentAnim?.key !== 'error_bug') {
        window.errorBug.anims.play('error_bug', true);
      }
      const leftX = LAYOUT.furniture.errorBug.pingPong.leftX;
      const rightX = LAYOUT.furniture.errorBug.pingPong.rightX;
      const speed = LAYOUT.furniture.errorBug.pingPong.speed;
      const dir = window.errorBugDir || 1;
      window.errorBug.x += speed * dir;
      if (window.errorBug.x >= rightX) { window.errorBug.x = rightX; window.errorBugDir = -1; }
      else if (window.errorBug.x <= leftX) { window.errorBug.x = leftX; window.errorBugDir = 1; }
    } else {
      window.errorBug.setVisible(false);
      window.errorBug.anims.stop();
    }
  }

  // Sync animation
  if (syncAnimSprite) {
    if (effectiveState === 'syncing') {
      if (!syncAnimSprite.anims.isPlaying || syncAnimSprite.anims.currentAnim?.key !== 'sync_anim') {
        syncAnimSprite.anims.play('sync_anim', true);
      }
    } else {
      if (syncAnimSprite.anims.isPlaying) syncAnimSprite.anims.stop();
      syncAnimSprite.setFrame(0);
    }
  }

  // Bubbles
  if (time - lastBubble > BUBBLE_INTERVAL) { showBubble(); lastBubble = time; }
  if (time - lastCatBubble > CAT_BUBBLE_INTERVAL) { showCatBubble(); lastCatBubble = time; }

  if (typewriterIndex < typewriterTarget.length && time - lastTypewriter > TYPEWRITER_DELAY) {
    typewriterText += typewriterTarget[typewriterIndex];
    statusText.textContent = typewriterText;
    typewriterIndex++;
    lastTypewriter = time;
  }

  moveStar(time);
}

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

  // Use workers endpoint to get current worker status
  fetch('/api/workers?t=' + Date.now(), {
    headers: { 'Authorization': 'Bearer ' + token },
    cache: 'no-store'
  })
    .then(response => response.json())
    .then(data => {
      if (!Array.isArray(data) || data.length === 0) return;
      const first = data[0];
      const nextState = normalizeState(first.status || 'idle');
      const stateInfo = STATES[nextState] || STATES.idle;
      const changed = (pendingDesiredState === null) && (nextState !== currentState);
      const detail = first.task_name || first.task_message || '...';
      const nextLine = '[' + stateInfo.name + '] ' + detail;

      if (changed) {
        typewriterTarget = nextLine;
        typewriterText = '';
        typewriterIndex = 0;
        pendingDesiredState = null;
        currentState = nextState;

        if (nextState === 'idle') {
          star.setVisible(true);
          if (window.starWorking) { window.starWorking.setVisible(false); window.starWorking.anims.stop(); }
        } else if (nextState === 'error') {
          star.setVisible(false);
          if (window.starWorking) { window.starWorking.setVisible(false); window.starWorking.anims.stop(); }
        } else if (nextState === 'syncing') {
          star.setVisible(false);
          if (window.starWorking) { window.starWorking.setVisible(false); window.starWorking.anims.stop(); }
        } else {
          star.setVisible(false);
          if (window.starWorking) {
            window.starWorking.setVisible(true);
            window.starWorking.anims.play('star_working', true);
          }
        }

        // Move to target area
        const targetArea = stateInfo.area;
        if (areas[targetArea]) {
          targetX = areas[targetArea].x;
          targetY = areas[targetArea].y;
        }
      } else {
        if (!typewriterTarget || typewriterTarget !== nextLine) {
          typewriterTarget = nextLine;
          typewriterText = '';
          typewriterIndex = 0;
        }
      }
    })
    .catch(error => {
      typewriterTarget = '連線失敗，正在重試...';
      typewriterText = '';
      typewriterIndex = 0;
    });
}

function moveStar(time) {
  const effectiveState = pendingDesiredState || currentState;
  const stateInfo = STATES[effectiveState] || STATES.idle;
  const baseTarget = areas[stateInfo.area] || areas.breakroom;

  const dx = targetX - star.x;
  const dy = targetY - star.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const speed = 1.4;
  const wobble = Math.sin(time / 200) * 0.8;

  if (dist > 3) {
    star.x += (dx / dist) * speed;
    star.y += (dy / dist) * speed;
    star.setY(star.y + wobble);
    isMoving = true;
  } else {
    if (waypoints && waypoints.length > 0) {
      waypoints.shift();
      if (waypoints.length > 0) {
        targetX = waypoints[0].x;
        targetY = waypoints[0].y;
        isMoving = true;
      } else {
        if (pendingDesiredState !== null) {
          isMoving = false;
          currentState = pendingDesiredState;
          pendingDesiredState = null;
          updateStateVisuals();
        }
      }
    } else {
      if (pendingDesiredState !== null) {
        isMoving = false;
        currentState = pendingDesiredState;
        pendingDesiredState = null;
        updateStateVisuals();
      }
    }
  }
}

function updateStateVisuals() {
  if (currentState === 'idle') {
    star.setVisible(true);
    star.setText('✦');
    if (window.starWorking) { window.starWorking.setVisible(false); window.starWorking.anims.stop(); }
  } else {
    star.setVisible(false);
    if (window.starWorking) {
      window.starWorking.setVisible(true);
      window.starWorking.anims.play('star_working', true);
    }
  }
}

function showBubble() {
  if (bubble) { bubble.destroy(); bubble = null; }
  const texts = BUBBLE_TEXTS[currentState] || BUBBLE_TEXTS.idle;

  let anchorX = star.x;
  let anchorY = star.y;
  if (currentState === 'syncing' && syncAnimSprite && syncAnimSprite.visible) {
    anchorX = syncAnimSprite.x;
    anchorY = syncAnimSprite.y;
  } else if (currentState === 'error' && window.errorBug && window.errorBug.visible) {
    anchorX = window.errorBug.x;
    anchorY = window.errorBug.y;
  } else if (!star.visible && window.starWorking && window.starWorking.visible) {
    anchorX = window.starWorking.x;
    anchorY = window.starWorking.y;
  }

  const text = texts[Math.floor(Math.random() * texts.length)];
  const bubbleY = anchorY - 70;
  const bg = game.add.rectangle(anchorX, bubbleY, text.length * 10 + 20, 28, 0xffffff, 0.95);
  bg.setStrokeStyle(2, 0x000000);
  const txt = game.add.text(anchorX, bubbleY, text, { fontFamily: 'monospace', fontSize: '12px', fill: '#000', align: 'center' }).setOrigin(0.5);
  bubble = game.add.container(0, 0, [bg, txt]);
  bubble.setDepth(1200);
  setTimeout(() => { if (bubble) { bubble.destroy(); bubble = null; } }, 3000);
}

function showCatBubble() {
  if (!window.catSprite) return;
  if (window.catBubble) { window.catBubble.destroy(); window.catBubble = null; }
  const texts = BUBBLE_TEXTS.cat || ['喵~'];
  const text = texts[Math.floor(Math.random() * texts.length)];
  const anchorX = window.catSprite.x;
  const anchorY = window.catSprite.y - 60;
  const bg = game.add.rectangle(anchorX, anchorY, text.length * 10 + 20, 24, 0xfffbeb, 0.95);
  bg.setStrokeStyle(2, 0xd4a574);
  const txt = game.add.text(anchorX, anchorY, text, { fontFamily: 'monospace', fontSize: '11px', fill: '#8b6914', align: 'center' }).setOrigin(0.5);
  window.catBubble = game.add.container(0, 0, [bg, txt]);
  window.catBubble.setDepth(2100);
  setTimeout(() => { if (window.catBubble) { window.catBubble.destroy(); window.catBubble = null; } }, 4000);
}

// ============ DEPARTMENT / TASKS / WORKERS SIDEBAR ============

let departments = [];
let workers = [];
let tasks = [];
let currentDepartmentView = null;

async function loadDepartments() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const resp = await fetch('/api/departments?t=' + Date.now(), {
      headers: { 'Authorization': 'Bearer ' + token },
      cache: 'no-store'
    });
    if (!resp.ok) return;
    const data = await resp.json();
    departments = Array.isArray(data) ? data : [];
    renderDepartmentSidebar();
  } catch (e) { console.error('載入部門失敗:', e); }
}

async function fetchDepartments() {
  await loadDepartments();
}

const DEPARTMENT_ICONS = {
  '遊戲開發部': '🎮',
  '投資研究部': '📊',
  '任務執行部': '🎯',
  '稽核日誌部': '📋',
  '系統狀態': '⚙️'
};

function renderDepartmentSidebar() {
  const list = document.getElementById('department-list');
  if (!list) return;
  list.innerHTML = '';
  if (!departments || departments.length === 0) {
    list.innerHTML = '<div style="color:#9ca3af;font-size:12px;padding:20px;text-align:center;">暫無部門</div>';
    return;
  }
  departments.forEach(dept => {
    const icon = DEPARTMENT_ICONS[dept.name] || '📁';
    const item = document.createElement('div');
    item.className = 'dept-item' + (currentDepartmentView === dept.id ? ' active' : '');
    item.innerHTML = `<span class="dept-icon">${icon}</span>
      <span class="dept-name">${dept.name}</span>
      <span class="dept-status ${dept.status || 'active'}">${dept.status || 'active'}</span>`;
    item.onclick = () => openDepartmentView(dept);
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

  const token = localStorage.getItem('token');
  try {
    const [tasksResp, workersResp] = await Promise.all([
      fetch('/api/tasks?department_id=' + dept.id + '&t=' + Date.now(), {
        headers: { 'Authorization': 'Bearer ' + token },
        cache: 'no-store'
      }),
      fetch('/api/workers?t=' + Date.now(), {
        headers: { 'Authorization': 'Bearer ' + token },
        cache: 'no-store'
      })
    ]);

    const deptTasks = tasksResp.ok ? (await tasksResp.json()) : [];
    const allWorkers = workersResp.ok ? (await workersResp.json()) : [];
    const deptWorkers = Array.isArray(allWorkers) ? allWorkers.filter(w => w.department_id === dept.id) : [];

    const icon = DEPARTMENT_ICONS[dept.name] || '📁';
    let html = `<div class="dept-detail-header">${icon} ${dept.name}</div>`;
    html += `<div class="dept-detail-meta">狀態: ${dept.status || 'active'} | ID: ${dept.id}</div>`;

    // Tasks
    html += `<div class="dept-detail-section-title">📋 任務 (${Array.isArray(deptTasks) ? deptTasks.length : 0})</div>`;
    if (Array.isArray(deptTasks) && deptTasks.length > 0) {
      deptTasks.slice(0, 10).forEach(t => {
        const statusColor = t.status === 'completed' ? '#2ecc71' : t.status === 'running' ? '#f1c40f' : '#e74c3c';
        html += `<div class="dept-detail-item">
          <span style="color:${statusColor}">●</span>
          <span>${t.title || t.name || '任務'}</span>
          <span style="color:#9ca3af;font-size:10px;">${t.status || 'pending'}</span>
        </div>`;
      });
    } else {
      html += '<div style="color:#9ca3af;font-size:11px;padding:8px;">暫無任務</div>';
    }

    // Workers
    html += `<div class="dept-detail-section-title">👷 Worker (${deptWorkers.length})</div>`;
    if (deptWorkers.length > 0) {
      deptWorkers.slice(0, 5).forEach(w => {
        const sColor = w.status === 'online' ? '#2ecc71' : '#9ca3af';
        html += `<div class="dept-detail-item">
          <span style="color:${sColor}">●</span>
          <span>${w.name || w.id || 'Worker'}</span>
          <span style="color:#9ca3af;font-size:10px;">${w.status || 'offline'}</span>
        </div>`;
      });
    } else {
      html += '<div style="color:#9ca3af;font-size:11px;padding:8px;">暫無 Worker</div>';
    }

    content.innerHTML = html;
  } catch (e) {
    content.innerHTML = '<div style="color:#e74c3c;font-size:12px;">載入失敗</div>';
  }
}

function closeDepartmentView() {
  currentDepartmentView = null;
  const panel = document.getElementById('dept-detail-panel');
  if (panel) panel.style.display = 'none';
  renderDepartmentSidebar();
}

// ============ SIDEBAR TOGGLE ============

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const isOpen = sidebar.classList.contains('open');
  sidebar.classList.toggle('open');
  if (backdrop) backdrop.classList.toggle('open');
  if (!isOpen) loadDepartments();
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
}

// ============ HERMES WS ============

let hermesWs = null;
let hermesConnected = false;

function connectHermes() {
  const token = localStorage.getItem('token');
  if (!token) return;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = protocol + '//' + window.location.host + '/ws?token=' + encodeURIComponent(token);

  try {
    hermesWs = new WebSocket(wsUrl);
    hermesWs.onopen = () => {
      hermesConnected = true;
      updateHermesStatus(true);
    };
    hermesWs.onclose = () => {
      hermesConnected = false;
      updateHermesStatus(false);
      setTimeout(connectHermes, 5000);
    };
    hermesWs.onerror = () => {
      hermesConnected = false;
      updateHermesStatus(false);
    };
    hermesWs.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'status_update' || msg.type === 'state_change') {
          fetchStatus();
          loadDepartments();
        }
      } catch (e) {}
    };
  } catch (e) {
    setTimeout(connectHermes, 5000);
  }
}

function updateHermesStatus(connected) {
  const indicator = document.getElementById('hermes-indicator');
  const text = document.getElementById('hermes-text');
  if (indicator) {
    indicator.style.background = connected ? '#2ecc71' : '#e74c3c';
  }
  if (text) text.textContent = connected ? 'Hermes 已連線' : 'Hermes 離線';
}

// Start
initGame();