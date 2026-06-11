# Spec: Automated Tests for Pixel Office Backend API

## Goal
Add comprehensive automated tests for the Express backend API (`src/server.js`) to validate all endpoints before deployment.

## Scope
- Test all API endpoints with proper auth (JWT + API Key)
- Test the `parseCommand()` pure function
- Use in-memory SQLite (no real data/tasks.db touched)
- Do NOT modify src/server.js or src/db.js

## Test Framework
- **Mocha** + **supertest**
- In-memory sql.js Database (reuse public/sql-wasm.wasm)
- Test files go in `test/`

## Test Files

### 1. `package.json` — Add devDependencies
```
"devDependencies": {
  "mocha": "^10.0.0",
  "supertest": "^6.3.0"
}
```
Scripts: `"test": "mocha --timeout 10000"`

### 2. `test/setup.js` — Test app builder
Create a fresh Express app with:
- In-memory sql.js database (same schema as server.js)
- All route handlers replicated (auth, workers, tasks, departments, messages, stats, companies, activities)
- Seeded data: 2 companies, 3 departments, 14 workers (7 per company), admin user
- Config: JWT_SECRET=`pixel-office-secret-change-me`, API_KEY=`s3cr3t_t4sk_k3y_2026`, ADMIN_USERNAME=`dicoge`, password `Zxc999871`
- Export `app`, `db`, `VALID_API_KEY`, `getAuthToken()`, `getCompanyHeader()`

### 3. `test/test-auth.js` — Auth API
- POST /auth/login with admin credentials → 200 + token
- POST /auth/login with wrong password → 401
- POST /auth/login missing fields → 400
- POST /auth/register → 403 (admin configured)
- POST /auth/login non-existent user → 401

### 4. `test/test-workers.js` — Worker API (API Key protected)
- POST /api/workers/register → 201 with valid key, 401 without
- POST /api/workers/ping/:id → update status + mood
- POST /api/workers/:id/state → update state
- POST /api/workers/batch-status → batch update
- GET /api/workers/status → list with departments
- GET /api/workers/status?company_id=company-b → filter
- POST /api/workers/:id/avatar → upload avatar (base64 PNG)
- GET /api/workers/:id/avatar → retrieve avatar
- NOTE: GET /api/workers/status does NOT require API key (it's before authMiddleware in route registration)

### 5. `test/test-tasks.js` — Tasks API (JWT protected)
- POST /api/tasks + auth → 201
- POST /api/tasks without auth → 401
- GET /api/tasks → list
- GET /api/tasks?status=pending → filter
- GET /api/tasks/:id → single task
- PATCH /api/tasks/:id → update
- DELETE /api/tasks/:id → delete
- Validation: missing fields → 400

### 6. `test/test-departments.js` — Departments API (JWT protected)
- GET /api/departments → list
- POST /api/departments → create
- PATCH /api/departments/:id → update
- DELETE /api/departments/:id → delete
- Validation: missing fields → 400

### 7. `test/test-messages.js` — Chat API (JWT protected)
- POST /api/messages + auth → 201
- GET /api/messages?room_type=X&room_id=Y → history
- POST /api/hermes-reply + auth → 201
- Validation: missing fields → 400

### 8. `test/test-stats.js` — Stats & Companies (JWT protected)
- GET /api/stats + auth → 200 with aggregated data
- GET /api/companies + auth → 200 with company list
- Both without auth → 401

### 9. `test/test-parseCommand.js` — Pure function tests
No server needed — test parseCommand() directly:
- `派 Hermes 去修bug` → { type: 'assign', worker: 'Hermes', task: '修bug' }
- `查看狀態` → { type: 'query', target: '狀態' }
- `狀態` → { type: 'stats' }
- `worker列表` → { type: 'list_workers' }
- `任務列表` → { type: 'list_tasks' }
- Empty/null input → null
- Non-command text → null

## ⚠️ Key Constraints
1. The server auto-starts (`start()` at bottom of server.js) — tests must recreate the Express app without calling `server.listen()`
2. Rate limiting is on `/api/` — ok since we do <300 requests per test
3. WebSocket server (`wss`) should not interfere with HTTP tests
4. `initDatabase()` must be replicated in tests to create schema + seed data
5. The `sql-wasm.wasm` binary is at `public/sql-wasm.wasm`
6. Admin bcrypt hash must match password `Zxc999871`

## Verification
```bash
cd /home/dicoge/pixel-office && npm test
```
All tests pass with no failures.