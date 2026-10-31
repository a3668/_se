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
    if (locked.current || request.current) return;
    const controller = new AbortController(); request.current = controller;
    const { baseUrl } = current.current.settings;
    setState(previous => ({ ...previous, status: 'loading', error: '' }));
    try {
      const models = await requestModels(baseUrl, controller.signal);
      if (controller.signal.aborted || request.current !== controller) return;
      setState(previous => {
        const wanted = previous.settings.model || preferred.current;
        return { ...previous, settings: { ...previous.settings, model: models.includes(wanted) ? wanted : '' }, models, status: 'ready', error: '' };
      });
    } catch (error) {
      if (controller.signal.aborted || request.current !== controller) return;
      setState(previous => ({ ...previous, status: 'error', error: error instanceof Error ? error.message : '無法取得模型清單，請再次展開選單。' }));
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, []);

  useEffect(() => {
    void reload();
    const leave = () => {
      if (!request.current) return;
      request.current.abort(); request.current = null;
      setState(previous => ({ ...previous, status: previous.models.length ? 'ready' : 'idle' }));
    };
    const resume = (event: PageTransitionEvent) => { if (event.persisted) void reload(); };
    window.addEventListener('pagehide', leave);
    window.addEventListener('pageshow', resume);
    return () => {
      request.current?.abort(); request.current = null;
      window.removeEventListener('pagehide', leave); window.removeEventListener('pageshow', resume);
    };
  }, [reload]);

  function selectModel(model: string) {
    if (locked.current || !current.current.models.includes(model)) return;
    preferred.current = model;
    setState(previous => ({ ...previous, settings: { ...previous.settings, model } }));
  }
  function invalidateSelection(rejectedModel: string) {
    if (current.current.settings.model !== rejectedModel) return;
    request.current?.abort(); request.current = null;
    preferred.current = '';
    setState(previous => ({ ...previous, settings: { ...previous.settings, model: '' }, models: previous.models.filter(model => model !== rejectedModel), status: 'error',
      error: '模型無法使用，請選擇其他模型。' }));
  }
  const canSubmit = state.models.includes(state.settings.model);
  const statusMessage = state.status === 'loading' ? '正在載入模型…'
    : state.status === 'error' ? state.error
    : state.status === 'idle' ? '請展開選單載入模型。'
    : !state.models.length ? 'Ollama 沒有可用模型。'
    : !state.settings.model ? '請選擇模型。' : '';
  return { ...state, canSubmit, statusMessage, reload, selectModel, invalidateSelection };
}

export type OllamaModelCatalog = ReturnType<typeof useOllamaModels>;
