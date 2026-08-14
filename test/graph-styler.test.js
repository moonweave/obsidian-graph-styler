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

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'obsidian') return { Plugin, ItemView, Notice: class Notice {} };
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
      setCssEnabledStatus: (id, enabled) => cssCalls.push([id, enabled]),
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
  let saves = 0;
  plugin.loadData = async () => saved;
  plugin.saveData = async () => { saves += 1; };
  await plugin.onload();
  return { settings: plugin.settings, saves };
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
  assert.strictEqual(preservedData.saves, 0);

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
})();
