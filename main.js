/*
 * Graph Styler — one-click aesthetic themes for the Obsidian graph view.
 * Copyright (c) 2026 Moonweave  (https://www.instagram.com/phd.ai.log/)
 * Released under the MIT License. Made by Moonweave.
 */
'use strict';

const { Plugin, ItemView, Notice, Platform, PluginSettingTab, Setting, Keymap, getAllTags } = require('obsidian');

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
    physicsNote: 'Only color and glow change; physics and sizes stay.',
    restore: '↩︎ Restore original',
    restoreNote: 'Back to the settings saved before Graph Styler first changed this vault.',
    restoreConfirm: 'Restore the graph settings saved before Graph Styler first changed this vault? Changes made since then will be overwritten.',
    openCmd: 'Open Graph Styler panel',
    applyCmd: 'Apply',
    applied: (p) => `${p.emoji} ${p.label} applied`,
    failed: 'Apply failed — open the console (Cmd+Opt+I) to see why',
    openGraph: 'Open a graph view first',
    restored: '↩︎ Restored to original',
    noBackup: 'No backup found',
    by: 'made by ',
    exportTitle: '🖼️ Export image',
    exportMore: 'More options',
    exportOnlyNote: 'These options only change the saved picture, not your graph.',
    exportCmd: 'Export graph as PNG',
    exportScale: 'Scale',
    exportScaleNote: 'Image size, as a multiple of the graph on your screen. 2x suits an Instagram post.',
    exported: (path, w, h) => `🖼️ Saved ${path} (${w}×${h})`,
    exportFitNote: 'Frames every note in the image, even if you are zoomed in. Your view is not changed.',
    exportAspectNote: 'Original keeps the current shape. 1:1 and 4:5 add background around the graph so it fits a post. Notes are never cropped.',
    exportCaptionNote: 'Adds a small line at the bottom of the image: the date, how many notes, and/or the preset name.',
    exportFolder: 'Save exported images to',
    exportFolderNote: 'A folder in this vault, created when needed. Leave it empty to save at the top of the vault.',
    exportOpenAfter: 'Open the image after exporting',
    exportCopy: 'Copy image',
    exportCopyUnsupported: 'This version of Obsidian cannot put images on the clipboard',
    copiedImage: (w, h) => `📋 Image copied (${w}×${h}) — paste it anywhere`,
    copyImageFailed: 'Could not copy the image — open the console (Cmd+Opt+I) to see why',
    noticeOpen: 'Open',
    noticeReveal: (mac) => (mac ? 'Show in Finder' : 'Show in folder'),
    lastExport: 'Last export:',
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
    shareCode: '📋 Share code',
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
    open3dCmd: 'Open 3D graph',
    view3d: '3D graph (experimental)',
    experimental: 'Experimental',
    exp3dName: '3D graph view',
    exp3dDesc: 'Adds the command “Open 3D graph”: your notes and links in 3D, in the colours of the current preset. Early version — it may change or be removed.',
    exp3dOn: 'Open it from the command palette: “Graph Styler: Open 3D graph”',
    off3d: 'The 3D graph is turned off. Turn on “3D graph view” in Settings → Graph Styler → Experimental.',
    noWebgl3d: 'The 3D graph needs WebGL 2, which is not available here.',
    lost3d: 'Drawing paused because the graphics context was lost. It resumes when the system gives it back.',
    empty3d: 'There are no notes to show yet.',
    group3d: '🧊 3D (experimental)',
    panel3dNote: 'A new tab with your notes and links in 3D, in the colours of the current preset.',
    rotate3d: 'Auto-rotate',
    rotate3dSpeed: 'Rotation speed',
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
    physicsNote: '색과 글로우만 바뀌고 물리·크기 설정은 그대로입니다.',
    restore: '↩︎ 원래대로 되돌리기',
    restoreNote: 'Graph Styler가 이 vault를 처음 바꾸기 전에 저장한 설정으로 돌아갑니다.',
    restoreConfirm: 'Graph Styler가 이 vault를 처음 적용하기 전의 그래프 설정으로 되돌릴까요? 그 이후의 변경은 덮어써집니다.',
    openCmd: 'Graph Styler 패널 열기',
    applyCmd: '적용',
    applied: (p) => `${p.emoji} ${p.label} 적용 완료`,
    failed: '적용 실패 — 콘솔(Cmd+Opt+I)에서 원인 확인',
    openGraph: '그래프 뷰를 먼저 열어주세요',
    restored: '↩︎ 원래대로 복구함',
    noBackup: '백업이 없어요',
    by: 'made by ',
    exportTitle: '🖼️ 이미지 내보내기',
    exportMore: '옵션 더 보기',
    exportOnlyNote: '아래 옵션은 저장되는 그림에만 적용되고, 그래프 자체는 바뀌지 않습니다.',
    exportCmd: '그래프를 PNG로 내보내기',
    exportScale: '배율',
    exportScaleNote: '화면에 보이는 그래프의 몇 배 크기로 저장할지 정합니다. 인스타그램 게시물에는 2x면 충분합니다.',
    exported: (path, w, h) => `🖼️ ${path} 저장됨 (${w}×${h})`,
    exportFitNote: '확대해서 보고 있어도 모든 노트가 그림에 들어가게 맞춥니다. 보고 있는 화면은 그대로입니다.',
    exportAspectNote: '원래 비율은 지금 모양 그대로입니다. 1:1과 4:5는 게시물 비율에 맞게 그래프 둘레에 배경을 덧댑니다. 노트는 잘리지 않습니다.',
    exportCaptionNote: '그림 아래에 날짜, 노트 수, 프리셋 이름 중 고른 것을 작은 글씨로 넣습니다.',
    exportFolder: '이미지 저장 폴더',
    exportFolderNote: '이 vault 안의 폴더이고, 없으면 새로 만듭니다. 비워 두면 vault 맨 위에 저장합니다.',
    exportOpenAfter: '내보낸 뒤 이미지 열기',
    exportCopy: '이미지 복사',
    exportCopyUnsupported: '이 Obsidian 버전에서는 이미지를 클립보드에 복사할 수 없습니다',
    copiedImage: (w, h) => `📋 이미지 복사됨 (${w}×${h}) — 원하는 곳에 붙여넣으세요`,
    copyImageFailed: '이미지를 복사하지 못했어요 — 콘솔(Cmd+Opt+I)에서 원인 확인',
    noticeOpen: '열기',
    noticeReveal: (mac) => (mac ? 'Finder에서 보기' : '폴더에서 보기'),
    lastExport: '마지막으로 내보낸 이미지:',
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
    shareCode: '📋 공유 코드',
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
    open3dCmd: '3D 그래프 열기',
    view3d: '3D 그래프 (실험 기능)',
    experimental: '실험 기능',
    exp3dName: '3D 그래프 보기',
    exp3dDesc: '“3D 그래프 열기” 명령을 추가해요. 노트와 링크를 지금 프리셋의 색으로 입체로 보여 줘요. 초기 버전이라 바뀌거나 빠질 수 있어요.',
    exp3dOn: '명령 팔레트에서 “Graph Styler: 3D 그래프 열기”로 열 수 있어요',
    off3d: '3D 그래프가 꺼져 있어요. 설정 → Graph Styler → 실험 기능에서 “3D 그래프 보기”를 켜 주세요.',
    noWebgl3d: '3D 그래프에는 WebGL 2가 필요한데, 여기서는 쓸 수 없어요.',
    lost3d: '그래픽 문맥을 잃어 그리기를 멈췄어요. 시스템이 돌려주면 다시 그려요.',
    empty3d: '아직 보여 줄 노트가 없어요.',
    group3d: '🧊 3D (실험)',
    panel3dNote: '새 탭에 노트와 링크를 지금 프리셋의 색으로 입체로 보여 줘요.',
    rotate3d: '자동 회전',
    rotate3dSpeed: '회전 속도',
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

// 내보낸 이미지 폴더. 노트 사이에 섞여 잃어버리지 않게 기본은 전용 폴더이고, 비우면 vault 맨 위다.
// 슬래시를 정리하고 '.'·'..' 조각은 버려 vault 밖으로 나가지 않게 한다.
const DEFAULT_EXPORT_FOLDER = 'Graph Styler exports';

