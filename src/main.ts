import './style.css';
import { parse, RegexSyntaxError } from './parser';
import { renderRailroad } from './railroad';
import { runMatch, type MatchResult } from './matcher';
import { EXAMPLES } from './examples';
import { decodeState, encodeState } from './state';
import { loadTheme, nextTheme, resolveTheme, saveTheme, THEME_LABEL, type Theme } from './theme';
import {
  BRAND_MARK,
  CHECK_ICON,
  LINK_ICON,
  STEP_NEXT_ICON,
  STEP_PREV_ICON,
  STEP_RESET_ICON,
  THEME_ICONS,
} from './icons';

const DEFAULT_PATTERN = '(\\d{4})-(\\d{2})-(\\d{2})';
const DEFAULT_TEST = '提出期限は 2026-06-12 です';

const app = document.getElementById('app');
if (!app) throw new Error('#app が見つからない');

const initial = decodeState(location.hash);
const startPattern = initial.pattern ?? DEFAULT_PATTERN;
const startTest = initial.test ?? DEFAULT_TEST;

const exampleItems = EXAMPLES.map(
  (ex, i) =>
    `<li><button class="example-btn" type="button" data-example="${i}" title="${escapeAttr(
      ex.note,
    )}">${escapeHtml(ex.name)}</button></li>`,
).join('');

app.innerHTML = `
  <a class="skip-link" href="#work">本編へスキップ</a>
  <header class="masthead">
    <div class="masthead-inner">
      <a class="brand" href="./" aria-label="regrail ホーム">
        <span class="brand-mark">${BRAND_MARK}</span>
        <span class="brand-name">regrail</span>
      </a>
      <p class="brand-tag">正規表現を線路で読む</p>
      <div class="masthead-actions">
        <button id="share" class="ghost-btn" type="button">${LINK_ICON}<span>リンクをコピー</span></button>
        <button id="theme" class="theme-toggle" type="button"></button>
      </div>
    </div>
  </header>

  <main class="work" id="work" tabindex="-1">
    <section class="intro">
      <p class="kicker">Regex railroad debugger</p>
      <h1 class="title">正規表現を、線路として読む。</h1>
      <p class="lede">パターンの構造を鉄道図に起こし、照合エンジンが実際にどこを走り、どこで後戻りするのかを一歩ずつ目で追えます。</p>
    </section>

    <section aria-labelledby="re-label">
      <label class="field-label" id="re-label" for="re">正規表現</label>
      <div class="re-line">
        <span class="slash" aria-hidden="true">/</span>
        <input id="re" type="text" spellcheck="false" autocomplete="off" autocapitalize="off"
          value="${escapeAttr(startPattern)}" aria-label="正規表現" />
        <span class="slash" aria-hidden="true">/</span>
      </div>
      <p id="re-error" class="field-error" role="alert" hidden></p>
      <div class="examples">
        <span class="examples-label">例</span>
        <ul class="example-list">${exampleItems}</ul>
      </div>
    </section>

    <section class="diagram-section" aria-label="鉄道図">
      <div id="diagram" class="diagram" tabindex="0" role="img" aria-label="正規表現の鉄道図"></div>
    </section>

    <section aria-labelledby="test-label">
      <label class="field-label" id="test-label" for="test">テスト文字列</label>
      <input id="test" class="test-input" type="text" spellcheck="false" autocomplete="off"
        value="${escapeAttr(startTest)}" aria-label="テスト文字列" />
    </section>

    <section class="outcome">
      <p id="verdict" class="verdict" role="status" aria-live="polite"></p>
      <div id="string-view" class="string-view"></div>
      <div id="captures" class="captures"></div>
    </section>

    <section class="stepper" aria-label="ステップ実行">
      <div class="step-bar">
        <div class="step-controls">
          <button id="step-reset" class="step-btn" type="button">${STEP_RESET_ICON}最初へ</button>
          <button id="step-prev" class="step-btn" type="button">${STEP_PREV_ICON}戻る</button>
          <button id="step-next" class="step-btn primary" type="button">${STEP_NEXT_ICON}進む</button>
        </div>
        <div class="step-readout"><span id="step-status" aria-live="polite"></span></div>
      </div>
      <div class="step-progress"><span id="step-progress-fill" class="step-progress-fill"></span></div>
      <ul class="legend">
        <li class="legend-item"><span class="legend-swatch is-active"></span>試行</li>
        <li class="legend-item"><span class="legend-swatch is-consume"></span>消費</li>
        <li class="legend-item"><span class="legend-swatch is-fail"></span>不一致(後戻り)</li>
        <li class="legend-item"><span class="legend-swatch is-match"></span>成功</li>
      </ul>
      <p class="step-hint">「進む」で照合の試行・消費・不一致・成功を1ステップずつたどれます(左右の矢印キーでも操作可)。図中のノードとテスト文字列の現在位置が同時に光ります。</p>
    </section>
  </main>

  <footer class="colophon">
    <p>自前のパーサと照合エンジンで動く、依存ゼロの正規表現ビジュアルデバッガ。<a href="https://github.com/miruky/regrail">ソース</a></p>
  </footer>
`;

