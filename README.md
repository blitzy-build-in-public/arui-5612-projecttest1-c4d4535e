# Node.js tutorial: one endpoint, `GET /hello`

## What it is

This is a small Node.js tutorial project that starts an HTTP server exposing exactly one endpoint, `GET /hello`. Any calling HTTP client — `curl`, a browser, or any HTTP library — receives the plain-text body `Hello world`. The whole server is two short files that you can read top to bottom: one handles a request, the other handles the process. It has no dependencies and no build step, because it is plain JavaScript that the Node.js runtime executes directly.

## Prerequisites

Node.js 22 or later. Check which version you have:

```bash
node -v
# v22.x, v24.x or v26.x — anything 22 or newer
```

The project uses only Stability 2 APIs from the Node.js standard library, so it runs unchanged on the 22, 24 and 26 LTS lines. `npm` ships with Node.js and is used for the two commands below.

Every command in this file is written for a bash-like shell — `bash` or `zsh` on Linux or macOS — because the byte-exactness check below uses process substitution and the boundary checks write to `/dev/null`, neither of which a POSIX `sh` or a Windows shell such as `cmd.exe` or PowerShell provides.

## Install

There is nothing to install. The project declares no dependencies, so it runs from the Node.js runtime alone. `npm install` is optional: run from the project root it fetches no packages and writes only `package-lock.json`.

## Run it

```bash
npm start
```

The server prints one line and keeps running:

```text
Listening on http://127.0.0.1:3000 — GET /hello returns "Hello world"
```

The defaults are host `127.0.0.1` (loopback) and port `3000`. Binding loopback keeps the server off every other interface of the machine, so nothing else on the network can reach it unless you ask for that. Two environment variables override the defaults:

```bash
PORT=8080 npm start                 # http://127.0.0.1:8080/hello
HOST=0.0.0.0 PORT=8080 npm start    # also reachable from your network
PORT=0 npm start                    # let the OS pick a free port; the startup line prints the one it chose
```

`HOST` takes a host name or an IP address, and a name is resolved by your system: `HOST=localhost` binds whichever loopback address `localhost` resolves to — the IPv6 loopback `::1` on many systems — so a client must reach the server by that same name. An IP literal such as `127.0.0.1` binds exactly that address and removes the ambiguity.

Stop the server with Ctrl-C: it closes the listener and exits with status `0`, not a stack trace. If the port you asked for is already taken, it prints a sentence on standard error naming `PORT` and exits with status `1`; if `PORT` is not a usable port number, it says so and exits `1` as well.

## Exercise it

With the server running in one terminal, call the endpoint from another:

```bash
curl -i http://127.0.0.1:3000/hello
```

The response is:

```http
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 11
Date: Fri, 30 Oct 2026 05:51:37 GMT
Connection: keep-alive
Keep-Alive: timeout=5

Hello world
```

Three things about that body are worth noticing:

- It has **no trailing newline**, so the shell prompt appears immediately after `world`.
- It is exactly **11 bytes** of ASCII, which is what `Content-Length` counts.
- It carries no quotes and no JSON envelope. The eleven bytes after the blank line are the entire response body.

`Date` and the keep-alive headers are set by Node.js and change from response to response; the status line, `Content-Type`, `Content-Length` and the body are the parts this project fixes.

To check the body byte for byte, this command prints nothing and exits with status `0` when the body is exactly right:

```bash
curl -s http://127.0.0.1:3000/hello | cmp - <(printf 'Hello world')
```

### The endpoint boundary

The match is on the parsed path, so that path must be exactly `/hello`: `/`, `/hello/` and `/nope` are all different paths and all answer `404`, and the trailing slash makes a different path rather than another spelling of the same one. Parsing a URL normalises dot-segments, so a target such as `/./hello` or `/foo/../hello` parses to `/hello` and reaches the same branch.

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/nope      # 404
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/hello/    # 404
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/          # 404
```

A method other than `GET` or `HEAD` on `/hello` is refused explicitly, with the header that names what is allowed:

```bash
curl -si -X POST http://127.0.0.1:3000/hello | grep -iE '^(HTTP|allow)'
# HTTP/1.1 405 Method Not Allowed
# Allow: GET, HEAD
```

`CONNECT` is the one method Node.js never hands to the request listener: it is delivered to the server's connection-level event instead, and a server that listens for nothing there closes the socket without answering the client at all. This app opens no tunnel, so it answers `CONNECT` with that same `405`, the same `Allow: GET, HEAD` header and the same `Method Not Allowed` body, and then closes the connection. Because that answer never passes through the request listener, the test suite checks it over a raw socket rather than through `fetch`.

`HEAD /hello` returns the same status and the same headers as `GET`, with no body — Node.js itself suppresses the body of a `HEAD` response, so the handler has no branch for it:

```bash
curl -I http://127.0.0.1:3000/hello
```

A query string changes nothing, because the route is chosen from the parsed path:

```bash
curl -i 'http://127.0.0.1:3000/hello?name=Ada'    # same 200, same headers, same body
```

One more status comes from the request target rather than from the path: a target that cannot be parsed as a URL at all is answered `400` with the body `Bad Request`. Node.js's own parser rejects a malformed request line before the listener runs, so the only targets that reach this branch are absolute-form or protocol-relative ones with an empty host, such as `GET http://` — and the protocol-relative kind is one `curl` sends itself: `curl -i http://127.0.0.1:3000//` sends the empty-host target `GET // HTTP/1.1` and answers `400 Bad Request`.

