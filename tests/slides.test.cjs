const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../slides/core.js');

test('editable document roundtrip preserves rich text, layout, grouping and embedded images', () => {
  const deck = C.deck('日本語と中文');
  const text = deck.slides[0].elements[0];
  text.content = { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: '愛と盼望', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { color: '#aabbcc', fontSize: '72px', fontFamily: 'Yu Mincho' } }] }] }] };
  text.rotation = 15; text.group = 'group-1';
  deck.slides[0].elements.push(C.element('image', { src: 'data:image/png;base64,iVBORw0KGgo=', fit: 'cover' }));
  const value = C.validate(JSON.parse(JSON.stringify(deck)));
  assert.deepEqual(value.slides[0].elements[0].content, text.content);
  assert.equal(value.slides[0].elements[0].rotation, 15);
  assert.equal(value.slides[0].elements[0].group, 'group-1');
  assert.equal(value.slides[0].elements[2].src, 'data:image/png;base64,iVBORw0KGgo=');
  assert.equal(value.slides[0].elements[2].fit, 'cover');
});

test('untrusted imported documents cannot introduce HTML, scripts, URL images or arbitrary CSS', () => {
  const deck = C.deck(); const e = deck.slides[0].elements[0];
  e.content.content[0].content = [{ type: 'text', text: '<img onerror=alert(1)>', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }, { type: 'textStyle', attrs: { color: 'url(https://evil)', fontSize: 'expression(1)', fontFamily: 'x; background:url(https://evil)' } }] }, { type: 'script', content: [] }];
  e.x = Infinity; e.width = -20; e.rotation = 'not-a-number';
  const result = C.validate(deck).slides[0].elements[0];
  assert.equal(result.content.content[0].content[0].text, '<img onerror=alert(1)>');
  assert.deepEqual(result.content.content[0].content[0].marks, [{ type: 'textStyle', attrs: {} }]);
  assert.equal(result.content.content[0].content.length, 1);
  assert.equal(result.x, 100); assert.equal(result.width, 20); assert.equal(result.rotation, 0);
  for (const src of ['https://evil.test/image.png', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PHNjcmlwdD4=']) {
    deck.slides[0].elements.push(C.element('image', { src }));
    assert.throws(() => C.validate(deck), /画像/); deck.slides[0].elements.pop();
  }
});

test('import validates version, slide and element limits before replacing any current draft', () => {
  assert.throws(() => C.validate({}), /対応する/);
  const deck = C.deck(); deck.version = 2; assert.throws(() => C.validate(deck), /対応する/);
  deck.version = 1; deck.slides = []; assert.throws(() => C.validate(deck), /対応する/);
  deck.slides = Array.from({ length: 501 }, () => C.slide()); assert.throws(() => C.validate(deck), /対応する/);
  deck.slides = [C.slide()]; deck.slides[0].elements = Array.from({ length: 201 }, () => C.element('rect'));
  assert.throws(() => C.validate(deck), /200/);
});

test('duplicate IDs are repaired, and imported objects never retain references to source data', () => {
  const deck = C.deck(); deck.slides[0].elements[1].id = deck.slides[0].elements[0].id;
  const value = C.validate(deck);
  assert.notEqual(value.slides[0].elements[0].id, value.slides[0].elements[1].id);
  value.slides[0].elements[0].content.content[0].content[0].text = 'changed';
  assert.notEqual(deck.slides[0].elements[0].content.content[0].content[0].text, 'changed');
});

test('invalid rich text structure is rejected, and empty documents remain editable', () => {
  assert.throws(() => C.cleanDoc({ type: 'doc', content: [{ type: 'text', text: 'invalid' }] }), /段落構造/);
  assert.throws(() => C.cleanDoc({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'doc', content: [] }] }] }), /段落構造/);
  assert.equal(C.cleanDoc({ type: 'doc', content: [] }).content[0].type, 'paragraph');
  const deck = C.deck(); deck.slides[0].elements.push(C.element('rect', { width: 2, height: 380 }));
  assert.equal(C.validate(deck).slides[0].elements.at(-1).width, 2, 'thin dividers must not widen when published');
});

test('undo and redo isolate all nested edits, truncate the redo branch and retain bounded history', () => {
  const deck = C.deck(); const history = new C.History(deck);
  deck.slides[0].elements[0].x = 500; history.push(deck);
  const previous = history.undo(); assert.equal(previous.slides[0].elements[0].x, 110);
  previous.slides[0].elements[0].content.content[0].content[0].text = 'mutate';
  assert.equal(history.redo().slides[0].elements[0].x, 500);
  history.undo(); history.push(C.deck('branch')); assert.equal(history.canRedo, false);
  for (let i = 0; i < 70; i++) history.push(deck);
  assert.equal(history.entries.length, 60);
});