const reInput = app.querySelector<HTMLInputElement>('#re')!;
const reError = app.querySelector<HTMLParagraphElement>('#re-error')!;
const diagramEl = app.querySelector<HTMLDivElement>('#diagram')!;
const testInput = app.querySelector<HTMLInputElement>('#test')!;
const verdictEl = app.querySelector<HTMLParagraphElement>('#verdict')!;
const stringView = app.querySelector<HTMLDivElement>('#string-view')!;
const capturesEl = app.querySelector<HTMLDivElement>('#captures')!;
const stepStatus = app.querySelector<HTMLSpanElement>('#step-status')!;
const progressFill = app.querySelector<HTMLSpanElement>('#step-progress-fill')!;
const resetBtn = app.querySelector<HTMLButtonElement>('#step-reset')!;
const prevBtn = app.querySelector<HTMLButtonElement>('#step-prev')!;
const nextBtn = app.querySelector<HTMLButtonElement>('#step-next')!;
const themeBtn = app.querySelector<HTMLButtonElement>('#theme')!;
const shareBtn = app.querySelector<HTMLButtonElement>('#share')!;

/* ── テーマ ── */

const rootEl = document.documentElement;
const darkMedia = matchMedia('(prefers-color-scheme: dark)');
let theme: Theme = loadTheme();

function applyTheme(): void {
  const resolved = resolveTheme(theme, darkMedia.matches);
  rootEl.dataset.theme = resolved;
  themeBtn.innerHTML = THEME_ICONS[theme];
  themeBtn.setAttribute('aria-label', `テーマ: ${THEME_LABEL[theme]}(切り替え)`);
  themeBtn.title = `テーマ: ${THEME_LABEL[theme]}`;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = resolved === 'dark' ? '#14161a' : '#f4f2ec';
}

themeBtn.addEventListener('click', () => {
  theme = nextTheme(theme);
  saveTheme(theme);
  applyTheme();
});
darkMedia.addEventListener('change', () => {
  if (theme === 'auto') applyTheme();
});
applyTheme();

/* ── 共有リンク ── */

let shareResetTimer: number | undefined;

shareBtn.addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}#${encodeState({
    pattern: reInput.value,
    test: testInput.value,
  })}`;
  try {
    await navigator.clipboard.writeText(url);
    shareBtn.innerHTML = `${CHECK_ICON}<span>コピーしました</span>`;
    shareBtn.classList.add('is-done');
  } catch {
    shareBtn.innerHTML = `${LINK_ICON}<span>URLを確認</span>`;
  }
  window.clearTimeout(shareResetTimer);
  shareResetTimer = window.setTimeout(() => {
    shareBtn.innerHTML = `${LINK_ICON}<span>リンクをコピー</span>`;
    shareBtn.classList.remove('is-done');
  }, 1800);
});

/* ── 照合と描画 ── */

let result: MatchResult | null = null;
let stepIndex = -1;

const ACTION_LABEL: Record<string, string> = {
  enter: '試行',
  consume: '消費',
  fail: '不一致',
  match: '成功',
};

function syncHash(): void {
  const hash = `#${encodeState({ pattern: reInput.value, test: testInput.value })}`;
  history.replaceState(null, '', hash);
}

