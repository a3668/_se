import { useCallback, useEffect, useRef, useState } from 'react';
import { requestModels, type OllamaSettings } from './core/ai';

type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error';
interface CatalogState {
  settings: OllamaSettings;
  models: string[];
  status: CatalogStatus;
  error: string;
}

// Owned by App, so neither tab changes nor new customer groups reset the selection.
export function useOllamaModels(busy: boolean) {
  const [state, setState] = useState<CatalogState>({
    settings: { baseUrl: 'http://localhost:11434', model: '' }, models: [], status: 'idle', error: '',
  });
  const current = useRef(state);
  const locked = useRef(busy);
  const preferred = useRef('gpt-oss:120b-cloud');
  const request = useRef<AbortController | null>(null);
  current.current = state;
  locked.current = busy;

  const reload = useCallback(async () => {
    if (locked.current) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const { baseUrl, model } = current.current.settings;
    const wanted = model || preferred.current;
    setState(previous => ({ ...previous, settings: { ...previous.settings, model: '' }, models: [], status: 'loading', error: '' }));
    try {
      const models = await requestModels(baseUrl, controller.signal);
      if (controller.signal.aborted || request.current !== controller) return;
      setState(previous => ({ ...previous, settings: { ...previous.settings, model: models.includes(wanted) ? wanted : '' }, models, status: 'ready', error: '' }));
    } catch (error) {
      if (controller.signal.aborted || request.current !== controller) return;
      setState(previous => ({ ...previous, models: [], status: 'error', error: error instanceof Error ? error.message : '無法取得模型清單，請重新載入。' }));
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, []);

  useEffect(() => {
    void reload();
    const leave = () => {
      if (!request.current) return;
      request.current.abort(); request.current = null;
      setState(previous => ({ ...previous, status: 'idle', models: [], settings: { ...previous.settings, model: '' } }));
    };
    window.addEventListener('pagehide', leave);
    return () => { request.current?.abort(); request.current = null; window.removeEventListener('pagehide', leave); };
  }, [reload]);

  function changeBaseUrl(baseUrl: string) {
    if (locked.current) return;
    request.current?.abort(); request.current = null; preferred.current = '';
    setState({ settings: { baseUrl, model: '' }, models: [], status: 'idle', error: '' });
  }
  function selectModel(model: string) {
    if (locked.current || current.current.status !== 'ready' || !current.current.models.includes(model)) return;
    preferred.current = model;
    setState(previous => ({ ...previous, settings: { ...previous.settings, model } }));
  }
  function invalidateSelection(rejectedModel: string) {
    if (current.current.settings.model !== rejectedModel) return;
    request.current?.abort(); request.current = null;
    setState(previous => ({ ...previous, settings: { ...previous.settings, model: '' }, models: [], status: 'error',
      error: '選擇的模型已不在 Ollama 清單中，請重新載入清單並選擇模型。' }));
  }
  const canSubmit = state.status === 'ready' && state.models.includes(state.settings.model);
  const statusMessage = state.status === 'loading' ? '正在取得 Ollama 模型清單…'
    : state.status === 'error' ? state.error
    : state.status === 'idle' ? '請載入目前服務的模型清單。'
    : !state.models.length ? 'Ollama 模型清單為空，請加入模型後重新載入。'
    : !state.settings.model ? '請選擇模型；不會自動改用其他模型。'
    : `已選擇 ${state.settings.model}，下一筆需求將使用此模型。`;
  return { ...state, canSubmit, statusMessage, reload, changeBaseUrl, selectModel, invalidateSelection };
}

export type OllamaModelCatalog = ReturnType<typeof useOllamaModels>;
