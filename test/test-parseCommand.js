const assert = require('assert');

function parseCommand(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  const assignMatch = trimmed.match(/^[派指派]?\s*(.+?)\s*(?:去|去做|去修|去執行|去處理|去完成)\s*(.+)/);
  if (assignMatch) {
    return { type: 'assign', worker: assignMatch[1].trim(), task: assignMatch[2].trim() };
  }
  const createTaskMatch = trimmed.match(/^(?:開新任務|新建任務|建立任務|建立新任務)\s*(.+)/i);
  if (createTaskMatch) {
    return { type: 'create_task', title: createTaskMatch[1].trim() };
  }
  const queryMatch = trimmed.match(/^(?:查看|查詢|看看|看一下)\s*(.+)/i);
  if (queryMatch) {
    return { type: 'query', target: queryMatch[1].trim() };
  }
  if (/^(?:狀態|系統狀態|看一下狀態|查狀態)$/.test(trimmed)) {
    return { type: 'stats' };
  }
  if (/^(?:worker列表|員工列表|workers?|workers\s+list)$/i.test(trimmed)) {
    return { type: 'list_workers' };
  }
  if (/^(?:任務列表|所有任務|tasks?|tasks\s+list)$/i.test(trimmed)) {
    return { type: 'list_tasks' };
  }
  return null;
}

describe('parseCommand()', () => {
  it('派 Hermes 去修bug → { type: assign, worker: Hermes, task: 修bug }', () => {
    const result = parseCommand('派 Hermes 去修bug');
    assert.deepStrictEqual(result, { type: 'assign', worker: 'Hermes', task: '修bug' });
  });

  it('查看狀態 → { type: query, target: 狀態 }', () => {
    const result = parseCommand('查看狀態');
    assert.deepStrictEqual(result, { type: 'query', target: '狀態' });
  });

  it('狀態 → { type: stats }', () => {
    const result = parseCommand('狀態');
    assert.deepStrictEqual(result, { type: 'stats' });
  });

  it('worker列表 → { type: list_workers }', () => {
    const result = parseCommand('worker列表');
    assert.deepStrictEqual(result, { type: 'list_workers' });
  });

  it('任務列表 → { type: list_tasks }', () => {
    const result = parseCommand('任務列表');
    assert.deepStrictEqual(result, { type: 'list_tasks' });
  });

  it('Empty/null input → null', () => {
    assert.strictEqual(parseCommand(''), null);
    assert.strictEqual(parseCommand(null), null);
    assert.strictEqual(parseCommand(undefined), null);
  });

  it('Non-command text → null', () => {
    assert.strictEqual(parseCommand('Hello, how are you?'), null);
  });
});
