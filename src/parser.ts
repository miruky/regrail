import type {
  Alternation,
  CharClass,
  ClassItem,
  Node,
  Pattern,
  Repeat,
  Sequence,
  ShorthandClass,
} from './ast';

// 標準的なJS正規表現のサブセットを再帰下降で解析する。
// 対応: 文字・. ・文字クラス[]・短縮クラス\d\w\s等・アンカー^$\b\B・
// グループ(...)(?:...)・選択|・量指定子* + ? {m,n}(貪欲/非貪欲)・エスケープ。
// 非対応: 後方参照、先読み・後読み、名前付きグループ。

export class RegexSyntaxError extends Error {
  constructor(
    message: string,
    readonly index: number,
  ) {
    super(message);
  }
}

const SHORTHAND: Record<string, ShorthandClass> = {
  d: 'd',
  D: 'D',
  w: 'w',
  W: 'W',
  s: 's',
  S: 'S',
};

const ESCAPES: Record<string, string> = {
  n: '\n',
  r: '\r',
  t: '\t',
  f: '\f',
  v: '\v',
  '0': '\0',
};

export function parse(source: string): Pattern {
  return new Parser(source).parsePattern();
}

class Parser {
  private pos = 0;
  private nextId = 0;
  private groupCount = 0;

  constructor(private readonly src: string) {}

  parsePattern(): Pattern {
    const root = this.parseAlternation();
    if (this.pos < this.src.length) {
      // ここに来るのは余分な ) など
      throw new RegexSyntaxError(`予期しない文字 '${this.peek()}'`, this.pos);
    }
    return { root, groupCount: this.groupCount };
  }

  private id(): number {
    return this.nextId++;
  }

  private peek(): string {
    return this.src[this.pos] ?? '';
  }

  private eof(): boolean {
    return this.pos >= this.src.length;
  }

  private parseAlternation(): Node {
    const first = this.parseSequence();
    if (this.peek() !== '|') return first;
    const options: Node[] = [first];
    while (this.peek() === '|') {
      this.pos += 1;
      options.push(this.parseSequence());
    }
    return { kind: 'alt', id: this.id(), options } satisfies Alternation;
  }

  private parseSequence(): Node {
    const items: Node[] = [];
    while (!this.eof() && this.peek() !== '|' && this.peek() !== ')') {
      items.push(this.parseRepeat());
    }
    if (items.length === 1) return items[0]!;
    return { kind: 'seq', id: this.id(), items } satisfies Sequence;
  }

  private parseRepeat(): Node {
    const atom = this.parseAtom();
    const c = this.peek();
    let min: number;
    let max: number | null;
    if (c === '*') {
      min = 0;
      max = null;
      this.pos += 1;
    } else if (c === '+') {
      min = 1;
      max = null;
      this.pos += 1;
    } else if (c === '?') {
      min = 0;
      max = 1;
      this.pos += 1;
    } else if (c === '{') {
      const parsed = this.tryParseBrace();
      if (!parsed) return atom;
      [min, max] = parsed;
    } else {
      return atom;
    }
    let greedy = true;
    if (this.peek() === '?') {
      greedy = false;
      this.pos += 1;
    }
    return { kind: 'repeat', id: this.id(), body: atom, min, max, greedy } satisfies Repeat;
  }

  // {m} {m,} {m,n}。数値でなければ { をリテラル扱いするためnullを返す
  private tryParseBrace(): [number, number | null] | null {
    const start = this.pos;
    this.pos += 1; // {
    const minStr = this.readDigits();
    if (minStr === '') {
      this.pos = start;
      return null;
    }
    let max: number | null = Number(minStr);
    if (this.peek() === ',') {
      this.pos += 1;
      const maxStr = this.readDigits();
      max = maxStr === '' ? null : Number(maxStr);
    }
    if (this.peek() !== '}') {
      this.pos = start;
      return null;
    }
    this.pos += 1; // }
    const min = Number(minStr);
    if (max !== null && max < min) {
      throw new RegexSyntaxError('繰り返し回数の上限が下限を下回っています', start);
    }
    return [min, max];
  }

  private readDigits(): string {
    let out = '';
    while (/[0-9]/.test(this.peek())) {
      out += this.peek();
      this.pos += 1;
    }
    return out;
  }

