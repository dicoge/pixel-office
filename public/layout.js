// Pixel Office v3 — Complete Layout Configuration
// Three rooms: ☕Pantry(0-400) | 🏢Office(400-2050) | ⭐Manager(2050-2560)
// Proportional scaling: guest sprites 32px@1.2, furniture sized relative to characters

const LAYOUT = {
  game: { width: 1280, height: 720 },

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

  rooms: {
    office:  { x: 0,    width: 1280, label: '🏢 Pixel Office', bgColor: 0xd4a574 }
  },

  // === Area coordinates (where characters go) ===
  areas: {
    // Single room areas
    lounge:       { x: 200, y: 580 },     // sofa area
    desk_big_left:  { x: 300,  y: 200 },  // Codex
    desk_big_right: { x: 900, y: 200 },   // OpenClaw
    desk_small_1: { x: 200,  y: 440 },     // Gemini
    desk_small_2: { x: 350, y: 440 },     // Manus
    desk_small_3: { x: 1050, y: 440 },    // Claude Code
    desk_small_4: { x: 1200, y: 440 },    // OpenCode
    serverroom:  { x: 1800, y: 280 },
    breakroom:   { x: 600, y: 600 },
    manager_desk: { x: 1000, y: 100 }
  },

  // === Furniture (proportionally scaled — characters ~38px tall, furniture sized relative) ===
  furniture: {
    // Star Office single room furniture
    bigDeskLeft:  { x: 300,  y: 200, w: 100, h: 30, depth: 100, color: 0x4e3523, accent: 0x795548 },
    bigDeskRight: { x: 900, y: 200, w: 100, h: 30, depth: 100, color: 0x4e3523, accent: 0x795548 },
    smallDeskTL: { x: 200,  y: 440, w: 50, h: 20, depth: 50, color: 0x4e3523 },  // Gemini
    smallDeskTR: { x: 350, y: 440, w: 50, h: 20, depth: 50, color: 0x4e3523 },  // Manus
    smallDeskBL: { x: 1050,  y: 440, w: 50, h: 20, depth: 50, color: 0x4e3523 },  // Claude
    smallDeskBR: { x: 1200, y: 440, w: 50, h: 20, depth: 50, color: 0x4e3523 },  // OpenCode
    managerDesk:  { x: 1000, y: 100, w: 100, h: 40, depth: 100, color: 0x5d4037 },
    managerChair: { x: 1060, y: 130, w: 25,  h: 30, depth: 50,  color: 0x3e2723 },
    coffeeMachine: { x: 250, y: 300, origin: { x: 0.5, y: 0.5 }, depth: 99, scale: 0.5 },
    officeSofa: { x: 500, y: 600, w: 150, h: 40, depth: 5, color: 0xd32f2f },
    officePlant1: { x: 1040, y: 200, depth: 5, scale: 0.6 },
    officeCat: { x: 200, y: 600, depth: 2000, scale: 0.5 }
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
  plaque: { x: 640, y: 700, width: 300, height: 36 },

  // === Asset tracking ===
  totalAssets: 10,

  forcePng: {},

  // === Camera ===
  camera: { lerp: 0.08 }
};