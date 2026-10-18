const express = require('express');
const { Pool } = require('pg');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const app = express();
const pool = new Pool({ connectionTimeoutMillis: 5000 });
const model = process.env.OLLAMA_MODEL || 'gpt-oss:120b-cloud';
const ollamaUrl = new URL('/api/chat', process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434');
const active = new Map();
const maxMessageLength = 16000;

app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  // 僅接受同源網頁的寫入，不開放跨來源 CORS。
  const origin = req.get('origin');
  if (req.method === 'POST' && origin) {
    try {
      if (new URL(origin).host !== req.get('host')) {
        return res.status(403).json({ error: '請從聊天網頁送出請求。' });
      }
    } catch {
      return res.status(403).json({ error: '請求來源不正確。' });
    }
  }
  next();
});

app.get('/api/config', (req, res) => {
  res.json({ model, maxMessageLength });
});

app.get('/api/conversations', async (req, res) => {
  const result = await pool.query('SELECT * FROM conversations ORDER BY updated_at DESC, id DESC');
  res.json(result.rows);
});

app.post('/api/conversations', async (req, res) => {
  const result = await pool.query('INSERT INTO conversations DEFAULT VALUES RETURNING *');
  res.status(201).json(result.rows[0]);
});

app.param('id', (req, res, next, value) => {
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 2147483647) {
    return res.status(400).json({ error: '對話編號不正確。' });
  }
  req.conversationId = Number(value);
  next();
});

app.get('/api/conversations/:id/messages', async (req, res) => {
  const conversation = await pool.query('SELECT * FROM conversations WHERE id = $1', [req.conversationId]);
  if (!conversation.rowCount) return res.status(404).json({ error: '找不到這段對話。' });
  const messages = await pool.query(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY id', [req.conversationId],
  );
  res.json({ conversation: conversation.rows[0], messages: messages.rows });
});

async function sendEvent(res, event, data) {
  if (res.destroyed || res.writableEnded) throw new Error('連線已中斷。');
  if (!res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) {
    // 等待 drain 時也必須處理瀏覽器離線，避免請求一直佔用中。
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        res.off('drain', onDrain);
        res.off('close', onClose);
        res.off('error', onError);
      };
      const onDrain = () => { cleanup(); resolve(); };
      const onClose = () => { cleanup(); reject(new Error('連線已中斷。')); };
      const onError = (error) => { cleanup(); reject(error); };
      res.once('drain', onDrain);
      res.once('close', onClose);
      res.once('error', onError);
    });
  }
}

async function* readOllama(body) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line);
    }
    if (buffer.length > 2 * 1024 * 1024) throw new Error('模型回應格式過大。');
  }
  buffer += decoder.decode();
  if (buffer.trim()) yield JSON.parse(buffer);
}

