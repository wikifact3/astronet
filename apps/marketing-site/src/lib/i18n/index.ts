import type { Locale } from './config';
import en from './en.json';
import np from './np.json';

const dicts = { en, np } as const;

type Dict = typeof en;

export function getDict(locale: Locale): Dict {
  return (dicts[locale] ?? dicts.en) as Dict;
}

export function t(
  dict: Dict,
  path: string,
  vars?: Record<string, string | number>,
): string {
  const parts = path.split('.');
  let cur: unknown = dict;
  for (const p of parts) {
    if (typeof cur !== 'object' || cur === null) return path;
    cur = (cur as Record<string, unknown>)[p];
  }
  if (typeof cur !== 'string') return path;
  if (!vars) return cur;
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    cur,
  );
}

export type { Dict };
export { locales, defaultLocale, isLocale } from './config';
export type { Locale } from './config';
