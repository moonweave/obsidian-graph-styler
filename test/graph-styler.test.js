const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');

global.window = { localStorage: { getItem: () => '' } };
global.navigator = { language: 'en' };
global.document = {
  head: {
    createEl: () => ({ remove() {} }),
  },
};

class Plugin {
  constructor(app) {
    this.app = app;
  }

  async loadData() { return {}; }
  async saveData() {}
  register() {}
  registerView() {}
  addRibbonIcon() {}
  addCommand() {}
  registerEvent() {}
}

class ItemView {}

const notices = [];
const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'obsidian') return { Plugin, ItemView, Notice: class Notice { constructor(message) { notices.push(message); } } };
  return originalLoad.call(this, request, parent, isMain);
};
const GraphStyler = require(path.join(__dirname, '..', 'main.js'));
Module._load = originalLoad;

function makeHarness() {
  const files = {
    '.obsidian/graph.json': JSON.stringify({
      centerStrength: 0.42,
      repelStrength: 13,
      linkStrength: 0.23,
      linkDistance: 333,
      nodeSizeMultiplier: 1.4,
      textFadeMultiplier: 1.7,
      lineSizeMultiplier: 0.17,
      showTags: false,
      'collapse-color-groups': true,
      'collapse-display': true,
      'collapse-forces': true,
    }),
    '.obsidian/snippets/graph-styler-stale.css': 'stale',
    '.obsidian/appearance.json': JSON.stringify({
      enabledCssSnippets: ['graph-styler-__none__', 'user-snippet', 'graph-styler-neon'],
    }),
  };
  const engineOptions = [];
  const renderCalls = { count: 0 };
  const viewStateCalls = [];
  const cssCalls = [];
  const adapter = {
    exists: async (filePath) => Object.prototype.hasOwnProperty.call(files, filePath),
    read: async (filePath) => files[filePath],
    write: async (filePath, contents) => { files[filePath] = contents; },
    remove: async (filePath) => { delete files[filePath]; },
    mkdir: async () => {},
    list: async (dir) => ({
      files: Object.keys(files).filter((filePath) => filePath.startsWith(`${dir}/`)),
      folders: [],
    }),
  };
  const app = {
    vault: {
      configDir: '.obsidian',
      adapter,
      getMarkdownFiles: () => [{ parent: { path: 'notes' } }],
      on: () => ({}),
    },
    customCss: {
      enabledSnippets: new Set(),
      setCssEnabledStatus(id, enabled) {
        cssCalls.push([id, enabled]);
        if (!this.enabledSnippets) return;
        if (enabled) this.enabledSnippets.add(id);
        else this.enabledSnippets.delete(id);
      },
    },
    workspace: {
      getLeavesOfType: (type) => type === 'graph' ? [{
        view: {
          engine: {
            setOptions: (options) => engineOptions.push(options),
            render() { renderCalls.count += 1; },
          },
        },
        getViewState: () => ({ type: 'graph', state: {} }),
        setViewState: async (state) => { viewStateCalls.push(state); },
      }] : [],
    },
  };
  return { app, files, engineOptions, renderCalls, viewStateCalls, cssCalls };
}

function preset(applyForces) {
  return {
    id: 'test',
    colors: ['#38bdf8'],
    applyForces,
    graph: {
      centerStrength: 0.1,
      repelStrength: 10,
      linkStrength: 1,
      linkDistance: 250,
      nodeSizeMultiplier: 2.1,
      lineSizeMultiplier: 0.17,
      textFadeMultiplier: 1.7,
      showTags: true,
      'collapse-color-groups': false,
      'collapse-display': false,
      'collapse-forces': false,
      colorGroups: [{ query: 'path:"notes"', color: { a: 1, rgb: 1 } }],
    },
    palette: {
      id: 'test', bg1: '#001122', bg2: '#001122', bg3: '#001122',
      circle: '#38bdf8', fill: '#22d3ee', tag: '#818cf8',
      unresolved: '#0c2030', line: '#1f4d6b', text: '#d6f1ff', filter: 'none',
    },
  };
}

async function apply(applyForces) {
  const { app, files, engineOptions, renderCalls, viewStateCalls } = makeHarness();
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  await plugin._doApply(preset(applyForces));
  return { graph: JSON.parse(files['.obsidian/graph.json']), engineOptions, renderCalls, viewStateCalls };
}

async function applyNotices({ graphOpen }) {
  const { app } = makeHarness();
  if (!graphOpen) app.workspace.getLeavesOfType = () => [];
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  notices.length = 0;
  await plugin._doApply(Object.assign(preset(false), { emoji: '*', label: 'Test' }));
  return notices.slice();
}

async function exportScaleAfterLoad(data) {
  const { app } = makeHarness();
  const plugin = new GraphStyler(app);
  const saved = [];
  plugin.loadData = async () => data;
  plugin.saveData = async (settings) => { saved.push(JSON.parse(JSON.stringify(settings))); };
  await plugin.onload();
  return { plugin, saved };
}

function preview(applyForces) {
  const { app, engineOptions, renderCalls } = makeHarness();
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  plugin.previewLive(preset(applyForces));
  return { engineOptions, renderCalls };
}

async function loadDraft() {
  const { app } = makeHarness();
  const plugin = new GraphStyler(app);
  await plugin.onload();
  return plugin.draft;
}

async function loadPreservesCustomData() {
  const { app } = makeHarness();
  const plugin = new GraphStyler(app);
  const saved = {
    custom: [{ id: 'saved-preset', label: 'Saved preset', colors: ['#112233'] }],
    futureField: { keep: true },
  };
  const writes = [];
  let layoutReady = null;
  app.workspace.onLayoutReady = (callback) => { layoutReady = callback(); };
  plugin.loadData = async () => saved;
  plugin.saveData = async (data) => { writes.push(JSON.parse(JSON.stringify(data))); };
  await plugin.onload();
  await layoutReady;
  return { settings: plugin.settings, writes };
}

async function activateSnippet() {
  const { app, cssCalls } = makeHarness();
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  await plugin.setActiveSnippet('neon');
  return Object.fromEntries(cssCalls);
}

async function cleanSentinelSnippet() {
  const { app, files } = makeHarness();
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  await plugin.setActiveSnippet('neon');
  return JSON.parse(files['.obsidian/appearance.json']).enabledCssSnippets;
}

async function disableSnippets() {
  const { app, cssCalls } = makeHarness();
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  await plugin.setActiveSnippet('__none__');
  return Object.fromEntries(cssCalls);
}

async function deleteSnippet() {
  const { app, files, cssCalls } = makeHarness();
  files['.obsidian/snippets/graph-styler-bad-id.css'] = 'generated';
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [{ id: '../../bad id' }] };
  await plugin.deleteCustom('../../bad id');
  return { calls: Object.fromEntries(cssCalls), exists: Object.prototype.hasOwnProperty.call(files, '.obsidian/snippets/graph-styler-bad-id.css') };
}

