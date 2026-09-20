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
  for (const file of ['bible-pages.js', 'script.js', 'projection-console.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
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

test('page label follows the projected verse and disappears for unmapped or cleared verses', () => {
  const { run, document } = fixture();
  run("biblePageMap.set('ヨハ3:16', { section: 'NT', page: 123 }); showBible();");
  assert.match(document.getElementById('b_out').innerHTML, /新約 p.123/);
  assert.equal(document.getElementById('bible_page_display').textContent, '新約 p.123');
  run("memosetu('17');");
  assert.doesNotMatch(document.getElementById('b_out').innerHTML, /新約 p.123/);
  assert.equal(document.getElementById('bible_page_display').textContent, '');
  run('clearBibleInputs();');
  assert.equal(document.getElementById('bible_page_display').textContent, '');
});

test('Bible size limits persist, synchronize controls and reach the projector', () => {
  const { run, document, storage } = fixture();
  run("currentMode = 'bible'; showBible(); updateBibleSetting('refMax', '42'); updateBibleSetting('bodyMax', '100');");
  assert.equal(document.getElementById('bible_ref_max').value, 42);
  assert.equal(document.getElementById('setting_bible_body_max').value, 100);
  assert.match(document.getElementById('b_out').innerHTML, /data-bible-ref-max="42"/);
  assert.equal(JSON.parse(storage.get('bibleDisplaySettings')).bodyMax, 100);
  run("updateBibleSetting('refMax', '');");
  assert.equal(run('bibleDisplaySettings.refMax'), 42);
  run('resetBibleSettings();');
  assert.equal(document.getElementById('bible_ref_max').value, 80);
});

test('general AI requires a saved key and renders an answer as plain text', async () => {
  const { run, document } = fixture();
  document.getElementById('generalAiQuestion').value = '案内文を考えて';
  run("geminiSettings.apiKey = ''; updateGeneralAiUi(); requestGeminiText = async () => { throw new Error('must not call'); };");
  await run('askGeneralAi()');
  assert.equal(document.getElementById('generalAiForm').hidden, true);
  assert.match(document.getElementById('generalAiStatus').textContent, /APIキー/);
  run("geminiSettings.apiKey = 'test-key'; updateGeneralAiUi(); requestGeminiText = async () => '<b>回答</b>'; ");
  await run('askGeneralAi()');
  assert.equal(document.getElementById('generalAiForm').hidden, false);
  assert.equal(document.getElementById('generalAiAnswer').textContent, '<b>回答</b>');
  assert.equal(document.getElementById('generalAiAnswer').innerHTML, '');
  assert.equal(document.getElementById('generalAiSubmit').disabled, false);
});

test('general AI prevents duplicate requests and recovers after failure', async () => {
  const { run, document } = fixture();
  document.getElementById('generalAiQuestion').value = '質問';
  run("geminiSettings.apiKey = 'test-key'; var rejectQuestion, questionCalls = 0; recordGeminiError = () => {}; requestGeminiText = () => { questionCalls++; return new Promise((resolve, reject) => { rejectQuestion = reject; }); };");
  const pending = run('askGeneralAi()');
  await run('askGeneralAi()');
  assert.equal(run('questionCalls'), 1);
  run("rejectQuestion(new Error('接続エラー'));");
  await pending;
  assert.match(document.getElementById('generalAiStatus').textContent, /接続エラー/);
  assert.equal(document.getElementById('generalAiSubmit').disabled, false);
});

function dualFixture() {
  const setup = fixture();
  setup.run(`
    function makeProjection() {
      const nodes = new Map();
      const classes = new Set();
      const doc = {
        documentElement: { dataset: {}, style: { setProperty() {} } },
        body: { classList: {
          add(...names) { names.forEach(name => classes.add(name)); },
          remove(...names) { names.forEach(name => classes.delete(name)); },
          contains(name) { return classes.has(name); },
          toggle(name, force) { if (force) classes.add(name); else classes.delete(name); }
        } },
        getElementById(id) {
          if (!nodes.has(id)) nodes.set(id, { innerHTML: '', innerText: '', style: {} });
          return nodes.get(id);
        }
      };
      return { document: doc, closed: false, close() { this.closed = true; }, addEventListener() {} };
    }
    display_win = makeProjection(); chineseDisplayWindow = makeProjection(); dualProjection = true;
    refreshProjectionConsole = () => {}; bindProjectionPreview = () => {}; bindDisplayFullscreenEvents = () => {};
    bible[2][1] = '約3:16'; bible[2][2] = '中文經文';
  `);
  return setup;
}

test('two outputs separate scripture, synchronize live info and mode, and restore bilingual output on disable', () => {
  const { run, document, storage } = dualFixture();
  document.getElementById('jtitle').value = '日本語題';
  document.getElementById('ctitle').value = '中文題';
  run('showBible(); switchScreen("bible");');
  assert.match(run('display_win.document.getElementById("b_out").innerHTML'), /本文16/);
  assert.doesNotMatch(run('display_win.document.getElementById("b_out").innerHTML'), /中文經文|id="ch"/);
  assert.match(run('chineseDisplayWindow.document.getElementById("b_out").innerHTML'), /中文經文/);
  assert.doesNotMatch(run('chineseDisplayWindow.document.getElementById("b_out").innerHTML'), /本文16|id="jp"/);
  for (const win of ['display_win', 'chineseDisplayWindow']) {
    assert.equal(run(`${win}.document.getElementById('t_thema_ja').innerHTML`), '日本語題');
    assert.equal(run(`${win}.document.getElementById('t_thema_ch').innerHTML`), '中文題');
    assert.equal(run(`${win}.document.body.classList.contains('bible-mode')`), true);
  }
  run('const oldChinese = chineseDisplayWindow; setDualProjection(false);');
  assert.equal(run('oldChinese.closed'), true);
  assert.equal(run('display_win.closed'), false);
  assert.equal(storage.get('dualProjection'), 'false');
  assert.equal(run('display_win.document.documentElement.dataset.bibleLanguage'), 'both');
  assert.match(run('display_win.document.getElementById("b_out").innerHTML'), /本文16.*中文經文/s);
  assert.equal(run('projectedBible.verse'), '16');
});

test('hymn verse, mode and blackout survive reconnecting either window, and clearing updates both', () => {
  const { run } = dualFixture();
  run(`currentTitleInfo = ['1', '中文歌名', '日本語曲名'];
    currentLyricsSections = [{ label: '1', content: '<div>第一節</div>' }, { label: '2', content: '<div>第二節</div>' }];
    showLyricsVerse(1); toggleBlackout();
    chineseDisplayWindow.close(); chineseDisplayWindow = makeProjection(); initializeProjectionWindow(chineseDisplayWindow);`);
  for (const win of ['display_win', 'chineseDisplayWindow']) {
    assert.match(run(`${win}.document.getElementById('h_output').innerHTML`), /第二節/);
    assert.equal(run(`${win}.document.body.classList.contains('hymn-mode')`), true);
    assert.equal(run(`${win}.document.body.classList.contains('is-blacked-out')`), true);
  }
  run(`switchScreen('bible'); display_win.close(); display_win = makeProjection(); initializeProjectionWindow(display_win);`);
  assert.equal(run('currentMode'), 'bible');
  assert.equal(run(`display_win.document.body.classList.contains('bible-mode')`), true);
  run('toggleBlackout(); clearDisplayedHymn();');
  for (const win of ['display_win', 'chineseDisplayWindow']) {
    assert.equal(run(`${win}.document.getElementById('h_output').innerHTML`), '');
    assert.equal(run(`${win}.document.body.classList.contains('is-blacked-out')`), false);
  }
});

test('blocked second popup can be retried without reopening the first, and saved mode does not open on startup', () => {
  const { run, storage } = dualFixture();
  storage.set('dualProjection', 'true');
  run(`let opens = 0; window.open = () => { opens++; return null; }; loadProjectionSettings();`);
  assert.equal(run('opens'), 0);
  run(`chineseDisplayWindow = null; showToast = () => {}; openwindow();`);
  assert.equal(run('opens'), 1);
  assert.equal(run('chineseDisplayWindow'), null);
  run(`window.open = () => { opens++; return makeProjection(); }; openwindow();`);
  assert.equal(run('opens'), 2);
  assert.equal(run('getProjectionWindows().length'), 2);
  run(`localStorage.getItem = () => { throw Error('unavailable'); }; loadProjectionSettings();`);
  assert.equal(run('dualProjection'), false);
});

test('verse clearing still reaches Chinese output when primary window has been closed', () => {
  const { run } = dualFixture();
  run('showBible(); display_win.close(); clearBibleInputs();');
  assert.equal(run('chineseDisplayWindow.document.getElementById("b_out").innerHTML'), '');
});
