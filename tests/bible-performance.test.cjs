const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/bible-fixture.cjs');

test('indexed lookup and chapter counts match the entire Bible dataset', () => {
  const { run } = fixture();
  run('convertbibleCSVtoArray(csv)');
  assert.equal(run(`BiblePages.verses(bible).every(item =>
    findBibleRow(item.book, item.chapter, item.verse) === getBibleIndex().byReference.get(item.ref))`), true);
  assert.equal(run(`(() => {
    const counts = new Map();
    bible.slice(1).forEach(row => {
      if (!row[3]) return;
      const prefix = row[3].slice(0, row[3].lastIndexOf(':') + 1);
      counts.set(prefix, (counts.get(prefix) || 0) + 1);
    });
    return [...counts].every(([prefix, count]) => getBibleIndex().chapterCounts.get(prefix) === count);
  })()`), true);
  for (const reference of ["'', 1, 1", "0, '', 1", "0, 1, 'x'", "65, 999, 1", "66, 1, 1"]) {
    assert.equal(run(`findBibleRow(${reference})`), null);
  }
  run("abbre = 42; document.getElementById('syou').value = '3'; countVersesInChapter()");
  assert.equal(run("document.getElementById('verse_count_display').innerText"), 'この章の節数: 36');
});

test('cached text search preserves result order, fields, case and no-match behavior', () => {
  const { context, run } = fixture();
  run('convertbibleCSVtoArray(csv)');
  for (const query of ['神', '愛', '创1:', 'ヨハ3:16', 'ABC', 'はじめに', '。', 'unlikely-no-match-12345']) {
    context.query = query;
    assert.equal(run(`(() => {
      const expected = bible.slice(1).filter(row => row.slice(1, 5)
        .some(value => String(value || '').toLocaleLowerCase().includes(query.toLocaleLowerCase())));
      const actual = searchBibleRows(query);
      return actual.length === expected.length && actual.every((row, index) => row === expected[index]);
    })()`), true, query);
  }
  run(`convertbibleCSVtoArray('id,ch_info,ch,jp_info,jp\\n1,中1:1,MiXeD,創1:1,本文');`);
  assert.equal(run("searchBibleRows('mixed').length"), 1);
  assert.equal(run("searchBibleRows('中MiXeD').length"), 0);
});

test('reloading a shorter CSV discards old rows and rebuilds all indexes', () => {
  const { run } = fixture();
  run('convertbibleCSVtoArray(csv)');
  assert.notEqual(run('findBibleRow(65, 22, 21)'), null);
  run("convertbibleCSVtoArray('id,ch_info,ch,jp_info,jp\\n1,创1:1,新文本,創1:1,差し替え');");
  assert.equal(run('findBibleRow(65, 22, 21)'), null);
  assert.equal(run("searchBibleRows('差し替え').length"), 1);
  assert.equal(run('bible.length'), 2);
  assert.equal(run("getBibleIndex().chapterCounts.get('創1:')"), 1);
});

test('page refresh shares pending requests, skips unchanged rendering, and recovers after failure', async () => {
  const { run } = fixture();
  run(`convertbibleCSVtoArray('id,ch_info,ch,jp_info,jp\\n1,创1:1,中,創1:1,日本語');
    let renders = 0, requests = 0, conversions = 0, expansions = 0;
    renderProjectedBible = () => { renders++; };
    const originalVerses = BiblePages.verses, originalExpand = BiblePages.expand;
    BiblePages.verses = rows => { conversions++; return originalVerses(rows); };
    BiblePages.expand = (data, items) => { expansions++; return originalExpand(data, items); };
    let resolveLoad;
    BiblePages.load = () => { requests++; return new Promise(resolve => { resolveLoad = resolve; }); };
    const pageData = { version: 1, boundaries: [{ ref: '創1:1', page: 1 }] };
    console = { warn() {} };`);
  const first = run('loadBiblePageData()');
  assert.equal(run('loadBiblePageData()'), first);
  run('resolveLoad(pageData)');
  await first;
  assert.equal(run('renders'), 1);
  const unchanged = run('loadBiblePageData()');
  run('resolveLoad(JSON.parse(JSON.stringify(pageData)))');
  await unchanged;
  assert.equal(run('renders'), 1);
  assert.equal(run('expansions'), 1);
  assert.equal(run('conversions'), 1);
  run("BiblePages.load = async () => { throw new Error('offline'); }");
  await run('loadBiblePageData()');
  assert.equal(run("biblePageMap.get('創1:1').page"), 1);
  run('BiblePages.load = async () => ({ version: 1, boundaries: [{ ref: "創1:1", page: 2 }] })');
  await run('loadBiblePageData()');
  assert.equal(run('renders'), 2);
  assert.equal(run("biblePageMap.get('創1:1').page"), 2);
  // A response for old CSV rows must not overwrite data after a reload.
  run('BiblePages.load = () => new Promise(resolve => { resolveLoad = resolve; })');
  const stale = run('loadBiblePageData()');
  run("convertbibleCSVtoArray('id,ch_info,ch,jp_info,jp'); resolveLoad(pageData)");
  await stale;
  assert.equal(run('renders'), 2);
});
