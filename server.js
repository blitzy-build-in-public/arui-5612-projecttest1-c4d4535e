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
 * reachable from the network unless its reader asks for that with `HOST`.
 */
const host = process.env.HOST ?? '127.0.0.1';

/**
 * The documented port, overridable with `PORT`. An environment variable always
 * arrives as a string, so it is converted to a number — passed through as
 * `'3000'`, `listen` would read it as a pipe name rather than a TCP port.
 */
const port = Number(process.env.PORT ?? 3000);

// A `PORT` that is not a usable port number would otherwise make `listen` throw
// a RangeError stack trace, which is the failure mode this file exists to avoid.
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`Invalid PORT "${process.env.PORT}": use an integer between 0 and 65535.`);
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
