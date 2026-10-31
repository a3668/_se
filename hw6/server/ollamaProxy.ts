import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

class RequestError extends Error {
  constructor(message: string, public status = 400, public code?: string) { super(message); }
}

function targetUrl(baseUrl: unknown, endpoint: 'chat' | 'tags'): URL {
  if (typeof baseUrl !== 'string') throw new RequestError('請填寫 Ollama 服務位址。');
  let target: URL;
  try { target = new URL(baseUrl.trim()); }
  catch { throw new RequestError('Ollama 位址格式錯誤。'); }
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.search || target.hash) {
    throw new RequestError('Ollama 位址須為不含帳密、查詢參數的 http(s) 位址。');
  }
  target.pathname = `${target.pathname.replace(/\/+$/, '')}/api/${endpoint}`;
  return target;
}

async function listModels(target: URL, clientSignal: AbortSignal): Promise<string[]> {
  const timeout = AbortSignal.timeout(5_000);
  try {
    const response = await fetch(target, {
      signal: AbortSignal.any([clientSignal, timeout]), redirect: 'error',
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new RequestError(`Ollama 模型清單暫時無法取得（HTTP ${response.status}）。`, 502, 'MODEL_LIST_UNAVAILABLE');
    }
    const data: unknown = await response.json();
    const items = data && typeof data === 'object' ? (data as Record<string, unknown>).models : undefined;
    if (!Array.isArray(items) || items.some((item: unknown) => {
      if (!item || typeof item !== 'object') return true;
      const name = (item as Record<string, unknown>).name;
      return typeof name !== 'string' || !name.trim();
    })) throw new RequestError('Ollama 傳回的模型清單格式不正確。', 502, 'MODEL_LIST_UNAVAILABLE');
    return [...new Set(items.map(item => (item.name as string).trim()))];
  } catch (error) {
    if (clientSignal.aborted || error instanceof RequestError) throw error;
    const message = timeout.aborted ? '取得 Ollama 模型清單逾時，請重新載入。'
      : error instanceof SyntaxError ? 'Ollama 傳回的模型清單格式不正確。'
      : '無法連接 Ollama 取得模型清單，請確認服務與連線設定。';
    throw new RequestError(message, timeout.aborted ? 504 : 502, 'MODEL_LIST_UNAVAILABLE');
  }
}

async function handle(req: IncomingMessage, res: ServerResponse, endpoint: 'chat' | 'models') {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
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
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RequestError('請求必須為 JSON 物件。');
    if (endpoint === 'models') {
      const models = await listModels(targetUrl(body.baseUrl, 'tags'), controller.signal);
      if (!res.destroyed) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ models }));
      }
      return;
    }
    if (typeof body.model !== 'string' || !body.model.trim() || !Array.isArray(body.messages) ||
        !body.messages.length || body.messages.some((message: unknown) => {
          if (!message || typeof message !== 'object') return true;
          const m = message as Record<string, unknown>;
          return !['system', 'user', 'assistant'].includes(String(m.role)) || typeof m.content !== 'string';
        })) throw new RequestError('Ollama 位址、模型或訊息格式錯誤。');
    const selectedModel = body.model.trim();
    if (controller.signal.aborted) return;
    timer = setTimeout(() => controller.abort(), 120_000);
    const upstream = await fetch(targetUrl(body.baseUrl, 'chat'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel, messages: body.messages, stream: false }),
      signal: controller.signal, redirect: 'error',
    });
    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 400);
      if (upstream.status === 404) throw new RequestError(`Ollama 找不到模型 ${selectedModel}，請重新載入清單並選擇模型。`, 400, 'MODEL_NOT_AVAILABLE');
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
      res.end(JSON.stringify({ error: message, code: error instanceof RequestError ? error.code : undefined }));
    }
  } finally {
    clearTimeout(timer);
    res.off('close', disconnected);
  }
}

export function ollamaProxy(): Plugin {
  const install = (server: { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => unknown } }) => {
    server.middlewares.use((req, res, next) => {
      const path = req.url?.split('?')[0];
      if (path !== '/api/ollama/chat' && path !== '/api/ollama/models') return next();
      void handle(req, res, path === '/api/ollama/models' ? 'models' : 'chat');
    });
  };
  return { name: 'local-ollama-proxy', configureServer: install, configurePreviewServer: install };
}