async function applyRaw(raw) {
  const { app, files } = makeHarness();
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  await plugin.saveCustom(raw);
  return files;
}

async function importCode(code, custom) {
  const { app } = makeHarness();
  const plugin = new GraphStyler(app);
  plugin.settings = { custom };
  const saved = [];
  plugin.saveData = async (data) => { saved.push(JSON.parse(JSON.stringify(data))); };
  const raw = await plugin.importShareCode(code);
  return { raw, saved, custom: plugin.settings.custom };
}

async function restoreWaitsForApply() {
  const { app, files } = makeHarness();
  const graphPath = '.obsidian/graph.json';
  const backupPath = `${graphPath}.styler-bak`;
  files[backupPath] = files[graphPath];
  const graphWrites = [];
  const originalWrite = app.vault.adapter.write;
  app.vault.adapter.write = async (filePath, contents) => {
    if (filePath === graphPath) graphWrites.push(filePath);
    return originalWrite(filePath, contents);
  };
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  let releaseApply;
  plugin._applying = true;
  plugin._applyIdle = new Promise((resolve) => { releaseApply = resolve; });
  const restoring = plugin.restore();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const wroteBeforeApplyFinished = graphWrites.length > 0;
  releaseApply();
  plugin._applying = false;
  await restoring;
  return wroteBeforeApplyFinished;
}

async function applyPreservesExternalGraphChange() {
  const { app, files } = makeHarness();
  const graphPath = '.obsidian/graph.json';
  const originalRead = app.vault.adapter.read;
  let graphReads = 0;
  app.vault.adapter.read = async (filePath) => {
    const contents = await originalRead(filePath);
    if (filePath === graphPath && ++graphReads === 2) {
      const external = JSON.parse(contents);
      external.showTags = true;
      files[graphPath] = JSON.stringify(external);
    }
    return contents;
  };
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  await plugin._doApply(preset(true));
  return JSON.parse(files[graphPath]);
}

async function failedApplyKeepsPreviousLiveStyle() {
  const { app, files } = makeHarness();
  const graphPath = '.obsidian/graph.json';
  const originalRead = app.vault.adapter.read;
  app.vault.adapter.read = async (filePath) => {
    const contents = await originalRead(filePath);
    if (filePath === graphPath && contents) {
      const external = JSON.parse(contents);
      external.showTags = !external.showTags;
      files[graphPath] = JSON.stringify(external);
    }
    return contents;
  };
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  plugin.ensureLiveStyle();
  plugin.liveStyle.textContent = 'previous-css';
  const originalError = console.error;
  console.error = () => {};
  try {
    await plugin._doApply(preset(true));
  } finally {
    console.error = originalError;
  }
  return { liveStyle: plugin.liveStyle.textContent, snippet: files['.obsidian/snippets/graph-styler-test.css'] };
}

async function unloadPlugin() {
  const { app, files, cssCalls } = makeHarness();
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  plugin.ensureLiveStyle();
  plugin.liveStyle.textContent = 'live-css';
  const graphBefore = files['.obsidian/graph.json'];
  await plugin.onunload();
  return {
    graph: files['.obsidian/graph.json'],
    graphBefore,
    liveStyle: plugin.liveStyle,
    calls: Object.fromEntries(cssCalls),
  };
}

const NEON = ['#7dd3fc', '#34d399', '#fbbf24', '#f472b6'];
const groupsFor = (colors) => colors.map((hex, i) => ({ query: `path:"f${i}"`, color: { a: 1, rgb: parseInt(hex.slice(1), 16) } }));

async function loadPlugin({ data, graphGroups, snippets = {}, files: extraFiles = {} }) {
  const { app, files, cssCalls } = makeHarness();
  delete files['.obsidian/snippets/graph-styler-stale.css'];
  const mtimes = {};
  for (const [id, mtime] of Object.entries(snippets)) {
    const snippetPath = `.obsidian/snippets/graph-styler-${id}.css`;
    files[snippetPath] = 'generated';
    mtimes[snippetPath] = mtime;
  }
  Object.assign(files, extraFiles);
  if (graphGroups) {
    const graph = JSON.parse(files['.obsidian/graph.json']);
    graph.colorGroups = graphGroups;
    files['.obsidian/graph.json'] = JSON.stringify(graph);
  }
  app.vault.adapter.stat = async (filePath) => (
    Object.prototype.hasOwnProperty.call(files, filePath) ? { type: 'file', mtime: mtimes[filePath] || 0 } : null
  );
  let layoutReady = null;
  app.workspace.onLayoutReady = (callback) => { layoutReady = callback(); };
  const plugin = new GraphStyler(app);
  const saved = [];
  plugin.loadData = async () => JSON.parse(JSON.stringify(data));
  plugin.saveData = async (settings) => { saved.push(settings.resumeSnippet); };
  await plugin.onload();
  await layoutReady;
  return {
    enabled: cssCalls.filter(([, enabled]) => enabled).map(([id]) => id),
    settings: plugin.settings,
    saved,
    files,
  };
}

async function unloadWith(enabledIds, { withoutEnabledSet = false } = {}) {
  const { app, cssCalls } = makeHarness();
  if (withoutEnabledSet) delete app.customCss.enabledSnippets;
  app.vault.adapter.write('.obsidian/snippets/graph-styler-neon.css', 'generated');
  for (const id of enabledIds) app.customCss.enabledSnippets.add(id);
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [], resumeSnippet: null };
  const saved = [];
  plugin.saveData = async (settings) => { saved.push(settings.resumeSnippet); };
  await plugin.onunload();
  return { saved, calls: Object.fromEntries(cssCalls) };
}

