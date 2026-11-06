import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';

const directory = await mkdtemp(join(tmpdir(), 'guild-queue-test-'));
const socket = createServer();
socket.listen(0, '127.0.0.1');
await once(socket, 'listening');
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const base = `http://127.0.0.1:${port}`;
let server;
let output = '';
let roundId;

async function start() {
  server = spawn(process.execPath, [resolve('.next/standalone/server.js')], {
    env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: String(port), DATABASE_PATH: join(directory, 'test.sqlite'), NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => { output += chunk; });
  server.stderr.on('data', chunk => { output += chunk; });
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {}
    if (server.exitCode !== null) throw new Error(output);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start: ${output}`);
}
async function stop() {
  if (server && server.exitCode === null) {
    const stopped = once(server, 'exit');
    server.kill('SIGTERM');
    await stopped;
  }
}
const state = async () => (await fetch(`${base}/api/state`)).json();
async function command(body, expected = 200) {
  const response = await fetch(`${base}/api/state`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roundId, ...body }),
  });
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result;
}
before(start);
after(async () => { await stop(); await rm(directory, { recursive: true, force: true }); });

test('registration, transactional conflicts, party lifecycle, round history and persistence', async t => {
  let memberId;
  let firstQueue;
  let otherQueue;
  let runId;
  await t.test('starts empty and serves separated pages', async () => {
    const snapshot = await state();
    roundId = snapshot.data.rounds.at(-1).id;
    assert.equal(snapshot.data.queues.length, 0);
    assert.equal(snapshot.data.members.length, 0);
    for (const path of ['/queue', '/admin']) assert.equal((await fetch(base + path)).status, 200);
    const root = await fetch(base, { redirect: 'manual' });
    assert.equal(root.status, 307);
    assert.equal(root.headers.get('location'), '/queue');
  });
  await t.test('registers multiple levels and rejects invalid input atomically', async () => {
    await command({ type: 'join', name: 'Invalid', className: 'Knight', levels: [1, 6] }, 400);
    assert.equal((await state()).data.members.length, 0);
    await command({ type: 'join', name: 'Invalid', className: 'Unknown', levels: [1] }, 400);
    assert.equal((await state()).data.members.length, 0);
    const result = await command({ type: 'join', name: 'Tester', className: 'Knight', levels: [1, 2, 2] });
    memberId = result.data.members[0].id;
    assert.equal(result.data.queues.length, 2);
    firstQueue = result.data.queues.find(q => q.level === 1).id;
    otherQueue = result.data.queues.find(q => q.level === 2).id;
    await command({ type: 'join', name: 'tester', className: 'Wizard', levels: [1] }, 409);
    await command({ type: 'join', memberId: 'missing', levels: [3] }, 404);
    await command({ type: 'join', memberId, levels: [1, 3] }, 409);
    assert.equal((await state()).data.queues.length, 2);
  });
  await t.test('simultaneous submissions cannot duplicate or lose queues', async () => {
    const results = await Promise.all([1, 2].map(() => fetch(`${base}/api/state`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'join', roundId, memberId, levels: [3] }),
    })));
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    await Promise.all(['Second', 'Third'].map(name => command({ type: 'join', name, className: 'Wizard', levels: [1] })));
    assert.equal((await state()).data.queues.length, 5);
  });
  await t.test('prevents cross-party conflicts and preserves failed attempts on retry', async () => {
    await command({ type: 'start-run', partyId: 'party-a', level: 1, queueIds: [firstQueue, firstQueue] }, 400);
    const started = await command({ type: 'start-run', partyId: 'party-a', level: 1, queueIds: [firstQueue] });
    runId = started.data.runs.at(-1).id;
    await command({ type: 'start-run', partyId: 'party-b', level: 2, queueIds: [otherQueue] }, 409);
    await command({ type: 'queue-status', id: firstQueue, status: 'waiting' }, 409);
    await command({ type: 'round-status', status: 'finished' }, 409);
    await command({ type: 'new-round' }, 409);
    await command({ type: 'finish-run', runId, success: false });
    await command({ type: 'queue-status', id: firstQueue, status: 'waiting' });
    await command({ type: 'finish-run', runId, success: true }, 409);
    assert.equal((await state()).data.queues.find(q => q.id === firstQueue).status, 'waiting');
    const retry = await command({ type: 'start-run', partyId: 'party-c', level: 1, queueIds: [firstQueue] });
    await command({ type: 'finish-run', runId: retry.data.runs.at(-1).id, success: true });
    assert.deepEqual((await state()).data.runs.map(r => r.status), ['failed', 'completed']);
  });
  await t.test('checks capacity, closed rounds, and stale round submissions', async () => {
    await command({ type: 'capacity', level: 1, capacity: 3 }, 400);
    await command({ type: 'capacity', level: 1, capacity: 1 });
    const waiting = (await state()).data.queues.filter(q => q.level === 1 && q.status === 'waiting');
    await command({ type: 'start-run', partyId: 'party-c', level: 1, queueIds: waiting.map(q => q.id) }, 400);
    await command({ type: 'round-status', status: 'closed' });
    await command({ type: 'join', memberId, levels: [4] }, 409);
    const result = await command({ type: 'new-round' });
    await command({ type: 'join', memberId, levels: [4] }, 409);
    roundId = result.data.rounds.at(-1).id;
    const rejoined = await command({ type: 'join', name: '  TESTER  ', className: 'Crusader', levels: [1] });
    assert.equal(rejoined.data.members.length, 3);
    assert.equal(rejoined.data.queues.at(-1).memberId, memberId);
    assert.equal(rejoined.data.members.find(m => m.id === memberId).className, 'Crusader');
    assert.equal((await state()).data.rounds.length, 2);
    assert.equal((await state()).data.runs.length, 2);
  });
  await t.test('rejects malformed and cross-origin requests', async () => {
    const response = await fetch(`${base}/api/state`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://unrelated.example' }, body: '{}' });
    assert.equal(response.status, 403);
    const malformed = await fetch(`${base}/api/state`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
  });
  await t.test('restores identical data after server restart', async () => {
    const previous = await state();
    await stop();
    await start();
    assert.deepEqual(await state(), previous);
  });
});
