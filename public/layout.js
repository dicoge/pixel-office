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
    // Single room areas — matching office_bg furniture positions
    lounge:       { x: 650, y: 530 },     // sofa area (center-left of room)
    desk_big_left:  { x: 830,  y: 350 },  // Codex - main desk right side
    desk_big_right: { x: 950, y: 350 },   // OpenClaw - main desk right side
    desk_small_1: { x: 330,  y: 360 },     // Gemini - left desk
    desk_small_2: { x: 450, y: 360 },     // Manus - left desk
    desk_small_3: { x: 1050, y: 300 },    // Claude Code - far right desk
    desk_small_4: { x: 1150, y: 300 },    // OpenCode - far right desk
    breakroom:   { x: 650, y: 530 },
    manager_desk: { x: 900, y: 400 }
  },

  // === Furniture (minimal — background has most furniture) ===
  furniture: {
    // Animated/interactive elements only (rest is in office_bg)
    coffeeMachine: { x: 250, y: 300, origin: { x: 0.5, y: 0.5 }, depth: 99, scale: 0.5 },
    officeCat: { x: 1060, y: 475, depth: 10, scale: 0.5 },
    officePlant1: { x: 1060, y: 200, depth: 5, scale: 0.5 }
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