// An update or in-place reload: Obsidian calls the old instance's onunload without awaiting it and
// loads the new instance right away. Both share data.json. The old saveData is held until the new
// instance has read data.json and finished its first restore — the order that left the theme off.
async function reloadRace({ watch = true } = {}) {
  const { app, files } = makeHarness();
  delete files['.obsidian/snippets/graph-styler-stale.css'];
  files['.obsidian/snippets/graph-styler-neon.css'] = 'generated';
  app.customCss.enabledSnippets = new Set(['graph-styler-neon']);
  const dataPath = '.obsidian/plugins/graph-styler/data.json';
  files[dataPath] = JSON.stringify({ custom: [], resumeSnippet: null });
  const listeners = [];
  app.vault.on = (name, callback) => {
    if (name === 'raw' && watch) listeners.push(callback);
    return {};
  };
  let layoutReady = null;
  app.workspace.onLayoutReady = (callback) => { layoutReady = callback(); };
  let releaseOldSave;
  const oldSaveGate = new Promise((resolve) => { releaseOldSave = resolve; });
  const backedBy = (plugin, gate) => {
    plugin.manifest = { dir: '.obsidian/plugins/graph-styler' };
    plugin.loadData = async () => JSON.parse(files[dataPath]);
    plugin.saveData = async (settings) => {
      await gate;
      files[dataPath] = JSON.stringify(settings);
      for (const listener of listeners.slice()) listener(dataPath);
    };
  };
  const oldPlugin = new GraphStyler(app);
  backedBy(oldPlugin, oldSaveGate);
  oldPlugin.settings = { custom: [], resumeSnippet: null };
  const newPlugin = new GraphStyler(app);
  backedBy(newPlugin, null);

  const unloading = oldPlugin.onunload();
  await newPlugin.onload();
  await layoutReady;
  releaseOldSave();
  await unloading;
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
  return {
    enabled: [...app.customCss.enabledSnippets],
    resumeOnDisk: JSON.parse(files[dataPath]).resumeSnippet,
  };
}

async function glowCssFor() {
  const { app, files } = makeHarness();
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  await plugin._doApply(preset(false));
  return files['.obsidian/snippets/graph-styler-test.css'];
}

async function restoreEngineOptions(backup) {
  const { app, files, engineOptions } = makeHarness();
  files['.obsidian/graph.json.styler-bak'] = backup;
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  const originalConfirm = global.window.confirm;
  global.window.confirm = () => true;
  try {
    await plugin.restore();
  } finally {
    global.window.confirm = originalConfirm;
  }
  return { sent: engineOptions[engineOptions.length - 1], graph: files['.obsidian/graph.json'] };
}

// The core graph plugin keeps graph.json in memory and writes it back when a graph leaf is reopened.
// In Obsidian 1.14.4 that write could land before its file watcher saw the new graph.json.
async function coreOptionsAtReopen(run) {
  const { app, files } = makeHarness();
  const core = { options: { colorGroups: [{ query: 'old', color: { a: 1, rgb: 2 } }], nodeSizeMultiplier: 1, search: '' } };
  app.internalPlugins = { plugins: { graph: { instance: core } } };
  const atReopen = [];
  const leaves = app.workspace.getLeavesOfType;
  app.workspace.getLeavesOfType = (type) => leaves(type).map((leaf) => Object.assign(leaf, {
    setViewState: async () => { atReopen.push(JSON.parse(JSON.stringify(core.options))); },
  }));
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  await run(plugin, files);
  return { atReopen, core: core.options };
}

async function backupWithoutGraphJson() {
  const { app, files } = makeHarness();
  const graphPath = '.obsidian/graph.json';
  const backupPath = `${graphPath}.styler-bak`;
  const original = files[graphPath];
  delete files[graphPath];
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  await plugin.backupOnce();
  const missing = { backedUp: plugin._backedUp, hasBackup: backupPath in files };
  files[graphPath] = original;
  await plugin.backupOnce();
  return { missing, backedUp: plugin._backedUp, backup: files[backupPath], original };
}

function fakeCanvas() {
  const drawn = [];
  const filters = { fill: [], draw: [] };
  const ctx = {
    filter: 'none',
    fillRect() { filters.fill.push(ctx.filter); },
    drawImage(source) {
      drawn.push(source);
      filters.draw.push(ctx.filter);
    },
    createRadialGradient: () => ({ addColorStop() {} }),
  };
  return {
    width: 0,
    height: 0,
    drawn,
    filters,
    ctx,
    getContext: () => ctx,
    toBlob: (callback) => callback({ arrayBuffer: async () => new ArrayBuffer(4) }),
  };
}

// Mirrors the Obsidian 1.11 graph renderer fields the export touches. setScale recomputes
// nodeScale/textAlpha and renderCallback re-runs it (updateZoom), as the real renderer does.
class FakeGraphRenderer {
  constructor(maxTexture) {
    const self = this;
    this.view = { width: 200, height: 100 };
    this.px = {
      renderer: {
        width: 200,
        height: 100,
        view: this.view,
        gl: { MAX_TEXTURE_SIZE: 3379, getParameter: () => maxTexture },
        resize(w, h) {
          this.width = w;
          this.height = h;
          self.view.width = w;
          self.view.height = h;
        },
      },
    };
    this.width = 100;
    this.height = 50;
    this.scale = 1.5;
    this.targetScale = 1.5;
    this.panX = 7;
    this.panY = 9;
    this.nodeScale = 0.8;
    this.textAlpha = 0.4;
    this.fLineSizeMult = 1;
    this.idleFrames = 61;
    this.nodes = [{ text: { resolution: 2 } }, { text: { resolution: 2 } }, { rendered: false }];
    this.changedCalls = 0;
    this.during = null;
  }

  setScale(scale) {
    this.scale = scale;
    this.nodeScale = Math.sqrt(1 / scale);
    this.textAlpha = 0;
  }

  setPan(x, y) {
    this.panX = x;
    this.panY = y;
  }

  renderCallback() {
    this.setScale(this.targetScale);
    this.during = rendererState(this);
  }

  changed() { this.changedCalls += 1; }
}

function rendererState(r) {
  return {
    W: r.px.renderer.width, H: r.px.renderer.height, width: r.width, height: r.height,
    scale: r.scale, targetScale: r.targetScale, panX: r.panX, panY: r.panY,
    nodeScale: r.nodeScale, textAlpha: r.textAlpha, line: r.fLineSizeMult, idleFrames: r.idleFrames,
    textResolution: r.nodes.filter((node) => node.text).map((node) => node.text.resolution),
    ownSetScale: Object.prototype.hasOwnProperty.call(r, 'setScale'),
  };
}

async function exportWith(renderer, { filters = new Map(), iframe = null } = {}) {
  const { app } = makeHarness();
  const created = [];
  const canvases = [];
  app.vault.getFiles = () => [];
  app.vault.createBinary = async (filePath) => { created.push(filePath); };
  app.workspace.getLeavesOfType = (type) => (type === 'graph' && renderer
    ? [{ view: { renderer, contentEl: { nodeType: 1, parentElement: null, querySelector: () => iframe } } }] : []);
  const originalCreate = global.document.createElement;
  global.document.createElement = () => {
    const canvas = fakeCanvas();
    canvases.push(canvas);
    return canvas;
  };
  global.window.getComputedStyle = (el) => ({ backgroundColor: 'rgb(30, 30, 30)', filter: filters.get(el) || 'none' });
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  notices.length = 0;
  const originalError = console.error;
  console.error = () => {};
  try {
    await plugin.exportPng(3);
  } finally {
    console.error = originalError;
    global.document.createElement = originalCreate;
  }
  return { created, canvas: canvases[0], notices: notices.slice() };
}

