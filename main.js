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
    exportOpenGraph: 'Open the graph view or a note\'s local graph first',
    exportFit: 'Fit whole graph',
    exportAspect: 'Aspect',
    exportAspectOriginal: 'Original',
    exportCaption: 'Caption',
    captionDate: 'Date',
    captionNotes: 'Note count',
    captionPreset: 'Preset',
    captionNoteCount: (n) => (n === 1 ? '1 note' : `${n} notes`),
    customize: '🎛️ Customize',
    customizeNote: 'Customize changes graph physics live. Save it only if you want a reusable custom preset.',
    active: 'active',
    myPresets: 'My presets',
    save: '💾 Save as preset',
    namePh: 'Preset name',
    includeView: 'Include filters and display',
    saved: (n) => `💾 “${n}” saved`,
    deleted: 'Preset deleted',
    copyCode: 'Copy share code',
    deletePreset: 'Delete preset',
    copied: (n) => `📋 Share code for “${n}” copied`,
    copyFailed: 'Could not copy the share code',
    codePh: 'Paste a share code (gs1.…)',
    importCode: 'Import share code',
    imported: (n) => `📥 “${n}” added to My presets`,
    badCode: 'That share code is not valid',
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
    exportOpenGraph: '그래프 뷰나 노트의 로컬 그래프를 먼저 열어주세요',
    exportFit: '전체 그래프 맞추기',
    exportAspect: '비율',
    exportAspectOriginal: '원래 비율',
    exportCaption: '캡션',
    captionDate: '날짜',
    captionNotes: '노트 수',
    captionPreset: '프리셋',
    captionNoteCount: (n) => `노트 ${n}개`,
    customize: '🎛️ 커스터마이즈',
    customizeNote: '커스터마이즈는 그래프 물리를 실시간으로 바꿉니다. 다시 쓸 설정만 프리셋으로 저장하세요.',
    active: '현재 적용됨',
    myPresets: '내 프리셋',
    save: '💾 내 프리셋으로 저장',
    namePh: '프리셋 이름',
    includeView: '필터·표시 설정 포함',
    saved: (n) => `💾 “${n}” 저장됨`,
    deleted: '프리셋 삭제됨',
    copyCode: '공유 코드 복사',
    deletePreset: '프리셋 삭제',
    copied: (n) => `📋 “${n}” 공유 코드 복사됨`,
    copyFailed: '공유 코드를 복사하지 못했어요',
    codePh: '공유 코드 붙여넣기 (gs1.…)',
    importCode: '공유 코드 가져오기',
    imported: (n) => `📥 “${n}” 내 프리셋에 추가됨`,
    badCode: '유효하지 않은 공유 코드입니다',
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
// filter가 걸린 요소는 쌓임 맥락이 되어 DOM 순서상 앞의 오버레이 canvas(absolute) 위로 올라온다.
// 그러면 휠·드래그가 모두 iframe으로 가서 확대·이동이 멈췄다(0.2.0–0.3.0). 오버레이가 있을 때만
// iframe이 입력을 통과시키게 해 filter 전과 같은 곳이 입력을 받게 한다.
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
${graphPane(' > canvas ~ iframe')} { pointer-events: none; }
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
  const options = CUSTOM_GRAPH_KEYS.reduce((picked, key) => {
    if (preset.graph[key] !== undefined) picked[key] = preset.graph[key];
    return picked;
  }, {});
  return preset.view ? Object.assign(options, preset.view) : options;
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
    view: options && options.view ? Object.assign({}, options.view) : null,
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

// 필터·표시 설정. 저장할 때 '필터·표시 설정 포함'을 고른 프리셋만 이 graph.json 키를 담는다.
// 글자 페이드·노드 크기·선 두께는 원래부터 커스텀 프리셋의 슬라이더 값으로 들어간다.
const VIEW_BOOL_KEYS = ['showTags', 'showAttachments', 'hideUnresolved', 'showOrphans', 'showArrow'];
const SEARCH_MAX = 500;

// 타입이 맞는 키만 남긴다. 검색어는 제어 문자를 지우고 길이를 자른다. 남는 게 없으면 null.
function sanitizeView(view) {
  if (!view || typeof view !== 'object' || Array.isArray(view)) return null;
  const out = {};
  if (typeof view.search === 'string') out.search = view.search.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, SEARCH_MAX);
  for (const key of VIEW_BOOL_KEYS) {
    if (typeof view[key] === 'boolean') out[key] = view[key];
  }
  return Object.keys(out).length ? out : null;
}

// 사용자 커스텀 raw({id,label,colors[4],bg,glow,forces,view?})의 hex·범위 검증.
// data.json 손편집과 남이 준 공유 코드 모두 이걸 거친다.
function sanitizeRaw(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const sourceColors = Array.isArray(source.colors) ? source.colors.slice(0, 4) : [];
  const colors = sourceColors.map((c, i) => safeHex(c, DEFAULT_CUSTOM.colors[i] || '#8899aa'));
  while (colors.length < 4) colors.push('#8899aa');
  const bgHex = safeHex(source.bg, DEFAULT_CUSTOM.bg);
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
  const label = typeof source.label === 'string' ? source.label.trim() : '';
  const clean = { id: safePresetId(source.id), label: label || 'Custom', colors, bg: bgHex, glow: g, forces };
  const view = sanitizeView(source.view);
  if (view) clean.view = view;
  return clean;
}

