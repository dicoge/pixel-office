const assert = require('assert');
const request = require('supertest');
const createApp = require('./setup');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'pixel-office-secret-change-me';

describe('Auth API', () => {
  let app, getAuthToken;

  before(async () => {
    const ctx = await createApp();
    app = ctx.app;
    getAuthToken = ctx.getAuthToken;
  });

  it('POST /auth/login with admin credentials → 200 + token', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'dicoge', password: 'Zxc999871' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.username, 'dicoge');
  });

  it('POST /auth/login with wrong password → 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'dicoge', password: 'wrongpassword' });
    assert.equal(res.status, 401);
  });

  it('POST /auth/login missing fields → 400', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'dicoge' });
    assert.equal(res.status, 400);
  });

  it('POST /auth/register → 403 (admin configured)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ username: 'newuser', password: 'password123' });
    assert.equal(res.status, 403);
  });

  it('POST /auth/login non-existent user → 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'nonexistent', password: 'password123' });
    assert.equal(res.status, 401);
  });

  it('GET /api/tasks with expired JWT token → 401', async () => {
    const expiredToken = jwt.sign(
      { id: 'admin', username: 'dicoge', role: 'admin', exp: Math.floor(Date.now() / 1000) - 3600 },
      JWT_SECRET
    );
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${expiredToken}`);
    assert.equal(res.status, 401);
  });

  it('GET /api/tasks with tampered JWT token → 401', async () => {
    const token = getAuthToken();
    const parts = token.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ id: 'admin', username: 'hacker', role: 'admin' })
    ).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${tamperedToken}`);
    assert.equal(res.status, 401);
  });

  it('GET /api/tasks with token signed with wrong secret → 401', async () => {
    const wrongSecretToken = jwt.sign(
      { id: 'admin', username: 'dicoge', role: 'admin' },
      'wrong-secret-for-testing-only'
    );
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${wrongSecretToken}`);
    assert.equal(res.status, 401);
  });
});
