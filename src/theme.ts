// テーマの状態管理。auto は OS の配色設定に従い、light / dark は明示指定。
// 値は localStorage に保存し、描画ロジックから切り離してテスト可能にする。

export type Theme = 'auto' | 'light' | 'dark';
export type Resolved = 'light' | 'dark';

const KEY = 'regrail:theme';
const ORDER: readonly Theme[] = ['auto', 'light', 'dark'];

export function isTheme(value: unknown): value is Theme {
  return value === 'auto' || value === 'light' || value === 'dark';
}

// auto を OS 設定で具体化する。data-theme の付与と meta theme-color に使う。
export function resolveTheme(theme: Theme, prefersDark: boolean): Resolved {
  if (theme === 'auto') return prefersDark ? 'dark' : 'light';
  return theme;
}

// 切替ボタンは auto → light → dark → auto の順に巡回する。
export function nextTheme(theme: Theme): Theme {
  return ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]!;
}

export const THEME_LABEL: Record<Theme, string> = {
  auto: '自動',
  light: 'ライト',
  dark: 'ダーク',
};

type ReadStore = Pick<Storage, 'getItem'>;
type WriteStore = Pick<Storage, 'setItem'>;

export function loadTheme(store?: ReadStore): Theme {
  try {
    const value = (store ?? localStorage).getItem(KEY);
    return isTheme(value) ? value : 'auto';
  } catch {
    // localStorage が使えない環境(プライベートモード等)では auto に倒す
    return 'auto';
  }
}

export function saveTheme(theme: Theme, store?: WriteStore): void {
  try {
    (store ?? localStorage).setItem(KEY, theme);
  } catch {
    // 保存できなくても致命的でないため無視する
  }
}