// Which graph leaf the export picks. Each spec: { type, activeTime, hidden, file }.
function graphLeaves(specs) {
  return specs.map((spec) => ({
    spec,
    activeTime: spec.activeTime,
    view: {
      renderer: new FakeGraphRenderer(16384),
      file: spec.file ? { basename: spec.file } : undefined,
      getViewType: () => spec.type,
      contentEl: { nodeType: 1, parentElement: null, clientWidth: spec.hidden ? 0 : 400, querySelector: () => null },
    },
  }));
}

async function exportTargetWith(specs, activeIndex) {
  const { app } = makeHarness();
  const leaves = graphLeaves(specs);
  app.workspace.getLeavesOfType = (type) => leaves.filter((leaf) => leaf.spec.type === type);
  app.workspace.activeLeaf = activeIndex === undefined ? { view: {} } : leaves[activeIndex];
  const created = [];
  app.vault.getFiles = () => [];
  app.vault.createBinary = async (filePath) => { created.push(filePath); };
  const originalCreate = global.document.createElement;
  global.document.createElement = () => fakeCanvas();
  global.window.getComputedStyle = () => ({ backgroundColor: 'rgb(30, 30, 30)', filter: 'none' });
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  notices.length = 0;
  const target = plugin.exportTarget();
  try {
    await plugin.exportPng(1);
  } finally {
    global.document.createElement = originalCreate;
  }
  return { picked: target ? target.spec.type : null, created, notices: notices.slice() };
}

