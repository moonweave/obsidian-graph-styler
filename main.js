/*
 * Graph Styler — one-click aesthetic themes for the Obsidian graph view.
 * Copyright (c) 2026 Moonweave  (https://www.instagram.com/phd.ai.log/)
 * Released under the MIT License. Made by Moonweave.
 */
'use strict';

const { Plugin, ItemView, Notice } = require('obsidian');

const AUTHOR = 'Moonweave';
const AUTHOR_URL = 'https://www.instagram.com/phd.ai.log/';
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
    desc: 'Tap a preset — your graph restyles instantly. Keep this panel open while you move the graph around.',
    restore: '↩︎ Restore original',
    openCmd: 'Open Graph Styler panel',
    applyCmd: 'Apply',
    applied: (p) => `${p.emoji} ${p.label} applied`,
    failed: 'Apply failed — open the console (Cmd+Opt+I) to see why',
    openGraph: 'Open a graph view first',
    restored: '↩︎ Restored to original',
    noBackup: 'No backup found',
    by: 'made by ',
    customize: '🎛️ Customize',
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
    desc: '프리셋을 누르면 그래프가 바로 바뀝니다. 패널은 열어둔 채 그래프를 움직여도 됩니다.',
    restore: '↩︎ 원래대로 되돌리기',
    openCmd: 'Graph Styler 패널 열기',
    applyCmd: '적용',
    applied: (p) => `${p.emoji} ${p.label} 적용 완료`,
    failed: '적용 실패 — 콘솔(Cmd+Opt+I)에서 원인 확인',
    openGraph: '그래프 뷰를 먼저 열어주세요',
    restored: '↩︎ 원래대로 복구함',
    noBackup: '백업이 없어요',
    by: 'made by ',
    customize: '🎛️ 커스터마이즈',
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
function makeGroups(folders, colors) {
  return folders.map((folder, i) => ({
    query: `path:"${folder.replace(/"/g, '\\"')}"`,
    color: { a: 1, rgb: hexToRgbInt(colors[i % colors.length]) },
  }));
}

function makeGlowCss(p) {
  return `/* graph-styler :: ${p.id} (auto-generated) */
.graph-view-content {
  background: radial-gradient(circle at 50% 42%, ${p.bg1} 0%, ${p.bg2} 48%, ${p.bg3} 100%) !important;
}
.workspace-leaf-content[data-type="graph"],
.workspace-leaf-content[data-type="localgraph"] { background: ${p.bg3}; }
.theme-dark .graph-view.color-circle { color: ${p.circle}; }
.theme-dark .graph-view.color-fill { color: ${p.fill}; }
.theme-dark .graph-view.color-fill-tag { color: ${p.tag}; }
.theme-dark .graph-view.color-fill-unresolved { color: ${p.unresolved}; }
.theme-dark .graph-view.color-fill-focused { color: #ffffff; }
.theme-dark .graph-view.color-line { color: ${p.line}; }
.theme-dark .graph-view.color-text { color: ${p.text}; }
.graph-view-content canvas { filter: ${p.filter}; }
`;
}

// 테마 관련 옵션만. 구조적 사용자 설정(hideUnresolved/showAttachments/showArrow)은
// 일부러 건드리지 않아 사용자 선호를 보존한다.
const BASE_GRAPH = {
  showTags: true,
  'collapse-color-groups': false, 'collapse-display': false, 'collapse-forces': false,
};

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
    centerStrength: pick(o.center, 0.1),
    repelStrength: pick(o.repel, 17),
    linkStrength: pick(o.linkS, 0.2),
    linkDistance: pick(o.dist, 140),
  });
}

// id, label, emoji, palette colors[], forces, background[3], theme colors
function P(id, label, emoji, colors, forces, bg, theme) {
  const palette = {
    id, bg1: bg[0], bg2: bg[1], bg3: bg[2],
    circle: theme.circle, fill: theme.fill, tag: theme.tag,
    unresolved: theme.unresolved || '#1e293b', line: theme.line,
    text: theme.text, filter: theme.filter,
  };
  return {
    id, label, emoji, colors,
    swatch: colors.length ? colors : [theme.circle, theme.fill, theme.tag, theme.line],
    graph: graph(forces || {}),
    palette,
  };
}

function safeHex(hex, fallback) {
  return typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;
}

