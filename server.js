/**
 * Process entry point for the `/hello` tutorial — `npm start`, or `node server.js`.
 *
 * Everything here is a property of the process rather than of a request: it
 * reads `HOST` and `PORT`, binds the server, prints one startup line, and
 * handles failure and shutdown. Turning a request into a response is `app.js`'s
 * job, and none of it is repeated here.
 *
 * Run it and it prints exactly one line:
 * `Listening on http://127.0.0.1:3000 — GET /hello returns "Hello world"`.
 * A failure prints exactly one line on standard error and exits with code 1,
 * so those two messages are all this process logs.
 */
import { isIPv6 } from 'node:net';

import { createServer } from './app.js';

/**
 * The bind address, loopback by default: a tutorial server should not be
 * reachable from the network unless its reader asks for that with `HOST`. An
 * empty value — `HOST=`, or a launcher passing a variable that was never set —
 * means the same as leaving `HOST` out, because Node reads a falsy host as "no
 * host given" and binds every interface instead of loopback.
 */
const host = process.env.HOST?.trim() || '127.0.0.1';

/**
 * The documented port, overridable with `PORT`. The value is read once, so the
 * number below and the sentence it can produce cannot disagree. An empty or
 * whitespace-only value means the same as leaving `PORT` out.
 */
const rawPort = process.env.PORT;
const portNotGiven = rawPort === undefined || rawPort.trim() === '';
const port = portNotGiven ? 3000 : Number(rawPort);

// Set once the bind has completed, because the failure sentence names the phase
// the server was in: an `'error'` after this point comes from a server that was
// serving — a failing `accept(2)` reaches the same listener — and that server
// stopped rather than failed to start.
let listening = false;

/**
 * Report a failure on stderr and stop the process with exit code 1.
 *
 * The sentence names the phase: before the bind the server could not start, and
 * an `'error'` after it can only come from a server that was already running, so
 * there the server stopped.
 *
 * Every failure goes through this one message, which is what keeps this
 * process's logging at exactly two messages: this line on stderr and the
 * startup line on stdout. It is also what stops `PORT=abc` from reaching
 * `listen` as a RangeError stack trace.
 *
 * @param {string} reason What went wrong, as a phrase the message completes.
 */
function fail(reason) {
  const phase = listening ? 'The server stopped' : 'The server could not start';

  console.error(`${phase}: ${reason}`);
  process.exit(1);
}

// `PORT` is accepted only as plain decimal digits. Left to `Number`, `1e3`
// would become port 1000, `0x10` the privileged port 16, which is why this
// digits-only test is here. It asks for no more than digits, so a padded
// value such as `0080` is accepted and binds port 80. A non-numeric value
// such as `PORT=abc` would reach `listen` as `NaN`, which rejects it with a
// RangeError, and one out of range would be rejected the same way — the
// failure mode this file exists to turn into a sentence.
const portIsValid = portNotGiven || (/^\d+$/.test(rawPort) && port <= 65535);

if (!portIsValid) {
  fail(`PORT "${rawPort}" must be plain decimal digits between 0 and 65535`);
}

const server = createServer();

// Node ends the process on an unhandled 'error' event and prints a stack trace.
// Listening for it turns a taken port or an unusable address into a sentence a
// reader can act on.
server.on('error', (error) => {
  fail(
    error.code === 'EADDRINUSE'
      ? `port ${port} on ${host} is already in use. Choose another one with PORT=<port> npm start.`
      : error.message,
  );
});

server.listen(port, host, () => {
  listening = true;

  // The port the operating system actually bound, which is the one to call:
  // with `PORT=0` the kernel picks a free port and this line reveals it.
  const boundPort = server.address().port;

  // The address the operating system actually bound, which is the one to name
  // here: `HOST=0` and a host name are both resolved by the system before the
  // bind, so the `HOST` text that was asked for is not always an address the
  // server ended up on.
  const boundAddress = server.address().address;

  // An IPv6 address has to be bracketed inside a URL: bound to `::1` the server
  // is reachable, but the unbracketed `http://::1:3000` is not a URL a client
  // can use.
  const shownHost = isIPv6(boundAddress) ? `[${boundAddress}]` : boundAddress;

  // The one startup line. `README.md` quotes it, so its wording and its em dash
  // are part of what the tutorial publishes.
  console.log(`Listening on http://${shownHost}:${boundPort} — GET /hello returns "Hello world"`);
});

let shuttingDown = false;

// Ctrl-C and `kill` are the normal ways to stop a server, and both should be a
// quiet exit rather than a stack trace. `shuttingDown` keeps a repeat signal
// from running `close` twice, and the repeat signal ends the process at once:
// pressing Ctrl-C again is declining to wait for the requests still in flight.
// That is still a stop the reader asked for, so it exits with code 0 as well.
function shutdown() {
  if (shuttingDown) {
    process.exit(0);
  }

  shuttingDown = true;

  // `close` stops accepting new connections and releases the keep-alive sockets
  // sitting idle between requests; a connection still being served, or whose
  // request has not arrived in full, is waited for until it ends. The process
  // leaves with code 0 once the server has closed.
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
