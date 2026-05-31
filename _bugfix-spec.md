# Bug Fix: Seed workers + empty company switch

## Problem 1: Seed workers don't match MEMBERS
After deploy, server.js seeds 7 workers with names: `OpenClaw, Codex, OpenCode, DungeonBot, PixelCoder, ServerBot, AgentSmith`
But MEMBERS in game.js expects: `hermes, openclaw, codex, gemini, manus, claude, opencode`
Only OpenClaw, Codex, OpenCode match. Hermes, Gemini, Manus, Claude have no workers => no mood bubbles.

### Fix: Update seed in server.js (lines 190-198)
Change from:
```
workerStmt.run('worker-1', 'OpenClaw', ...);
workerStmt.run('worker-2', 'Codex', ...);
workerStmt.run('worker-3', 'OpenCode', ...);
workerStmt.run('worker-4', 'DungeonBot', ...);
workerStmt.run('worker-5', 'PixelCoder', ...);
workerStmt.run('worker-6', 'ServerBot', ...);
workerStmt.run('worker-7', 'AgentSmith', ...);
```
To (match MEMBERS exactly):
```
workerStmt.run('worker-1', 'Hermes', 'active', 'dept-pixeloffice', 'company-a', 'MiniPc');
workerStmt.run('worker-2', 'OpenClaw', 'active', 'dept-dungeon', 'company-a', 'MiniPc');
workerStmt.run('worker-3', 'Codex', 'active', 'dept-stock', 'company-a', 'MiniPc');
workerStmt.run('worker-4', 'Gemini', 'idle', null, 'company-a', 'MiniPc');
workerStmt.run('worker-5', 'Manus', 'idle', null, 'company-a', 'MiniPc');
workerStmt.run('worker-6', 'Claude Code', 'idle', null, 'company-a', 'MiniPc');
workerStmt.run('worker-7', 'OpenCode', 'idle', null, 'company-a', 'MiniPc');
```
Note: "Claude Code" has a space. Keep the id consistent as worker-1 through worker-7.
Also update the department seeds for company-b (MacBook) if applicable.

## Problem 2: Switching to empty company shows stale data
When user switches to MacBook (company-b) but no workers registered yet, API returns [].
In game.js fetchStatus():
```
if (!Array.isArray(data) || !data.length) return;
```
This early return keeps PREVIOUS company's data visible.

### Fix: Add mood clearing logic before the early return
```javascript
if (!Array.isArray(data) || !data.length) {
  // Clear all member moods when switching to company with no workers
  if (window.memberStates) {
    MEMBERS.forEach(m => { window.memberStates[m.id] = 'idle'; window.memberMoods[m.id] = ''; });
    renderMemberStatus();
  }
  return;
}
```

## Files to modify:
1. src/server.js - update seed workers
2. public/game.js - add mood clearing when empty data

## ⛔ Do NOT touch:
- HTML structure, CSS, login/logout logic
- Phaser canvas drawing (areas, desks, characters, backgrounds)
- MEMBERS array, TOOL_COLORS, or character definitions
- API endpoints other than seed data

## Verify:
```bash
cd /home/dicoge/pixel-office
node -e "try{new Function(require('fs').readFileSync('public/game.js','utf8'));console.log('OK game.js')}catch(e){console.log('FAIL',e.message)}"
node -e "try{require('./src/server.js');console.log('OK server.js')}catch(e){console.log('FAIL',e.message)}"
```