Each of those error responses is plain text (`Content-Type: text/plain; charset=utf-8`) with a byte-accurate `Content-Length` and a short body — `Not Found` for the `404`, `Method Not Allowed` for the `405` and `Bad Request` for the `400` — so no request is ever left waiting for a response that does not come.

## Run the tests

```bash
npm test
```

That runs `node --test`, which finds the single test file `test/hello.test.js` with no configuration and reports four passing cases, exiting with status `0`:

1. `GET /hello` answers `200` with `Content-Type` exactly `text/plain; charset=utf-8`, `Content-Length` `11`, and a body strictly equal to `Hello world` — asserted over real HTTP, not by reading the code.
2. `GET /hello?name=Ada` answers `200` and the same body, which is what proves the query string is ignored.
3. A parsed path that is not `/hello` answers `404`, asserted for both `/nope` and `/hello/`.
4. `POST /hello` answers `405` with `Allow: GET, HEAD`; the same case also sends `CONNECT` over a raw socket, to check that the refusal covers the one method Node.js answers below the request listener.

The tests listen on port `0` bound to `127.0.0.1`, so the operating system hands them a free port and the suite can never collide with a server you already have running. They call the server through the global `fetch`, and case 4 opens one raw `node:net` socket for the `CONNECT` reply, so no HTTP client package is needed, and they start and close their own server, so you do not have to stop `npm start` before running them.

## How it works

A client opens a TCP connection to the bound host and port, Node.js accepts it, and the request then travels this path:

1. `server.js` reads `HOST` and `PORT`, builds the server by calling `createServer()` from `app.js`, and listens with `server.listen(port, host, ...)`. Once the process is listening it prints the single startup line.
2. Node.js parses the request line and the headers and emits a `'request'` event with `(req, res)`, which reaches `handleRequest` in `app.js`.
3. The listener parses the request target with `new URL(req.url, 'http://localhost')` inside a `try`/`catch`, and routes on the parsed `url.pathname`.
4. If the path is `/hello` and the method is `GET` (or `HEAD`), it answers `200` with `Content-Type: text/plain; charset=utf-8`, `Content-Length: 11` and the body `Hello world`. Otherwise it answers `404`, `405` or `400` as the boundary section above describes.
5. The response leaves through one `res.writeHead(status, headers)` followed by a single `res.end(body)`.

Three decisions on that path are worth the reason behind them.

**Why the server factory is separate from the entry point.** `app.js` exports `createServer()` and opens no socket when it is imported; `server.js` is the file that binds a port. Because importing the handler has no side effect, the test can build its own server, listen on a port of its own choosing and close it afterwards. A module that started listening as soon as it was imported would leave the test no way to pick a port or to stop the server.

**Why the path is parsed before it is matched.** The request target string is the only input that comes from the caller, and `new URL(...)` inside a `try`/`catch` turns it into a `pathname` without letting it reach a response body, a file path or a command. Routing on `url.pathname` rather than on the raw `req.url` is also what makes a query string irrelevant: the pathname of `/hello?name=Ada` is `/hello`. A target that cannot be parsed is answered `400 Bad Request` instead of throwing. Node.js's own request parser already rejects a malformed request line before the listener runs at all, so that branch is a safety net for the few targets that still reach it.

**Why `Content-Length` is set explicitly.** Node.js performs no outbound length check of its own and adds no `Content-Type` unless the handler sets one, so the handler is what keeps the response correctly framed. The value comes from `Buffer.byteLength(body)`, which counts the bytes HTTP counts rather than the characters JavaScript counts. Every response — the `200`, the `404`, the `405` and the `400` — goes out the same way, through one helper that writes the status, the two framing headers and any extra headers, and ends the response exactly once, so no path can write after `end` or leave a client hanging.

The logging is deliberately minimal: the one startup line on stdout, plus a readable sentence on standard error when the port is unusable or already in use, in which case the process exits with status `1` rather than a stack trace. There is no request log and no log-level setting, because a line per request would tell a reader learning from one route nothing that `curl`'s output has not already shown.

## Where to add a second route

The route check is the `if (pathname !== '/hello')` line in `app.js`: add the new path next to it and answer with the `sendText` helper. At that second route the inline check is worth extracting into a small router module — a table of path and method to handler, with the `404` fallback for everything not in the table. The project deliberately does not build that now: one route does not need a router, and a router would be more code to read than the route it holds.

## Project layout

- `app.js` — the HTTP application: the `Hello world` body constant, the request listener, and the `createServer()` factory. Importing it opens no socket.
- `server.js` — the process entry point `npm start` runs: `HOST` and `PORT`, `listen`, the startup line, and the failure and shutdown handling.
- `package.json` — the manifest: ESM (`"type": "module"`), the Node.js floor (`"engines": { "node": ">=22" }`), and the `start` and `test` scripts. It declares no dependencies.
- `test/hello.test.js` — the behavioural test suite, found by `node --test` with no configuration.
- `.gitignore` — keeps `node_modules/`, the generated `package-lock.json`, npm debug logs and `.DS_Store` out of the tree.
