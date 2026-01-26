// 正規表現の抽象構文木。各ノードに一意のidを振り、鉄道図の描画と
// マッチtrace のハイライトを同じidで結びつける。

export type Node = Literal | AnyChar | CharClass | Anchor | Group | Alternation | Sequence | Repeat;

export interface Base {
  id: number;
}

export interface Literal extends Base {
  kind: 'literal';
  char: string;
}

export interface AnyChar extends Base {
  kind: 'any';
}

export interface ClassItem {
  // 単一文字なら from === to
  from: string;
  to: string;
}

export interface CharClass extends Base {
  kind: 'class';
  negated: boolean;
  items: ClassItem[];
  // \d \w \s などの短縮クラス(表示と判定に使う)
  shorthand: ShorthandClass[];
  label: string; // 図に出す表記(例: [a-z0-9])
}

export type ShorthandClass = 'd' | 'D' | 'w' | 'W' | 's' | 'S';

export interface Anchor extends Base {
  kind: 'anchor';
  at: 'start' | 'end' | 'wordBoundary' | 'nonWordBoundary';
}

export interface Group extends Base {
  kind: 'group';
  capturing: boolean;
  index: number | null; // capturing のときの番号
  body: Node;
}

export interface Alternation extends Base {
  kind: 'alt';
  options: Node[];
}

export interface Sequence extends Base {
  kind: 'seq';
  items: Node[];
}

export interface Repeat extends Base {
  kind: 'repeat';
  body: Node;
  min: number;
  max: number | null; // null は無限
  greedy: boolean;
}

export interface Pattern {
  root: Node;
  groupCount: number;
}
