/*
 * Graph Styler — one-click aesthetic themes for the Obsidian graph view.
 * Copyright (c) 2026 Moonweave  (https://www.instagram.com/phd.ai.log/)
 * Released under the MIT License. Made by Moonweave.
 */
'use strict';

const { Plugin, ItemView, Notice } = require('obsidian');

const AUTHOR = 'Moonweave';
const AUTHOR_URL = 'https://github.com/moonweave';
const VIEW_TYPE = 'graph-styler-panel';
const LIVE_ID = '__live__';

// ---------------------------------------------------------------- i18n
function detectLang() {
  try {
    const explicit = (window.localStorage.getItem('language') || '').toLowerCase();
    if (explicit.startsWith('ko')) return 'ko';
    if (explicit) return 'en';
  } catch (_) { /* ignore */ }
  try {
    if ((navigator.language || '').toLowerCase().startsWith('ko')) return 'ko';
  } catch (_) { /* ignore */ }
  return 'en';
}

const STRINGS = {
  en: {
    title: '🎨 Graph Styler',
    desc: 'Tap a preset — colors and glow change instantly while your current graph physics stays unchanged.',
    themes: 'Themes',
    physicsNote: 'Built-in themes change color, glow, and group styling only. Your graph physics and visual size settings stay unchanged.',
    restore: '↩︎ Restore original',
    restoreNote: 'Restore returns to the graph settings saved before Graph Styler first changed this vault.',
    restoreConfirm: 'Restore the graph settings saved before Graph Styler first changed this vault? Changes made since then will be overwritten.',
    openCmd: 'Open Graph Styler panel',
    applyCmd: 'Apply',
    applied: (p) => `${p.emoji} ${p.label} applied`,
    failed: 'Apply failed — open the console (Cmd+Opt+I) to see why',
    openGraph: 'Open a graph view first',
    restored: '↩︎ Restored to original',
    noBackup: 'No backup found',
    by: 'made by ',
    exportTitle: 'Export',
    exportCmd: 'Export graph as PNG',
    exportScaleNote: 'Scale is relative to the graph as it is drawn on your screen.',
    exported: (path, w, h) => `🖼️ Saved ${path} (${w}×${h})`,
    exportLowRes: 'High-resolution export unavailable — saved at screen resolution',
    exportCapped: (req, k) => `${req}x is too large for this graph view — saved at ${k}x`,
    exportFailed: 'PNG export failed — open the console (Cmd+Opt+I) to see why',
    customize: '🎛️ Customize',
    customizeNote: 'Customize changes graph physics live. Save it only if you want a reusable custom preset.',
    active: 'active',
    myPresets: 'My presets',
    save: '💾 Save as preset',
    namePh: 'Preset name',
    saved: (n) => `💾 “${n}” saved`,
    deleted: 'Preset deleted',
    f: {
      colors: 'Group colors', bg: 'Background', glow: 'Glow',
      repel: 'Repel', dist: 'Link distance', center: 'Center', linkS: 'Link force',
      node: 'Node size', line: 'Link width', fade: 'Text fade',
    },
  },
  ko: {
    title: '🎨 Graph Styler',
    desc: '프리셋을 누르면 색과 글로우가 바로 바뀌고, 현재 그래프 물리는 그대로 유지됩니다.',
    themes: '테마',
    physicsNote: '기본 테마는 색·글로우·그룹 스타일만 바꾸고 현재 그래프 물리·크기 설정은 유지합니다.',
    restore: '↩︎ 원래대로 되돌리기',
    restoreNote: '되돌리기는 Graph Styler가 이 vault를 처음 변경하기 전에 저장한 그래프 설정으로 돌아갑니다.',
    restoreConfirm: 'Graph Styler가 이 vault를 처음 적용하기 전의 그래프 설정으로 되돌릴까요? 그 이후의 변경은 덮어써집니다.',
    openCmd: 'Graph Styler 패널 열기',
    applyCmd: '적용',
    applied: (p) => `${p.emoji} ${p.label} 적용 완료`,
    failed: '적용 실패 — 콘솔(Cmd+Opt+I)에서 원인 확인',
    openGraph: '그래프 뷰를 먼저 열어주세요',
    restored: '↩︎ 원래대로 복구함',
    noBackup: '백업이 없어요',
    by: 'made by ',
    exportTitle: '내보내기',
    exportCmd: '그래프를 PNG로 내보내기',
    exportScaleNote: '배율은 지금 화면에 그려진 그래프 크기 기준입니다.',
    exported: (path, w, h) => `🖼️ ${path} 저장됨 (${w}×${h})`,
    exportLowRes: '고해상도 불가, 화면 해상도로 저장',
    exportCapped: (req, k) => `${req}x는 이 그래프 화면에 너무 커서 ${k}x로 저장`,
    exportFailed: 'PNG 내보내기 실패 — 콘솔(Cmd+Opt+I)에서 원인 확인',
    customize: '🎛️ 커스터마이즈',
    customizeNote: '커스터마이즈는 그래프 물리를 실시간으로 바꿉니다. 다시 쓸 설정만 프리셋으로 저장하세요.',
    active: '현재 적용됨',
    myPresets: '내 프리셋',
    save: '💾 내 프리셋으로 저장',
    namePh: '프리셋 이름',
    saved: (n) => `💾 “${n}” 저장됨`,
    deleted: '프리셋 삭제됨',
    f: {
      colors: '그룹 색', bg: '배경', glow: '글로우',
      repel: '반발력', dist: '링크 거리', center: '중심력', linkS: '링크력',
      node: '노드 크기', line: '링크 두께', fade: '텍스트 페이드',
    },
  },
};

const L = STRINGS[detectLang()];

// ---------------------------------------------------------------- color helpers
function rgbOf(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16));
}

