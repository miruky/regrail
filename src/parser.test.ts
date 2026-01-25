import { describe, expect, it } from 'vitest';
import type { Node } from './ast';
import { parse, RegexSyntaxError } from './parser';

function kinds(node: Node): unknown {
  switch (node.kind) {
    case 'seq':
      return { seq: node.items.map(kinds) };
    case 'alt':
      return { alt: node.options.map(kinds) };
    case 'group':
      return { group: node.index, body: kinds(node.body) };
    case 'repeat':
      return { repeat: `${node.min},${node.max}`, greedy: node.greedy, body: kinds(node.body) };
    case 'literal':
      return node.char;
    case 'class':
      return { class: node.label, neg: node.negated };
    case 'any':
      return '.';
    case 'anchor':
      return node.at;
  }
}

describe('parse 構造', () => {
  it('連接', () => {
    expect(kinds(parse('abc').root)).toEqual({ seq: ['a', 'b', 'c'] });
  });

  it('選択', () => {
    expect(kinds(parse('a|b').root)).toEqual({ alt: ['a', 'b'] });
  });

  it('量指定子', () => {
    expect(kinds(parse('a*').root)).toEqual({ repeat: '0,null', greedy: true, body: 'a' });
    expect(kinds(parse('a+?').root)).toEqual({ repeat: '1,null', greedy: false, body: 'a' });
    expect(kinds(parse('a{2,4}').root)).toEqual({ repeat: '2,4', greedy: true, body: 'a' });
    expect(kinds(parse('a{3}').root)).toEqual({ repeat: '3,3', greedy: true, body: 'a' });
  });

  it('グループと捕捉番号', () => {
    expect(kinds(parse('(a)(b)').root)).toEqual({
      seq: [
        { group: 1, body: 'a' },
        { group: 2, body: 'b' },
      ],
    });
    expect(kinds(parse('(?:a)').root)).toEqual({ group: null, body: 'a' });
  });

  it('文字クラスとアンカー', () => {
    expect(kinds(parse('^[a-z]$').root)).toEqual({
      seq: ['start', { class: '[a-z]', neg: false }, 'end'],
    });
    expect(kinds(parse('[^0-9]').root)).toEqual({ class: '[^0-9]', neg: true });
  });

  it('短縮クラスはクラス扱い', () => {
    expect(kinds(parse('\\d').root)).toEqual({ class: '\\d', neg: false });
  });

  it('{ が数値でなければリテラル', () => {
    expect(kinds(parse('a{x').root)).toEqual({ seq: ['a', '{', 'x'] });
  });
});

describe('parse 異常系', () => {
  it('閉じない括弧', () => {
    expect(() => parse('(a')).toThrow(RegexSyntaxError);
    expect(() => parse('[a')).toThrow(RegexSyntaxError);
  });

  it('対象のない量指定子', () => {
    expect(() => parse('*a')).toThrow(RegexSyntaxError);
  });

  it('余分な閉じ括弧', () => {
    expect(() => parse('a)')).toThrow(RegexSyntaxError);
  });

  it('逆順の繰り返し回数', () => {
    expect(() => parse('a{4,2}')).toThrow(RegexSyntaxError);
  });

  it('未対応のグループ記法', () => {
    expect(() => parse('(?=a)')).toThrow(RegexSyntaxError);
  });
});