// 사용자 커스텀 raw → 프리셋으로 재구성.
function presetFromRaw(raw) {
  const { id, label, colors, bg: bgHex, glow: g, forces, view } = sanitizeRaw(raw);
  const bg = [mix(bgHex, colors[0], 0.2), mix(bgHex, colors[0], 0.08), bgHex];
  const theme = {
    circle: colors[0], fill: colors[1], tag: colors[2],
    line: mix(colors[0], bgHex, 0.55), text: lighten(colors[0], 0.72),
    unresolved: mix(bgHex, '#ffffff', 0.1),
    filter: `brightness(${(1 + g / 280).toFixed(2)}) contrast(1.06) saturate(${(1 + g / 110).toFixed(2)})`,
  };
  return P(id, label, '🎛️', colors, forces, bg, theme, { applyForces: true, view });
}

const DEFAULT_CUSTOM = {
  colors: ['#7dd3fc', '#34d399', '#fbbf24', '#f472b6'],
  bg: '#0b1624',
  glow: 40,
  forces: { node: 2.2, repel: 17, dist: 140, center: 0.05, linkS: 0.2, line: 0.3, fade: 1.2 },
};

// 공유 코드 = 'gs1.' 또는 'gs2.' + base64url(JSON). 붙여넣기 쉬운 한 줄이고, 라벨의 한글도 UTF-8로 보존한다.
// id는 담지 않는다 — 가져오는 쪽 vault에서 새로 정한다.
// gs2.는 필터·표시 설정(view)을 담은 프리셋에만 쓴다. 나머지는 지금도 gs1.이라 0.2.0도 가져올 수 있고,
// 0.2.0은 gs2.를 모르는 접두사로 거절한다.
const SHARE_PREFIXES = ['gs1.', 'gs2.'];