function exportFolderPath(folder) {
  if (typeof folder !== 'string') return DEFAULT_EXPORT_FOLDER;
  return folder.replace(/\\/g, '/').split('/').map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..').join('/');
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

function canCopyImages() {
  return typeof ClipboardItem === 'function' && !!navigator.clipboard && typeof navigator.clipboard.write === 'function';
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
    btn.setAttr('title', preset.label);
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
        // 지운 행은 다시 그리면서 사라지므로 포커스가 문서 맨 위로 빠진다. 남은 첫 내 프리셋, 없으면 그 아래 첫 그룹 머리글로 옮긴다.
        const next = this.contentEl.querySelector('.gs-preset-row .gs-btn') || this.contentEl.querySelector('.gs-group > summary');
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
    const list = c.createDiv({ cls: 'gs-list gs-grid' });
    for (const key of Object.keys(PRESETS)) this.presetButton(list, PRESETS[key]);

    // user presets
    const custom = this.plugin.settings.custom || [];
    if (custom.length) {
      c.createEl('div', { cls: 'gs-section', text: L.myPresets });
      const myList = c.createDiv({ cls: 'gs-list' });
      for (const raw of custom) {
        this.presetButton(myList, presetFromRaw(raw),
          () => this.plugin.deleteCustom(raw.id),
          () => this.plugin.copyShareCode(raw));
      }
    }

    this.buildCustomize(c);
    this.buildShare(c);
    this.buildExport(c);
    this.build3d(c);

    // Restore acts on the whole vault, so it sits apart from the groups as a quiet footer action.
    const footer = c.createDiv({ cls: 'gs-footer' });
    const restore = footer.createEl('button', { cls: 'gs-restore', text: L.restore });
    restore.setAttr('title', L.restoreNote);
    restore.onclick = () => this.plugin.restore();
    footer.createEl('p', { text: L.restoreNote, cls: 'gs-note gs-restore-note' });

    const credit = c.createDiv({ cls: 'gs-credit' });
    credit.createSpan({ text: L.by });
    const link = credit.createEl('a', { text: AUTHOR, href: AUTHOR_URL });
    link.setAttr('target', '_blank');
    link.setAttr('rel', 'noopener');
  }

  // 접이식 그룹. 열림 상태는 id로 plugin.openGroups에 두어 render()가 다시 그려도 유지된다 — 그룹을 더하려면
  // id와 제목을 주고 돌려받은 본문에 채우면 된다.
  group(parent, id, title, cls = 'gs-group') {
    const details = parent.createEl('details', { cls });
    details.open = this.plugin.openGroups.has(id);
    details.addEventListener('toggle', () => {
      if (details.open) this.plugin.openGroups.add(id);
      else this.plugin.openGroups.delete(id);
    });
    details.createEl('summary', { text: title });
    return details.createDiv({ cls: 'gs-group-body' });
  }

  // 컨트롤 값은 plugin.draft에 write-through → 재렌더/저장 후에도 유지(리셋 안 됨)
  buildCustomize(c) {
    const draft = this.plugin.draft;
    const details = this.group(c, 'customize', L.customize);
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

  buildShare(c) {
    const body = this.group(c, 'share', L.shareCode);
    const importRow = body.createDiv({ cls: 'gs-row' });
    const codeEl = importRow.createEl('input', { cls: 'gs-code' });
    codeEl.type = 'text';
    codeEl.placeholder = L.codePh;
    const importBtn = body.createEl('button', { cls: 'gs-import', text: L.importCode });
    importBtn.onclick = () => this.plugin.importShareCode(codeEl.value);
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

  // 처음 쓰는 사람이 '이 체크박스가 그래프를 바꾸나?', '어디에 저장됐지?'를 패널만 보고 알 수 있게
  // 옵션마다 한 줄 설명을 붙인다. 자주 쓰는 비율·버튼·마지막 결과는 그룹 안에 바로 두고, 나머지 옵션은 '옵션 더 보기'에 접는다.
  buildExport(parent) {
    const c = this.group(parent, 'export', L.exportTitle);
    c.createEl('p', { text: L.exportOnlyNote, cls: 'gs-note' });
    const hint = (el, text) => el.createEl('p', { text, cls: 'gs-note gs-export-hint' });

    const options = this.plugin.exportOptions;
    const aspectRow = c.createDiv({ cls: 'gs-row' });
    aspectRow.createSpan({ cls: 'gs-row-label', text: L.exportAspect });
    const aspectEl = aspectRow.createEl('select', { cls: 'dropdown' });
    for (const key of Object.keys(EXPORT_ASPECTS)) {
      aspectEl.createEl('option', { value: key, text: key === 'original' ? L.exportAspectOriginal : key });
    }
    aspectEl.value = options.aspect;
    aspectEl.onchange = () => this.plugin.setExportOptions({ aspect: aspectEl.value });
    hint(c, L.exportAspectNote);

    const actions = c.createDiv({ cls: 'gs-row gs-export-actions' });
    const exportBtn = actions.createEl('button', { cls: 'gs-export mod-cta', text: L.exportCmd });
    exportBtn.onclick = () => this.plugin.exportPng(this.plugin.exportScale);
    const copyBtn = actions.createEl('button', { cls: 'gs-copy-image', text: L.exportCopy });
    if (canCopyImages()) copyBtn.onclick = () => this.plugin.copyPng(this.plugin.exportScale);
    else {
      copyBtn.disabled = true;
      copyBtn.setAttr('title', L.exportCopyUnsupported);
    }

    const last = this.plugin.lastExportFile();
    if (last) {
      const lastRow = c.createEl('p', { cls: 'gs-note gs-last-export' });
      lastRow.createSpan({ text: `${L.lastExport} ` });
      const link = lastRow.createEl('a', { text: last.path, href: '#' });
      link.onclick = (ev) => { ev.preventDefault(); this.plugin.openExport(last); };
    }

    const more = this.group(c, 'exportMore', L.exportMore, 'gs-group gs-sub');
    const scaleRow = more.createDiv({ cls: 'gs-row' });
    scaleRow.createSpan({ cls: 'gs-row-label', text: L.exportScale });
    const scaleEl = scaleRow.createEl('select', { cls: 'dropdown' });
    for (const k of EXPORT_SCALES) scaleEl.createEl('option', { value: String(k), text: `${k}x` });
    scaleEl.value = String(this.plugin.exportScale);
    scaleEl.onchange = () => this.plugin.setExportScale(Number(scaleEl.value));
    hint(more, L.exportScaleNote);

    const fitRow = more.createEl('label', { cls: 'gs-row gs-export-check' });
    const fitBox = fitRow.createEl('input');
    fitBox.type = 'checkbox';
    fitBox.checked = options.fit;
    fitBox.onchange = () => this.plugin.setExportOptions({ fit: fitBox.checked });
    fitRow.createSpan({ text: L.exportFit });
    hint(more, L.exportFitNote);

    const captionRow = more.createDiv({ cls: 'gs-row gs-caption-row' });
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
    hint(more, L.exportCaptionNote);

    const folderRow = more.createDiv({ cls: 'gs-row gs-folder-row' });
    folderRow.createSpan({ cls: 'gs-row-label', text: L.exportFolder });
    const folderEl = folderRow.createEl('input', { cls: 'gs-folder' });
    folderEl.type = 'text';
    folderEl.placeholder = DEFAULT_EXPORT_FOLDER;
    folderEl.value = this.plugin.exportFolder;
    folderEl.onchange = () => this.plugin.setExportFolder(folderEl.value);
    hint(more, L.exportFolderNote);

    const openRow = more.createEl('label', { cls: 'gs-row gs-export-check' });
    const openBox = openRow.createEl('input');
    openBox.type = 'checkbox';
    openBox.checked = this.plugin.openAfterExport;
    openBox.onchange = () => this.plugin.setOpenAfterExport(openBox.checked);
    openRow.createSpan({ text: L.exportOpenAfter });
  }

  // 실험 기능이라 접힌 그룹 하나에 모은다. 켜기 전에는 켜는 토글만 보인다. 설정 탭의 토글과 같은 값이라
  // 어느 쪽에서 바꿔도 같고, 끄면 열린 3D 탭이 닫힌다.
  build3d(parent) {
    const plugin = this.plugin;
    const c = this.group(parent, 'graph3d', L.group3d);
    const onRow = c.createEl('label', { cls: 'gs-row gs-check' });
    const onBox = onRow.createEl('input', { cls: 'gs-3d-switch' });
    onBox.type = 'checkbox';
    onBox.checked = !!plugin.settings.experimental3d;
    // 바로 아래에 열기 버튼이 생기므로 '명령 팔레트에서 여세요' 알림은 띄우지 않는다.
    // 켜고 끄면 패널을 다시 그려 이 체크박스가 새로 만들어지므로, 키보드 포커스를 새 체크박스로 옮긴다.
    onBox.onchange = async () => {
      await plugin.setExperimental3d(onBox.checked, false);
      const again = this.contentEl.querySelector('.gs-3d-switch');
      if (again) again.focus();
    };
    onRow.createSpan({ text: L.exp3dName });
    c.createEl('p', { text: L.panel3dNote, cls: 'gs-note' });
    if (!plugin.settings.experimental3d) return;

    const openBtn = c.createEl('button', { cls: 'gs-open-3d', text: L.open3dCmd });
    openBtn.onclick = () => plugin.open3d();
    const rotateRow = c.createEl('label', { cls: 'gs-row gs-check' });
    const rotateBox = rotateRow.createEl('input');
    rotateBox.type = 'checkbox';
    rotateBox.checked = plugin.rotate3d;
    rotateRow.createSpan({ text: L.rotate3d });
    const speedRow = c.createDiv({ cls: 'gs-row' });
    speedRow.createSpan({ cls: 'gs-row-label', text: L.rotate3dSpeed });
    const speed = speedRow.createEl('input');
    speed.type = 'range';
    speed.min = String(ROTATE_3D_MIN);
    speed.max = String(ROTATE_3D_MAX);
    speed.step = '0.01';
    speed.value = String(plugin.rotate3dSpeed);
    speed.disabled = !plugin.rotate3d;
    rotateBox.onchange = () => {
      speed.disabled = !rotateBox.checked;
      plugin.setRotate3d(rotateBox.checked);
    };
    // 슬라이더를 움직이는 동안에는 열린 3D 탭에만 바로 반영하고, 놓을 때 한 번 저장한다.
    speed.oninput = () => plugin.setRotate3dSpeed(Number(speed.value), false);
    speed.onchange = () => plugin.setRotate3dSpeed(Number(speed.value), true);
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

// ---------------------------------------------------------------- 3D graph (experimental)
const VIEW_TYPE_3D = 'graph-styler-3d';
// 자동 회전과 배치 애니메이션은 60fps로 묶는다. 120Hz 화면에서 CPU를 3분의 1쯤 덜 쓴다(실측 33–45% → 23–30%).
// 드래그·확대처럼 입력이 있는 프레임은 화면 주사율대로 바로 그린다.
const FPS_3D = 60;
const ROTATE_3D = 0.12;     // rad/s, 기본 회전 속도(한 바퀴 약 52초)
const ROTATE_3D_MIN = 0.02; // 한 바퀴 약 5분
const ROTATE_3D_MAX = 0.6;  // 한 바퀴 약 10초
const IDLE_3D_MS = 3000;    // 마지막 입력 뒤 회전이 다시 시작될 때까지
const EASE_3D_MS = 1500;    // 다시 시작한 회전이 제 속도에 이를 때까지
// 화면에 맞출 반지름의 최솟값(월드 단위). 가장 작은 노드 반지름(2.2)의 열 배 남짓이라, 노트가 하나뿐인 새 vault도
// 화면을 채우는 원판이 아니라 작은 점으로 보인다.
const FIT_MIN_3D = 30;

// 노트 경로 목록과 metadataCache.resolvedLinks → 링크 쌍과 이웃 목록(CSR).
// 자기 링크, 양방향 중복, 노트가 아닌 대상(첨부파일·없는 파일)은 뺀다.
function graphData3d(paths, resolvedLinks) {
  const n = paths.length;
  const index = new Map(paths.map((p, i) => [p, i]));
  const seen = new Set();
  const pairs = [];
  for (const src of Object.keys(resolvedLinks || {})) {
    const a = index.get(src);
    if (a === undefined) continue;
    for (const dst of Object.keys(resolvedLinks[src] || {})) {
      const b = index.get(dst);
      if (b === undefined || b === a) continue;
      const key = a < b ? a * n + b : b * n + a;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push(a, b);
    }
  }
  const links = Uint32Array.from(pairs);
  const deg = new Uint32Array(n);
  for (const i of links) deg[i]++;
  const start = new Uint32Array(n + 1);
  for (let i = 0; i < n; i++) start[i + 1] = start[i] + deg[i];
  const next = start.slice(0, n);
  const adj = new Uint32Array(links.length);
  const adjLink = new Uint32Array(links.length);
  for (let e = 0; e < links.length / 2; e++) {
    const a = links[e * 2], b = links[e * 2 + 1];
    adj[next[a]] = b; adjLink[next[a]++] = e;
    adj[next[b]] = a; adjLink[next[b]++] = e;
  }
  return { n, links, deg, start, adj, adjLink };
}

// Graph Styler가 만드는 색 그룹 쿼리(path:"폴더", tag:#태그)만 해석한다. 그 밖의 검색 문법은 어느 노트와도
// 맞지 않는 것으로 보고 기본 색을 쓴다.
function colorGroupTest3d(query) {
  const q = String(query || '').trim();
  const path = q.match(/^path:\s*(?:"((?:[^"\\]|\\.)*)"|(\S+))$/);
  if (path) {
    const needle = (path[1] !== undefined ? path[1].replace(/\\(.)/g, '$1') : path[2]).toLowerCase();
    return (notePath) => notePath.toLowerCase().includes(needle);
  }
  const tag = q.match(/^tag:\s*#?([^\s#]+)$/);
  if (tag) {
    const want = `#${tag[1].toLowerCase()}`;
    return (notePath, tags) => tags.some((t) => {
      const low = t.toLowerCase();
      return low === want || low.startsWith(`${want}/`);
    });
  }
  return () => false;
}

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 시작 위치는 노트 경로로 정한다. 파일 순서가 바뀌어도 같은 노트는 같은 곳에서 출발한다.
function initialPositions3d(paths) {
  const pos = new Float32Array(paths.length * 3);
  const r0 = 12 * Math.cbrt(Math.max(1, paths.length));
  paths.forEach((p, i) => {
    let h = 2166136261;
    for (let k = 0; k < p.length; k++) h = Math.imul(h ^ p.charCodeAt(k), 16777619);
    const rand = mulberry32(h >>> 0);
    let x, y, z;
    do { x = rand() * 2 - 1; y = rand() * 2 - 1; z = rand() * 2 - 1; } while (x * x + y * y + z * z > 1);
    pos[i * 3] = x * r0; pos[i * 3 + 1] = y * r0; pos[i * 3 + 2] = z * r0;
  });
  return pos;
}

// Barnes–Hut 3D 힘 배치. d3-force와 같은 식(다체 반발 + 링크 스프링 + 약한 중심 인력)이고 300번에 식는다.
// 이 함수의 소스를 그대로 Worker에 넣으므로 바깥 이름을 쓰면 안 된다.
function forceLayout3d(n, links, pos, params) {
  const P = Object.assign({
    charge: -30, theta: 0.9, linkDistance: 24, gravity: 0.06, velocityKeep: 0.6, alphaMin: 0.001, ticks: 300,
  }, params);
  const EMPTY = -1;
  const INTERNAL = -2;
  const alphaDecay = 1 - Math.pow(P.alphaMin, 1 / P.ticks);
  const m = links.length / 2;
  const vel = new Float32Array(n * 3);
  const deg = new Float32Array(n);
  for (let e = 0; e < links.length; e++) deg[links[e]]++;
  const bias = new Float32Array(m);
  const strength = new Float32Array(m);
  for (let e = 0; e < m; e++) {
    const a = deg[links[e * 2]], b = deg[links[e * 2 + 1]];
    bias[e] = a / (a + b);
    strength[e] = 1 / Math.min(a, b);
  }
  // 팔진 트리는 평평한 배열에 둔다. 칸이 모자라면 두 배로 늘린다.
  let cap = 0;
  let cells = 0;
  let child, body, cnt, sx, sy, sz, ox, oy, oz, hs;
  const stack = new Int32Array(8192);
  const grow = (A, T, k, c) => {
    const B = new T(c * k);
    if (A) B.set(A.subarray(0, Math.min(A.length, c * k)));
    return B;
  };
  const alloc = (c) => {
    child = grow(child, Int32Array, 8, c);
    body = grow(body, Int32Array, 1, c);
    cnt = grow(cnt, Float64Array, 1, c);
    sx = grow(sx, Float64Array, 1, c); sy = grow(sy, Float64Array, 1, c); sz = grow(sz, Float64Array, 1, c);
    ox = grow(ox, Float64Array, 1, c); oy = grow(oy, Float64Array, 1, c); oz = grow(oz, Float64Array, 1, c);
    hs = grow(hs, Float64Array, 1, c);
    cap = c;
  };
  const cell = (x, y, z, h) => {
    if (cells === cap) alloc(cap * 2);
    const c = cells++;
    child.fill(-1, c * 8, c * 8 + 8);
    body[c] = EMPTY; cnt[c] = 0; sx[c] = 0; sy[c] = 0; sz[c] = 0;
    ox[c] = x; oy[c] = y; oz[c] = z; hs[c] = h;
    return c;
  };
  const sub = (c, k) => {
    const h = hs[c] / 2;
    return cell(ox[c] + (k & 1 ? h : -h), oy[c] + (k & 2 ? h : -h), oz[c] + (k & 4 ? h : -h), h);
  };
  const octant = (c, x, y, z) => (x >= ox[c] ? 1 : 0) | (y >= oy[c] ? 2 : 0) | (z >= oz[c] ? 4 : 0);
  const insert = (i, x, y, z) => {
    let c = 0;
    for (let depth = 0; ; depth++) {
      sx[c] += x; sy[c] += y; sz[c] += z; cnt[c] += 1;
      const b = body[c];
      if (b === EMPTY) { body[c] = i; return; }
      if (b >= 0) {
        if (depth >= 24) return; // 겹친 점은 무거운 잎 하나로 둔다
        body[c] = INTERNAL;
        const bx = pos[b * 3], by = pos[b * 3 + 1], bz = pos[b * 3 + 2];
        const kb = octant(c, bx, by, bz);
        const nb = sub(c, kb);
        child[c * 8 + kb] = nb;
        body[nb] = b; sx[nb] = bx; sy[nb] = by; sz[nb] = bz; cnt[nb] = 1;
      }
      const k = octant(c, x, y, z);
      let nc = child[c * 8 + k];
      if (nc < 0) { nc = sub(c, k); child[c * 8 + k] = nc; }
      c = nc;
    }
  };
  const manyBody = (alpha) => {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    cells = 0;
    cell((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.max(x1 - x0, y1 - y0, z1 - z0) / 2 + 1e-3);
    for (let i = 0; i < n; i++) insert(i, pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    const theta2 = P.theta * P.theta;
    const k = P.charge * alpha;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      let fx = 0, fy = 0, fz = 0, sp = 0;
      stack[sp++] = 0;
      while (sp) {
        const c = stack[--sp];
        const w = cnt[c];
        if (!w) continue;
        const b = body[c];
        if (b === i && w === 1) continue;
        const dx = sx[c] / w - x, dy = sy[c] / w - y, dz = sz[c] / w - z;
        let l2 = dx * dx + dy * dy + dz * dz;
        const width = hs[c] * 2;
        if (b !== INTERNAL || width * width < theta2 * l2) {
          if (l2 < 1e-6) continue;
          if (l2 < 1) l2 = Math.sqrt(l2);
          const f = k * w / l2;
          fx += dx * f; fy += dy * f; fz += dz * f;
        } else {
          for (let q = 0; q < 8; q++) {
            const cc = child[c * 8 + q];
            if (cc >= 0) stack[sp++] = cc;
          }
        }
      }
      vel[i * 3] += fx; vel[i * 3 + 1] += fy; vel[i * 3 + 2] += fz;
    }
  };
  const linkForce = (alpha) => {
    for (let e = 0; e < m; e++) {
      const s = links[e * 2] * 3, t = links[e * 2 + 1] * 3;
      let x = pos[t] + vel[t] - pos[s] - vel[s];
      let y = pos[t + 1] + vel[t + 1] - pos[s + 1] - vel[s + 1];
      let z = pos[t + 2] + vel[t + 2] - pos[s + 2] - vel[s + 2];
      let l = Math.sqrt(x * x + y * y + z * z) || 1e-6;
      l = (l - P.linkDistance) / l * alpha * strength[e];
      x *= l; y *= l; z *= l;
      const b = bias[e];
      vel[t] -= x * b; vel[t + 1] -= y * b; vel[t + 2] -= z * b;
      vel[s] += x * (1 - b); vel[s + 1] += y * (1 - b); vel[s + 2] += z * (1 - b);
    }
  };
  alloc(n * 4 + 64);
  let alpha = 1;
  let ticks = 0;
  return {
    positions: pos,
    get alpha() { return alpha; },
    get ticks() { return ticks; },
    get done() { return alpha < P.alphaMin; },
    tick() {
      if (!n) { alpha = 0; return; }
      alpha += (0 - alpha) * alphaDecay;
      linkForce(alpha);
      manyBody(alpha);
      const g = P.gravity * alpha;
      let mx = 0, my = 0, mz = 0;
      for (let i = 0; i < n * 3; i += 3) {
        vel[i] -= pos[i] * g; vel[i + 1] -= pos[i + 1] * g; vel[i + 2] -= pos[i + 2] * g;
        pos[i] += (vel[i] *= P.velocityKeep);
        pos[i + 1] += (vel[i + 1] *= P.velocityKeep);
        pos[i + 2] += (vel[i + 2] *= P.velocityKeep);
        mx += pos[i]; my += pos[i + 1]; mz += pos[i + 2];
      }
      mx /= n; my /= n; mz /= n;
      for (let i = 0; i < n * 3; i += 3) { pos[i] -= mx; pos[i + 1] -= my; pos[i + 2] -= mz; }
      ticks++;
    },
  };
}

// Worker 본체: 12ms씩 계산하고 위치를 보낸 뒤 쉬어, 메시지(종료)를 받을 틈을 둔다.
function layoutWorker3d() {
  let layout = null;
  const step = () => {
    const t0 = performance.now();
    do layout.tick(); while (!layout.done && performance.now() - t0 < 12);
    const pos = layout.positions.slice();
    self.postMessage({ pos, alpha: layout.alpha, ticks: layout.ticks, done: layout.done }, [pos.buffer]);
    if (!layout.done) setTimeout(step, 0);
  };
  self.onmessage = (event) => {
    const msg = event.data;
    layout = forceLayout3d(msg.n, msg.links, msg.pos, msg.params);
    step();
  };
}

const LAYOUT_WORKER_3D = `${forceLayout3d.toString()}\n(${layoutWorker3d.toString()})();`;

// CSS 색 → [r, g, b, a] (0–1). '#rrggbb', 'rgb(…)'/'rgba(…)', 'color(srgb …)'는 바로 읽는다. 그 밖의 표기
// (oklch(), lab(), color(display-p3 …), 테마의 color-mix 결과)는 1×1 캔버스에 칠해 sRGB로 바꾼다.
// 모르는 표기를 검정으로 두면 그 테마에서 노드·선·배경이 보이지 않았다.
let colorCanvas3d = null;
function parseCssColor(css) {
  const s = String(css || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return rgbOf(s).map((v) => v / 255).concat(1);
  const unit = (v, scale) => (v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v) / scale);
  const alpha = (v) => (v === undefined ? 1 : unit(v.trim(), 1));
  let m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    return [unit(p[0], 255), unit(p[1], 255), unit(p[2], 255), alpha(p[3])];
  }
  m = s.match(/^color\(srgb\s+([^)]+)\)$/);
  if (m) {
    const [rgb, a] = m[1].split('/');
    const p = rgb.trim().split(/\s+/);
    return [unit(p[0], 1), unit(p[1], 1), unit(p[2], 1), alpha(a)];
  }
  if (!colorCanvas3d) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    colorCanvas3d = canvas.getContext('2d', { willReadFrequently: true });
  }
  const ctx = colorCanvas3d;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = '#000';
  ctx.fillStyle = s;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255];
}

function overColor(top, base) {
  return [0, 1, 2].map((i) => top[i] * top[3] + base[i] * (1 - top[3]));
}

function luminance(rgb) {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

// 2D 그래프가 iframe에 거는 CSS filter(brightness → contrast → saturate)를 색에 미리 적용한다.
// CSS filter처럼 단계마다 0–1로 잘라야 2D 그래프에 보이는 색과 같다(끝에서 한 번만 자르면 밝은 색이 더 진해진다).
function applyCssFilter(rgb, filter) {
  const amount = (name) => {
    const m = String(filter || '').match(new RegExp(`${name}\\(([0-9.]+)\\)`));
    return m ? parseFloat(m[1]) : 1;
  };
  const b = amount('brightness');
  const c = amount('contrast');
  const s = amount('saturate');
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const [r, g, bl] = rgb.slice(0, 3).map((v) => clamp((clamp(v * b) - 0.5) * c + 0.5));
  return [
    (0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * bl,
    (0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * bl,
    (0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * bl,
  ].map(clamp);
}

function perspective3d(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}

function lookAt3d(e, t) {
  let zx = e[0] - t[0], zy = e[1] - t[1], zz = e[2] - t[2];
  const l = Math.hypot(zx, zy, zz);
  zx /= l; zy /= l; zz /= l;
  const lx = Math.hypot(zz, zx) || 1;
  const xx = zz / lx, xz = -zx / lx; // 위쪽 (0,1,0) × z
  const yx = zy * xz, yy = zz * xx - zx * xz, yz = -zy * xx;
  return [xx, yx, zx, 0, 0, yy, zy, 0, xz, yz, zz, 0,
    -(xx * e[0] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
}

function mat4Mul3d(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

// 셰이더. 노드는 인스턴스 사각형 하나에 심(불투명 원)과 halo(빛 번짐)를 따로 그린다.
// 어두운 배경의 halo는 MAX 합성이라 겹쳐도 더해지지 않는다. 큰 묶음이 하얀 덩어리로 뭉개지지 않고 심이 보인다.
// 밝은 배경에서는 빛이 아니라 옅은 색 번짐(일반 알파 합성)으로 그린다.
const GL3D = {
  bg: [`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`, `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec3 uC1, uC2, uC3;
uniform vec2 uRes;
out vec4 o;
void main() {
  vec2 d = (vUv - vec2(0.5, 0.58)) * uRes;
  float r = length(d) / length(vec2(0.5, 0.58) * uRes);
  vec3 c = r < 0.48 ? mix(uC1, uC2, r / 0.48) : mix(uC2, uC3, (r - 0.48) / 0.52);
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  o = vec4(c + (n - 0.5) / 255.0, 1.0);
}`],
  line: [`#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aCol;
uniform mat4 uMvp;
uniform vec2 uFog;
uniform vec3 uLine;
uniform float uAlpha;
out vec3 vCol;
out float vA;
void main() {
  vec4 c = uMvp * vec4(aPos, 1.0);
  vCol = mix(uLine, aCol, 0.55);
  vA = uAlpha * (1.0 - smoothstep(uFog.x, uFog.y, c.w) * 0.75);
  gl_Position = c;
}`, `#version 300 es
precision mediump float;
in vec3 vCol;
in float vA;
uniform float uLight;
out vec4 o;
void main() { o = vec4(vCol * vA, uLight * vA); }`],
  node: `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aCol;
layout(location=2) in float aSize;
layout(location=3) in float aHi;
layout(location=4) in vec2 aCorner;
uniform mat4 uMvp;
uniform vec2 uView, uFog;
uniform float uPx, uScale, uMinPx, uHover;
out vec2 vUv;
out vec3 vCol;
out float vMix, vPx, vHi;
void main() {
  vec4 c = uMvp * vec4(aPos, 1.0);
  if (c.w <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float px = max(aSize * uPx / c.w, uMinPx) * (1.0 + 0.4 * aHi);
  vPx = px;
  vUv = aCorner;
  vCol = aCol;
  vHi = aHi;
  float fog = smoothstep(uFog.x, uFog.y, c.w) * 0.4;
  vMix = max(fog, uHover * (1.0 - aHi) * 0.7);
  gl_Position = c + vec4(aCorner * px * uScale / uView * 2.0 * c.w, 0.0, 0.0);
}`,
  halo: `#version 300 es
precision mediump float;
in vec2 vUv;
in vec3 vCol;
in float vMix, vPx, vHi;
uniform float uGain, uLight;
out vec4 o;
void main() {
  float d2 = dot(vUv, vUv);
  if (d2 > 1.0) discard;
  float g = (exp(-d2 * 5.0) - 0.0067) * uGain * (1.0 - vMix);
  o = vec4(vCol * g, uLight * g);
}`,
  core: `#version 300 es
precision mediump float;
in vec2 vUv;
in vec3 vCol;
in float vMix, vPx, vHi;
uniform vec3 uFogColor;
uniform float uSheen, uOnlyHi;
out vec4 o;
void main() {
  if (uOnlyHi > 0.5 && vHi < 0.5) discard;
  float d = length(vUv);
  float a = 1.0 - smoothstep(1.0 - 1.5 / max(vPx, 1.0), 1.0, d);
  if (a <= 0.01) discard;
  vec3 c = mix(mix(vCol, vec3(1.0), uSheen * (1.0 - d * d)), uFogColor, vMix);
  o = vec4(c * a, a);
}`,
};

class Graph3DView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.cam = { theta: 0.6, phi: 0.25, dist: 400, target: [0, 0, 0], fov: 0.9 };
    this.hover = -1;
    this.raf = 0;
    this.resumeTimer = 0;
  }

  getViewType() { return VIEW_TYPE_3D; }
  getDisplayText() { return L.view3d; }
  getIcon() { return 'box'; }

  async onOpen() {
    const el = this.contentEl;
    el.empty();
    el.addClass('gs3d-view');
    if (!this.plugin.settings.experimental3d) {
      this.showMessage(L.off3d);
      return;
    }
    this.canvas = el.createEl('canvas', { cls: 'gs3d-canvas' });
    this.gl = this.canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!this.gl) {
      this.canvas.remove();
      this.canvas = null;
      this.showMessage(L.noWebgl3d);
      return;
    }
    this.label = el.createDiv({ cls: 'gs3d-label' });
    this.registerDomEvent(this.canvas, 'webglcontextlost', (e) => {
      e.preventDefault();
      this.stopLoop();
      this.showMessage(L.lost3d);
    });
    this.registerDomEvent(this.canvas, 'webglcontextrestored', () => this.restoreGL());
    // 팝아웃 창에 열리면 캔버스는 그 창의 문서에 있다. 화면 갱신·가시성·DPR은 메인 창이 아니라 이 뷰가 있는 창을 따른다.
    // 메인 창 것을 쓰면 메인 창이 최소화됐을 때 팝아웃의 그래프가 멈추고, 다른 모니터에서는 해상도가 틀린다.
    this.registerDomEvent(el.doc, 'visibilitychange', () => this.kick());
    this.registerEvent(this.app.workspace.on('css-change', () => this.applyStyle()));
    this.bindInput();
    this.resizeObserver = new el.win.ResizeObserver(() => {
      if (!this.userMoved && this.fit) this.cam.dist = this.shownDist = this.fitDistance();
      this.kick();
    });
    this.resizeObserver.observe(this.canvas);
    await this.build();
  }

  async onClose() {
    this.disposed = true;
    this.stopLoop();
    this.contentEl.win.clearTimeout(this.resumeTimer);
    this.stopLayout();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.resizeObserver = null;
    // 탭을 닫는 즉시 GPU 메모리를 돌려준다. Chromium은 동시에 살아 있는 WebGL 문맥 수를 제한한다.
    const lose = this.gl && this.gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    this.gl = null;
    this.canvas = null;
    this.contentEl.empty();
  }

  restoreGL() {
    this.clearMessage();
    // 잃기 전의 GPU 객체는 새 문맥에서 무효라, 지우려 하면 GL 오류만 난다. 버리고 새로 만든다.
    this.prog = this.buf = this.vaoLine = this.vaoNode = null;
    // 링크 강조 버퍼도 새로 만들어지므로 호버를 처음부터 다시 고르게 한다. 그대로 두면 노드만 밝고 링크는 어두웠다.
    this.hover = -1;
    if (this.hi) this.hi.fill(0);
    this.label.toggleClass('is-shown', false);
    this.initGL();
    this.kick(true);
  }

  showMessage(text) {
    this.clearMessage();
    this.message = this.contentEl.createDiv({ cls: 'gs3d-message', text });
  }

  clearMessage() {
    if (this.message) this.message.remove();
    this.message = null;
  }

  // 이름을 load()로 하면 View.open이 부르는 Component.load()를 덮는다. 그러면 뷰가 로드된 상태가 되지 않아
  // 닫을 때 registerDomEvent·registerEvent로 건 것이 풀리지 않는다.
  async build() {
    const { vault, metadataCache } = this.app;
    const files = vault.getMarkdownFiles();
    const paths = files.map((f) => f.path);
    this.files = files;
    this.data = graphData3d(paths, metadataCache.resolvedLinks);
    // Obsidian을 막 켜서 링크 색인이 덜 된 채 복원된 탭이면, 색인이 끝날 때 한 번만 다시 만든다.
    // 그 뒤의 노트 변경은 반영하지 않는다(열 때의 그래프를 보여 준다).
    if (!this.waitingIndex && Object.keys(metadataCache.resolvedLinks || {}).length < files.length) {
      this.waitingIndex = true;
      const ref = metadataCache.on('resolved', () => {
        metadataCache.offref(ref);
        if (!this.disposed) this.build();
      });
      this.registerEvent(ref);
    }
    if (!this.data.n) {
      this.showMessage(L.empty3d);
      return;
    }
    this.clearMessage();
    this.pos = initialPositions3d(paths);
    this.hi = new Float32Array(this.data.n);
    this.hover = -1;
    this.style = await this.readStyle();
    if (this.disposed) return;
    this.initGL();
    this.fit = this.measureFit();
    this.cam.target = [0, 0, 0];
    this.cam.dist = this.shownDist = this.fitDistance();
    this.userMoved = false;
    this.startLayout();
    this.kick();
  }

  // 색은 지금 화면의 2D 그래프와 같은 곳에서 읽는다: 노드·선 기본색은 테마/프리셋이 칠하는 .graph-view.color-*,
  // 그룹 색은 코어 그래프 설정의 colorGroups, 배경과 글로우 filter는 적용 중인 프리셋. 프리셋이 없으면 테마 배경.
  async readStyle() {
    const plugin = this.plugin;
    const palette = await plugin.activePalette();
    const probe = (cls, prop) => {
      const el = document.body.createDiv({ cls });
      const color = parseCssColor(getComputedStyle(el)[prop]);
      el.remove();
      return color;
    };
    const filter = palette ? palette.filter : 'none';
    let bg;
    if (palette) {
      const base = parseCssColor(palette.bg3);
      const mid = overColor(parseCssColor(palette.bg2), base);
      bg = [overColor(parseCssColor(palette.bg1), mid), mid, base.slice(0, 3)];
    } else {
      const el = document.body.createDiv();
      el.style.backgroundColor = 'var(--background-primary)';
      const base = parseCssColor(getComputedStyle(el).backgroundColor).slice(0, 3);
      el.remove();
      bg = [base, base, base];
    }
    const core = this.app.internalPlugins && this.app.internalPlugins.plugins && this.app.internalPlugins.plugins.graph;
    const options = core && core.instance && core.instance.options && Array.isArray(core.instance.options.colorGroups)
      ? core.instance.options : await plugin.readGraphOptions();
    const groups = (Array.isArray(options.colorGroups) ? options.colorGroups : [])
      .filter((g) => g && g.color && typeof g.color.rgb === 'number')
      .map((g) => ({
        test: colorGroupTest3d(g.query),
        tags: /^\s*tag:/.test(String(g.query || '')),
        rgb: applyCssFilter([(g.color.rgb >> 16) & 255, (g.color.rgb >> 8) & 255, g.color.rgb & 255].map((v) => v / 255), filter),
      }));
    return {
      bg,
      light: luminance(bg[2]) > 0.5,
      fill: applyCssFilter(probe('graph-view color-fill', 'color'), filter),
      line: applyCssFilter(probe('graph-view color-line', 'color'), filter),
      groups,
    };
  }

  // 노드 색과 크기. 크기는 2D 그래프처럼 연결 수의 제곱근을 따른다.
  nodeAttributes() {
    const { n, deg } = this.data;
    const { groups, fill } = this.style;
    const tagged = groups.some((g) => g.tags);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const file = this.files[i];
      const tags = tagged ? (getAllTags(this.app.metadataCache.getFileCache(file) || {}) || []) : [];
      const g = groups.find((group) => group.test(file.path, tags));
      col.set(g ? g.rgb : fill, i * 3);
      size[i] = 2.2 + Math.sqrt(deg[i]) * 1.1;
    }
    return { col, size };
  }

  async applyStyle() {
    if (!this.gl || !this.data || !this.data.n) return;
    this.style = await this.readStyle();
    if (this.disposed || !this.gl) return;
    const { col } = this.nodeAttributes();
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.col);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, col);
    this.kick();
  }

  startLayout() {
    this.stopLayout();
    this.layoutDone = false;
    const url = URL.createObjectURL(new Blob([LAYOUT_WORKER_3D], { type: 'text/javascript' }));
    this.worker = new Worker(url);
    URL.revokeObjectURL(url);
    this.worker.onmessage = (event) => {
      this.pos = event.data.pos;
      this.posDirty = true;
      if (event.data.done) {
        this.layoutDone = true;
        this.stopLayout();
      }
      this.kick();
    };
    const pos = this.pos.slice();
    const links = this.data.links.slice();
    this.worker.postMessage({ n: this.data.n, links, pos }, [pos.buffer, links.buffer]);
  }

  stopLayout() {
    if (this.worker) this.worker.terminate();
    this.worker = null;
  }

  initGL() {
    const gl = this.gl;
    if (!gl || gl.isContextLost() || !this.data) return;
    // 색인이 끝나 다시 만들 때 이전 GPU 자원을 먼저 돌려준다. 문맥 복구 뒤에는 이미 무효라 지워도 무해하다.
    if (this.prog) for (const P of Object.values(this.prog)) gl.deleteProgram(P.p);
    if (this.buf) for (const b of Object.values(this.buf)) gl.deleteBuffer(b);
    if (this.vaoLine) gl.deleteVertexArray(this.vaoLine);
    if (this.vaoNode) gl.deleteVertexArray(this.vaoNode);
    const compile = (vs, fs) => {
      const p = gl.createProgram();
      for (const [type, text] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, text);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
        gl.attachShader(p, sh);
        gl.deleteShader(sh);
      }
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {};
      for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) {
        const name = gl.getActiveUniform(p, i).name;
        u[name] = gl.getUniformLocation(p, name);
      }
      return { p, u };
    };
    this.prog = {
      bg: compile(GL3D.bg[0], GL3D.bg[1]),
      line: compile(GL3D.line[0], GL3D.line[1]),
      halo: compile(GL3D.node, GL3D.halo),
      core: compile(GL3D.node, GL3D.core),
    };
    const { col, size } = this.nodeAttributes();
    const buf = (target, data, usage) => {
      const b = gl.createBuffer();
      gl.bindBuffer(target, b);
      gl.bufferData(target, data, usage);
      return b;
    };
    this.buf = {
      pos: buf(gl.ARRAY_BUFFER, this.pos, gl.DYNAMIC_DRAW),
      col: buf(gl.ARRAY_BUFFER, col, gl.DYNAMIC_DRAW),
      size: buf(gl.ARRAY_BUFFER, size, gl.STATIC_DRAW),
      hi: buf(gl.ARRAY_BUFFER, this.hi, gl.DYNAMIC_DRAW),
      corner: buf(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW),
      links: buf(gl.ELEMENT_ARRAY_BUFFER, this.data.links, gl.STATIC_DRAW),
      hiLinks: buf(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(0), gl.DYNAMIC_DRAW),
    };
    this.hiCount = 0;
    const attr = (loc, b, n, divisor) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(loc, divisor);
    };
    this.vaoLine = gl.createVertexArray();
    gl.bindVertexArray(this.vaoLine);
    attr(0, this.buf.pos, 3, 0);
    attr(1, this.buf.col, 3, 0);
    this.vaoNode = gl.createVertexArray();
    gl.bindVertexArray(this.vaoNode);
    attr(0, this.buf.pos, 3, 1);
    attr(1, this.buf.col, 3, 1);
    attr(2, this.buf.size, 1, 1);
    attr(3, this.buf.hi, 1, 1);
    attr(4, this.buf.corner, 2, 0);
    gl.bindVertexArray(null);
  }

  bindInput() {
    const c = this.canvas;
    this.registerDomEvent(c, 'pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.mouse = [e.offsetX, e.offsetY];
      this.drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, far: 0, pan: e.button === 2 || e.shiftKey, button: e.button };
      this.touch();
    });
    this.registerDomEvent(c, 'pointermove', (e) => {
      const d = this.drag;
      if (d) {
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        d.x = e.clientX; d.y = e.clientY;
        // 누른 점에서 가장 멀리 간 거리(직선)로 클릭과 드래그를 가른다. 갔다가 돌아온 드래그는 클릭이 아니다.
        d.far = Math.max(d.far, Math.hypot(e.clientX - d.sx, e.clientY - d.sy));
        if (d.pan) this.panBy(dx, dy);
        else {
          this.cam.theta -= dx * 0.006;
          this.cam.phi = Math.max(-1.45, Math.min(1.45, this.cam.phi + dy * 0.006));
        }
        this.touch();
      }
      this.mouse = [e.offsetX, e.offsetY];
      this.kick(true);
    });
    // 손을 뗀 것(pointerup)만 클릭이 될 수 있다. 시스템이 끊은 포인터(pointercancel, 캡처를 잃음)는 드래그만 끝낸다.
    // 그러지 않으면 drag가 남아 자동 회전이 영영 멈추고, 버튼을 놓은 뒤에도 마우스를 따라 돌았다.
    const endDrag = (e, click) => {
      const d = this.drag;
      if (!d) return;
      this.drag = null;
      if (c.hasPointerCapture(e.pointerId)) c.releasePointerCapture(e.pointerId);
      if (click && d.far < 5 && d.button === 0) {
        // 터치 탭에는 앞선 pointermove가 없어 호버가 없다. 뗀 자리에서 바로 골라 연다.
        this.mouse = [e.offsetX, e.offsetY];
        this.pick();
        if (this.hover >= 0) this.openNode(this.hover, e);
      }
      this.kick(true);
    };
    this.registerDomEvent(c, 'pointerup', (e) => endDrag(e, true));
    this.registerDomEvent(c, 'pointercancel', (e) => endDrag(e, false));
    this.registerDomEvent(c, 'lostpointercapture', (e) => endDrag(e, false));
    this.registerDomEvent(c, 'pointerleave', () => {
      if (this.drag) return;
      this.mouse = null;
      this.setHover(-1);
      this.kick(true);
    });
    // 트랙패드 핀치는 Chromium에서 ctrlKey가 붙은 wheel로 온다. 두 손가락 스크롤(작은 deltaY)도 확대로 쓴다.
    this.registerDomEvent(c, 'wheel', (e) => {
      // 노트가 없으면(안내만 보일 때) 맞출 반지름도 없다.
      if (!this.fit) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const dist = this.cam.dist * Math.exp(dy * (e.ctrlKey ? 0.01 : 0.0015));
      this.cam.dist = Math.max(this.fit.r * 0.05, Math.min(this.fit.r * 12, dist));
      this.touch();
      this.kick(true);
    }, { passive: false });
    this.registerDomEvent(c, 'contextmenu', (e) => e.preventDefault());
  }

  // 입력이 있으면 회전을 멈추고, IDLE_3D_MS 동안 조용하면 다시 천천히 돌린다.
  touch() {
    this.userMoved = true;
    this.lastInput = performance.now();
    const win = this.contentEl.win;
    win.clearTimeout(this.resumeTimer);
    this.resumeTimer = win.setTimeout(() => this.kick(), IDLE_3D_MS + 50);
  }

  rotationSpeed(t) {
    const base = this.plugin.rotate3d ? this.plugin.rotate3dSpeed : 0;
    if (this.drag || !base) return 0;
    if (!this.lastInput) return base;
    const k = Math.max(0, Math.min(1, (t - this.lastInput - IDLE_3D_MS) / EASE_3D_MS));
    return base * k * k * (3 - 2 * k);
  }

  // 자동 회전을 다시 켜면 멈춰 있던 그래프가 툭 출발하지 않게, 입력이 끝난 뒤처럼 천천히 속도를 올린다.
  resumeRotation() {
    if (this.plugin.rotate3d && !this.drag) this.lastInput = performance.now() - IDLE_3D_MS;
    this.kick();
  }

  panBy(dx, dy) {
    const v = this.viewMatrix;
    if (!v) return;
    const k = this.shownDist * Math.tan(this.cam.fov / 2) * 2 / Math.max(1, this.canvas.clientHeight);
    // view 행렬의 첫째·둘째 행 = 카메라의 오른쪽·위 방향
    for (let i = 0; i < 3; i++) this.cam.target[i] += (-dx * v[i * 4] + dy * v[i * 4 + 1]) * k;
  }

  openNode(i, evt) {
    const file = this.files[i];
    const ws = this.app.workspace;
    const mod = Keymap.isModEvent(evt);
    // 3D 탭은 다시 배치하는 데 몇 초가 들어서, 2D 그래프와 달리 자기 탭을 노트로 바꾸지 않는다.
    const leaf = mod ? ws.getLeaf(mod)
      : ws.getLeavesOfType('markdown').find((l) => l.getRoot() === ws.rootSplit) || ws.getLeaf('tab');
    leaf.openFile(file);
  }

  setHover(i) {
    if (i === this.hover) return;
    this.hover = i;
    const { start, adj, adjLink, links } = this.data;
    this.hi.fill(0);
    const hiLinks = [];
    if (i >= 0) {
      this.hi[i] = 1;
      for (let p = start[i]; p < start[i + 1]; p++) {
        this.hi[adj[p]] = 1;
        const e = adjLink[p];
        hiLinks.push(links[e * 2], links[e * 2 + 1]);
      }
      this.label.setText(this.files[i].basename);
    }
    this.label.toggleClass('is-shown', i >= 0);
    const gl = this.gl;
    if (!gl || gl.isContextLost()) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.hi);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.hi);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buf.hiLinks);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(hiLinks), gl.DYNAMIC_DRAW);
    this.hiCount = hiLinks.length;
  }

  // 마우스 아래 노드를 CPU에서 투영해 고른다(5,000개에 0.1ms 안팎). 반경에 대한 거리 비율이 가장 작은 노드라,
  // 허브 바로 앞을 지나는 작은 노드보다 커서가 중심에 더 가까운 허브가 잡힌다.
  pick() {
    if (!this.mouse || !this.mvp) {
      this.setHover(-1);
      return;
    }
    const M = this.mvp, P = this.pos, c = this.canvas;
    const dpr = c.width / Math.max(1, c.clientWidth);
    const mx = this.mouse[0] * dpr, my = this.mouse[1] * dpr;
    const minR = 6 * dpr;
    let best = -1, bestScore = 1;
    for (let i = 0; i < this.data.n; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const w = M[3] * x + M[7] * y + M[11] * z + M[15];
      if (w <= 0) continue;
      const sx = ((M[0] * x + M[4] * y + M[8] * z + M[12]) / w * 0.5 + 0.5) * c.width;
      const sy = (0.5 - (M[1] * x + M[5] * y + M[9] * z + M[13]) / w * 0.5) * c.height;
      const r = Math.max((2.2 + Math.sqrt(this.data.deg[i]) * 1.1) * this.pxScale / w, minR);
      const score = Math.hypot(sx - mx, sy - my) / r;
      if (score <= bestScore) { best = i; bestScore = score; }
    }
    this.setHover(best);
    if (best >= 0) {
      const s = this.project(best);
      this.label.style.transform = `translate(${s[0] / dpr + 12}px, ${s[1] / dpr - 26}px)`;
    }
  }

  project(i) {
    const M = this.mvp, P = this.pos;
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    const w = M[3] * x + M[7] * y + M[11] * z + M[15];
    return [((M[0] * x + M[4] * y + M[8] * z + M[12]) / w * 0.5 + 0.5) * this.canvas.width,
      (0.5 - (M[1] * x + M[5] * y + M[9] * z + M[13]) / w * 0.5) * this.canvas.height];
  }

  measureFit() {
    const n = this.data.n;
    const d = new Float32Array(n);
    for (let i = 0; i < n; i++) d[i] = Math.hypot(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
    d.sort();
    // 멀리 떠 있는 섬 몇 개 때문에 전체가 작아지지 않게 92% 지점에 맞춘다.
    return { r: Math.max(d[Math.floor(n * 0.92)] || 0, FIT_MIN_3D), max: Math.max(d[n - 1] || 0, FIT_MIN_3D) };
  }

  fitDistance() {
    const c = this.canvas;
    const aspect = c && c.clientHeight ? c.clientWidth / c.clientHeight : 1;
    const half = Math.min(this.cam.fov / 2, Math.atan(Math.tan(this.cam.fov / 2) * aspect));
    return this.fit.r / Math.sin(half) * 1.02;
  }

  // input=true: 입력에 대한 응답이라 프레임 상한 없이 바로 그린다.
  kick(input) {
    if (input) this.inputPending = true;
    if (!this.raf && this.gl && this.prog && !this.disposed) this.raf = this.contentEl.win.requestAnimationFrame((t) => this.frame(t));
  }

  stopLoop() {
    if (this.raf) this.contentEl.win.cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  frame(t) {
    this.raf = 0;
    const c = this.canvas;
    const gl = this.gl;
    if (!c || !gl || gl.isContextLost() || this.contentEl.doc.hidden || c.clientWidth === 0) return;
    const gap = this.lastFrame ? t - this.lastFrame : 0;
    if (gap > 0 && gap < 50) this.frameGap = this.frameGap ? this.frameGap * 0.9 + gap * 0.1 : gap;
    this.lastFrame = t;
    // 드래그 중이거나 입력 직후에는 화면 주사율대로 그린다. 회전·배치만 진행 중이면 FPS_3D 박자에 맞춰 건너뛴다:
    // 120Hz 화면에서는 한 번 걸러 한 번 그리고, 144Hz처럼 나누어떨어지지 않는 화면에서도 평균이 FPS_3D를 넘지 않는다.
    const interactive = this.inputPending || !!this.drag || t - (this.lastInput || -Infinity) < 300;
    const period = 1000 / FPS_3D;
    if (!interactive && this.nextDraw && t < this.nextDraw - (this.frameGap || 0) / 2) {
      this.kick();
      return;
    }
    this.nextDraw = !interactive && this.nextDraw && t - this.nextDraw < period ? this.nextDraw + period : t + period;
    const dt = this.lastDraw ? Math.min(0.1, (t - this.lastDraw) / 1000) : 0;
    this.lastDraw = t;
    this.inputPending = false;
    const dpr = this.contentEl.win.devicePixelRatio || 1;
    const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const speed = this.rotationSpeed(t);
    this.cam.theta += dt * speed;
    // 휠 한 칸에 툭 튀지 않게 확대는 목표 거리로 미끄러지듯 따라간다.
    this.shownDist += (this.cam.dist - this.shownDist) * (1 - Math.exp(-dt * 14));
    const zooming = Math.abs(this.cam.dist - this.shownDist) > this.cam.dist * 1e-3;
    this.draw();
    // 드래그 중에는 화면이 커서 밑에서 돌아가므로 다시 고르지 않는다. 고르면 강조가 노드마다 바뀌며 깜박인다.
    if (!this.drag) this.pick();
    if (speed > 0 || !this.layoutDone || zooming || interactive) this.kick();
    else {
      this.lastDraw = 0;
      this.nextDraw = 0;
    }
  }

  draw() {
    const gl = this.gl;
    const c = this.canvas;
    const n = this.data.n;
    const m = this.data.links.length / 2;
    const st = this.style;
    if (this.posDirty) {
      this.posDirty = false;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.pos);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.pos);
      if (!this.userMoved) {
        this.fit = this.measureFit();
        this.cam.dist = this.shownDist = this.fitDistance();
      }
    }
    const cam = this.cam;
    const dist = this.shownDist;
    const eye = [
      cam.target[0] + dist * Math.cos(cam.phi) * Math.sin(cam.theta),
      cam.target[1] + dist * Math.sin(cam.phi),
      cam.target[2] + dist * Math.cos(cam.phi) * Math.cos(cam.theta),
    ];
    const near = Math.max(0.5, dist - this.fit.max * 1.5) * 0.05;
    this.viewMatrix = lookAt3d(eye, cam.target);
    this.mvp = mat4Mul3d(perspective3d(cam.fov, c.width / c.height, near, dist + this.fit.max * 3), this.viewMatrix);
    this.pxScale = c.height / (2 * Math.tan(cam.fov / 2));
    const fog = [dist - this.fit.r * 0.5, dist + this.fit.r * 1.3];
    const hovering = this.hover >= 0 ? 1 : 0;
    const light = st.light ? 1 : 0;

    gl.viewport(0, 0, c.width, c.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    let P = this.prog.bg;
    gl.useProgram(P.p);
    gl.uniform3fv(P.u.uC1, st.bg[0]);
    gl.uniform3fv(P.u.uC2, st.bg[1]);
    gl.uniform3fv(P.u.uC3, st.bg[2]);
    gl.uniform2f(P.u.uRes, c.width, c.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 선: 어두운 배경에서는 빛처럼 더하고, 밝은 배경에서는 옅게 덮는다.
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, light ? gl.ONE_MINUS_SRC_ALPHA : gl.ONE);
    P = this.prog.line;
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.u.uMvp, false, this.mvp);
    gl.uniform2fv(P.u.uFog, fog);
    gl.uniform3fv(P.u.uLine, st.line);
    gl.uniform1f(P.u.uLight, light);
    gl.bindVertexArray(this.vaoLine);
    gl.uniform1f(P.u.uAlpha, (light ? 0.35 : 0.22) * (hovering ? 0.3 : 1));
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buf.links);
    gl.drawElements(gl.LINES, m * 2, gl.UNSIGNED_INT, 0);
    if (hovering && this.hiCount) {
      gl.uniform1f(P.u.uAlpha, 0.9);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buf.hiLinks);
      gl.drawElements(gl.LINES, this.hiCount, gl.UNSIGNED_INT, 0);
    }

    gl.bindVertexArray(this.vaoNode);
    const dpr = c.width / Math.max(1, c.clientWidth);
    for (const name of ['halo', 'core']) {
      P = this.prog[name];
      gl.useProgram(P.p);
      gl.uniformMatrix4fv(P.u.uMvp, false, this.mvp);
      gl.uniform2f(P.u.uView, c.width, c.height);
      gl.uniform1f(P.u.uPx, this.pxScale);
      gl.uniform1f(P.u.uMinPx, 1.6 * dpr);
      gl.uniform1f(P.u.uHover, hovering);
      gl.uniform2fv(P.u.uFog, fog);
      if (name === 'halo') {
        gl.uniform1f(P.u.uScale, light ? 3 : 4.8);
        gl.uniform1f(P.u.uGain, light ? 0.18 : 0.7);
        gl.uniform1f(P.u.uLight, light);
        if (light) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        else gl.blendEquation(gl.MAX);
      } else {
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.DEPTH_TEST);
        gl.uniform1f(P.u.uScale, 1);
        gl.uniform3fv(P.u.uFogColor, st.bg[1]);
        gl.uniform1f(P.u.uSheen, light ? 0 : 0.15);
        gl.uniform1f(P.u.uOnlyHi, 0);
      }
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    }
    // 호버 중에는 강조된 노드를 한 번 더, 깊이 검사 없이 위에 그린다. 앞을 지나는 흐린 노드가 가려 반달처럼 먹히지 않게.
    if (hovering) {
      gl.disable(gl.DEPTH_TEST);
      gl.uniform1f(this.prog.core.u.uOnlyHi, 1);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    }
    gl.bindVertexArray(null);
  }
}

class GraphStylerSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName(L.experimental).setHeading();
    new Setting(containerEl)
      .setName(L.exp3dName)
      .setDesc(L.exp3dDesc)
      .addToggle((toggle) => toggle
        .setValue(!!this.plugin.settings.experimental3d)
        .onChange((value) => this.plugin.setExperimental3d(value)));
  }
}

module.exports = class GraphStyler extends Plugin {
  // 플러그인 로더는 클래스만 쓴다. 내보내기 계산 함수는 테스트용으로 붙여 둔다.
  static exportScaleLimit = exportScaleLimit;
  static exportFileName = exportFileName;
  static exportNoteName = exportNoteName;
  static exportFolderPath = exportFolderPath;
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
    // onunload는 이 첫 복원이 끝나기를 기다린다 — 복원 도중에 끄면 아직 켜지지 않은 스니펫을 읽는다.
    this._restored = firstResume;
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
    this.openGroups = new Set();
    // 2x면 인스타그램 1080px에 충분하고, 3x는 vault에 20MB 안팎을 쓴다. 마지막으로 고른 배율을 기억한다.
    this.exportScale = EXPORT_SCALES.includes(this.settings.exportScale) ? this.settings.exportScale : 2;
    this.exportOptions = sanitizeExportOptions(this.settings.exportOptions);
    this.exportFolder = exportFolderPath(this.settings.exportFolder);
    this.openAfterExport = this.settings.openAfterExport !== false;
    this.rotate3d = this.settings.rotate3d !== false;
    this.rotate3dSpeed = finiteRange(this.settings.rotate3dSpeed, ROTATE_3D, ROTATE_3D_MIN, ROTATE_3D_MAX);
    this.currentPreset = null;

    // 업데이트/재활성화 때 onunload가 끈 글로우 스니펫을 복원 (레지스트리 로드 후)
    const restoreSnippet = () => this.resumeSnippet().finally(resumed);
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

    // 3D 그래프는 실험 기능이다. 설정에서 켜기 전에는 명령이 팔레트에 보이지 않고, 3D 코드는 아무것도 돌지 않는다.
    // 뷰 종류는 늘 등록해 둔다. 켜 둔 채 닫은 탭이 복원돼도 '꺼져 있음' 안내만 보이게.
    this.registerView(VIEW_TYPE_3D, (leaf) => new Graph3DView(leaf, this));
    this.addCommand({
      id: 'open-3d-graph',
      name: L.open3dCmd,
      checkCallback: (checking) => {
        if (!this.settings.experimental3d) return false;
        if (!checking) this.open3d();
        return true;
      },
    });
    this.addSettingTab(new GraphStylerSettingTab(this.app, this));
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
      // 켜자마자 끄면 로드 때 시작한 복원이 아직 돌고 있다. 그 전에 읽으면 '켜진 것 없음'으로 보고 복원 기록을 null로
      // 덮어써 테마가 꺼진 채 남는다. 복원이 끝난 뒤의 상태에서 끈다.
      if (this._restored) await this._restored;
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

  // 3D 탭(= WebGL 문맥)은 하나만 연다. 이미 있으면 그 탭을 보여 주고, 여는 중에 다시 누르면 같은 열기를 기다린다.
  async open3d() {
    if (!this.opening3d) {
      this.opening3d = (async () => {
        const { workspace } = this.app;
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_3D)[0];
        if (!leaf) {
          leaf = workspace.getLeaf('tab');
          await leaf.setViewState({ type: VIEW_TYPE_3D, active: true });
        }
        workspace.revealLeaf(leaf);
      })();
    }
    try {
      await this.opening3d;
    } finally {
      this.opening3d = null;
    }
  }

  // 설정 탭과 패널 어느 쪽에서 바꿔도 패널을 다시 그려 두 토글이 같은 값을 보인다.
  // notice=false: 켜는 곳(패널)에 이미 열기 버튼이 있어 명령 안내가 필요 없을 때.
  async setExperimental3d(on, notice = true) {
    this.settings.experimental3d = on;
    await this.saveData(this.settings);
    // 켤 때는 이미 열린(복원된) 3D 탭을 닫지 않는다. 닫는 것은 끌 때뿐이다.
    if (on && notice) new Notice(L.exp3dOn);
    if (!on) for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_3D)) leaf.detach();
    // 꺼져 있을 때 복원된 탭은 '꺼져 있음' 안내만 띄운 채라, 켜면 그 자리에서 다시 열어 그리게 한다.
    else for (const view of this.views3d()) if (!view.canvas) view.onOpen();
    this.refreshViews();
  }

  async setRotate3d(on) {
    this.rotate3d = !!on;
    this.settings.rotate3d = this.rotate3d;
    for (const view of this.views3d()) view.resumeRotation();
    await this.saveData(this.settings);
  }

  // 열린 3D 탭은 매 프레임 이 값을 읽는다. 각도에 속도를 쌓아 가므로 값을 바꿔도 화면이 튀지 않는다.
  // 0이나 음수도 최솟값으로 올린다. 회전을 멈추는 스위치는 자동 회전 하나뿐이다.
  async setRotate3dSpeed(value, save) {
    this.rotate3dSpeed = finiteRange(value, ROTATE_3D, ROTATE_3D_MIN, ROTATE_3D_MAX);
    this.settings.rotate3dSpeed = this.rotate3dSpeed;
    for (const view of this.views3d()) view.kick();
    if (save) await this.saveData(this.settings);
  }

  views3d() {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE_3D).map((leaf) => leaf.view).filter((view) => view instanceof Graph3DView);
  }

  // 프리셋을 바꾸면 열린 3D 그래프도 새 색을 쓴다(테마 전환은 3D 뷰가 css-change로 직접 받는다).
  refresh3d() {
    for (const view of this.views3d()) view.applyStyle();
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

  // 그래프를 PNG로 그려 { blob, width, height, leaf }를 돌려준다. 그래프가 없으면 null.
  async renderPng(requestedScale) {
    const leaf = this.exportTarget();
    const renderer = leaf && leaf.view.renderer;
    if (!renderer) {
      new Notice(L.exportOpenGraph);
      return null;
    }
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
    return { blob, width: canvas.width, height: canvas.height, leaf };
  }

  async exportPng(requestedScale) {
    try {
      const png = await this.renderPng(requestedScale);
      if (!png) return;
      const presetId = this.currentPreset ? this.currentPreset.id : await this.enabledSnippetId();
      const localFile = png.leaf.view.getViewType && png.leaf.view.getViewType() === 'localgraph' ? png.leaf.view.file : null;
      const folder = this.exportFolder;
      await this.ensureFolder(folder);
      const prefix = folder ? `${folder}/` : '';
      const taken = this.app.vault.getFiles().map((file) => file.path)
        .filter((path) => path.startsWith(prefix)).map((path) => path.slice(prefix.length));
      const name = exportFileName(presetId === LIVE_ID ? null : presetId, new Date(), taken, localFile && localFile.basename);
      const file = await this.app.vault.createBinary(prefix + name, await png.blob.arrayBuffer());
      this.settings.lastExport = file.path;
      await this.saveData(this.settings);
      this.refreshViews();
      this.exportedNotice(file, png.width, png.height);
      if (this.openAfterExport) await this.openExport(file, true);
    } catch (e) {
      console.error('[graph-styler] PNG export failed', e);
      new Notice(L.exportFailed);
    }
  }

  // 클립보드로 바로 보낸다 — 인스타그램 웹 작성 창, 채팅, 문서에 그대로 붙여넣을 수 있다. 파일은 만들지 않는다.
  async copyPng(requestedScale) {
    try {
      const png = await this.renderPng(requestedScale);
      if (!png) return;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png.blob })]);
      new Notice(L.copiedImage(png.width, png.height));
    } catch (e) {
      console.error('[graph-styler] image copy failed', e);
      new Notice(L.copyImageFailed);
    }
  }

  async ensureFolder(folder) {
    if (!folder) return;
    let path = '';
    for (const part of folder.split('/')) {
      path = path ? `${path}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(path)) await this.app.vault.createFolder(path);
    }
  }

  // 알림은 금방 사라지므로 길게(12초) 띄우고, 경로와 함께 '열기'·'Finder에서 보기'를 단다.
  exportedNotice(file, width, height) {
    const content = createFragment((frag) => {
      frag.createDiv({ text: L.exported(file.path, width, height) });
      const buttons = frag.createDiv({ cls: 'gs-notice-actions' });
      const open = buttons.createEl('button', { text: L.noticeOpen });
      open.onclick = () => this.openExport(file);
      if (typeof this.app.showInFolder === 'function') {
        const reveal = buttons.createEl('button', { text: L.noticeReveal(Platform.isMacOS) });
        reveal.onclick = () => this.app.showInFolder(file.path);
      }
    });
    new Notice(content, 12000);
  }

  // 그래프 옆 분할 창에 연다(새 탭이면 그래프가 가려진다). 같은 창을 다시 쓰고, 파일 탐색기에서도 보여 준다.
  async openExport(file, reveal) {
    const workspace = this.app.workspace;
    let leaf = this._exportLeaf;
    if (!leaf || !leaf.view || !workspace.getLeavesOfType(leaf.view.getViewType()).includes(leaf)) {
      leaf = workspace.getLeaf('split', 'vertical');
      this._exportLeaf = leaf;
    }
    await leaf.openFile(file);
    if (reveal) {
      const explorer = workspace.getLeavesOfType('file-explorer')[0];
      if (explorer && explorer.view && typeof explorer.view.revealInFolder === 'function') explorer.view.revealInFolder(file);
    }
  }

  lastExportFile() {
    const path = this.settings.lastExport;
    return typeof path === 'string' && path ? this.app.vault.getAbstractFileByPath(path) : null;
  }

  async setExportFolder(folder) {
    this.exportFolder = exportFolderPath(folder);
    this.settings.exportFolder = this.exportFolder;
    await this.saveData(this.settings);
  }

  async setOpenAfterExport(on) {
    this.openAfterExport = !!on;
    this.settings.openAfterExport = this.openAfterExport;
    await this.saveData(this.settings);
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
      if (!live) this.refresh3d();
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
    this.refresh3d();
    new Notice(L.restored);
  }
};

// 플러그인 로더는 module.exports(클래스)만 쓴다. 공유 코드·3D 그래프 함수는 테스트용으로 붙여 둔다.
module.exports.encodeShareCode = encodeShareCode;
module.exports.decodeShareCode = decodeShareCode;
module.exports.presetFromRaw = presetFromRaw;
module.exports.graphData3d = graphData3d;
module.exports.colorGroupTest3d = colorGroupTest3d;
module.exports.initialPositions3d = initialPositions3d;
module.exports.forceLayout3d = forceLayout3d;
module.exports.LAYOUT_WORKER_3D = LAYOUT_WORKER_3D;
module.exports.applyCssFilter = applyCssFilter;
module.exports.Graph3DView = Graph3DView;
module.exports.parseCssColor = parseCssColor;
