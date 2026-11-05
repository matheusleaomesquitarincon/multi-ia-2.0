// Busca os dados de uma tela e busca de novo quando eles mudam (o servidor avisa ao fim de uma ação).

import { useEffect, useState } from "react";
import { fetchView, REFRESH_EVENT } from "./api.js";

/**
 * @param {string} url
 * @param {{ keepOnError?: boolean }} [options] keepOnError: uma falha não vai para a tela de erro.
 * @returns {{ data: any, loading: boolean, failed: boolean }}
 */
export function useView(url, options = {}) {
  const { keepOnError = false } = options;
  const [state, setState] = useState({ url, data: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    const load = () => {
      fetchView(url).then(
        (data) => active && setState({ url, data, loading: false, error: null }),
        (error) => active && setState((current) => ({ ...current, url, loading: false, error })),
      );
    };
    load();
    window.addEventListener(REFRESH_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(REFRESH_EVENT, load);
    };
  }, [url]);

  // Os dados de outro endereço não valem para este: enquanto o novo não chega, é como se estivesse abrindo.
  if (state.url !== url) return { data: null, loading: true, failed: false };
  if (state.error && !keepOnError) throw state.error;
  return { data: state.data, loading: state.loading, failed: Boolean(state.error) };
}
