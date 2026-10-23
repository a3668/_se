const list = document.querySelector('#conversations');
const messages = document.querySelector('#messages');
const welcome = document.querySelector('#welcome');
const input = document.querySelector('#message-input');
const send = document.querySelector('#send');
const newChat = document.querySelector('#new-chat');
const status = document.querySelector('#status');
const title = document.querySelector('#chat-title');
let conversations = [];
let currentId = null;
let busy = true;

function showStatus(text = '', error = false) {
  status.textContent = text;
  status.classList.toggle('error', error);
}

function setBusy(value) {
  busy = value;
  input.disabled = value;
  newChat.disabled = value;
  send.disabled = value || !input.value.trim();
  messages.setAttribute('aria-busy', String(value));
  for (const button of document.querySelectorAll('.conversation, [data-prompt]')) button.disabled = value;
}

async function api(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error('無法連接聊天服務，請稍後再試。');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `聊天服務暫時無法使用（HTTP ${response.status}）。`);
  }
  return response;
}

function renderList() {
  list.replaceChildren();
  if (!conversations.length) {
    const note = document.createElement('p');
    note.className = 'list-note';
    note.textContent = '還沒有對話，從第一個問題開始。';
    list.append(note);
  }
  for (const conversation of conversations) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'conversation';
    button.classList.toggle('active', conversation.id === currentId);
    button.setAttribute('aria-current', String(conversation.id === currentId));
    button.textContent = conversation.title;
    button.title = conversation.title;
    button.disabled = busy;
    button.addEventListener('click', () => openConversation(conversation.id));
    list.append(button);
  }
}

async function refreshList() {
  conversations = await (await api('/api/conversations')).json();
  renderList();
  const current = conversations.find((conversation) => conversation.id === currentId);
  if (current) title.textContent = current.title;
}

function scrollToEnd() {
  messages.scrollTop = messages.scrollHeight;
}

function addMessage(role, content) {
  welcome.hidden = true;
  const article = document.createElement('article');
  article.className = `message ${role}`;
  const label = document.createElement('div');
  label.className = 'message-label';
  label.textContent = role === 'user' ? '你' : '✦ Shain Chat';
  const body = document.createElement('div');
  body.className = 'message-content';
  // 使用 textContent，訊息中的 HTML 與程式碼皆以純文字呈現。
  body.textContent = content;
  article.append(label, body);
  messages.append(article);
  scrollToEnd();
  return { article, label, body };
}

function renderMessages(items) {
  for (const element of messages.querySelectorAll('.message')) element.remove();
  welcome.hidden = items.length > 0;
  for (const message of items) addMessage(message.role, message.content);
}

async function loadConversation(id) {
  const data = await (await api(`/api/conversations/${id}/messages`)).json();
  currentId = data.conversation.id;
  title.textContent = data.conversation.title;
  renderMessages(data.messages);
  renderList();
}

async function openConversation(id) {
  if (busy) return;
  setBusy(true);
  showStatus('正在載入對話…');
  try {
    await loadConversation(id);
    input.value = '';
    resizeInput();
    showStatus();
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setBusy(false);
  }
}

async function createConversation() {
  const conversation = await (await api('/api/conversations', { method: 'POST' })).json();
  currentId = conversation.id;
  title.textContent = conversation.title;
  conversations.unshift(conversation);
  renderList();
  renderMessages([]);
}

newChat.addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  showStatus('正在建立對話…');
  try {
    await createConversation();
    input.value = '';
    resizeInput();
    showStatus();
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setBusy(false);
    input.focus();
  }
});

async function readEvents(response, onEvent) {
  if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) {
    throw new Error('聊天服務沒有傳回串流，請稍後再試。');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = block.split('\n').find((line) => line.startsWith('event: '))?.slice(7);
        const data = block.split('\n').find((line) => line.startsWith('data: '))?.slice(6);
        if (event && data) onEvent(event, JSON.parse(data));
      }
      if (done) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

document.querySelector('#composer').addEventListener('submit', async (event) => {
  event.preventDefault();
  const content = input.value.trim();
  if (busy || !content) return;
  setBusy(true);
  showStatus('正在儲存訊息…');
  let assistant;
  let complete = false;
  let userSaved = false;
  try {
    if (currentId === null) await createConversation();
    const response = await api(`/api/conversations/${currentId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    await readEvents(response, (type, data) => {
      if (type === 'user') {
        userSaved = true;
        addMessage('user', data.content);
        input.value = '';
        resizeInput();
        assistant = addMessage('assistant', '');
        assistant.article.classList.add('pending');
        showStatus('AI 正在思考，請稍候…');
      } else if (type === 'delta' && assistant) {
        assistant.body.textContent += data.content;
        showStatus('正在接收回答…');
        scrollToEnd();
      } else if (type === 'done' && assistant) {
        assistant.body.textContent = data.content;
        assistant.article.classList.remove('pending');
        complete = true;
        showStatus('對話已保存');
      } else if (type === 'error') {
        throw new Error(data.error);
      }
    });
    if (!complete) throw new Error('回答連線已中斷。');
  } catch (error) {
    if (assistant && !complete) {
      assistant.article.classList.remove('pending');
      assistant.article.classList.add('incomplete');
      assistant.label.textContent = '✦ Shain Chat · 回答未完成，未確認保存';
      if (!assistant.body.textContent) assistant.article.remove();
    }
    const note = userSaved
      ? ' 你的訊息已保存；可重新開啟此對話讀取資料庫中的紀錄。'
      : ' 可重新開啟對話查看是否已有保存，再決定是否送出。';
    showStatus(error.message + note, true);
  } finally {
    try {
      await refreshList();
    } catch {
      if (complete) showStatus('回答已保存，但對話列表暫時無法更新。', true);
    }
    setBusy(false);
    input.focus();
  }
});

function resizeInput() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
}

input.addEventListener('input', () => {
  resizeInput();
  send.disabled = busy || !input.value.trim();
});
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (!busy && input.value.trim()) document.querySelector('#composer').requestSubmit();
  }
});
for (const button of document.querySelectorAll('[data-prompt]')) {
  button.addEventListener('click', () => {
    if (busy) return;
    input.value = button.dataset.prompt;
    input.dispatchEvent(new Event('input'));
    input.focus();
  });
}

async function initialize() {
  try {
    const [config, history] = await Promise.all([
      api('/api/config').then((response) => response.json()),
      api('/api/conversations').then((response) => response.json()),
    ]);
    document.querySelector('#model').textContent = config.model;
    input.maxLength = config.maxMessageLength;
    conversations = history;
    if (history.length) await loadConversation(history[0].id);
    else renderList();
    showStatus();
  } catch (error) {
    showStatus(`${error.message} 可重新整理頁面再試。`, true);
  } finally {
    setBusy(false);
  }
}

initialize();
