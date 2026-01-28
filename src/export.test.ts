import { describe, expect, it } from 'vitest';
import { parse } from './parser';
import { renderRailroad } from './railroad';
import { toStandaloneSvg, type DiagramColors } from './export';

const COLORS: DiagramColors = {
  surface: '#faf8f1',
  ink: '#23272d',
  inkSoft: '#585f68',
  inkFaint: '#8b919b',
  ruleStrong: '#d6d0c2',
  accent: '#2f6d7a',
  accentStrong: '#235862',
  rail: '#aaa597',
  consume: '#3f8060',
};

function exported(pattern: string): string {
  const svg = renderRailroad(parse(pattern)).svg;
  return toStandaloneSvg(svg, `正規表現 /${pattern}/ の鉄道図`, COLORS);
}

describe('toStandaloneSvg', () => {
  it('名前空間・スタイル・タイトル・背景を備えた独立SVGを返す', () => {
    const out = exported('(\\d{4})-(\\d{2})');
    expect(out.startsWith('<svg')).toBe(true);
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(out).toContain('<style>');
    expect(out).toContain('<title>');
    expect(out).toContain('<rect width="100%" height="100%"');
    expect(out).toContain(COLORS.surface);
    expect(out).toContain(COLORS.rail);
  });

  it('元の図のノードを保持する', () => {
    const out = exported('a(b)\\1');
    expect(out).toContain('rr-node');
    expect(out).toContain('rr-backref');
  });

  it('支援技術向けに aria-hidden を外し role=img を付ける', () => {
    const out = exported('abc');
    expect(out).not.toContain('aria-hidden');
    expect(out).toContain('role="img"');
  });

  it('タイトルのXML特殊文字をエスケープする', () => {
    const svg = renderRailroad(parse('a')).svg;
    const out = toStandaloneSvg(svg, '/a<b>&"c"/', COLORS);
    expect(out).toContain('&lt;b&gt;');
    expect(out).not.toContain('<b>');
  });
});
