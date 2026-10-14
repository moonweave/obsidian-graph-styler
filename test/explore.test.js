'use strict';
const assert = require('assert');
const Module = require('module');
const notices = [];
global.window = { localStorage: { getItem: () => 'en' } };
Object.defineProperty(global, 'navigator', { value: { language: 'en', clipboard: { writeText: async () => {} } }, configurable: true });
const load = Module._load;
Module._load = function (request, ...args) {
  if (request === 'obsidian') return {
    Plugin: class {}, PluginSettingTab: class {}, Setting: class {},
    ItemView: class { constructor(leaf) { this.app = leaf.app; this.contentEl = leaf.contentEl; } registerEvent() {} },
    Notice: class { constructor(text) { notices.push(text); } },
  };
  return load.call(this, request, ...args);
};
const GraphStyler = require('../main');
const { ExploreView, connectedNotes, noteExcerpt } = GraphStyler;
Module._load = load;

class El {
  constructor(tag, options = {}) { this.tag = tag; this.text = options.text || ''; this.children = []; this.attrs = options.attr || {}; this.ownerDocument = { defaultView: { navigator: global.navigator } }; }
  createEl(tag, options) { const el = new El(tag, options); this.children.push(el); return el; }
  createDiv(options) { return this.createEl('div', options); }
  createSpan(options) { return this.createEl('span', options); }
  empty() { this.children = []; }
  addClass() {}
  setAttr(key, value) { this.attrs[key] = value; }
  setText(text) { this.text = text; }
  walk() { return [this, ...this.children.flatMap((child) => child.walk())]; }
}
const file = (path) => ({ path, basename: path.split('/').pop().replace(/\.md$/, ''), extension: 'md' });
const origin = file('Draft.md'), a = file('Concepts/Same.md'), b = file('Papers/Same.md'), isolated = file('Alone.md');
const files = [origin, a, b, isolated];
const links = { 'Draft.md': { [a.path]: 1, 'Missing.md': 1, 'Alone.md': 0, 'Draft.md': 1 }, [a.path]: { 'Draft.md': 1 }, [b.path]: { 'Draft.md': 2 } };
assert.deepStrictEqual(connectedNotes(origin, files, links), [
  { file: a, outgoing: true, incoming: true }, { file: b, outgoing: false, incoming: true },
]);
assert.deepStrictEqual(connectedNotes(isolated, files, links), []);
assert.strictEqual(noteExcerpt('\uFEFF---\r\nsecret: value\r\n---\r\n\r\nBody <script>literal</script>'), 'Body <script>literal</script>');
assert.strictEqual(noteExcerpt('x'.repeat(2000)).length, 1200);
assert.strictEqual(noteExcerpt('---\ntitle: Empty\n---'), '');

