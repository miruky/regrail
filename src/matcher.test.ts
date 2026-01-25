import { describe, expect, it } from 'vitest';
import { parse } from './parser';
import { runMatch } from './matcher';

// 自前マッチャの結果をネイティブRegExpと突き合わせ、対応サブセットでの
// 一致開始/終了/捕捉が一致することを確認する。
const CASES: Array<[string, string]> = [
  ['abc', 'xxabcyy'],
  ['a|b', 'zzbzz'],
  ['a+', 'baaac'],
  ['a*b', 'aaab'],
  ['a*b', 'b'],
  ['colou?r', 'color'],
  ['colou?r', 'colour'],
  ['a{2,3}', 'aaaa'],
  ['a{2,3}?', 'aaaa'],
  ['[a-z]+', '123abc456'],
  ['[^0-9]+', '12ab34'],
  ['\\d{3}-\\d{4}', 'tel 090-1234 end'],
  ['(ab)+', 'abababx'],
  ['(a|b)c', 'bc'],
  ['^\\w+', 'hello world'],
  ['\\bword\\b', 'a word here'],
  ['(\\d+)\\.(\\d+)', 'pi=3.14!'],
  ['a.c', 'axc'],
  ['a.c', 'a\nc'],
  ['(foo|bar)+', 'foobarfoo'],
  ['x*', 'yyy'],
];

describe('runMatch はネイティブRegExpと一致する', () => {
  for (const [pattern, input] of CASES) {
    it(`/${pattern}/ に対して ${JSON.stringify(input)}`, () => {
      const native = new RegExp(pattern).exec(input);
      const mine = runMatch(parse(pattern), input);
      if (native === null) {
        expect(mine.matched).toBe(false);
        return;
      }
      expect(mine.matched).toBe(true);
      expect(mine.start).toBe(native.index);
      expect(input.slice(mine.start, mine.end)).toBe(native[0]);
      // 捕捉グループ
      for (let i = 1; i < native.length; i += 1) {
        const cap = mine.captures.find((c) => c?.index === i);
        if (native[i] === undefined) continue;
        expect(cap).toBeTruthy();
        expect(input.slice(cap!.start, cap!.end)).toBe(native[i]);
      }
    });
  }
});

describe('runMatch trace', () => {
  it('成功時は最後にmatchステップを記録する', () => {
    const result = runMatch(parse('ab'), 'ab');
    expect(result.steps.at(-1)?.action).toBe('match');
    expect(result.steps.some((s) => s.action === 'consume')).toBe(true);
  });

  it('失敗時はmatchedがfalse', () => {
    expect(runMatch(parse('z'), 'abc').matched).toBe(false);
  });

  it('空マッチの繰り返しで無限ループしない', () => {
    const result = runMatch(parse('(a*)*'), 'aaa');
    expect(result.matched).toBe(true);
  });
});
