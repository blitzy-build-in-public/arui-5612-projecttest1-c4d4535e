/**
 * The HTTP application for the `/hello` tutorial.
 *
 * Everything that turns a request into a response lives here. Binding a port,
 * reading the environment and shutting down are properties of the process, not
 * of a request, and they live in `server.js`, which imports the factory below.
 */
import { createServer as createHttpServer } from 'node:http';

/**
 * The body `GET /hello` answers with: eleven ASCII bytes, capital H, lowercase
 * w, no quotes, no JSON wrapper and no trailing newline. It is defined once so
 * that the response contract has a single source.
 */
const HELLO = 'Hello world';

const TEXT_CONTENT_TYPE = 'text/plain; charset=utf-8';

/**
 * Send a complete plain-text response.
 *
 * `Content-Length` is set explicitly because Node performs no outbound length
 * check of its own and adds no `Content-Type` unless the handler sets one — the
 * handler is what keeps the response framed. It is `Buffer.byteLength(body)`
 * rather than `body.length` because HTTP counts bytes, not characters.
 *
 * The body is written by the single `res.end(...)` call below, which both sends
 * it and ends the response, so no caller can write after the response has ended.
 *
 * @param {import('node:http').ServerResponse} res The response to complete.
 * @param {number} status The HTTP status code to send.
 * @param {string} body The exact response body.
 * @param {Record<string, string>} [extraHeaders] Headers to add, such as `Allow`.
 */
function sendText(res, status, body, extraHeaders = {}) {
  const headers = {
    'Content-Type': TEXT_CONTENT_TYPE,
    'Content-Length': Buffer.byteLength(body),
    ...extraHeaders,
  };

  res.writeHead(status, headers);
  res.end(body);
}

/**
 * Parse a request target down to its path, or report that it cannot be parsed.
 *
 * Parsing before routing is a safety net rather than a response to ordinary
 * malformed input: Node's own request parser rejects a malformed request line
 * before the listener ever runs, so the only targets that reach this function
 * and fail are absolute-form or protocol-relative ones with an empty host, such
 * as `http://` or `//`.
 *
 * @param {string} target The raw request target, `req.url`.
 * @returns {string | null} The path, or `null` when the target cannot be parsed.
 */
function parsePathname(target) {
  try {
    return new URL(target, 'http://localhost').pathname;
  } catch {
    return null;
  }
}

/**
 * Answer one HTTP request. Every branch below ends the response exactly once.
 *
 * @param {import('node:http').IncomingMessage} req The incoming request.
 * @param {import('node:http').ServerResponse} res The response to complete.
 */
function handleRequest(req, res) {
  const pathname = parsePathname(req.url);

  if (pathname === null) {
    sendText(res, 400, 'Bad Request');
    return;
  }

  // Route on the parsed path, never on the raw `req.url`, so a query string
  // cannot change the answer: `/hello?name=Ada` is `/hello`.
  if (pathname !== '/hello') {
    // The endpoint boundary. The match is exact, so `/`, `/hello/` and every
    // other target answer 404.
    sendText(res, 404, 'Not Found');
    return;
  }

  // `HEAD` reaches the same write as `GET`. Node suppresses the response body
  // for a `HEAD` request itself, so no branch here has to.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendText(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    return;
  }

  sendText(res, 200, HELLO);
}

/**
 * Refuse a `CONNECT` request.
 *
 * Node never hands `CONNECT` to the request listener: the server raises this
 * connection-level event instead, and a server listening for nothing there
 * closes the socket without answering the client at all. This endpoint opens no
 * tunnel, so every `CONNECT` is refused with the same `405` and the same
 * `Allow` header as any other unsupported method, and the connection is closed.
 *
 * @param {import('node:net').Socket} socket The connection the request arrived on.
 */
function refuseConnect(socket) {
  // A peer that resets the connection while the refusal is on its way emits
  // `'error'` on the socket, and an unhandled `'error'` event ends the process.
  socket.on('error', () => socket.destroy());

  const body = 'Method Not Allowed';
  const response =
    'HTTP/1.1 405 Method Not Allowed\r\n' +
    'Allow: GET, HEAD\r\n' +
    `Content-Type: ${TEXT_CONTENT_TYPE}\r\n` +
    `Content-Length: ${Buffer.byteLength(body)}\r\n` +
    'Connection: close\r\n' +
    '\r\n' +
    body;

  // `end` flushes the refusal and then closes the connection; `destroy` on its
  // own can drop a response the client has not read yet.
  socket.end(response);
}

/**
 * Create the application's HTTP server with its request listener and its
 * `CONNECT` refusal attached.
 *
 * Importing this module opens no socket and leaves no handle open, so the
 * caller decides where and whether to listen: the returned server is not
 * listening until `listen` is called on it.
 *
 * @returns {import('node:http').Server} A configured, not-yet-listening server.
 */
export function createServer() {
  const server = createHttpServer(handleRequest);

  // `CONNECT` arrives at the connection layer rather than at the request
  // listener, so its refusal is attached to the server next to that listener.
  server.on('connect', (_req, socket) => refuseConnect(socket));

  return server;
}
