import { describe, expect, it } from 'vitest';
import { parse, RegexSyntaxError } from './parser';
import { parseFlags, runMatch } from './matcher';

// 後方参照 \1〜\9 の照合を、ネイティブ RegExp と突き合わせる。3要素目はフラグ。
const CASES: Array<[string, string, string?]> = [
  ['(a)\\1', 'aa'],
  ['(a)\\1', 'ab'],
  ['(\\w)\\1', 'hello'],
  ['(ab)\\1', 'abab'],
  ['(a|b)\\1', 'xbbx'],
  ['(\\w+) \\1', 'the the cat'],
  ['(\\w+) \\1', 'the cat'],
  ['(x*)\\1', 'y'],
  ['(.)(.)\\2\\1', 'abba'],
  ['(a)\\1', 'aA', 'i'],
];

describe('後方参照はネイティブRegExpと一致する', () => {
  for (const [pattern, input, flags = ''] of CASES) {
    const label = flags ? `/${pattern}/${flags}` : `/${pattern}/`;
    it(`${label} に対して ${JSON.stringify(input)}`, () => {
      const native = new RegExp(pattern, flags).exec(input);
      const mine = runMatch(parse(pattern), input, parseFlags(flags));
      if (native === null) {
        expect(mine.matched).toBe(false);
        return;
      }
      expect(mine.matched).toBe(true);
      expect(mine.start).toBe(native.index);
      expect(input.slice(mine.start, mine.end)).toBe(native[0]);
    });
  }
});

describe('後方参照の構文検証', () => {
  it('対応するグループがない後方参照は構文エラー', () => {
    expect(() => parse('\\1')).toThrow(RegexSyntaxError);
    expect(() => parse('(a)\\2')).toThrow(RegexSyntaxError);
  });

  it('前方参照(グループより前に書く)は許す', () => {
    expect(() => parse('\\1(a)')).not.toThrow();
  });

  it('未捕捉の後方参照は空文字に一致する', () => {
    // 選択の未通過側が捕捉していないため \1 は空に一致し、全体は 'b' に一致する。
    const mine = runMatch(parse('(a)?\\1b'), 'b');
    expect(mine.matched).toBe(true);
    expect('b'.slice(mine.start, mine.end)).toBe('b');
  });
});
