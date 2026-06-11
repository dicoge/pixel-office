const assert = require('assert');
const request = require('supertest');
const createApp = require('./setup');

describe('Departments API', () => {
  let app, getAuthToken;

  before(async () => {
    const ctx = await createApp();
    app = ctx.app;
    getAuthToken = ctx.getAuthToken;
  });

  it('GET /api/departments → list', async () => {
    const res = await request(app)
      .get('/api/departments')
      .set('Authorization', `Bearer ${getAuthToken()}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 3);
  });

  it('POST /api/departments → create', async () => {
    const res = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${getAuthToken()}`)
      .send({ name: 'Test Dept', emoji: '🧪', description: 'Test department' });
    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    assert.equal(res.body.name, 'Test Dept');
    assert.equal(res.body.emoji, '🧪');
  });

  it('PATCH /api/departments/:id → update', async () => {
    const createRes = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${getAuthToken()}`)
      .send({ name: 'Update Dept', emoji: '🔧' });
    const deptId = createRes.body.id;

    const res = await request(app)
      .patch(`/api/departments/${deptId}`)
      .set('Authorization', `Bearer ${getAuthToken()}`)
      .send({ name: 'Updated Dept' });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Updated Dept');
  });

  it('DELETE /api/departments/:id → delete', async () => {
    const createRes = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${getAuthToken()}`)
      .send({ name: 'Delete Dept', emoji: '🗑️' });
    const deptId = createRes.body.id;

    const res = await request(app)
      .delete(`/api/departments/${deptId}`)
      .set('Authorization', `Bearer ${getAuthToken()}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  it('Validation: missing fields → 400', async () => {
    const res = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${getAuthToken()}`)
      .send({ description: 'no name or emoji' });
    assert.equal(res.status, 400);
  });
});
