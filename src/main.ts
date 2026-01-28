import './style.css';
import { parse, RegexSyntaxError } from './parser';
import { renderRailroad } from './railroad';
import { parseFlags, runMatchAll, type MatchAllResult, type Step } from './matcher';
import { EXAMPLES } from './examples';
import { decodeState, encodeState } from './state';
import { loadTheme, nextTheme, resolveTheme, saveTheme, THEME_LABEL, type Theme } from './theme';
import { toStandaloneSvg, type DiagramColors } from './export';
import {
  BRAND_MARK,
  CHECK_ICON,
  DOWNLOAD_ICON,
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
const startFlags = sanitizeFlags(initial.flags ?? '');

// i(大小無視)・m(複数行)・s(任意が改行も含む)だけを、その順序で1つずつ受け入れる。
function sanitizeFlags(raw: string): string {
  return ['i', 'm', 's'].filter((f) => raw.includes(f)).join('');
}

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
        <input id="flags" class="flags-input" type="text" spellcheck="false" autocomplete="off"
          autocapitalize="off" maxlength="3" placeholder="ims" value="${escapeAttr(startFlags)}"
          aria-label="フラグ i:大小を区別しない m:複数行 s:任意の文字が改行も含む" />
      </div>
      <p id="re-error" class="field-error" role="alert" hidden></p>
      <div class="examples">
        <span class="examples-label">例</span>
        <ul class="example-list">${exampleItems}</ul>
      </div>
    </section>

    <section class="diagram-section" aria-label="鉄道図">
      <div class="diagram-head">
        <span class="field-label">鉄道図</span>
        <button id="export-svg" class="ghost-btn ghost-btn--sm" type="button">${DOWNLOAD_ICON}<span>SVGで保存</span></button>
      </div>
      <div class="diagram-frame">
        <div id="diagram" class="diagram" tabindex="0" role="img" aria-label="正規表現の鉄道図"></div>
      </div>
    </section>

    <section aria-labelledby="test-label">
      <label class="field-label" id="test-label" for="test">テスト文字列</label>
      <input id="test" class="test-input" type="text" spellcheck="false" autocomplete="off"
        value="${escapeAttr(startTest)}" aria-label="テスト文字列" />
    </section>

    <section class="outcome">
      <p id="verdict" class="verdict" role="status" aria-live="polite"></p>
      <div id="string-view" class="string-view"></div>
      <div id="match-nav" class="match-nav" hidden>
        <span class="match-nav-label">一致を選択</span>
        <div class="match-nav-controls">
          <button id="match-prev" class="match-nav-btn" type="button" aria-label="前の一致へ">${STEP_PREV_ICON}</button>
          <span id="match-count" class="match-count" aria-live="polite"></span>
          <button id="match-next" class="match-nav-btn" type="button" aria-label="次の一致へ">${STEP_NEXT_ICON}</button>
        </div>
      </div>
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
const flagsInput = app.querySelector<HTMLInputElement>('#flags')!;
const reError = app.querySelector<HTMLParagraphElement>('#re-error')!;
const diagramEl = app.querySelector<HTMLDivElement>('#diagram')!;
const diagramFrame = app.querySelector<HTMLDivElement>('.diagram-frame')!;
const testInput = app.querySelector<HTMLInputElement>('#test')!;
const verdictEl = app.querySelector<HTMLParagraphElement>('#verdict')!;
const stringView = app.querySelector<HTMLDivElement>('#string-view')!;
const matchNav = app.querySelector<HTMLDivElement>('#match-nav')!;
const matchCount = app.querySelector<HTMLSpanElement>('#match-count')!;
const matchPrevBtn = app.querySelector<HTMLButtonElement>('#match-prev')!;
const matchNextBtn = app.querySelector<HTMLButtonElement>('#match-next')!;
const capturesEl = app.querySelector<HTMLDivElement>('#captures')!;
const stepStatus = app.querySelector<HTMLSpanElement>('#step-status')!;
const progressFill = app.querySelector<HTMLSpanElement>('#step-progress-fill')!;
const resetBtn = app.querySelector<HTMLButtonElement>('#step-reset')!;
const prevBtn = app.querySelector<HTMLButtonElement>('#step-prev')!;
const nextBtn = app.querySelector<HTMLButtonElement>('#step-next')!;
const themeBtn = app.querySelector<HTMLButtonElement>('#theme')!;
const shareBtn = app.querySelector<HTMLButtonElement>('#share')!;
const exportBtn = app.querySelector<HTMLButtonElement>('#export-svg')!;

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
    flags: flagsInput.value,
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

/* ── 図のSVG書き出し ── */

function diagramColors(): DiagramColors {
  const cs = getComputedStyle(rootEl);
  const v = (name: string): string => cs.getPropertyValue(name).trim();
  return {
    surface: v('--surface'),
    ink: v('--ink'),
    inkSoft: v('--ink-soft'),
    inkFaint: v('--ink-faint'),
    ruleStrong: v('--rule-strong'),
    accent: v('--accent'),
    accentStrong: v('--accent-strong'),
    rail: v('--rail'),
    consume: v('--c-consume'),
  };
}

exportBtn.addEventListener('click', () => {
  const svg = diagramEl.querySelector('svg');
  if (!svg) return;
  const label = `正規表現 /${reInput.value}/${flagsInput.value} の鉄道図`;
  const out = toStandaloneSvg(svg.outerHTML, label, diagramColors());
  const url = URL.createObjectURL(new Blob([out], { type: 'image/svg+xml' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'regrail-diagram.svg';
  a.click();
  URL.revokeObjectURL(url);
});

/* ── 照合と描画 ── */

let run: MatchAllResult | null = null;
let activeMatch = 0;
let stepIndex = -1;

const ACTION_LABEL: Record<string, string> = {
  enter: '試行',
  consume: '消費',
  fail: '不一致',
  match: '成功',
};

// ステップ実行で使うtrace。一致があればその試行trace、なければ位置0からの失敗trace。
function currentSteps(): Step[] {
  if (!run) return [];
  return run.matches.length > 0 ? (run.matches[activeMatch]?.steps ?? []) : run.firstSteps;
}

function syncHash(): void {
  const hash = `#${encodeState({
    pattern: reInput.value,
    test: testInput.value,
    flags: flagsInput.value,
  })}`;
  history.replaceState(null, '', hash);
}

function rebuild(): void {
  const source = reInput.value;
  const flags = flagsInput.value;
  try {
    const pattern = parse(source);
    reError.hidden = true;
    diagramEl.innerHTML = renderRailroad(pattern).svg;
    diagramEl.setAttribute('aria-label', `正規表現 /${source}/${flags} の鉄道図`);
    run = runMatchAll(pattern, testInput.value, parseFlags(flags));
  } catch (error) {
    if (error instanceof RegexSyntaxError) {
      reError.textContent = `位置 ${error.index}: ${error.message}`;
    } else {
      reError.textContent = '正規表現を解釈できません';
    }
    reError.hidden = false;
    diagramEl.innerHTML = '';
    diagramEl.setAttribute('aria-label', '正規表現にエラーがあり、図を描けません');
    run = null;
  }
  activeMatch = 0;
  stepIndex = -1;
  syncHash();
  renderResult();
  updateDiagramFades();
  exportBtn.disabled = run === null;
}

// 図が横にはみ出してスクロールできる方向だけ、端をフェードのマスクで示す。
function updateDiagramFades(): void {
  const max = diagramEl.scrollWidth - diagramEl.clientWidth;
  diagramFrame.classList.toggle('can-left', diagramEl.scrollLeft > 1);
  diagramFrame.classList.toggle('can-right', diagramEl.scrollLeft < max - 1);
}

function renderResult(): void {
  const text = testInput.value;
  const matches = run?.matches ?? [];
  const multiple = matches.length > 1;
  const active = matches[activeMatch];

  stringView.replaceChildren();
  for (let i = 0; i < text.length; i += 1) {
    const span = document.createElement('span');
    span.className = 'ch';
    span.dataset.pos = String(i);
    span.textContent = text[i]!;
    if (matches.some((m) => i >= m.start && i < m.end)) span.classList.add('in-match');
    // 複数一致のときだけ、いま検証中の一致を強調して区別する。
    if (multiple && active && i >= active.start && i < active.end) span.classList.add('in-active');
    stringView.appendChild(span);
  }

  renderMatchNav(matches.length);

  if (!run) {
    verdictEl.replaceChildren();
    verdictEl.className = 'verdict';
    capturesEl.replaceChildren();
    updateStep();
    return;
  }

  if (matches.length === 0) {
    verdictEl.className = 'verdict ng';
    verdictEl.textContent = '一致しませんでした';
  } else if (active) {
    verdictEl.className = 'verdict ok';
    const quote = document.createElement('span');
    quote.className = 'verdict-quote';
    quote.textContent = JSON.stringify(text.slice(active.start, active.end));
    const head = multiple ? `${matches.length}件が一致 ` : '一致 ';
    verdictEl.replaceChildren(head, quote, ` (位置 ${active.start}〜${active.end})`);
  }

  capturesEl.replaceChildren();
  for (const cap of active?.captures ?? []) {
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

// 一致が2件以上のときだけ、何件目を検証しているか選ぶナビを出す。
function renderMatchNav(total: number): void {
  if (total <= 1) {
    matchNav.hidden = true;
    return;
  }
  matchNav.hidden = false;
  matchCount.textContent = `${activeMatch + 1} / ${total}`;
  matchPrevBtn.disabled = activeMatch <= 0;
  matchNextBtn.disabled = activeMatch >= total - 1;
}

function selectMatch(index: number): void {
  const total = run?.matches.length ?? 0;
  const next = Math.max(0, Math.min(total - 1, index));
  if (next === activeMatch) return;
  activeMatch = next;
  stepIndex = -1;
  renderResult();
}

function clearHighlights(): void {
  diagramEl.querySelectorAll('.rr-node.active, .rr-node.consumed, .rr-node.failed').forEach((n) => {
    n.classList.remove('active', 'consumed', 'failed');
  });
  stringView.querySelectorAll('.ch.at').forEach((n) => n.classList.remove('at'));
}

function updateStep(): void {
  clearHighlights();
  const steps = currentSteps();
  const total = steps.length;
  const shown = stepIndex + 1;
  progressFill.style.width = total > 0 ? `${(shown / total) * 100}%` : '0';

  if (!run || total === 0) {
    stepStatus.textContent = run ? 'ステップなし' : '';
  } else if (stepIndex < 0) {
    stepStatus.textContent = `0 / ${total}  先頭`;
  } else {
    const step = steps[stepIndex]!;
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
  nextBtn.disabled = !run || stepIndex >= last;
}

nextBtn.addEventListener('click', () => {
  const total = currentSteps().length;
  if (total === 0) return;
  stepIndex = Math.min(total - 1, stepIndex + 1);
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

matchPrevBtn.addEventListener('click', () => selectMatch(activeMatch - 1));
matchNextBtn.addEventListener('click', () => selectMatch(activeMatch + 1));

// 入力欄の外では矢印キーでステップを進める(無効なボタンのクリックは何もしない)。
// 上下キーは複数一致の選択を切り替える。
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
  } else if (ev.key === 'ArrowDown') {
    ev.preventDefault();
    selectMatch(activeMatch + 1);
  } else if (ev.key === 'ArrowUp') {
    ev.preventDefault();
    selectMatch(activeMatch - 1);
  }
});

/* ── サンプル ── */

app.querySelectorAll<HTMLButtonElement>('.example-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const ex = EXAMPLES[Number(btn.dataset.example)];
    if (!ex) return;
    reInput.value = ex.pattern;
    testInput.value = ex.test;
    flagsInput.value = '';
    rebuild();
  });
});

reInput.addEventListener('input', rebuild);
testInput.addEventListener('input', rebuild);
flagsInput.addEventListener('input', () => {
  const cleaned = sanitizeFlags(flagsInput.value.toLowerCase());
  if (cleaned !== flagsInput.value) flagsInput.value = cleaned;
  rebuild();
});
window.addEventListener('hashchange', () => {
  const next = decodeState(location.hash);
  if (next.pattern !== undefined && next.pattern !== reInput.value) reInput.value = next.pattern;
  if (next.test !== undefined && next.test !== testInput.value) testInput.value = next.test;
  const nextFlags = sanitizeFlags(next.flags ?? '');
  if (next.flags !== undefined && nextFlags !== flagsInput.value) flagsInput.value = nextFlags;
  rebuild();
});

diagramEl.addEventListener('scroll', updateDiagramFades, { passive: true });
window.addEventListener('resize', updateDiagramFades);

rebuild();

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
