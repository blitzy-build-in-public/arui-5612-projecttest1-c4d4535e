import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

import { createServer } from '../app.js';

let server;
let baseUrl;

before(async () => {
  // Port 0 asks the OS for a free port, so this test can never collide with a
  // server another process is already running; binding loopback keeps it off
  // every other interface.
  server = createServer();
  server.listen(0, '127.0.0.1');
  // `listen` is asynchronous, so wait for the event instead of assuming the
  // call returned only once the server is accepting.
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
});

test('GET /hello answers 200 with the exact plain-text contract', async () => {
  const res = await fetch(`${baseUrl}/hello`);

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(res.headers.get('content-length'), '11');
  assert.equal(await res.text(), 'Hello world');
});

test('GET /hello ignores the query string and answers with the same body', async () => {
  const res = await fetch(`${baseUrl}/hello?name=Ada`);

  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'Hello world');
});

test('a request target that is not exactly /hello answers 404', async () => {
  const unknownPath = await fetch(`${baseUrl}/nope`);
  assert.equal(unknownPath.status, 404);

  // The match is exact, so the trailing-slash variant is not served either.
  const trailingSlash = await fetch(`${baseUrl}/hello/`);
  assert.equal(trailingSlash.status, 404);
});

test('a method other than GET or HEAD on /hello answers 405 with Allow', async () => {
  const res = await fetch(`${baseUrl}/hello`, { method: 'POST' });

  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'GET, HEAD');
});