// 사용자 커스텀 raw({id,label,colors[4],bg,glow,forces}) → 프리셋으로 재구성.
// data.json 손편집 대비 hex 검증.
function presetFromRaw(raw) {
  const colors = (raw.colors || []).map((c, i) => safeHex(c, DEFAULT_CUSTOM.colors[i] || '#8899aa'));
  while (colors.length < 4) colors.push('#8899aa');
  const bgHex = safeHex(raw.bg, DEFAULT_CUSTOM.bg);
  const bg = [mix(bgHex, colors[0], 0.2), mix(bgHex, colors[0], 0.08), bgHex];
  const g = Number(raw.glow) || 0;
  const theme = {
    circle: colors[0], fill: colors[1], tag: colors[2],
    line: mix(colors[0], bgHex, 0.55), text: lighten(colors[0], 0.72),
    unresolved: mix(bgHex, '#ffffff', 0.1),
    filter: `brightness(${(1 + g / 280).toFixed(2)}) contrast(1.06) saturate(${(1 + g / 110).toFixed(2)})`,
  };
  return P(raw.id, raw.label || 'Custom', '🎛️', colors, raw.forces || {}, bg, theme);
}

const DEFAULT_CUSTOM = {
  colors: ['#7dd3fc', '#34d399', '#fbbf24', '#f472b6'],
  bg: '#0b1624',
  glow: 40,
  forces: { node: 2.2, repel: 17, dist: 140, center: 0.1, linkS: 0.2, line: 0.3, fade: 1.2 },
};

const PRESETS = {
  neon: P('neon', 'Neon', '⚡',
    ['#7dd3fc', '#34d399', '#fbbf24', '#f472b6'], { node: 2.4, repel: 18, dist: 140 },
    ['rgba(37,67,92,0.9)', 'rgba(18,38,58,0.96)', '#0b1624'],
    { circle: '#7dd3fc', fill: '#34d399', tag: '#fb7fc8', line: '#315b7a', text: '#e5eefc',
      filter: 'brightness(1.25) contrast(1.15) saturate(1.5)' }),

  galaxy: P('galaxy', 'Galaxy', '🌌',
    ['#a5b4fc', '#c4b5fd', '#f0abfc', '#fda4af'],
    { node: 1.8, repel: 20, dist: 200, center: 0.05, linkS: 0.12, fade: 1.6 },
    ['rgba(40,30,70,0.9)', 'rgba(20,16,40,0.97)', '#070512'],
    { circle: '#a5b4fc', fill: '#c4b5fd', tag: '#f0abfc', line: '#3b2f63', text: '#e9e5ff',
      unresolved: '#241b3a', filter: 'brightness(1.3) contrast(1.1) saturate(1.4)' }),

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
    ['#38bdf8', '#22d3ee', '#2dd4bf', '#818cf8'], { node: 2.1, repel: 17, dist: 150 },
    ['rgba(6,32,51,0.92)', 'rgba(4,22,42,0.97)', '#020a16'],
    { circle: '#38bdf8', fill: '#22d3ee', tag: '#818cf8', line: '#1f4d6b', text: '#d6f1ff',
      unresolved: '#0c2030', filter: 'brightness(1.2) contrast(1.12) saturate(1.45)' }),

  forest: P('forest', 'Forest', '🌲',
    ['#a3e635', '#22c55e', '#2dd4bf', '#facc15'],
    { node: 2.0, repel: 13, dist: 115, center: 0.18, linkS: 0.35 },
    ['rgba(17,36,15,0.92)', 'rgba(12,26,11,0.97)', '#060d06'],
    { circle: '#a3e635', fill: '#22c55e', tag: '#facc15', line: '#2f5a2a', text: '#e6ffd6',
      unresolved: '#16240f', filter: 'brightness(1.2) contrast(1.1) saturate(1.4)' }),

  candy: P('candy', 'Candy', '🍬',
    ['#f9a8d4', '#a7f3d0', '#c4b5fd', '#fde68a'],
    { node: 2.1, repel: 13, dist: 115, center: 0.18, linkS: 0.35 },
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
    ['#88c0d0', '#81a1c1', '#a3be8c', '#b48ead'],
    { node: 2.0, repel: 16, dist: 145, fade: 1.3 },
    ['rgba(46,52,64,0.92)', 'rgba(40,46,58,0.97)', '#21262f'],
    { circle: '#88c0d0', fill: '#a3be8c', tag: '#b48ead', line: '#434c5e', text: '#e5e9f0',
      unresolved: '#3b4252', filter: 'brightness(1.12) contrast(1.05) saturate(1.15)' }),

  dracula: P('dracula', 'Dracula', '🧛',
    ['#bd93f9', '#ff79c6', '#50fa7b', '#8be9fd'], { node: 2.2, repel: 17, dist: 150 },
    ['rgba(40,42,54,0.92)', 'rgba(30,31,42,0.97)', '#191a21'],
    { circle: '#bd93f9', fill: '#50fa7b', tag: '#ff79c6', line: '#44475a', text: '#f8f8f2',
      unresolved: '#383a4a', filter: 'brightness(1.18) contrast(1.08) saturate(1.3)' }),

  catppuccin: P('catppuccin', 'Catppuccin', '🐈',
    ['#cba6f7', '#f5c2e7', '#a6e3a1', '#89dceb'], { node: 2.1, repel: 16, dist: 145 },
    ['rgba(49,50,68,0.92)', 'rgba(30,30,46,0.97)', '#181825'],
    { circle: '#89dceb', fill: '#a6e3a1', tag: '#f5c2e7', line: '#45475a', text: '#cdd6f4',
      unresolved: '#313244', filter: 'brightness(1.15) contrast(1.05) saturate(1.2)' }),

  mono: P('mono', 'Mono', '⚪',
    [], { tags: false, node: 1.6, repel: 12, dist: 100, center: 0.2, linkS: 0.4, fade: 1.0, line: 0.2 },
    ['rgba(24,24,27,0.9)', 'rgba(15,15,17,0.97)', '#0a0a0b'],
    { circle: '#e4e4e7', fill: '#a1a1aa', tag: '#71717a', line: '#3f3f46', text: '#fafafa',
      unresolved: '#27272a', filter: 'brightness(1.1) contrast(1.05) saturate(1.0)' }),
};

