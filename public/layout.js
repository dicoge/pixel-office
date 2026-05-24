// Pixel Office v3 — Complete Layout Configuration
// Three rooms: ☕Pantry(0-400) | 🏢Office(400-2050) | ⭐Manager(2050-2560)
// Proportional scaling: guest sprites 32px@1.2, furniture sized relative to characters

const LAYOUT = {
  game: { width: 2560, height: 720 },

  // Character appearance (matching tool logos/colors)
  toolColors: {
    hermes:   { color: 0xffd700, icon: '⭐', name: 'Hermes',     spriteIdx: 0 },
    gemini:   { color: 0x9c27b0, icon: '🔮', name: 'Gemini',     spriteIdx: 4 },
    manus:    { color: 0xff6b35, icon: '✍️', name: 'Manus',      spriteIdx: 1 },
    codex:    { color: 0x2196f3, icon: '📘', name: 'Codex',      spriteIdx: 3 },
    claude:   { color: 0x4caf50, icon: '🟢', name: 'Claude Code', spriteIdx: 2 },
    opencode: { color: 0xffeb3b, icon: '🔧', name: 'OpenCode',   spriteIdx: 5 },
    openclaw: { color: 0xf44336, icon: '🦞', name: 'OpenClaw',   spriteIdx: 6 }
  },

  // Three rooms
  rooms: {
    pantry:  { x: 0,    width: 400,  label: '☕ 茶水間',  bgColor: 0x3e2723, floor1: 0x8d6e63, floor2: 0xa1887f },
    office:  { x: 400,  width: 1650, label: '🏢 辦公室',  bgFile: 'office_bg.webp' },
    manager: { x: 2050, width: 510,  label: '⭐ 經理室',  bgColor: 0x1a0a2e, floor1: 0x4a0072, floor2: 0x6a1b9a }
  },

  // === Area coordinates (where characters go) ===
  areas: {
    // Pantry
    lounge:       { x: 200, y: 340 },
    pantry_table: { x: 120, y: 420 },

    // Office
    desk_big_left:  { x: 800,  y: 340 },  // Codex
    desk_big_right: { x: 1200, y: 340 },  // OpenClaw
    desk_small_1: { x: 600,  y: 200 },     // Gemini
    desk_small_2: { x: 1400, y: 200 },     // Manus
    desk_small_3: { x: 600,  y: 480 },     // Claude Code
    desk_small_4: { x: 1400, y: 480 },     // OpenCode
    serverroom:  { x: 1800, y: 280 },
    breakroom:   { x: 1200, y: 520 },

    // Manager room
    manager_desk: { x: 2300, y: 340 }
  },

  // === Furniture (proportionally scaled — characters ~38px tall, furniture sized relative) ===
  furniture: {
    // Pantry (room 1)
    counter:    { x: 80,  y: 450, w: 80,  h: 15, depth: 5,  color: 0x8d6e63 },
    sink:       { x: 80,  y: 440, w: 30,  h: 8,  depth: 6,  color: 0xbdbdbd },
    fridge:     { x: 330, y: 440, w: 35,  h: 50, depth: 5,  color: 0xe0e0e0 },
    pantryTable:{ x: 200, y: 370, w: 60,  h: 25, depth: 5,  color: 0x6d4c41 },
    pantrySofa: { x: 250, y: 270, w: 90,  h: 30, depth: 5,  color: 0x8b5e3c },
    pantryLamp: { x: 160, y: 250, w: 6,   h: 25, depth: 5,  color: 0xffd54f },

    // Office — Big desks (Codex & OpenClaw)
    bigDeskLeft:  { x: 800,  y: 340, w: 90, h: 35, depth: 100, color: 0x1565c0, accent: 0x1976d2 },
    bigDeskRight: { x: 1200, y: 340, w: 90, h: 35, depth: 100, color: 0xc62828, accent: 0xd32f2f },

    // Office — Small desks
    smallDeskTL: { x: 600,  y: 200, w: 50, h: 25, depth: 50, color: 0x6a1b9a },  // Gemini
    smallDeskTR: { x: 1400, y: 200, w: 50, h: 25, depth: 50, color: 0xe65100 },  // Manus
    smallDeskBL: { x: 600,  y: 480, w: 50, h: 25, depth: 50, color: 0x2e7d32 },  // Claude
    smallDeskBR: { x: 1400, y: 480, w: 50, h: 25, depth: 50, color: 0xf9a825 },  // OpenCode

    // Office — Equipment
    serverRack: { x: 1770, y: 210, w: 50, h: 80, depth: 5, color: 0x37474f },
    coffeeMachine: {
      x: 1600, y: 490, origin: { x: 0.5, y: 0.5 }, depth: 99,
      scale: 0.35  // 230px frame → ~80px visible — proportional
    },
    officeSofa: { x: 1100, y: 500, w: 100, h: 25, depth: 5, color: 0x6d4c41 },
    officePlant1: { x: 1750, y: 100, depth: 5, scale: 0.3 },
    officePlant2: { x: 550,  y: 100, depth: 5, scale: 0.3 },
    officeCat: { x: 1150, y: 550, depth: 2000, scale: 0.3 },

    // Manager room
    managerDesk:  { x: 2300, y: 340, w: 70,  h: 30, depth: 100, color: 0x5d4037 },
    managerChair: { x: 2220, y: 350, w: 25,  h: 30, depth: 50,  color: 0x3e2723 },
    managerBookshelf: { x: 2480, y: 200, w: 40, h: 100, depth: 5, color: 0x4e342e },
    managerWindow: { x: 2100, y: 100, w: 60, h: 80, depth: 2, color: 0x1a237e },
    managerLamp:  { x: 2450, y: 320, w: 8,  h: 30, depth: 5, color: 0xffd700 }
  },

  // === Character initial positions ===
  members: [
    { id: 'hermes',   area: 'manager_desk',  offset: {x: 0, y: 10} },
    { id: 'codex',    area: 'desk_big_left',  offset: {x: -10, y: -5} },
    { id: 'openclaw', area: 'desk_big_right', offset: {x: 10, y: -5} },
    { id: 'gemini',   area: 'desk_small_1',   offset: {x: -5, y: -5} },
    { id: 'manus',    area: 'desk_small_2',   offset: {x: 5, y: -5} },
    { id: 'claude',   area: 'desk_small_3',   offset: {x: -5, y: 5} },
    { id: 'opencode', area: 'desk_small_4',   offset: {x: 5, y: 5} }
  ],

  // === Plaque ===
  plaque: { x: 1225, y: 720 - 36, width: 300, height: 36 },

  // === Asset tracking ===
  totalAssets: 10,

  forcePng: {},

  // === Camera ===
  camera: { lerp: 0.08 }
};