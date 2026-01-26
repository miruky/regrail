import { describe, expect, it } from 'vitest';
import { isTheme, loadTheme, nextTheme, resolveTheme, saveTheme } from './theme';

describe('テーマ', () => {
  it('テーマ値を判定する', () => {
    expect(isTheme('auto')).toBe(true);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('sepia')).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it('auto は OS 設定で具体化する', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('巡回順は auto → light → dark → auto', () => {
    expect(nextTheme('auto')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('auto');
  });

  it('モックストアに保存して読み出せる', () => {
    const map = new Map<string, string>();
    const store = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    };
    expect(loadTheme(store)).toBe('auto');
    saveTheme('dark', store);
    expect(loadTheme(store)).toBe('dark');
  });

  it('保存値が不正なら auto に倒す', () => {
    expect(loadTheme({ getItem: () => 'bogus' })).toBe('auto');
  });
});
