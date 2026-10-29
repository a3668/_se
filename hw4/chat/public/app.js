const list = document.querySelector('#conversations');
const messages = document.querySelector('#messages');
const welcome = document.querySelector('#welcome');
const input = document.querySelector('#message-input');
const send = document.querySelector('#send');
const newChat = document.querySelector('#new-chat');
const status = document.querySelector('#status');
const title = document.querySelector('#chat-title');
const modelPicker = document.querySelector('#model-picker');
const modelToggle = document.querySelector('#model-toggle');
const modelLabel = document.querySelector('#model-label');
const modelMenu = document.querySelector('#model-menu');
const modelStatus = document.querySelector('#model-status');
const conversationMenu = document.querySelector('#conversation-menu');
const conversationDialog = document.querySelector('#conversation-dialog');
const dialogForm = document.querySelector('#conversation-dialog-form');
const dialogTitle = document.querySelector('#conversation-dialog-title');
const dialogDescription = document.querySelector('#conversation-dialog-description');
const renameField = document.querySelector('#rename-field');
const conversationName = document.querySelector('#conversation-name');
const dialogError = document.querySelector('#conversation-dialog-error');
const dialogSubmit = document.querySelector('#conversation-dialog-submit');
const dialogCancel = document.querySelector('#conversation-dialog-cancel');
const dialogClose = document.querySelector('#conversation-dialog-close');
let conversations = [];
let currentId = null;
let busy = true;
let models = [];
let selectedModel = '';
let conversationMenuTarget = null;
let dialogTarget = null;
let dialogSaving = false;

function hasSelectedModel() {
  return models.includes(selectedModel);
}

function updateModelButton(fallback = '選擇模型') {
  const name = hasSelectedModel() ? selectedModel : '';
  modelLabel.textContent = name
    ? name.split('/').pop().replace(/-cloud$/, '').replace(/:/g, ' ').toUpperCase()
    : fallback;
  modelToggle.title = name || fallback;
  modelToggle.setAttribute('aria-label', name ? `選擇聊天模型，目前為 ${name}` : `選擇聊天模型：${fallback}`);
}

function closeModelMenu(restoreFocus = false) {
  modelMenu.hidden = true;
  modelToggle.setAttribute('aria-expanded', 'false');
  if (restoreFocus && !modelToggle.disabled) modelToggle.focus();
}

function positionModelMenu() {
  if (modelMenu.hidden) return;
  const anchor = modelToggle.getBoundingClientRect();
  const width = Math.min(320, window.innerWidth - 24);
  // 清單獨立於輸入框定位，避免窄螢幕或長名稱將清單推出視窗。
  modelMenu.style.width = `${width}px`;
  modelMenu.style.left = `${Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12))}px`;
  modelMenu.style.bottom = `${window.innerHeight - anchor.top + 10}px`;
  modelMenu.style.maxHeight = `${Math.max(0, Math.min(300, anchor.top - 22))}px`;
}

function focusModelOption(index) {
  const options = modelMenu.querySelectorAll('.model-option');
  const option = options[index];
  if (!option) return;
  option.focus({ preventScroll: true });
  if (option.offsetTop < modelMenu.scrollTop) modelMenu.scrollTop = option.offsetTop;
  else if (option.offsetTop + option.offsetHeight > modelMenu.scrollTop + modelMenu.clientHeight) {
    modelMenu.scrollTop = option.offsetTop + option.offsetHeight - modelMenu.clientHeight;
  }
}

function openModelMenu(index = Math.max(0, models.indexOf(selectedModel))) {
  if (modelToggle.disabled) return;
  closeConversationMenu();
  modelMenu.hidden = false;
  modelToggle.setAttribute('aria-expanded', 'true');
  positionModelMenu();
  focusModelOption(index);
}

