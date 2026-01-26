import type { Node, Pattern } from './ast';

// ASTを鉄道図(railroad diagram)としてレイアウトし、SVG文字列を生成する。
// 各ノードは entry(左)と exit(右)を縦中心 cy に持ち、連結は中心線同士の
// 水平線で結ぶ。選択は左右のフォークで分岐し、繰り返しは上の戻り弧、
// 任意は下のバイパス弧で表す。終端ボックスには data-node-id を付け、
// マッチtrace のハイライトに使う。

const BOX_H = 34;
const CHAR_W = 8.4;
const TEXT_PAD = 14;
const MIN_BOX_W = 26;
const H_GAP = 18;
const V_GAP = 14;
const FORK = 24;
const ARC = 18;
const GROUP_PADX = 14;
const GROUP_TOP = 24;
const GROUP_BOT = 12;
const TERM_R = 7;

interface Layout {
  w: number;
  h: number;
  cy: number;
  draw: (x: number, y: number) => string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function terminalLabel(node: Node): { text: string; cls: string } {
  switch (node.kind) {
    case 'literal':
      return { text: visibleChar(node.char), cls: 'rr-lit' };
    case 'any':
      return { text: '任意の1文字', cls: 'rr-any' };
    case 'class':
      return { text: node.label, cls: 'rr-class' };
    case 'anchor':
      return { text: anchorText(node.at), cls: 'rr-anchor' };
    default:
      return { text: '', cls: '' };
  }
}

function visibleChar(ch: string): string {
  const map: Record<string, string> = { ' ': '␣', '\n': '\\n', '\t': '\\t', '\r': '\\r' };
  return map[ch] ?? ch;
}

function anchorText(at: string): string {
  switch (at) {
    case 'start':
      return '行頭';
    case 'end':
      return '行末';
    case 'wordBoundary':
      return '単語境界';
    default:
      return '非単語境界';
  }
}

function box(node: Node): Layout {
  const { text, cls } = terminalLabel(node);
  const w = Math.max(MIN_BOX_W, text.length * CHAR_W + TEXT_PAD);
  return {
    w,
    h: BOX_H,
    cy: BOX_H / 2,
    draw: (x, y) =>
      `<g class="rr-node ${cls}" data-node-id="${node.id}">` +
      `<rect x="${x}" y="${y}" width="${w}" height="${BOX_H}" rx="8"/>` +
      `<text x="${x + w / 2}" y="${y + BOX_H / 2}">${esc(text)}</text></g>`,
  };
}

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `<path class="rr-line" d="M${x1} ${y1} L${x2} ${y2}"/>`;
}

function layout(node: Node): Layout {
  switch (node.kind) {
    case 'literal':
    case 'any':
    case 'class':
    case 'anchor':
      return box(node);
    case 'seq':
      return layoutSeq(node.items);
    case 'group':
      return layoutGroup(node);
    case 'alt':
      return layoutAlt(node.options);
    case 'repeat':
      return layoutRepeat(node);
  }
}

function layoutSeq(items: Node[]): Layout {
  if (items.length === 0) {
    // 空の式・空グループは何も消費しない。箱を置かず一本の線で通り抜けを表す。
    const w = 44;
    return {
      w,
      h: BOX_H,
      cy: BOX_H / 2,
      draw: (x, y) => line(x, y + BOX_H / 2, x + w, y + BOX_H / 2),
    };
  }
  const parts = items.map(layout);
  const cy = Math.max(...parts.map((p) => p.cy));
  const belowMax = Math.max(...parts.map((p) => p.h - p.cy));
  const h = cy + belowMax;
  const w = parts.reduce((sum, p) => sum + p.w, 0) + H_GAP * (parts.length - 1);
  return {
    w,
    h,
    cy,
    draw: (x, y) => {
      let cx = x;
      let out = '';
      parts.forEach((p, i) => {
        if (i > 0) {
          out += line(cx - H_GAP, y + cy, cx, y + cy);
        }
        out += p.draw(cx, y + cy - p.cy);
        cx += p.w + H_GAP;
      });
      return out;
    },
  };
}

function layoutAlt(options: Node[]): Layout {
  const parts = options.map(layout);
  const innerW = Math.max(...parts.map((p) => p.w));
  const totalH = parts.reduce((sum, p) => sum + p.h, 0) + V_GAP * (parts.length - 1);
  const w = FORK + innerW + FORK;
  const cy = totalH / 2;
  return {
    w,
    h: totalH,
    cy,
    draw: (x, y) => {
      let out = '';
      let oy = y;
      for (const p of parts) {
        const center = oy + p.cy;
        // 左フォーク
        out += `<path class="rr-line" d="M${x} ${y + cy} C${x + FORK / 2} ${y + cy} ${x + FORK / 2} ${center} ${x + FORK} ${center}"/>`;
        const px = x + FORK;
        out += p.draw(px, oy);
        // 幅合わせ
        if (p.w < innerW) out += line(px + p.w, center, px + innerW, center);
        // 右ジョイン
        const rx = x + FORK + innerW;
        out += `<path class="rr-line" d="M${rx} ${center} C${rx + FORK / 2} ${center} ${rx + FORK / 2} ${y + cy} ${rx + FORK} ${y + cy}"/>`;
        oy += p.h + V_GAP;
      }
      return out;
    },
  };
}

