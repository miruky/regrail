import type { Node, Pattern } from './ast';
import { isWordChar, matchesClass, matchesShorthand } from './charset';

// ASTを再帰下降のバックトラッキングで実行し、過程をtraceに記録する。
// 継続(cont)渡しで「残りが一致するか」を表現し、量指定子の貪欲/非貪欲を扱う。

// 照合フラグ。i:大小無視 / m:複数行アンカー / s:任意文字が改行も含む。
export interface Flags {
  ignoreCase: boolean;
  multiline: boolean;
  dotAll: boolean;
}

const NO_FLAGS: Flags = { ignoreCase: false, multiline: false, dotAll: false };

export function parseFlags(flags: string): Flags {
  return {
    ignoreCase: flags.includes('i'),
    multiline: flags.includes('m'),
    dotAll: flags.includes('s'),
  };
}

function charEq(a: string, b: string, ignoreCase: boolean): boolean {
  return ignoreCase ? a.toLowerCase() === b.toLowerCase() : a === b;
}

export type StepAction = 'enter' | 'consume' | 'fail' | 'match';

export interface Step {
  nodeId: number;
  pos: number; // 試行開始位置
  action: StepAction;
  consumed?: number; // consume のとき消費した文字数
}

export interface CaptureSpan {
  index: number;
  start: number;
  end: number;
}

export interface MatchResult {
  matched: boolean;
  start: number;
  end: number;
  steps: Step[];
  captures: Array<CaptureSpan | null>;
}

// 1件の一致。開始・終了位置に加え、その一致を成立させた試行traceと捕捉を持つ。
export interface Match {
  start: number;
  end: number;
  steps: Step[];
  captures: Array<CaptureSpan | null>;
}

export interface MatchAllResult {
  matches: Match[];
  // 一致がないとき、位置0からの試行traceを可視化用に返す。
  firstSteps: Step[];
}

const STEP_LIMIT = 200000;

class Engine {
  steps: Step[] = [];
  captures: Array<{ start: number; end: number } | null> = [];

  constructor(
    readonly input: string,
    groupCount: number,
    readonly flags: Flags,
  ) {
    this.captures = Array.from({ length: groupCount }, () => null);
  }

  record(nodeId: number, pos: number, action: StepAction, consumed?: number): void {
    if (this.steps.length >= STEP_LIMIT) {
      throw new RangeError('ステップ数が上限を超えました(入力か式を見直してください)');
    }
    this.steps.push({ nodeId, pos, action, consumed });
  }

  // posから node を試し、続きを cont で繋ぐ。成功すれば true。
  run(node: Node, pos: number, cont: (p: number) => boolean): boolean {
    switch (node.kind) {
      case 'literal': {
        this.record(node.id, pos, 'enter');
        const ch = this.input[pos];
        if (ch !== undefined && charEq(ch, node.char, this.flags.ignoreCase)) {
          this.record(node.id, pos, 'consume', 1);
          if (cont(pos + 1)) return true;
        }
        this.record(node.id, pos, 'fail');
        return false;
      }
      case 'any': {
        this.record(node.id, pos, 'enter');
        const ch = this.input[pos];
        if (ch !== undefined && (this.flags.dotAll || ch !== '\n')) {
          this.record(node.id, pos, 'consume', 1);
          if (cont(pos + 1)) return true;
        }
        this.record(node.id, pos, 'fail');
        return false;
      }
      case 'class': {
        this.record(node.id, pos, 'enter');
        const ch = this.input[pos];
        if (ch !== undefined && matchesClass(node, ch, this.flags.ignoreCase)) {
          this.record(node.id, pos, 'consume', 1);
          if (cont(pos + 1)) return true;
        }
        this.record(node.id, pos, 'fail');
        return false;
      }
      case 'anchor': {
        this.record(node.id, pos, 'enter');
        if (this.anchorOk(node.at, pos)) {
          if (cont(pos)) return true;
        }
        this.record(node.id, pos, 'fail');
        return false;
      }
      case 'seq':
        return this.runSeq(node.items, 0, pos, cont);
      case 'alt': {
        this.record(node.id, pos, 'enter');
        for (const option of node.options) {
          if (this.run(option, pos, cont)) return true;
        }
        this.record(node.id, pos, 'fail');
        return false;
      }
      case 'group': {
        this.record(node.id, pos, 'enter');
        const inner = (end: number): boolean => {
          if (node.index !== null) {
            const prev = this.captures[node.index - 1] ?? null;
            this.captures[node.index - 1] = { start: pos, end };
            if (cont(end)) return true;
            this.captures[node.index - 1] = prev;
            return false;
          }
          return cont(end);
        };
        if (this.run(node.body, pos, inner)) return true;
        this.record(node.id, pos, 'fail');
        return false;
      }
      case 'repeat':
        this.record(node.id, pos, 'enter');
        return this.runRepeat(node, pos, 0, cont);
    }
  }

