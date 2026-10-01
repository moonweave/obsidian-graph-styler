'use strict';

const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');

global.window = { localStorage: { getItem: () => '' }, confirm: () => true };
Object.defineProperty(global, 'navigator', { value: { language: 'en' }, configurable: true });
global.document = {
  head: {
    createEl: () => ({ remove() {} }),
  },
};

class Plugin {
  constructor(app) {
    this.app = app;
  }

  async saveData() {}
  register() {}
}

class ItemView {}

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'obsidian') return { Plugin, ItemView, Notice: class Notice {} };
  return originalLoad.call(this, request, parent, isMain);
};
const GraphStyler = require(path.join(__dirname, '..', 'main.js'));
Module._load = originalLoad;

const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
assert(!source.includes('ANIMATIONS'), 'animation feature must not be present');
assert(!source.includes('startAnimation'), 'animation commands must not be present');

function makeHarness() {
  const files = {
    '.obsidian/graph.json': JSON.stringify({
      centerStrength: 0.42,
      repelStrength: 13,
      linkStrength: 0.23,
      linkDistance: 333,
      nodeSizeMultiplier: 1.4,
    }),
  };
  const adapter = {
    exists: async (filePath) => Object.prototype.hasOwnProperty.call(files, filePath),
    read: async (filePath) => files[filePath],
    write: async (filePath, contents) => { files[filePath] = contents; },
    mkdir: async () => {},
  };
  const app = {
    vault: {
      configDir: '.obsidian',
      adapter,
      getMarkdownFiles: () => [{ parent: { path: 'notes' } }],
    },
    customCss: { setCssEnabledStatus() {} },
    workspace: { getLeavesOfType: () => [] },
  };
  return { app, files };
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
  const { app, files } = makeHarness();
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  await plugin._doApply(preset(applyForces));
  return { graph: JSON.parse(files['.obsidian/graph.json']), currentPreset: plugin.currentPreset };
}

(async () => {
  const visualOnly = await apply(false);
  assert.strictEqual(visualOnly.graph.centerStrength, 0.42);
  assert.strictEqual(visualOnly.graph.repelStrength, 13);
  assert.strictEqual(visualOnly.graph.linkStrength, 0.23);
  assert.strictEqual(visualOnly.graph.linkDistance, 333);
  assert.strictEqual(visualOnly.graph.nodeSizeMultiplier, 1.4);
  assert.strictEqual(visualOnly.graph.colorGroups[0].query, 'path:"notes"');
  assert.strictEqual(visualOnly.graph.colorGroups[0].color.rgb, parseInt('38bdf8', 16));
  assert.strictEqual(visualOnly.currentPreset.graph.centerStrength, undefined);

  const explicitForces = await apply(true);
  assert.strictEqual(explicitForces.graph.centerStrength, 0.1);
  assert.strictEqual(explicitForces.graph.repelStrength, 10);
  assert.strictEqual(explicitForces.graph.linkStrength, 1);
  assert.strictEqual(explicitForces.graph.linkDistance, 250);

  const { app, files } = makeHarness();
  const plugin = new GraphStyler(app);
  plugin.settings = { custom: [] };
  const original = files['.obsidian/graph.json'];
  await plugin._doApply(preset(false));
  files['.obsidian/graph.json'] = JSON.stringify({ userChangedAfterApply: true });
  window.confirm = () => false;
  await plugin.restore();
  assert.deepStrictEqual(JSON.parse(files['.obsidian/graph.json']), { userChangedAfterApply: true });
  window.confirm = () => true;
  await plugin.restore();
  assert.strictEqual(files['.obsidian/graph.json'], original);
})();
