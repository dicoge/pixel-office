const assert = require('assert');
const request = require('supertest');
const createApp = require('./setup');

describe('Messages API', () => {
  let app, getAuthToken;

  before(async () => {
    const ctx = await createApp();
    app = ctx.app;
    getAuthToken = ctx.getAuthToken;
  });

  it('POST /api/messages + auth → 201', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${getAuthToken()}`)
      .send({ content: 'Hello', room_type: 'channel', room_id: 'general' });
    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    assert.equal(res.body.content, 'Hello');
  });

  it('GET /api/messages?room_type=X&room_id=Y → history', async () => {
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${getAuthToken()}`)
      .send({ content: 'Test message', room_type: 'channel', room_id: 'test-room' });

    const res = await request(app)
      .get('/api/messages')
      .set('Authorization', `Bearer ${getAuthToken()}`)
      .query({ room_type: 'channel', room_id: 'test-room' });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].content, 'Test message');
  });

  it('POST /api/hermes-reply + auth → 201', async () => {
    const msgRes = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${getAuthToken()}`)
      .send({ content: 'Need help', room_type: 'channel', room_id: 'help' });
    const messageId = msgRes.body.id;

    const res = await request(app)
      .post('/api/hermes-reply')
      .set('Authorization', `Bearer ${getAuthToken()}`)
      .send({ message_id: messageId, content: 'I am here to help!' });
    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    assert.equal(res.body.content, 'I am here to help!');
    assert.equal(res.body.sender_type, 'bot');
  });

  it('Validation: missing fields → 400', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${getAuthToken()}`)
      .send({ content: 'Missing room info' });
    assert.equal(res.status, 400);
  });
});
