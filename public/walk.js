// Pixel Office — Walk Animation System
// Direction detection + tween-based walk animation (no walk spritesheets needed)

// Determine facing direction from a movement vector
function getFacing(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'down' : 'up';
  }
}

// Play walk animation on a sprite using tweens (bounce + bob effect)
// Since we don't have walk spritesheets, we simulate walking with a subtle bobbing tween
let walkTweens = {};  // { memberId: tween }

function playWalkAnim(memberId, direction) {
  const sprite = window.memberSprites && window.memberSprites[memberId];
  if (!sprite || memberId === 'hermes') return;

  // Kill any existing walk tween
  if (walkTweens[memberId]) {
    walkTweens[memberId].stop();
    walkTweens[memberId] = null;
  }

  // Restore scale and rotation first
  sprite.setScale(1.8);
  sprite.setAngle(0);

  // Create a subtle bob/walk animation
  // Bob up/down slightly and tilt based on direction
  const scene = sprite.scene;
  if (!scene) return;

  // Set a subtle bounce tween to simulate walking
  walkTweens[memberId] = scene.tweens.add({
    targets: sprite,
    scaleY: { from: 1.8, to: 1.7 },
    scaleX: { from: 1.8, to: 1.85 },
    duration: 120,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  // Store current facing direction on the sprite
  sprite.setData('facing', direction);
  // Flip sprite based on direction
  if (direction === 'left') {
    sprite.setFlipX(true);
  } else if (direction === 'right') {
    sprite.setFlipX(false);
  }
  // For up/down, no flip needed
}

// Play idle animation (stop walking, restore normal appearance)
function playIdleAnim(memberId) {
  const sprite = window.memberSprites && window.memberSprites[memberId];
  if (!sprite || memberId === 'hermes') return;

  // Kill walk tween
  if (walkTweens[memberId]) {
    walkTweens[memberId].stop();
    walkTweens[memberId] = null;
  }

  // Restore to normal idle state
  sprite.setScale(1.8);
  sprite.setAngle(0);

  // Get the guest index for this member
  const guestIdx = GUEST_SPRITE_INDEX[memberId];
  if (guestIdx) {
    const animKey = 'guest_idle_' + guestIdx;
    if (sprite.scene && sprite.scene.anims.exists(animKey)) {
      sprite.play(animKey, true);
    }
  }
}

// Clean up walk tweens (call on scene shutdown)
function stopAllWalkAnimations() {
  for (const id of Object.keys(walkTweens)) {
    if (walkTweens[id]) {
      walkTweens[id].stop();
    }
  }
  walkTweens = {};
}

// Export
window.getFacing = getFacing;
window.playWalkAnim = playWalkAnim;
window.playIdleAnim = playIdleAnim;
window.stopAllWalkAnimations = stopAllWalkAnimations;

console.log('🚶 walk.js loaded — walk animation system ready');