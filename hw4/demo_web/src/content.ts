export const project = {
  title: 'Docker AI 聊天系統',
  description: '從一個問題開始，看見容器之間的合作。以 Docker Compose 串起網頁、後端與資料庫，透過 主機上的 Ollama，將雲端 AI 帶進自己的聊天空間。',
  tags: ['Docker Compose', 'Nginx', 'Node.js', 'PostgreSQL', 'Ollama'],
  model: 'gpt-oss:120b-cloud',
};

export const navigation = [
  { id: 'architecture', label: '系統架構' },
  { id: 'stack', label: '技術分工' },
  { id: 'features', label: '功能特色' },
  { id: 'gallery', label: '成果截圖' },
  { id: 'commands', label: '使用指令' },
];

export const architecture = {
  browser: { title: '瀏覽器', subtitle: '聊天介面', meta: 'localhost:8080' },
  containers: [
    { title: 'Nginx', subtitle: '靜態檔案 / 反向代理', meta: 'nginx · :80' },
    { title: 'Node.js', subtitle: 'Express / 聊天 API', meta: 'dev-vm · :3000' },
    { title: 'PostgreSQL', subtitle: '對話 / 訊息保存', meta: 'postgres · :5432' },
  ],
  host: { title: 'Ollama', subtitle: '主機上的模型服務', meta: 'host.docker.internal:11434' },
  cloud: { title: 'Ollama Cloud', subtitle: '雲端模型推論', meta: project.model },
};

export const technologies = [
  { code: 'NG', name: 'Nginx', role: '網頁入口', detail: '提供聊天頁的 HTML、CSS 與 JavaScript，並將 /api/ 請求轉送到 Node.js。', note: '對主機 開放 127.0.0.1:8080', color: 'green' },
  { code: 'JS', name: 'Ubuntu + Node.js', role: '應用程式', detail: 'Ubuntu 24.04 容器內執行 Express，管理聊天請求、資料存取與 Ollama 串流回應。', note: 'Ubuntu 24.04 / Express', color: 'blue' },
  { code: 'PG', name: 'PostgreSQL', role: '資料保存', detail: '分別保存對話與訊息，使用獨立的 named volume，讓聊天紀錄保留在容器之外。', note: 'chat-data volume', color: 'purple' },
  { code: 'AI', name: 'Ollama', role: '模型橋接', detail: '在 主機上提供 API，由後端透過 host.docker.internal 連入，再將請求交給雲端模型。', note: project.model, color: 'orange' },
];

export const features = [
  { number: '01', title: '隨時開啟新對話', description: '從新的問題開始，讓不同主題各自保有完整的對話脈絡。' },
  { number: '02', title: '接續歷史紀錄', description: '從側邊欄切換已保存的對話，重新讀取先前的提問與回答。' },
  { number: '03', title: '逐字接收 AI 回答', description: '透過 SSE 串流傳送回答片段，文字隨模型回應逐步呈現。' },
  { number: '04', title: '讓內容自動保存', description: '先保存使用者訊息，AI 完整回答後再保存，交由 PostgreSQL 管理。' },
];

export type Screenshot = {
  id: string;
  title: string;
  description: string;
  image?: string;
  alt: string;
};

// image 使用相對於 public/ 的路徑，例如 screenshots/chat.webp。
// 收到實際截圖後再填入；未填寫時只呈現明確標示的預留區。
export const screenshots: Screenshot[] = [
  { id: 'chat', title: '聊天畫面', description: '展示提問、串流回答與輸入區。', alt: '聊天介面的實際使用截圖' },
  { id: 'history', title: '歷史紀錄', description: '展示側邊欄與已保存的對話。', alt: '歷史對話紀錄的實際使用截圖' },
  { id: 'docker', title: 'Docker 容器', description: '展示這個專案的容器執行情況。', alt: 'Docker 容器的實際執行截圖' },
];

export const commands = [
  { id: 'ollama', title: '啟動 Ollama', location: '主機 · 終端機 A', description: '先確認 Docker 已啟動。在獨立終端機啟動 Ollama，保持服務運作；雲端模型需要網路與可用的登入狀態。若已有 Ollama 服務，請勿重複啟動。', command: 'OLLAMA_HOST=0.0.0.0:11434 OLLAMA_CONTEXT_LENGTH=16384 ollama serve', note: '0.0.0.0 監聽所有 IPv4 網路介面；請勿將 Ollama API 轉送到公開網路。' },
  { id: 'build', title: '建置與啟動', location: '主機 · hw4 目錄 · 終端機 B', description: '首次使用或變更套件、Dockerfile、Compose 設定時，先建置再啟動。', command: './01-build.sh\n./02-run.sh', note: '聊天入口：http://localhost:8080。此展示頁與聊天系統分開執行。' },
  { id: 'start', title: '日常啟動', location: '主機 · hw4 目錄', description: '已有映像時，準備好 Ollama 後啟動整組容器。', command: './02-run.sh' },
  { id: 'attach', title: '進入 Ubuntu', location: '主機 · hw4 目錄', description: '透過專案腳本進入 Ubuntu 開發容器的 Bash。', command: './03-attach.sh', note: '輸入 exit 只會離開 Bash，後端仍繼續運作。' },
  { id: 'stop', title: '停止容器', location: '主機 · hw4 目錄', description: '停止這組服務並保留資料庫中的聊天紀錄。', command: 'docker compose stop' },
];