test('shared renderer escapes text, strips marks on validation, and preserves paragraph style', () => {
  class Node {
    constructor(tag, ownerDocument, text = '') { this.tag = tag; this.ownerDocument = ownerDocument; this.text = text; this.childNodes = []; this.style = {}; }
    append(node) { this.childNodes.push(node); }
    replaceChildren() { this.childNodes = []; }
  }
  const doc = { createElement: tag => new Node(tag, doc), createTextNode: text => new Node('#text', doc, text) };
  const host = new Node('div', doc);
  const input = C.cleanDoc({ type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'right' }, content: [{ type: 'text', text: '<script>alert(1)</script>', marks: [{ type: 'bold' }] }] }] });
  C.renderText(input, host);
  assert.equal(host.childNodes[0].tag, 'p'); assert.equal(host.childNodes[0].style.textAlign, 'right');
  assert.equal(host.childNodes[0].childNodes[0].tag, 'strong');
  assert.equal(host.childNodes[0].childNodes[0].childNodes[0].tag, '#text');
  assert.equal(host.childNodes[0].childNodes[0].childNodes[0].text, '<script>alert(1)</script>');
});

test('legacy shapes gain editable text while imported shape styles are bounded', () => {
  const deck = C.deck();
  deck.slides[0].elements = [
    { type: 'rect', fill: '#123456' },
    { type: 'ellipse', strokeWidth: 200, stroke: 'invalid', verticalAlign: 'bottom', content: C.textDoc('集会') }
  ];
  const [rect, ellipse] = C.validate(deck).slides[0].elements;
  assert.equal(rect.strokeWidth, 0);
  assert.equal(rect.noFill, false);
  assert.equal(rect.fill, '#123456');
  assert.equal(rect.content.content[0].attrs.textAlign, 'center');
  assert.equal(ellipse.strokeWidth, 24);
  assert.equal(ellipse.stroke, '#15574b');
  assert.equal(ellipse.verticalAlign, 'bottom');
  assert.equal(ellipse.content.content[0].content[0].text, '集会');
});

test('new shapes, text box styling, gradients, transitions and slide numbers roundtrip safely', () => {
  const deck = C.deck('充実機能テスト');
  deck.showSlideNumber = true;
  const s = deck.slides[0];
  s.background = '#112233';
  s.backgroundEnd = '#445566';
  s.backgroundAngle = 90;
  s.backgroundOverlay = 0.4;
  s.hidden = true;
  s.transition = 'fade';
  s.elements[0].noFill = false;
  s.elements[0].fill = '#abcdef';
  s.elements[0].stroke = '#123456';
  s.elements[0].strokeWidth = 3;
  s.elements[0].strokeStyle = 'dashed';
  s.elements[0].borderRadius = 16;
  s.elements[0].padding = 20;
  s.elements[0].shadow = true;
  s.elements[0].textShadow = true;
  s.elements.push(
    C.element('triangle', { name: '三角', strokeWidth: 4, strokeStyle: 'dotted', locked: true }),
    C.element('arrow', { name: '矢印', fill: '#ff0000', strokeWidth: 8, hidden: true })
  );
  const out = C.validate(JSON.parse(JSON.stringify(deck)));
  assert.equal(out.showSlideNumber, true);
  assert.equal(out.slides[0].backgroundEnd, '#445566');
  assert.equal(out.slides[0].backgroundAngle, 90);
  assert.equal(out.slides[0].backgroundOverlay, 0.4);
  assert.equal(out.slides[0].hidden, true);
  assert.equal(out.slides[0].transition, 'fade');
  const t = out.slides[0].elements[0];
  assert.equal(t.noFill, false);
  assert.equal(t.fill, '#abcdef');
  assert.equal(t.strokeWidth, 3);
  assert.equal(t.strokeStyle, 'dashed');
  assert.equal(t.borderRadius, 16);
  assert.equal(t.padding, 20);
  assert.equal(t.shadow, true);
  assert.equal(t.textShadow, true);
  const tri = out.slides[0].elements.at(-2);
  const arr = out.slides[0].elements.at(-1);
  assert.equal(tri.type, 'triangle');
  assert.equal(tri.name, '三角');
  assert.equal(tri.strokeStyle, 'dotted');
  assert.equal(tri.locked, true);
  assert.equal(arr.type, 'arrow');
  assert.equal(arr.fill, '#ff0000');
  assert.equal(arr.strokeWidth, 8);
  assert.equal(arr.hidden, true);
});

