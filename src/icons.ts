// UI で使うモダンSVGアイコン。すべて viewBox 指定・currentColor 追従で、
// 装飾的なものは aria-hidden、意味を持つものは aria-label を付ける。
// 絵文字は使わない。

// 分岐する線路 ── 鉄道図そのものを象ったブランドマーク。
export const BRAND_MARK =
  '<svg viewBox="0 0 32 24" width="30" height="22" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M2 12h6"/>' +
  '<path d="M8 12c3 0 4-5 8-5h6"/>' +
  '<path d="M8 12c3 0 4 5 8 5h6"/>' +
  '<circle cx="2" cy="12" r="1.6" fill="currentColor" stroke="none"/>' +
  '<circle cx="24" cy="7" r="1.6" fill="currentColor" stroke="none"/>' +
  '<circle cx="24" cy="17" r="1.6" fill="currentColor" stroke="none"/>' +
  '</svg>';

// テーマ切替(自動・ライト・ダーク)。shoseki と同系の表現で揃える。
export const THEME_ICONS: Record<'auto' | 'light' | 'dark', string> = {
  auto: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/></svg>',
  light:
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M21.5 12h-2.4M4.9 12H2.5M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3 5.6 5.6"/></svg>',
  dark: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5z"/></svg>',
};

// 共有リンクのアイコンと、コピー完了を示すチェック。
export const LINK_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.5-1.5"/></svg>';

export const CHECK_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.5L19 7"/></svg>';

// ステップ操作のアイコン(先頭へ戻す・一歩戻る・一歩進む)。
export const STEP_RESET_ICON =
  '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5v14"/><path d="M19 6.5 10 12l9 5.5z" fill="currentColor" stroke="none"/></svg>';

export const STEP_PREV_ICON =
  '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6.5 8 12l6.5 5.5z" fill="currentColor" stroke="none"/></svg>';

export const STEP_NEXT_ICON =
  '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 6.5 16 12l-6.5 5.5z" fill="currentColor" stroke="none"/></svg>';