function quantLabel(min: number, max: number | null): string {
  if (min === 0 && max === null) return '0回以上';
  if (min === 1 && max === null) return '1回以上';
  if (min === 0 && max === 1) return '任意';
  if (max === null) return `${min}回以上`;
  if (min === max) return `${min}回`;
  return `${min}〜${max}回`;
}

function layoutRepeat(node: Extract<Node, { kind: 'repeat' }>): Layout {
  const body = layout(node.body);
  const repeats = node.max === null || node.max > 1;
  const optional = node.min === 0;
  const topArc = repeats ? ARC + 8 : 0;
  const botArc = optional ? ARC : 0;
  const lead = 16;
  const w = lead + body.w + lead;
  const cy = topArc + body.cy;
  const h = topArc + body.h + botArc;
  const label = quantLabel(node.min, node.max) + (node.greedy ? '' : '(非貪欲)');
  return {
    w,
    h,
    cy,
    draw: (x, y) => {
      const midY = y + cy;
      const bx = x + lead;
      let out = line(x, midY, bx, midY);
      out += body.draw(bx, midY - body.cy);
      const bxr = bx + body.w;
      out += line(bxr, midY, x + w, midY);
      if (repeats) {
        const top = midY - body.cy - topArc + 4;
        out +=
          `<path class="rr-line rr-loop" d="M${bxr} ${midY} C${bxr + 10} ${midY} ${bxr + 10} ${top} ${bxr} ${top} ` +
          `L${bx} ${top} C${bx - 10} ${top} ${bx - 10} ${midY} ${bx} ${midY}"/>`;
        out += `<text class="rr-quant" x="${(bx + bxr) / 2}" y="${top - 5}">${esc(label)}</text>`;
      } else {
        out += `<text class="rr-quant" x="${(bx + bxr) / 2}" y="${midY + body.cy + 14}">${esc(label)}</text>`;
      }
      if (optional) {
        const bot = midY + (body.h - body.cy) + botArc - 4;
        out += `<path class="rr-line rr-bypass" d="M${x} ${midY} C${bx - 8} ${midY} ${bx - 8} ${bot} ${bx} ${bot} L${bxr} ${bot} C${x + w - lead + 8} ${bot} ${x + w - lead + 8} ${midY} ${x + w} ${midY}"/>`;
      }
      return out;
    },
  };
}

function layoutGroup(node: Extract<Node, { kind: 'group' }>): Layout {
  const body = layout(node.body);
  const w = body.w + GROUP_PADX * 2;
  const h = body.h + GROUP_TOP + GROUP_BOT;
  const cy = GROUP_TOP + body.cy;
  const label = node.capturing ? `グループ ${node.index}` : '非捕捉グループ';
  return {
    w,
    h,
    cy,
    draw: (x, y) => {
      let out = `<rect class="rr-group" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>`;
      out += `<text class="rr-group-label" x="${x + 10}" y="${y + 15}">${esc(label)}</text>`;
      out += body.draw(x + GROUP_PADX, y + GROUP_TOP);
      return out;
    },
  };
}

export interface Diagram {
  svg: string;
  width: number;
  height: number;
}

export function renderRailroad(pattern: Pattern): Diagram {
  const root = layout(pattern.root);
  const margin = 24;
  const startX = margin;
  const bodyX = startX + 28;
  const width = bodyX + root.w + 28 + margin;
  const height = root.h + margin * 2;
  const cy = margin + root.cy;

  let body = '';
  // 開始端子
  body += `<circle class="rr-term" cx="${startX}" cy="${cy}" r="${TERM_R}"/>`;
  body += line(startX + TERM_R, cy, bodyX, cy);
  body += root.draw(bodyX, margin);
  const endX = bodyX + root.w;
  body += line(endX, cy, endX + 28, cy);
  body += `<circle class="rr-term" cx="${endX + 28 + TERM_R}" cy="${cy}" r="${TERM_R}"/>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.ceil(width)} ${Math.ceil(height)}" ` +
    `class="railroad" role="img" aria-label="正規表現の鉄道図">${body}</svg>`;
  return { svg, width, height };
}
