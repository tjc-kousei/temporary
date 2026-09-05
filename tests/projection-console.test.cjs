const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
  const elements = new Map();
  const makeElement = () => ({ value: '', innerHTML: '', innerText: '', textContent: '', style: {},
    classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, replaceChildren() {}, append() {}, addEventListener() {} });
  const document = { cookie: '', documentElement: { style: { setProperty() {} } }, getElementById(id) { if (!elements.has(id)) elements.set(id, makeElement()); return elements.get(id); },
    createElement: makeElement, querySelectorAll: () => [], querySelector: () => null };
  const context = vm.createContext({ document, window: { addEventListener() {} }, console, setTimeout() {}, clearTimeout() {},
    localStorage: { getItem() { return null; }, setItem() {} } });
  for (const file of ['script.js', 'projection-console.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  const run = code => vm.runInContext(code, context);
  run(`bible = [[], ['','','','ヨハ3:16','本文16'], ['','','','ヨハ3:17','本文17']];
    abbre = '42'; syou = '3'; setu = '16';`);
  return { run, document };
}

test('editing and saving the draft leaves confirmed title unchanged, even when commit runs for another feature', () => {
  const { run, document } = fixture();
  run(`appliedInfo.jtitle = '確定済み'; display_win = { closed: false, document };
    fontsizecommit = () => {}; applyColors = () => {}; applyTicker = () => {};`);
  document.getElementById('jtitle').value = '入力途中';
  run('updateInfoDraft(); commit();');
  assert.equal(document.getElementById('t_thema_ja').innerHTML, '確定済み');
  assert.match(document.getElementById('info-draft-status').textContent, /未反映/);
  run('refreshProjectionConsole = () => {}; applyInfoDraft();');
  assert.equal(document.getElementById('t_thema_ja').innerHTML, '入力途中');
});

test('invalid references and clearing the draft preserve the projected verse', () => {
  const { run } = fixture();
  assert.equal(run('showBible()'), true);
  assert.equal(run("memosetu('999'); showBible()"), false);
  assert.equal(run('projectedBible.verse'), '16');
  run('clearBibleDraft();');
  assert.equal(run('projectedBible.verse'), '16');
  assert.equal(run('setu'), '');
});

test('next verse starts from the live verse, not an unfinished draft, and stops at chapter bounds', () => {
  const { run } = fixture();
  run(`showBible(); memosetu('999'); checkwindow = () => {}; updateBibleBookSelectionUi = () => {};`);
  run('navigateBible(1);');
  assert.equal(run('projectedBible.verse'), '17');
  run('navigateBible(1);');
  assert.equal(run('projectedBible.verse'), '17');
});

test('switching display modes does not publish unconfirmed information or verse input', () => {
  const { run } = fixture();
  run(`showBible(); memosetu('999'); appliedInfo.jtitle = '確定';
    document.getElementById('jtitle').value = '下書き';
    display_win = { closed: false, document }; openwindow = () => {};
    switchScreen = mode => { currentMode = mode; }; bindProjectionPreview = () => {};
    refreshProjectionConsole = () => {}; fontsizecommit = () => {}; applyColors = () => {}; applyTicker = () => {};`);
  run("checkwindow('title'); checkwindow('bible');");
  assert.equal(run('projectedBible.verse'), '16');
  assert.equal(run("document.getElementById('t_thema_ja').innerHTML"), '確定');
  assert.match(run("document.getElementById('b_out').innerHTML"), /ヨハ3:16/);
});

test('blackout toggles the overlay without changing live content or mode', () => {
  const { run } = fixture();
  run(`showBible(); currentMode = 'bible'; let dark = false;
    display_win = { closed: false, document: { getElementById: () => ({}), body: { classList: { toggle() { dark = !dark; } } } } };
    refreshProjectionConsole = () => {}; toggleBlackout();`);
  assert.equal(run('dark'), true);
  assert.equal(run('currentMode'), 'bible');
  assert.equal(run('projectedBible.verse'), '16');
  run('toggleBlackout();');
  assert.equal(run('dark'), false);
});

test('font settings do not commit an unfinished verse', () => {
  const { run } = fixture();
  run(`showBible(); currentMode = 'bible'; memosetu('17'); display_win = { closed: false, document };`);
  run("updateBibleSetting('bodyMax', '70');");
  assert.equal(run('projectedBible.verse'), '16');
  assert.match(run("document.getElementById('b_out').innerHTML"), /ヨハ3:16/);
});

test('a slow lyric response cannot replace a more recently selected hymn', async () => {
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
  assert.match(run('currentLyricsSections[0].content'), /二番の本文/);
});