(async () => {
  const visualOnly = await apply(false);
  assert.strictEqual(visualOnly.graph.centerStrength, 0.42);
  assert.strictEqual(visualOnly.graph.repelStrength, 13);
  assert.strictEqual(visualOnly.graph.linkStrength, 0.23);
  assert.strictEqual(visualOnly.graph.linkDistance, 333);
  assert.strictEqual(visualOnly.graph.nodeSizeMultiplier, 1.4);
  assert.strictEqual(visualOnly.graph.textFadeMultiplier, 1.7);
  assert.strictEqual(visualOnly.graph.lineSizeMultiplier, 0.17);
  assert.strictEqual(visualOnly.graph.showTags, false);
  assert.strictEqual(visualOnly.graph['collapse-color-groups'], true);
  assert.strictEqual(visualOnly.graph['collapse-display'], true);
  assert.strictEqual(visualOnly.graph['collapse-forces'], true);
  assert.strictEqual(visualOnly.graph.colorGroups[0].query, 'path:"notes"');
  assert.strictEqual(visualOnly.graph.colorGroups[0].color.rgb, parseInt('38bdf8', 16));
  assert.deepStrictEqual(Object.keys(visualOnly.engineOptions[0]).sort(), ['colorGroups']);
  assert.strictEqual(visualOnly.renderCalls.count, 1);
  assert.deepStrictEqual(visualOnly.viewStateCalls, []);

  const explicitForces = await apply(true);
  assert.strictEqual(explicitForces.graph.centerStrength, 0.1);
  assert.strictEqual(explicitForces.graph.repelStrength, 10);
  assert.strictEqual(explicitForces.graph.linkStrength, 1);
  assert.strictEqual(explicitForces.graph.linkDistance, 250);
  assert.strictEqual(explicitForces.graph.showTags, false);
  assert.strictEqual(explicitForces.graph['collapse-color-groups'], true);
  assert.strictEqual(explicitForces.graph['collapse-display'], true);
  assert.strictEqual(explicitForces.graph['collapse-forces'], true);
  assert.deepStrictEqual(Object.keys(explicitForces.engineOptions[0]).sort(), [
    'centerStrength', 'colorGroups', 'lineSizeMultiplier', 'linkDistance',
    'linkStrength', 'nodeSizeMultiplier', 'repelStrength', 'textFadeMultiplier',
  ]);
  assert.strictEqual(explicitForces.renderCalls.count, 1);
  assert.deepStrictEqual(explicitForces.viewStateCalls, [
    { type: 'empty' },
    { type: 'graph', state: {} },
  ]);

  const visualPreview = preview(false);
  assert.deepStrictEqual(Object.keys(visualPreview.engineOptions[0]).sort(), ['colorGroups']);
  assert.strictEqual(visualPreview.renderCalls.count, 1);
  assert.strictEqual(preview(true).renderCalls.count, 1);

  const currentDraft = await loadDraft();
  assert.deepStrictEqual(currentDraft.forces, {
    node: 1.4,
    repel: 13,
    dist: 333,
    center: 0.42,
    linkS: 0.23,
    line: 0.17,
    fade: 1.7,
  });

  const preservedData = await loadPreservesCustomData();
  assert.deepStrictEqual(preservedData.settings.custom, [{
    id: 'saved-preset', label: 'Saved preset', colors: ['#112233'],
  }]);
  assert.deepStrictEqual(preservedData.settings.futureField, { keep: true });
  // 0.1.7 data is written once (resumeSnippet: null) and keeps every existing field.
  assert.strictEqual(preservedData.writes.length, 1);
  assert.deepStrictEqual(preservedData.writes[0].custom, preservedData.settings.custom);
  assert.deepStrictEqual(preservedData.writes[0].futureField, { keep: true });
  assert.strictEqual(preservedData.writes[0].resumeSnippet, null);

  const activeSnippets = await activateSnippet();
  assert.strictEqual(activeSnippets['graph-styler-neon'], true);
  assert.strictEqual(activeSnippets['graph-styler-stale'], false);

  assert.deepStrictEqual(await cleanSentinelSnippet(), ['user-snippet', 'graph-styler-neon']);

  const disabledSnippets = await disableSnippets();
  assert.strictEqual(disabledSnippets['graph-styler-__none__'], undefined);
  assert.strictEqual(disabledSnippets['graph-styler-stale'], false);

  const deletedSnippets = await deleteSnippet();
  assert.strictEqual(deletedSnippets.calls['graph-styler-bad-id'], false);
  assert.strictEqual(deletedSnippets.exists, false);

  const malformedFiles = await applyRaw({
    id: '../../bad id',
    label: 42,
    colors: 'not-an-array',
    bg: 'not-a-hex',
    glow: Infinity,
    forces: { node: 'bad', repel: 999, dist: 2, center: -1, linkS: 2, line: 99, fade: -5 },
  });
  const malformedGraph = JSON.parse(malformedFiles['.obsidian/graph.json']);
  assert.strictEqual(malformedGraph.nodeSizeMultiplier, 2.2);
  assert.strictEqual(malformedGraph.repelStrength, 20);
  assert.strictEqual(malformedGraph.linkDistance, 30);
  assert.strictEqual(malformedGraph.centerStrength, 0);
  assert.strictEqual(malformedGraph.linkStrength, 1);
  assert.strictEqual(malformedGraph.lineSizeMultiplier, 2);
  assert.strictEqual(malformedGraph.textFadeMultiplier, 0);
  assert.ok(malformedFiles['.obsidian/snippets/graph-styler-bad-id.css']);

  const conflictSafeGraph = await applyPreservesExternalGraphChange();
  assert.strictEqual(conflictSafeGraph.showTags, true);
  assert.strictEqual(conflictSafeGraph.centerStrength, 0.1);

  const failedApply = await failedApplyKeepsPreviousLiveStyle();
  assert.strictEqual(failedApply.liveStyle, 'previous-css');
  assert.strictEqual(failedApply.snippet, undefined);

  const unloaded = await unloadPlugin();
  assert.strictEqual(unloaded.graph, unloaded.graphBefore);
  assert.strictEqual(unloaded.liveStyle, null);
  assert.strictEqual(unloaded.calls['graph-styler-neon'], false);
  assert.strictEqual(unloaded.calls['graph-styler-stale'], false);

  assert.strictEqual(await restoreWaitsForApply(), false);

  // No graph open: only "open a graph view first", never a success notice for a change nobody can see.
  assert.deepStrictEqual(await applyNotices({ graphOpen: false }), ['Open a graph view first']);
  assert.deepStrictEqual(await applyNotices({ graphOpen: true }), ['* Test applied']);

  // Export scale defaults to 2x (3x wrote ~20 MB per file), and the last choice is remembered.
  assert.strictEqual((await exportScaleAfterLoad({})).plugin.exportScale, 2);
  assert.strictEqual((await exportScaleAfterLoad({ exportScale: 4 })).plugin.exportScale, 4);
  assert.strictEqual((await exportScaleAfterLoad({ exportScale: 7 })).plugin.exportScale, 2);
  assert.strictEqual((await exportScaleAfterLoad({ exportScale: '3' })).plugin.exportScale, 2);
  const chosen = await exportScaleAfterLoad({ custom: [{ id: 'keep' }] });
  await chosen.plugin.setExportScale(3);
  assert.strictEqual(chosen.plugin.exportScale, 3);
  assert.strictEqual(chosen.saved[chosen.saved.length - 1].exportScale, 3);
  assert.deepStrictEqual(chosen.saved[chosen.saved.length - 1].custom, [{ id: 'keep' }]);

  // PNG export: scale is clamped to the GL limit and never drops below 1x.
  const { exportScaleLimit, exportFileName } = GraphStyler;
  assert.strictEqual(exportScaleLimit(16384, 1360, 1444, 3), 3);
  assert.strictEqual(exportScaleLimit(16384, 1360, 1444, 20), 11);
  assert.strictEqual(exportScaleLimit(undefined, 1360, 1444, 20), 11);
  assert.strictEqual(exportScaleLimit(4096, 2000, 1000, 4), 2);
  assert.strictEqual(exportScaleLimit(4096, 5000, 1000, 4), 1);
  const at = new Date(2026, 9, 8, 7, 5);
  assert.strictEqual(exportFileName('neon', at, []), 'graph-neon-20261008-0705.png');
  assert.strictEqual(exportFileName(null, at, []), 'graph-graph-20261008-0705.png');
  assert.strictEqual(exportFileName('../bad id', at, []), 'graph-bad-id-20261008-0705.png');
  assert.strictEqual(exportFileName('neon', at, ['graph-neon-20261008-0705.png']), 'graph-neon-20261008-0705-2.png');
  assert.strictEqual(exportFileName('neon', at, ['graph-neon-20261008-0705.png', 'graph-neon-20261008-0705-2.png']),
    'graph-neon-20261008-0705-3.png');

  // Local graph exports carry the note name; characters files and links refuse become '-'.
  const { exportNoteName } = GraphStyler;
  assert.strictEqual(exportNoteName('Smith 2017: Fatigue/57 #a [x]'), 'Smith-2017-Fatigue-57-a-x');
  assert.strictEqual(exportNoteName('밤하늘 노트'), '밤하늘-노트');
  assert.strictEqual(exportNoteName('..hidden.'), 'hidden');
  assert.strictEqual(exportNoteName(undefined), '');
  assert.strictEqual(exportNoteName('a'.repeat(80)).length, 60);
  assert.strictEqual(exportFileName('neon', at, [], '밤하늘 노트'), 'graph-neon-밤하늘-노트-20261008-0705.png');
  assert.strictEqual(exportFileName(null, at, [], '???'), 'graph-graph-20261008-0705.png');

  // Target: the active graph leaf (command palette), else the most recently active visible one (panel
  // button), else the global graph first as in 0.2.0; with none, say which graph to open.
  const globalAndLocal = (globalTime, localTime, localHidden) => [
    { type: 'graph', activeTime: globalTime },
    { type: 'localgraph', activeTime: localTime, hidden: localHidden, file: 'Actuator note 3' },
  ];
  const activeLocal = await exportTargetWith(globalAndLocal(20, 10), 1);
  assert.strictEqual(activeLocal.picked, 'localgraph');
  assert.ok(/^graph-graph-Actuator-note-3-\d{8}-\d{4}\.png$/.test(activeLocal.created[0]), activeLocal.created[0]);
  assert.strictEqual((await exportTargetWith(globalAndLocal(10, 20))).picked, 'localgraph');
  const recentGlobal = await exportTargetWith(globalAndLocal(20, 10));
  assert.strictEqual(recentGlobal.picked, 'graph');
  assert.ok(/^graph-graph-\d{8}-\d{4}\.png$/.test(recentGlobal.created[0]), recentGlobal.created[0]);
  assert.strictEqual((await exportTargetWith(globalAndLocal(10, 20, true))).picked, 'graph');
  assert.strictEqual((await exportTargetWith(globalAndLocal(undefined, undefined))).picked, 'graph');
  assert.strictEqual((await exportTargetWith([{ type: 'localgraph', hidden: true, file: 'x' }])).picked, 'localgraph');
  const none = await exportTargetWith([]);
  assert.strictEqual(none.picked, null);
  assert.deepStrictEqual(none.notices, ["Open the graph view or a note's local graph first"]);

  // With the private renderer API, the graph is redrawn at k× and every field is put back.
  const hiRes = new FakeGraphRenderer(16384);
  const before = rendererState(hiRes);
  const hiResExport = await exportWith(hiRes);
  assert.deepStrictEqual(rendererState(hiRes), before);
  assert.strictEqual(hiRes.changedCalls, 1);
  assert.deepStrictEqual(hiRes.during, Object.assign({}, before, {
    W: 600, H: 300, width: 300, height: 150, scale: 4.5, targetScale: 4.5, panX: 21, panY: 27,
    line: 3, idleFrames: 0, textResolution: [6, 6], ownSetScale: true,
  }));
  assert.strictEqual(hiResExport.created.length, 1);
  assert.ok(/^graph-graph-\d{8}-\d{4}\.png$/.test(hiResExport.created[0]));
  assert.deepStrictEqual([hiResExport.canvas.width, hiResExport.canvas.height], [600, 300]);
  assert.strictEqual(hiResExport.canvas.drawn[0], hiRes.view);
  assert.deepStrictEqual(hiResExport.notices, [`🖼️ Saved ${hiResExport.created[0]} (600×300)`]);

  // The graph layer gets the filter of the element that draws it on screen (the iframe), so the
  // glow in the file matches the screen; the background is painted without it.
  const glow = 'brightness(1.25) contrast(1.15) saturate(1.5)';
  const framed = new FakeGraphRenderer(16384);
  const frame = {};
  framed.view.ownerDocument = { defaultView: { frameElement: frame } };
  const glowExport = await exportWith(framed, { filters: new Map([[frame, glow], [framed.view, 'blur(9px)']]) });
  assert.deepStrictEqual(glowExport.canvas.filters.draw, [glow]);
  assert.ok(glowExport.canvas.filters.fill.length > 0);
  assert.ok(glowExport.canvas.filters.fill.every((f) => f === 'none'));
  assert.strictEqual(glowExport.canvas.ctx.filter, 'none');
  // No filter on screen (Restore, or a snippet that targets an element that does not draw) → none in the file.
  assert.deepStrictEqual(hiResExport.canvas.filters.draw, ['none']);
  // Fallback screenshots take the filter from the graph iframe.
  const fallbackFrame = {};
  const fallbackGlow = await exportWith({ getTransparentScreenshot: () => ({ width: 50, height: 20 }) },
    { iframe: fallbackFrame, filters: new Map([[fallbackFrame, glow]]) });
  assert.deepStrictEqual(fallbackGlow.canvas.filters.draw, [glow]);

  // The GL texture limit caps the scale.
  const capped = await exportWith(new FakeGraphRenderer(400));
  assert.deepStrictEqual([capped.canvas.width, capped.canvas.height], [400, 200]);
  assert.strictEqual(capped.notices[0], '3x is too large for this graph view — saved at 2x');

  // Chromium shrinks an oversized WebGL drawing buffer by area without an error, which shifted and
  // cropped the 4x export. The scale drops until the buffer holds the whole canvas.
  const shrinking = new FakeGraphRenderer(16384);
  const area = 100000;
  Object.defineProperties(shrinking.px.renderer.gl, {
    drawingBufferWidth: { get: () => Math.floor(shrinking.view.width * Math.min(1, Math.sqrt(area / (shrinking.view.width * shrinking.view.height)))) },
    drawingBufferHeight: { get: () => Math.floor(shrinking.view.height * Math.min(1, Math.sqrt(area / (shrinking.view.width * shrinking.view.height)))) },
  });
  const shrinkingBefore = rendererState(shrinking);
  const shrunk = await exportWith(shrinking);
  assert.deepStrictEqual([shrunk.canvas.width, shrunk.canvas.height], [400, 200]);
  assert.strictEqual(shrinking.during.panX, 14);
  assert.deepStrictEqual(shrinking.during.textResolution, [4, 4]);
  assert.deepStrictEqual(rendererState(shrinking), shrinkingBefore);
  assert.deepStrictEqual(shrunk.notices, ['3x is too large for this graph view — saved at 2x', `🖼️ Saved ${shrunk.created[0]} (400×200)`]);

  // A failure mid-render still restores the renderer and saves nothing.
  const broken = new FakeGraphRenderer(16384);
  const brokenBefore = rendererState(broken);
  broken.renderCallback = () => { throw new Error('render failed'); };
  const brokenExport = await exportWith(broken);
  delete broken.renderCallback;
  assert.deepStrictEqual(rendererState(broken), brokenBefore);
  assert.deepStrictEqual(brokenExport.created, []);
  assert.deepStrictEqual(brokenExport.notices, ['PNG export failed — open the console (Cmd+Opt+I) to see why']);

  // Without the private API the export falls back to the screen-resolution screenshot and says so.
  const shot = { width: 50, height: 20 };
  const transparentOnly = await exportWith({ getTransparentScreenshot: () => shot });
  assert.strictEqual(transparentOnly.canvas.drawn[0], shot);
  assert.deepStrictEqual([transparentOnly.canvas.width, transparentOnly.canvas.height], [50, 20]);
  assert.strictEqual(transparentOnly.created.length, 1);
  assert.strictEqual(transparentOnly.notices[0], 'High-resolution export unavailable — saved at screen resolution');
  const noText = new FakeGraphRenderer(16384);
  noText.nodes = [{ rendered: false }];
  noText.getTransparentScreenshot = () => shot;
  const noTextExport = await exportWith(noText);
  assert.strictEqual(noTextExport.canvas.drawn[0], shot);
  assert.strictEqual(noText.changedCalls, 0);
  const backgroundOnly = await exportWith({ getBackgroundScreenshot: () => shot });
  assert.strictEqual(backgroundOnly.canvas.drawn[0], shot);
  assert.strictEqual(backgroundOnly.notices[0], 'High-resolution export unavailable — saved at screen resolution');
  const noApi = await exportWith({});
  assert.deepStrictEqual(noApi.created, []);
  assert.deepStrictEqual(noApi.notices, ['PNG export failed — open the console (Cmd+Opt+I) to see why']);
  assert.deepStrictEqual((await exportWith(null)).notices, ["Open the graph view or a note's local graph first"]);

  // Only what onunload itself switched off is switched back on, once.
  assert.deepStrictEqual(await loadPlugin({ data: { custom: [], resumeSnippet: 'neon' }, snippets: { neon: 1 } }).then(
    ({ enabled, saved }) => ({ enabled, saved })), { enabled: ['graph-styler-neon'], saved: [null] });
  assert.deepStrictEqual(await loadPlugin({ data: { custom: [], resumeSnippet: null }, snippets: { neon: 1 } }).then(
    ({ enabled, saved }) => ({ enabled, saved })), { enabled: [], saved: [] });
  assert.deepStrictEqual((await loadPlugin({ data: { custom: [], resumeSnippet: 'neon' } })).enabled, []);

  // Update / in-place reload: the old instance switches the snippet off and records it only after the
  // new instance has loaded. Without watching data.json the theme stays off until Obsidian restarts.
  assert.deepStrictEqual(await reloadRace({ watch: false }), { enabled: [], resumeOnDisk: 'neon' });
  assert.deepStrictEqual(await reloadRace(), { enabled: ['graph-styler-neon'], resumeOnDisk: null });

  // A snippet written by an older version (dead .graph-view-content rules) is rewritten on load.
  const olderSnippet = '/* graph-styler :: neon (auto-generated) */\n.theme-dark .graph-view-content { background: none; }\n';
  const refreshed = await loadPlugin({
    data: { custom: [], resumeSnippet: 'neon' },
    snippets: { neon: 1 },
    files: { '.obsidian/snippets/graph-styler-neon.css': olderSnippet },
  });
  const neonCss = refreshed.files['.obsidian/snippets/graph-styler-neon.css'];
  assert.ok(neonCss.includes('graph-styler :: neon'));
  assert.ok(neonCss.includes('.view-content > iframe'));
  assert.ok(neonCss.includes('.view-content > canvas'));
  assert.ok(!neonCss.includes('graph-view-content'));
  // 0.1.9 put the glow only on the input overlay canvas; its enabled snippet is rewritten on load as well.
  const snippet019 = neonCss.split('\n').filter((line) => !line.includes('> iframe')).join('\n');
  const from019 = await loadPlugin({
    data: { custom: [], resumeSnippet: 'neon' },
    snippets: { neon: 1 },
    files: { '.obsidian/snippets/graph-styler-neon.css': snippet019 },
  });
  assert.strictEqual(from019.files['.obsidian/snippets/graph-styler-neon.css'], neonCss);
  // Hand-edited files (no generated header) are left alone; CRLF-only differences are not rewritten.
  const handEdited = await loadPlugin({
    data: { custom: [], resumeSnippet: 'neon' },
    snippets: { neon: 1 },
    files: { '.obsidian/snippets/graph-styler-neon.css': '/* my own tweak */ .x { color: red; }' },
  });
  assert.strictEqual(handEdited.files['.obsidian/snippets/graph-styler-neon.css'], '/* my own tweak */ .x { color: red; }');
  const crlf = refreshed.files['.obsidian/snippets/graph-styler-neon.css'].replace(/\n/g, '\r\n');
  const crlfReload = await loadPlugin({
    data: { custom: [], resumeSnippet: 'neon' },
    snippets: { neon: 1 },
    files: { '.obsidian/snippets/graph-styler-neon.css': crlf },
  });
  assert.strictEqual(crlfReload.files['.obsidian/snippets/graph-styler-neon.css'], crlf);
  // A snippet that is not enabled is left alone.
  const untouched = await loadPlugin({ data: { custom: [], resumeSnippet: null }, snippets: { neon: 1 } });
  assert.strictEqual(untouched.files['.obsidian/snippets/graph-styler-neon.css'], 'generated');

  const unloadEnabled = await unloadWith(['graph-styler-neon']);
  assert.deepStrictEqual(unloadEnabled.saved, ['neon']);
  assert.strictEqual(unloadEnabled.calls['graph-styler-neon'], false);
  // The user had switched the snippet off in Settings → Appearance: nothing to resume.
  assert.deepStrictEqual((await unloadWith([])).saved, []);
  // Without the internal Set, appearance.json (harness: graph-styler-neon enabled) is the fallback.
  assert.deepStrictEqual((await unloadWith([], { withoutEnabledSet: true })).saved, ['neon']);

  // 0.1.7 → 0.1.8: no record, so the preset whose colours match graph.json is the one that was on.
  const migrated = await loadPlugin({ data: { custom: [] }, graphGroups: groupsFor(NEON.slice(0, 3)), snippets: { neon: 1, galaxy: 2 } });
  assert.deepStrictEqual(migrated.enabled, ['graph-styler-neon']);
  assert.deepStrictEqual(migrated.saved, [null]);
  // Restored (or hand-edited) colour groups match no preset.
  const restoredBefore = await loadPlugin({ data: { custom: [] }, graphGroups: groupsFor(['#123456']), snippets: { neon: 1 } });
  assert.deepStrictEqual(restoredBefore.enabled, []);
  assert.deepStrictEqual(restoredBefore.saved, [null]);
  assert.deepStrictEqual((await loadPlugin({ data: { custom: [] }, snippets: { neon: 1 } })).enabled, []);
  // The guess runs once: a later launch with the saved record never re-guesses, even if colours match again.
  const relaunch = await loadPlugin({ data: { custom: [], resumeSnippet: null }, graphGroups: groupsFor(NEON), snippets: { neon: 1 } });
  assert.deepStrictEqual({ enabled: relaunch.enabled, saved: relaunch.saved }, { enabled: [], saved: [] });
  // Two presets with the same colours: the snippet written last wins.
  const tie = await loadPlugin({
    data: { custom: [{ id: 'mine', label: 'Mine', colors: NEON }] },
    graphGroups: groupsFor(NEON),
    snippets: { neon: 1, mine: 5 },
  });
  assert.deepStrictEqual(tie.enabled, ['graph-styler-mine']);

  // Presets are a full look: every rule applies in both themes, never unscoped.
  const glowCss = (await glowCssFor()).replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = glowCss.split('}')
    .filter((block) => block.includes('{'))
    .flatMap((block) => block.split('{')[0].split(',').map((selector) => selector.trim()));
  assert.ok(selectors.length >= 20);
  for (const selector of selectors) {
    assert.ok(/^\.theme-(dark|light) /.test(selector), `unscoped rule: ${selector}`);
  }
  const darkSelectors = selectors.filter((s) => s.startsWith('.theme-dark ')).map((s) => s.slice('.theme-dark '.length));
  const lightSelectors = selectors.filter((s) => s.startsWith('.theme-light ')).map((s) => s.slice('.theme-light '.length));
  assert.deepStrictEqual(lightSelectors, darkSelectors);
  // The background and glow target the graph pane that exists in Obsidian 1.x (.view-content of a
  // graph/localgraph leaf), never the whole leaf (view header) and never the absent .graph-view-content.
  for (const type of ['graph', 'localgraph']) {
    assert.ok(darkSelectors.includes(`.workspace-leaf-content[data-type="${type}"] .view-content`));
    assert.ok(darkSelectors.includes(`.workspace-leaf-content[data-type="${type}"] .view-content > iframe`));
    assert.ok(darkSelectors.includes(`.workspace-leaf-content[data-type="${type}"] .view-content > canvas`));
    assert.ok(!darkSelectors.includes(`.workspace-leaf-content[data-type="${type}"]`));
  }
  assert.ok(!glowCss.includes('graph-view-content'));
  assert.ok(darkSelectors.includes('.graph-view.color-text'));

  // Applying a custom preset reopens the graph leaf; the core plugin must already hold the new
  // groups and forces, or it writes the previous preset back over them.
  const reopened = await coreOptionsAtReopen((plugin) => plugin._doApply(preset(true)));
  assert.ok(reopened.atReopen.length > 0);
  for (const options of reopened.atReopen) {
    assert.deepStrictEqual(options.colorGroups, [{ query: 'path:"notes"', color: { a: 1, rgb: 0x38bdf8 } }]);
    assert.strictEqual(options.nodeSizeMultiplier, 2.1);
    assert.strictEqual(options.search, '');
  }
  const restoredCore = await coreOptionsAtReopen(async (plugin, files) => {
    files['.obsidian/graph.json.styler-bak'] = JSON.stringify({ repelStrength: 3 });
    const originalConfirm = global.window.confirm;
    global.window.confirm = () => true;
    try {
      await plugin.restore();
    } finally {
      global.window.confirm = originalConfirm;
    }
  });
  assert.deepStrictEqual(restoredCore.core.colorGroups, []);
  assert.strictEqual(restoredCore.core.repelStrength, 3);

  // A vault without graph.json is on Obsidian defaults; Restore must return there.
  const backup = await backupWithoutGraphJson();
  assert.deepStrictEqual(backup.missing, { backedUp: true, hasBackup: true });
  assert.strictEqual(backup.backup, '{}');

  const restoredWithoutGroups = await restoreEngineOptions('{"centerStrength":0.42}');
  assert.deepStrictEqual(restoredWithoutGroups.sent, { colorGroups: [], centerStrength: 0.42 });
  assert.strictEqual(restoredWithoutGroups.graph, '{"centerStrength":0.42}');
  const groups = [{ query: 'tag:#a', color: { a: 1, rgb: 1 } }];
  const restoredWithGroups = await restoreEngineOptions(JSON.stringify({ colorGroups: groups }));
  assert.deepStrictEqual(restoredWithGroups.sent.colorGroups, groups);

  // Share codes: one line, round-trips the sanitized preset (Korean labels included), never the id.
  const { encodeShareCode, decodeShareCode } = GraphStyler;
  const shared = {
    id: 'custom-1700000000000',
    label: '  밤하늘 Night  ',
    colors: ['#112233', '#445566', '#778899', '#aabbcc'],
    bg: '#010203',
    glow: 55,
    forces: { node: 1.5, repel: 9, dist: 210, center: 0.3, linkS: 0.4, line: 0.6, fade: 2 },
  };
  const code = encodeShareCode(shared);
  assert.ok(/^gs1\.[A-Za-z0-9_-]+$/.test(code), code);
  const decoded = decodeShareCode(code);
  assert.deepStrictEqual(decoded, {
    label: '밤하늘 Night',
    colors: shared.colors,
    bg: shared.bg,
    glow: 55,
    forces: shared.forces,
  });
  assert.deepStrictEqual(decodeShareCode(`  ${code}\n`), decoded);
  // Exported codes are always valid: a hand-edited bad colour is replaced before encoding.
  assert.strictEqual(decodeShareCode(encodeShareCode({ colors: ['red'], glow: 'x' })).colors[0], '#7dd3fc');
  assert.strictEqual(decodeShareCode(encodeShareCode({ colors: ['red'], glow: 'x' })).glow, 40);

  assert.strictEqual(decodeShareCode(code.replace('gs1.', 'gs2.')), null);
  assert.strictEqual(decodeShareCode(code.slice(4)), null);
  assert.strictEqual(decodeShareCode(''), null);
  assert.strictEqual(decodeShareCode(undefined), null);
  assert.strictEqual(decodeShareCode('gs1.not base64!'), null);
  assert.strictEqual(decodeShareCode(code.slice(0, -7)), null);
  assert.strictEqual(decodeShareCode(`gs1.${Buffer.from('{"v":1').toString('base64url')}`), null);
  // A code damaged inside the label is refused rather than imported with replacement characters.
  const badUtf8 = Buffer.concat([Buffer.from('{"v":1,"label":"'), Buffer.from([0xed, 0x95]), Buffer.from('"}')]);
  assert.strictEqual(decodeShareCode(`gs1.${badUtf8.toString('base64url')}`), null);
  assert.strictEqual(decodeShareCode(`gs1.${Buffer.from('{"v":2,"label":"x"}').toString('base64url')}`), null);
  assert.strictEqual(decodeShareCode(`gs1.${Buffer.from('null').toString('base64url')}`), null);

  // A hostile or hand-made code is clamped on import, never rejected for being out of range.
  const wild = `gs1.${Buffer.from(JSON.stringify({
    v: 1, id: '../../evil', label: 'Wild', colors: ['#zzzzzz', 'url(x)'], bg: 'red;}', glow: 999,
    forces: { node: 99, repel: -5, dist: 1e9, center: 7, linkS: -1, line: 0, fade: 40, extra: 1 },
  })).toString('base64url')}`;
  const imported = await importCode(wild, []);
  assert.deepStrictEqual(imported.raw, {
    id: 'Wild',
    label: 'Wild',
    colors: ['#7dd3fc', '#34d399', '#8899aa', '#8899aa'],
    bg: '#0b1624',
    glow: 100,
    forces: { node: 4, repel: 0, dist: 500, center: 1, linkS: 0, line: 0.1, fade: 3 },
  });
  assert.strictEqual(imported.saved.length, 1);
  assert.deepStrictEqual(imported.saved[0].custom, [imported.raw]);

  // Fresh id from the label; collisions get -2, -3 …, case-insensitively and against built-ins.
  const existing = [{ id: 'Wild' }, { id: 'wild-2' }];
  assert.strictEqual((await importCode(wild, existing)).raw.id, 'Wild-3');
  const neonCode = encodeShareCode({ label: 'NEON' });
  assert.strictEqual((await importCode(neonCode, [])).raw.id, 'NEON-2');
  assert.strictEqual((await importCode(encodeShareCode({ label: '__none__' }), [])).raw.id, '__none__-2');
  assert.strictEqual((await importCode(code, [])).raw.id, 'Night');
  assert.strictEqual((await importCode(encodeShareCode({ label: '밤하늘' }), [{ id: 'shared' }])).raw.id, 'shared-2');

  // Copy writes the code to the clipboard; a refused clipboard only shows a notice.
  const clipboard = [];
  Object.defineProperty(global, 'navigator', {
    value: { language: 'en', clipboard: { writeText: async (text) => { clipboard.push(text); } } },
    configurable: true,
  });
  const copier = new GraphStyler(makeHarness().app);
  await copier.copyShareCode(shared);
  assert.deepStrictEqual(clipboard, [code]);
  global.navigator.clipboard.writeText = async () => { throw new Error('denied'); };
  const consoleError = console.error;
  console.error = () => {};
  await copier.copyShareCode(shared);
  console.error = consoleError;

  const rejected = await importCode('gs1.@@', [{ id: 'keep' }]);
  assert.strictEqual(rejected.raw, null);
  assert.deepStrictEqual(rejected.saved, []);
  assert.deepStrictEqual(rejected.custom, [{ id: 'keep' }]);
})();
