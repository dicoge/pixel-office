// Pixel Office — Autonomous Behavior Engine
// Each worker gets personality-driven behaviors when idle or slacking

const BEHAVIORS = {
  hermes: {
    idle: [
      { action: 'wander', area: 'center_desk', duration: 5000 },
      { action: 'check_coffee', area: 'coffee_machine', duration: 8000 },
      { action: 'return_desk', area: 'center_desk', duration: 10000 }
    ],
    slacking: [
      { action: 'walk_bookshelf', area: 'bookshelf', duration: 6000 },
      { action: 'browse', area: 'bookshelf', duration: 12000 },
      { action: 'wander_hall', area: 'hall_left', duration: 5000 }
    ]
  },
  gemini: {
    idle: [
      { action: 'research', area: 'desk_col1_top', duration: 15000 },
      { action: 'check_bookshelf', area: 'bookshelf', duration: 8000 },
      { action: 'return_desk', area: 'desk_col1_top', duration: 10000 }
    ],
    slacking: [
      { action: 'browse_books', area: 'bookshelf', duration: 15000 },
      { action: 'daydream', area: 'desk_col1_top', duration: 10000 }
    ]
  },
  manus: {
    idle: [
      { action: 'design', area: 'desk_col1_mid', duration: 15000 },
      { action: 'coffee_break', area: 'coffee_machine', duration: 8000 },
      { action: 'return_desk', area: 'desk_col1_mid', duration: 8000 }
    ],
    slacking: [
      { action: 'doodle', area: 'desk_col1_mid', duration: 12000 },
      { action: 'sofa_chill', area: 'sofa', duration: 18000 }
    ]
  },
  codex: {
    idle: [
      { action: 'architect', area: 'desk_col1_bot', duration: 15000 },
      { action: 'stretch', area: 'hall_left', duration: 6000 },
      { action: 'return_desk', area: 'desk_col1_bot', duration: 10000 }
    ],
    slacking: [
      { action: 'stare_ceiling', area: 'desk_col1_bot', duration: 10000 },
      { action: 'walk_around', area: 'cross_mid', duration: 8000 }
    ]
  },
  claude: {
    idle: [
      { action: 'code', area: 'desk_col2_top', duration: 15000 },
      { action: 'coffee', area: 'coffee_machine', duration: 8000 },
      { action: 'return_desk', area: 'desk_col2_top', duration: 10000 }
    ],
    slacking: [
      { action: 'plant_watch', area: 'plant', duration: 10000 },
      { action: 'sofa_sleep', area: 'sofa', duration: 20000 }
    ]
  },
  opencode: {
    idle: [
      { action: 'optimize', area: 'desk_col2_mid', duration: 15000 },
      { action: 'coffee', area: 'coffee_machine', duration: 8000 },
      { action: 'return_desk', area: 'desk_col2_mid', duration: 10000 }
    ],
    slacking: [
      { action: 'lounge', area: 'lounge', duration: 15000 },
      { action: 'wander_right', area: 'hall_right', duration: 8000 }
    ]
  },
  openclaw: {
    idle: [
      { action: 'sit_sofa', area: 'sofa', duration: 15000 },
      { action: 'stretch', area: 'hall_right', duration: 5000 },
      { action: 'return_sofa', area: 'sofa', duration: 10000 }
    ],
    slacking: [
      { action: 'play_plant', area: 'plant', duration: 10000 },
      { action: 'sleep_sofa', area: 'sofa', duration: 20000 },
      { action: 'test_halls', area: 'hall_right', duration: 8000 }
    ]
  }
};

// Default behavior for any member not explicitly defined
const DEFAULT_BEHAVIOR = {
  idle: [
    { action: 'wander', area: 'center_desk', duration: 10000 },
    { action: 'coffee', area: 'coffee_machine', duration: 8000 },
    { action: 'return', area: 'center_desk', duration: 10000 }
  ],
  slacking: [
    { action: 'wander', area: 'hall_left', duration: 8000 },
    { action: 'lounge', area: 'lounge', duration: 15000 }
  ]
};

// Behavior scheduler — runs every ~5 seconds
let behaviorTimer = 0;
const BEHAVIOR_INTERVAL = 5000; // ms between behavior checks

function tickBehaviors(time) {
  if (!window.memberMovement) return;

  MEMBERS.forEach(m => {
    const state = window.memberStates[m.id];
    if (state !== 'idle' && state !== 'slacking') return;
    if (m.id === 'hermes') return; // Hermes stays at center desk

    const mv = window.memberMovement[m.id];
    if (!mv) return;

    // Skip if already moving or arrived but recently arrived
    if (mv.state === 'walking') return;

    // If idle (not moving and not recently arrived), pick a behavior
    if (mv.state === 'idle' || mv.state === 'arriving') {
      // Reset to idle after arriving
      if (mv.state === 'arriving') {
        mv.state = 'idle';
        // Don't immediately trigger new behavior — wait for next tick
        return;
      }

      // Pick a random behavior based on personality
      const personality = BEHAVIORS[m.id] || DEFAULT_BEHAVIOR;
      const behaviors = personality[state] || personality.idle || DEFAULT_BEHAVIOR.idle;
      const choice = behaviors[Math.floor(Math.random() * behaviors.length)];

      if (choice && choice.area) {
        // Convert area name to NAV_POINT if needed
        const navId = window.AREA_TO_NAV[choice.area] ||
          (NAV_POINTS[choice.area] ? choice.area : null);
        if (navId) {
          navigateTo(m.id, navId);
        }
      }
    }
  });
}

// Export
window.BEHAVIORS = BEHAVIORS;
window.tickBehaviors = tickBehaviors;
window.BEHAVIOR_INTERVAL = BEHAVIOR_INTERVAL;

console.log('🎭 behaviors.js loaded — autonomous behavior engine ready');