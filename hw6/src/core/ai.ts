import { SYSTEM_PROMPT } from './prompt';
import { emptyRequirements, type Requirements } from './restaurant';
export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface ReceptionResult { requirements: Requirements; reply: string }
export interface OllamaSettings { baseUrl: string; model: string }

export class OllamaApiError extends Error {
  constructor(message: string, public code?: string) { super(message); }
}

async function readEnvelope(response: Response): Promise<Record<string, unknown>> {
  let envelope: unknown;
  try { envelope = await response.json(); }
  catch { throw new Error('本機代理回覆格式錯誤，請使用 npm run dev 或 npm start 提供網頁。'); }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw new Error('Ollama 回覆格式錯誤');
  const data = envelope as Record<string, unknown>;
  if (!response.ok || data.error) {
    throw new OllamaApiError(typeof data.error === 'string' ? data.error : `Ollama HTTP ${response.status}`,
      typeof data.code === 'string' ? data.code : undefined);
  }
  return data;
}

export async function requestModels(baseUrl: string, signal: AbortSignal): Promise<string[]> {
  let url: URL;
  try { url = new URL(baseUrl.trim()); }
  catch { throw new Error('請填寫有效的 Ollama http(s) 位址後再載入模型。'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Ollama 位址須為不含帳密、查詢參數的 http(s) 位址。');
  }
  let response: Response;
  try {
    response = await fetch('/api/ollama/models', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: baseUrl.trim().replace(/\/+$/, '') }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof DOMException && error.name === 'TimeoutError') throw new Error('取得模型清單逾時，請重新載入。');
    throw new Error('無法連接本機代理取得模型清單，請確認網頁服務仍在執行。');
  }
  const data = await readEnvelope(response);
  if (!Array.isArray(data.models) || data.models.some(name => typeof name !== 'string' || !name.trim())) {
    throw new Error('Ollama 傳回的模型清單格式不正確。');
  }
  return [...new Set(data.models as string[])];
}

export function parseResult(content: unknown): ReceptionResult {
  if (typeof content !== 'string') throw new Error('模型未傳回文字內容');
  const text = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('接待回覆必須是 JSON 物件');
  const d = data as Record<string, unknown>;
  if (![...Object.keys(emptyRequirements()), 'reply'].every(field => field in d)) throw new Error('接待回覆缺少需求欄位');
  if (d.party_size !== null && (typeof d.party_size !== 'number' || !Number.isSafeInteger(d.party_size) || d.party_size <= 0)) throw new Error('人數必須是正整數');
  if (d.window_preference !== null && typeof d.window_preference !== 'boolean') throw new Error('靠窗偏好格式錯誤');
  if (typeof d.window_required !== 'boolean' || typeof d.table_required !== 'boolean') throw new Error('必要限制格式錯誤');
  if (d.allow_split !== null && typeof d.allow_split !== 'boolean') throw new Error('分桌意願必須為布林值或 null');
  if (d.table_name !== null && (typeof d.table_name !== 'string' || !/^[ABC][1-7]$/.test(d.table_name))) throw new Error('桌號必須介於 A1～C7');
  if (d.window_required && d.window_preference === null) throw new Error('必要靠窗限制缺少具體條件');
  if (d.table_required && d.table_name === null) throw new Error('必要桌號限制缺少桌號');
  if (!Array.isArray(d.other_requirements) || d.other_requirements.some(item => typeof item !== 'string' || !item.trim())) throw new Error('特殊需求格式錯誤');
  if (typeof d.question !== 'string' || typeof d.reply !== 'string') throw new Error('接待文字格式錯誤');
  const requirements: Requirements = {
    party_size: d.party_size as number | null, window_preference: d.window_preference as boolean | null,
    window_required: d.window_required, table_name: d.table_name as string | null, table_required: d.table_required,
    allow_split: d.allow_split as boolean | null, other_requirements: (d.other_requirements as string[]).map(s => s.trim()),
    question: d.question.trim(),
  };
  if (requirements.party_size !== null && !requirements.other_requirements.length) requirements.question = '';
  if (requirements.party_size === null && !requirements.question) requirements.question = '請問一共有幾位用餐？';
  if (requirements.other_requirements.length && !requirements.question) requirements.question = '目前尚無法保證這些特殊條件，是否可以取消這些條件？';
  return { requirements, reply: requirements.question };
}

export async function requestReception(settings: OllamaSettings, history: ChatMessage[], requirements: Requirements, signal: AbortSignal): Promise<ReceptionResult> {
  // Both the original request and its format retry use the same selection.
  const selected = { baseUrl: settings.baseUrl.trim().replace(/\/+$/, ''), model: settings.model.trim() };
  const messages: ChatMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n目前已確認需求：${JSON.stringify(requirements)}` },
    ...history.map(m => ({ ...m })),
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetch('/api/ollama/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selected, messages }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(130_000)]),
      });
    } catch (error) {
      if (signal.aborted) throw error;
      if (error instanceof DOMException && error.name === 'TimeoutError') throw new Error('Ollama 請求逾時，請稍後重試。');
      throw new Error('無法連接本機代理，請確認網頁服務仍在執行。');
    }
    const data = await readEnvelope(response);
    const message = data.message as Record<string, unknown> | undefined;
    const content = message?.content;
    try { return parseResult(content); }
    catch {
      if (attempt === 1) throw new Error('模型兩次回覆均無法解析，請重試。');
      messages.push({ role: 'assistant', content: typeof content === 'string' ? content : '' },
        { role: 'user', content: '上一則格式無法解析，請依 system 規定重傳完整 JSON，不加 Markdown 或說明。' });
    }
  }
  throw new Error('模型未傳回接待內容。');
}
