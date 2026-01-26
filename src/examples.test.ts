import { describe, expect, it } from 'vitest';
import { EXAMPLES } from './examples';
import { parse } from './parser';
import { runMatch } from './matcher';

// サンプルが対応サブセットから外れていないこと、表示しているテスト文字列に
// 実際に一致すること、結果がネイティブ RegExp と揃うことを保証する。
describe('サンプルパターン', () => {
  for (const ex of EXAMPLES) {
    it(`${ex.name} /${ex.pattern}/ がテスト文字列に一致する`, () => {
      const native = new RegExp(ex.pattern).exec(ex.test);
      const mine = runMatch(parse(ex.pattern), ex.test);
      expect(native).not.toBeNull();
      expect(mine.matched).toBe(true);
      expect(ex.test.slice(mine.start, mine.end)).toBe(native![0]);
    });
  }

  it('名前は重複しない', () => {
    const names = EXAMPLES.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
