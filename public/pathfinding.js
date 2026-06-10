// Pixel Office — NAV_POINTS Navigation Graph + A* Pathfinding
// Defines walkable areas as a graph of waypoints with connections

const NAV_POINTS = {
  // === 辦公桌區域 ===
  desk_col1_top:    { x: 160, y: 280, label: 'Gemini 桌', connections: ['hall_left', 'cross_mid'] },
  desk_col1_mid:    { x: 160, y: 410, label: 'Manus 桌', connections: ['hall_left', 'cross_mid'] },
  desk_col1_bot:    { x: 160, y: 540, label: 'Codex 桌', connections: ['hall_left', 'cross_bot'] },
  desk_col2_top:    { x: 270, y: 280, label: 'Claude 桌', connections: ['hall_mid', 'cross_mid'] },
  desk_col2_mid:    { x: 270, y: 410, label: 'OpenCode 桌', connections: ['hall_mid', 'cross_mid'] },
  desk_col2_bot:    { x: 270, y: 540, label: 'OpenCode 桌', connections: ['hall_mid', 'cross_bot'] },

  // === 公共區域 ===
  center_desk:      { x: 490, y: 360, label: '中央桌', connections: ['cross_mid', 'hall_mid', 'hall_left'] },
  coffee_machine:   { x: 235, y: 190, label: '咖啡機', connections: ['hall_left'] },
  bookshelf:        { x: 120, y: 250, label: '書架', connections: ['hall_left'] },
  sofa:             { x: 1092, y: 270, label: '沙發', connections: ['hall_right'] },
  plant:            { x: 1090, y: 200, label: '盆栽', connections: ['hall_right'] },
  lounge:           { x: 1100, y: 500, label: '休息區', connections: ['hall_right', 'cross_bot'] },

  // === 走廊交叉點 ===
  hall_left:        { x: 120, y: 360, label: '左走廊', connections: ['coffee_machine', 'desk_col1_top', 'desk_col1_mid', 'desk_col1_bot', 'cross_mid'] },
  hall_mid:         { x: 300, y: 360, label: '中走廊', connections: ['desk_col2_top', 'desk_col2_mid', 'desk_col2_bot', 'cross_mid', 'cross_bot'] },
  hall_right:       { x: 1000, y: 360, label: '右走廊', connections: ['sofa', 'plant', 'lounge', 'cross_mid', 'cross_bot'] },
  cross_mid:        { x: 400, y: 360, label: '十字中', connections: ['hall_left', 'hall_mid', 'hall_right', 'center_desk'] },
  cross_bot:        { x: 400, y: 500, label: '十字下', connections: ['hall_mid', 'hall_right', 'lounge', 'desk_col1_bot', 'desk_col2_bot'] }
};

// Map member IDs to their default desk NAV_POINT
const MEMBER_HOME_NAV = {
  hermes:   'center_desk',
  gemini:   'desk_col1_top',
  manus:    'desk_col1_mid',
  codex:    'desk_col1_bot',
  claude:   'desk_col2_top',
  opencode: 'desk_col2_mid',
  openclaw: 'sofa'
};

// Map AREA names (from layout.js) to NAV_POINT IDs
const AREA_TO_NAV = {
  col1_top: 'desk_col1_top',
  col1_mid: 'desk_col1_mid',
  col1_bot: 'desk_col1_bot',
  col2_top: 'desk_col2_top',
  col2_mid: 'desk_col2_mid',
  col2_bot: 'desk_col2_bot',
  center:   'center_desk',
  lounge:   'lounge',
  sofa:     'sofa'
};

// Find the closest NAV_POINT to a given (x, y) position
function findClosestNavPoint(x, y) {
  let bestId = null;
  let bestDist = Infinity;
  for (const [id, pt] of Object.entries(NAV_POINTS)) {
    const dx = pt.x - x;
    const dy = pt.y - y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      bestId = id;
    }
  }
  return bestId;
}

// Get nearest NAV_POINT for a member (based on current position or home desk)
function getMemberNavPoint(memberId) {
  // Try home desk first
  if (MEMBER_HOME_NAV[memberId]) return MEMBER_HOME_NAV[memberId];
  // Fall back to closest from current position
  const sp = window.memberSprites && window.memberSprites[memberId];
  if (sp) return findClosestNavPoint(sp.x, sp.y);
  return 'center_desk';
}

// Convert AREA name to NAV_POINT ID
function areaToNavPoint(areaName) {
  return AREA_TO_NAV[areaName] || findClosestNavPoint(0, 0);
}

// ===== A* Pathfinding =====

function heuristic(aId, bId) {
  const a = NAV_POINTS[aId];
  const b = NAV_POINTS[bId];
  if (!a || !b) return Infinity;
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); // Manhattan distance
}

function getNeighbors(nodeId) {
  const node = NAV_POINTS[nodeId];
  if (!node) return [];
  return node.connections.filter(id => NAV_POINTS[id]);
}

function reconstructPath(cameFrom, current) {
  const path = [current];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current);
    path.unshift(current);
  }
  return path;
}

function findPath(fromId, toId) {
  if (!NAV_POINTS[fromId] || !NAV_POINTS[toId]) {
    console.warn(`findPath: invalid waypoint IDs: ${fromId} → ${toId}`);
    return [];
  }
  if (fromId === toId) return [fromId];

  const openSet = new Set([fromId]);
  const cameFrom = new Map();

  const gScore = { [fromId]: 0 };
  const fScore = { [fromId]: heuristic(fromId, toId) };

  while (openSet.size > 0) {
    // Find node in openSet with lowest fScore
    let current = null;
    let bestF = Infinity;
    for (const id of openSet) {
      const f = fScore[id] !== undefined ? fScore[id] : Infinity;
      if (f < bestF) {
        bestF = f;
        current = id;
      }
    }

    if (current === toId) {
      return reconstructPath(cameFrom, current);
    }

    openSet.delete(current);

    for (const neighbor of getNeighbors(current)) {
      const tentativeG = (gScore[current] !== undefined ? gScore[current] : Infinity) + 1;
      if (tentativeG < (gScore[neighbor] !== undefined ? gScore[neighbor] : Infinity)) {
        cameFrom.set(neighbor, current);
        gScore[neighbor] = tentativeG;
        fScore[neighbor] = tentativeG + heuristic(neighbor, toId);
        openSet.add(neighbor);
      }
    }
  }

  console.warn(`findPath: no path found from ${fromId} to ${toId}`);
  return [];
}

// Utility: compute destination {x, y} from a NAV_POINT ID with optional offset
function getNavPointPosition(navId, offsetX, offsetY) {
  const pt = NAV_POINTS[navId];
  if (!pt) return null;
  return {
    x: pt.x + (offsetX || 0),
    y: pt.y + (offsetY || 0)
  };
}

// Export to window for access from game.js and other scripts
window.NAV_POINTS = NAV_POINTS;
window.MEMBER_HOME_NAV = MEMBER_HOME_NAV;
window.AREA_TO_NAV = AREA_TO_NAV;
window.findPath = findPath;
window.findClosestNavPoint = findClosestNavPoint;
window.getMemberNavPoint = getMemberNavPoint;
window.areaToNavPoint = areaToNavPoint;
window.getNavPointPosition = getNavPointPosition;

console.log('🗺️ pathfinding.js loaded — NAV_POINTS + A* ready');