app.post('/api/conversations/:id/messages', async (req, res) => {
  const id = req.conversationId;
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (!content || content.length > maxMessageLength) {
    return res.status(400).json({ error: `請輸入 1 至 ${maxMessageLength} 個字元的訊息。` });
  }
  if (active.has(id)) {
    return res.status(409).json({ error: '這段對話正在產生回答，請稍後再送出。' });
  }

  const controller = new AbortController();
  active.set(id, controller);
  const timeout = setTimeout(() => controller.abort(), 600000);
  const onClose = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.on('close', onClose);
  let heartbeat;
  let client;
  let transaction = false;
  try {
    client = await pool.connect();
    const conversation = await client.query('SELECT id FROM conversations WHERE id = $1', [id]);
    if (!conversation.rowCount) return res.status(404).json({ error: '找不到這段對話。' });
    if (controller.signal.aborted) return;

    await client.query('BEGIN');
    transaction = true;
    const user = await client.query(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING *',
      [id, 'user', content],
    );
    await client.query(
      `UPDATE conversations SET updated_at = NOW(),
       title = CASE WHEN (SELECT COUNT(*) FROM messages WHERE conversation_id = $1) = 1
                    THEN $2 ELSE title END WHERE id = $1`,
      [id, Array.from(content.replace(/\s+/g, ' ')).slice(0, 32).join('')],
    );
    await client.query('COMMIT');
    transaction = false;
    const history = await client.query(
      'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY id', [id],
    );
    client.release();
    client = null;

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    await sendEvent(res, 'user', user.rows[0]);
    heartbeat = setInterval(() => {
      if (!res.destroyed && !res.writableEnded) res.write(': waiting\n\n');
    }, 15000);

    let upstream;
    try {
      upstream = await fetch(ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: history.rows, stream: true }),
        signal: controller.signal,
      });
    } catch {
      throw new Error(controller.signal.aborted
        ? '等待回答逾時或連線中斷。'
        : '無法連接 Mac 的 Ollama，請確認服務與容器可連線的監聽設定。');
    }
    if (!upstream.ok) {
      await upstream.body?.cancel();
      if ([401, 403].includes(upstream.status)) {
        throw new Error('Ollama 授權失敗，請確認本機已登入並可使用 cloud 模型。');
      }
      if (upstream.status === 404) throw new Error(`Ollama 找不到模型 ${model}，請確認模型設定。`);
      throw new Error(`Ollama 暫時無法回答（HTTP ${upstream.status}），請確認模型及雲端使用狀態。`);
    }
    if (!upstream.body) throw new Error('Ollama 沒有傳回回答。');

    let answer = '';
    let complete = false;
    for await (const part of readOllama(upstream.body)) {
      if (part.error) throw new Error('Ollama 回報錯誤，請確認模型、網路及雲端使用狀態。');
      const text = part.message?.content;
      if (typeof text === 'string' && text) {
        answer += text;
        if (answer.length > 1024 * 1024) throw new Error('回答過長，已停止接收；請縮小提問範圍。');
        await sendEvent(res, 'delta', { content: text });
      }
      if (part.done === true) {
        complete = true;
        break;
      }
    }
    if (controller.signal.aborted) throw new Error('等待回答逾時或連線中斷。');
    if (!complete || !answer.trim()) throw new Error('回答未完成或沒有文字內容，未保存 AI 回答。');

    client = await pool.connect();
    await client.query('BEGIN');
    transaction = true;
    const saved = await client.query(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING *',
      [id, 'assistant', answer],
    );
    await client.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [id]);
    await client.query('COMMIT');
    transaction = false;
    await sendEvent(res, 'done', saved.rows[0]);
  } catch (error) {
    if (transaction && client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    if (!res.destroyed && !res.writableEnded) {
      const message = error.code || error instanceof SyntaxError
        ? '資料庫或模型回應發生錯誤，請稍後再試。'
        : controller.signal.aborted ? '等待回答逾時或連線中斷。' : error.message;
      if (res.headersSent) {
        await sendEvent(res, 'error', { error: message }).catch(() => {});
      } else {
        res.status(503).json({ error: '暫時無法保存訊息，請稍後再試。' });
      }
    }
    console.error('聊天請求失敗：', error.code || error.name);
  } finally {
    clearTimeout(timeout);
    clearInterval(heartbeat);
    controller.abort();
    res.off('close', onClose);
    client?.release();
    active.delete(id);
    if (!res.writableEnded && !res.destroyed) res.end();
  }
});

app.use('/api', (req, res) => res.status(404).json({ error: '找不到這個 API。' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.too.large') return res.status(413).json({ error: '訊息內容過大。' });
  if (error instanceof SyntaxError && error.status === 400) {
    return res.status(400).json({ error: '訊息格式不正確。' });
  }
  console.error('API 請求失敗：', error.code || error.name);
  res.status(503).json({ error: '資料庫暫時無法使用，請稍後再試。' });
});

pool.on('error', (error) => console.error('資料庫連線中斷：', error.code || error.name));

async function start() {
  // 同一份 SQL 供首次建立 volume 與後端啟動使用，既有資料不會刪除。
  const schema = await readFile(path.join(__dirname, 'db/init.sql'), 'utf8');
  for (let attempt = 1; ; attempt += 1) {
    try {
      await pool.query(schema);
      break;
    } catch (error) {
      if (attempt >= 30) throw error;
      console.log('等待 PostgreSQL 就緒…');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  const server = app.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
    console.log('聊天後端已啟動，模型：', model);
  });
  const shutdown = () => {
    for (const controller of active.values()) controller.abort();
    server.close(() => pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((error) => {
  console.error('後端無法啟動：', error.code || error.name);
  pool.end().finally(() => process.exit(1));
});
