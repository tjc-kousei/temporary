const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '../..');
const csv = fs.readFileSync(path.join(root, 'Data.csv'), 'utf8');

function fixture() {
  const elements = new Map();
  const context = vm.createContext({
    window: { addEventListener() {} }, console,
    document: { getElementById(id) {
      if (!elements.has(id)) elements.set(id, { value: '', innerText: '' });
      return elements.get(id);
    } },
  });
  for (const file of ['bible-pages.js', 'script.js', 'projection-console.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  }
  const run = source => vm.runInContext(source, context);
  context.csv = csv;
  return { context, run, csv };
}

module.exports = { fixture };
