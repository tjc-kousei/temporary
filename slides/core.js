/* Shared, dependency-free document model and renderer. Also used by the projector. */
(function (root) {
  'use strict';
  const WIDTH = 1280, HEIGHT = 720;
  const fonts = [
    'Arial', 'Noto Sans JP', 'Noto Serif JP', 'Yu Gothic', 'Yu Mincho', 'Meiryo',
    'Noto Sans SC', 'Noto Sans TC', 'Hiragino Kaku Gothic ProN', 'Microsoft YaHei',
    'sans-serif', 'serif'
  ];
  const strokeStyles = ['solid', 'dashed', 'dotted'];
  const transitions = ['none', 'fade', 'slide'];
  const textFits = ['grow', 'shrink', 'none'];
  const SVG_NS = 'http://www.w3.org/2000/svg';
  // Retain immutable strings (especially embedded images) across history entries.
  // JSON stringify/parse would allocate a fresh base64 copy on every keystroke.
  const clone = value => Array.isArray(value) ? value.map(clone) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) : value;
  const id = () => root.crypto?.randomUUID?.() || `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const number = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
  const color = (value, fallback = '#172b36') => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
  function image(value) {
    if (typeof value !== 'string' || value.length > 16 * 1024 * 1024 || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/.test(value)) throw new Error('画像は PNG・JPEG・WebP・GIF（1枚約12MB以下）にしてください。');
    return value;
  }
  function textDoc(text = '') {
    return { type: 'doc', content: text.split('\n').map(line => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })) };
  }
  function cleanDoc(doc) {
    let count = 0;
    function visit(node, depth = 0) {
      if (++count > 20000 || depth > 24) throw new Error('文字データが大きすぎます。');
      if (!node || !['doc', 'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'hardBreak', 'text'].includes(node.type)) return null;
      if (node.type === 'text') {
        const result = { type: 'text', text: String(node.text || '').slice(0, 50000) };
        if (!result.text) return null;
        result.marks = (Array.isArray(node.marks) ? node.marks : []).flatMap(mark => {
          if (['bold', 'italic', 'underline', 'strike'].includes(mark.type)) return [{ type: mark.type }];
          if (mark.type !== 'textStyle') return [];
          const attrs = {};
          if (/^#[0-9a-f]{6}$/i.test(mark.attrs?.color || '')) attrs.color = mark.attrs.color;
          if (fonts.includes(mark.attrs?.fontFamily)) attrs.fontFamily = mark.attrs.fontFamily;
          if (/^\d+(\.\d+)?px$/.test(mark.attrs?.fontSize || '')) attrs.fontSize = `${number(parseFloat(mark.attrs.fontSize), 44, 8, 240)}px`;
          return [{ type: 'textStyle', attrs }];
        });
        return result;
      }
      const result = { type: node.type === 'heading' ? 'paragraph' : node.type };
      if (result.type === 'paragraph') result.attrs = { textAlign: ['left', 'center', 'right', 'justify'].includes(node.attrs?.textAlign) ? node.attrs.textAlign : 'left' };
      if (node.type !== 'hardBreak') result.content = (Array.isArray(node.content) ? node.content : []).map(child => visit(child, depth + 1)).filter(Boolean);
      const allowed = { doc: ['paragraph', 'bulletList', 'orderedList'], paragraph: ['text', 'hardBreak'], bulletList: ['listItem'], orderedList: ['listItem'], listItem: ['paragraph', 'bulletList', 'orderedList'], hardBreak: [] }[result.type];
      if ((result.content || []).some(child => !allowed.includes(child.type))) throw new Error('文字データの段落構造が正しくありません。');
      if (['bulletList', 'orderedList'].includes(result.type) && !result.content.length) return null;
      if (result.type === 'listItem' && result.content[0]?.type !== 'paragraph') result.content.unshift({ type: 'paragraph', content: [] });
      if (result.type === 'doc' && !result.content.length) result.content.push({ type: 'paragraph', content: [] });
      return result;
    }
    const result = visit(doc);
    if (result?.type !== 'doc') throw new Error('文字データの形式が正しくありません。');
    return result;
  }
  const isTextShape = type => type === 'rect' || type === 'ellipse';
  const supportsText = type => type === 'text' || isTextShape(type);
  const hasFill = type => ['rect', 'ellipse', 'triangle', 'arrow', 'line', 'text'].includes(type);
  const hasStroke = type => ['rect', 'ellipse', 'triangle', 'text'].includes(type);
  function shapeText() {
    const doc = textDoc();
    doc.content[0].attrs = { textAlign: 'center' };
    return doc;
  }
  function element(type, extra = {}) {
    const defaultWidth = type === 'text' ? 700 : type === 'arrow' ? 360 : type === 'triangle' ? 260 : 320;
    const defaultHeight = type === 'text' ? 160 : type === 'arrow' ? 64 : 220;
    const defaultFill = type === 'text' ? '#ffffff' : type === 'arrow' ? '#15574b' : '#d9eee8';
    return {
      id: id(), type, x: 100, y: 100, width: defaultWidth, height: defaultHeight,
      rotation: 0, opacity: 1, fontSize: 44, fontFamily: 'Yu Gothic', color: '#172b36', fill: defaultFill, lineHeight: 1.5,
      locked: false, hidden: false, shadow: false, borderRadius: 0, strokeStyle: 'solid',
      ...(supportsText(type) ? { verticalAlign: type === 'text' ? 'top' : 'middle', textShadow: false, textFit: type === 'text' ? 'grow' : 'none' } : {}),
      ...(type === 'text' ? { noFill: true, stroke: '#15574b', strokeWidth: 0, padding: 4 } : {}),
      ...(isTextShape(type) ? { content: shapeText(), stroke: '#15574b', strokeWidth: 0, noFill: false } : {}),
      ...(type === 'triangle' ? { stroke: '#15574b', strokeWidth: 0, noFill: false } : {}),
      ...(type === 'arrow' ? { strokeWidth: 6 } : {}),
      ...extra
    };
  }
  function slide(name = 'スライド') {
    return { id: id(), name, background: '#ffffff', backgroundAngle: 135, backgroundOverlay: 0, hidden: false, transition: 'none', elements: [], notes: '' };
  }
  function deck(name = '新しいプレゼンテーション') {
    const first = slide('タイトル');
    first.elements = [
      element('text', { x: 110, y: 220, width: 1060, height: 150, fontSize: 68, content: textDoc('ここにタイトルを入力') }),
      element('text', { x: 115, y: 400, width: 1000, height: 90, fontSize: 30, color: '#657c83', content: textDoc('ダブルクリックで文字を編集できます') })
    ];
    return { format: 'assembly-slides', version: 1, id: id(), name, showSlideNumber: false, slides: [first] };
  }
  function validate(raw) {
    if (!raw || raw.format !== 'assembly-slides' || raw.version !== 1 || !Array.isArray(raw.slides) || raw.slides.length < 1 || raw.slides.length > 500) throw new Error('対応するスライド資料（バージョン1、1〜500枚）を選択してください。');
    const seen = new Set();
    const unique = value => { const key = typeof value === 'string' && value.length < 100 && !seen.has(value) ? value : id(); seen.add(key); return key; };
    return {
      format: 'assembly-slides', version: 1,
      id: typeof raw.id === 'string' ? raw.id.slice(0, 100) : id(),
      name: String(raw.name || '無題').slice(0, 200),
      showSlideNumber: raw.showSlideNumber === true,
      slides: raw.slides.map(s => {
        if (!s || !Array.isArray(s.elements) || s.elements.length > 200) throw new Error('1枚に配置できる要素は200個までです。');
        const bgEnd = color(s.backgroundEnd, '');
        return {
          id: unique(s.id),
          name: String(s.name || 'スライド').slice(0, 200),
          background: color(s.background, '#ffffff'),
          ...(bgEnd ? { backgroundEnd: bgEnd } : {}),
          backgroundAngle: number(s.backgroundAngle, 135, 0, 360),
          backgroundOverlay: number(s.backgroundOverlay, 0, 0, 0.8),
          hidden: s.hidden === true,
          transition: transitions.includes(s.transition) ? s.transition : 'none',
          ...(s.backgroundImage ? { backgroundImage: image(s.backgroundImage) } : {}),
          notes: String(s.notes || '').slice(0, 50000),
          elements: s.elements.map(e => {
            if (!e || !['text', 'rect', 'ellipse', 'triangle', 'arrow', 'line', 'image'].includes(e.type)) throw new Error('対応していない要素が含まれています。');
            const name = typeof e.name === 'string' ? e.name.trim().slice(0, 100) : '';
            const strokeStyle = strokeStyles.includes(e.strokeStyle) ? e.strokeStyle : 'solid';
            return element(e.type, {
              id: unique(e.id),
              ...(name ? { name } : {}),
              x: number(e.x, 100, -2560, 2560),
              y: number(e.y, 100, -1440, 1440),
              width: number(e.width, 320, e.type === 'text' ? 20 : 1, 5120),
              height: number(e.height, 160, e.type === 'text' ? 8 : 1, 2880),
              rotation: number(e.rotation, 0, -360, 360),
              opacity: number(e.opacity, 1, 0, 1),
              fontSize: number(e.fontSize, 44, 8, 240),
              fontFamily: fonts.includes(e.fontFamily) ? e.fontFamily : 'Yu Gothic',
              color: color(e.color),
              fill: color(e.fill, e.type === 'text' ? '#ffffff' : e.type === 'arrow' ? '#15574b' : '#d9eee8'),
              lineHeight: number(e.lineHeight, 1.5, 0.8, 3),
              locked: e.locked === true,
              hidden: e.hidden === true,
              shadow: e.shadow === true,
              borderRadius: number(e.borderRadius, 0, 0, 200),
              strokeStyle,
              ...(typeof e.group === 'string' ? { group: e.group.slice(0, 100) } : {}),
              ...(supportsText(e.type) ? {
                content: cleanDoc(e.content || (isTextShape(e.type) ? shapeText() : textDoc())),
                verticalAlign: ['top', 'middle', 'bottom'].includes(e.verticalAlign) ? e.verticalAlign : isTextShape(e.type) ? 'middle' : 'top',
                textShadow: e.textShadow === true,
                textFit: textFits.includes(e.textFit) ? e.textFit : (e.type === 'text' ? 'grow' : 'none')
              } : {}),
              ...(e.type === 'text' ? {
                noFill: e.noFill === false ? false : true,
                stroke: color(e.stroke, '#15574b'),
                strokeWidth: number(e.strokeWidth, 0, 0, 24),
                padding: number(e.padding, 4, 0, 64)
              } : {}),
              ...(isTextShape(e.type) || e.type === 'triangle' ? {
                stroke: color(e.stroke, '#15574b'),
                strokeWidth: number(e.strokeWidth, 0, 0, 24),
                noFill: e.noFill === true
              } : {}),
              ...(e.type === 'arrow' ? {
                strokeWidth: number(e.strokeWidth, 6, 2, 24)
              } : {}),
              ...(e.type === 'image' ? { src: image(e.src), fit: e.fit === 'cover' ? 'cover' : 'contain' } : {})
            });
          })
        };
      })
    };
  }
  function renderText(doc, target) {
    const d = target.ownerDocument;
    const tags = { paragraph: 'p', heading: 'p', bulletList: 'ul', orderedList: 'ol', listItem: 'li', hardBreak: 'br' };
    function append(node, parent) {
      if (node.type === 'text') {
        let child = d.createTextNode(node.text);
        for (const mark of node.marks || []) {
          const tag = { bold: 'strong', italic: 'em', underline: 'u', strike: 's', textStyle: 'span' }[mark.type];
          if (!tag) continue;
          const span = d.createElement(tag);
          if (mark.type === 'textStyle') Object.assign(span.style, mark.attrs);
          span.append(child); child = span;
        }
        parent.append(child); return;
      }
      const child = node.type === 'doc' ? parent : d.createElement(tags[node.type] || 'p');
      if (node.attrs?.textAlign) child.style.textAlign = node.attrs.textAlign;
      (node.content || []).forEach(item => append(item, child));
      if (child !== parent) { if (!child.childNodes.length && node.type !== 'hardBreak') child.append(d.createElement('br')); parent.append(child); }
    }
    target.replaceChildren(); append(doc, target);
  }
  function styleElement(node, e) {
    Object.assign(node.style, {
      left: `${e.x}px`, top: `${e.y}px`, width: `${e.width}px`, height: `${e.height}px`,
      transform: `rotate(${e.rotation}deg)`, opacity: e.opacity,
      fontSize: `${e.fontSize}px`, fontFamily: `${e.fontFamily}, sans-serif`, color: e.color, lineHeight: e.lineHeight
    });
    if (e.type === 'rect' || e.type === 'image' || e.type === 'text') {
      node.style.borderRadius = e.borderRadius > 0 ? `${e.borderRadius}px` : '';
      if (e.type === 'image') node.style.overflow = e.borderRadius > 0 ? 'hidden' : '';
    }
    if (e.type === 'triangle' || e.type === 'arrow') {
      node.style.filter = e.shadow ? 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.24))' : '';
      node.style.boxShadow = '';
    } else {
      node.style.boxShadow = e.shadow ? '0 8px 24px rgba(0, 0, 0, 0.22)' : '';
      node.style.filter = '';
    }
    if (supportsText(e.type)) {
      node.style.textShadow = e.textShadow ? '0 2px 10px rgba(0, 0, 0, 0.45)' : '';
    }
  }
  function createSvg(d, viewBox) {
    const svg = d.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('preserveAspectRatio', 'none');
    return svg;
  }
  function dashArray(style, unit = 6) {
    if (style === 'dashed') return `${unit * 2} ${unit * 1.4}`;
    if (style === 'dotted') return `1 ${unit * 1.6}`;
    return '';
  }
  function renderSlide(s, canvas, options = {}) {
    const d = canvas.ownerDocument;
    canvas.classList.add('slide-canvas');
    canvas.style.backgroundColor = s.background;
    if (s.backgroundImage) {
      canvas.style.backgroundImage = s.backgroundOverlay > 0
        ? `linear-gradient(rgba(0,0,0,${s.backgroundOverlay}), rgba(0,0,0,${s.backgroundOverlay})), url("${s.backgroundImage}")`
        : `url("${s.backgroundImage}")`;
    } else if (s.backgroundEnd) {
      canvas.style.backgroundImage = `linear-gradient(${s.backgroundAngle ?? 135}deg, ${s.background}, ${s.backgroundEnd})`;
    } else {
      canvas.style.backgroundImage = 'none';
    }
    canvas.replaceChildren();
    for (const e of s.elements) {
      if (e.hidden) continue;
      const node = d.createElement('div');
      node.className = `slide-element slide-${e.type}`;
      node.dataset.elementId = e.id;
      node.dataset.locked = String(!!e.locked);
      styleElement(node, e);
      if (e.type === 'text') {
        if (e.noFill === false) node.style.backgroundColor = e.fill;
        if (e.strokeWidth > 0) node.style.border = `${e.strokeWidth}px ${e.strokeStyle || 'solid'} ${e.stroke}`;
      } else if (isTextShape(e.type)) {
        node.style.backgroundColor = e.noFill ? 'transparent' : e.fill;
        node.style.border = `${e.strokeWidth}px ${e.strokeStyle || 'solid'} ${e.stroke}`;
      }
      if (supportsText(e.type)) {
        node.classList.add('slide-rich-text');
        node.dataset.verticalAlign = e.verticalAlign;
        node.dataset.textFit = e.textFit || (e.type === 'text' ? 'grow' : 'none');
        const body = d.createElement('div');
        body.className = 'slide-text-body';
        if (e.type === 'text' && Number.isFinite(e.padding) && e.padding !== 4) {
          body.style.padding = `${e.padding}px ${Math.max(8, e.padding)}px`;
        }
        renderText(e.content, body);
        node.append(body);
      } else if (e.type === 'image') {
        const img = d.createElement('img');
        img.src = e.src; img.alt = ''; img.draggable = false; img.style.objectFit = e.fit;
        node.append(img);
      } else if (e.type === 'triangle') {
        const svg = createSvg(d, '0 0 100 100');
        const poly = d.createElementNS(SVG_NS, 'polygon');
        poly.setAttribute('points', '50,3 97,97 3,97');
        poly.setAttribute('vector-effect', 'non-scaling-stroke');
        poly.setAttribute('fill', e.noFill ? 'none' : e.fill);
        poly.setAttribute('stroke', e.stroke);
        poly.setAttribute('stroke-width', String(e.strokeWidth || 0));
        poly.setAttribute('stroke-linejoin', 'round');
        const dash = dashArray(e.strokeStyle, 5);
        if (dash) poly.setAttribute('stroke-dasharray', dash);
        svg.append(poly);
        node.append(svg);
      } else if (e.type === 'arrow') {
        const w = Math.max(24, e.width || 360);
        const h = Math.max(16, e.height || 64);
        const sw = Math.max(2, e.strokeWidth || 6);
        const headLen = Math.min(w * 0.45, Math.max(18, h * 0.55));
        const headHalf = Math.min(h / 2, Math.max(10, sw * 2.1));
        const svg = createSvg(d, `0 0 ${w} ${h}`);
        const shaft = d.createElementNS(SVG_NS, 'line');
        shaft.setAttribute('x1', String(sw / 2));
        shaft.setAttribute('y1', String(h / 2));
        shaft.setAttribute('x2', String(Math.max(sw / 2, w - headLen * 0.85)));
        shaft.setAttribute('y2', String(h / 2));
        shaft.setAttribute('stroke', e.fill);
        shaft.setAttribute('stroke-width', String(sw));
        shaft.setAttribute('stroke-linecap', 'round');
        const dash = dashArray(e.strokeStyle, sw);
        if (dash) shaft.setAttribute('stroke-dasharray', dash);
        const head = d.createElementNS(SVG_NS, 'polygon');
        head.setAttribute('points', `${Math.max(0, w - headLen)},${Math.max(0, h / 2 - headHalf)} ${w},${h / 2} ${Math.max(0, w - headLen)},${Math.min(h, h / 2 + headHalf)}`);
        head.setAttribute('fill', e.fill);
        svg.append(shaft, head);
        node.append(svg);
      } else {
        if (e.strokeStyle === 'dashed' || e.strokeStyle === 'dotted') {
          node.style.backgroundColor = 'transparent';
          node.style.borderTop = `${Math.max(1, e.height)}px ${e.strokeStyle} ${e.fill}`;
        } else {
          node.style.backgroundColor = e.fill;
        }
      }
      canvas.append(node);
    }
    if (options?.slideNumber) {
      const num = d.createElement('div');
      num.className = 'slide-page-number';
      num.textContent = `${options.slideNumber.current} / ${options.slideNumber.total}`;
      canvas.append(num);
    }
    if (canvas.isConnected) fitTextElements(canvas);
  }
  function fitTextElements(canvas) {
    const win = canvas?.ownerDocument?.defaultView || root;
    for (const node of canvas.querySelectorAll('.slide-rich-text[data-text-fit="shrink"]')) {
      if (!node.clientHeight || !node.clientWidth || node.classList.contains('editing')) continue;
      const body = node.querySelector('.slide-text-body');
      if (!body) continue;
      body.style.fontSize = '';
      const spans = Array.from(body.querySelectorAll('span')).filter(el => el.dataset.baseFontSize || el.style.fontSize);
      spans.forEach(el => {
        if (!el.dataset.baseFontSize) el.dataset.baseFontSize = el.style.fontSize;
        el.style.fontSize = el.dataset.baseFontSize;
      });
      const base = parseFloat(win.getComputedStyle?.(node).fontSize || node.style.fontSize) || 44;
      const overflows = () => body.scrollHeight > node.clientHeight + 1 || body.scrollWidth > node.clientWidth + 1;
      if (!overflows()) continue;
      let low = 8, high = Math.max(8, Math.floor(base)), best = 8;
      const applySize = size => {
        body.style.fontSize = `${size}px`;
        const ratio = size / base;
        spans.forEach(el => {
          const orig = parseFloat(el.dataset.baseFontSize);
          if (Number.isFinite(orig)) el.style.fontSize = `${Math.max(8, Math.round(orig * ratio * 10) / 10)}px`;
        });
      };
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        applySize(mid);
        if (overflows()) high = mid - 1;
        else { best = mid; low = mid + 1; }
      }
      applySize(best);
    }
  }
  function fitCanvas(canvas, host, padding = 0) {
    const scale = Math.max(0.01, Math.min((host.clientWidth - padding) / WIDTH, (host.clientHeight - padding) / HEIGHT));
    canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
    return scale;
  }
  function nextVisibleIndex(slides, fromIndex, delta) {
    if (!Array.isArray(slides) || !slides.length) return 0;
    const clamped = Math.max(0, Math.min(slides.length - 1, fromIndex));
    if (!delta) {
      if (!slides[clamped].hidden) return clamped;
      const first = slides.findIndex(s => !s.hidden);
      return first >= 0 ? first : clamped;
    }
    const step = delta > 0 ? 1 : -1;
    for (let i = clamped + step; i >= 0 && i < slides.length; i += step) {
      if (!slides[i].hidden) return i;
    }
    return clamped;
  }
  class History {
    constructor(value) { this.entries = [clone(value)]; this.index = 0; }
    push(value) { this.entries.splice(this.index + 1); this.entries.push(clone(value)); if (this.entries.length > 60) this.entries.shift(); this.index = this.entries.length - 1; }
    undo() { if (this.index > 0) this.index--; return clone(this.entries[this.index]); }
    redo() { if (this.index < this.entries.length - 1) this.index++; return clone(this.entries[this.index]); }
    get canUndo() { return this.index > 0; }
    get canRedo() { return this.index < this.entries.length - 1; }
  }
  const api = {
    WIDTH, HEIGHT, fonts, strokeStyles, transitions, textFits, clone, id, number, color, image,
    textDoc, cleanDoc, isTextShape, supportsText, hasFill, hasStroke, element, slide, deck,
    validate, renderSlide, renderText, styleElement, fitCanvas, fitTextElements, nextVisibleIndex, History
  };
  root.SlideCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