function toHex(rgb) {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function mix(a, b, t) {
  const A = rgbOf(a);
  const B = rgbOf(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
}

function lighten(hex, t) {
  return mix(hex, '#ffffff', t);
}

function hexToRgbInt(hex) {
  return parseInt(hex.replace('#', ''), 16);
}

// ---------------------------------------------------------------- graph option helpers
function makeGroups(queries, colors) {
  return queries.map((query, i) => ({
    query,
    color: { a: 1, rgb: hexToRgbInt(colors[i % colors.length]) },
  }));
}

// 프리셋은 배경까지 포함한 한 벌의 룩 — 밝은 테마에서도 그래프 영역은 같은 모습으로 적용한다.
// 테마 클래스를 앞에 붙이는 건 앱 기본 색 규칙보다 우선하기 위해서다.
function themed(selector) {
  return `.theme-dark ${selector},\n.theme-light ${selector}`;
}

// Obsidian 1.x의 그래프 영역은 그래프·로컬 그래프 leaf의 .view-content다.
// (.graph-view-content는 지금 앱에 없는 요소라 배경·필터가 적용되지 않았다.)
// 창 제목줄은 건드리지 않는다.
function graphPane(suffix) {
  return ['graph', 'localgraph']
    .map((type) => themed(`.workspace-leaf-content[data-type="${type}"] .view-content${suffix}`))
    .join(',\n');
}

// 노드·선·글자 색은 렌더러가 body 아래에 잠깐 만드는 .graph-view.color-* 요소에서 읽는다.
// 글로우 filter는 그래프를 실제로 그리는 iframe에 건다. 1.11.7·1.14.4에서 .view-content의 canvas는
// 입력만 받는 투명 오버레이라 filter가 화면을 바꾸지 않는다(그 앞 버전이 canvas에 직접 그렸는지는
// 확인하지 못해 선택자는 남겨 둔다).
function makeGlowCss(p) {
  return `/* graph-styler :: ${p.id} (auto-generated) */
${graphPane('')} {
  background: radial-gradient(circle at 50% 42%, ${p.bg1} 0%, ${p.bg2} 48%, ${p.bg3} 100%) !important;
}
${themed('.graph-view.color-circle')} { color: ${p.circle}; }
${themed('.graph-view.color-fill')} { color: ${p.fill}; }
${themed('.graph-view.color-fill-tag')} { color: ${p.tag}; }
${themed('.graph-view.color-fill-unresolved')} { color: ${p.unresolved}; }
${themed('.graph-view.color-fill-focused')} { color: #ffffff; }
${themed('.graph-view.color-line')} { color: ${p.line}; }
${themed('.graph-view.color-text')} { color: ${p.text}; }
${graphPane(' > iframe')},
${graphPane(' > canvas')} { filter: ${p.filter}; }
`;
}

// 테마 관련 옵션만. 구조적 사용자 설정(hideUnresolved/showAttachments/showArrow)은
// 일부러 건드리지 않아 사용자 선호를 보존한다.
const BASE_GRAPH = {
  showTags: true,
  'collapse-color-groups': false, 'collapse-display': false, 'collapse-forces': false,
};

const CUSTOM_GRAPH_KEYS = [
  'textFadeMultiplier', 'nodeSizeMultiplier', 'lineSizeMultiplier',
  'centerStrength', 'repelStrength', 'linkStrength', 'linkDistance',
];

function pick(value, fallback) {
  return value === undefined ? fallback : value;
}

function graph(o) {
  o = o || {};
  return Object.assign({}, BASE_GRAPH, {
    showTags: pick(o.tags, true),
    textFadeMultiplier: pick(o.fade, 1.2),
    nodeSizeMultiplier: pick(o.node, 2.2),
    lineSizeMultiplier: pick(o.line, 0.3),
    centerStrength: pick(o.center, 0.05),
    repelStrength: pick(o.repel, 17),
    linkStrength: pick(o.linkS, 0.2),
    linkDistance: pick(o.dist, 140),
  });
}

const FORCE_KEYS = ['centerStrength', 'repelStrength', 'linkStrength', 'linkDistance'];

function forceOptionsFromGraph(graphOptions) {
  const forces = {};
  for (const key of FORCE_KEYS) {
    if (graphOptions[key] !== undefined) forces[key] = graphOptions[key];
  }
  return forces;
}

// Built-in presets are visual-only. Custom presets explicitly opt into saved forces.
function graphOptionsForPreset(preset) {
  // Built-in presets are visual-only. Their graph values are kept as
  // reference data for customisation, but must not be sent to Obsidian.
  if (!preset.applyForces) return {};
  return CUSTOM_GRAPH_KEYS.reduce((options, key) => {
    if (preset.graph[key] !== undefined) options[key] = preset.graph[key];
    return options;
  }, {});
}

// id, label, emoji, palette colors[], forces, background[3], theme colors, options
function P(id, label, emoji, colors, forces, bg, theme, options) {
  const palette = {
    id, bg1: bg[0], bg2: bg[1], bg3: bg[2],
    circle: theme.circle, fill: theme.fill, tag: theme.tag,
    unresolved: theme.unresolved || '#1e293b', line: theme.line,
    text: theme.text, filter: theme.filter,
  };
  return {
    id, label, emoji, colors,
    swatch: colors.length ? colors : [theme.circle, theme.fill, theme.tag, theme.line],
    applyForces: !!(options && options.applyForces),
    graph: graph(forces || {}),
    palette,
  };
}

function safeHex(hex, fallback) {
  return typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;
}

function finiteRange(value, fallback, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function safePresetId(id) {
  const rawId = typeof id === 'string' ? id.trim() : '';
  const safe = rawId.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return safe || 'custom-invalid';
}

// 사용자 커스텀 raw({id,label,colors[4],bg,glow,forces}) → 프리셋으로 재구성.
// data.json 손편집 대비 hex 검증.
function presetFromRaw(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const sourceColors = Array.isArray(source.colors) ? source.colors.slice(0, 4) : [];
  const colors = sourceColors.map((c, i) => safeHex(c, DEFAULT_CUSTOM.colors[i] || '#8899aa'));
  while (colors.length < 4) colors.push('#8899aa');
  const bgHex = safeHex(source.bg, DEFAULT_CUSTOM.bg);
  const bg = [mix(bgHex, colors[0], 0.2), mix(bgHex, colors[0], 0.08), bgHex];
  const g = finiteRange(source.glow, DEFAULT_CUSTOM.glow, 0, 100);
  const sourceForces = source.forces && typeof source.forces === 'object' && !Array.isArray(source.forces)
    ? source.forces : {};
  const forces = {
    node: finiteRange(sourceForces.node, DEFAULT_CUSTOM.forces.node, 0.3, 4),
    repel: finiteRange(sourceForces.repel, DEFAULT_CUSTOM.forces.repel, 0, 20),
    dist: finiteRange(sourceForces.dist, DEFAULT_CUSTOM.forces.dist, 30, 500),
    center: finiteRange(sourceForces.center, DEFAULT_CUSTOM.forces.center, 0, 1),
    linkS: finiteRange(sourceForces.linkS, DEFAULT_CUSTOM.forces.linkS, 0, 1),
    line: finiteRange(sourceForces.line, DEFAULT_CUSTOM.forces.line, 0.1, 2),
    fade: finiteRange(sourceForces.fade, DEFAULT_CUSTOM.forces.fade, 0, 3),
  };
  const theme = {
    circle: colors[0], fill: colors[1], tag: colors[2],
    line: mix(colors[0], bgHex, 0.55), text: lighten(colors[0], 0.72),
    unresolved: mix(bgHex, '#ffffff', 0.1),
    filter: `brightness(${(1 + g / 280).toFixed(2)}) contrast(1.06) saturate(${(1 + g / 110).toFixed(2)})`,
  };
  const label = typeof source.label === 'string' ? source.label.trim() : 'Custom';
  return P(safePresetId(source.id), label || 'Custom', '🎛️', colors, forces, bg, theme, { applyForces: true });
}

const DEFAULT_CUSTOM = {
  colors: ['#7dd3fc', '#34d399', '#fbbf24', '#f472b6'],
  bg: '#0b1624',
  glow: 40,
  forces: { node: 2.2, repel: 17, dist: 140, center: 0.05, linkS: 0.2, line: 0.3, fade: 1.2 },
};

function draftFromGraph(options) {
  const o = options || {};
  return {
    colors: [...DEFAULT_CUSTOM.colors],
    bg: DEFAULT_CUSTOM.bg,
    glow: DEFAULT_CUSTOM.glow,
    forces: {
      node: pick(o.nodeSizeMultiplier, DEFAULT_CUSTOM.forces.node),
      repel: pick(o.repelStrength, DEFAULT_CUSTOM.forces.repel),
      dist: pick(o.linkDistance, DEFAULT_CUSTOM.forces.dist),
      center: pick(o.centerStrength, DEFAULT_CUSTOM.forces.center),
      linkS: pick(o.linkStrength, DEFAULT_CUSTOM.forces.linkS),
      line: pick(o.lineSizeMultiplier, DEFAULT_CUSTOM.forces.line),
      fade: pick(o.textFadeMultiplier, DEFAULT_CUSTOM.forces.fade),
    },
    name: '',
  };
}

const PRESETS = {
  neon: P('neon', 'Neon', '⚡',
    ['#7dd3fc', '#34d399', '#fbbf24', '#f472b6'], { node: 2.4, repel: 18, dist: 140 },
    ['rgba(37,67,92,0.9)', 'rgba(18,38,58,0.96)', '#0b1624'],
    { circle: '#7dd3fc', fill: '#34d399', tag: '#fb7fc8', line: '#315b7a', text: '#e5eefc',
      filter: 'brightness(1.25) contrast(1.15) saturate(1.5)' }),

  galaxy: P('galaxy', 'Galaxy', '🌌',
    ['#93c5fd', '#a78bfa', '#e879f9', '#fb7185'],
    { node: 1.8, repel: 20, dist: 200, center: 0.05, linkS: 0.12, fade: 1.6 },
    ['rgba(48,40,86,0.9)', 'rgba(25,24,55,0.97)', '#0b0b1f'],
    { circle: '#bfdbfe', fill: '#a78bfa', tag: '#e879f9', line: '#51447d', text: '#f3f0ff',
      unresolved: '#2b2545', filter: 'brightness(1.28) contrast(1.12) saturate(1.25)' }),

  aurora: P('aurora', 'Aurora', '🌠',
    ['#6ee7b7', '#5eead4', '#67e8f9', '#a78bfa'],
    { node: 1.9, repel: 19, dist: 180, linkS: 0.15 },
    ['rgba(6,40,36,0.92)', 'rgba(5,26,46,0.97)', '#02080f'],
    { circle: '#6ee7b7', fill: '#5eead4', tag: '#a78bfa', line: '#225a52', text: '#d7fff4',
      unresolved: '#10241f', filter: 'brightness(1.3) contrast(1.12) saturate(1.5)' }),

  sunset: P('sunset', 'Sunset', '🌅',
    ['#fb923c', '#ec4899', '#fbbf24', '#f43f5e'], { node: 2.3, repel: 16, dist: 135 },
    ['rgba(59,31,43,0.92)', 'rgba(42,20,32,0.97)', '#160a10'],
    { circle: '#fdba74', fill: '#fb7185', tag: '#f9a8d4', line: '#7c3f52', text: '#ffe8d6',
      unresolved: '#2a1c22', filter: 'brightness(1.25) contrast(1.1) saturate(1.45)' }),

  vapor: P('vapor', 'Vaporwave', '🌴',
    ['#ff7ad9', '#7afcff', '#b39dff', '#7aa2ff'], { node: 2.2, repel: 18, dist: 160 },
    ['rgba(42,10,63,0.92)', 'rgba(26,10,51,0.97)', '#0c0518'],
    { circle: '#ff7ad9', fill: '#7afcff', tag: '#b39dff', line: '#5b2f7a', text: '#ffe6fb',
      unresolved: '#241033', filter: 'brightness(1.35) contrast(1.1) saturate(1.6)' }),

  ocean: P('ocean', 'Ocean', '🌊',
    ['#38bdf8', '#14b8a6', '#06b6d4', '#a78bfa'], { node: 2.1, repel: 17, dist: 150 },
    ['rgba(6,32,51,0.92)', 'rgba(4,22,42,0.97)', '#020a16'],
    { circle: '#67e8f9', fill: '#0ea5e9', tag: '#a78bfa', line: '#245b78', text: '#dff6ff',
      unresolved: '#0c2030', filter: 'brightness(1.2) contrast(1.14) saturate(1.35)' }),

  forest: P('forest', 'Forest', '🌲',
    ['#84cc16', '#16a34a', '#2dd4bf', '#eab308'],
    { node: 2.0, repel: 13, dist: 115, center: 0.08, linkS: 0.35 },
    ['rgba(17,36,15,0.92)', 'rgba(12,26,11,0.97)', '#060d06'],
    { circle: '#84cc16', fill: '#16a34a', tag: '#eab308', line: '#315a2a', text: '#e8ffd8',
      unresolved: '#16240f', filter: 'brightness(1.12) contrast(1.08) saturate(1.25)' }),

  candy: P('candy', 'Candy', '🍬',
    ['#f9a8d4', '#a7f3d0', '#c4b5fd', '#fde68a'],
    { node: 2.1, repel: 13, dist: 115, center: 0.08, linkS: 0.35 },
    ['rgba(42,35,54,0.92)', 'rgba(31,26,43,0.97)', '#14111c'],
    { circle: '#f9a8d4', fill: '#a7f3d0', tag: '#c4b5fd', line: '#5a4f6b', text: '#fff0fa',
      unresolved: '#241f2e', filter: 'brightness(1.25) contrast(1.05) saturate(1.35)' }),

  gold: P('gold', 'Gold', '✨',
    ['#fde047', '#fb923c', '#fda4af', '#fef3c7'], { node: 2.5, repel: 16, dist: 140 },
    ['rgba(36,27,8,0.92)', 'rgba(24,18,10,0.97)', '#0c0904'],
    { circle: '#fde047', fill: '#fb923c', tag: '#fda4af', line: '#6b5320', text: '#fff6dc',
      unresolved: '#241b08', filter: 'brightness(1.28) contrast(1.15) saturate(1.4)' }),

  cyber: P('cyber', 'Cyberpunk', '👾',
    ['#39ff14', '#ff2bd6', '#16f0ff', '#a855f7'], { node: 2.4, repel: 18, dist: 150 },
    ['rgba(0,16,5,0.95)', 'rgba(0,10,8,0.98)', '#000000'],
    { circle: '#16f0ff', fill: '#39ff14', tag: '#ff2bd6', line: '#0c5a3a', text: '#d8ffe8',
      unresolved: '#07140d', filter: 'brightness(1.4) contrast(1.25) saturate(1.7)' }),

  nord: P('nord', 'Nord', '❄️',
    ['#88c0d0', '#5e81ac', '#a3be8c', '#b48ead'],
    { node: 2.0, repel: 16, dist: 145, fade: 1.3 },
    ['rgba(46,52,64,0.92)', 'rgba(40,46,58,0.97)', '#21262f'],
    { circle: '#88c0d0', fill: '#a3be8c', tag: '#b48ead', line: '#56657a', text: '#eceff4',
      unresolved: '#434c5e', filter: 'brightness(1.16) contrast(1.08) saturate(1.2)' }),

  dracula: P('dracula', 'Dracula', '🧛',
    ['#bd93f9', '#ff79c6', '#50fa7b', '#8be9fd'], { node: 2.2, repel: 17, dist: 150 },
    ['rgba(40,42,54,0.92)', 'rgba(30,31,42,0.97)', '#191a21'],
    { circle: '#bd93f9', fill: '#50fa7b', tag: '#ff79c6', line: '#44475a', text: '#f8f8f2',
      unresolved: '#383a4a', filter: 'brightness(1.18) contrast(1.08) saturate(1.3)' }),

  catppuccin: P('catppuccin', 'Catppuccin', '🐈',
    ['#cba6f7', '#f38ba8', '#a6e3a1', '#89b4fa'], { node: 2.1, repel: 16, dist: 145 },
    ['rgba(49,50,68,0.92)', 'rgba(30,30,46,0.97)', '#181825'],
    { circle: '#89b4fa', fill: '#a6e3a1', tag: '#f38ba8', line: '#585b70', text: '#dce3f7',
      unresolved: '#45475a', filter: 'brightness(1.16) contrast(1.08) saturate(1.2)' }),

  mono: P('mono', 'Mono', '⚪',
    [], { tags: false, node: 1.6, repel: 12, dist: 100, center: 0.1, linkS: 0.4, fade: 1.0, line: 0.2 },
    ['rgba(24,24,27,0.9)', 'rgba(15,15,17,0.97)', '#0a0a0b'],
    { circle: '#e4e4e7', fill: '#a1a1aa', tag: '#71717a', line: '#3f3f46', text: '#fafafa',
      unresolved: '#27272a', filter: 'brightness(1.1) contrast(1.05) saturate(1.0)' }),
};

const SLIDERS = [
  ['node', 0.3, 4, 0.1], ['repel', 0, 20, 0.5], ['dist', 30, 500, 5],
  ['center', 0, 1, 0.02], ['linkS', 0, 1, 0.02], ['line', 0.1, 2, 0.05], ['fade', 0, 3, 0.1],
];

function sliderStep(value, min, step) {
  const offset = (Number(value) - min) / step;
  return Number.isFinite(offset) && Math.abs(offset - Math.round(offset)) < 1e-9
    ? String(step) : 'any';
}

// ---------------------------------------------------------------- PNG export
const EXPORT_SCALES = [1, 2, 3, 4];

// 그래프 캔버스는 이미 화면 픽셀(DPR) 크기다. 배율은 그 위에 곱하고 GL 최대 치수 안으로 줄인다.
function exportScaleLimit(maxTexture, width, height, requested) {
  const max = Number.isFinite(maxTexture) && maxTexture > 0 ? maxTexture : 16384;
  const limit = Math.floor(max / Math.max(width, height, 1));
  return Math.max(1, Math.min(requested, limit));
}

function exportFileName(presetId, date, existing) {
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}`;
  const base = `graph-${presetId ? safePresetId(presetId) : 'graph'}-${stamp}`;
  const taken = new Set(existing);
  let name = `${base}.png`;
  for (let i = 2; taken.has(name); i++) name = `${base}-${i}.png`;
  return name;
}

// 그래프 렌더러의 비공개 API(Obsidian 1.11.7·1.14.4에서 확인). 하나라도 없으면 고해상도 재렌더를 시도하지 않는다.
function canRenderHighRes(renderer) {
  const px = renderer && renderer.px;
  return !!(px && px.renderer && px.renderer.view && typeof px.renderer.resize === 'function'
    && typeof renderer.renderCallback === 'function'
    && typeof renderer.setScale === 'function' && typeof renderer.setPan === 'function'
    && typeof renderer.fLineSizeMult === 'number'
    && Array.isArray(renderer.nodes) && renderer.nodes.some((node) => node && node.text));
}

// 브라우저는 너무 큰 WebGL 버퍼를 말없이 줄인다(Chromium은 면적 기준 — 1.14.4에서 6368×6576 요청이
// 5668×5853이 됐다). 그대로 그리면 그래프가 한쪽으로 밀리고 잘리므로 버퍼가 다 들어갈 때까지 배율을 낮춘다.
function drawingBufferFits(R) {
  const gl = R.gl;
  if (!gl || typeof gl.drawingBufferWidth !== 'number') return true;
  return gl.drawingBufferWidth >= R.view.width && gl.drawingBufferHeight >= R.view.height;
}

// 렌더러를 k배 크기로 한 번 다시 그리고, 그 순간의 버퍼를 draw(view)에 넘긴다. 실제로 쓴 배율을 돌려준다.
// preserveDrawingBuffer가 꺼져 있어 버퍼는 같은 태스크 안에서만 읽힌다.
// setScale은 nodeScale = sqrt(1/scale)로 노드·글자를 다시 줄이므로 원래 값으로 고정하고,
// 선 두께와 글자 래스터 해상도만 k배 한다.
function renderGraphAt(r, k, draw) {
  const R = r.px.renderer;
  const baseSetScale = r.setScale;
  const ownSetScale = Object.prototype.hasOwnProperty.call(r, 'setScale');
  const save = {
    W: R.width, H: R.height, width: r.width, height: r.height,
    scale: r.scale, targetScale: r.targetScale, panX: r.panX, panY: r.panY,
    nodeScale: r.nodeScale, textAlpha: r.textAlpha, line: r.fLineSizeMult, idleFrames: r.idleFrames,
  };
  const texts = r.nodes.filter((node) => node && node.text).map((node) => [node.text, node.text.resolution]);
  try {
    R.resize(save.W * k, save.H * k);
    while (k > 1 && !drawingBufferFits(R)) {
      k -= 1;
      R.resize(save.W * k, save.H * k);
    }
    r.width = save.width * k;
    r.height = save.height * k;
    r.fLineSizeMult = save.line * k;
    r.setScale = function (scale) {
      baseSetScale.call(this, scale);
      this.nodeScale = save.nodeScale;
      this.textAlpha = save.textAlpha;
    };
    r.targetScale = save.scale * k;
    r.setScale(save.scale * k);
    r.setPan(save.panX * k, save.panY * k);
    for (const [text, resolution] of texts) text.resolution = resolution * k;
    r.idleFrames = 0;
    r.renderCallback();
    draw(R.view);
    return k;
  } finally {
    if (ownSetScale) r.setScale = baseSetScale;
    else delete r.setScale;
    R.resize(save.W, save.H);
    r.width = save.width;
    r.height = save.height;
    r.fLineSizeMult = save.line;
    r.targetScale = save.targetScale;
    r.setScale(save.scale);
    r.setPan(save.panX, save.panY);
    r.nodeScale = save.nodeScale;
    r.textAlpha = save.textAlpha;
    for (const [text, resolution] of texts) text.resolution = resolution;
    r.idleFrames = save.idleFrames;
    r.changed();
  }
}

// 프리셋 배경은 makeGlowCss의 radial-gradient(circle at 50% 42%, …)와 같은 모양으로 칠한다.
// circle의 기본 반지름은 가장 먼 모서리까지다.
function paintGraphBackground(ctx, w, h, base, palette) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  if (!palette) return;
  const cx = w * 0.5;
  const cy = h * 0.42;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)));
  gradient.addColorStop(0, palette.bg1);
  gradient.addColorStop(0.48, palette.bg2);
  gradient.addColorStop(1, palette.bg3);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

class StylerView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this._raf = null;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Graph Styler'; }
  getIcon() { return 'palette'; }

  async onOpen() { this.render(); }
  async onClose() {
    if (this._raf) window.cancelAnimationFrame(this._raf);
  }

  presetButton(parent, preset, onDelete) {
    const btn = parent.createEl('button', { cls: 'gs-btn' });
    const active = this.plugin.currentPreset && this.plugin.currentPreset.id === preset.id;
    btn.toggleClass('is-active', !!active);
    btn.setAttr('aria-pressed', active ? 'true' : 'false');
    btn.setAttr('aria-label', `${preset.label}${active ? ` (${L.active})` : ''}`);
    const swatch = btn.createSpan({ cls: 'gs-swatch' });
    for (const color of preset.swatch) {
      const dot = swatch.createSpan({ cls: 'gs-dot' });
      dot.style.backgroundColor = color;
      dot.style.boxShadow = `0 0 5px ${color}`;
    }
    btn.createSpan({ cls: 'gs-btn-label', text: `${preset.emoji}  ${preset.label}` });
    btn.onclick = () => this.plugin.applyPreset(preset);
    if (onDelete) {
      const del = btn.createSpan({ cls: 'gs-del', text: '✕' });
      del.onclick = (ev) => { ev.stopPropagation(); onDelete(); };
    }
    return btn;
  }

  render() {
    const c = this.contentEl;
    c.empty();
    c.addClass('graph-styler-panel');
    c.createEl('h3', { text: L.title });
    c.createEl('p', { text: L.desc, cls: 'setting-item-description' });

    // built-in presets
    c.createEl('div', { cls: 'gs-section', text: L.themes });
    c.createEl('p', { text: L.physicsNote, cls: 'gs-note' });
    const list = c.createDiv({ cls: 'gs-list' });
    for (const key of Object.keys(PRESETS)) this.presetButton(list, PRESETS[key]);

    // user presets
    const custom = this.plugin.settings.custom || [];
    if (custom.length) {
      c.createEl('div', { cls: 'gs-section', text: L.myPresets });
      const myList = c.createDiv({ cls: 'gs-list' });
      for (const raw of custom) {
        this.presetButton(myList, presetFromRaw(raw), () => this.plugin.deleteCustom(raw.id));
      }
    }

    const restore = c.createEl('button', { cls: 'gs-restore', text: L.restore });
    restore.setAttr('title', L.restoreNote);
    restore.onclick = () => this.plugin.restore();
    c.createEl('p', { text: L.restoreNote, cls: 'gs-note gs-restore-note' });

    this.buildCustomize(c);
    this.buildExport(c);

    const credit = c.createDiv({ cls: 'gs-credit' });
    credit.createSpan({ text: L.by });
    const link = credit.createEl('a', { text: AUTHOR, href: AUTHOR_URL });
    link.setAttr('target', '_blank');
    link.setAttr('rel', 'noopener');
  }

  // 컨트롤 값은 plugin.draft에 write-through → 재렌더/저장 후에도 유지(리셋 안 됨)
  buildCustomize(c) {
    const draft = this.plugin.draft;
    const details = c.createEl('details', { cls: 'gs-custom' });
    details.open = this.plugin.customizeOpen;
    details.addEventListener('toggle', () => { this.plugin.customizeOpen = details.open; });
    details.createEl('summary', { text: L.customize });
    details.createEl('p', { text: L.customizeNote, cls: 'gs-note' });

    // group colors
    const colorRow = details.createDiv({ cls: 'gs-row' });
    colorRow.createSpan({ cls: 'gs-row-label', text: L.f.colors });
    const colorBox = colorRow.createSpan({ cls: 'gs-colors' });
    draft.colors.forEach((hex, i) => {
      const input = colorBox.createEl('input');
      input.type = 'color';
      input.value = hex;
      input.oninput = () => { draft.colors[i] = input.value; this.schedulePreview(); };
    });

    // background color
    const bgRow = details.createDiv({ cls: 'gs-row' });
    bgRow.createSpan({ cls: 'gs-row-label', text: L.f.bg });
    const bgEl = bgRow.createEl('input');
    bgEl.type = 'color';
    bgEl.value = draft.bg;
    bgEl.oninput = () => { draft.bg = bgEl.value; this.schedulePreview(); };

    // glow + force/size sliders
    this.sliderRow(details, L.f.glow, 0, 100, 5, draft.glow, (v) => { draft.glow = v; });
    for (const [key, min, max, step] of SLIDERS) {
      this.sliderRow(details, L.f[key], min, max, step, draft.forces[key], (v) => { draft.forces[key] = v; });
    }

    // name + save
    const saveRow = details.createDiv({ cls: 'gs-row' });
    const nameEl = saveRow.createEl('input', { cls: 'gs-name' });
    nameEl.type = 'text';
    nameEl.placeholder = L.namePh;
    nameEl.value = draft.name;
    nameEl.oninput = () => { draft.name = nameEl.value; };
    const saveBtn = details.createEl('button', { cls: 'gs-save', text: L.save });
    saveBtn.onclick = () => this.saveCurrent();
  }

  sliderRow(parent, label, min, max, step, value, onChange) {
    const row = parent.createDiv({ cls: 'gs-row' });
    row.createSpan({ cls: 'gs-row-label', text: label });
    const input = row.createEl('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = sliderStep(value, min, step);
    input.value = String(value);
    input.oninput = () => { onChange(Number(input.value)); this.schedulePreview(); };
    return input;
  }

  buildExport(c) {
    c.createEl('div', { cls: 'gs-section', text: L.exportTitle });
    const row = c.createDiv({ cls: 'gs-row' });
    const scaleEl = row.createEl('select', { cls: 'dropdown' });
    for (const k of EXPORT_SCALES) scaleEl.createEl('option', { value: String(k), text: `${k}x` });
    scaleEl.value = String(this.plugin.exportScale);
    scaleEl.onchange = () => { this.plugin.exportScale = Number(scaleEl.value); };
    const exportBtn = row.createEl('button', { cls: 'gs-export', text: L.exportCmd });
    exportBtn.onclick = () => this.plugin.exportPng(this.plugin.exportScale);
    c.createEl('p', { text: L.exportScaleNote, cls: 'gs-note' });
  }

  rawFromDraft(id) {
    const d = this.plugin.draft;
    return {
      id,
      label: (d.name || 'Custom').trim() || 'Custom',
      colors: d.colors.slice(),
      bg: d.bg,
      glow: d.glow,
      forces: { ...d.forces },
    };
  }

  // rAF 스로틀: 한 프레임에 한 번만, 디스크 안 건드리는 in-memory 미리보기
  schedulePreview() {
    if (this._raf) return;
    this._raf = window.requestAnimationFrame(() => {
      this._raf = null;
      this.plugin.previewLive(presetFromRaw(this.rawFromDraft(LIVE_ID)));
    });
  }

  async saveCurrent() {
    await this.plugin.saveCustom(this.rawFromDraft(`custom-${Date.now()}`));
  }
}

module.exports = class GraphStyler extends Plugin {
  // 플러그인 로더는 클래스만 쓴다. 내보내기 계산 함수는 테스트용으로 붙여 둔다.
  static exportScaleLimit = exportScaleLimit;
  static exportFileName = exportFileName;

  async onload() {
    this.settings = Object.assign({ custom: [] }, await this.loadData());
    if (!Array.isArray(this.settings.custom)) this.settings.custom = [];
    this.currentForceOptions = {};
    try {
      this.currentForceOptions = forceOptionsFromGraph(JSON.parse(await this.app.vault.adapter.read(this.graphPath())));
    } catch (_) { /* graph.json may not exist yet */ }
    this.draft = draftFromGraph(await this.readGraphOptions());
    this.customizeOpen = false;
    this.exportScale = 3;
    this.currentPreset = null;

    // 업데이트/재활성화 때 onunload가 끈 글로우 스니펫을 복원 (레지스트리 로드 후)
    const restoreSnippet = () => this.resumeSnippet();
    const workspace = this.app.workspace;
    if (workspace && typeof workspace.onLayoutReady === 'function') workspace.onLayoutReady(restoreSnippet);
    else restoreSnippet();

    this.registerView(VIEW_TYPE, (leaf) => new StylerView(leaf, this));
    this.addRibbonIcon('palette', 'Graph Styler', () => this.activateView());
    this.addCommand({
      id: 'open-graph-styler',
      name: L.openCmd,
      callback: () => this.activateView(),
    });
    this.addCommand({
      id: 'export-graph-png',
      name: L.exportCmd,
      callback: () => this.exportPng(this.exportScale),
    });
    for (const key of Object.keys(PRESETS)) {
      const preset = PRESETS[key];
      this.addCommand({
        id: `apply-${key}`,
        name: `${L.applyCmd}: ${preset.label}`,
        callback: () => this.applyPreset(preset),
      });
    }
    // 폴더 구조가 바뀌면 색-그룹 캐시 무효화
    const invalidate = () => { this._queries = null; };
    this.registerEvent(this.app.vault.on('create', invalidate));
    this.registerEvent(this.app.vault.on('delete', invalidate));
    this.registerEvent(this.app.vault.on('rename', invalidate));
  }

  async onunload() {
    try {
      if (this._applying && this._applyIdle) await this._applyIdle;
      // 사용자가 직접 끈 스니펫은 기록하지 않는다 — 다시 켤 때 되살리는 건 여기서 끈 것뿐.
      // 끄기를 먼저 해 새 버전의 로드와 겹치는 구간을 줄인다.
      const resumeId = await this.enabledSnippetId();
      try {
        await this.setActiveSnippet('__none__');
      } finally {
        await this.saveResumeSnippet(resumeId);
      }
    } catch (e) {
      console.warn('[graph-styler] style cleanup on unload skipped', e);
    }
    if (this.liveStyle) {
      this.liveStyle.textContent = '';
      this.liveStyle.remove();
      this.liveStyle = null;
    }
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (!leaf) return;
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view && typeof leaf.view.render === 'function') leaf.view.render();
    }
  }

  // 전역 그래프를 먼저, 없으면 로컬 그래프를 찍는다.
  async exportPng(requestedScale) {
    const leaf = this.app.workspace.getLeavesOfType('graph')
      .concat(this.app.workspace.getLeavesOfType('localgraph'))[0];
    const renderer = leaf && leaf.view && leaf.view.renderer;
    if (!renderer) {
      new Notice(L.openGraph);
      return;
    }
    try {
      const palette = await this.activePalette();
      const base = this.graphBaseColor(leaf.view.contentEl);
      const filter = this.graphFilter(leaf.view.contentEl, renderer);
      let canvas = null;
      const paint = (source) => {
        canvas = document.createElement('canvas');
        canvas.width = source.width;
        canvas.height = source.height;
        const ctx = canvas.getContext('2d');
        paintGraphBackground(ctx, canvas.width, canvas.height, base, palette);
        ctx.filter = filter;
        ctx.drawImage(source, 0, 0);
        ctx.filter = 'none';
      };
      if (canRenderHighRes(renderer)) {
        const R = renderer.px.renderer;
        const gl = R.gl;
        const maxTexture = gl && typeof gl.getParameter === 'function' ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : undefined;
        const used = renderGraphAt(renderer, exportScaleLimit(maxTexture, R.width, R.height, requestedScale), paint);
        if (used < requestedScale) new Notice(L.exportCapped(requestedScale, used));
      } else if (typeof renderer.getTransparentScreenshot === 'function') {
        paint(renderer.getTransparentScreenshot());
        new Notice(L.exportLowRes);
      } else if (typeof renderer.getBackgroundScreenshot === 'function') {
        paint(renderer.getBackgroundScreenshot());
        new Notice(L.exportLowRes);
      } else {
        throw new Error('graph renderer exposes no screenshot API');
      }
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('canvas.toBlob returned no image');
      const presetId = this.currentPreset ? this.currentPreset.id : await this.enabledSnippetId();
      const name = exportFileName(presetId === LIVE_ID ? null : presetId, new Date(),
        this.app.vault.getFiles().map((file) => file.path));
      await this.app.vault.createBinary(name, await blob.arrayBuffer());
      new Notice(L.exported(name, canvas.width, canvas.height));
    } catch (e) {
      console.error('[graph-styler] PNG export failed', e);
      new Notice(L.exportFailed);
    }
  }

  // 그래프 영역에 보이는 프리셋 배경. 적용 중인 스니펫이 없으면 null(테마 배경만).
  async activePalette() {
    if (this.currentPreset) return this.currentPreset.palette;
    const id = await this.enabledSnippetId();
    const preset = Object.values(PRESETS)
      .concat((this.settings.custom || []).map((raw) => presetFromRaw(raw)))
      .find((candidate) => candidate.id === id);
    return preset ? preset.palette : null;
  }

  // 화면의 글로우는 그래프를 실제로 그리는 요소에 걸린 CSS filter다(1.11.7·1.14.4에서는 캔버스를 담은 iframe).
  // 그 요소의 계산된 filter를 그대로 써야 프리셋 스니펫이 어느 요소를 겨냥하든 파일이 화면과 같다.
  // 배경은 그 요소 밖(.view-content)에 칠해지므로 filter를 받지 않는다.
  graphFilter(contentEl, renderer) {
    const view = renderer.px && renderer.px.renderer && renderer.px.renderer.view;
    const doc = view && view.ownerDocument;
    const host = (doc && doc.defaultView && doc.defaultView.frameElement) || view
      || (contentEl && typeof contentEl.querySelector === 'function' && contentEl.querySelector('iframe'));
    if (!host) return 'none';
    const filter = window.getComputedStyle(host).filter;
    return filter && filter !== 'none' ? filter : 'none';
  }

  // 그래프 캔버스는 투명하다. 그래프 영역에서 위로 올라가며 처음 칠해진 배경색을 쓴다.
  graphBaseColor(el) {
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      const color = window.getComputedStyle(node).backgroundColor;
      if (color && color !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(color)) return color;
    }
    return '#ffffff';
  }

  async saveCustom(raw) {
    this.settings.custom.push(raw);
    await this.saveData(this.settings);
    await this.applyPreset(presetFromRaw(raw));   // 미리보기 상태를 디스크에 확정
    this.refreshViews();
    new Notice(L.saved(raw.label));
  }

  async deleteCustom(id) {
    this.settings.custom = this.settings.custom.filter((r) => r.id !== id);
    await this.saveData(this.settings);
    const customCss = this.app.customCss;
    if (customCss && customCss.setCssEnabledStatus) {
      customCss.setCssEnabledStatus(`graph-styler-${safePresetId(id)}`, false);
    }
    await this.removeCustomSnippet(id);
    this.refreshViews();
    new Notice(L.deleted);
  }

  async removeCustomSnippet(id) {
    const adapter = this.app.vault.adapter;
    const path = `${this.app.vault.configDir}/snippets/graph-styler-${safePresetId(id)}.css`;
    try {
      if (!(await adapter.exists(path))) return;
      if (typeof adapter.trash === 'function') {
        try {
          await adapter.trash(path);
          return;
        } catch (_) { /* fall back to adapter removal below */ }
      }
      if (typeof adapter.remove === 'function') await adapter.remove(path);
    } catch (e) {
      console.warn('[graph-styler] generated snippet cleanup skipped', e);
    }
  }

  graphPath() {
    return `${this.app.vault.configDir}/graph.json`;
  }

  async readGraphOptions() {
    try {
      return JSON.parse(await this.app.vault.adapter.read(this.graphPath()));
    } catch (_) {
      return {};
    }
  }

  async readGraphSnapshot() {
    try {
      return { exists: true, contents: await this.app.vault.adapter.read(this.graphPath()) };
    } catch (_) {
      return { exists: false, contents: null };
    }
  }

  async snippetIds() {
    const ids = new Set(Object.keys(PRESETS));
    ids.add(LIVE_ID);
    for (const r of this.settings.custom || []) ids.add(r.id);
    const adapter = this.app.vault.adapter;
    const dir = `${this.app.vault.configDir}/snippets`;
    if (adapter && typeof adapter.list === 'function') {
      try {
        const listing = await adapter.list(dir);
        const prefix = `${dir}/graph-styler-`;
        for (const filePath of listing.files || []) {
          if (!filePath.startsWith(prefix) || !filePath.endsWith('.css')) continue;
          const id = filePath.slice(prefix.length, -'.css'.length);
          if (id) ids.add(id);
        }
      } catch (_) { /* snippets directory may not exist yet */ }
    }
    return ids;
  }

  async setActiveSnippet(activeId) {
    const customCss = this.app.customCss;
    if (!customCss || !customCss.setCssEnabledStatus) return;
    const ids = await this.snippetIds();
    if (activeId && activeId !== '__none__') ids.add(activeId);
    for (const id of ids) customCss.setCssEnabledStatus(`graph-styler-${id}`, id === activeId);
    await this.removeSentinelSnippet();
  }

  async enabledSnippetId() {
    let enabled = this.app.customCss && this.app.customCss.enabledSnippets;
    if (!enabled || typeof enabled.has !== 'function') {
      // 내부 필드가 없으면 저장된 외형 설정에서 읽는다.
      try {
        const appearance = JSON.parse(await this.app.vault.adapter.read(`${this.app.vault.configDir}/appearance.json`));
        enabled = new Set(Array.isArray(appearance.enabledCssSnippets) ? appearance.enabledCssSnippets : []);
      } catch (_) {
        return null;
      }
    }
    for (const id of await this.snippetIds()) {
      if (id !== '__none__' && enabled.has(`graph-styler-${id}`)) return id;
    }
    return null;
  }

  async saveResumeSnippet(id) {
    if (this.settings.resumeSnippet === id) return;
    this.settings.resumeSnippet = id;
    try {
      await this.saveData(this.settings);
    } catch (e) {
      console.warn('[graph-styler] snippet state was not persisted', e);
    }
  }

  async resumeSnippet() {
    try {
      let id = this.settings.resumeSnippet;
      if (id === undefined) id = await this.snippetMatchingGraph();
      if (typeof id === 'string' && id) {
        const path = `${this.app.vault.configDir}/snippets/graph-styler-${id}.css`;
        if (await this.app.vault.adapter.exists(path)) await this.setActiveSnippet(id);
      }
      const active = await this.enabledSnippetId();
      if (active) await this.refreshSnippetFile(active);
    } catch (e) {
      console.warn('[graph-styler] snippet restore skipped', e);
    }
    // 한 번 쓰고 비운다. undefined → null 저장으로 0.1.7 이전 데이터의 추정도 한 번만 한다.
    await this.saveResumeSnippet(null);
  }

  // 이전 버전이 만든 스니펫 파일은 적용할 때의 CSS를 그대로 담고 있다. 생성 CSS가 바뀌었으면
  // (0.1.9: 존재하지 않는 .graph-view-content 선택자 교체) 다시 적용하지 않아도 새 CSS를 쓴다.
  async refreshSnippetFile(id) {
    const preset = Object.values(PRESETS)
      .concat((this.settings.custom || []).map((raw) => presetFromRaw(raw)))
      .find((candidate) => candidate.id === id);
    if (!preset) return;
    const adapter = this.app.vault.adapter;
    const path = `${this.app.vault.configDir}/snippets/graph-styler-${id}.css`;
    const css = makeGlowCss(preset.palette);
    if (!(await adapter.exists(path))) return;
    const current = (await adapter.read(path)).replace(/\r\n/g, '\n');
    // 사용자가 손으로 고친 파일(생성 머리말이 없음)은 건드리지 않는다.
    if (current === css || !current.startsWith(`/* graph-styler :: ${id} (auto-generated) */`)) return;
    await adapter.write(path, css);
    const customCss = this.app.customCss;
    if (customCss && typeof customCss.requestLoadSnippets === 'function') customCss.requestLoadSnippets();
    else if (customCss && typeof customCss.readSnippets === 'function') await customCss.readSnippets();
  }

  // 0.1.7 이하는 업데이트 때 자기 onunload가 스니펫을 끄고 무엇을 껐는지 남기지 않았다.
  // 지금 graph.json의 색 그룹이 프리셋 색과 그대로 일치하면 그 프리셋이 적용 중이었다.
  // 되돌렸거나 색 그룹을 손봤다면 일치하지 않으므로 아무것도 켜지 않는다.
  async snippetMatchingGraph() {
    const groups = (await this.readGraphOptions()).colorGroups;
    if (!Array.isArray(groups) || !groups.length) return null;
    const rgbs = groups.map((group) => group && group.color && group.color.rgb);
    const presets = Object.values(PRESETS).concat((this.settings.custom || []).map((raw) => presetFromRaw(raw)));
    const adapter = this.app.vault.adapter;
    let found = null;
    let newest = -Infinity;
    for (const preset of presets) {
      if (preset.colors.length < rgbs.length) continue;
      if (!rgbs.every((rgb, i) => rgb === hexToRgbInt(preset.colors[i]))) continue;
      const path = `${this.app.vault.configDir}/snippets/graph-styler-${preset.id}.css`;
      if (!(await adapter.exists(path))) continue;
      // 첫 색이 겹치는 프리셋이 여럿이면 마지막으로 다시 쓴 스니펫을 고른다.
      const stat = typeof adapter.stat === 'function' ? await adapter.stat(path) : null;
      const mtime = stat && typeof stat.mtime === 'number' ? stat.mtime : 0;
      if (found === null || mtime > newest) {
        found = preset.id;
        newest = mtime;
      }
    }
    return found;
  }

  async removeSentinelSnippet() {
    const adapter = this.app.vault.adapter;
    const path = `${this.app.vault.configDir}/appearance.json`;
    try {
      const appearance = JSON.parse(await adapter.read(path));
      if (!Array.isArray(appearance.enabledCssSnippets)) return;
      const enabled = appearance.enabledCssSnippets.filter((id) => id !== 'graph-styler-__none__');
      if (enabled.length === appearance.enabledCssSnippets.length) return;
      appearance.enabledCssSnippets = enabled;
      await adapter.write(path, JSON.stringify(appearance, null, 2));
    } catch (_) { /* appearance.json may be unavailable during startup */ }
  }

  // 노트가 많은 폴더 순
  detectColorFolders() {
    const counts = new Map();
    for (const file of this.app.vault.getMarkdownFiles()) {
      const parent = file.parent && file.parent.path;
      if (!parent || parent === '/') continue;
      counts.set(parent, (counts.get(parent) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map((entry) => entry[0]);
  }

  // 많이 쓰인 태그 순 (키에 '#' 포함)
  detectColorTags() {
    let tags = {};
    try {
      if (this.app.metadataCache && this.app.metadataCache.getTags) {
        tags = this.app.metadataCache.getTags() || {};
      }
    } catch (_) {
      tags = {};
    }
    return Object.entries(tags).sort((a, b) => b[1] - a[1]).map((entry) => entry[0]);
  }

  // 색 그룹 쿼리: 폴더(≥2) → 태그 → 폴더(1개)/빈값.
  // 한 vault에서 의미 있는 한 축으로만 칠해 조잡함 방지. (세션 캐시 + 변경 시 무효화)
  getColorQueries(max) {
    if (!this._queries) {
      const escape = (f) => `path:"${f.replace(/"/g, '\\"')}"`;
      const folders = this.detectColorFolders();
      if (folders.length >= 2) {
        this._queries = folders.map(escape);
      } else {
        const tags = this.detectColorTags();
        this._queries = tags.length ? tags.map((t) => `tag:${t}`) : folders.map(escape);
      }
    }
    return this._queries.slice(0, max);
  }

  // 빠른 연속 호출(라이브 드래그)을 직렬화 → graph.json 동시쓰기 레이스 방지 (latest-wins)
  async applyPreset(preset, opts) {
    if (this._applying) {
      this._next = [preset, opts];
      return this._applyIdle;
    }
    this._applying = true;
    let resolveIdle;
    const idle = new Promise((resolve) => { resolveIdle = resolve; });
    this._applyIdle = idle;
    try {
      await this._doApply(preset, opts);
    } finally {
      this._applying = false;
      if (this._next) {
        const [p, o] = this._next;
        this._next = null;
        await this.applyPreset(p, o);
      }
      resolveIdle();
    }
    return idle;
  }

  async _doApply(preset, opts) {
    const live = !!(opts && opts.silent);
    try {
      await this.backupOnce();
      const graphOptions = graphOptionsForPreset(preset);
      if (preset.colors.length === 0) {
        graphOptions.colorGroups = [];                 // mono: 강제 단색
      } else {
        const queries = this.getColorQueries(preset.colors.length);
        if (queries.length) graphOptions.colorGroups = makeGroups(queries, preset.colors);
        // 폴더·태그 둘 다 없으면(완전 평면 vault) 기존 colorGroups 보존 — 덮어쓰지 않음
      }
      const css = makeGlowCss(preset.palette);
      this.ensureLiveStyle();
      const merged = await this.writeGraph(graphOptions);
      this.liveStyle.textContent = css;                  // graph.json 확정 뒤 즉시 시각 반영
      await this.installSnippet(preset.id, css);          // 리로드 영속용
      // Built-ins may update colors in the live engine, but never send force
      // keys. Custom presets explicitly opt into the full force update.
      if (Object.keys(graphOptions).length) {
        await this.reloadGraph(graphOptions, live, true, preset.applyForces);
      }
      this.currentForceOptions = forceOptionsFromGraph(merged);
      this.currentPreset = Object.assign({}, preset, { graph: Object.assign({}, graphOptions) });
      if (!live) this.refreshViews();
      if (!live) new Notice(L.applied(preset));
    } catch (e) {
      console.error('[graph-styler] apply failed', e);
      if (!live) new Notice(L.failed);
    }
  }

  async backupOnce() {
    if (this._backedUp) return;
    const adapter = this.app.vault.adapter;
    const bak = `${this.graphPath()}.styler-bak`;
    if (await adapter.exists(bak)) {
      this._backedUp = true;
      return;
    }
    // graph.json이 아직 없으면 사용자는 Obsidian 기본값을 쓰는 중 — 빈 설정을 원본으로 남긴다.
    const original = (await adapter.exists(this.graphPath()))
      ? await adapter.read(this.graphPath())
      : '{}';
    await adapter.write(bak, original);
    this._backedUp = true;
  }

  async writeGraph(graphOptions) {
    const adapter = this.app.vault.adapter;
    const maxAttempts = 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const before = await this.readGraphSnapshot();
      let current = {};
      try {
        if (before.exists) current = JSON.parse(before.contents);
      } catch (_) {
        current = {};
      }
      const merged = Object.assign({}, current, graphOptions);
      const after = await this.readGraphSnapshot();
      const unchanged = before.exists === after.exists && before.contents === after.contents;
      if (!unchanged) continue;
      await adapter.write(this.graphPath(), JSON.stringify(merged, null, 2));
      return merged;
    }
    throw new Error('graph.json changed while applying preset');
  }

  async installSnippet(presetId, css) {
    const adapter = this.app.vault.adapter;
    const dir = `${this.app.vault.configDir}/snippets`;
    if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
    const path = `${dir}/graph-styler-${presetId}.css`;
    const isNew = !(await adapter.exists(path));
    await adapter.write(path, css);
    try {
      const customCss = this.app.customCss;
      // 전체 재스캔(readSnippets)은 파일을 새로 만들 때만 — registry 등록용. 재적용은 스킵.
      if (isNew && customCss && customCss.readSnippets) await customCss.readSnippets();
      await this.setActiveSnippet(presetId);
    } catch (e) {
      console.warn('[graph-styler] snippet enable failed; toggle it in Settings → CSS snippets', e);
    }
  }

  // engineOnly=true (라이브 드래그): 엔진 직접 갱신만, leaf 리로드(깜빡임) 스킵
  async reloadGraph(graphOptions, engineOnly, shouldRender = true, syncView = false) {
    const leaves = this.app.workspace
      .getLeavesOfType('graph')
      .concat(this.app.workspace.getLeavesOfType('localgraph'));
    if (!leaves.length) {
      if (!engineOnly) new Notice(L.openGraph);
      return;
    }
    for (const leaf of leaves) {
      const view = leaf.view;
      const engine = view && (view.engine || view.dataEngine);
      if (engine && typeof engine.setOptions === 'function') {
        try {
          engine.setOptions(graphOptions);
          if (shouldRender && typeof engine.render === 'function') engine.render();
          if (syncView && !engineOnly) {
            const state = leaf.getViewState();
            await leaf.setViewState({ type: 'empty' });
            await leaf.setViewState(state);
          }
          continue;
        } catch (e) {
          console.warn('[graph-styler] engine.setOptions failed → reloading leaf', e);
        }
      }
      if (engineOnly) continue;
      const state = leaf.getViewState();
      await leaf.setViewState({ type: 'empty' });
      await leaf.setViewState(state);
    }
  }

  ensureLiveStyle() {
    if (!this.liveStyle) {
      this.liveStyle = document.head.createEl('style', { attr: { 'data-graph-styler': 'live' } });
      this.register(() => {
        if (this.liveStyle) {
          this.liveStyle.remove();
          this.liveStyle = null;
        }
      });
    }
  }

  // 라이브 미리보기: 디스크 I/O 0. 글로우/색=주입 <style>, forces/색그룹=engine(메모리).
  previewLive(preset) {
    this.ensureLiveStyle();
    this.liveStyle.textContent = makeGlowCss(preset.palette);
    const graphOptions = graphOptionsForPreset(preset);
    if (preset.colors.length) {
      const queries = this.getColorQueries(preset.colors.length);
      if (queries.length) graphOptions.colorGroups = makeGroups(queries, preset.colors);
    }
    if (preset.applyForces) this.currentForceOptions = forceOptionsFromGraph(graphOptions);
    this.currentPreset = Object.assign({}, preset, { graph: Object.assign({}, graphOptions) });
    const leaves = this.app.workspace
      .getLeavesOfType('graph')
      .concat(this.app.workspace.getLeavesOfType('localgraph'));
    for (const leaf of leaves) {
      const engine = leaf.view && (leaf.view.engine || leaf.view.dataEngine);
      if (engine && typeof engine.setOptions === 'function') {
        try {
          engine.setOptions(graphOptions);
          if ((preset.applyForces || graphOptions.colorGroups)
            && typeof engine.render === 'function') engine.render();
        } catch (_) { /* engine API drift — preview just skips */ }
      }
    }
  }

  async restore() {
    if (this._applying && this._applyIdle) await this._applyIdle;
    const adapter = this.app.vault.adapter;
    const bak = `${this.graphPath()}.styler-bak`;
    if (!(await adapter.exists(bak))) {
      new Notice(L.noBackup);
      return;
    }
    if (typeof window.confirm === 'function' && !window.confirm(L.restoreConfirm)) return;
    const original = await adapter.read(bak);
    await adapter.write(this.graphPath(), original);
    await this.setActiveSnippet('__none__');
    if (this.liveStyle) this.liveStyle.textContent = '';
    let originalOptions = {};
    try {
      originalOptions = JSON.parse(original);
    } catch (_) {
      originalOptions = {};
    }
    this.currentForceOptions = forceOptionsFromGraph(originalOptions);
    this.currentPreset = null;
    // 원본에 색 그룹이 없으면 열린 그래프에 프리셋 색이 남지 않도록 비운다.
    await this.reloadGraph(Object.assign({ colorGroups: [] }, originalOptions));
    this.refreshViews();
    new Notice(L.restored);
  }
};
