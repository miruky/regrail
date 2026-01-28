// 鉄道図を、単体で開けるSVGファイルとして書き出す。
// 画面ではCSSクラスで彩色しているため、書き出し時は現在のテーマの色を
// <style> に焼き込み、背景を塗った独立SVGにする。

export interface DiagramColors {
  surface: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  ruleStrong: string;
  accent: string;
  accentStrong: string;
  rail: string;
  consume: string;
}

const MONO = "'SFMono-Regular', Menlo, Consolas, monospace";
const SANS = "'Hiragino Sans', 'Noto Sans JP', system-ui, sans-serif";

function styleBlock(c: DiagramColors): string {
  return [
    `.rr-line{fill:none;stroke:${c.rail};stroke-width:2}`,
    `.rr-term{fill:${c.accent}}`,
    `.rr-node rect{fill:${c.surface};stroke:${c.ruleStrong};stroke-width:1.5}`,
    `.rr-node text{fill:${c.ink};font-family:${MONO};font-size:14px;text-anchor:middle;dominant-baseline:central}`,
    `.rr-anchor rect{stroke:${c.accent}}`,
    `.rr-class rect{stroke:${c.consume}}`,
    `.rr-backref rect{stroke:${c.accent};stroke-dasharray:5 3}`,
    `.rr-backref text{fill:${c.accentStrong}}`,
    `.rr-group{fill:none;stroke:${c.ruleStrong};stroke-width:1.3;stroke-dasharray:4 5}`,
    `.rr-group-label{fill:${c.inkFaint};font-family:${SANS};font-size:10.5px;letter-spacing:.1em}`,
    `.rr-quant{fill:${c.inkSoft};font-family:${SANS};font-size:11px;text-anchor:middle}`,
  ].join('');
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 画面の鉄道図SVG文字列を、スタイル・背景・タイトルを内蔵した独立SVGに変換する。
export function toStandaloneSvg(innerSvg: string, label: string, colors: DiagramColors): string {
  const opened = innerSvg.replace(' aria-hidden="true"', '').replace(/^<svg /, '<svg role="img" ');
  const inject =
    `<title>${escapeXml(label)}</title>` +
    `<style>${styleBlock(colors)}</style>` +
    `<rect width="100%" height="100%" fill="${colors.surface}"/>`;
  return opened.replace(/(<svg[^>]*>)/, `$1${inject}`);
}
