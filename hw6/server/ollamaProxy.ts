import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

async function chat(req: IncomingMessage, res: ServerResponse) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  const disconnected = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', disconnected);
  try {
    if (req.method !== 'POST') throw new RequestError('僅支援 POST。', 405);
    // This local proxy accepts requests from its own web app only.
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {
      throw new RequestError('請從本機網頁送出需求。', 403);
    }
    if (!req.headers['content-type']?.startsWith('application/json')) {
      throw new RequestError('請使用 JSON 格式。', 415);
    }
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      length += buffer.length;
      if (length > 1_048_576) throw new RequestError('對話內容過長。', 413);
      chunks.push(buffer);
    }
    let body: Record<string, unknown>;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new RequestError('請求 JSON 無法解析。'); }
    if (!body || typeof body !== 'object' || typeof body.baseUrl !== 'string' ||
        typeof body.model !== 'string' || !body.model.trim() || !Array.isArray(body.messages) ||
        !body.messages.length || body.messages.some((message: unknown) => {
          if (!message || typeof message !== 'object') return true;
          const m = message as Record<string, unknown>;
          return !['system', 'user', 'assistant'].includes(String(m.role)) || typeof m.content !== 'string';
        })) throw new RequestError('Ollama 位址、模型或訊息格式錯誤。');
    let target: URL;
    try { target = new URL(body.baseUrl); }
    catch { throw new RequestError('Ollama 位址格式錯誤。'); }
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.search || target.hash) {
      throw new RequestError('Ollama 位址須為不含帳密、查詢參數的 http(s) 位址。');
    }
    target.pathname = `${target.pathname.replace(/\/+$/, '')}/api/chat`;
    const upstream = await fetch(target, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: body.model.trim(), messages: body.messages, stream: false }),
      signal: controller.signal, redirect: 'error',
    });
    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 400);
      throw new RequestError(`Ollama HTTP ${upstream.status}：${detail}。請確認模型與雲端登入狀態。`, 502);
    }
    const result = await upstream.json();
    if (!res.destroyed) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(result));
    }
  } catch (error) {
    if (!res.destroyed && !res.writableEnded) {
      const status = error instanceof RequestError ? error.status : controller.signal.aborted ? 504 : 502;
      const message = error instanceof RequestError ? error.message : controller.signal.aborted
        ? 'Ollama 請求逾時，請稍後重試。'
        : '無法連接 Ollama，請確認服務位址、服務是否啟動及模型設定。';
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: message }));
    }
  } finally {
    clearTimeout(timer);
    res.off('close', disconnected);
  }
}

export function ollamaProxy(): Plugin {
  const install = (server: { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => unknown } }) => {
    server.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0] !== '/api/ollama/chat') return next();
      void chat(req, res);
    });
  };
  return { name: 'local-ollama-proxy', configureServer: install, configurePreviewServer: install };
}
