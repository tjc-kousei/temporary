// Run separately from regression tests: node tests/bible-performance.bench.cjs
const { performance } = require('node:perf_hooks');
const { fixture } = require('./helpers/bible-fixture.cjs');
const { run } = fixture();
run(`
  function previousFind(book, chapter, verse) {
    if (book === '' || !Abbre[book] || !/^\\d+$/.test(String(chapter)) || !/^\\d+$/.test(String(verse))) return null;
    return bible.find(row => row && row[3] === \`\${Abbre[book]}\${Number(chapter)}:\${Number(verse)}\`) || null;
  }
  function previousSearch(query) {
    const lower = query.toLocaleLowerCase();
    return bible.slice(1).filter(row => row.slice(1, 5).some(value => String(value || '').toLocaleLowerCase().includes(lower)));
  }
  const queries = ['神', '愛', 'ヨハ3:16', '创1:', 'はじめに', 'unlikely-no-match-12345'];
  function lookupBatch(fn) {
    for (let i = 0; i < 100; i++) fn(65, 22, 1 + i % 21);
  }
  function searchBatch(fn) { for (const query of queries) fn(query); }
`);
const start = performance.now();
run('convertbibleCSVtoArray(csv)');
console.log(`CSV parse + index: ${(performance.now() - start).toFixed(2)} ms (${run('bible.length - 2')} verses)`);
function medianMs(source) {
  run(source); // Warm up before recording seven samples.
  const samples = [];
  for (let i = 0; i < 7; i++) {
    const started = performance.now();
    run(source);
    samples.push(performance.now() - started);
  }
  return samples.sort((a, b) => a - b)[3];
}
for (const [label, previous, current] of [
  ['Lookup (100 late-book references)', 'lookupBatch(previousFind)', 'lookupBatch(findBibleRow)'],
  ['Full-text search (6 queries)', 'searchBatch(previousSearch)', 'searchBatch(searchBibleRows)'],
]) {
  const before = medianMs(previous), after = medianMs(current);
  console.log(`${label}: ${before.toFixed(2)} -> ${after.toFixed(2)} ms (${(before / after).toFixed(1)}x)`);
}
