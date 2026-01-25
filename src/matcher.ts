import type { Node, Pattern } from './ast';
import { isWordChar, matchesClass, matchesShorthand } from './charset';

// ASTを再帰下降のバックトラッキングで実行し、過程をtraceに記録する。
// 継続(cont)渡しで「残りが一致するか」を表現し、量指定子の貪欲/非貪欲を扱う。

export type StepAction = 'enter' | 'consume' | 'fail' | 'match';

export interface Step {
  nodeId: number;
  pos: number; // 試行開始位置
  action: StepAction;
  consumed?: number; // consume のとき消費した文字数
}

export interface MatchResult {
  matched: boolean;
  start: number;
  end: number;
  steps: Step[];
  captures: Array<{ index: number; start: number; end: number } | null>;
}

const STEP_LIMIT = 200000;

class Engine {
  steps: Step[] = [];
  captures: Array<{ start: number; end: number } | null> = [];

  constructor(
    readonly input: string,
    groupCount: number,
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
        if (this.input[pos] === node.char) {
          this.record(node.id, pos, 'consume', 1);
          if (cont(pos + 1)) return true;
        }
        this.record(node.id, pos, 'fail');
        return false;
      }
      case 'any': {
        this.record(node.id, pos, 'enter');
        const ch = this.input[pos];
        if (ch !== undefined && ch !== '\n') {
          this.record(node.id, pos, 'consume', 1);
          if (cont(pos + 1)) return true;
        }
        this.record(node.id, pos, 'fail');
        return false;
      }
      case 'class': {
        this.record(node.id, pos, 'enter');
        const ch = this.input[pos];
        if (ch !== undefined && matchesClass(node, ch)) {
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
        return pos === 0;
      case 'end':
        return pos === this.input.length;
      case 'wordBoundary':
        return isWordChar(before) !== isWordChar(here);
      case 'nonWordBoundary':
        return isWordChar(before) === isWordChar(here);
      default:
        return false;
    }
  }
}

// input の各開始位置で先頭からのマッチを試し、最初に見つかった一致を返す。
// 一致しない場合は、開始位置0での試行のtraceを失敗の可視化用に返す。
export function runMatch(pattern: Pattern, input: string): MatchResult {
  let firstSteps: Step[] = [];
  for (let start = 0; start <= input.length; start += 1) {
    const engine = new Engine(input, pattern.groupCount);
    let end = -1;
    const ok = engine.run(pattern.root, start, (p) => {
      end = p;
      return true;
    });
    if (ok) {
      engine.record(pattern.root.id, end, 'match');
      return {
        matched: true,
        start,
        end,
        steps: engine.steps,
        captures: engine.captures.map((c, i) => (c ? { index: i + 1, ...c } : null)),
      };
    }
    if (start === 0) firstSteps = engine.steps;
  }
  return { matched: false, start: -1, end: -1, steps: firstSteps, captures: [] };
}

export { matchesShorthand };
