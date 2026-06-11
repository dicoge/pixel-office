const assert = require('assert');
const request = require('supertest');
const createApp = require('./setup');

describe('Tasks API', () => {
  let app, getAuthToken;
  let taskId;

  before(async () => {
    const ctx = await createApp();
    app = ctx.app;
    getAuthToken = ctx.getAuthToken;
  });

  it('POST /api/tasks + auth → 201', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${getAuthToken()}`)
      .send({ department_id: 'dept-dungeon', title: 'Test Task' });
    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    assert.equal(res.body.title, 'Test Task');
    taskId = res.body.id;
  });

  it('POST /api/tasks without auth → 401', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ department_id: 'dept-dungeon', title: 'No Auth Task' });
    assert.equal(res.status, 401);
  });

  it('GET /api/tasks → list', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${getAuthToken()}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('GET /api/tasks?status=pending → filter', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${getAuthToken()}`)
      .query({ status: 'pending' });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    res.body.forEach(t => assert.equal(t.status, 'pending'));
  });

  it('GET /api/tasks/:id → single task', async () => {
    const res = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${getAuthToken()}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.id, taskId);
  });

  it('PATCH /api/tasks/:id → update', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${getAuthToken()}`)
      .send({ status: 'in_progress' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'in_progress');
  });

  it('DELETE /api/tasks/:id → delete', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${getAuthToken()}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  it('Validation: missing fields → 400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${getAuthToken()}`)
      .send({ title: 'Missing dept' });
    assert.equal(res.status, 400);
  });

  it('Edge case: extra long title (>1000 chars) → success', async () => {
    const longTitle = 'x'.repeat(1001);
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${getAuthToken()}`)
      .send({ department_id: 'dept-dungeon', title: longTitle });
    assert.equal(res.status, 201);
    assert.equal(res.body.title, longTitle);
  });

  it('Edge case: special characters in title (XSS-like payloads) → success', async () => {
    const payloads = [
      '<script>alert("xss")</script>',
      '"><img src=x onerror=alert(1)>',
      '{{constructor.constructor("alert(1)")()}}',
    ];
    for (const payload of payloads) {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${getAuthToken()}`)
        .send({ department_id: 'dept-dungeon', title: payload });
      assert.equal(res.status, 201, `Failed for payload: ${payload}`);
      assert.equal(res.body.title, payload);
    }
  });
});
