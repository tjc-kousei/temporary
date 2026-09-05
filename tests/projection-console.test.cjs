const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
  const elements = new Map(), storage = new Map();
  const makeElement = () => ({ value: '', innerHTML: '', innerText: '', textContent: '', options: [{}], hidden: true, style: {},
    classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, replaceChildren() {}, append() {}, prepend() {}, addEventListener() {}, dispatchEvent() {} });
  const document = { cookie: '', documentElement: { dataset: {}, style: { setProperty() {} } },
    getElementById(id) { if (!elements.has(id)) elements.set(id, makeElement()); return elements.get(id); },
    createElement: makeElement, querySelectorAll: () => [], querySelector: () => makeElement() };
  const context = vm.createContext({ document, window: { location: { href: 'https://example.test/app/' }, addEventListener() {} }, console,
    Event: class { constructor(type) { this.type = type; } }, AbortController,
    setTimeout() {}, clearTimeout() {}, localStorage: { getItem(key) { return storage.get(key) ?? null; }, setItem(key, value) { storage.set(key, value); } } });
  for (const file of ['script.js', 'projection-console.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  const run = code => vm.runInContext(code, context);
  run(`bible = [[], ['','','','ヨハ3:1','本文1'], ['','','','ヨハ3:16','本文16'], ['','','','ヨハ3:17','本文17']];
    abbre = '42'; syou = '3'; setu = '16';
    display_win = { closed: false, document }; fontsizecommit = () => {}; applyColors = () => {}; applyTicker = () => {};`);
  return { run, document, storage };
}

for (const style of ['classic', 'modern']) {
  test(`${style}: basic information input updates the projector immediately`, () => {
    const { run, document } = fixture();
    document.documentElement.dataset.uiStyle = style;
    document.getElementById('jtitle').value = '編集中のタイトル';
    run('updateLiveInfo();');
    assert.equal(document.getElementById('t_thema_ja').innerHTML, '編集中のタイトル');
    document.getElementById('jtitle').value = '';
    run('updateLiveInfo();');
    assert.equal(document.getElementById('t_thema_ja').innerHTML, '');
  });
  test(`${style}: each verse input updates live content, with no Enter or confirmation`, () => {
    const { run, document } = fixture();
    document.documentElement.dataset.uiStyle = style;
    run("memosetu('1');");
    assert.match(document.getElementById('b_out').innerHTML, /ヨハ3:1</);
    run("memosetu('16');");
    assert.match(document.getElementById('b_out').innerHTML, /ヨハ3:16/);
    run("clearBibleInputs();");
    assert.equal(document.getElementById('b_out').innerHTML, '');
  });
}

test('style selection defaults to classic and persists only the layout without changing live contents', () => {
  const { run, document, storage } = fixture();
  run('refreshProjectionConsole = () => {}; updateFullscreenButton = () => {};');
  assert.equal(run('getSavedUiStyle()'), 'classic');
  document.getElementById('jtitle').value = '維持する入力';
  run('updateLiveInfo(); showBible(); setUiStyle("modern");');
  assert.equal(document.documentElement.dataset.uiStyle, 'modern');
  assert.equal(storage.get('meetingUiStyle'), 'modern');
  assert.equal(run('getSavedUiStyle()'), 'modern');
  assert.equal(document.getElementById('jtitle').value, '維持する入力');
  assert.equal(document.getElementById('t_thema_ja').innerHTML, '維持する入力');
  assert.equal(run('projectedBible.verse'), '16');
  run('setUiStyle("classic");');
  assert.equal(run('getSavedUiStyle()'), 'classic');
  assert.equal(document.getElementById('b_out').innerHTML.includes('ヨハ3:16'), true);
  storage.set('meetingUiStyle', 'invalid');
  assert.equal(run('getSavedUiStyle()'), 'classic');
});

test('style falls back to classic when browser storage is unavailable', () => {
  const { run, document } = fixture();
  run(`localStorage.getItem = () => { throw new Error('blocked'); };
    localStorage.setItem = () => { throw new Error('blocked'); };
    refreshProjectionConsole = () => {}; updateFullscreenButton = () => {};`);
  assert.equal(run('getSavedUiStyle()'), 'classic');
  run('setUiStyle("modern");');
  assert.equal(document.documentElement.dataset.uiStyle, 'modern');
});

test('capture cannot request permission, open a window, or switch projection mode while disabled', async () => {
  const { run } = fixture();
  run(`navigator = { mediaDevices: { getDisplayMedia() { throw new Error('capture must not run'); } } };
    openwindow = () => { throw new Error('must not open'); }; currentMode = 'bible';`);
  await run('startCapture()');
  await run('reselectCapture()');
  await run('initializeCapture()');
  run('checkwindow("capture"); switchScreen("capture");');
  assert.equal(run('currentMode'), 'bible');
  assert.equal(run('captureStream'), null);
});

test('actual inputs wire the immediate paths and capture controls stay hidden', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  for (const id of ['worship', 'jtitle', 'ctitle', 'speecher', 'translator', 'hymn', 'hymn2nd']) {
    const tag = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))[0];
    assert.match(tag, /oninput="[^"]*updateLiveInfo\(\)/);
  }
  assert.match(html.match(/<input[^>]*id="prehymn"[^>]*>/)[0], /oninput="[^"]*recievehymn/);
  assert.match(html.match(/<input[^>]*id="setu"[^>]*>/)[0], /oninput="[^"]*memosetu/);
  assert.match(html.match(/<button[^>]*id="btn-mode-capture"[^>]*>/)[0], /hidden disabled/);
  assert.doesNotMatch(html, /投影に反映|聖句を投影（Enter）|曲を選択/);
});