function renderModelOptions() {
  modelMenu.replaceChildren();
  models.forEach((name, index) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'model-option';
    option.tabIndex = -1;
    option.dataset.index = String(index);
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(name === selectedModel));
    const check = document.createElement('span');
    check.className = 'model-option-check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = name === selectedModel ? '✓' : '';
    const label = document.createElement('span');
    label.className = 'model-option-name';
    label.textContent = name;
    option.append(check, label);
    option.addEventListener('click', () => {
      if (busy) return;
      selectedModel = name;
      updateModelButton();
      modelStatus.textContent = '';
      modelStatus.classList.remove('error');
      send.disabled = !input.value.trim() || !hasSelectedModel();
      closeModelMenu(true);
      renderModelOptions();
    });
    modelMenu.append(option);
  });
}

function showStatus(text = '', error = false) {
  status.textContent = text;
  status.classList.toggle('error', error);
}

function closeConversationMenu(restoreFocus = false) {
  const target = conversationMenuTarget;
  conversationMenuTarget = null;
  conversationMenu.hidden = true;
  if (!target) return;
  target.button.setAttribute('aria-expanded', 'false');
  target.button.closest('.conversation-row')?.classList.remove('menu-open');
  if (restoreFocus && target.button.isConnected && !target.button.disabled) target.button.focus();
}

function positionConversationMenu() {
  if (!conversationMenuTarget) return;
  const anchor = conversationMenuTarget.button.getBoundingClientRect();
  const bounds = list.getBoundingClientRect();
  if (anchor.bottom <= bounds.top || anchor.top >= bounds.bottom
      || anchor.right <= bounds.left || anchor.left >= bounds.right) {
    closeConversationMenu();
    return;
  }
  const width = Math.min(180, window.innerWidth - 24);
  conversationMenu.style.width = `${width}px`;
  conversationMenu.style.maxHeight = `${Math.max(0, window.innerHeight - 24)}px`;
  conversationMenu.style.left = `${Math.max(12, Math.min(anchor.right + 8, window.innerWidth - width - 12))}px`;
  conversationMenu.style.top = `${Math.max(12, Math.min(anchor.top, window.innerHeight - conversationMenu.offsetHeight - 12))}px`;
}

function openConversationMenu(conversation, button, index = 0) {
  if (busy) return;
  closeConversationMenu();
  closeModelMenu();
  conversationMenuTarget = { id: conversation.id, button };
  button.setAttribute('aria-expanded', 'true');
  button.closest('.conversation-row').classList.add('menu-open');
  conversationMenu.hidden = false;
  positionConversationMenu();
  if (!conversationMenu.hidden) conversationMenu.querySelectorAll('button')[index].focus();
}

function openConversationDialog(action) {
  const conversation = conversations.find((item) => item.id === conversationMenuTarget?.id);
  if (busy || !conversation) return;
  dialogTarget = { id: conversation.id, action };
  closeConversationMenu();
  const rename = action === 'rename';
  dialogTitle.textContent = rename ? '重新命名對話' : '刪除對話';
  dialogDescription.textContent = rename ? '取個簡短、容易辨識的名稱。'
    : `確定要永久刪除「${conversation.title}」及所有訊息嗎？此操作無法復原。`;
  renameField.hidden = !rename;
  conversationName.value = rename ? conversation.title : '';
  conversationName.removeAttribute('aria-invalid');
  dialogError.textContent = '';
  dialogSubmit.textContent = rename ? '儲存' : '刪除';
  dialogSubmit.classList.toggle('danger', !rename);
  conversationDialog.showModal();
  if (rename) {
    conversationName.focus();
    conversationName.select();
  } else dialogCancel.focus();
}

function closeConversationDialog() {
  if (!dialogSaving) conversationDialog.close();
}

function setDialogSaving(value) {
  dialogSaving = value;
  conversationDialog.setAttribute('aria-busy', String(value));
  for (const element of [dialogSubmit, dialogCancel, dialogClose, conversationName]) element.disabled = value;
}