test('invalid new slide/element styling values are sanitized and cannot inject CSS', () => {
  const deck = C.deck();
  const s = deck.slides[0];
  s.backgroundEnd = 'url(https://evil.example/a.png)';
  s.backgroundAngle = 9999;
  s.backgroundOverlay = 5;
  s.transition = 'javascript:alert(1)';
  s.elements[0].strokeStyle = 'solid; background:url(x)';
  s.elements[0].fontFamily = 'EvilFont; position:fixed';
  s.elements[0].borderRadius = -50;
  s.elements[0].padding = 500;
  const out = C.validate(deck);
  assert.equal('backgroundEnd' in out.slides[0], false);
  assert.equal(out.slides[0].backgroundAngle, 360);
  assert.equal(out.slides[0].backgroundOverlay, 0.8);
  assert.equal(out.slides[0].transition, 'none');
  assert.equal(out.slides[0].elements[0].strokeStyle, 'solid');
  assert.equal(out.slides[0].elements[0].fontFamily, 'Yu Gothic');
  assert.equal(out.slides[0].elements[0].borderRadius, 0);
  assert.equal(out.slides[0].elements[0].padding, 64);
});

test('nextVisibleIndex skips hidden slides in both directions and stays put at boundaries', () => {
  const slides = [
    { hidden: false },
    { hidden: true },
    { hidden: true },
    { hidden: false },
    { hidden: true }
  ];
  assert.equal(C.nextVisibleIndex(slides, 0, 1), 3);
  assert.equal(C.nextVisibleIndex(slides, 3, -1), 0);
  assert.equal(C.nextVisibleIndex(slides, 3, 1), 3);
  assert.equal(C.nextVisibleIndex(slides, 0, -1), 0);
  assert.equal(C.nextVisibleIndex([{ hidden: true }, { hidden: false }], 0, 0), 1);
});

test('textFit defaults, roundtrips and sanitizes invalid values', () => {
  const deck = C.deck();
  assert.equal(deck.slides[0].elements[0].textFit, 'grow');
  const rect = C.element('rect');
  assert.equal(rect.textFit, 'none');
  deck.slides[0].elements[0].textFit = 'shrink';
  deck.slides[0].elements.push(C.element('rect', { textFit: 'invalid-mode' }));
  const out = C.validate(deck);
  assert.equal(out.slides[0].elements[0].textFit, 'shrink');
  assert.equal(out.slides[0].elements[2].textFit, 'none');
});

