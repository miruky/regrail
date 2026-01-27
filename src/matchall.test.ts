import { describe, expect, it } from 'vitest';
import { parse } from './parser';
import { parseFlags, runMatchAll } from './matcher';

// 全件照合(runMatchAll)を、ネイティブ RegExp の g フラグつき matchAll と
// 突き合わせる。件数・各一致の範囲・捕捉が一致することを確認する。3要素目はフラグ。
const CASES: Array<[string, string, string?]> = [
  ['a', 'aba'],
  ['\\d+', '12 and 345 and 6'],
  ['[a-z]+', '1ab2cde3'],
  ['(\\d)(\\d)', '12 34 56'],
  ['\\bsh\\w*', 'she sells shells'],
  ['a|b', 'cabbac'],
  ['colou?r', 'color colour color'],
  ['#[0-9a-f]{3}', '#abc #def x #123'],
  ['x*', 'axbxc'],
  ['', 'abc'],
  ['z', 'abc'],
  ['^\\w+', 'foo\nbar\nbaz', 'm'],
  ['ABC', 'abc ABC AbC', 'i'],
];

describe('runMatchAll はネイティブの g 照合と一致する', () => {
  for (const [pattern, input, flags = ''] of CASES) {
    const label = flags ? `/${pattern}/${flags}g` : `/${pattern}/g`;
    it(`${label} に対して ${JSON.stringify(input)}`, () => {
      const native = [...input.matchAll(new RegExp(pattern, flags + 'g'))];
      const mine = runMatchAll(parse(pattern), input, parseFlags(flags));
      expect(mine.matches.length).toBe(native.length);
      native.forEach((nm, i) => {
        const m = mine.matches[i]!;
        expect(m.start).toBe(nm.index);
        expect(input.slice(m.start, m.end)).toBe(nm[0]);
        for (let g = 1; g < nm.length; g += 1) {
          if (nm[g] === undefined) continue;
          const cap = m.captures.find((c) => c?.index === g);
          expect(cap).toBeTruthy();
          expect(input.slice(cap!.start, cap!.end)).toBe(nm[g]);
        }
      });
    });
  }
});

describe('runMatchAll の縁', () => {
  it('一致がないときは firstSteps に試行traceを残す', () => {
    const run = runMatchAll(parse('z'), 'abc');
    expect(run.matches).toHaveLength(0);
    expect(run.firstSteps.length).toBeGreaterThan(0);
  });

  it('一致があるときは firstSteps は空', () => {
    const run = runMatchAll(parse('a'), 'aaa');
    expect(run.matches).toHaveLength(3);
    expect(run.firstSteps).toHaveLength(0);
  });

  it('空一致は位置を1つずつ進めて列挙する', () => {
    const run = runMatchAll(parse('a*'), 'bb');
    // 位置 0,1,2 の3件の空一致(ネイティブと同じ)
    expect(run.matches.map((m) => [m.start, m.end])).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
  });
});
