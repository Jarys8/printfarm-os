import { useCallback } from 'react';
import { useFarm } from '../context/FarmContext';
import { translate } from '../i18n';

export type TFunction = (text: string, vars?: Record<string, string | number>) => string;

/** Returns a translator bound to the farm settings language. */
export function useT(): TFunction {
  const { state } = useFarm();
  const lang = state.settings.language;
  return useCallback<TFunction>((text, vars) => translate(lang, text, vars), [lang]);
}
