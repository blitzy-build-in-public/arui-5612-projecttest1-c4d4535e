import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { connect } from 'node:net';

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

after(async () => {
  // `close` is asynchronous too: wait for the listener to release its port
  // so the run's exit rests on teardown rather than on the client sockets.
  await new Promise((resolve) => server.close(resolve));
});

// Send one raw request over a real socket and resolve with the whole reply once
// the server has closed the connection, so a response that never travels
// through `fetch` — the server's answer to `CONNECT` — is still asserted on the
// bytes it actually sent.
async function connectOverRawSocket(port, request) {
  const socket = connect(port, '127.0.0.1');
  let reply = '';

  socket.setEncoding('utf8');
  socket.on('data', (chunk) => {
    reply += chunk;
  });

  // A server that answered nothing and left the connection open would stall the
  // whole run, so the wait for the reply is bounded; closing the socket ends the
  // wait and the assertions below report the reply that did arrive.
  socket.setTimeout(5000, () => socket.destroy());

  socket.write(request);

  await once(socket, 'close');

  return reply;
}

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

  // `CONNECT` never reaches the request listener — Node.js delivers it to the
  // server's connection-level event instead — so the same refusal is checked
  // over a raw socket, in both forms a client can put on the wire.
  const port = server.address().port;
  const originForm = await connectOverRawSocket(
    port,
    `CONNECT /hello HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`,
  );
  const authorityForm = await connectOverRawSocket(
    port,
    'CONNECT example.com:443 HTTP/1.1\r\nHost: example.com:443\r\nConnection: close\r\n\r\n',
  );

  for (const reply of [originForm, authorityForm]) {
    const [head, body] = reply.split('\r\n\r\n');
    const headers = head.split('\r\n');

    assert.equal(headers[0], 'HTTP/1.1 405 Method Not Allowed');
    assert.ok(headers.includes('Allow: GET, HEAD'));
    assert.ok(headers.includes('Content-Type: text/plain; charset=utf-8'));
    assert.ok(headers.includes('Content-Length: 18'));
    assert.equal(body, 'Method Not Allowed');
  }
});
