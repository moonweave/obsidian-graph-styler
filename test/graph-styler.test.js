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
// Notices built from a fragment (the export notice with its buttons) are recorded by their first line;
// the fragment itself and the duration are kept for the button checks.
const noticeLog = [];
const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'obsidian') {
    return {
      Plugin, ItemView, Platform: { isMacOS: true },
      Notice: class Notice {
        constructor(message, duration) {
          notices.push(typeof message === 'string' ? message : message.children[0].text);
          noticeLog.push({ message, duration });
        }
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const GraphStyler = require(path.join(__dirname, '..', 'main.js'));
const stubbedLoad = Module._load;
Module._load = originalLoad;

// A second copy of the plugin whose panel strings follow the given Obsidian language.
function loadGraphStylerIn(language) {
  const file = path.join(__dirname, '..', 'main.js');
  const navigatorBefore = global.navigator;
  Object.defineProperty(global, 'navigator', { value: { language }, configurable: true });
  Module._load = stubbedLoad;
  delete require.cache[file];
  try {
    return require(file);
  } finally {
    Module._load = originalLoad;
    delete require.cache[file];
    Object.defineProperty(global, 'navigator', { value: navigatorBefore, configurable: true });
  }
}

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
// A custom preset saved with "Include filters and display": applied, then restored.
async function fullViewApply(view) {
  const { app, files, engineOptions } = makeHarness();
  const localSent = [];
  const graphLeaves = app.workspace.getLeavesOfType;
  const localLeaf = { view: { engine: { setOptions: (options) => localSent.push(options) } },
    getViewState: () => ({ type: 'localgraph', state: {} }), setViewState: async () => {} };
  app.workspace.getLeavesOfType = (type) => (type === 'localgraph' ? [localLeaf] : graphLeaves(type));
  const backup = files['.obsidian/graph.json'];
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  const raw = { id: 'fv', label: 'Full view', colors: ['#112233', '#445566', '#778899', '#aabbcc'], bg: '#010203', glow: 40,
    forces: { node: 1.5, repel: 9, dist: 210, center: 0.3, linkS: 0.4, line: 0.6, fade: 2 }, view };
  await plugin._doApply(GraphStyler.presetFromRaw(raw));
  const applied = JSON.parse(files['.obsidian/graph.json']);
  const originalConfirm = global.window.confirm;
  global.window.confirm = () => true;
  try {
    await plugin.restore();
  } finally {
    global.window.confirm = originalConfirm;
  }
  return { applied, engine: engineOptions[0], local: localSent[0], restored: files['.obsidian/graph.json'], backup };
}

async function saveWithView(includeView, coreOptions) {
  const { app } = makeHarness();
  if (coreOptions) app.internalPlugins = { plugins: { graph: { instance: { options: coreOptions } } } };
  const plugin = new GraphStyler(app);
  let factory = null;
  plugin.registerView = (type, make) => { factory = make; };
  await plugin.onload();
  const saved = [];
  plugin.saveCustom = async (raw) => { saved.push(raw); };
  plugin.draft.includeView = includeView;
  await factory({}).saveCurrent();
  return saved[0];
}

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

// Minimal Obsidian-style DOM for the panel's preset rows.
class FakeEl {
  constructor(tag, cls, text) {
    this.tag = tag;
    this.cls = new Set(cls ? cls.split(' ') : []);
    this.text = text || '';
    this.attrs = {};
    this.children = [];
    this.style = {};
  }

  createEl(tag, opts = {}) {
    const el = new FakeEl(tag, opts.cls, opts.text);
    this.children.push(el);
    return el;
  }

  createDiv(opts = {}) { return this.createEl('div', opts); }
  createSpan(opts = {}) { return this.createEl('span', opts); }
  setAttr(name, value) { this.attrs[name] = value; }
  empty() { this.children = []; }
  addClass(name) { this.cls.add(name); }
  addEventListener(type, listener) { this.listeners = Object.assign(this.listeners || {}, { [type]: listener }); }
  toggleClass(name, on) { if (on) this.cls.add(name); else this.cls.delete(name); }
  walk() { return [this].concat(...this.children.map((child) => child.walk())); }
}

global.createFragment = (build) => {
  const fragment = new FakeEl('fragment');
  build(fragment);
  return fragment;
};

async function presetRow(withActions) {
  const { app } = makeHarness();
  const plugin = new GraphStyler(app);
  let factory = null;
  plugin.registerView = (type, make) => { factory = make; };
  plugin.settings = { custom: [] };
  await plugin.onload();
  const view = factory({});
  const calls = [];
  plugin.applyPreset = () => { calls.push('apply'); };
  const parent = new FakeEl('div');
  // After a delete the panel re-renders; focus goes to the first remaining row, else the first group header.
  view.contentEl = {
    querySelector: (selector) => (selector === '.gs-group > summary' ? { focus: () => calls.push(`focus ${selector}`) } : null),
  };
  const preset = { id: 'night', label: 'Night', emoji: '*', swatch: ['#112233'] };
  view.presetButton(parent, preset,
    withActions ? () => calls.push('delete') : undefined,
    withActions ? () => calls.push('copy') : undefined);
  return { parent, calls };
}

function fakeCanvas() {
  const drawn = [];
  const filters = { fill: [], draw: [] };
  const ctx = {
    filter: 'none',
    fillRect() { filters.fill.push(ctx.filter); },
    drawImage(source, x = 0, y = 0) {
      drawn.push(source);
      filters.draw.push(ctx.filter);
      ctx.drawnAt.push([x, y]);
    },
    drawnAt: [],
    texts: [],
    fillText(text, x, y) { ctx.texts.push({ text, x, y, font: ctx.font, fill: ctx.fillStyle }); },
    strokes: [],
    strokeText(text, x, y) { ctx.strokes.push({ text, x, y, stroke: ctx.strokeStyle, width: ctx.lineWidth }); },
    measureText: (text) => ({ width: String(text).length * 7 }),
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

async function exportWith(renderer, { filters = new Map(), iframe = null, options = null, scale = 3, folder = '', openAfter = false,
  existing = [], showInFolder = true } = {}) {
  const { app } = makeHarness();
  const created = [];
  const canvases = [];
  const vaultPaths = new Set(existing);
  const foldersMade = [];
  const opened = [];
  const revealed = [];
  const shown = [];
  app.vault.getFiles = () => [...vaultPaths].map((filePath) => ({ path: filePath }));
  app.vault.getAbstractFileByPath = (filePath) => (vaultPaths.has(filePath) ? { path: filePath } : null);
  app.vault.createFolder = async (filePath) => { foldersMade.push(filePath); vaultPaths.add(filePath); };
  app.vault.createBinary = async (filePath) => { created.push(filePath); vaultPaths.add(filePath); return { path: filePath }; };
  app.workspace.getLeaf = (kind, direction) => ({ view: { getViewType: () => 'image' }, kind, direction,
    openFile: async (file) => { opened.push([kind, direction, file.path]); } });
  if (showInFolder) app.showInFolder = (filePath) => { shown.push(filePath); };
  const explorer = { view: { getViewType: () => 'file-explorer', revealInFolder: (file) => revealed.push(file.path) } };
  app.workspace.getLeavesOfType = (type) => {
    if (type === 'file-explorer') return [explorer];
    return type === 'graph' && renderer
      ? [{ view: { renderer, contentEl: { nodeType: 1, parentElement: null, querySelector: () => iframe } } }] : [];
  };
  const originalCreate = global.document.createElement;
  global.document.createElement = () => {
    const canvas = fakeCanvas();
    canvases.push(canvas);
    return canvas;
  };
  global.window.getComputedStyle = (el) => ({ backgroundColor: 'rgb(30, 30, 30)', filter: filters.get(el) || 'none' });
  global.document.body = {};
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  plugin.exportFolder = folder;
  plugin.openAfterExport = openAfter;
  if (options) plugin.exportOptions = GraphStyler.sanitizeExportOptions(options);
  notices.length = 0;
  noticeLog.length = 0;
  const originalError = console.error;
  console.error = () => {};
  try {
    await plugin.exportPng(scale);
  } finally {
    console.error = originalError;
    global.document.createElement = originalCreate;
  }
  return { created, canvas: canvases[0], notices: notices.slice(), log: noticeLog.slice(), plugin, foldersMade, opened, revealed, shown };
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
  app.vault.createBinary = async (filePath) => { created.push(filePath); return { path: filePath }; };
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

// Local graphs open with Obsidian's defaults (no colour groups). Each spec: own colour groups or [].
async function localGraphColours({ styled = true, globalGroups = [{ query: 'path:"a"', color: { a: 1, rgb: 7 } }] } = {}) {
  const { app } = makeHarness();
  const handlers = [];
  const leaves = [];
  const addLocal = (own) => {
    let options = { colorGroups: own };
    const leaf = { view: { engine: { getOptions: () => options, setOptions: (o) => { options = Object.assign({}, options, o); }, render() {} } } };
    leaves.push(leaf);
    return leaf;
  };
  app.workspace.getLeavesOfType = (type) => (type === 'localgraph' ? leaves.slice() : []);
  app.workspace.on = (name, callback) => { handlers.push([name, callback]); return {}; };
  app.workspace.onLayoutReady = (callback) => callback();
  app.customCss.enabledSnippets = new Set(styled ? ['graph-styler-neon'] : ['user-snippet']);
  app.internalPlugins = { plugins: { graph: { instance: { options: { colorGroups: globalGroups } } } } };
  const plugin = new GraphStyler(app);
  await plugin.onload();
  const layoutChange = async () => {
    for (const [name, callback] of handlers) if (name === 'layout-change') callback();
    await plugin.colorNewLocalGraphs();
  };
  return { plugin, addLocal, layoutChange, groupsOf: (leaf) => leaf.view.engine.getOptions().colorGroups };
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

  // Post-ready export: layout pads to the aspect without cropping, keeps a caption band, and fits all nodes.
  const { exportLayout, fitView, sanitizeExportOptions } = GraphStyler;
  assert.deepStrictEqual(sanitizeExportOptions(undefined),
    { fit: false, aspect: 'original', caption: { date: false, notes: false, preset: false } });
  assert.deepStrictEqual(sanitizeExportOptions({ fit: 'yes', aspect: '16:9', caption: { date: true, notes: 1 } }),
    { fit: false, aspect: 'original', caption: { date: true, notes: false, preset: false } });
  const plainOptions = sanitizeExportOptions({});
  assert.deepStrictEqual(exportLayout(200, 100, plainOptions, false),
    { canvasW: 200, canvasH: 100, band: 0, graphW: 200, graphH: 100, graphX: 0, graphY: 0 });
  const pad45 = sanitizeExportOptions({ aspect: '4:5' });
  assert.deepStrictEqual(exportLayout(200, 100, pad45, false),
    { canvasW: 200, canvasH: 250, band: 0, graphW: 200, graphH: 100, graphX: 0, graphY: 75 });
  assert.deepStrictEqual(exportLayout(200, 100, pad45, true),
    { canvasW: 200, canvasH: 250, band: 14, graphW: 200, graphH: 100, graphX: 0, graphY: 68 });
  assert.deepStrictEqual(exportLayout(100, 300, sanitizeExportOptions({ aspect: '1:1' }), false),
    { canvasW: 300, canvasH: 300, band: 0, graphW: 100, graphH: 300, graphX: 100, graphY: 0 });
  assert.deepStrictEqual(exportLayout(200, 100, sanitizeExportOptions({ fit: true, aspect: '4:5' }), true),
    { canvasW: 200, canvasH: 250, graphX: 0, graphY: 0, graphW: 200, graphH: 236, band: 14 });
  assert.deepStrictEqual(exportLayout(200, 100, sanitizeExportOptions({ fit: true }), true),
    { canvasW: 200, canvasH: 114, graphX: 0, graphY: 0, graphW: 200, graphH: 100, band: 14 });
  const fittedView = fitView([{ x: -10, y: -10 }, { x: 10, y: 10 }, { x: NaN }], 100, 100);
  assert.ok(Math.abs(fittedView.scale - 4.3) < 1e-9 && fittedView.panX === 50 && fittedView.panY === 50, JSON.stringify(fittedView));

  // Fit + 4:5 + caption on a fake renderer: the frame is redrawn fitted, hubs and caption are written,
  // and the user's view comes back exactly.
  const fitRenderer = new FakeGraphRenderer(16384);
  fitRenderer.nodes = [
    { x: -40, y: -20, weight: 50, id: 'Hub.md', text: { resolution: 2 }, getSize: () => 20, getDisplayText: () => 'Hub' },
    { x: 40, y: 20, weight: 2, id: 'Leaf.md', text: { resolution: 2 }, getSize: () => 8, getDisplayText: () => 'Leaf' },
    { x: 0, y: 30, weight: 1, id: '#tag', text: { resolution: 2 } },
  ];
  const fitBefore = rendererState(fitRenderer);
  const posted = await exportWith(fitRenderer, { scale: 2,
    options: { fit: true, aspect: '4:5', caption: { date: false, notes: true, preset: false } } });
  assert.deepStrictEqual(rendererState(fitRenderer), fitBefore);
  assert.deepStrictEqual([posted.canvas.width, posted.canvas.height], [400, 500]);
  assert.deepStrictEqual([fitRenderer.during.W, fitRenderer.during.H], [400, 472]);
  // Nodes span x −40…40 and y −20…30; the 200×236 frame with 7% margins fits them at 172/80 = 2.15,
  // centred at (0, 5): pan = (100, 118 − 5 × 2.15), all ×2 for k.
  assert.ok(Math.abs(fitRenderer.during.scale - 4.3) < 1e-9, fitRenderer.during.scale);
  assert.deepStrictEqual([fitRenderer.during.panX, fitRenderer.during.panY], [200, 214.5]);
  assert.deepStrictEqual(posted.canvas.ctx.drawnAt, [[0, 0]]);
  assert.deepStrictEqual(posted.canvas.ctx.texts.map((t) => t.text), ['Hub', '2 notes']);
  // Hub labels carry a halo in the background colour, stroked under the fill.
  assert.deepStrictEqual(posted.canvas.ctx.strokes.map((t) => [t.text, t.stroke]), [['Hub', 'rgb(30, 30, 30)']]);

  // A label whose spot below its node would cover another hub moves above its own node.
  const labelCtx = fakeCanvas().ctx;
  const hubNode = (id, x, y, weight) => ({ id, x, y, weight, getSize: () => 20, getDisplayText: () => id });
  const flat = { scale: 1, panX: 0, panY: 0, nodeScale: 1 };
  GraphStyler.drawHubLabels(labelCtx, Object.assign({ nodes: [hubNode('A', 0, 0, 50), hubNode('B', 0, 45, 40)] }, flat),
    0, 0, 1, 10, '#ffffff', 'sans-serif', '#000000');
  const labelY = Object.fromEntries(labelCtx.texts.map((t) => [t.text, t.y]));
  assert.ok(labelY.A < -20, `A should sit above its node: ${labelY.A}`);
  assert.ok(labelY.B > 45 + 20, `B stays below its node: ${labelY.B}`);
  // ...but not into the spot where a hub above it would put its own name.
  const crowdCtx = fakeCanvas().ctx;
  GraphStyler.drawHubLabels(crowdCtx, Object.assign({ nodes: [hubNode('A', 0, 0, 50), hubNode('B', 0, 45, 40), hubNode('C', 0, -60, 30)] }, flat),
    0, 0, 1, 10, '#ffffff', 'sans-serif', '#000000');
  const crowdY = Object.fromEntries(crowdCtx.texts.map((t) => [t.text, t.y]));
  assert.ok(crowdY.A > 20, `A keeps its spot below: ${crowdY.A}`);
  const aloneCtx = fakeCanvas().ctx;
  GraphStyler.drawHubLabels(aloneCtx, Object.assign({ nodes: [hubNode('A', 0, 0, 50), hubNode('B', 200, 0, 40)] }, flat),
    0, 0, 1, 10, '#ffffff', 'sans-serif', '#000000');
  assert.ok(aloneCtx.texts.every((t) => t.y > 20), 'labels stay below when nothing is in the way');
  assert.ok(posted.created.length === 1 && posted.notices[0].includes('(400×500)'), posted.notices.join());
  // Without fit the screen frame is padded: centred above the caption band, never scaled or cropped.
  const padded = await exportWith(new FakeGraphRenderer(16384), { scale: 2,
    options: { aspect: '1:1', caption: { date: true, notes: false, preset: false } } });
  assert.deepStrictEqual([padded.canvas.width, padded.canvas.height], [400, 400]);
  assert.deepStrictEqual(padded.canvas.ctx.drawnAt, [[0, 86]]);
  assert.ok(/^\d{4}\.\d{2}\.\d{2}$/.test(padded.canvas.ctx.texts[0].text), padded.canvas.ctx.texts[0].text);
  // The default (Original, no fit, no caption) draws exactly the screen frame at (0, 0), as in 0.2.0.
  const defaultExport = await exportWith(new FakeGraphRenderer(16384), { scale: 2, options: {} });
  assert.deepStrictEqual([defaultExport.canvas.width, defaultExport.canvas.height], [400, 200]);
  assert.deepStrictEqual(defaultExport.canvas.ctx.drawnAt, [[0, 0]]);
  assert.deepStrictEqual(defaultExport.canvas.ctx.texts, []);

  // A newly opened local graph without colour groups gets the global (preset) groups once; groups the user
  // set on a local graph are never replaced; nothing happens without an active preset.
  {
    const lc = await localGraphColours();
    const plainLocal = lc.addLocal([]);
    const ownGroups = [{ query: 'tag:#mine', color: { a: 1, rgb: 99 } }];
    const customLocal = lc.addLocal(ownGroups);
    await lc.layoutChange();
    assert.deepStrictEqual(lc.groupsOf(plainLocal), [{ query: 'path:"a"', color: { a: 1, rgb: 7 } }]);
    assert.deepStrictEqual(lc.groupsOf(customLocal), ownGroups);
    plainLocal.view.engine.setOptions({ colorGroups: [] });
    await lc.layoutChange();
    assert.deepStrictEqual(lc.groupsOf(plainLocal), [], 'a local graph the user cleared is not refilled');
    const later = lc.addLocal([]);
    await lc.layoutChange();
    assert.strictEqual(lc.groupsOf(later).length, 1);
    const unstyled = await localGraphColours({ styled: false });
    const untouched = unstyled.addLocal([]);
    await unstyled.layoutChange();
    assert.deepStrictEqual(unstyled.groupsOf(untouched), []);
  }

  // The last choices are remembered in settings and come back on load.
  {
    const { app } = makeHarness();
    const plugin = new GraphStyler(app);
    const saved = [];
    plugin.loadData = async () => ({ custom: [], exportOptions: { fit: true, aspect: '4:5', caption: { date: true } } });
    plugin.saveData = async (settings) => { saved.push(JSON.parse(JSON.stringify(settings))); };
    await plugin.onload();
    assert.deepStrictEqual(plugin.exportOptions, { fit: true, aspect: '4:5', caption: { date: true, notes: false, preset: false } });
    await plugin.setExportOptions({ aspect: '1:1' });
    assert.deepStrictEqual(saved[saved.length - 1].exportOptions,
      { fit: true, aspect: '1:1', caption: { date: true, notes: false, preset: false } });
  }

  // Exports go to a folder (created on demand, nested parts in order), never escape the vault, collide to -2,
  // and the result is hard to miss: a 12 s notice with Open / Show in Finder, the image opened beside the
  // graph and revealed in the file explorer, and the path kept for the panel's "Last export" link.
  const { exportFolderPath } = GraphStyler;
  assert.strictEqual(exportFolderPath(undefined), 'Graph Styler exports');
  assert.strictEqual(exportFolderPath(''), '');
  assert.strictEqual(exportFolderPath('  Posts / Graphs/ '), 'Posts/Graphs');
  assert.strictEqual(exportFolderPath('../out/./x'), 'out/x');
  assert.strictEqual(exportFolderPath('a\\b'), 'a/b');
  const stampName = GraphStyler.exportFileName(null, new Date(), []);
  const saved = await exportWith(new FakeGraphRenderer(16384), { scale: 1, folder: 'Graph Styler exports', openAfter: true,
    existing: [`Graph Styler exports/${stampName}`] });
  const savedPath = `Graph Styler exports/${stampName.replace(/\.png$/, '-2.png')}`;
  assert.deepStrictEqual(saved.foldersMade, ['Graph Styler exports']);
  assert.deepStrictEqual(saved.created, [savedPath]);
  assert.strictEqual(saved.plugin.settings.lastExport, savedPath);
  assert.deepStrictEqual(saved.opened, [['split', 'vertical', savedPath]]);
  assert.deepStrictEqual(saved.revealed, [savedPath]);
  const exportNotice = saved.log.find((n) => typeof n.message !== 'string');
  assert.strictEqual(exportNotice.duration, 12000);
  assert.strictEqual(saved.notices[0], `🖼️ Saved ${savedPath} (200×100)`);
  const buttons = exportNotice.message.children[1].children;
  assert.deepStrictEqual(buttons.map((b) => b.text), ['Open', 'Show in Finder']);
  buttons[1].onclick();
  assert.deepStrictEqual(saved.shown, [savedPath]);
  await buttons[0].onclick();
  assert.strictEqual(saved.opened.length, 2);
  // Nested folders are created part by part; an existing folder is reused; empty means the vault root.
  const nested = await exportWith(new FakeGraphRenderer(16384), { scale: 1, folder: 'Posts/Graphs', existing: ['Posts'] });
  assert.deepStrictEqual(nested.foldersMade, ['Posts/Graphs']);
  assert.ok(nested.created[0].startsWith('Posts/Graphs/graph-graph-'), nested.created[0]);
  const atRoot = await exportWith(new FakeGraphRenderer(16384), { scale: 1, folder: '' });
  assert.deepStrictEqual(atRoot.foldersMade, []);
  assert.ok(/^graph-graph-\d{8}-\d{4}\.png$/.test(atRoot.created[0]), atRoot.created[0]);
  // "Open the image after exporting" off: nothing opens; without app.showInFolder the notice only offers Open.
  const quiet = await exportWith(new FakeGraphRenderer(16384), { scale: 1, folder: 'x', openAfter: false, showInFolder: false });
  assert.deepStrictEqual(quiet.opened, []);
  assert.deepStrictEqual(quiet.revealed, []);
  assert.deepStrictEqual(quiet.log.find((n) => typeof n.message !== 'string').message.children[1].children.map((b) => b.text), ['Open']);
  // Settings: defaults on load, persisted changes, and a last export that no longer exists is not shown.
  {
    const { app } = makeHarness();
    app.vault.getAbstractFileByPath = (filePath) => (filePath === 'kept.png' ? { path: filePath } : null);
    const plugin = new GraphStyler(app);
    const savedSettings = [];
    plugin.loadData = async () => ({ custom: [], lastExport: 'gone.png' });
    plugin.saveData = async (settings) => { savedSettings.push(JSON.parse(JSON.stringify(settings))); };
    await plugin.onload();
    assert.strictEqual(plugin.exportFolder, 'Graph Styler exports');
    assert.strictEqual(plugin.openAfterExport, true);
    assert.strictEqual(plugin.lastExportFile(), null);
    plugin.settings.lastExport = 'kept.png';
    assert.deepStrictEqual(plugin.lastExportFile(), { path: 'kept.png' });
    await plugin.setExportFolder(' My/Exports/ ');
    await plugin.setOpenAfterExport(false);
    const last = savedSettings[savedSettings.length - 1];
    assert.deepStrictEqual([last.exportFolder, last.openAfterExport], ['My/Exports', false]);
  }

  // Copy image: the same PNG goes to the clipboard as image/png and no file is written.
  {
    const written = [];
    global.ClipboardItem = class ClipboardItem { constructor(items) { this.items = items; } };
    Object.defineProperty(global, 'navigator', {
      value: { language: 'en', clipboard: { write: async (items) => { written.push(items); } } }, configurable: true });
    const { app } = makeHarness();
    const created = [];
    app.vault.createBinary = async (filePath) => { created.push(filePath); return { path: filePath }; };
    const renderer = new FakeGraphRenderer(16384);
    app.workspace.getLeavesOfType = (type) => (type === 'graph'
      ? [{ view: { renderer, contentEl: { nodeType: 1, parentElement: null, querySelector: () => null } } }] : []);
    const originalCreate = global.document.createElement;
    global.document.createElement = () => fakeCanvas();
    const plugin = new GraphStyler(app);
    plugin.settings = { custom: [] };
    notices.length = 0;
    try {
      await plugin.copyPng(1);
      assert.strictEqual(written.length, 1);
      assert.deepStrictEqual(Object.keys(written[0][0].items), ['image/png']);
      assert.deepStrictEqual(created, []);
      assert.deepStrictEqual(notices, ['📋 Image copied (200×100) — paste it anywhere']);
      global.navigator.clipboard.write = async () => { throw new Error('denied'); };
      notices.length = 0;
      const originalError = console.error;
      console.error = () => {};
      await plugin.copyPng(1);
      console.error = originalError;
      assert.deepStrictEqual(notices, ['Could not copy the image — open the console (Cmd+Opt+I) to see why']);
    } finally {
      global.document.createElement = originalCreate;
      delete global.ClipboardItem;
    }
  }

  // The export group shows the basic controls first (aspect → buttons → last export) and folds the rest into
  // "More options"; every option keeps its one-line explanation, the last export is linked, and Copy image
  // is disabled where the clipboard cannot take images.
  {
    const { app } = makeHarness();
    app.vault.getAbstractFileByPath = (filePath) => (filePath === 'Graph Styler exports/g.png' ? { path: filePath } : null);
    const plugin = new GraphStyler(app);
    let factory = null;
    plugin.registerView = (type, make) => { factory = make; };
    plugin.loadData = async () => ({ custom: [], lastExport: 'Graph Styler exports/g.png' });
    await plugin.onload();
    const view = factory({});
    const panel = new FakeEl('div');
    view.buildExport(panel);
    const texts = panel.walk().map((el) => el.text).filter(Boolean);
    for (const line of ['🖼️ Export image', 'These options only change the saved picture, not your graph.',
      'Image size, as a multiple of the graph on your screen. 2x suits an Instagram post.',
      'Frames every note in the image, even if you are zoomed in. Your view is not changed.',
      'Original keeps the current shape. 1:1 and 4:5 add background around the graph so it fits a post. Notes are never cropped.',
      'Adds a small line at the bottom of the image: the date, how many notes, and/or the preset name.',
      'A folder in this vault, created when needed. Leave it empty to save at the top of the vault.',
      'Save exported images to', 'Open the image after exporting', 'Export graph as PNG', 'Copy image', 'More options',
      'Last export: ', 'Graph Styler exports/g.png']) {
      assert.ok(texts.includes(line), `missing panel text: ${line}`);
    }
    const more = panel.walk().find((el) => el.cls.has('gs-sub'));
    const moreTexts = more.walk().map((el) => el.text).filter(Boolean);
    for (const line of ['Scale', 'Fit whole graph', 'Caption', 'Save exported images to', 'Open the image after exporting']) {
      assert.ok(moreTexts.includes(line), `not under More options: ${line}`);
    }
    for (const line of ['Aspect', 'Export graph as PNG', 'Copy image', 'Last export: ']) {
      assert.ok(!moreTexts.includes(line), `hidden under More options: ${line}`);
    }
    const order = ['Aspect', 'Export graph as PNG', 'Copy image', 'Last export: ', 'More options', 'Scale'].map((line) => texts.indexOf(line));
    assert.ok(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1])), `choose → act → result → more: ${order}`);
    const copyButton = panel.walk().find((el) => el.text === 'Copy image');
    assert.strictEqual(copyButton.disabled, true);
    assert.strictEqual(copyButton.attrs.title, 'This version of Obsidian cannot put images on the clipboard');
  }

  // The whole panel: Look (themes grid, My presets) stays open, then three folded groups, then Restore as a
  // quiet footer above the credit. A group's open state survives the re-render a theme apply triggers.
  {
    const renderPanel = async (Plugin, custom = []) => {
      const { app } = makeHarness();
      const plugin = new Plugin(app);
      let factory = null;
      plugin.registerView = (type, make) => { factory = make; };
      plugin.loadData = async () => ({ custom });
      await plugin.onload();
      const view = factory({});
      view.contentEl = new FakeEl('div');
      view.render();
      return { plugin, view, panel: view.contentEl };
    };
    const mine = [{ id: 'mine', label: 'Mine', colors: ['#112233', '#223344', '#334455', '#445566'], bg: '#000000', glow: 10, forces: {} }];
    const empty = await renderPanel(GraphStyler);
    const top = empty.panel.children.map((el) => [el.tag, [...el.cls].join(' ')]);
    assert.deepStrictEqual(top.map(([, cls]) => cls), [
      '', 'setting-item-description', 'gs-section', 'gs-note', 'gs-list gs-grid',
      'gs-group', 'gs-group', 'gs-group', 'gs-footer', 'gs-credit']);
    assert.strictEqual(empty.panel.children[4].children.length, 14);
    assert.deepStrictEqual(empty.panel.children.filter((el) => el.tag === 'details')
      .map((el) => el.children[0].text), ['🎛️ Customize', '📋 Share code', '🖼️ Export image']);
    assert.ok(empty.panel.children.filter((el) => el.tag === 'details').every((el) => !el.open), 'groups start closed');
    // My presets only shows a heading when there is something under it.
    assert.ok(!empty.panel.walk().some((el) => el.text === 'My presets'));
    const withMine = await renderPanel(GraphStyler, mine);
    assert.ok(withMine.panel.walk().some((el) => el.text === 'My presets'));
    assert.ok(withMine.panel.children.some((el) => el.cls.has('gs-list') && !el.cls.has('gs-grid') && el.children[0].cls.has('gs-preset-row')));
    // Restore is the last action before the credit and still runs plugin.restore.
    const footer = empty.panel.children[8];
    const restoreButton = footer.children[0];
    assert.deepStrictEqual([restoreButton.tag, restoreButton.text], ['button', '↩︎ Restore original']);
    let restored = 0;
    empty.plugin.restore = () => { restored += 1; };
    restoreButton.onclick();
    assert.strictEqual(restored, 1);
    // Import lives in the Share code group.
    const share = empty.panel.children[6];
    const imports = [];
    empty.plugin.importShareCode = (code) => imports.push(code);
    share.walk().find((el) => el.tag === 'input').value = 'gs1.abc';
    share.walk().find((el) => el.cls.has('gs-import')).onclick();
    assert.deepStrictEqual(imports, ['gs1.abc']);
    // Open state is kept by group id: opening records it, the re-render restores it, closing forgets it.
    const exportGroup = empty.panel.children[7];
    exportGroup.open = true;
    exportGroup.listeners.toggle();
    const nested = exportGroup.walk().find((el) => el.cls.has('gs-sub'));
    nested.open = true;
    nested.listeners.toggle();
    assert.deepStrictEqual([...empty.plugin.openGroups].sort(), ['export', 'exportMore']);
    empty.view.render();
    const again = empty.panel.children.filter((el) => el.tag === 'details');
    assert.deepStrictEqual(again.map((el) => !!el.open), [false, false, true]);
    assert.strictEqual(again[2].walk().find((el) => el.cls.has('gs-sub')).open, true);
    again[2].open = false;
    again[2].listeners.toggle();
    assert.deepStrictEqual([...empty.plugin.openGroups], ['exportMore']);

    // Korean: same structure, no string left empty.
    const ko = await renderPanel(loadGraphStylerIn('ko'), mine);
    const shape = (el) => el.walk().map((node) => `${node.tag}.${[...node.cls].join('.')}`);
    assert.deepStrictEqual(shape(ko.panel), shape(withMine.panel));
    const blank = withMine.panel.walk().map((node, i) => [node, ko.panel.walk()[i]])
      .filter(([en, koNode]) => en.text && !koNode.text);
    assert.deepStrictEqual(blank.map(([en]) => en.text), []);
    assert.deepStrictEqual(ko.panel.children.filter((el) => el.tag === 'details').map((el) => el.children[0].text),
      ['🎛️ 커스터마이즈', '📋 공유 코드', '🖼️ 이미지 내보내기']);
    assert.ok(ko.panel.walk().some((el) => el.text === '옵션 더 보기'));
  }

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
  const snippet019 = neonCss.split('\n').filter((line) => !line.includes('iframe') && !line.includes('pointer-events')).join('\n');
  const from019 = await loadPlugin({
    data: { custom: [], resumeSnippet: 'neon' },
    snippets: { neon: 1 },
    files: { '.obsidian/snippets/graph-styler-neon.css': snippet019 },
  });
  assert.strictEqual(from019.files['.obsidian/snippets/graph-styler-neon.css'], neonCss);
  // 0.2.0–0.3.0 filtered the iframe without letting input through, which stopped wheel zoom and drag;
  // their enabled snippet is rewritten on load so updating fixes zoom without reapplying.
  const snippet030 = neonCss.split('\n').filter((line) => !line.includes('~ iframe')).join('\n');
  assert.notStrictEqual(snippet030, neonCss);
  const from030 = await loadPlugin({
    data: { custom: [], resumeSnippet: 'neon' },
    snippets: { neon: 1 },
    files: { '.obsidian/snippets/graph-styler-neon.css': snippet030 },
  });
  assert.strictEqual(from030.files['.obsidian/snippets/graph-styler-neon.css'], neonCss);
  // Generated snippets that are switched off are refreshed too, so turning one on later (in Graph Styler or
  // in Obsidian's CSS snippet settings) never brings the 0.2.0–0.3.0 CSS back. Hand-made files are left alone.
  const offSnippet030 = snippet030.replace('graph-styler :: neon', 'graph-styler :: aurora');
  const allRefreshed = await loadPlugin({
    data: { custom: [], resumeSnippet: 'neon' },
    snippets: { neon: 1 },
    files: {
      '.obsidian/snippets/graph-styler-neon.css': snippet030,
      '.obsidian/snippets/graph-styler-aurora.css': offSnippet030,
      '.obsidian/snippets/graph-styler-mine.css': '/* graph-styler :: mine (auto-generated) */ hand',
      '.obsidian/snippets/graph-styler-sunset.css': '/* tweaked by me */ .x {}',
    },
  });
  const auroraNow = allRefreshed.files['.obsidian/snippets/graph-styler-aurora.css'];
  assert.ok(auroraNow.startsWith('/* graph-styler :: aurora (auto-generated) */'));
  assert.ok(auroraNow.includes('> canvas ~ iframe') && auroraNow.includes('pointer-events: none'));
  assert.deepStrictEqual(allRefreshed.enabled, ['graph-styler-neon']);
  assert.strictEqual(allRefreshed.files['.obsidian/snippets/graph-styler-neon.css'], neonCss);
  assert.strictEqual(allRefreshed.files['.obsidian/snippets/graph-styler-mine.css'], '/* graph-styler :: mine (auto-generated) */ hand');
  assert.strictEqual(allRefreshed.files['.obsidian/snippets/graph-styler-sunset.css'], '/* tweaked by me */ .x {}');
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
  // A filter makes the iframe a stacking context painted above Obsidian's input overlay canvas, so the
  // filtered iframe must let pointer input through to the overlay (wheel zoom, pinch, drag), in both
  // graph types and both themes. It only does so while the overlay canvas is there.
  const blocks = glowCss.split('}').filter((block) => block.includes('{')).map((block) => {
    const [head, body] = block.split('{');
    return { selectors: head.split(',').map((x) => x.trim()), body: body.trim() };
  });
  // General rule: every element inside the graph pane that gets a filter, other than Obsidian's input overlay
  // canvas itself, must pass pointer input through while the overlay is there; the overlay never does.
  for (const block of blocks.filter((b) => /filter:/.test(b.body))) {
    for (const selector of block.selectors) {
      const m = selector.match(/^(.*\.view-content) > (\S+)$/);
      if (!m || m[2] === 'canvas') continue;
      assert.ok(blocks.some((b) => b.selectors.includes(`${m[1]} > canvas ~ ${m[2]}`) && /pointer-events:\s*none/.test(b.body)),
        `${selector} has a filter but still takes pointer input`);
    }
  }
  assert.ok(!blocks.some((b) => /pointer-events/.test(b.body) && b.selectors.some((x) => /> canvas$/.test(x))),
    'the input overlay canvas must keep pointer input');
  for (const theme of ['.theme-dark', '.theme-light']) {
    for (const type of ['graph', 'localgraph']) {
      const pane = `${theme} .workspace-leaf-content[data-type="${type}"] .view-content`;
      assert.ok(blocks.some((b) => b.selectors.includes(`${pane} > iframe`) && /filter:/.test(b.body)));
      assert.ok(blocks.some((b) => b.selectors.includes(`${pane} > canvas ~ iframe`) && /pointer-events:\s*none/.test(b.body)),
        `${pane}: filtered iframe still takes pointer input`);
      assert.ok(!blocks.some((b) => b.selectors.includes(`${pane} > iframe`) && /pointer-events/.test(b.body)));
    }
  }

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

  // My-presets rows: copy and delete are real buttons next to the preset button, never inside it, in
  // the tab order preset → copy → delete; activating them does not apply the preset.
  const customRow = await presetRow(true);
  assert.strictEqual(customRow.parent.children.length, 1);
  const row = customRow.parent.children[0];
  assert.ok(row.cls.has('gs-preset-row'));
  assert.deepStrictEqual(row.children.map((el) => [el.tag, [...el.cls][0]]),
    [['button', 'gs-btn'], ['button', 'gs-share'], ['button', 'gs-del']]);
  for (const el of row.walk()) {
    if (el.tag !== 'button') continue;
    assert.ok(el.walk().slice(1).every((inner) => inner.tag !== 'button'), 'button nested in a button');
  }
  const [presetEl, copyEl, deleteEl] = row.children;
  assert.deepStrictEqual([copyEl.attrs.type, deleteEl.attrs.type], ['button', 'button']);
  assert.strictEqual(copyEl.attrs['aria-label'], 'Copy share code: Night');
  assert.strictEqual(deleteEl.attrs['aria-label'], 'Delete preset: Night');
  copyEl.onclick();
  await deleteEl.onclick();
  assert.deepStrictEqual(customRow.calls, ['copy', 'delete', 'focus .gs-group > summary']);
  presetEl.onclick();
  assert.deepStrictEqual(customRow.calls, ['copy', 'delete', 'focus .gs-group > summary', 'apply']);
  // Built-in presets keep a single button directly in the list.
  const builtInRow = await presetRow(false);
  assert.deepStrictEqual(builtInRow.parent.children.map((el) => [el.tag, [...el.cls][0]]), [['button', 'gs-btn']]);
  // Focus rings: the new buttons share the existing focus-visible rule.
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const focusRule = css.slice(0, css.indexOf('outline: 2px solid var(--interactive-accent)'));
  for (const selector of ['.gs-btn:focus-visible', '.gs-share:focus-visible', '.gs-del:focus-visible']) {
    assert.ok(focusRule.includes(`.graph-styler-panel ${selector}`), selector);
  }

  // Full-view presets (opt-in): filters and display ride along, are sanitised, and Restore returns everything.
  const fullView = { search: 'tag:#paper', showTags: true, showAttachments: false, hideUnresolved: true, showOrphans: false, showArrow: true };
  const fv = await fullViewApply(fullView);
  for (const [key, value] of Object.entries(fullView)) assert.strictEqual(fv.applied[key], value, key);
  assert.strictEqual(fv.applied.nodeSizeMultiplier, 1.5);
  assert.strictEqual(fv.engine.search, 'tag:#paper');
  // A note's local graph keeps its own filters: it gets colours and forces, not the global filter/display keys.
  assert.ok(Object.keys(fullView).every((key) => !(key in fv.local)), JSON.stringify(fv.local));
  assert.strictEqual(fv.local.nodeSizeMultiplier, 1.5);
  assert.ok(Array.isArray(fv.local.colorGroups));
  assert.strictEqual(fv.restored, fv.backup);
  // Without the opt-in a custom preset leaves filters and display alone, as before.
  const plain = await fullViewApply(undefined);
  assert.strictEqual(plain.applied.showTags, false);
  assert.ok(!('search' in plain.applied) && !('showArrow' in plain.applied));
  // Every field is type-checked; the search query is cleaned and capped.
  const wildView = await fullViewApply({ search: `a\u0000b${'x'.repeat(2000)}`, showTags: 'yes', showArrow: 1, hideUnresolved: false, extra: true });
  assert.strictEqual(wildView.applied.search.length, 500);
  assert.ok(wildView.applied.search.startsWith('a b'));
  assert.strictEqual(wildView.applied.showTags, false);
  assert.ok(!('showArrow' in wildView.applied) && !('extra' in wildView.applied));
  assert.strictEqual(wildView.applied.hideUnresolved, false);
  assert.strictEqual((await fullViewApply([true])).applied.showTags, false);
  // Saving: the checkbox is off by default; on, it captures graph.json overlaid by the core plugin's live options.
  assert.ok(!('view' in await saveWithView(false)));
  assert.deepStrictEqual((await saveWithView(true, { search: 'path:Papers', showArrow: true, colorGroups: [] })).view,
    { search: 'path:Papers', showTags: false, showArrow: true });

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
  // gs2. carries filters and display; plain presets keep producing gs1. so older versions can read them.
  const viewCode = encodeShareCode(Object.assign({}, shared, { view: fullView }));
  assert.ok(viewCode.startsWith('gs2.'), viewCode);
  assert.deepStrictEqual((await importCode(viewCode, [])).raw.view, fullView);
  assert.deepStrictEqual(decodeShareCode(viewCode), Object.assign({}, decoded, { view: fullView }));
  assert.strictEqual(decodeShareCode(viewCode.replace('gs2.', 'gs1.')), null);
  assert.ok(encodeShareCode(Object.assign({}, shared, { view: { junk: 1 } })).startsWith('gs1.'));
  const gs1WithView = `gs1.${Buffer.from(JSON.stringify({ v: 1, label: 'x', view: fullView })).toString('base64url')}`;
  assert.ok(!('view' in decodeShareCode(gs1WithView)));
  const gs2Hostile = `gs2.${Buffer.from(JSON.stringify({ v: 2, label: 'x', view: { search: 42, showTags: 'no', showOrphans: true } })).toString('base64url')}`;
  assert.deepStrictEqual(decodeShareCode(gs2Hostile).view, { showOrphans: true });
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
