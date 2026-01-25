import './style.css';
import { parse, RegexSyntaxError } from './parser';
import { renderRailroad } from './railroad';
import { runMatch, type MatchResult } from './matcher';

const app = document.getElementById('app');
if (!app) throw new Error('#app が見つからない');

app.innerHTML = `
  <main class="wrap">
    <header class="head">
      <h1>regrail</h1>
      <p class="sub">正規表現を鉄道図で見て、マッチの過程を一歩ずつ追う</p>
    </header>

    <section class="inputs">
      <label class="lbl">
        <span>正規表現</span>
        <div class="re-line"><span class="slash">/</span><input id="re" type="text"
          spellcheck="false" autocomplete="off" value="(\\d{4})-(\\d{2})-(\\d{2})" aria-label="正規表現" /><span class="slash">/</span></div>
      </label>
      <p id="re-error" class="re-error" role="alert" hidden></p>
    </section>

    <section class="diagram-wrap" aria-label="鉄道図">
      <div id="diagram" class="diagram"></div>
    </section>

    <section class="inputs">
      <label class="lbl">
        <span>テスト文字列</span>
        <input id="test" type="text" spellcheck="false" autocomplete="off"
          value="日付 2026-06-12 を解析" aria-label="テスト文字列" />
      </label>
    </section>

    <section class="result">
      <div id="verdict" class="verdict"></div>
      <div id="string-view" class="string-view"></div>
      <div id="captures" class="captures"></div>
    </section>

    <section class="stepper">
      <div class="step-controls">
        <button id="step-reset" type="button" class="btn">最初へ</button>
        <button id="step-prev" type="button" class="btn">戻る</button>
        <button id="step-next" type="button" class="btn">進む</button>
        <span id="step-status" class="step-status"></span>
      </div>
      <p class="step-hint">「進む」で照合の試行・消費・不一致・成功を1ステップずつたどれます。</p>
    </section>
  </main>
`;

const reInput = app.querySelector<HTMLInputElement>('#re')!;
const reError = app.querySelector<HTMLParagraphElement>('#re-error')!;
const diagramEl = app.querySelector<HTMLDivElement>('#diagram')!;
const testInput = app.querySelector<HTMLInputElement>('#test')!;
const verdictEl = app.querySelector<HTMLDivElement>('#verdict')!;
const stringView = app.querySelector<HTMLDivElement>('#string-view')!;
const capturesEl = app.querySelector<HTMLDivElement>('#captures')!;
const stepStatus = app.querySelector<HTMLSpanElement>('#step-status')!;

let result: MatchResult | null = null;
let stepIndex = -1;

function rebuild(): void {
  const source = reInput.value;
  try {
    const pattern = parse(source);
    reError.hidden = true;
    diagramEl.innerHTML = renderRailroad(pattern).svg;
    result = runMatch(pattern, testInput.value);
  } catch (error) {
    if (error instanceof RegexSyntaxError) {
      reError.textContent = `位置 ${error.index}: ${error.message}`;
    } else {
      reError.textContent = '正規表現を解釈できません';
    }
    reError.hidden = false;
    diagramEl.innerHTML = '';
    result = null;
  }
  stepIndex = -1;
  renderResult();
}

function renderResult(): void {
  const text = testInput.value;
  stringView.innerHTML = '';
  for (let i = 0; i < text.length; i += 1) {
    const span = document.createElement('span');
    span.className = 'ch';
    span.dataset.pos = String(i);
    span.textContent = text[i]!;
    if (result?.matched && i >= result.start && i < result.end) {
      span.classList.add('in-match');
    }
    stringView.appendChild(span);
  }

  if (!result) {
    verdictEl.textContent = '';
    verdictEl.className = 'verdict';
    capturesEl.innerHTML = '';
    stepStatus.textContent = '';
    clearActiveNodes();
    return;
  }

  if (result.matched) {
    verdictEl.textContent = `一致: ${JSON.stringify(text.slice(result.start, result.end))}(位置 ${result.start}〜${result.end})`;
    verdictEl.className = 'verdict ok';
  } else {
    verdictEl.textContent = '一致しませんでした';
    verdictEl.className = 'verdict ng';
  }

  capturesEl.innerHTML = '';
  for (const cap of result.captures) {
    if (!cap) continue;
    const row = document.createElement('div');
    row.className = 'cap-row';
    const no = document.createElement('span');
    no.className = 'cap-no';
    no.textContent = `グループ ${cap.index}`;
    const val = document.createElement('span');
    val.className = 'cap-val';
    val.textContent = text.slice(cap.start, cap.end);
    row.append(no, val);
    capturesEl.appendChild(row);
  }

  applyStep();
}

function clearActiveNodes(): void {
  diagramEl.querySelectorAll('.rr-node.active, .rr-node.consumed, .rr-node.failed').forEach((n) => {
    n.classList.remove('active', 'consumed', 'failed');
  });
}

function clearCursor(): void {
  stringView.querySelectorAll('.ch.at').forEach((n) => n.classList.remove('at'));
}

function applyStep(): void {
  clearActiveNodes();
  clearCursor();
  if (!result || result.steps.length === 0) {
    stepStatus.textContent = result ? 'ステップなし' : '';
    return;
  }
  if (stepIndex < 0) {
    stepStatus.textContent = `0 / ${result.steps.length}`;
    return;
  }
  const step = result.steps[stepIndex]!;
  const node = diagramEl.querySelector(`[data-node-id="${step.nodeId}"]`);
  if (node) {
    const cls =
      step.action === 'consume' ? 'consumed' : step.action === 'fail' ? 'failed' : 'active';
    node.classList.add(cls);
  }
  const cursor = stringView.querySelector(`.ch[data-pos="${step.pos}"]`);
  if (cursor) cursor.classList.add('at');

  const actionLabel: Record<string, string> = {
    enter: '試行',
    consume: '消費',
    fail: '不一致',
    match: '成功',
  };
  stepStatus.textContent = `${stepIndex + 1} / ${result.steps.length}  ${actionLabel[step.action]}  位置 ${step.pos}`;
}

app.querySelector('#step-next')!.addEventListener('click', () => {
  if (!result) return;
  stepIndex = Math.min(result.steps.length - 1, stepIndex + 1);
  applyStep();
});
app.querySelector('#step-prev')!.addEventListener('click', () => {
  stepIndex = Math.max(-1, stepIndex - 1);
  applyStep();
});
app.querySelector('#step-reset')!.addEventListener('click', () => {
  stepIndex = -1;
  applyStep();
});

reInput.addEventListener('input', rebuild);
testInput.addEventListener('input', rebuild);
rebuild();