function encodeShareCode(raw) {
  const { label, colors, bg, glow, forces, view } = sanitizeRaw(raw);
  const v = view ? 2 : 1;
  const payload = view ? { v, label, colors, bg, glow, forces, view } : { v, label, colors, bg, glow, forces };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return SHARE_PREFIXES[v - 1] + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeShareCode(code) {
  const text = typeof code === 'string' ? code.trim() : '';
  const v = SHARE_PREFIXES.findIndex((prefix) => text.startsWith(prefix)) + 1;
  if (!v) return null;
  const body = text.slice(SHARE_PREFIXES[v - 1].length);
  if (!/^[A-Za-z0-9_-]+$/.test(body)) return null;
  try {
    const binary = atob(body.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!data || data.v !== v) return null;
    const { label, colors, bg, glow, forces, view } = sanitizeRaw(data);
    // gs1.에 view가 끼어 있어도 버린다 — gs1. 코드는 예전과 똑같이 가져온다.
    return v === 2 && view ? { label, colors, bg, glow, forces, view } : { label, colors, bg, glow, forces };
  } catch (_) {
    return null;
  }
}

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
    includeView: false,
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

// 로컬 그래프는 노트 이름을 파일 이름에 넣는다. 한글 등은 그대로 두고, 파일 시스템과 Obsidian 링크가
// 막는 문자·공백만 '-'로 바꾼다.
function exportNoteName(name) {
  if (typeof name !== 'string') return '';
  return name.replace(/[\\/:*?"<>|#^[\]\s\u0000-\u001f]+/g, '-').replace(/-{2,}/g, '-')
    .slice(0, 60).replace(/^[-.]+|[-.]+$/g, '');
}

function exportFileName(presetId, date, existing, noteName) {
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}`;
  const note = exportNoteName(noteName);
  const base = `graph-${presetId ? safePresetId(presetId) : 'graph'}${note ? `-${note}` : ''}-${stamp}`;
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
// frame({width, height}, 1x 기기 픽셀)을 주면 그 크기로 그리면서 모든 노드가 여백 안에 들어오게 맞춘다.
// 노드·글자 크기는 화면에서 그 확대율일 때와 같게 둔다. frame이 없으면 지금 화면 그대로다.
// preserveDrawingBuffer가 꺼져 있어 버퍼는 같은 태스크 안에서만 읽힌다.
// setScale은 nodeScale = sqrt(1/scale)로 노드·글자를 다시 줄이므로 원래 값으로 고정하고,
// 선 두께와 글자 래스터 해상도만 k배 한다.
function renderGraphAt(r, k, draw, frame) {
  const R = r.px.renderer;
  const baseSetScale = r.setScale;
  const ownSetScale = Object.prototype.hasOwnProperty.call(r, 'setScale');
  const save = {
    W: R.width, H: R.height, width: r.width, height: r.height,
    scale: r.scale, targetScale: r.targetScale, panX: r.panX, panY: r.panY,
    nodeScale: r.nodeScale, textAlpha: r.textAlpha, line: r.fLineSizeMult, idleFrames: r.idleFrames,
  };
  const texts = r.nodes.filter((node) => node && node.text).map((node) => [node.text, node.text.resolution]);
  const W = frame ? frame.width : save.W;
  const H = frame ? frame.height : save.H;
  const fitted = frame ? fitView(r.nodes, W, H) : null;
  try {
    R.resize(W * k, H * k);
    while (k > 1 && !drawingBufferFits(R)) {
      k -= 1;
      R.resize(W * k, H * k);
    }
    const dpr = save.width ? save.W / save.width : 1;
    r.width = (frame ? W / dpr : save.width) * k;
    r.height = (frame ? H / dpr : save.height) * k;
    r.fLineSizeMult = save.line * k;
    let pin = { nodeScale: save.nodeScale, textAlpha: save.textAlpha };
    if (fitted) {
      baseSetScale.call(r, fitted.scale);
      pin = { nodeScale: r.nodeScale, textAlpha: r.textAlpha };
    }
    r.setScale = function (scale) {
      baseSetScale.call(this, scale);
      this.nodeScale = pin.nodeScale;
      this.textAlpha = pin.textAlpha;
    };
    const scale = (fitted ? fitted.scale : save.scale) * k;
    r.targetScale = scale;
    r.setScale(scale);
    if (fitted) r.setPan(fitted.panX * k, fitted.panY * k);
    else r.setPan(save.panX * k, save.panY * k);
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

// 모든 노드를 frame(1x 기기 픽셀) 안에 여백을 두고 넣는 확대율과 이동. 화면 좌표 = 노드 좌표 × scale + pan.
const FIT_MARGIN = 0.07;

function fitView(nodes, width, height) {
  const placed = nodes.filter((node) => node && Number.isFinite(node.x) && Number.isFinite(node.y));
  if (!placed.length) return { scale: 1, panX: width / 2, panY: height / 2 };
  const xs = placed.map((node) => node.x);
  const ys = placed.map((node) => node.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const inner = 1 - 2 * FIT_MARGIN;
  const scale = Math.min((width * inner) / Math.max(maxX - minX, 1), (height * inner) / Math.max(maxY - minY, 1));
  return { scale, panX: width / 2 - ((minX + maxX) / 2) * scale, panY: height / 2 - ((minY + maxY) / 2) * scale };
}

const EXPORT_ASPECTS = { original: 0, '1:1': 1, '4:5': 4 / 5 };
const DEFAULT_EXPORT_OPTIONS = { fit: false, aspect: 'original', caption: { date: false, notes: false, preset: false } };

function sanitizeExportOptions(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const c = o.caption && typeof o.caption === 'object' ? o.caption : {};
  return {
    fit: o.fit === true,
    aspect: Object.prototype.hasOwnProperty.call(EXPORT_ASPECTS, o.aspect) ? o.aspect : 'original',
    caption: { date: c.date === true, notes: c.notes === true, preset: c.preset === true },
  };
}

function isPlainExport(options) {
  const c = options.caption;
  return !options.fit && options.aspect === 'original' && !c.date && !c.notes && !c.preset;
}

// 1x 기기 픽셀 기준 배치. 비율을 맞출 때는 배경으로 덧대고 노드는 자르지 않는다. 캡션 띠는 맨 아래.
// fit이면 그래프를 띠 위 영역 크기로 다시 그리고, 아니면 화면 그대로의 그림을 가운데 둔다.
function exportLayout(width, height, options, hasCaption) {
  const ratio = EXPORT_ASPECTS[options.aspect] || 0;
  const band = hasCaption ? Math.round(width * 0.07) : 0;
  if (options.fit) {
    const canvasH = ratio ? Math.round(width / ratio) : height + band;
    return { canvasW: width, canvasH, graphX: 0, graphY: 0, graphW: width, graphH: canvasH - band, band };
  }
  let canvasW = width;
  let canvasH = height + band;
  if (ratio) {
    canvasW = Math.max(width, Math.ceil(canvasH * ratio));
    canvasH = Math.max(canvasH, Math.round(canvasW / ratio));
  }
  return {
    canvasW, canvasH, band, graphW: width, graphH: height,
    graphX: Math.round((canvasW - width) / 2), graphY: Math.round((canvasH - band - height) / 2),
  };
}

function captionText(options, info) {
  const parts = [];
  if (options.caption.preset && info.preset) parts.push(info.preset);
  if (options.caption.notes) parts.push(L.captionNoteCount(info.notes));
  if (options.caption.date) {
    const d = info.date;
    parts.push(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`);
  }
  return parts.join('   ·   ');
}

