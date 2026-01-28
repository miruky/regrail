// 初見でも要点が伝わる、対応サブセット内のサンプル。記法の幅と
// 貪欲・非貪欲やアンカーの違いが分かるものを選ぶ。examples.test.ts で
// すべてがネイティブ RegExp と一致することを検証している。

export interface Example {
  name: string;
  pattern: string;
  test: string;
  note: string;
}

export const EXAMPLES: readonly Example[] = [
  {
    name: 'ISO日付',
    pattern: '(\\d{4})-(\\d{2})-(\\d{2})',
    test: '提出期限は 2026-06-12 です',
    note: '捕捉グループで年・月・日を分解する',
  },
  {
    name: 'メール風',
    pattern: '[\\w.+-]+@[\\w-]+\\.[a-z]{2,}',
    test: '連絡は hello.test@example.com へ',
    note: '文字クラスと短縮クラスの組み合わせ',
  },
  {
    name: '電話番号',
    pattern: '0\\d{1,4}-\\d{1,4}-\\d{4}',
    test: '代表 03-1234-5678 まで',
    note: '量指定子の回数範囲で桁数に幅を持たせる',
  },
  {
    name: '16進カラー',
    pattern: '#([\\dA-Fa-f]{6}|[\\dA-Fa-f]{3})',
    test: '背景に #1A2B3C を使う',
    note: '選択で6桁と3桁を切り替える',
  },
  {
    name: '最短一致',
    pattern: '".*?"',
    test: '"foo" と "bar" を引用',
    note: '非貪欲の ? で最初の閉じ引用符まで',
  },
  {
    name: '単語境界',
    pattern: '\\bsh\\w*',
    test: 'she sells shells',
    note: '\\b で語の先頭からだけ照合する',
  },
  {
    name: '重複語',
    pattern: '(\\w+) \\1',
    test: 'the the cat sat',
    note: '後方参照 \\1 で直前の語の繰り返しを捕まえる',
  },
];