test('PPTX importer parses zipped slides, theme colors, tables, groups, images, notes and rejects unsafe archives', async () => {
  const zlib = require('node:zlib');
  const P = require('../slides/pptx.js');
  const makeZip = entries => {
    const locals = [], centrals = [];
    let offset = 0;
    for (const { name, data, deflate = true } of entries) {
      const raw = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
      const comp = deflate ? zlib.deflateRawSync(raw) : raw;
      const nameBuf = Buffer.from(name, 'utf8');
      const lh = Buffer.alloc(30);
      lh.writeUInt32LE(0x04034b50, 0);
      lh.writeUInt16LE(20, 4);
      lh.writeUInt16LE(deflate ? 8 : 0, 8);
      lh.writeUInt32LE(comp.length, 18);
      lh.writeUInt32LE(raw.length, 22);
      lh.writeUInt16LE(nameBuf.length, 26);
      locals.push(lh, nameBuf, comp);
      const ch = Buffer.alloc(46);
      ch.writeUInt32LE(0x02014b50, 0);
      ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
      ch.writeUInt16LE(deflate ? 8 : 0, 10);
      ch.writeUInt32LE(comp.length, 20);
      ch.writeUInt32LE(raw.length, 24);
      ch.writeUInt16LE(nameBuf.length, 28);
      ch.writeUInt32LE(offset, 42);
      centrals.push(ch, nameBuf);
      offset += lh.length + nameBuf.length + comp.length;
    }
    const cdBuf = Buffer.concat(centrals);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(cdBuf.length, 12);
    eocd.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, cdBuf, eocd]);
  };

  const traversalZip = makeZip([{ name: '../evil.xml', data: '<x/>' }]);
  await assert.rejects(() => P.importPptx(traversalZip, 'bad.pptx'), /不正/);
  await assert.rejects(() => P.importPptx(Buffer.from('not a zip'), 'bad.pptx'), /有効な PPTX/);

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XkAAAAASUVORK5CYII=', 'base64');
  const pptx = makeZip([
    { name: 'ppt/presentation.xml', deflate: false, data: '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>' },
    { name: 'ppt/_rels/presentation.xml.rels', data: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>' },
    { name: 'ppt/theme/theme1.xml', data: '<?xml version="1.0"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:clrScheme name="T"><a:dk1><a:srgbClr val="102030"/></a:dk1><a:lt1><a:srgbClr val="ffffff"/></a:lt1><a:accent1><a:srgbClr val="15574b"/></a:accent1></a:clrScheme><a:fontScheme name="F"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface="Noto Sans JP"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface="Yu Gothic"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>' },
    { name: 'ppt/slides/_rels/slide1.xml.rels', data: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/><Relationship Id="rNote1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>' },
    { name: 'ppt/media/image1.png', deflate: false, data: png },
    { name: 'ppt/notesSlides/notesSlide1.xml', data: '<?xml version="1.0"?><p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="1" name="N"/><p:cNvSpPr/><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>スライド1のノート</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>' },
    { name: 'ppt/slides/slide1.xml', data: `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:bg><p:bgPr><a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="f0f7f4"/></a:gs><a:gs pos="100000"><a:srgbClr val="d4e8df"/></a:gs></a:gsLst><a:lin ang="5400000"/></a:gradFill></p:bgPr></p:bg><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr txBox="1"/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="952500" y="476250"/><a:ext cx="9525000" cy="952500"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:rPr b="1" sz="3600"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:rPr><a:t>恵みの集会</a:t></a:r></a:p></p:txBody></p:sp><p:pic><p:nvPicPr><p:cNvPr id="3" name="Pic"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rImg1"/></p:blipFill><p:spPr><a:xfrm><a:off x="952500" y="2000000"/><a:ext cx="1905000" cy="1905000"/></a:xfrm></p:spPr></p:pic><p:grpSp><p:grpSpPr><a:xfrm><a:off x="4000000" y="2000000"/><a:ext cx="2000000" cy="1000000"/><a:chOff x="0" y="0"/><a:chExt cx="2000000" cy="1000000"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="4" name="BoxA"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="900000" cy="900000"/></a:xfrm><a:prstGeom prst="roundRect"/><a:solidFill><a:srgbClr val="15574b"/></a:solidFill></p:spPr><p:txBody><a:bodyPr anchor="ctr"/><a:p><a:r><a:t>グループA</a:t></a:r></a:p></p:txBody></p:sp></p:grpSp><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="5" name="Table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><a:xfrm><a:off x="952500" y="4200000"/><a:ext cx="4000000" cy="1500000"/></a:xfrm><a:graphic><a:graphicData><a:tbl><a:tblGrid><a:gridCol w="2000000"/><a:gridCol w="2000000"/></a:tblGrid><a:tr h="750000"><a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>セル1</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc><a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>セル2</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame></p:spTree></p:cSld></p:sld>` },
    { name: 'ppt/slides/slide2.xml', data: '<?xml version="1.0"?><p:sld show="0" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="B"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="952500" y="952500"/><a:ext cx="4762500" cy="952500"/></a:xfrm></p:spPr><p:txBody><a:bodyPr><a:normAutofit/></a:bodyPr><a:p><a:r><a:t>非表示スライド</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>' }
  ]);

  const { deck } = await P.importPptx(pptx, '礼拝資料.pptx');
  assert.equal(deck.name, '礼拝資料');
  assert.equal(deck.slides.length, 2);
  const s1 = deck.slides[0];
  assert.equal(s1.name, '恵みの集会');
  assert.equal(s1.background, '#f0f7f4');
  assert.equal(s1.backgroundEnd, '#d4e8df');
  assert.equal(s1.notes, 'スライド1のノート');
  assert.equal(s1.elements[0].type, 'text');
  assert.equal(s1.elements[0].color, '#15574b');
  assert.equal(s1.elements[1].type, 'image');
  assert.match(s1.elements[1].src, /^data:image\/png;base64,/);
  assert.equal(s1.elements[2].type, 'rect');
  assert(s1.elements[2].group);
  assert(s1.elements[2].borderRadius > 0);
  assert.equal(s1.elements[3].type, 'rect');
  assert.equal(s1.elements[4].type, 'rect');
  assert.equal(s1.elements[3].group, s1.elements[4].group);
  const s2 = deck.slides[1];
  assert.equal(s2.hidden, true);
  assert.equal(s2.elements[0].textFit, 'shrink');
});
