// Pixel Office v4 — Complete Layout for office_bg.webp
// Uses pre-drawn background image, only overlays characters + animations

const LAYOUT = {
  game: { width: 1280, height: 720 },

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
    office: { x: 0, width: 1280, label: '🏢 Pixel Office', bgColor: 0xd4a574 }
  },

  // === Area coordinates — matching office_bg.webp furniture positions ===
  areas: {
    lounge:        { x: 1100, y: 500 },   // sofa bottom-right
    desk_big_left: { x: 500,  y: 450 },   // large table centre-left
    desk_big_right:{ x: 750,  y: 450 },   // large table centre-right
    desk_small_1:  { x: 200,  y: 380 },   // small table upper-left
    desk_small_2:  { x: 320,  y: 380 },   // small table upper-left
    desk_small_3:  { x: 900,  y: 480 },   // right side tables
    desk_small_4:  { x: 1000, y: 480 },   // right side tables
    breakroom:     { x: 1100, y: 500 },
    manager_desk:  { x: 640,  y: 340 }    // centre of room (central table)
  },

  // === Overlay furniture (animated elements only, rest is in bg) ===
  furniture: {
    coffeeMachine: { x: 150, y: 250, origin: { x: 0.5, y: 0.5 }, depth: 10, scale: 0.45 }
  },

  // === Member positions ===
  members: [
    { id: 'hermes',   area: 'manager_desk',  offset: {x: 0, y: 10} },
    { id: 'codex',    area: 'desk_big_left',  offset: {x: -30, y: -5} },
    { id: 'openclaw', area: 'desk_big_right', offset: {x: 30, y: -5} },
    { id: 'gemini',   area: 'desk_small_1',   offset: {x: 0, y: 10} },
    { id: 'manus',    area: 'desk_small_2',   offset: {x: 0, y: 10} },
    { id: 'claude',   area: 'desk_small_3',   offset: {x: 0, y: 10} },
    { id: 'opencode', area: 'desk_small_4',   offset: {x: 0, y: 10} }
  ],

  // === Plaque ===
  plaque: { x: 640, y: 48, width: 260, height: 28 },

  totalAssets: 10,
  forcePng: {}
};