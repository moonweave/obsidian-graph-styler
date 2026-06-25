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

const BASE_GRAPH = {
  showTags: true, hideUnresolved: true, showAttachments: false,
  'collapse-color-groups': false, 'collapse-display': false, 'collapse-forces': false,
  showArrow: false,
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

// 사용자 커스텀 raw({id,label,emoji,colors[4],bg,glow,forces}) → 프리셋으로 재구성
function presetFromRaw(raw) {
  const colors = raw.colors;
  const bg = [mix(raw.bg, colors[0], 0.2), mix(raw.bg, colors[0], 0.08), raw.bg];
  const g = Number(raw.glow) || 0;
  const theme = {
    circle: colors[0], fill: colors[1] || colors[0], tag: colors[2] || colors[0],
    line: mix(colors[0], raw.bg, 0.55), text: lighten(colors[0], 0.72),
    unresolved: mix(raw.bg, '#ffffff', 0.1),
    filter: `brightness(${(1 + g / 280).toFixed(2)}) contrast(1.06) saturate(${(1 + g / 110).toFixed(2)})`,
  };
  return P(raw.id, raw.label, raw.emoji || '🎛️', colors, raw.forces, bg, theme);
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
    this.debounce = null;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Graph Styler'; }
  getIcon() { return 'palette'; }

  async onOpen() { this.render(); }
  async onClose() {}

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

  buildCustomize(c) {
    const details = c.createEl('details', { cls: 'gs-custom' });
    details.createEl('summary', { text: L.customize });

    // group colors
    const colorRow = details.createDiv({ cls: 'gs-row' });
    colorRow.createSpan({ cls: 'gs-row-label', text: L.f.colors });
    const colorBox = colorRow.createSpan({ cls: 'gs-colors' });
    this.colorEls = DEFAULT_CUSTOM.colors.map((hex) => {
      const input = colorBox.createEl('input');
      input.type = 'color';
      input.value = hex;
      input.oninput = () => this.liveApply();
      return input;
    });

    // background color
    const bgRow = details.createDiv({ cls: 'gs-row' });
    bgRow.createSpan({ cls: 'gs-row-label', text: L.f.bg });
    this.bgEl = bgRow.createEl('input');
    this.bgEl.type = 'color';
    this.bgEl.value = DEFAULT_CUSTOM.bg;
    this.bgEl.oninput = () => this.liveApply();

    // glow + force/size sliders
    this.glowEl = this.sliderRow(details, L.f.glow, 0, 100, 5, DEFAULT_CUSTOM.glow);
    this.s = {};
    for (const [key, min, max, step] of SLIDERS) {
      this.s[key] = this.sliderRow(details, L.f[key], min, max, step, DEFAULT_CUSTOM.forces[key]);
    }

    // name + save
    const saveRow = details.createDiv({ cls: 'gs-row' });
    this.nameEl = saveRow.createEl('input', { cls: 'gs-name' });
    this.nameEl.type = 'text';
    this.nameEl.placeholder = L.namePh;
    const saveBtn = details.createEl('button', { cls: 'gs-save', text: L.save });
    saveBtn.onclick = () => this.saveCurrent();
  }

  sliderRow(parent, label, min, max, step, value) {
    const row = parent.createDiv({ cls: 'gs-row' });
    row.createSpan({ cls: 'gs-row-label', text: label });
    const input = row.createEl('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.oninput = () => this.liveApply();
    return input;
  }

  readRaw(id) {
    return {
      id,
      label: (this.nameEl.value || 'Custom').trim() || 'Custom',
      emoji: '🎛️',
      colors: this.colorEls.map((el) => el.value),
      bg: this.bgEl.value,
      glow: Number(this.glowEl.value),
      forces: {
        node: Number(this.s.node.value), repel: Number(this.s.repel.value),
        dist: Number(this.s.dist.value), center: Number(this.s.center.value),
        linkS: Number(this.s.linkS.value), line: Number(this.s.line.value),
        fade: Number(this.s.fade.value),
      },
    };
  }

  liveApply() {
    if (this.debounce) window.clearTimeout(this.debounce);
    this.debounce = window.setTimeout(() => {
      this.plugin.applyPreset(presetFromRaw(this.readRaw(LIVE_ID)), { silent: true });
    }, 160);
  }

  async saveCurrent() {
    const raw = this.readRaw(`custom-${Date.now()}`);
    await this.plugin.saveCustom(raw);
  }
}

module.exports = class GraphStyler extends Plugin {
  async onload() {
    this.settings = Object.assign({ custom: [] }, await this.loadData());
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

  // 이 vault에서 노트가 가장 많은 폴더 N개 → 색 그룹 대상
  detectColorFolders(max) {
    const counts = new Map();
    for (const file of this.app.vault.getMarkdownFiles()) {
      const parent = file.parent && file.parent.path;
      if (!parent || parent === '/') continue;
      counts.set(parent, (counts.get(parent) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, max)
      .map((entry) => entry[0]);
  }

  async applyPreset(preset, opts) {
    try {
      await this.backupOnce();
      const folders = preset.colors.length ? this.detectColorFolders(preset.colors.length) : [];
      const colorGroups = folders.length ? makeGroups(folders, preset.colors) : [];
      const graphOptions = Object.assign({}, preset.graph, { colorGroups });
      const merged = await this.writeGraph(graphOptions);
      await this.installSnippet(preset.id, makeGlowCss(preset.palette));
      await this.reloadGraph(merged);
      if (!(opts && opts.silent)) new Notice(L.applied(preset));
    } catch (e) {
      console.error('[graph-styler] apply failed', e);
      new Notice(L.failed);
    }
  }

  async backupOnce() {
    const adapter = this.app.vault.adapter;
    const bak = `${this.graphPath()}.styler-bak`;
    if (!(await adapter.exists(bak)) && (await adapter.exists(this.graphPath()))) {
      await adapter.write(bak, await adapter.read(this.graphPath()));
    }
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

  async reloadGraph(graphOptions) {
    const leaves = this.app.workspace
      .getLeavesOfType('graph')
      .concat(this.app.workspace.getLeavesOfType('localgraph'));
    if (!leaves.length) {
      new Notice(L.openGraph);
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
      const state = leaf.getViewState();
      await leaf.setViewState({ type: 'empty' });
      await leaf.setViewState(state);
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
