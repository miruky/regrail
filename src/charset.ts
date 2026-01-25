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

export function matchesClass(node: CharClass, ch: string): boolean {
  let hit = false;
  for (const item of node.items) {
    if (ch >= item.from && ch <= item.to) {
      hit = true;
      break;
    }
  }
  if (!hit) {
    for (const s of node.shorthand) {
      if (matchesShorthand(s, ch)) {
        hit = true;
        break;
      }
    }
  }
  return node.negated ? !hit : hit;
}