function setBusy(value) {
  busy = value;
  input.disabled = value;
  newChat.disabled = value;
  send.disabled = value || !input.value.trim() || !hasSelectedModel();
  if (value) {
    closeModelMenu();
    closeConversationMenu();
  }
  modelToggle.disabled = value || !models.length;
  messages.setAttribute('aria-busy', String(value));
  for (const button of document.querySelectorAll('.conversation, .conversation-more, [data-prompt]')) button.disabled = value;
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
  closeConversationMenu();
  list.replaceChildren();
  if (!conversations.length) {
    const note = document.createElement('p');
    note.className = 'list-note';
    note.textContent = '還沒有對話，從第一個問題開始。';
    list.append(note);
  }
  for (const conversation of conversations) {
    const row = document.createElement('div');
    row.className = 'conversation-row';
    row.classList.toggle('active', conversation.id === currentId);
    row.dataset.conversationId = String(conversation.id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'conversation';
    button.setAttribute('aria-current', String(conversation.id === currentId));
    button.textContent = conversation.title;
    button.title = conversation.title;
    button.disabled = busy;
    button.addEventListener('click', () => openConversation(conversation.id));
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'conversation-more';
    more.textContent = '⋯';
    more.title = 'More options';
    more.setAttribute('aria-label', `More options：${conversation.title}`);
    more.setAttribute('aria-haspopup', 'menu');
    more.setAttribute('aria-controls', 'conversation-menu');
    more.setAttribute('aria-expanded', 'false');
    more.disabled = busy;
    more.addEventListener('click', () => {
      if (conversationMenuTarget?.id === conversation.id) closeConversationMenu(true);
      else openConversationMenu(conversation, more);
    });
    more.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeConversationMenu(true);
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        openConversationMenu(conversation, more, ['ArrowUp', 'End'].includes(event.key) ? 1 : 0);
      }
    });
    row.append(button, more);
    list.append(row);
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
  if (busy || !content || !hasSelectedModel()) return;
  const requestModel = selectedModel;
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
      body: JSON.stringify({ content, model: requestModel }),
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

conversationMenu.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action) openConversationDialog(action);
});
conversationMenu.addEventListener('keydown', (event) => {
  const items = [...conversationMenu.querySelectorAll('button')];
  const index = items.indexOf(document.activeElement);
  if (event.key === 'Escape') {
    event.preventDefault();
    closeConversationMenu(true);
  } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  }
});
document.addEventListener('pointerdown', (event) => {
  if (conversationMenuTarget && !conversationMenu.contains(event.target)
      && !conversationMenuTarget.button.contains(event.target)) closeConversationMenu();
});
function dismissConversationMenuOnBlur() {
  queueMicrotask(() => {
    if (conversationMenuTarget && !conversationMenu.contains(document.activeElement)
        && !conversationMenuTarget.button.contains(document.activeElement)) closeConversationMenu();
  });
}
conversationMenu.addEventListener('focusout', dismissConversationMenuOnBlur);
list.addEventListener('focusout', dismissConversationMenuOnBlur);
window.addEventListener('resize', positionConversationMenu);
window.addEventListener('scroll', positionConversationMenu, true);

dialogCancel.addEventListener('click', closeConversationDialog);
dialogClose.addEventListener('click', closeConversationDialog);
conversationDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeConversationDialog();
});
conversationDialog.addEventListener('close', () => {
  const id = dialogTarget?.id;
  dialogTarget = null;
  const trigger = list.querySelector(`[data-conversation-id="${id}"] .conversation-more`);
  if (trigger && !trigger.disabled) trigger.focus();
  else if (!newChat.disabled) newChat.focus();
});
conversationName.addEventListener('input', () => {
  conversationName.removeAttribute('aria-invalid');
  dialogError.textContent = '';
});
dialogForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!dialogTarget || dialogSaving || busy) return;
  const { id, action } = dialogTarget;
  const name = conversationName.value.trim();
  if (action === 'rename'
      && (!name || Array.from(name).length > 100 || /[\p{Cc}\u2028\u2029]/u.test(name))) {
    dialogError.textContent = '對話名稱須為單行，且為 1–100 個字元。';
    conversationName.setAttribute('aria-invalid', 'true');
    conversationName.focus();
    return;
  }
  dialogError.textContent = '';
  setDialogSaving(true);
  setBusy(true);
  let success = false;
  try {
    if (action === 'rename') {
      const conversation = await (await api(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: name }),
      })).json();
      conversations = conversations.map((item) => item.id === id ? conversation : item);
      if (currentId === id) title.textContent = conversation.title;
    } else {
      await api(`/api/conversations/${id}`, { method: 'DELETE' });
      conversations = conversations.filter((item) => item.id !== id);
      if (currentId === id) {
        currentId = null;
        title.textContent = '新對話';
        renderMessages([]);
        input.value = '';
        resizeInput();
      }
    }
    renderList();
    showStatus(action === 'rename' ? '對話名稱已更新' : '對話已刪除');
    success = true;
  } catch (error) {
    dialogError.textContent = error.message;
  } finally {
    setDialogSaving(false);
    setBusy(false);
  }
  if (success) closeConversationDialog();
  else (action === 'rename' ? conversationName : dialogCancel).focus();
});