function rebuild(): void {
  const source = reInput.value;
  try {
    const pattern = parse(source);
    reError.hidden = true;
    diagramEl.innerHTML = renderRailroad(pattern).svg;
    diagramEl.setAttribute('aria-label', `正規表現 /${source}/ の鉄道図`);
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
  syncHash();
  renderResult();
}

function renderResult(): void {
  const text = testInput.value;
  stringView.replaceChildren();
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
    verdictEl.replaceChildren();
    verdictEl.className = 'verdict';
    capturesEl.replaceChildren();
    updateStep();
    return;
  }

  if (result.matched) {
    verdictEl.className = 'verdict ok';
    const quote = document.createElement('span');
    quote.className = 'verdict-quote';
    quote.textContent = JSON.stringify(text.slice(result.start, result.end));
    verdictEl.replaceChildren('一致 ', quote, ` (位置 ${result.start}〜${result.end})`);
  } else {
    verdictEl.className = 'verdict ng';
    verdictEl.textContent = '一致しませんでした';
  }

  capturesEl.replaceChildren();
  for (const cap of result.captures) {
    if (!cap) continue;
    const row = document.createElement('div');
    row.className = 'cap-row';
    const no = document.createElement('span');
    no.className = 'cap-no';
    no.textContent = `グループ ${cap.index}`;
    const val = document.createElement('span');
    val.className = 'cap-val';
    val.textContent = JSON.stringify(text.slice(cap.start, cap.end));
    row.append(no, val);
    capturesEl.appendChild(row);
  }

  updateStep();
}

function clearHighlights(): void {
  diagramEl.querySelectorAll('.rr-node.active, .rr-node.consumed, .rr-node.failed').forEach((n) => {
    n.classList.remove('active', 'consumed', 'failed');
  });
  stringView.querySelectorAll('.ch.at').forEach((n) => n.classList.remove('at'));
}

function updateStep(): void {
  clearHighlights();
  const total = result?.steps.length ?? 0;
  const shown = stepIndex + 1;
  progressFill.style.width = total > 0 ? `${(shown / total) * 100}%` : '0';

  if (!result || total === 0) {
    stepStatus.textContent = result ? 'ステップなし' : '';
  } else if (stepIndex < 0) {
    stepStatus.textContent = `0 / ${total}  先頭`;
  } else {
    const step = result.steps[stepIndex]!;
    const node = diagramEl.querySelector(`[data-node-id="${step.nodeId}"]`);
    if (node) {
      const cls =
        step.action === 'consume' ? 'consumed' : step.action === 'fail' ? 'failed' : 'active';
      node.classList.add(cls);
    }
    const cursor = stringView.querySelector(`.ch[data-pos="${step.pos}"]`);
    if (cursor) cursor.classList.add('at');
    stepStatus.textContent = `${shown} / ${total}  ${ACTION_LABEL[step.action]}  位置 ${step.pos}`;
  }

  const last = total - 1;
  resetBtn.disabled = stepIndex < 0;
  prevBtn.disabled = stepIndex < 0;
  nextBtn.disabled = !result || stepIndex >= last;
}

nextBtn.addEventListener('click', () => {
  if (!result) return;
  stepIndex = Math.min(result.steps.length - 1, stepIndex + 1);
  updateStep();
});
prevBtn.addEventListener('click', () => {
  stepIndex = Math.max(-1, stepIndex - 1);
  updateStep();
});
resetBtn.addEventListener('click', () => {
  stepIndex = -1;
  updateStep();
});

// 入力欄の外では矢印キーでステップを進める(無効なボタンのクリックは何もしない)。
window.addEventListener('keydown', (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const tag = (ev.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (ev.key === 'ArrowRight') {
    ev.preventDefault();
    nextBtn.click();
  } else if (ev.key === 'ArrowLeft') {
    ev.preventDefault();
    prevBtn.click();
  } else if (ev.key === 'Home') {
    ev.preventDefault();
    resetBtn.click();
  }
});

/* ── サンプル ── */

app.querySelectorAll<HTMLButtonElement>('.example-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const ex = EXAMPLES[Number(btn.dataset.example)];
    if (!ex) return;
    reInput.value = ex.pattern;
    testInput.value = ex.test;
    rebuild();
  });
});

reInput.addEventListener('input', rebuild);
testInput.addEventListener('input', rebuild);
window.addEventListener('hashchange', () => {
  const next = decodeState(location.hash);
  if (next.pattern !== undefined && next.pattern !== reInput.value) reInput.value = next.pattern;
  if (next.test !== undefined && next.test !== testInput.value) testInput.value = next.test;
  rebuild();
});

rebuild();

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