test('blackout retains the projection while toggling the output overlay', () => {
  const { run } = fixture();
  run(`showBible(); currentMode = 'bible'; let dark = false;
    display_win = { closed: false, document: { getElementById: () => ({}), body: { classList: { toggle() { dark = !dark; } } } } };
    refreshProjectionConsole = () => {}; toggleBlackout();`);
  assert.equal(run('dark'), true);
  assert.equal(run('projectedBible.verse'), '16');
  run('toggleBlackout();');
  assert.equal(run('dark'), false);
});

test('last updated date uses server metadata in Japan time and ignores missing or invalid values', async () => {
  const { run, document } = fixture();
  assert.equal(run('showLastUpdated(null)'), false);
  assert.equal(run('showLastUpdated("invalid")'), false);
  assert.equal(document.getElementById('last-updated').hidden, true);
  run(`fetch = async (url, options) => {
    if (options.method !== 'HEAD') throw new Error('metadata only');
    return { ok: true, headers: { get: () => 'Fri, 04 Sep 2026 23:00:00 GMT' } };
  };`);
  await run('loadLastUpdated()');
  assert.equal(document.getElementById('last-updated-time').textContent, '2026/09/05');
  assert.equal(document.getElementById('last-updated-time').dateTime, '2026-09-04T23:00:00.000Z');
  assert.equal(document.getElementById('last-updated').hidden, false);
});

test('unavailable update metadata does not show a fabricated current date', async () => {
  const { run, document } = fixture();
  run('fetch = async () => { throw new Error("offline"); };');
  await run('loadLastUpdated()');
  assert.equal(document.getElementById('last-updated').hidden, true);
});

test('a slow lyric response cannot replace a more recently entered hymn', async () => {
  const { run } = fixture();
  run(`hymn = [['1','一','One'], ['2','二','Two']];
    let finishFirst, finishSecond;
    let loadCount = 0;
    loadLyricsData = () => new Promise(resolve => { if (++loadCount === 1) finishFirst = resolve; else finishSecond = resolve; });
    renderLyricsControls = () => {}; switchScreen = () => {}; showTitleInPopup = () => {}; updateActiveButton = () => {};`);
  const first = run("recievehymn('1')");
  const second = run("recievehymn('2')");
  run("finishSecond({'2.txt': '[1]二番の本文'});");
  await second;
  run("finishFirst({'1.txt': '[1]一番の本文'});");
  await first;
  assert.equal(run('currentTitleInfo[0]'), '2');
});

test('clearing the hymn number immediately clears projected lyrics', async () => {
  const { run, document } = fixture();
  document.getElementById('h_output').innerHTML = '以前の歌詞';
  document.getElementById('h_bg_number').innerText = '1';
  await run("recievehymn('')");
  assert.equal(document.getElementById('h_output').innerHTML, '');
  assert.equal(document.getElementById('h_bg_number').innerText, '');
  assert.equal(run('currentTitleInfo'), null);
});
