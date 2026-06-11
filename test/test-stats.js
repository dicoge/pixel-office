const assert = require('assert');
const request = require('supertest');
const createApp = require('./setup');

describe('Stats & Companies API', () => {
  let app, getAuthToken;

  before(async () => {
    const ctx = await createApp();
    app = ctx.app;
    getAuthToken = ctx.getAuthToken;
  });

  it('GET /api/stats + auth → 200 with aggregated data', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', `Bearer ${getAuthToken()}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.tasks !== undefined);
    assert.ok(res.body.workers !== undefined);
    assert.ok(res.body.total_workers !== undefined);
    assert.ok(res.body.recent_tasks !== undefined);
    assert.ok(res.body.audit_logs !== undefined);
    assert.equal(res.body.total_workers, 7);
  });

  it('GET /api/companies + auth → 200 with company list', async () => {
    const res = await request(app)
      .get('/api/companies')
      .set('Authorization', `Bearer ${getAuthToken()}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.companies);
    assert.ok(Array.isArray(res.body.companies));
    assert.equal(res.body.companies.length, 2);
  });

  it('GET /api/stats without auth → 401', async () => {
    const res = await request(app).get('/api/stats');
    assert.equal(res.status, 401);
  });

  it('GET /api/companies without auth → 401', async () => {
    const res = await request(app).get('/api/companies');
    assert.equal(res.status, 401);
  });
});
