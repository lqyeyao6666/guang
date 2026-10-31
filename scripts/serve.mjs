import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = resolve(projectRoot, 'dist');
const shouldOpen = process.argv.includes('--open');
const portIndex = process.argv.indexOf('--port');
const requestedPort = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 4177;
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg' };

function openBrowser(url) {
  if (!shouldOpen) return;
  const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore', windowsHide: true });
  browser.on('error', error => console.error('无法自动打开浏览器，请手动访问：', url, error.message));
  browser.unref();
}

await stat(resolve(publicRoot, 'index.html')).catch(() => { console.error('缺少 dist/index.html，请先运行 npm run build。'); process.exit(1); });
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (pathname === '/__warm_light_health') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ app: 'warm-light-path', root: projectRoot, pid: process.pid }));
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return; }
    const filename = resolve(publicRoot, pathname === '/' ? 'index.html' : `.${pathname}`);
    if (!filename.startsWith(publicRoot + sep)) { response.writeHead(403); response.end(); return; }
    const data = await readFile(filename);
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(filename)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('没有找到这个文件。');
  }
});

async function listen(port) {
  try {
    await new Promise((resolveListen, rejectListen) => {
      const onError = error => { server.off('listening', onListening); rejectListen(error); };
      const onListening = () => { server.off('error', onError); resolveListen(); };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, '127.0.0.1');
    });
    const url = `http://127.0.0.1:${port}`;
    console.log(`暖光小径已启动：${url}`);
    openBrowser(url);
  } catch (error) {
    if (error.code !== 'EADDRINUSE' || port >= requestedPort + 10) throw error;
    const existing = await fetch(`http://127.0.0.1:${port}/__warm_light_health`, { signal: AbortSignal.timeout(1500) }).then(response => response.json()).catch(() => null);
    if (existing?.app === 'warm-light-path' && existing.root === projectRoot) {
      console.log(`复用已启动的游戏：http://127.0.0.1:${port}`);
      openBrowser(`http://127.0.0.1:${port}`);
    } else await listen(port + 1);
  }
}
await listen(requestedPort);
