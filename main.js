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

// 이 vault의 폴더 기반 색 그룹 (쿼리는 공통, 색은 프리셋마다 다름).
// 배포용으로 일반화할 땐 태그 기반/사용자 매핑으로 교체.
const GROUP_QUERIES = [
  'path:"wiki/concepts"',
  'path:"wiki/research"',
  'path:"wiki/meta"',
  'path:"wiki/general"',
];

function hexToRgbInt(hex) {
  return parseInt(hex.replace('#', ''), 16);
}

function makeGroups(colors) {
  return GROUP_QUERIES.map((query, i) => ({
    query,
    color: { a: 1, rgb: hexToRgbInt(colors[i % colors.length]) },
  }));
}

function makeGlowCss(p) {
  return `/* graph-styler :: ${p.id} (자동 생성) */
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

function graph(colors, o) {
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
    colorGroups: colors.length ? makeGroups(colors) : [],
  });
}

// id, 라벨, 이모지, 그룹색[4], forces, 배경[3], 테마색
function P(id, label, emoji, colors, forces, bg, theme) {
  const palette = {
    id, bg1: bg[0], bg2: bg[1], bg3: bg[2],
    circle: theme.circle, fill: theme.fill, tag: theme.tag,
    unresolved: theme.unresolved || '#1e293b', line: theme.line,
    text: theme.text, filter: theme.filter,
  };
  return {
    id, label, emoji,
    swatch: colors.length ? colors : [theme.circle, theme.fill, theme.tag, theme.line],
    graph: graph(colors, forces || {}),
    palette,
  };
}

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
    ['#fb923c', '#f472b6', '#fbbf24', '#fca5a5'], { node: 2.3, repel: 16, dist: 135 },
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
    ['#a3e635', '#4ade80', '#34d399', '#bef264'],
    { node: 2.0, repel: 13, dist: 115, center: 0.18, linkS: 0.35 },
    ['rgba(17,36,15,0.92)', 'rgba(12,26,11,0.97)', '#060d06'],
    { circle: '#a3e635', fill: '#4ade80', tag: '#bef264', line: '#2f5a2a', text: '#e6ffd6',
      unresolved: '#16240f', filter: 'brightness(1.2) contrast(1.1) saturate(1.4)' }),

  candy: P('candy', 'Candy', '🍬',
    ['#f9a8d4', '#a7f3d0', '#c4b5fd', '#fde68a'],
    { node: 2.1, repel: 13, dist: 115, center: 0.18, linkS: 0.35 },
    ['rgba(42,35,54,0.92)', 'rgba(31,26,43,0.97)', '#14111c'],
    { circle: '#f9a8d4', fill: '#a7f3d0', tag: '#c4b5fd', line: '#5a4f6b', text: '#fff0fa',
      unresolved: '#241f2e', filter: 'brightness(1.25) contrast(1.05) saturate(1.35)' }),

  gold: P('gold', 'Gold', '✨',
    ['#fcd34d', '#fbbf24', '#f59e0b', '#fde68a'], { node: 2.5, repel: 16, dist: 140 },
    ['rgba(36,27,8,0.92)', 'rgba(24,18,10,0.97)', '#0c0904'],
    { circle: '#fcd34d', fill: '#fbbf24', tag: '#fde68a', line: '#6b5320', text: '#fff6dc',
      unresolved: '#241b08', filter: 'brightness(1.28) contrast(1.15) saturate(1.4)' }),

  cyber: P('cyber', 'Cyberpunk', '👾',
    ['#39ff14', '#ff2bd6', '#16f0ff', '#fdff3a'], { node: 2.4, repel: 18, dist: 150 },
    ['rgba(0,16,5,0.95)', 'rgba(0,10,8,0.98)', '#000000'],
    { circle: '#16f0ff', fill: '#39ff14', tag: '#ff2bd6', line: '#0c5a3a', text: '#d8ffe8',
      unresolved: '#07140d', filter: 'brightness(1.4) contrast(1.25) saturate(1.7)' }),

  mono: P('mono', 'Mono', '⚪',
    [], { tags: false, node: 1.6, repel: 12, dist: 100, center: 0.2, linkS: 0.4, fade: 1.0, line: 0.2 },
    ['rgba(24,24,27,0.9)', 'rgba(15,15,17,0.97)', '#0a0a0b'],
    { circle: '#e4e4e7', fill: '#a1a1aa', tag: '#71717a', line: '#3f3f46', text: '#fafafa',
      unresolved: '#27272a', filter: 'brightness(1.1) contrast(1.05) saturate(1.0)' }),
};

class StylerView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return 'Graph Styler';
  }

  getIcon() {
    return 'palette';
  }

  async onOpen() {
    const c = this.contentEl;
    c.empty();
    c.style.padding = '14px';
    c.createEl('h3', { text: '🎨 Graph Styler' });
    c.createEl('p', {
      text: '프리셋을 누르면 그래프가 바로 바뀝니다. 패널은 열어둔 채 그래프를 움직여도 됩니다.',
      cls: 'setting-item-description',
    });

    const col = c.createDiv();
    col.style.display = 'flex';
    col.style.flexDirection = 'column';
    col.style.gap = '6px';
    col.style.margin = '14px 0';

    for (const key of Object.keys(PRESETS)) {
      const preset = PRESETS[key];
      const btn = col.createEl('button');
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.gap = '10px';
      btn.style.padding = '11px 12px';
      btn.style.cursor = 'pointer';
      btn.style.textAlign = 'left';

      const swatch = btn.createSpan();
      swatch.style.display = 'inline-flex';
      swatch.style.gap = '3px';
      swatch.style.flexShrink = '0';
      for (const color of preset.swatch) {
        const dot = swatch.createSpan();
        dot.style.width = '12px';
        dot.style.height = '12px';
        dot.style.borderRadius = '50%';
        dot.style.background = color;
        dot.style.boxShadow = `0 0 5px ${color}`;
      }

      btn.createSpan({ text: `${preset.emoji}  ${preset.label}` });
      btn.onclick = () => this.plugin.applyPreset(preset);
    }

    const restore = c.createEl('button', { text: '↩︎ 원래대로 되돌리기' });
    restore.style.width = '100%';
    restore.style.marginTop = '6px';
    restore.onclick = () => this.plugin.restore();

    const credit = c.createDiv();
    credit.style.marginTop = '16px';
    credit.style.fontSize = '12px';
    credit.style.opacity = '0.6';
    credit.style.textAlign = 'center';
    credit.createSpan({ text: 'made by ' });
    const link = credit.createEl('a', { text: AUTHOR, href: AUTHOR_URL });
    link.setAttr('target', '_blank');
    link.setAttr('rel', 'noopener');
  }

  async onClose() {}
}

module.exports = class GraphStyler extends Plugin {
  async onload() {
    this.registerView(VIEW_TYPE, (leaf) => new StylerView(leaf, this));
    this.addRibbonIcon('palette', 'Graph Styler', () => this.activateView());
    this.addCommand({
      id: 'open-graph-styler',
      name: 'Graph Styler 패널 열기',
      callback: () => this.activateView(),
    });
    for (const key of Object.keys(PRESETS)) {
      const preset = PRESETS[key];
      this.addCommand({
        id: `apply-${key}`,
        name: `적용: ${preset.label}`,
        callback: () => this.applyPreset(preset),
      });
    }
    console.log('[graph-styler] loaded');
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  graphPath() {
    return `${this.app.vault.configDir}/graph.json`;
  }

  async applyPreset(preset) {
    try {
      await this.backupOnce();
      await this.writeGraph(preset.graph);
      await this.installSnippet(preset.id, makeGlowCss(preset.palette));
      await this.reloadGraph(preset.graph);
      new Notice(`${preset.emoji} ${preset.label} 적용 완료`);
    } catch (e) {
      console.error('[graph-styler] apply failed', e);
      new Notice('적용 실패 — 콘솔(Cmd+Opt+I) 확인');
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
    await adapter.write(this.graphPath(), JSON.stringify(Object.assign(current, graphOptions), null, 2));
  }

  async installSnippet(presetId, css) {
    const adapter = this.app.vault.adapter;
    const dir = `${this.app.vault.configDir}/snippets`;
    if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
    await adapter.write(`${dir}/graph-styler-${presetId}.css`, css);

    const customCss = this.app.customCss;
    try {
      if (customCss && customCss.readSnippets) await customCss.readSnippets();
      if (customCss && customCss.setCssEnabledStatus) {
        for (const key of Object.keys(PRESETS)) {
          customCss.setCssEnabledStatus(`graph-styler-${key}`, key === presetId);
        }
      }
    } catch (e) {
      console.warn('[graph-styler] snippet auto-enable failed; 설정→CSS 스니펫에서 수동 토글', e);
    }
  }

  async reloadGraph(graphOptions) {
    const leaves = this.app.workspace
      .getLeavesOfType('graph')
      .concat(this.app.workspace.getLeavesOfType('localgraph'));
    if (!leaves.length) {
      new Notice('그래프 뷰를 먼저 열어주세요');
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
          console.warn('[graph-styler] engine.setOptions 실패 → leaf 리로드로 폴백', e);
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
      new Notice('백업이 없어요');
      return;
    }
    await adapter.write(this.graphPath(), await adapter.read(bak));
    const customCss = this.app.customCss;
    if (customCss && customCss.setCssEnabledStatus) {
      for (const key of Object.keys(PRESETS)) {
        customCss.setCssEnabledStatus(`graph-styler-${key}`, false);
      }
    }
    await this.reloadGraph({});
    new Notice('↩︎ 원래대로 복구함');
  }
};