const SLIDERS = [
  ['node', 0.3, 4, 0.1], ['repel', 0, 20, 0.5], ['dist', 30, 500, 5],
  ['center', 0, 1, 0.02], ['linkS', 0, 1, 0.02], ['line', 0.1, 2, 0.05], ['fade', 0, 3, 0.1],
];

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
    restore.onclick = () => this.plugin.restore();

    this.buildCustomize(c);

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
    input.step = String(step);
    input.value = String(value);
    input.oninput = () => { onChange(Number(input.value)); this.schedulePreview(); };
    return input;
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
  async onload() {
    this.settings = Object.assign({ custom: [] }, await this.loadData());
    if (!Array.isArray(this.settings.custom)) this.settings.custom = [];
    this.draft = {
      colors: [...DEFAULT_CUSTOM.colors], bg: DEFAULT_CUSTOM.bg,
      glow: DEFAULT_CUSTOM.glow, forces: { ...DEFAULT_CUSTOM.forces }, name: '',
    };
    this.customizeOpen = false;

    this.registerView(VIEW_TYPE, (leaf) => new StylerView(leaf, this));
    this.addRibbonIcon('palette', 'Graph Styler', () => this.activateView());
    this.addCommand({
      id: 'open-graph-styler',
      name: L.openCmd,
      callback: () => this.activateView(),
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
    const invalidate = () => { this._folders = null; };
    this.registerEvent(this.app.vault.on('create', invalidate));
    this.registerEvent(this.app.vault.on('delete', invalidate));
    this.registerEvent(this.app.vault.on('rename', invalidate));
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
    this.refreshViews();
    new Notice(L.deleted);
  }

  graphPath() {
    return `${this.app.vault.configDir}/graph.json`;
  }

  snippetIds() {
    const ids = new Set(Object.keys(PRESETS));
    ids.add(LIVE_ID);
    for (const r of this.settings.custom || []) ids.add(r.id);
    return ids;
  }

  setActiveSnippet(activeId) {
    const customCss = this.app.customCss;
    if (!customCss || !customCss.setCssEnabledStatus) return;
    const ids = this.snippetIds();
    ids.add(activeId);
    for (const id of ids) customCss.setCssEnabledStatus(`graph-styler-${id}`, id === activeId);
  }

  // 노트가 많은 폴더 순 (세션 캐시 + 구조 변경 시 무효화)
  detectColorFolders() {
    const counts = new Map();
    for (const file of this.app.vault.getMarkdownFiles()) {
      const parent = file.parent && file.parent.path;
      if (!parent || parent === '/') continue;
      counts.set(parent, (counts.get(parent) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map((entry) => entry[0]);
  }

  getFolders(max) {
    if (!this._folders) this._folders = this.detectColorFolders();
    return this._folders.slice(0, max);
  }

  // 빠른 연속 호출(라이브 드래그)을 직렬화 → graph.json 동시쓰기 레이스 방지 (latest-wins)
  async applyPreset(preset, opts) {
    if (this._applying) { this._next = [preset, opts]; return; }
    this._applying = true;
    try {
      await this._doApply(preset, opts);
    } finally {
      this._applying = false;
      if (this._next) {
        const [p, o] = this._next;
        this._next = null;
        this.applyPreset(p, o);
      }
    }
  }

  async _doApply(preset, opts) {
    const live = !!(opts && opts.silent);
    try {
      await this.backupOnce();
      const graphOptions = Object.assign({}, preset.graph);
      if (preset.colors.length === 0) {
        graphOptions.colorGroups = [];                 // mono: 강제 단색
      } else {
        const folders = this.getFolders(preset.colors.length);
        if (folders.length) graphOptions.colorGroups = makeGroups(folders, preset.colors);
        // 폴더 없으면(루트-only/빈 vault) 기존 colorGroups 보존 — 덮어쓰지 않음
      }
      const merged = await this.writeGraph(graphOptions);
      await this.installSnippet(preset.id, makeGlowCss(preset.palette));
      await this.reloadGraph(merged, live);
      if (this.liveStyle) this.liveStyle.textContent = '';   // 확정됐으니 라이브 미리보기 스타일 비움
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
    if (!(await adapter.exists(bak)) && (await adapter.exists(this.graphPath()))) {
      await adapter.write(bak, await adapter.read(this.graphPath()));
    }
    this._backedUp = true;
  }

  async writeGraph(graphOptions) {
    const adapter = this.app.vault.adapter;
    let current = {};
    try {
      current = JSON.parse(await adapter.read(this.graphPath()));
    } catch (_) {
      current = {};
    }
    const merged = Object.assign(current, graphOptions);
    await adapter.write(this.graphPath(), JSON.stringify(merged, null, 2));
    return merged;
  }

  async installSnippet(presetId, css) {
    const adapter = this.app.vault.adapter;
    const dir = `${this.app.vault.configDir}/snippets`;
    if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
    await adapter.write(`${dir}/graph-styler-${presetId}.css`, css);
    try {
      const customCss = this.app.customCss;
      if (customCss && customCss.readSnippets) await customCss.readSnippets();
      this.setActiveSnippet(presetId);
    } catch (e) {
      console.warn('[graph-styler] snippet auto-enable failed; toggle it in Settings → CSS snippets', e);
    }
  }

  // engineOnly=true (라이브 드래그): 엔진 직접 갱신만, leaf 리로드(깜빡임) 스킵
  async reloadGraph(graphOptions, engineOnly) {
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
          if (typeof engine.render === 'function') engine.render();
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
    const graphOptions = Object.assign({}, preset.graph);
    if (preset.colors.length) {
      const folders = this.getFolders(preset.colors.length);
      if (folders.length) graphOptions.colorGroups = makeGroups(folders, preset.colors);
    }
    const leaves = this.app.workspace
      .getLeavesOfType('graph')
      .concat(this.app.workspace.getLeavesOfType('localgraph'));
    for (const leaf of leaves) {
      const engine = leaf.view && (leaf.view.engine || leaf.view.dataEngine);
      if (engine && typeof engine.setOptions === 'function') {
        try {
          engine.setOptions(graphOptions);
          if (typeof engine.render === 'function') engine.render();
        } catch (_) { /* engine API drift — preview just skips */ }
      }
    }
  }

  async restore() {
    const adapter = this.app.vault.adapter;
    const bak = `${this.graphPath()}.styler-bak`;
    if (!(await adapter.exists(bak))) {
      new Notice(L.noBackup);
      return;
    }
    const original = await adapter.read(bak);
    await adapter.write(this.graphPath(), original);
    this.setActiveSnippet('__none__');
    if (this.liveStyle) this.liveStyle.textContent = '';
    let originalOptions = {};
    try {
      originalOptions = JSON.parse(original);
    } catch (_) {
      originalOptions = {};
    }
    await this.reloadGraph(originalOptions);
    new Notice(L.restored);
  }
};
