/* Real-browser checks with a private ephemeral HTTP server. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
let base = process.env.SLIDES_TEST_URL;
const executablePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const errors = [];
let activeBrowser, activeServer, activeEditor;
async function waitFor(check, message, timeout = 8000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) { if (await check()) return; await new Promise(r => setTimeout(r, 80)); }
  throw new Error(message);
}
async function run() {
  await fs.mkdir('test-results', { recursive: true });
  let server;
  if (!base) {
    const root = path.resolve(__dirname, '..');
    server = activeServer = http.createServer(async (req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/assembly(?=\/)/, '');
      const file = path.resolve(root, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '');
      if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
      try {
        const data = await fs.readFile(file);
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.csv': 'text/csv', '.png': 'image/png' };
        res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Last-Modified': new Date('2026-11-17T00:00:00Z').toUTCString() }); res.end(data);
      } catch { res.writeHead(404); res.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/assembly/`;
  }
  const browser = activeBrowser = await chromium.launch({ executablePath, headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, serviceWorkers: 'block', acceptDownloads: true });
  context.setDefaultTimeout(10000);
  context.on('page', page => { page.on('pageerror', error => errors.push(`${page.url()}: ${error.stack || error.message}`)); page.on('dialog', dialog => dialog.accept()); });
  const geminiRequests = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/bible-pages-zh.json')) return route.fulfill({ json: {
      version: 1, boundaries: [{ ref: 'ヨハ3:16', page: 123 }]
    } });
    if (url.origin === new URL(base).origin || !url.protocol.startsWith('http')) return route.continue();
    if (url.hostname === 'generativelanguage.googleapis.com') {
      const isGeneration = url.pathname.endsWith(':generateContent');
      geminiRequests.push({ path: url.pathname, body: isGeneration ? route.request().postDataJSON() : null });
      if (!isGeneration) return route.abort();
      return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: '["翻訳候補","第二候補","第三候補"]' }] } }] } });
    }
    if (url.pathname.includes('api.php')) return route.fulfill({ json: {
      success: true,
      data: { '1.txt': '[1]\nテストの歌詞\n[2]\n日本語一行目\n日本語二行目\n日本語三行目\n日本語四行目\n[3]\n恵(めぐ)み　' + '主をたたえよ'.repeat(6) },
      data_zh: { '1.txt': '[1]\n中文歌詞\n[2]\n中文第一行\n中文第二行\n中文第三行\n中文第四行\n[3]\n' + '讚美我主恩典'.repeat(6) }
    } });
    if (url.pathname.includes('hymn-recommendations')) return route.fulfill({ json: { groups: [] } });
    return route.abort();
  });
  const main = await context.newPage(); await main.goto(base); await main.waitForFunction(() => typeof SlideProjection !== 'undefined' && document.querySelector('#projection-status').textContent.includes('未接続'));
  assert.equal(context.pages().length, 1, 'startup never opens a projector');
  await main.locator('#title_font_jtitle').evaluate(input => {
    input.value = '6.35';
    input.dispatchEvent(new Event('input'));
    localStorage.setItem('dualProjection', 'true');
  });
  await main.reload();
  await main.waitForFunction(() => document.querySelector('#title_font_jtitle').value === '6.35');
  assert.equal(await main.evaluate(() => dualProjection), false);
  assert.equal(await main.locator('#setting_dual_projection').count(), 0);
  assert.equal(await main.locator('br + a[href="https://hymn.tjckousei.com/"]').count(), 1);
  const editorPromise = context.waitForEvent('page'); await main.getByRole('button', { name: 'スライド編集', exact: true }).click(); const editor = activeEditor = await editorPromise;
  await editor.waitForFunction(() => !document.querySelector('#workspace').inert);
  const thumbs = editor.locator('#slide-list .slide-item');
  const originalId = await thumbs.first().getAttribute('data-slide-id');
  await thumbs.first().click();
  await editor.keyboard.press('Control+d');
  assert.equal(await thumbs.count(), 2);
  await editor.keyboard.press('ArrowUp');
  await editor.keyboard.press('Delete');
  await editor.getByRole('button', { name: '削除する', exact: true }).click();
  assert.equal(await thumbs.count(), 1);
  assert.notEqual(await thumbs.first().getAttribute('data-slide-id'), originalId);
  await editor.locator('#panel-home [data-action="delete-slide"]').click();
  await editor.locator('#delete-dialog').getByText('キャンセル').click();
  assert.equal(await editor.locator('#canvas > .slide-text').count(), 2);
  await editor.locator('#panel-home [data-action="delete-slide"]').click();
  await editor.locator('[data-action="confirm-delete-slide"]').click();
  assert.equal(await thumbs.count(), 1);
  assert.equal(await editor.locator('#canvas > .slide-element').count(), 0);
  await editor.keyboard.press('Control+z');
  assert.equal(await editor.locator('#canvas > .slide-text').count(), 2);
  await editor.keyboard.press('Control+z');
  await editor.keyboard.press('Control+z');
  assert.equal(await thumbs.count(), 1);
  assert.equal(await thumbs.first().getAttribute('data-slide-id'), originalId);
  console.log('PASS: thumbnail shortcuts, slide deletion, cancellation and undo');
  // Classic scrollbars consume layout space, as in the Windows recording.
  await editor.addStyleTag({ content: '#stage-scroll::-webkit-scrollbar { width: 17px; height: 17px; }' });
  await editor.setViewportSize({ width: 1490, height: 950 });
  await editor.locator('#canvas > .slide-text').first().click();
  await editor.locator('#zoom').selectOption('1.5');
  const stage = editor.locator('#stage-scroll');
  assert(await stage.evaluate(n => n.scrollWidth > n.clientWidth && n.scrollHeight > n.clientHeight));
  await stage.evaluate(n => n.scrollTo(180, 120));
  await editor.locator('#zoom').selectOption('fit');
  for (const viewport of [{ width: 1490, height: 950 }, { width: 1280, height: 720 }]) {
    await editor.setViewportSize(viewport);
    const bounds = await stage.evaluate(async n => {
      const samples = [];
      for (let i = 0; i < 12; i++) {
        await new Promise(requestAnimationFrame);
        const slide = n.querySelector('#canvas').getBoundingClientRect();
        samples.push([n.clientWidth, n.clientHeight, slide.x, slide.y, slide.width, slide.height]);
      }
      return { samples, viewport: [n.offsetWidth, n.offsetHeight], scroll: [n.scrollLeft, n.scrollTop] };
    });
    for (const sample of bounds.samples.slice(2)) {
      assert.deepEqual(sample.slice(0, 2), bounds.viewport, 'fit should reserve no scrollbars');
      assert.deepEqual(sample, bounds.samples.at(-1), 'fit must keep the selected slide stationary');
    }
    assert.deepEqual(bounds.scroll, [0, 0]);
  }
  await editor.setViewportSize({ width: 1500, height: 1000 });
  await editor.screenshot({ path: 'test-results/slides-editor-initial.png', fullPage: true });
  const title = editor.locator('#canvas > .slide-text').first();
  await title.dblclick();
  await editor.locator('#canvas .tiptap').fill('恵みによって歩む');
  await main.getByRole('button', { name: 'スライド編集', exact: true }).click();
  assert.equal(context.pages().length, 2);
  assert.equal(await editor.locator('#canvas .tiptap').textContent(), '恵みによって歩む');
  // Apply a partial mark to the last three characters using actual editor selection.
  await editor.keyboard.press('End'); await editor.keyboard.down('Shift'); for (let i = 0; i < 3; i++) await editor.keyboard.press('ArrowLeft'); await editor.keyboard.up('Shift');
  await editor.waitForFunction(() => window.getSelection().toString() === 'て歩む');
  await editor.getByRole('button', { name: '太字', exact: true }).click();
  await editor.waitForFunction(() => document.querySelector('#canvas .tiptap strong')?.textContent === 'て歩む');
  assert.match(await editor.locator('#canvas .tiptap').innerHTML(), /<strong>て歩む<\/strong>/);
  await editor.locator('#font-size').fill('72'); await editor.locator('#font-size').dispatchEvent('change');
  assert.match(await editor.locator('#canvas .tiptap').innerHTML(), /font-size: 72px/);
  await editor.keyboard.press('Escape');
  await editor.locator('#slide-name').fill('恵みのメッセージ'); await editor.locator('#slide-name').press('Tab');
  await editor.locator('#deck-name').fill('礼拝スライド'); await editor.locator('#deck-name').press('Tab');
  await waitFor(async () => (await editor.locator('#save-status').textContent()).includes('保存済み'), 'autosave did not complete');
  await editor.reload(); await editor.waitForFunction(() => !document.querySelector('#workspace').inert);
  assert.equal(await editor.locator('#deck-name').inputValue(), '礼拝スライド');
  assert.equal(await editor.locator('#slide-name').inputValue(), '恵みのメッセージ');
  assert.equal(await editor.locator('#canvas strong').textContent(), 'て歩む');
  console.log('PASS: partial text formatting and IndexedDB recovery');
  // The existing projector is opened only by the explicit publish command.
  const outputPromise = context.waitForEvent('page'); await editor.getByRole('button', { name: '▶ 投影へ反映', exact: true }).click(); const output = await outputPromise;
  await output.waitForFunction(() => document.body.classList.contains('slides-mode') && document.querySelector('#slides-view').textContent.includes('恵みによって歩む'));
  assert.equal(await output.locator('#common-logo').isVisible(), false);
  assert.equal(await output.locator('#b_footer_ticker').isVisible(), false);
  assert.equal(await output.locator('#t_thema_ja').evaluate(el => el.style.fontSize), '6.35em');
  console.log('PASS: first explicit projection');
  await editor.locator('#canvas > .slide-text').first().dblclick(); await editor.locator('#canvas .tiptap').fill('編集途中の文字'); await editor.keyboard.press('Escape');
  assert.match(await output.locator('#slides-view').textContent(), /恵みによって歩む/, 'draft must not leak into projection');
  await editor.getByRole('button', { name: '▶ 投影へ反映', exact: true }).click();
  await waitFor(async () => (await output.locator('#slides-view').textContent()).includes('編集途中の文字'), 'explicit publish failed');
  // Shape insertion, pointer movement, exact property edits, undo/redo.
  await editor.getByRole('tab', { name: '挿入', exact: true }).click(); await editor.getByRole('button', { name: '▭ 四角形', exact: true }).click();
  let shape = editor.locator('#canvas > .slide-rect'); const before = await shape.boundingBox();
  await editor.mouse.move(before.x + 30, before.y + 30); await editor.mouse.down(); await editor.mouse.move(before.x + 90, before.y + 60, { steps: 8 }); await editor.mouse.up();
  let movedX = Number(await editor.locator('#prop-x').inputValue()); assert(movedX > 150, `pointer drag should change x, actual ${movedX}`);
  await editor.locator('#prop-x').fill('440'); await editor.locator('#prop-x').press('Tab');
  await editor.locator('#prop-rotation').fill('25'); await editor.locator('#prop-rotation').press('Tab');
  assert.match(await shape.getAttribute('style'), /rotate\(25deg\)/);
  await editor.getByRole('button', { name: '↶ 元に戻す', exact: true }).click();
  assert.match(await shape.getAttribute('style'), /rotate\(0deg\)/);
  await editor.getByRole('button', { name: '↷ やり直す', exact: true }).click(); assert.match(await shape.getAttribute('style'), /rotate\(25deg\)/);
  // Resize and rotate using the actual canvas handles, not only numeric fields.
  await shape.click();
  const oldWidth = Number(await editor.locator('#prop-width').inputValue());
  const resizeHandle = editor.locator('.moveable-control[data-direction="se"]').first();
  await resizeHandle.waitFor({ state: 'visible' });
  const resizeBox = await resizeHandle.boundingBox(); assert(resizeBox);
  await editor.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2); await editor.mouse.down(); await editor.mouse.move(resizeBox.x + 65, resizeBox.y + 45, { steps: 8 }); await editor.mouse.up();
  assert(Number(await editor.locator('#prop-width').inputValue()) > oldWidth, 'resize handle should enlarge the shape');
  const rotateHandle = editor.locator('.moveable-rotation-control').first(); const rotateBox = await rotateHandle.boundingBox(); assert(rotateBox);
  const oldRotation = Number(await editor.locator('#prop-rotation').inputValue());
  await editor.mouse.move(rotateBox.x + rotateBox.width / 2, rotateBox.y + rotateBox.height / 2); await editor.mouse.down(); await editor.mouse.move(rotateBox.x + 70, rotateBox.y + 20, { steps: 8 }); await editor.mouse.up();
  assert.notEqual(Number(await editor.locator('#prop-rotation').inputValue()), oldRotation, 'rotation handle should rotate the shape');
  await shape.dblclick();
  await editor.locator('#canvas .tiptap').fill('会場の入口');
  await editor.keyboard.press('Escape');
  await shape.click();
  await editor.locator('#shape-stroke-width').fill('6');
  await editor.locator('#shape-stroke-width').press('Tab');
  await editor.locator('#shape-no-fill').check();
  await editor.locator('#vertical-align').selectOption('bottom');
  await editor.getByRole('tab', { name: '配置', exact: true }).click();
  await editor.getByRole('button', { name: '一つ背面へ', exact: true }).click();
  assert.equal(await shape.evaluate(n => n.nextElementSibling.classList.contains('slide-text')), true);
  await editor.getByRole('button', { name: '一つ前面へ', exact: true }).click();
  assert.equal(await shape.evaluate(n => n.nextElementSibling), null);
  await editor.getByRole('button', { name: '▶ 投影へ反映', exact: true }).click();
  const outputShape = output.locator('#slides-view .slide-rect');
  assert.equal(await outputShape.textContent(), '会場の入口');
  const outputStyle = await outputShape.evaluate(n => {
    const style = getComputedStyle(n);
    return [style.borderTopWidth, style.backgroundColor, style.justifyContent];
  });
  assert.equal(outputStyle[0], '6px');
  assert.equal(outputStyle[1], 'rgba(0, 0, 0, 0)');
  assert(['flex-end', 'flow-end'].includes(outputStyle[2]), `unexpected justifyContent: ${outputStyle[2]}`);
  console.log('PASS: in-shape text, transparent fill, outline, vertical alignment and stacking order');
  const menu = editor.getByRole('menu', { name: '要素の操作' });
  await shape.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: '書式をコピー', exact: true }).click();
  await editor.getByRole('tab', { name: '挿入', exact: true }).click();
  await editor.getByRole('button', { name: '◯ 円・楕円', exact: true }).click();
  const ellipse = editor.locator('#canvas > .slide-ellipse');
  await ellipse.dblclick();
  await editor.locator('#canvas .tiptap').fill('案内');
  await editor.keyboard.press('Escape');
  const ellipseId = await ellipse.getAttribute('data-element-id');
  await editor.locator('#element-options').click();
  await menu.getByRole('menuitem', { name: '書式を貼り付け' }).click();
  assert.equal(await ellipse.textContent(), '案内');
  assert.equal(await ellipse.getAttribute('data-element-id'), ellipseId);
  assert.equal(await ellipse.evaluate(n => n.style.borderTopWidth), '6px');
  assert.equal(await ellipse.evaluate(n => n.style.left), '100px');
  assert.equal(await ellipse.getAttribute('data-vertical-align'), 'bottom');
  await editor.keyboard.press('Control+z');
  assert.equal(await ellipse.evaluate(n => n.style.borderTopWidth), '0px');
  await ellipse.click();
  await editor.keyboard.press('Shift+F10');
  assert(await menu.isVisible());
  await editor.keyboard.press('Escape');
  assert(await menu.isHidden());
  await editor.keyboard.press('Control+x');
  assert.equal(await ellipse.count(), 0);
  await editor.locator('#element-options').click();
  await menu.getByRole('menuitem', { name: '貼り付け', exact: true }).click();
  assert.equal(await ellipse.textContent(), '案内');
  await ellipse.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: '要素を削除' }).click();
  assert.equal(await ellipse.count(), 0);
  console.log('PASS: element menu, style transfer, undo, keyboard access and cut/paste');
  // Templates, nonprojected notes, reorder, multi-selection, grouping, copy/paste.
  await editor.getByRole('tab', { name: 'デザイン', exact: true }).click(); await editor.getByRole('button', { name: '日中対訳', exact: true }).click();
  assert.equal(await editor.locator('#slide-list .slide-item').count(), 2);
  await editor.locator('#speaker-notes').fill('これは投影しないメモ');
  await waitFor(async () => (await editor.locator('#save-status').textContent()).includes('保存済み'), 'notes should autosave without blur');
  await editor.locator('#speaker-notes').press('Tab');
  await editor.getByRole('button', { name: '▶ 投影へ反映', exact: true }).click();
  assert(!(await output.locator('#slides-view').textContent()).includes('これは投影しないメモ'));
  const marquee = await editor.locator('#canvas').boundingBox();
  await editor.mouse.move(marquee.x + 5, marquee.y + 5); await editor.mouse.down();
  await editor.mouse.move(marquee.x + marquee.width - 5, marquee.y + marquee.height - 5, { steps: 10 }); await editor.mouse.up();
  assert.match(await editor.locator('#selection-count').textContent(), /4個/, 'marquee should select all four elements');
  await editor.keyboard.press('Escape');
  await editor.locator('#canvas').focus(); await editor.keyboard.press('Meta+a');
  assert.match(await editor.locator('#selection-count').textContent(), /4個/);
  await editor.getByRole('tab', { name: '配置', exact: true }).click(); await editor.getByRole('button', { name: 'グループ化', exact: true }).click();
  assert.match(await editor.locator('#selection-count').textContent(), /グループ/);
  const groupBefore = await editor.locator('#canvas > .slide-element').evaluateAll(nodes => nodes.map(n => parseFloat(n.style.left)));
  const groupArea = await editor.locator('#canvas > .slide-text').first().boundingBox(); assert(groupArea);
  await editor.mouse.move(groupArea.x + 20, groupArea.y + 20); await editor.mouse.down(); await editor.mouse.move(groupArea.x + 60, groupArea.y + 40, { steps: 6 }); await editor.mouse.up();
  const groupAfter = await editor.locator('#canvas > .slide-element').evaluateAll(nodes => nodes.map(n => parseFloat(n.style.left)));
  assert(groupAfter.every((x, i) => x > groupBefore[i]), 'group drag must move every member');
  await editor.locator('#prop-x').fill('120'); await editor.locator('#prop-x').press('Tab');
  const groupPositioned = await editor.locator('#canvas > .slide-element').evaluateAll(nodes => nodes.map(n => parseFloat(n.style.left)));
  assert(Math.abs(Math.min(...groupPositioned) - 120) < .01);
  assert(groupPositioned.every((x, i) => Math.abs((x - groupPositioned[0]) - (groupAfter[i] - groupAfter[0])) < .01), 'group numeric positioning must retain member spacing');
  await editor.getByRole('button', { name: '左右中央', exact: true }).click();
  const groupAligned = await editor.locator('#canvas > .slide-element').evaluateAll(nodes => nodes.map(n => parseFloat(n.style.left)));
  assert(groupAligned.every((x, i) => Math.abs((x - groupAligned[0]) - (groupAfter[i] - groupAfter[0])) < .01), 'alignment must retain group layout');
  await editor.locator('#canvas').focus(); await editor.keyboard.press('Meta+c'); await editor.keyboard.press('Meta+v');
  assert.equal(await editor.locator('#canvas > .slide-element').count(), 8);
  // File roundtrip includes embedded assets and rejects unsafe/invalid files before replacing.
  const downloadPromise = editor.waitForEvent('download'); await editor.getByRole('button', { name: '資料を保存', exact: true }).click(); const download = await downloadPromise;
  const exportPath = await download.path(); const exported = JSON.parse(await fs.readFile(exportPath, 'utf8'));
  assert.equal(exported.format, 'assembly-slides'); assert.equal(exported.slides.length, 2);
  await editor.locator('#import-file').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"wrong"}') });
  await waitFor(async () => (await editor.locator('#toast').textContent()).includes('読み込めません'), 'invalid file must show an error');
  assert.equal(await editor.locator('#slide-list .slide-item').count(), 2);
  await editor.locator('#import-file').setInputFiles({ name: 'roundtrip.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await waitFor(async () => (await editor.locator('#toast').textContent()).includes('読み込みました'), 'file import failed');
  assert.equal(await editor.locator('#canvas > .slide-element').count(), 3);
  assert.equal(await shape.textContent(), '会場の入口');
  await editor.locator('#slide-list .slide-item').nth(1).dragTo(editor.locator('#slide-list .slide-item').nth(0));
  assert.equal(await editor.locator('#slide-list .slide-label').first().textContent(), '日中対訳', 'slides can move up by dragging');
  await editor.locator('#slide-list .slide-item').nth(0).dragTo(editor.locator('#slide-list .slide-item').nth(1));
  assert.equal(await editor.locator('#slide-list .slide-label').first().textContent(), '恵みのメッセージ', 'slides can move down by dragging');
  // Existing title, hymn, Bible, dual output, blackout and modern preview remain functional.
  await main.locator('#jtitle').fill('既存機能のタイトル'); await main.getByRole('button', { name: '基本情報 表示', exact: true }).click();
  await waitFor(async () => (await output.locator('#t_thema_ja').textContent()).includes('既存機能のタイトル'), 'existing title projection failed');
  await main.locator('#jtitle').fill('入力の即時反映'); await waitFor(async () => (await output.locator('#t_thema_ja').textContent()).includes('入力の即時反映'), 'title live update failed');
  await main.evaluate(() => { abbre = '42'; syou = '3'; setu = '16'; document.querySelector('#syou').value = '3'; document.querySelector('#setu').value = '16'; showBible(); });
  const originalVerse = await output.locator('#master').elementHandle();
  const originalHeader = await output.locator('#b_thema').elementHandle();
  await main.locator('#btn-mode-bible').click();
  await waitFor(async () => (await output.locator('#b_out').textContent()).includes('神'), 'existing Bible projection failed');
  assert(await originalVerse.evaluate(node => node === document.querySelector('#master')));
  assert(await originalHeader.evaluate(node => node === document.querySelector('#b_thema')));
  assert.match(await output.locator('#jp > .bible_body_row + .bible_page').textContent(), /新約 p\.\d+/);
  assert.equal(await output.locator('#ch > .bible_body_row + .bible_page').textContent(), '新约 第123页');
  await main.evaluate(() => { onColorChange('bible_ref', '#123456'); onColorChange('bible_body', '#222222'); });
  assert.equal(await output.locator('.target_ref_jp').evaluate(node => getComputedStyle(node).color), 'rgb(18, 52, 86)');
  assert.equal(await output.locator('#ch > .bible_page').evaluate(node => getComputedStyle(node).color), 'rgb(34, 34, 34)');
  await output.setViewportSize({ width: 360, height: 380 });
  await output.waitForFunction(() => {
    const text = document.querySelector('#master');
    const bounds = document.querySelector('#b_out').getBoundingClientRect();
    const fitted = text.getBoundingClientRect();
    return text.style.fontSize && fitted.top >= bounds.top && fitted.bottom <= bounds.bottom &&
      Array.from(text.querySelectorAll('.bible_ref_row')).every(row => row.scrollWidth <= row.clientWidth);
  });
  await output.setViewportSize({ width: 1500, height: 1000 });
  await main.getByRole('button', { name: '次の節', exact: true }).click();
  await waitFor(() => output.locator('.target_ref_jp').textContent().then(ref => ref === 'ヨハ3:17'), 'next verse must be shown');
  assert.equal(await output.locator('#ch > .bible_page').count(), 0);
  await main.getByRole('button', { name: '前の節', exact: true }).click();
  await main.locator('#prehymn').fill('1');
  await waitFor(async () => (await output.locator('#h_output').textContent()).includes('聖なる'), 'existing hymn title failed');
  const hymnLanguage = main.getByRole('button', { name: /^歌詞の表示 / });
  const chooseLanguage = async name => {
    await hymnLanguage.click();
    await main.getByRole('option', { name, exact: true }).click();
  };
  const projectedLyrics = output.locator('.hymn-lyrics');
  assert.equal(await hymnLanguage.textContent(), '日本語のみ');
  const hymnTitle = await output.locator('.hymn-title-screen').innerHTML();
  assert.match(hymnTitle, /頌贊獨一真神.*聖なる聖なる/s);
  await chooseLanguage('中国語のみ');
  assert.equal(await output.locator('.hymn-title-screen').innerHTML(), hymnTitle);
  await chooseLanguage('日本語のみ');
  await main.locator('.lyric-btn').nth(1).click();
  await waitFor(async () => (await output.locator('#h_output').textContent()).includes('テストの歌詞'), 'existing lyric verse failed');
  const verseTitles = output.locator('.hymn-verse-titles');
  const verseTitle = await verseTitles.textContent();
  assert.equal(verseTitle, '1 聖なる聖なる/頌贊獨一真神');

  assert.equal(await projectedLyrics.count(), 1);
  assert.equal(await projectedLyrics.first().getAttribute('lang'), 'ja');
  await chooseLanguage('中国語のみ');
  await waitFor(async () => (await projectedLyrics.first().textContent()).includes('中文歌詞'), 'Chinese lyric verse failed');
  assert.equal(await projectedLyrics.first().getAttribute('lang'), 'zh-Hant');
  assert.equal(await verseTitles.textContent(), verseTitle);
  await chooseLanguage('日本語・中国語併記');
  await main.locator('.lyric-btn').nth(2).click();
  await waitFor(async () => (await projectedLyrics.count()) === 2, 'bilingual lyric verse failed');
  assert.deepEqual(await projectedLyrics.evaluateAll(nodes => nodes.map(node => node.lang)), ['ja', 'zh-Hant']);
  assert.match(await projectedLyrics.first().textContent(), /日本語一行目/);
  assert.match(await projectedLyrics.last().textContent(), /中文第一行/);
  await main.getByRole('button', { name: '後半', exact: true }).click();
  assert.match(await projectedLyrics.first().textContent(), /日本語四行目/);
  assert.match(await projectedLyrics.last().textContent(), /中文第四行/);
  await output.setViewportSize({ width: 350, height: 160 });
  const lyricsRegion = output.locator('#lyric-container');
  await waitFor(() => lyricsRegion.evaluate(node => node.scrollHeight > node.clientHeight), 'lyrics should scroll in a short window');
  await lyricsRegion.evaluate(node => { node.scrollTop = node.scrollHeight; });
  assert(await lyricsRegion.evaluate(node => node.scrollTop > 0));
  await output.setViewportSize({ width: 420, height: 600 });
  await main.locator('.lyric-btn').nth(3).click();
  const lyricText = output.locator('#lyric-text');
  const fontSize = () => lyricText.evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  const linesFit = () => lyricText.evaluate(node => [...node.querySelectorAll('.hymn-line')].every(line => (
    getComputedStyle(line).whiteSpace === 'pre'
    && line.getBoundingClientRect().width <= line.parentElement.getBoundingClientRect().width
  )) && node.parentElement.scrollWidth === node.parentElement.clientWidth);
  await waitFor(linesFit, 'each bilingual lyric line should fit the narrow viewport');
  assert.equal(await lyricText.locator('.hymn-line').count(), 2);
  assert.equal(await lyricText.locator('rt').textContent(), 'めぐ');
  const narrowSize = await fontSize();
  assert(narrowSize < 36, 'long lines can shrink below the height fitting minimum');
  await output.setViewportSize({ width: 1500, height: 1000 });
  await waitFor(async () => await fontSize() > narrowSize && await linesFit(), 'lyric font should grow when the viewport widens');
  await main.getByRole('button', { name: '投影画面の設定', exact: true }).click();
  const hymnSize = main.getByRole('slider', { name: '歌詞の最大文字サイズ' });
  await hymnSize.fill('1.25');
  assert.equal(await fontSize(), 20);
  assert.equal(await main.evaluate(() => localStorage.getItem('hymn_font_lyrics')), '1.25');
  await main.keyboard.press('Escape');
  await main.getByRole('button', { name: 'AI機能設定', exact: true }).click();
  await main.locator('#geminiApiKey').fill('test-key');
  await main.getByRole('button', { name: /保存して閉じる/ }).click();
  assert.equal(await main.locator('#translate-with-scripture').count(), 0);
  const translate = async (direction, choice) => {
    await main.getByTitle(direction, { exact: true }).click();
    await main.locator('#translationCandidates').getByRole('button', { name: choice, exact: true }).click();
    return geminiRequests.at(-1).body;
  };
  const chineseRequest = await translate('中国語へ翻訳', '第二候補');
  assert.equal(chineseRequest.contents[0].parts[0].text, '入力の即時反映');
  assert.equal(chineseRequest.tools, undefined);
  assert.equal(await main.locator('#ctitle').inputValue(), '第二候補');
  const reverseRequest = await translate('日本語へ翻訳', '第三候補');
  assert.equal(reverseRequest.contents[0].parts[0].text, '第二候補');
  assert.equal(reverseRequest.tools, undefined);
  assert.equal(await main.locator('#jtitle').inputValue(), '第三候補');
  assert.equal(geminiRequests.length, 2);
  assert(geminiRequests.every(request => request.path.endsWith(':generateContent')));
  await main.locator('#jtitle').fill('入力の即時反映');
  console.log('PASS: title translation in both directions sends only the title');
  await main.evaluate(() => setUiStyle('modern'));
  await main.getByRole('button', { name: 'スライド 表示', exact: true }).click();
  await waitFor(async () => (await main.locator('#projection-status').textContent()).includes('スライド'), 'slides mode status failed');
  await main.getByRole('button', { name: '黒画面にする', exact: true }).click(); assert.equal(await output.locator('#projection-blackout').isVisible(), true);
  await main.getByRole('button', { name: '投影を再開', exact: true }).click(); assert.equal(await output.locator('#projection-blackout').isVisible(), false);
  const secondPromise = context.waitForEvent('page'); await main.evaluate(() => setDualProjection(true)); const second = await secondPromise;
  await second.waitForFunction(() => document.body.classList.contains('slides-mode') && document.querySelector('#slides-view').textContent.length > 0);
  assert.equal(await output.locator('#slides-view').textContent(), await second.locator('#slides-view').textContent());
  await output.keyboard.press('ArrowLeft'); await output.keyboard.press('ArrowRight');
  assert.equal(await output.locator('#slides-view').textContent(), await second.locator('#slides-view').textContent());
  await main.screenshot({ path: 'test-results/slides-integrated-modern.png', fullPage: true });
  await editor.screenshot({ path: 'test-results/slides-editor-final.png', fullPage: true });
  await output.screenshot({ path: 'test-results/slides-output.png' });
  // The projector inherits no bold global styles; renderer geometry is identical.
  await editor.locator('#slide-list .slide-item').nth(1).click();
  await editor.getByRole('button', { name: '▶ 投影へ反映', exact: true }).click();
  const styles = n => Array.from(n.querySelectorAll('.slide-element')).map(e => ({ width: e.style.width, height: e.style.height, weight: getComputedStyle(e).fontWeight }));
  assert.deepEqual(await output.locator('#slides-view .slide-canvas').evaluate(styles), await editor.locator('#canvas').evaluate(styles));
  // Reconnect a closed output without losing the published slide or the second output.
  await output.close(); const reconnectPromise = context.waitForEvent('page');
  await main.getByRole('button', { name: 'スライド 表示', exact: true }).click(); const reconnected = await reconnectPromise;
  await reconnected.waitForFunction(() => document.body.classList.contains('slides-mode'));
  assert.equal(await reconnected.locator('#slides-view').textContent(), await second.locator('#slides-view').textContent());
  // Import a real embedded PNG, apply a theme, and restore it after reload.
  await editor.getByRole('tab', { name: '挿入', exact: true }).click();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XkAAAAASUVORK5CYII=', 'base64');
  await editor.locator('#image-file').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: png });
  await editor.locator('#canvas .slide-image').waitFor();
  await editor.getByRole('tab', { name: 'デザイン', exact: true }).click(); await editor.locator('[data-theme="forest"]').click();
  const color = await editor.locator('#canvas').evaluate(n => getComputedStyle(n).backgroundColor); assert.equal(color, 'rgb(21, 87, 75)');
  await waitFor(async () => (await editor.locator('#save-status').textContent()).includes('保存済み'), 'image autosave failed');
  await editor.reload(); await editor.waitForFunction(() => !document.querySelector('#workspace').inert);
  await editor.locator('#slide-list .slide-item').nth(1).click();
  assert.equal(await editor.locator('#canvas .slide-image img').evaluate(n => n.complete && n.naturalWidth > 0), true);
  // Composition events must not close the editor when an IME uses Escape.
  await editor.getByRole('button', { name: 'Ｔ テキスト', exact: true }).click();
  await editor.locator('#canvas .tiptap').evaluate(n => n.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true })));
  assert.equal(await editor.locator('#canvas .tiptap').count(), 1, 'IME Escape must not finish editing');
  const cdp = await context.newCDPSession(editor);
  await cdp.send('Input.imeSetComposition', { text: '信仰', selectionStart: 2, selectionEnd: 2 });
  await cdp.send('Input.insertText', { text: '信仰' });
  await editor.keyboard.press('Escape'); assert((await editor.locator('#canvas').textContent()).includes('信仰'));
  await editor.screenshot({ path: 'test-results/slides-styled.png', fullPage: true });
  // Worship-specific insertion reads the existing app without changing its inputs.
  await editor.getByRole('tab', { name: '挿入', exact: true }).click(); await editor.getByRole('button', { name: '聖句を挿入', exact: true }).click(); await editor.getByRole('button', { name: '選択中の聖句を取得', exact: true }).click();
  assert.match(await editor.locator('#bible-reference').inputValue(), /ヨハ3:16/);
  await editor.getByRole('button', { name: '新しいスライドに挿入', exact: true }).click(); assert.equal(await editor.locator('#slide-list .slide-item').count(), 3);
  await editor.getByRole('button', { name: '集会情報から表紙', exact: true }).click(); assert.equal(await editor.locator('#slide-list .slide-item').count(), 4);
  assert((await editor.locator('#canvas').textContent()).includes('入力の即時反映'));
  console.log('PASS: handles, group movement, images, IME composition, worship templates, rendering parity and reconnection under a Pages subpath');
  // Enhanced features: rich formatting, new shapes, themes, lock/hide, slide skip, sorter, shortcuts and hymn insertion.
  await editor.getByRole('tab', { name: '挿入', exact: true }).click();
  await editor.getByRole('button', { name: '▢ 角丸四角', exact: true }).click();
  await editor.getByRole('button', { name: '△ 三角形', exact: true }).click();
  await editor.getByRole('button', { name: '➔ 矢印', exact: true }).click();
  assert.equal(await editor.locator('#canvas > .slide-rect').count(), 1);
  assert.equal(await editor.locator('#canvas > .slide-triangle svg polygon').count(), 1);
  assert.equal(await editor.locator('#canvas > .slide-arrow svg line').count(), 1);
  await editor.getByRole('tab', { name: 'ホーム', exact: true }).click();
  await editor.locator('#panel-home').getByRole('button', { name: 'Ｔ テキスト', exact: true }).click();
  await editor.locator('#canvas .tiptap').fill('装飾テスト');
  await editor.locator('#canvas .tiptap').selectText();
  await editor.getByRole('button', { name: '打ち消し線', exact: true }).click();
  await editor.getByRole('button', { name: '番号リスト', exact: true }).click();
  assert.equal(await editor.locator('#canvas .tiptap s').textContent(), '装飾テスト');
  assert.equal(await editor.locator('#canvas .tiptap ol li').count(), 1);
  const sizeBefore = Number(await editor.locator('#font-size').inputValue());
  await editor.getByRole('button', { name: '文字サイズ拡大', exact: true }).click();
  assert.equal(Number(await editor.locator('#font-size').inputValue()), sizeBefore + 4);
  await editor.keyboard.press('Escape');
  await editor.locator('#canvas > .slide-text').last().click();
  await editor.getByRole('button', { name: '文字の影', exact: true }).click();
  assert.match(await editor.locator('#canvas > .slide-text').last().evaluate(n => n.style.textShadow), /rgba/);
  // Element lock prevents canvas selection and drag, and can be unlocked from layers.
  await editor.locator('#prop-locked').check();
  assert.equal(await editor.locator('#canvas > .slide-text').last().getAttribute('data-locked'), 'true');
  const lockedBox = await editor.locator('#canvas > .slide-text').last().boundingBox();
  await editor.mouse.click(lockedBox.x + 20, lockedBox.y + 20);
  assert.equal(await editor.locator('#selection-count').textContent(), '要素を選択してください');
  await editor.locator('#layers .layer-row').first().getByRole('button', { name: 'ロック解除' }).click();
  assert.equal(await editor.locator('#canvas > .slide-text').last().getAttribute('data-locked'), 'false');
  // Element hide/show via layers.
  await editor.locator('#layers .layer-row').first().getByRole('button', { name: '非表示にする' }).click();
  assert.equal(await editor.locator('#canvas > .slide-text').last().evaluate(n => n.textContent.includes('装飾テスト')), false);
  await editor.locator('#layers .layer-row').first().getByRole('button', { name: '表示する' }).click();
  assert.equal(await editor.locator('#canvas > .slide-text').last().evaluate(n => n.textContent.includes('装飾テスト')), true);
  // Design gradient theme, apply-all and undo.
  await editor.getByRole('tab', { name: 'デザイン', exact: true }).click();
  await editor.locator('[data-theme="dawn"]').click();
  assert.match(await editor.locator('#canvas').evaluate(n => n.style.backgroundImage), /linear-gradient/);
  await editor.getByRole('button', { name: '全スライドに適用', exact: true }).click();
  await editor.locator('#slide-list .slide-item').first().click();
  assert.match(await editor.locator('#canvas').evaluate(n => n.style.backgroundImage), /linear-gradient/);
  await editor.getByRole('button', { name: '↶ 元に戻す', exact: true }).click();
  assert.equal(await editor.locator('#canvas').evaluate(n => n.style.backgroundImage), 'none');
  // Slide skip and projection navigation sync.
  await editor.locator('#slide-list .slide-item').nth(1).click();
  await editor.locator('#slide-hidden').check();
  assert.equal(await editor.locator('#slide-list .slide-item').nth(1).locator('.slide-badge.is-skip').textContent(), 'スキップ');
  await editor.locator('#slide-list .slide-item').nth(0).click();
  await editor.getByRole('button', { name: '▶ 投影へ反映', exact: true }).click();
  await waitFor(async () => (await editor.locator('#slide-list .slide-item').nth(0).locator('.slide-badge').first().textContent()) === '投影中', 'projected badge should show on slide 1');
  await reconnected.keyboard.press('ArrowRight');
  await waitFor(async () => (await editor.locator('#slide-list .slide-item').nth(2).locator('.slide-badge').first().textContent()) === '投影中', 'hidden slide 2 should be skipped during projection navigation');
  // Slide sorter, shortcuts modal, and hymn insertion dialog.
  await editor.getByRole('button', { name: '一覧', exact: true }).click();
  assert.equal(await editor.locator('#sorter-dialog .sorter-card').count(), 4);
  await editor.locator('#sorter-dialog .sorter-close').click();
  await editor.getByRole('button', { name: '？', exact: true }).click();
  assert.equal(await editor.locator('#shortcuts-dialog').evaluate(d => d.open), true);
  await editor.locator('#shortcuts-dialog .sorter-close').click();
  await editor.getByRole('tab', { name: '挿入', exact: true }).click();
  await editor.getByRole('button', { name: '讃美歌を挿入', exact: true }).click();
  await editor.getByRole('button', { name: '選択中の讃美歌を取得', exact: true }).click();
  assert.equal(await editor.locator('#hymn-number').inputValue(), '1');
  assert.match(await editor.locator('#hymn-lyrics').inputValue(), /テストの歌詞/);
  await editor.locator('#hymn-dialog').getByRole('button', { name: '新しいスライドに挿入', exact: true }).click();
  assert.equal(await editor.locator('#slide-list .slide-item').count(), 5);
  console.log('PASS: enhanced formatting, shapes, themes, lock/hide, skip navigation, sorter, shortcuts and hymn insertion');
  // PowerPoint-style text box behavior: auto-grow, shrink on delete, Tab indent, edit-drag handle, re-click edit, shrink-to-fit.
  await editor.getByRole('tab', { name: 'ホーム', exact: true }).click();
  await editor.locator('#panel-home').getByRole('button', { name: 'Ｔ テキスト', exact: true }).click();
  const pptBox = editor.locator('#canvas > .slide-text').last();
  const h0 = Number(await editor.locator('#prop-height').inputValue());
  await editor.locator('#canvas .tiptap').fill('1行目\n2行目\n3行目\n4行目\n5行目\n6行目');
  const h1 = Number(await editor.locator('#prop-height').inputValue());
  assert(h1 > h0, `text box should auto-grow with lines (h0=${h0}, h1=${h1})`);
  assert.equal(await pptBox.evaluate(n => n.scrollHeight <= n.clientHeight + 2), true, 'text box must not clip lines');
  await editor.locator('#canvas .tiptap').fill('1行のみ');
  const h2 = Number(await editor.locator('#prop-height').inputValue());
  assert(h2 < h1, `text box should shrink when lines are deleted (h1=${h1}, h2=${h2})`);
  await editor.getByRole('button', { name: '箇条書き', exact: true }).click();
  await editor.keyboard.press('Enter');
  await editor.locator('#canvas .tiptap').pressSequentially('ネスト項目');
  await editor.keyboard.press('Tab');
  assert.equal(await editor.locator('#canvas .tiptap ul ul li').count(), 1, 'Tab should indent list item');
  const xBeforeDrag = Number(await editor.locator('#prop-x').inputValue());
  const dragHandle = await editor.locator('.edit-drag-handle').boundingBox();
  assert(dragHandle, 'edit drag handle should appear during text editing');
  await editor.mouse.move(dragHandle.x + dragHandle.width / 2, dragHandle.y + dragHandle.height / 2);
  await editor.mouse.down();
  await editor.mouse.move(dragHandle.x + 80, dragHandle.y + 40, { steps: 6 });
  await editor.mouse.up();
  assert.equal(await editor.locator('#canvas .tiptap').count(), 1, 'dragging edit handle must keep editing active');
  assert(Number(await editor.locator('#prop-x').inputValue()) > xBeforeDrag + 20, 'edit drag handle should move box');
  await editor.keyboard.press('Escape');
  assert.equal(await editor.locator('#canvas .tiptap').count(), 0);
  const pptRect = await pptBox.boundingBox();
  await editor.mouse.click(pptRect.x + 20, pptRect.y + 20);
  assert.equal(await editor.locator('#canvas .tiptap').count(), 1, 're-clicking selected text box should enter edit mode');
  await editor.keyboard.press('Escape');
  await editor.locator('#prop-height').fill('84'); await editor.locator('#prop-height').press('Tab');
  await editor.locator('#text-fit').selectOption('shrink');
  await pptBox.dblclick();
  await editor.locator('#canvas .tiptap').fill('非常に長い文章です。枠の中に自動的に文字サイズが縮小されて収まることを確認するためのテストテキストです。さらに行を増やして縮小を検証します。');
  await editor.keyboard.press('Escape');
  const shrunkSize = await pptBox.locator('.slide-text-body').evaluate(n => parseFloat(n.style.fontSize));
  assert(shrunkSize > 0 && shrunkSize < 44, `shrink mode should reduce font size, got ${shrunkSize}`);
  assert.equal(await pptBox.evaluate(n => n.querySelector('.slide-text-body').scrollHeight <= n.clientHeight + 2), true);
  await editor.getByRole('button', { name: '▶ 投影へ反映', exact: true }).click();
  await waitFor(async () => (await reconnected.locator('#slides-view').textContent()).includes('非常に長い文章です'), 'shrunk text projection failed');
  const outShrunkSize = await reconnected.locator('#slides-view .slide-text').last().locator('.slide-text-body').evaluate(n => parseFloat(n.style.fontSize));
  assert(outShrunkSize > 0 && outShrunkSize < 44, `projected shrink font size should match, got ${outShrunkSize}`);
  console.log('PASS: PowerPoint-style text box auto-grow, shrink-to-fit, Tab indent, edit-drag and re-click editing');
  // PPTX import: invalid rejection, append to current deck, and replace deck with full fidelity.
  const zlib = require('node:zlib');
  const buildZip = entries => {
    const locals = [], centrals = [];
    let offset = 0;
    for (const { name, data } of entries) {
      const raw = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
      const comp = zlib.deflateRawSync(raw);
      const nameBuf = Buffer.from(name, 'utf8');
      const lh = Buffer.alloc(30);
      lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
      lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nameBuf.length, 26);
      locals.push(lh, nameBuf, comp);
      const ch = Buffer.alloc(46);
      ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10);
      ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
      centrals.push(ch, nameBuf);
      offset += lh.length + nameBuf.length + comp.length;
    }
    const cdBuf = Buffer.concat(centrals);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, cdBuf, eocd]);
  };
  const samplePptx = buildZip([
    { name: 'ppt/presentation.xml', data: '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>' },
    { name: 'ppt/_rels/presentation.xml.rels', data: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>' },
    { name: 'ppt/slides/_rels/slide1.xml.rels', data: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/><Relationship Id="rNote1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>' },
    { name: 'ppt/media/image1.png', data: png },
    { name: 'ppt/notesSlides/notesSlide1.xml', data: '<?xml version="1.0"?><p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="1" name="N"/><p:cNvSpPr/><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>PPTX発表者ノート</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>' },
    { name: 'ppt/slides/slide1.xml', data: '<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:bg><p:bgPr><a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="f2f7f5"/></a:gs><a:gs pos="100000"><a:srgbClr val="cde3da"/></a:gs></a:gsLst><a:lin ang="5400000"/></a:gradFill></p:bgPr></p:bg><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr txBox="1"/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="952500" y="476250"/><a:ext cx="9525000" cy="952500"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:rPr b="1" sz="3600"><a:solidFill><a:srgbClr val="15574b"/></a:solidFill></a:rPr><a:t>PPTXからの礼拝題目</a:t></a:r></a:p></p:txBody></p:sp><p:pic><p:nvPicPr><p:cNvPr id="3" name="Pic"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rImg1"/></p:blipFill><p:spPr><a:xfrm><a:off x="952500" y="1800000"/><a:ext cx="1905000" cy="1905000"/></a:xfrm></p:spPr></p:pic><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="Tbl"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><a:xfrm><a:off x="3500000" y="1800000"/><a:ext cx="5000000" cy="1600000"/></a:xfrm><a:graphic><a:graphicData><a:tbl><a:tblGrid><a:gridCol w="2500000"/><a:gridCol w="2500000"/></a:tblGrid><a:tr h="800000"><a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>項目A</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc><a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>内容B</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame></p:spTree></p:cSld></p:sld>' },
    { name: 'ppt/slides/slide2.xml', data: '<?xml version="1.0"?><p:sld show="0" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="B"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="952500" y="952500"/><a:ext cx="4762500" cy="952500"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>スキップされるPPTXスライド</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>' }
  ]);
  await editor.locator('#import-pptx-file').setInputFiles({ name: 'broken.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: Buffer.from('broken') });
  await waitFor(async () => (await editor.locator('#toast').textContent()).includes('PPTXを読み込めません'), 'invalid pptx must show error');
  assert.equal(await editor.locator('#slide-list .slide-item').count(), 5);
  await editor.locator('#import-pptx-file').setInputFiles({ name: 'worship.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: samplePptx });
  await editor.locator('#pptx-dialog').waitFor({ state: 'visible' });
  await editor.getByRole('button', { name: '現在の資料に追加', exact: true }).click();
  assert.equal(await editor.locator('#slide-list .slide-item').count(), 7);
  assert((await editor.locator('#canvas').textContent()).includes('PPTXからの礼拝題目'));
  assert((await editor.locator('#canvas').textContent()).includes('項目A'));
  assert.equal(await editor.locator('#speaker-notes').inputValue(), 'PPTX発表者ノート');
  assert.equal(await editor.locator('#canvas .slide-image img').evaluate(n => n.complete && n.naturalWidth > 0), true);
  assert.match(await editor.locator('#canvas').evaluate(n => n.style.backgroundImage), /linear-gradient/);
  await editor.locator('#import-pptx-file').setInputFiles({ name: 'worship.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: samplePptx });
  await editor.locator('#pptx-dialog').waitFor({ state: 'visible' });
  await editor.getByRole('button', { name: '新しい資料として開く', exact: true }).click();
  assert.equal(await editor.locator('#slide-list .slide-item').count(), 2);
  assert.equal(await editor.locator('#slide-list .slide-item').nth(1).locator('.slide-badge.is-skip').textContent(), 'スキップ');
  await editor.getByRole('button', { name: '▶ 投影へ反映', exact: true }).click();
  await waitFor(async () => (await reconnected.locator('#slides-view').textContent()).includes('PPTXからの礼拝題目'), 'imported pptx projection failed');
  console.log('PASS: PPTX import (validation, append, replace, table, image, gradient, notes, skip and projection)');
  // Standalone mode and offline start use only bundled static assets.
  const offlineContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'allow' });
  offlineContext.setDefaultTimeout(10000);
  const standalone = activeEditor = await offlineContext.newPage(); standalone.on('pageerror', e => errors.push(e.stack)); standalone.on('dialog', d => d.accept());
  await standalone.goto(`${base}slides/index.html`); await standalone.waitForFunction(() => !document.querySelector('#workspace').inert);
  await waitFor(() => standalone.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active), 'service worker installation failed');
  await standalone.waitForFunction(() => !!navigator.serviceWorker.controller);
  await offlineContext.setOffline(true);
  await standalone.reload(); await standalone.waitForFunction(() => !document.querySelector('#workspace').inert);
  const standalonePromise = offlineContext.waitForEvent('page'); await standalone.getByRole('button', { name: '▶ 投影へ反映', exact: true }).click(); const standaloneOutput = await standalonePromise;
  await standaloneOutput.waitForFunction(() => document.querySelector('#canvas').textContent.includes('ここにタイトルを入力'));
  assert(standaloneOutput.url().includes('/assembly/slides/present.html'));
  await standalone.getByRole('button', { name: '黒画面 / 再開', exact: true }).click(); assert.equal(await standaloneOutput.locator('#blackout').isVisible(), true);
  const offlineMain = await offlineContext.newPage();
  await offlineMain.goto(base);
  await offlineMain.waitForFunction(() => bible.length > 30000);
  const offlineProjection = offlineMain.waitForEvent('popup');
  await offlineMain.evaluate(() => { applySearchResult('ヨハ3:16'); });
  const offlineProjector = await offlineProjection;
  await offlineProjector.locator('body.bible-mode #master').waitFor();
  assert.equal(await offlineProjector.locator('.target_ref_jp').textContent(), 'ヨハ3:16');
  console.log('PASS: standalone projection and offline Bible projection with cached static assets');
  assert.deepEqual(errors, [], `uncaught browser errors: ${errors.join('\n')}`);
  console.log('PASS: rich text, partial marks, autosave, explicit publish, manipulation, history, templates, grouping, roundtrip, existing projection, dual output and blackout');
  await browser.close();
  server?.close();
}
run().catch(async error => {
  console.error(error);
  if (activeEditor && !activeEditor.isClosed()) {
    await activeEditor.screenshot({ path: 'test-results/slides-failure.png' }).catch(() => {});
    console.error(await activeEditor.evaluate(() => ({ selection: window.getSelection().toString(), html: document.querySelector('#canvas')?.innerHTML, toast: document.querySelector('#toast')?.textContent })).catch(() => 'closed'));
    for (const page of activeEditor.context().pages()) console.error('PAGE', page.url(), await page.evaluate(() => ({ mode: document.body?.className, text: document.body?.innerText?.slice(0, 500) })).catch(() => 'unavailable'));
  }
  console.error(errors); await activeBrowser?.close(); activeServer?.close(); process.exit(1);
});
