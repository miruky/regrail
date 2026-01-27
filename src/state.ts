// 正規表現とテスト文字列を URL ハッシュに載せ、リンクで共有・復元できるようにする。
// URLSearchParams を使い、エスケープを自前で持たない。空文字とキー欠如を区別する。

export interface AppState {
  pattern: string;
  test: string;
  flags?: string;
}

export function encodeState(state: AppState): string {
  const params = new URLSearchParams();
  params.set('re', state.pattern);
  params.set('s', state.test);
  if (state.flags) params.set('f', state.flags);
  return params.toString();
}

// ハッシュ(先頭の # は任意)を解釈する。指定されたキーだけを返し、
// 欠けているキーは呼び出し側の既定値を尊重する。
export function decodeState(hash: string): Partial<AppState> {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const out: Partial<AppState> = {};
  if (params.has('re')) out.pattern = params.get('re') ?? '';
  if (params.has('s')) out.test = params.get('s') ?? '';
  if (params.has('f')) out.flags = params.get('f') ?? '';
  return out;
}
