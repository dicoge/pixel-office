// Pixel Office - Layout & depth configuration
// Expanded: 3-room scrollable office
// Room 1 (x:0-640) = Break/Café | Room 2 (x:640-1920) = Main Office | Room 3 (x:1920-2560) = Dev/Server

const LAYOUT = {
  // === Game canvas ===
  game: {
    width: 2560,
    height: 720
  },

  // Room definitions
  rooms: {
    break:   { x: 0,    width: 640,  label: '☕ 休息區', bgColor: 0x3d2b1f },
    main:    { x: 640,  width: 1280, label: '🏢 主辦公室', bgFile: 'office_bg.webp' },
    dev:     { x: 1920, width: 640,  label: '💻 開發區', bgColor: 0x1a2332 }
  },

  // === Area coordinates (states → position) ===
  areas: {
    // Room 1 - Break/Café (x:0-640)
    lounge:      { x: 320, y: 280 },
    cafeteria:   { x: 180, y: 420 },

    // Room 2 - Main Office (x:640-1920)
    writing:     { x: 960,  y: 360 },
    researching: { x: 960,  y: 360 },
    breakroom:   { x: 1280, y: 360 },
    error:       { x: 1706, y: 160 },
    serverroom:  { x: 1661, y: 280 },

    // Room 3 - Dev/Server (x:1920-2560)
    dev_area:    { x: 2240, y: 280 },
    qa_testing:  { x: 2080, y: 420 },
    meeting:     { x: 2400, y: 400 }
  },

  // === Furniture & decorations ===
  furniture: {
    // --- Room 1: Break/Café furniture ---
    breakSofa: {
      x: 250, y: 200,
      width: 120, height: 40,
      depth: 10,
      color: 0x8b5e3c
    },
    breakTable: {
      x: 350, y: 260,
      width: 80, height: 30,
      depth: 10,
      color: 0x5d4037
    },
    breakFridge: {
      x: 100, y: 450,
      width: 50, height: 70,
      depth: 5,
      color: 0xcccccc
    },
    breakCounter: {
      x: 180, y: 480,
      width: 120, height: 20,
      depth: 5,
      color: 0x8d6e63
    },
    breakPlants: [
      { x: 60, y: 250, depth: 5, color: 0x4caf50 },
      { x: 580, y: 200, depth: 5, color: 0x388e3c }
    ],
    breakLamp: {
      x: 450, y: 190,
      depth: 5,
      color: 0xffd54f
    },

    // --- Room 2: Main Office furniture (offset +640x from original) ---
    sofa: {
      x: 1310,
      y: 144,
      origin: { x: 0, y: 0 },
      depth: 10
    },
    desk: {
      x: 858,
      y: 417,
      origin: { x: 0.5, y: 0.5 },
      depth: 1000
    },
    flower: {
      x: 950,
      y: 390,
      origin: { x: 0.5, y: 0.5 },
      depth: 1100,
      scale: 0.8
    },
    starWorking: {
      x: 857,
      y: 333,
      origin: { x: 0.5, y: 0.5 },
      depth: 900,
      scale: 1.0
    },
    plants: [
      { x: 1205, y: 178, depth: 5 },
      { x: 870,  y: 185, depth: 5 },
      { x: 1617, y: 496, depth: 5 }
    ],
    poster: {
      x: 892,
      y: 66,
      depth: 4
    },
    coffeeMachine: {
      x: 1299,
      y: 397,
      origin: { x: 0.5, y: 0.5 },
      depth: 99
    },
    serverroom: {
      x: 1661,
      y: 142,
      origin: { x: 0.5, y: 0.5 },
      depth: 2
    },
    errorBug: {
      x: 1647,
      y: 201,
      origin: { x: 0.5, y: 0.5 },
      depth: 50,
      scale: 0.7,
      pingPong: { leftX: 1647, rightX: 1751, speed: 0.6 }
    },
    syncAnim: {
      x: 1797,
      y: 592,
      origin: { x: 0.5, y: 0.5 },
      depth: 40
    },
    cat: {
      x: 734,
      y: 557,
      origin: { x: 0.5, y: 0.5 },
      depth: 2000
    },

    // --- Room 3: Dev/Server furniture ---
    devRack: {
      x: 2040, y: 200,
      width: 80, height: 120,
      depth: 10,
      color: 0x37474f
    },
    devWorkstation: {
      x: 2120, y: 380,
      width: 100, height: 50,
      depth: 10,
      color: 0x455a64
    },
    devTerminal: {
      x: 2200, y: 380,
      width: 80, height: 40,
      depth: 10,
      color: 0x546e7a
    },
    devWhiteboard: {
      x: 2380, y: 120,
      width: 120, height: 80,
      depth: 5,
      color: 0xffffff
    },
    devPlants: [
      { x: 1970, y: 250, depth: 5, color: 0x66bb6a },
      { x: 2510, y: 180, depth: 5, color: 0x43a047 }
    ],
    devLight: {
      x: 2240, y: 60,
      depth: 2,
      color: 0x90caf9
    }
  },

  // === Plaque ===
  plaque: {
    x: 1280,
    y: 720 - 36,
    width: 420,
    height: 44
  },

  // === Resource loading rules ===
  forcePng: {
    desk_v2: true
  },

  // === Total assets count ===
  totalAssets: 20,

  // === Camera ===
  camera: {
    startX: 640,
    startY: 360,
    maxX: 2560,
    maxY: 720,
    lerp: 0.08
  },

  // === Room transition markers (visual doorways) ===
  transitions: [
    { from: 'break',  to: 'main',  x: 640,  y: 360, label: '→ 主辦公室' },
    { from: 'main',   to: 'dev',   x: 1920, y: 360, label: '→ 開發區' }
  ]
};