(async () => {
  const active = new Map(files.map((item) => [item.path, item]));
  const generated = [], copied = [], opened = [];
  let pending;
  const app = {
    vault: { getAbstractFileByPath: (path) => active.get(path), getMarkdownFiles: () => [...active.values()], cachedRead: async (item) => `Body of ${item.path}` },
    metadataCache: { resolvedLinks: links },
    fileManager: { generateMarkdownLink: (item, from) => { generated.push([item.path, from]); return `[[${item.path}]]`; } },
    workspace: { getLeavesOfType: () => [], getLeaf: () => ({ openFile: async (item) => opened.push(item) }) },
  };
  const root = new El('div');
  const view = new ExploreView({ app, contentEl: root });
  await view.begin(origin);
  assert(root.walk().some((el) => el.text === 'Body of Draft.md'));
  // Operate the rendered checkbox and neighbor button, rather than only model helpers.
  const checkbox = root.walk().find((el) => el.tag === 'input');
  checkbox.checked = true;
  checkbox.onchange();
  assert(view.collected.has(origin));
  const next = root.walk().find((el) => el.tag === 'button' && el.text === 'Same');
  await next.onclick();
  assert.strictEqual(view.current, a);
  assert.strictEqual(view.origin, origin);
  await view.back();
  assert.strictEqual(view.current, origin);
  await view.navigate(a);
  view.collected.add(a);
  view.collected.add(b);
  global.navigator.clipboard.writeText = async (text) => copied.push(text);
  await view.copyLinks();
  assert.deepStrictEqual(generated, [[origin.path, origin.path], [a.path, origin.path], [b.path, origin.path]]);
  assert(copied[0].includes('Concepts/Same.md') && copied[0].includes('Papers/Same.md'));
  await view.openNote(b);
  assert.deepStrictEqual(opened, [b]);
  global.navigator.clipboard.writeText = async () => { throw Error('denied'); };
  await view.copyLinks();
  assert.strictEqual(view.collected.size, 3);
  assert(notices.at(-1).includes('Could not copy'));
  // Renames retain object identity; link generation must use the new path.
  active.delete(a.path); a.path = 'Concepts/Renamed.md'; active.set(a.path, a);
  global.navigator.clipboard.writeText = async (text) => copied.push(text);
  active.delete(b.path);
  await view.copyLinks();
  assert(copied.at(-1).includes('Concepts/Renamed.md'));
  assert(!copied.at(-1).includes('Papers/Same.md'));
  // A slow old preview cannot overwrite a newly navigated note or a closed view.
  app.vault.cachedRead = (item) => item === origin ? new Promise((resolve) => { pending = resolve; }) : Promise.resolve('Current preview');
  const oldRender = view.navigate(origin);
  await view.navigate(a);
  pending('Stale preview');
  await oldRender;
  assert(root.walk().some((el) => el.text === 'Current preview'));
  assert(!root.walk().some((el) => el.text === 'Stale preview'));
  const closing = view.navigate(origin);
  await view.onClose();
  pending('Closed preview');
  await closing;
  assert(!root.walk().some((el) => el.text === 'Closed preview'));
  active.delete(origin.path);
  const copyCount = copied.length;
  await view.copyLinks();
  assert.strictEqual(copied.length, copyCount);
  // Missing/deleted history entries are skipped without navigating to a replacement file.
  view.history = [a, origin];
  await view.back();
  assert.strictEqual(view.current, a);
  app.vault.cachedRead = async () => { throw Error('read denied'); };
  await view.render();
  assert(root.walk().some((el) => el.text === 'Could not read this note.'));
  await view.begin(isolated);
  assert.strictEqual(view.origin, isolated);
  assert.strictEqual(view.collected.size, 0);
  assert.deepStrictEqual(view.history, []);
  const many = Array.from({ length: 51 }, (_, index) => file(`N${index}.md`));
  for (const item of many) active.set(item.path, item);
  app.metadataCache.resolvedLinks = { [isolated.path]: Object.fromEntries(many.map((item) => [item.path, 1])) };
  await view.render();
  assert.strictEqual(root.walk().filter((el) => el.tag === 'button' && /^N\d+$/.test(el.text)).length, 50);
  await root.walk().find((el) => el.tag === 'button' && el.text === 'Show more').onclick();
  // The event handler starts render synchronously, even while the preview read is pending.
  assert.strictEqual(root.walk().filter((el) => el.tag === 'button' && /^N\d+$/.test(el.text)).length, 51);
  const plugin = Object.create(GraphStyler.prototype);
  let started, revealed;
  const leaf = { view: { begin: async (item) => { started = item; } }, setViewState: async (state) => assert.strictEqual(state.type, 'graph-styler-explore') };
  plugin.app = { workspace: { getLeavesOfType: () => [], getRightLeaf: (split) => { assert.strictEqual(split, true); return leaf; }, revealLeaf: async (item) => { revealed = item; } } };
  await plugin.openExplore(isolated);
  assert.strictEqual(started, isolated);
  assert.strictEqual(revealed, leaf);
  console.log('Focused exploration: data, rendered controls, navigation, copy, rename/delete, async preview and close checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