  private parseAtom(): Node {
    const c = this.peek();
    if (c === '(') return this.parseGroup();
    if (c === '[') return this.parseClass();
    if (c === '.') {
      this.pos += 1;
      return { kind: 'any', id: this.id() };
    }
    if (c === '^') {
      this.pos += 1;
      return { kind: 'anchor', id: this.id(), at: 'start' };
    }
    if (c === '$') {
      this.pos += 1;
      return { kind: 'anchor', id: this.id(), at: 'end' };
    }
    if (c === '\\') return this.parseEscape();
    if (c === '*' || c === '+' || c === '?') {
      throw new RegexSyntaxError(`量指定子 '${c}' の前に対象がありません`, this.pos);
    }
    if (c === '') {
      throw new RegexSyntaxError('式が途中で終わっています', this.pos);
    }
    this.pos += 1;
    return { kind: 'literal', id: this.id(), char: c };
  }

  private parseGroup(): Node {
    const open = this.pos;
    this.pos += 1; // (
    let capturing = true;
    if (this.peek() === '?') {
      if (this.src[this.pos + 1] === ':') {
        capturing = false;
        this.pos += 2;
      } else {
        throw new RegexSyntaxError('このグループ記法には対応していません', this.pos);
      }
    }
    const index = capturing ? ++this.groupCount : null;
    const body = this.parseAlternation();
    if (this.peek() !== ')') {
      throw new RegexSyntaxError('閉じ括弧 ) がありません', open);
    }
    this.pos += 1; // )
    return { kind: 'group', id: this.id(), capturing, index, body };
  }

  private parseEscape(): Node {
    this.pos += 1; // バックスラッシュ
    const c = this.peek();
    if (c === '') throw new RegexSyntaxError('エスケープが途中で終わっています', this.pos);
    this.pos += 1;
    if (c === 'b') return { kind: 'anchor', id: this.id(), at: 'wordBoundary' };
    if (c === 'B') return { kind: 'anchor', id: this.id(), at: 'nonWordBoundary' };
    if (SHORTHAND[c]) {
      return {
        kind: 'class',
        id: this.id(),
        negated: false,
        items: [],
        shorthand: [SHORTHAND[c]!],
        label: `\\${c}`,
      } satisfies CharClass;
    }
    const literal = ESCAPES[c] ?? c;
    return { kind: 'literal', id: this.id(), char: literal };
  }

  private parseClass(): Node {
    const open = this.pos;
    this.pos += 1; // [
    let negated = false;
    if (this.peek() === '^') {
      negated = true;
      this.pos += 1;
    }
    const items: ClassItem[] = [];
    const shorthand: ShorthandClass[] = [];
    while (!this.eof() && this.peek() !== ']') {
      const ch = this.readClassChar(shorthand);
      if (ch === null) continue; // 短縮クラスを取り込んだ
      // 範囲 a-z(- が末尾なら通常文字)
      if (
        this.peek() === '-' &&
        this.src[this.pos + 1] !== ']' &&
        this.src[this.pos + 1] !== undefined
      ) {
        this.pos += 1; // -
        const to = this.readClassChar(shorthand);
        if (to === null) {
          items.push({ from: ch, to: ch });
          items.push({ from: '-', to: '-' });
        } else {
          if (to < ch) throw new RegexSyntaxError('文字クラスの範囲が逆順です', open);
          items.push({ from: ch, to });
        }
      } else {
        items.push({ from: ch, to: ch });
      }
    }
    if (this.peek() !== ']') throw new RegexSyntaxError('閉じ括弧 ] がありません', open);
    this.pos += 1; // ]
    return {
      kind: 'class',
      id: this.id(),
      negated,
      items,
      shorthand,
      label: this.src.slice(open, this.pos),
    };
  }

  // クラス内の1文字を読む。短縮クラス(\d 等)を読んだ場合はshorthandへ積みnullを返す
  private readClassChar(shorthand: ShorthandClass[]): string | null {
    if (this.peek() === '\\') {
      this.pos += 1;
      const c = this.peek();
      this.pos += 1;
      if (SHORTHAND[c]) {
        shorthand.push(SHORTHAND[c]!);
        return null;
      }
      return ESCAPES[c] ?? c;
    }
    const c = this.peek();
    this.pos += 1;
    return c;
  }
}
