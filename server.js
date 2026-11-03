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
 */
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

// `PORT` is accepted only as plain decimal digits. Left to `Number`, `1e3`
// would become port 1000, `0x10` the privileged port 16, and a padded value
// would be trimmed to a number nobody wrote; a non-numeric value such as
// `PORT=abc` is the case `listen` would read as a pipe name rather than a TCP
// port, and one out of range would make `listen` throw a RangeError stack trace
// — the failure mode this file exists to turn into a sentence.
const portIsValid = portNotGiven || (/^\d+$/.test(rawPort) && port <= 65535);

if (!portIsValid) {
  console.error(`Invalid PORT "${rawPort}": use an integer between 0 and 65535.`);
  process.exit(1);
}

const server = createServer();

// Node ends the process on an unhandled 'error' event and prints a stack trace.
// Listening for it turns a taken port or an unusable address into a sentence a
// reader can act on.
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${port} on ${host} is already in use. Choose another one with PORT=<port> npm start.`,
    );
  } else {
    console.error(`The server could not start: ${error.message}`);
  }

  process.exit(1);
});

server.listen(port, host, () => {
  // The port the operating system actually bound, which is the one to call:
  // with `PORT=0` the kernel picks a free port and this line reveals it.
  const boundPort = server.address().port;

  // The one startup line. `README.md` quotes it, so its wording and its em dash
  // are part of what the tutorial publishes.
  console.log(`Listening on http://${host}:${boundPort} — GET /hello returns "Hello world"`);
});

let shuttingDown = false;

// Ctrl-C and `kill` are the normal ways to stop a server, and both should be a
// quiet exit rather than a stack trace. The guard makes a second signal a no-op,
// so neither can close the server twice or leave the shell waiting on it.
function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  // Closing stops accepting connections; dropping idle sockets as well means a
  // client holding a keep-alive connection open cannot delay the exit. The
  // process leaves with code 0 once the server has closed.
  server.close(() => process.exit(0));
  server.closeIdleConnections();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