  private runSeq(items: Node[], i: number, pos: number, cont: (p: number) => boolean): boolean {
    if (i >= items.length) return cont(pos);
    return this.run(items[i]!, pos, (next) => this.runSeq(items, i + 1, next, cont));
  }

  private runRepeat(
    node: Extract<Node, { kind: 'repeat' }>,
    pos: number,
    done: number,
    cont: (p: number) => boolean,
  ): boolean {
    const canMore = node.max === null || done < node.max;
    const tryMore = (): boolean =>
      canMore &&
      this.run(node.body, pos, (next) => {
        if (next === pos) return false; // 空マッチの無限ループを防ぐ
        return this.runRepeat(node, next, done + 1, cont);
      });
    const tryStop = (): boolean => done >= node.min && cont(pos);

    if (node.greedy) {
      return tryMore() || tryStop();
    }
    return tryStop() || tryMore();
  }

  private anchorOk(at: string, pos: number): boolean {
    const before = this.input[pos - 1];
    const here = this.input[pos];
    switch (at) {
      case 'start':
        return pos === 0 || (this.flags.multiline && before === '\n');
      case 'end':
        return pos === this.input.length || (this.flags.multiline && here === '\n');
      case 'wordBoundary':
        return isWordChar(before) !== isWordChar(here);
      case 'nonWordBoundary':
        return isWordChar(before) === isWordChar(here);
      default:
        return false;
    }
  }
}

// from 以降の各開始位置で先頭からのマッチを試し、最初に見つかった一致を返す。
// 見つからなければ null。各一致は自分の開始位置からの試行traceを保持する。
function findFrom(pattern: Pattern, input: string, flags: Flags, from: number): Match | null {
  for (let start = from; start <= input.length; start += 1) {
    const engine = new Engine(input, pattern.groupCount, flags);
    let end = -1;
    const ok = engine.run(pattern.root, start, (p) => {
      end = p;
      return true;
    });
    if (ok) {
      engine.record(pattern.root.id, end, 'match');
      return {
        start,
        end,
        steps: engine.steps,
        captures: engine.captures.map((c, i) => (c ? { index: i + 1, ...c } : null)),
      };
    }
  }
  return null;
}

// 位置0からの試行traceだけを取り出す(一致なしの可視化用)。
function attemptSteps(pattern: Pattern, input: string, flags: Flags): Step[] {
  const engine = new Engine(input, pattern.groupCount, flags);
  engine.run(pattern.root, 0, () => true);
  return engine.steps;
}

// input の各開始位置で先頭からのマッチを試し、最初に見つかった一致を返す。
// 一致しない場合は、開始位置0での試行のtraceを失敗の可視化用に返す。
export function runMatch(pattern: Pattern, input: string, flags: Flags = NO_FLAGS): MatchResult {
  const m = findFrom(pattern, input, flags, 0);
  if (m) return { matched: true, ...m };
  return { matched: false, start: -1, end: -1, steps: attemptSteps(pattern, input, flags), captures: [] };
}

// 重なりのない全ての一致を、文字列の先頭から順に列挙する(g フラグ相当)。
// 空一致のときは1文字進め、ネイティブのグローバル照合と同じ位置取りにする。
export function runMatchAll(pattern: Pattern, input: string, flags: Flags = NO_FLAGS): MatchAllResult {
  const matches: Match[] = [];
  let pos = 0;
  while (pos <= input.length) {
    const m = findFrom(pattern, input, flags, pos);
    if (!m) break;
    matches.push(m);
    pos = m.end > m.start ? m.end : m.end + 1;
  }
  return { matches, firstSteps: matches.length === 0 ? attemptSteps(pattern, input, flags) : [] };
}

export { matchesShorthand };
