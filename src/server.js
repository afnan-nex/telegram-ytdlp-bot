import http from 'http';

/**
 * Starts a lightweight HTTP server for Render / cloud container health checks.
 * @param {number} port
 */
export function startHealthServer(port = 8080) {
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/healthz' || req.url === '/ping') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  server.listen(port, () => {
    console.log(`[HTTP Server] Health check server listening on port ${port}`);
  });

  return server;
}