function hexA(hex, alpha) {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 전체를 맞추면 Obsidian은 그 확대율에서 라벨을 숨긴다. 가장 많이 이어진 노트 몇 개만 겹치지 않게 직접 쓴다.
// 허브는 연결 수가 가장 많은 노트의 40% 이상인 것만 — 그 아래는 이름을 붙여도 의미 없는 보통 노트다.
// 라벨은 배경색 테두리(halo)를 둘러 선·노드 위에서도 읽히게 하고, 노드 아래 자리가 다른 허브의 원에
// 걸리면 노드 위로 옮긴다(지도 라벨의 흔한 방식).
function drawHubLabels(ctx, r, offsetX, offsetY, k, size, color, font, halo) {
  const ranked = r.nodes.filter((node) => node && node.id && Number.isFinite(node.x))
    .sort((a, b) => (b.weight || 0) - (a.weight || 0));
  const top = ranked.length ? ranked[0].weight || 0 : 0;
  const hubs = ranked.filter((node) => top > 0 && (node.weight || 0) >= top * 0.4).slice(0, 20);
  const circle = (node) => ({
    x: offsetX + node.x * r.scale + r.panX,
    y: offsetY + node.y * r.scale + r.panY,
    radius: (typeof node.getSize === 'function' ? node.getSize() : 8) * r.nodeScale * r.scale,
  });
  const circles = hubs.map((node) => [node, circle(node)]);
  const labelOf = (node) => (typeof node.getDisplayText === 'function' ? node.getDisplayText() : String(node.id).replace(/\.md$/, ''));
  const hitsCircle = (box, c) => {
    const dx = c.x - Math.max(box.left, Math.min(c.x, box.right));
    const dy = c.y - Math.max(box.top, Math.min(c.y, box.bottom));
    return dx * dx + dy * dy < c.radius * c.radius;
  };
  const placed = [];
  ctx.font = `500 ${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.28);
  ctx.strokeStyle = halo;
  ctx.fillStyle = color;
  for (const node of hubs) {
    if (placed.length >= 8) break;
    const text = labelOf(node);
    const own = circle(node);
    const w = ctx.measureText(text).width;
    const boxAt = (y) => ({ y, left: own.x - w / 2 - size * 0.4, right: own.x + w / 2 + size * 0.4, top: y - size * 0.2, bottom: y + size * 1.3 });
    const below = boxAt(own.y + own.radius + size * 0.35);
    const above = boxAt(own.y - own.radius - size * 1.45);
    const blocked = (box) => circles.some(([other, c]) => other !== node && hitsCircle(box, c));
    // 위 자리는 다른 허브의 원뿐 아니라 그 허브의 기본(아래) 라벨 자리도 비어 있을 때만 쓴다 — 아니면
    // 옮긴 라벨이 이웃 허브의 이름을 밀어낸다.
    const takesSpot = (box) => circles.some(([other, c]) => {
      if (other === node) return false;
      const half = ctx.measureText(labelOf(other)).width / 2 + size * 0.4;
      const spot = { left: c.x - half, right: c.x + half, top: c.y + c.radius + size * 0.15, bottom: c.y + c.radius + size * 1.65 };
      return box.left < spot.right && box.right > spot.left && box.top < spot.bottom && box.bottom > spot.top;
    });
    const box = blocked(below) && !blocked(above) && !takesSpot(above) ? above : below;
    if (placed.some((p) => box.left < p.right && box.right > p.left && box.top < p.bottom && box.bottom > p.top)) continue;
    placed.push(box);
    ctx.strokeText(text, own.x, box.y);
    ctx.fillText(text, own.x, box.y);
  }
  return placed.length;
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

  // 내 프리셋의 복사·삭제는 프리셋 버튼 안이 아니라 옆의 형제 버튼이다. 버튼 안 버튼은 HTML에서
  // 허용되지 않고 포커스도 받지 못했다. 형제라서 Tab 순서가 프리셋 → 복사 → 삭제이고, Enter·Space가
  // 프리셋 적용으로 번지지 않는다.
  presetButton(parent, preset, onDelete, onShare) {
    const row = onDelete || onShare ? parent.createDiv({ cls: 'gs-preset-row' }) : parent;
    const btn = row.createEl('button', { cls: 'gs-btn' });
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
    const action = (cls, text, label, run) => {
      const el = row.createEl('button', { cls, text });
      el.setAttr('type', 'button');
      el.setAttr('title', label);
      el.setAttr('aria-label', `${label}: ${preset.label}`);
      el.onclick = () => run();
    };
    if (onShare) action('gs-share', '📋', L.copyCode, onShare);
    if (onDelete) {
      action('gs-del', '✕', L.deletePreset, async () => {
        await onDelete();
        // 지운 행은 다시 그리면서 사라지므로 포커스가 문서 맨 위로 빠진다. 남은 첫 내 프리셋, 없으면 가져오기 칸으로 옮긴다.
        const next = this.contentEl.querySelector('.gs-preset-row .gs-btn') || this.contentEl.querySelector('.gs-code');
        if (next) next.focus();
      });
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

    // user presets — 가져오기 칸이 있어 비어 있어도 섹션은 보인다.
    const custom = this.plugin.settings.custom || [];
    c.createEl('div', { cls: 'gs-section', text: L.myPresets });
    if (custom.length) {
      const myList = c.createDiv({ cls: 'gs-list' });
      for (const raw of custom) {
        this.presetButton(myList, presetFromRaw(raw),
          () => this.plugin.deleteCustom(raw.id),
          () => this.plugin.copyShareCode(raw));
      }
    }
    const importRow = c.createDiv({ cls: 'gs-row' });
    const codeEl = importRow.createEl('input', { cls: 'gs-code' });
    codeEl.type = 'text';
    codeEl.placeholder = L.codePh;
    const importBtn = c.createEl('button', { cls: 'gs-import', text: L.importCode });
    importBtn.onclick = () => this.plugin.importShareCode(codeEl.value);

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
    const viewRow = details.createEl('label', { cls: 'gs-row gs-check' });
    const viewBox = viewRow.createEl('input');
    viewBox.type = 'checkbox';
    viewBox.checked = draft.includeView;
    viewBox.onchange = () => { draft.includeView = viewBox.checked; };
    viewRow.createSpan({ text: L.includeView });
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
    scaleEl.onchange = () => this.plugin.setExportScale(Number(scaleEl.value));
    const exportBtn = row.createEl('button', { cls: 'gs-export', text: L.exportCmd });
    exportBtn.onclick = () => this.plugin.exportPng(this.plugin.exportScale);
    c.createEl('p', { text: L.exportScaleNote, cls: 'gs-note' });

    const options = this.plugin.exportOptions;
    const fitRow = c.createEl('label', { cls: 'gs-row gs-export-check' });
    const fitBox = fitRow.createEl('input');
    fitBox.type = 'checkbox';
    fitBox.checked = options.fit;
    fitBox.onchange = () => this.plugin.setExportOptions({ fit: fitBox.checked });
    fitRow.createSpan({ text: L.exportFit });

    const aspectRow = c.createDiv({ cls: 'gs-row' });
    aspectRow.createSpan({ cls: 'gs-row-label', text: L.exportAspect });
    const aspectEl = aspectRow.createEl('select', { cls: 'dropdown' });
    for (const key of Object.keys(EXPORT_ASPECTS)) {
      aspectEl.createEl('option', { value: key, text: key === 'original' ? L.exportAspectOriginal : key });
    }
    aspectEl.value = options.aspect;
    aspectEl.onchange = () => this.plugin.setExportOptions({ aspect: aspectEl.value });

    const captionRow = c.createDiv({ cls: 'gs-row' });
    captionRow.createSpan({ cls: 'gs-row-label', text: L.exportCaption });
    const captionItems = captionRow.createSpan({ cls: 'gs-caption-items' });
    for (const [key, text] of [['date', L.captionDate], ['notes', L.captionNotes], ['preset', L.captionPreset]]) {
      const item = captionItems.createEl('label', { cls: 'gs-export-check' });
      const box = item.createEl('input');
      box.type = 'checkbox';
      box.checked = options.caption[key];
      box.onchange = () => this.plugin.setExportOptions({ caption: Object.assign({}, this.plugin.exportOptions.caption, { [key]: box.checked }) });
      item.createSpan({ text });
    }
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
    const raw = this.rawFromDraft(`custom-${Date.now()}`);
    if (this.plugin.draft.includeView) {
      const view = await this.plugin.currentViewOptions();
      if (view) raw.view = view;
    }
    await this.plugin.saveCustom(raw);
  }
}

module.exports = class GraphStyler extends Plugin {
  // 플러그인 로더는 클래스만 쓴다. 내보내기 계산 함수는 테스트용으로 붙여 둔다.
  static exportScaleLimit = exportScaleLimit;
  static exportFileName = exportFileName;
  static exportNoteName = exportNoteName;
  static exportLayout = exportLayout;
  static fitView = fitView;
  static drawHubLabels = drawHubLabels;
  static sanitizeExportOptions = sanitizeExportOptions;

  async onload() {
    // 업데이트·제자리 재시작 때 Obsidian은 이전 인스턴스의 onunload를 기다리지 않고 이 onload를 부른다.
    // 이전 인스턴스가 스니펫을 끄고 resumeSnippet을 쓰는 게 아래 loadData보다 늦으면 테마가 꺼진 채
    // 남았다. 그 늦은 기록은 data.json 변경으로 보이므로, 첫 복원이 끝난 뒤에 다시 읽어 복원한다.
    // 첫 await 전에 등록해야 loadData와 첫 복원 사이에 온 기록도 놓치지 않는다.
    let resumed;
    const firstResume = new Promise((resolve) => { resumed = resolve; });
    const dataPath = this.manifest && this.manifest.dir ? `${this.manifest.dir}/data.json` : null;
    if (dataPath) {
      this.registerEvent(this.app.vault.on('raw', (path) => {
        if (path === dataPath) firstResume.then(() => this.resumeLateSnippet());
      }));
    }
    this.settings = Object.assign({ custom: [] }, await this.loadData());
    if (!Array.isArray(this.settings.custom)) this.settings.custom = [];
    this.currentForceOptions = {};
    try {
      this.currentForceOptions = forceOptionsFromGraph(JSON.parse(await this.app.vault.adapter.read(this.graphPath())));
    } catch (_) { /* graph.json may not exist yet */ }
    this.draft = draftFromGraph(await this.readGraphOptions());
    this.customizeOpen = false;
    // 2x면 인스타그램 1080px에 충분하고, 3x는 vault에 20MB 안팎을 쓴다. 마지막으로 고른 배율을 기억한다.
    this.exportScale = EXPORT_SCALES.includes(this.settings.exportScale) ? this.settings.exportScale : 2;
    this.exportOptions = sanitizeExportOptions(this.settings.exportOptions);
    this.currentPreset = null;

    // 업데이트/재활성화 때 onunload가 끈 글로우 스니펫을 복원 (레지스트리 로드 후)
    const restoreSnippet = () => this.resumeSnippet().then(resumed);
    const workspace = this.app.workspace;
    if (workspace && typeof workspace.onLayoutReady === 'function') workspace.onLayoutReady(restoreSnippet);
    else restoreSnippet();

    // 새로 연 로컬 그래프는 graph.json이 아니라 기본값에서 시작해 색 그룹이 없다(1.14.4).
    this._seenLocalGraphs = new WeakSet();
    if (workspace && typeof workspace.on === 'function') {
      const colorLocals = () => this.colorNewLocalGraphs();
      if (typeof workspace.onLayoutReady === 'function') workspace.onLayoutReady(colorLocals);
      this.registerEvent(workspace.on('layout-change', colorLocals));
    }

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

  // 찍을 그래프: 활성 leaf가 그래프·로컬 그래프면 그것(명령 팔레트), 아니면 가장 최근에 활성이던 것
  // (패널 버튼을 누르면 패널이 활성이 된다). 숨은 탭의 그래프는 크기가 0이라 보이는 것을 먼저 고른다.
  // activeTime이 없으면 0.2.0처럼 전역 그래프가 먼저다.
  exportTarget() {
    const workspace = this.app.workspace;
    const leaves = workspace.getLeavesOfType('graph').concat(workspace.getLeavesOfType('localgraph'))
      .filter((leaf) => leaf && leaf.view && leaf.view.renderer);
    const visible = (leaf) => {
      const el = leaf.view.contentEl;
      return !el || typeof el.clientWidth !== 'number' || el.clientWidth > 0;
    };
    const shown = leaves.filter(visible);
    const candidates = shown.length ? shown : leaves;
    if (candidates.includes(workspace.activeLeaf)) return workspace.activeLeaf;
    const time = (leaf) => (typeof leaf.activeTime === 'number' ? leaf.activeTime : 0);
    return candidates.reduce((best, leaf) => (best === null || time(leaf) > time(best) ? leaf : best), null);
  }

  async exportPng(requestedScale) {
    const leaf = this.exportTarget();
    const renderer = leaf && leaf.view.renderer;
    if (!renderer) {
      new Notice(L.exportOpenGraph);
      return;
    }
    try {
      const palette = await this.activePalette();
      const base = this.graphBaseColor(leaf.view.contentEl);
      const filter = this.graphFilter(leaf.view.contentEl, renderer);
      const options = this.exportOptions || sanitizeExportOptions(null);
      const plain = isPlainExport(options);
      const highRes = canRenderHighRes(renderer);
      const fit = options.fit && highRes;
      let canvas = null;
      let layout = null;
      let caption = '';
      if (!plain) {
        caption = captionText(options, {
          preset: palette ? this.presetLabel(palette.id) : '',
          notes: (renderer.nodes || []).filter((node) => node && typeof node.id === 'string' && node.id.endsWith('.md')).length,
          date: new Date(),
        });
        const R = renderer.px && renderer.px.renderer;
        const size = R ? [R.width, R.height] : null;
        layout = exportLayout(size ? size[0] : 0, size ? size[1] : 0, Object.assign({}, options, { fit }), !!caption);
      }
      const paint = (source) => {
        canvas = document.createElement('canvas');
        if (plain) {
          canvas.width = source.width;
          canvas.height = source.height;
          const ctx = canvas.getContext('2d');
          paintGraphBackground(ctx, canvas.width, canvas.height, base, palette);
          ctx.filter = filter;
          ctx.drawImage(source, 0, 0);
          ctx.filter = 'none';
          return;
        }
        // 저해상도 대체 경로에서도 같은 배치를 쓰도록 실제 그림 크기에서 배율을 다시 잰다.
        const graphW = layout.graphW || source.width;
        const kk = source.width / graphW;
        const L2 = layout.graphW ? layout : exportLayout(source.width, source.height, options, !!caption);
        canvas.width = Math.round(L2.canvasW * kk);
        canvas.height = Math.round(L2.canvasH * kk);
        const ctx = canvas.getContext('2d');
        paintGraphBackground(ctx, canvas.width, canvas.height, base, palette);
        const gx = Math.round(L2.graphX * kk);
        const gy = Math.round(L2.graphY * kk);
        ctx.filter = filter;
        ctx.drawImage(source, gx, gy);
        ctx.filter = 'none';
        const textColor = palette ? palette.text : this.graphTextColor(renderer);
        const font = this.exportFont();
        if (fit && renderer.textAlpha < 0.3) {
          drawHubLabels(ctx, renderer, gx, gy, kk, Math.round(canvas.width * 0.017), hexA(textColor, 0.92), font,
            palette ? palette.bg2 : base);
        }
        if (caption) {
          const band = L2.band * kk;
          const size = Math.round(band * 0.34);
          ctx.font = `400 ${size}px ${font}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.06)}px`;
          ctx.fillStyle = hexA(textColor, 0.7);
          ctx.fillText(caption, canvas.width / 2, canvas.height - band * 0.55);
        }
      };
      if (highRes) {
        const R = renderer.px.renderer;
        const gl = R.gl;
        const maxTexture = gl && typeof gl.getParameter === 'function' ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : undefined;
        const frame = fit ? { width: layout.graphW, height: layout.graphH } : undefined;
        const limitW = frame ? frame.width : R.width;
        const limitH = frame ? frame.height : R.height;
        const used = renderGraphAt(renderer, exportScaleLimit(maxTexture, limitW, limitH, requestedScale), paint, frame);
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
      const localFile = leaf.view.getViewType && leaf.view.getViewType() === 'localgraph' ? leaf.view.file : null;
      const name = exportFileName(presetId === LIVE_ID ? null : presetId, new Date(),
        this.app.vault.getFiles().map((file) => file.path), localFile && localFile.basename);
      await this.app.vault.createBinary(name, await blob.arrayBuffer());
      new Notice(L.exported(name, canvas.width, canvas.height));
    } catch (e) {
      console.error('[graph-styler] PNG export failed', e);
      new Notice(L.exportFailed);
    }
  }

  async setExportOptions(change) {
    this.exportOptions = sanitizeExportOptions(Object.assign({}, this.exportOptions, change));
    this.settings.exportOptions = this.exportOptions;
    await this.saveData(this.settings);
  }

  async setExportScale(scale) {
    this.exportScale = scale;
    this.settings.exportScale = scale;
    await this.saveData(this.settings);
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

  presetLabel(id) {
    const preset = Object.values(PRESETS)
      .concat((this.settings.custom || []).map((raw) => presetFromRaw(raw)))
      .find((candidate) => candidate.id === id);
    return preset ? preset.label : '';
  }

  graphTextColor(renderer) {
    const text = renderer.colors && renderer.colors.text;
    return text && typeof text.rgb === 'number' ? `#${text.rgb.toString(16).padStart(6, '0')}` : '#dadada';
  }

  exportFont() {
    const style = window.getComputedStyle(document.body);
    const font = style && typeof style.getPropertyValue === 'function' ? style.getPropertyValue('--font-interface').trim() : '';
    return font || 'ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif';
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

  // 지금 그래프의 필터·표시 설정. 코어 그래프 플러그인의 메모리 값이 graph.json보다 새것일 수 있어 위에 덮는다.
  async currentViewOptions() {
    const internal = this.app.internalPlugins;
    const core = internal && internal.plugins && internal.plugins.graph && internal.plugins.graph.instance;
    const live = core && core.options && typeof core.options === 'object' ? core.options : {};
    return sanitizeView(Object.assign({}, await this.readGraphOptions(), live));
  }

  async copyShareCode(raw) {
    try {
      await navigator.clipboard.writeText(encodeShareCode(raw));
      new Notice(L.copied(sanitizeRaw(raw).label));
    } catch (e) {
      console.error('[graph-styler] share code copy failed', e);
      new Notice(L.copyFailed);
    }
  }

  // 가져오기는 내 프리셋에 추가만 한다 — 적용은 사용자가 누를 때.
  async importShareCode(code) {
    const shared = decodeShareCode(code);
    if (!shared) {
      new Notice(L.badCode);
      return null;
    }
    // id는 스니펫 파일 이름이 된다. 기본 프리셋·내부 id와도 겹치면 안 되고,
    // 대소문자를 구분하지 않는 파일시스템(macOS·Windows)에서는 'Neon'과 'neon'도 같은 파일이다.
    const taken = new Set(Object.keys(PRESETS).concat(LIVE_ID, '__none__')
      .concat(this.settings.custom.map((r) => safePresetId(r.id)))
      .map((id) => id.toLowerCase()));
    // 한글만 있는 라벨은 ASCII가 남지 않아 'custom-invalid'가 된다 — 스니펫 이름에 보이니 바꿔 둔다.
    const fromLabel = safePresetId(shared.label);
    const base = fromLabel === 'custom-invalid' ? 'shared' : fromLabel;
    let id = base;
    for (let n = 2; taken.has(id.toLowerCase()); n++) id = `${base}-${n}`;
    const raw = Object.assign({ id }, shared);
    this.settings.custom.push(raw);
    await this.saveData(this.settings);
    this.refreshViews();
    new Notice(L.imported(raw.label));
    return raw;
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
      // 켜진 것뿐 아니라 꺼진 생성 스니펫도 고친다 — 나중에 켜거나 Obsidian 설정에서 직접 켜도
      // 예전 CSS(0.2.0–0.3.0의 확대·클릭 막힘)가 돌아오지 않게.
      let rewritten = false;
      for (const snippetId of await this.snippetIds()) {
        if (await this.refreshSnippetFile(snippetId)) rewritten = true;
      }
      const customCss = this.app.customCss;
      if (rewritten && customCss && typeof customCss.requestLoadSnippets === 'function') customCss.requestLoadSnippets();
      else if (rewritten && customCss && typeof customCss.readSnippets === 'function') await customCss.readSnippets();
    } catch (e) {
      console.warn('[graph-styler] snippet restore skipped', e);
    }
    // 한 번 쓰고 비운다. undefined → null 저장으로 0.1.7 이전 데이터의 추정도 한 번만 한다.
    await this.saveResumeSnippet(null);
  }

  // resumeSnippet에 값을 쓰는 건 onunload뿐이다. 로드된 동안 그 값이 보이면 이전 인스턴스가 늦게 쓴 것이다.
  async resumeLateSnippet() {
    let data;
    try {
      data = await this.loadData();
    } catch (_) {
      return;
    }
    const id = data && data.resumeSnippet;
    if (typeof id !== 'string' || !id) return;
    this.settings.resumeSnippet = id;
    await this.resumeSnippet();
  }

  // 이전 버전이 만든 스니펫 파일은 적용할 때의 CSS를 그대로 담고 있다. 생성 CSS가 바뀌었으면
  // (0.1.9: 존재하지 않는 .graph-view-content 선택자 교체, 0.3.1: iframe 입력 통과) 다시 적용하지
  // 않아도 새 CSS를 쓴다. 다시 썼으면 true.
  async refreshSnippetFile(id) {
    const preset = Object.values(PRESETS)
      .concat((this.settings.custom || []).map((raw) => presetFromRaw(raw)))
      .find((candidate) => candidate.id === id);
    if (!preset) return false;
    const adapter = this.app.vault.adapter;
    const path = `${this.app.vault.configDir}/snippets/graph-styler-${id}.css`;
    const css = makeGlowCss(preset.palette);
    if (!(await adapter.exists(path))) return false;
    const current = (await adapter.read(path)).replace(/\r\n/g, '\n');
    // 사용자가 손으로 고친 파일(생성 머리말이 없음)은 건드리지 않는다.
    if (current === css || !current.startsWith(`/* graph-styler :: ${id} (auto-generated) */`)) return false;
    await adapter.write(path, css);
    return true;
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
      // 그래프가 열려 있지 않으면 '먼저 열어주세요'만 보인다. 적용은 됐지만 눈에 보이는 건 없으니 성공이라 하지 않는다.
      let shown = true;
      if (Object.keys(graphOptions).length) {
        shown = await this.reloadGraph(graphOptions, live, true, preset.applyForces);
      }
      this.currentForceOptions = forceOptionsFromGraph(merged);
      this.currentPreset = Object.assign({}, preset, { graph: Object.assign({}, graphOptions) });
      if (!live) this.refreshViews();
      if (!live && shown) new Notice(L.applied(preset));
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
      this.syncCoreGraphOptions(merged);
      return merged;
    }
    throw new Error('graph.json changed while applying preset');
  }

  // 코어 그래프 플러그인은 graph.json을 메모리에 들고 있다가 그래프 leaf를 닫거나 다시 열 때 그 값을
  // 파일에 다시 쓴다. 파일 감시가 새 값을 전하기 전에 leaf를 다시 열면(커스텀 프리셋 적용, 1.14.4 실측
  // 다시 쓰기 0.8s·감시 1.1s) 방금 쓴 색 그룹·물리가 이전 값으로 덮였다. 메모리 값도 같이 맞춘다.
  // 프리셋이 적용 중일 때, 처음 보는 로컬 그래프에 자기 색 그룹이 없으면 전역 그래프의 색 그룹을 넣는다.
  // 사용자가 그 로컬 그래프에 정한 그룹은 덮지 않고, 한 로컬 그래프는 한 번만 본다 — 그 뒤에 사용자가
  // 그룹을 비워도 다시 채우지 않는다.
  async colorNewLocalGraphs() {
    const fresh = this.app.workspace.getLeavesOfType('localgraph').filter((leaf) => !this._seenLocalGraphs.has(leaf));
    if (!fresh.length) return;
    for (const leaf of fresh) this._seenLocalGraphs.add(leaf);
    const enabled = this.app.customCss && this.app.customCss.enabledSnippets;
    const styled = enabled && typeof enabled.has === 'function'
      && [...enabled].some((id) => id.startsWith('graph-styler-') && id !== 'graph-styler-__none__');
    if (!styled) return;
    const internal = this.app.internalPlugins;
    const core = internal && internal.plugins && internal.plugins.graph && internal.plugins.graph.instance;
    const options = core && core.options && Array.isArray(core.options.colorGroups) ? core.options : await this.readGraphOptions();
    const groups = Array.isArray(options.colorGroups) ? options.colorGroups : [];
    if (!groups.length) return;
    for (const leaf of fresh) {
      const engine = leaf.view && (leaf.view.engine || leaf.view.dataEngine);
      if (!engine || typeof engine.setOptions !== 'function' || typeof engine.getOptions !== 'function') continue;
      const own = engine.getOptions().colorGroups;
      if (Array.isArray(own) && own.length) continue;
      try {
        engine.setOptions({ colorGroups: groups.map((group) => Object.assign({}, group, { color: Object.assign({}, group.color) })) });
        if (typeof engine.render === 'function') engine.render();
      } catch (e) {
        console.warn('[graph-styler] local graph colours skipped', e);
      }
    }
  }

  syncCoreGraphOptions(options) {
    const internal = this.app.internalPlugins;
    const core = internal && internal.plugins && internal.plugins.graph;
    const instance = core && core.instance;
    if (instance && instance.options && typeof instance.options === 'object') Object.assign(instance.options, options);
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
      return false;
    }
    // 필터·표시 설정은 전역 그래프의 것이다. 로컬 그래프는 자기 필터(깊이·링크 방향 등)를 따로 두므로 보내지 않는다.
    const localOptions = Object.fromEntries(Object.entries(graphOptions)
      .filter(([key]) => key !== 'search' && !VIEW_BOOL_KEYS.includes(key)));
    const localGraphs = new Set(this.app.workspace.getLeavesOfType('localgraph'));
    for (const leaf of leaves) {
      const view = leaf.view;
      const engine = view && (view.engine || view.dataEngine);
      if (engine && typeof engine.setOptions === 'function') {
        try {
          engine.setOptions(localGraphs.has(leaf) ? localOptions : graphOptions);
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
    return true;
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
    const restoredOptions = Object.assign({ colorGroups: [] }, originalOptions);
    this.syncCoreGraphOptions(restoredOptions);
    await this.reloadGraph(restoredOptions);
    this.refreshViews();
    new Notice(L.restored);
  }
};

// 플러그인 로더는 module.exports(클래스)만 쓴다. 공유 코드 함수는 테스트용으로 붙여 둔다.
module.exports.encodeShareCode = encodeShareCode;
module.exports.decodeShareCode = decodeShareCode;
module.exports.presetFromRaw = presetFromRaw;
