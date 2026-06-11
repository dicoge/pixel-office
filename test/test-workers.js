const assert = require('assert');
const request = require('supertest');
const createApp = require('./setup');

describe('Workers API', () => {
  let app, VALID_API_KEY;
  let workerId;

  before(async () => {
    const ctx = await createApp();
    app = ctx.app;
    VALID_API_KEY = ctx.VALID_API_KEY;
  });

  it('POST /api/workers/register → 201 with valid key', async () => {
    const res = await request(app)
      .post('/api/workers/register')
      .set('x-api-key', VALID_API_KEY)
      .send({ name: 'TestWorker' });
    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    assert.equal(res.body.name, 'TestWorker');
    workerId = res.body.id;
  });

  it('POST /api/workers/register → 401 without key', async () => {
    const res = await request(app)
      .post('/api/workers/register')
      .send({ name: 'NoKeyWorker' });
    assert.equal(res.status, 401);
  });

  it('POST /api/workers/ping/:id → update status + mood', async () => {
    const res = await request(app)
      .post(`/api/workers/ping/${workerId}`)
      .set('x-api-key', VALID_API_KEY)
      .send({ status: 'busy', mood: 'working hard' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'busy');
    assert.equal(res.body.mood, 'working hard');
  });

  it('POST /api/workers/:id/state → update state', async () => {
    const res = await request(app)
      .post(`/api/workers/${workerId}/state`)
      .set('x-api-key', VALID_API_KEY)
      .send({ status: 'slacking' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'slacking');
  });

  it('POST /api/workers/batch-status → batch update', async () => {
    const regRes = await request(app)
      .post('/api/workers/register')
      .set('x-api-key', VALID_API_KEY)
      .send({ name: 'BatchWorker' });
    const batchWorkerId = regRes.body.id;

    const res = await request(app)
      .post('/api/workers/batch-status')
      .set('x-api-key', VALID_API_KEY)
      .send({ updates: [{ id: workerId, status: 'active' }, { id: batchWorkerId, status: 'busy' }] });
    assert.equal(res.status, 200);
    assert.equal(res.body.updated, 2);
  });

  it('GET /api/workers/status → list with departments', async () => {
    const res = await request(app).get('/api/workers/status');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 7);
    const hermes = res.body.find(w => w.name === 'Hermes');
    assert.ok(hermes);
  });

  it('GET /api/workers/status?company_id=company-b → filter', async () => {
    const res = await request(app)
      .get('/api/workers/status')
      .query({ company_id: 'company-b' });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 7);
    res.body.forEach(w => assert.equal(w.company_id, 'company-b'));
  });

  it('POST /api/workers/:id/avatar → upload avatar (base64 PNG)', async () => {
    const res = await request(app)
      .post(`/api/workers/${workerId}/avatar`)
      .set('x-api-key', VALID_API_KEY)
      .send({ avatar: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  it('GET /api/workers/:id/avatar → retrieve avatar', async () => {
    const res = await request(app).get(`/api/workers/${workerId}/avatar`);
    assert.equal(res.status, 200);
  });

  it('POST /api/workers/ping/:id with invalid status defaults to active', async () => {
    const res = await request(app)
      .post(`/api/workers/ping/${workerId}`)
      .set('x-api-key', VALID_API_KEY)
      .send({ status: 'nonexistent_status_xyz' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'active');
  });

  it('POST /api/workers/:id/state with invalid status defaults to idle', async () => {
    const res = await request(app)
      .post(`/api/workers/${workerId}/state`)
      .set('x-api-key', VALID_API_KEY)
      .send({ status: 'bogus_status_123' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'idle');
  });

  it('Status round trip: idle → busy → idle', async () => {
    const regRes = await request(app)
      .post('/api/workers/register')
      .set('x-api-key', VALID_API_KEY)
      .send({ name: 'RoundTripWorker' });
    assert.equal(regRes.status, 201);
    const rtId = regRes.body.id;

    const idleRes = await request(app)
      .post(`/api/workers/${rtId}/state`)
      .set('x-api-key', VALID_API_KEY)
      .send({ status: 'idle' });
    assert.equal(idleRes.status, 200);
    assert.equal(idleRes.body.status, 'idle');

    const busyRes = await request(app)
      .post(`/api/workers/ping/${rtId}`)
      .set('x-api-key', VALID_API_KEY)
      .send({ status: 'busy' });
    assert.equal(busyRes.status, 200);
    assert.equal(busyRes.body.status, 'busy');

    const backRes = await request(app)
      .post(`/api/workers/ping/${rtId}`)
      .set('x-api-key', VALID_API_KEY)
      .send({ status: 'idle' });
    assert.equal(backRes.status, 200);
    assert.equal(backRes.body.status, 'idle');
  });
});
