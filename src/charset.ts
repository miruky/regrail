import type { CharClass, ShorthandClass } from './ast';

const WORD = /[A-Za-z0-9_]/;
const SPACE = /\s/;

export function matchesShorthand(kind: ShorthandClass, ch: string): boolean {
  switch (kind) {
    case 'd':
      return ch >= '0' && ch <= '9';
    case 'D':
      return !(ch >= '0' && ch <= '9');
    case 'w':
      return WORD.test(ch);
    case 'W':
      return !WORD.test(ch);
    case 's':
      return SPACE.test(ch);
    case 'S':
      return !SPACE.test(ch);
  }
}

export function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && WORD.test(ch);
}

// 否定を外した「素の集合」に ch が含まれるか。
function inSet(node: CharClass, ch: string): boolean {
  for (const item of node.items) {
    if (ch >= item.from && ch <= item.to) return true;
  }
  for (const s of node.shorthand) {
    if (matchesShorthand(s, ch)) return true;
  }
  return false;
}

// 大文字↔小文字を入れ替える。変化しない・複数文字になる場合は元の文字を返す。
function swapCase(ch: string): string {
  const lower = ch.toLowerCase();
  const other = lower === ch ? ch.toUpperCase() : lower;
  return other.length === 1 ? other : ch;
}

// ignoreCase のときは大小を畳んで集合の所属を判定し、そのうえで否定を適用する。
// (JSと同じく [^a-z] の否定は畳み込み後に効くので 'A' は除外される)
export function matchesClass(node: CharClass, ch: string, ignoreCase = false): boolean {
  let hit = inSet(node, ch);
  if (!hit && ignoreCase) {
    const other = swapCase(ch);
    if (other !== ch) hit = inSet(node, other);
  }
  return node.negated ? !hit : hit;
}
