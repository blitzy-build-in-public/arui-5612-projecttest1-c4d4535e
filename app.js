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
 * Answer one HTTP request. Every branch below ends the response exactly once.
 *
 * @param {import('node:http').IncomingMessage} req The incoming request.
 * @param {import('node:http').ServerResponse} res The response to complete.
 */
function handleRequest(req, res) {
  // Parse the request target before routing it. This is a safety net rather
  // than a response to ordinary malformed input: Node's own request parser
  // rejects a malformed request line before the listener ever runs, so the only
  // targets that get here and fail to parse are absolute-form or
  // protocol-relative ones with an empty host, such as `http://` or `//`.
  let pathname;
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch {
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
 * Create the application's HTTP server with its request listener attached.
 *
 * Importing this module opens no socket and leaves no handle open, so the
 * caller decides where and whether to listen: the returned server is not
 * listening until `listen` is called on it.
 *
 * @returns {import('node:http').Server} A configured, not-yet-listening server.
 */
export function createServer() {
  return createHttpServer(handleRequest);
}