input.addEventListener('input', () => {
  resizeInput();
  send.disabled = busy || !input.value.trim() || !hasSelectedModel();
});
modelToggle.addEventListener('click', () => {
  if (modelMenu.hidden) openModelMenu();
  else closeModelMenu();
});
modelToggle.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modelMenu.hidden) {
    event.preventDefault();
    closeModelMenu(true);
    return;
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const index = event.key === 'Home' ? 0
    : event.key === 'End' ? models.length - 1
      : models.includes(selectedModel) ? models.indexOf(selectedModel)
        : event.key === 'ArrowUp' ? models.length - 1 : 0;
  openModelMenu(index);
});
modelMenu.addEventListener('keydown', (event) => {
  const option = event.target.closest('.model-option');
  if (!option) return;
  const index = Number(option.dataset.index);
  if (event.key === 'Escape') {
    event.preventDefault();
    closeModelMenu(true);
  } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? models.length - 1
      : Math.max(0, Math.min(models.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    focusModelOption(next);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    option.click();
  }
});
document.addEventListener('pointerdown', (event) => {
  if (!modelPicker.contains(event.target)) closeModelMenu();
});
modelPicker.addEventListener('focusout', () => {
  queueMicrotask(() => {
    if (!modelPicker.contains(document.activeElement)) closeModelMenu();
  });
});
window.addEventListener('resize', positionModelMenu);
window.addEventListener('scroll', positionModelMenu, true);
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (!busy && input.value.trim() && hasSelectedModel()) document.querySelector('#composer').requestSubmit();
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
    // 模型服務失敗時，仍獨立載入歷史對話。
    const [configResult, historyResult] = await Promise.allSettled([
      api('/api/config').then((response) => response.json()),
      api('/api/conversations').then((response) => response.json()),
    ]);
    if (configResult.status === 'fulfilled') {
      const config = configResult.value;
      models = config.models;
      input.maxLength = config.maxMessageLength;
      selectedModel = models.includes(config.model) ? config.model : '';
      renderModelOptions();
      updateModelButton(models.length ? '選擇模型' : '無可用模型');
      if (!models.length) {
        modelStatus.textContent = 'Ollama 模型清單為空，請加入模型後重新整理頁面。';
        modelStatus.classList.add('error');
      } else if (!hasSelectedModel()) {
        modelStatus.textContent = '預設模型不在清單中，請選擇模型後再送出訊息。';
      }
    } else {
      updateModelButton('載入失敗');
      modelStatus.textContent = `${configResult.reason.message} 可重新整理頁面再試。`;
      modelStatus.classList.add('error');
    }
    if (historyResult.status === 'rejected') throw historyResult.reason;
    conversations = historyResult.value;
    if (conversations.length) await loadConversation(conversations[0].id);
    else renderList();
    showStatus();
  } catch (error) {
    showStatus(`${error.message} 可重新整理頁面再試。`, true);
  } finally {
    setBusy(false);
  }
}

initialize();
