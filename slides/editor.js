import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Moveable from 'moveable';
import Selecto from 'selecto';
import './core.js';
import './pptx.js';
import { openStorage } from './storage.js';

const C = globalThis.SlideCore;
const P = globalThis.SlidePptx;
const $ = id => document.getElementById(id);
let deck = C.deck(), current = 0, selected = new Set(), history;
let editor = null, editingId = null, editingBaseHeight = null, textTimer, saveTimer, toastTimer;
let storage, revision = 0, savedRevision = -1, saveQueue = Promise.resolve(), ready = false;
let copiedStyle = null;
let clipboard = null, imagePurpose = 'element', draggedSlide = null, draggedLayerId = null, scale = 1, gesture = false;
let standaloneWindow = null, published = null, projectedSlideId = null, pendingPptx = null;
let spacePressed = false, panState = null;
let timerSeconds = 0, timerInterval = null;

const themes = {
  light: { bg: '#ffffff', end: '', angle: 135, text: '#172b36' },
  forest: { bg: '#15574b', end: '', angle: 135, text: '#ffffff' },
  night: { bg: '#162632', end: '', angle: 135, text: '#e7efea' },
  warm: { bg: '#f6f0e3', end: '', angle: 135, text: '#534a3a' },
  dawn: { bg: '#fff5eb', end: '#ffd5c2', angle: 135, text: '#4b2b28' },
  ocean: { bg: '#0f3548', end: '#1b6c75', angle: 135, text: '#f3fbff' }
};

const canvas = $('canvas'), stage = $('stage-scroll'), space = $('stage-space');
const currentSlide = () => deck.slides[current];
const selection = () => currentSlide().elements.filter(e => selected.has(e.id));
function slideRenderOptions(index = current) {
  return deck.showSlideNumber ? { slideNumber: { current: index + 1, total: deck.slides.length } } : {};
}
function bounds(items) {
  const x = Math.min(...items.map(e => e.x)), y = Math.min(...items.map(e => e.y));
  return { x, y, width: Math.max(...items.map(e => e.x + e.width)) - x, height: Math.max(...items.map(e => e.y + e.height)) - y };
}
function units(items) {
  const groups = new Map();
  items.forEach(e => { const key = e.group || e.id; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(e); });
  return [...groups.values()].map(elements => ({ ...bounds(elements), elements }));
}
const nodeFor = id => Array.from(canvas.children).find(node => node.dataset.elementId === id);
function notify(message, error = false) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.toggle('error', error); $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, error ? 9000 : 3800);
}
function bridge() {
  try { return window.opener && !window.opener.closed && window.opener.location.origin === location.origin ? window.opener.SlideProjection : null; }
  catch { return null; }
}
function changed() {
  revision++;
  $('save-status').textContent = storage ? '保存待ち…' : '自動保存できません';
  clearTimeout(saveTimer); saveTimer = setTimeout(save, 450);
}
function save() {
  clearTimeout(saveTimer);
  if (!storage) return Promise.resolve();
  const snapshot = C.clone(deck), version = revision;
  $('save-status').textContent = '保存中…';
  saveQueue = saveQueue.catch(() => {}).then(() => storage.save(snapshot)).then(() => {
    savedRevision = version;
    if (revision === version) $('save-status').textContent = 'この端末に保存済み';
  }).catch(error => {
    $('save-status').textContent = '保存失敗・ファイル保存を';
    notify(`自動保存できません。資料を保存してバックアップしてください。${error.message || ''}`, true);
  });
  return saveQueue;
}
function flushText() {
  if (!textTimer) return;
  clearTimeout(textTimer); textTimer = null;
  history.push(deck); changed(); renderRail(); updateHistory();
}
function syncTextBoxHeight(id, { allowShrink = false, minHeight = null, forceFit = false } = {}) {
  const data = currentSlide().elements.find(e => e.id === id);
  const node = nodeFor(id);
  if (!data || !node || !C.supportsText(data.type)) return false;
  if (!forceFit && data.textFit !== 'grow') return false;
  const body = node.querySelector('.tiptap') || node.querySelector('.slide-text-body');
  if (!body) return false;
  const borderV = (data.strokeWidth || 0) * 2;
  const pad = data.type === 'text' ? (Number.isFinite(data.padding) ? data.padding : 4) : 4;
  const lineFloor = Math.ceil(data.fontSize * data.lineHeight + pad * 2 + borderV);
  const floor = forceFit ? Math.max(8, lineFloor) : Math.max(8, minHeight ?? lineFloor);
  const prevHeight = body.style.maxHeight;
  body.style.maxHeight = 'none';
  const needed = Math.min(2880, Math.max(floor, Math.ceil(body.scrollHeight + borderV)));
  body.style.maxHeight = prevHeight;
  const shouldUpdate = forceFit
    ? Math.abs(needed - data.height) > 0.5
    : (needed > data.height + 0.5 || (allowShrink && Math.abs(needed - data.height) > 0.5));
  if (!shouldUpdate) return false;
  data.height = needed;
  node.style.height = `${needed}px`;
  if ($('prop-height')) $('prop-height').value = Math.round(needed * 100) / 100;
  moveable.updateRect();
  return true;
}
function finishEditing() {
  flushText();
  if (!editor) return;
  const finishedId = editingId;
  const node = nodeFor(finishedId), data = currentSlide().elements.find(e => e.id === finishedId);
  editor.destroy(); editor = null; editingId = null; editingBaseHeight = null;
  if (node && data) {
    node.classList.remove('editing');
    const body = document.createElement('div');
    body.className = 'slide-text-body';
    if (data.type === 'text' && Number.isFinite(data.padding) && data.padding !== 4) {
      body.style.padding = `${data.padding}px ${Math.max(8, data.padding)}px`;
    }
    C.renderText(data.content, body);
    node.replaceChildren(body);
    if (data.textFit === 'grow') syncTextBoxHeight(finishedId);
    else if (data.textFit === 'shrink') C.fitTextElements(canvas);
  }
  updateSelection();
}
function commit(mutator, { keepEditing = false } = {}) {
  if (!keepEditing) finishEditing();
  else flushText();
  mutator(); history.push(deck); changed();
  if (keepEditing) { renderRail(); updateProperties(); updateHistory(); }
  else render();
}
function fit() {
  const value = $('zoom').value;
  const fitting = value === 'fit';
  // Remove scrollbars before measuring. Classic Windows scrollbars change clientWidth/Height.
  stage.classList.toggle('is-fit', fitting);
  scale = fitting ? Math.max(.08, Math.min((stage.clientWidth - 70) / C.WIDTH, (stage.clientHeight - 50) / C.HEIGHT)) : Number(value);
  space.style.width = fitting ? '100%' : `${C.WIDTH * scale + 70}px`;
  space.style.height = fitting ? '100%' : `${C.HEIGHT * scale + 50}px`;
  canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
  moveable.zoom = 1 / scale;
  moveable.updateRect();
}
function renderRail() {
  const list = $('slide-list');
  const hadFocus = list.contains(document.activeElement);
  list.replaceChildren();
  deck.slides.forEach((s, index) => {
    const item = document.createElement('div');
    item.className = `slide-item${index === current ? ' active' : ''}${s.hidden ? ' is-hidden' : ''}`;
    item.draggable = true; item.dataset.slideId = s.id;
    item.tabIndex = 0; item.setAttribute('role', 'button'); item.setAttribute('aria-label', `${index + 1}. ${s.name}`); item.setAttribute('aria-pressed', String(index === current));
    const number = document.createElement('span'); number.className = 'slide-number'; number.textContent = index + 1;
    const thumb = document.createElement('div'); thumb.className = 'slide-thumb';
    const miniature = document.createElement('div'); C.renderSlide(s, miniature, slideRenderOptions(index)); thumb.append(miniature);
    if (projectedSlideId === s.id) {
      const live = document.createElement('span'); live.className = 'slide-badge'; live.textContent = '投影中'; thumb.append(live);
    }
    if (s.hidden) {
      const skip = document.createElement('span'); skip.className = 'slide-badge is-skip'; skip.textContent = 'スキップ'; thumb.append(skip);
    }
    const quick = document.createElement('div'); quick.className = 'slide-quick-actions';
    const dupBtn = document.createElement('button'); dupBtn.type = 'button'; dupBtn.title = '複製'; dupBtn.textContent = '⧉';
    dupBtn.addEventListener('click', e => { e.stopPropagation(); selectSlide(index); actions['duplicate-slide'](); });
    const skipBtn = document.createElement('button'); skipBtn.type = 'button'; skipBtn.title = s.hidden ? '投影に表示' : '投影スキップ'; skipBtn.textContent = s.hidden ? '👁' : '◌';
    skipBtn.addEventListener('click', e => { e.stopPropagation(); selectSlide(index); actions['toggle-slide-hidden'](); });
    const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.title = '削除'; delBtn.textContent = '×';
    delBtn.addEventListener('click', e => { e.stopPropagation(); selectSlide(index); actions['delete-slide'](); });
    quick.append(dupBtn, skipBtn, delBtn);
    const label = document.createElement('span'); label.className = 'slide-label'; label.textContent = s.name;
    item.append(number, thumb, quick, label); list.append(item);
    C.fitTextElements(miniature);
    // Scale thumbnails after insertion, without constructing editor instances.
    miniature.style.transform = `translate(-50%, -50%) scale(${(thumb.clientWidth || 150) / C.WIDTH})`;
    item.addEventListener('click', () => { selectSlide(index); focusThumbnail(); });
    item.addEventListener('contextmenu', event => {
      event.preventDefault(); event.stopPropagation();
      selectSlide(index);
      openSlideMenu(event.clientX, event.clientY, item);
    });
    item.addEventListener('keydown', event => {
      if (event.isComposing) return;
      let destination = index;
      let action;
      switch (event.key) {
        case 'ArrowUp': destination = Math.max(0, index - 1); break;
        case 'ArrowDown': destination = Math.min(deck.slides.length - 1, index + 1); break;
        case 'Delete': case 'Backspace': action = 'delete-slide'; break;
        case 'd': case 'D':
          if (!event.ctrlKey && !event.metaKey) return;
          action = 'duplicate-slide'; break;
        case 'Enter': case ' ': break;
        default: return;
      }
      event.preventDefault();
      event.stopPropagation();
      selectSlide(destination);
      focusThumbnail();
      if (action) actions[action]();
    });
    item.addEventListener('dragstart', event => { finishEditing(); draggedSlide = s.id; event.dataTransfer.setData('text/plain', s.id); event.dataTransfer.effectAllowed = 'move'; });
    item.addEventListener('dragover', event => { if (draggedSlide) { event.preventDefault(); item.classList.add('drag-over'); } });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('dragend', () => { draggedSlide = null; document.querySelectorAll('.drag-over').forEach(n => n.classList.remove('drag-over')); });
    item.addEventListener('drop', event => {
      event.preventDefault(); if (!draggedSlide || draggedSlide === s.id) return;
      const sourceId = draggedSlide; draggedSlide = null;
      commit(() => { const active = currentSlide().id; const from = deck.slides.findIndex(v => v.id === sourceId); const to = deck.slides.findIndex(v => v.id === s.id); const [moved] = deck.slides.splice(from, 1); deck.slides.splice(to, 0, moved); current = deck.slides.findIndex(v => v.id === active); });
    });
  });
  if (hadFocus) focusThumbnail();
  $('page-status').textContent = `${current + 1} / ${deck.slides.length}`;
}
function focusThumbnail() { $('slide-list').querySelector('.slide-item.active')?.focus(); }
function textSummary(e) {
  if (e.name) return e.name;
  if (e.type !== 'text') return { image: '画像', rect: '四角形', ellipse: '円・楕円', triangle: '三角形', arrow: '矢印', line: '線' }[e.type] || '要素';
  const walk = node => node.type === 'text' ? node.text : (node.content || []).map(walk).join('');
  return walk(e.content).slice(0, 40) || 'テキスト';
}
function renderLayers() {
  const container = $('layers');
  container.replaceChildren();
  [...currentSlide().elements].reverse().forEach(e => {
    const row = document.createElement('div');
    row.className = 'layer-row';
    row.draggable = true;
    row.dataset.elementId = e.id;

    const button = document.createElement('button');
    button.className = `layer${selected.has(e.id) ? ' active' : ''}`;
    const icon = document.createElement('small');
    icon.textContent = { text: 'Ｔ', image: '▧', rect: '▭', ellipse: '◯', triangle: '△', arrow: '➔', line: '／' }[e.type] || '◇';
    const name = document.createElement('span');
    name.textContent = textSummary(e);
    button.append(icon, name);
    button.addEventListener('click', event => { finishEditing(); choose([e.id], event.shiftKey); });
    button.addEventListener('dblclick', event => {
      event.stopPropagation();
      finishEditing();
      const input = document.createElement('input');
      input.className = 'layer-rename';
      input.maxLength = 100;
      input.value = e.name || textSummary(e);
      button.replaceWith(input);
      input.focus(); input.select();
      const applyRename = saveName => {
        if (saveName) {
          const trimmed = input.value.trim();
          commit(() => { if (trimmed) e.name = trimmed; else delete e.name; });
        } else renderLayers();
      };
      input.addEventListener('keydown', ev => {
        ev.stopPropagation();
        if (ev.key === 'Enter') applyRename(true);
        if (ev.key === 'Escape') applyRename(false);
      });
      input.addEventListener('blur', () => applyRename(true));
    });

    const visBtn = document.createElement('button');
    visBtn.type = 'button';
    visBtn.className = `layer-action${e.hidden ? ' is-off' : ''}`;
    visBtn.title = e.hidden ? '表示する' : '非表示にする';
    visBtn.setAttribute('aria-label', visBtn.title);
    visBtn.textContent = e.hidden ? '◌' : '👁';
    visBtn.addEventListener('click', () => commit(() => { e.hidden = !e.hidden; }));

    const lockBtn = document.createElement('button');
    lockBtn.type = 'button';
    lockBtn.className = `layer-action${e.locked ? '' : ' is-off'}`;
    lockBtn.title = e.locked ? 'ロック解除' : 'ロック';
    lockBtn.setAttribute('aria-label', lockBtn.title);
    lockBtn.textContent = e.locked ? '🔒' : '🔓';
    lockBtn.addEventListener('click', () => commit(() => { e.locked = !e.locked; }));

    row.addEventListener('dragstart', event => { draggedLayerId = e.id; event.dataTransfer.setData('text/plain', e.id); event.dataTransfer.effectAllowed = 'move'; });
    row.addEventListener('dragover', event => { if (draggedLayerId && draggedLayerId !== e.id) { event.preventDefault(); row.classList.add('drag-over'); } });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('dragend', () => { draggedLayerId = null; container.querySelectorAll('.drag-over').forEach(n => n.classList.remove('drag-over')); });
    row.addEventListener('drop', event => {
      event.preventDefault();
      if (!draggedLayerId || draggedLayerId === e.id) return;
      const sourceId = draggedLayerId; draggedLayerId = null;
      commit(() => {
        const list = currentSlide().elements;
        const from = list.findIndex(item => item.id === sourceId);
        const to = list.findIndex(item => item.id === e.id);
        if (from < 0 || to < 0) return;
        const [moved] = list.splice(from, 1);
        list.splice(to, 0, moved);
      });
    });

    row.append(button, visBtn, lockBtn);
    container.append(row);
  });
  if (!currentSlide().elements.length) container.textContent = 'テキストや画像を挿入できます';
}
function updateHistory() {
  document.querySelectorAll('[data-action="undo"]').forEach(n => { n.disabled = !history?.canUndo; });
  document.querySelectorAll('[data-action="redo"]').forEach(n => { n.disabled = !history?.canRedo; });
}
function updateProperties() {
  const items = selection(), first = items[0];
  const s = currentSlide();
  $('element-properties').disabled = !first;
  $('element-options').disabled = !first && !clipboard;
  $('selection-heading').textContent = first ? (items.length === 1 ? textSummary(first).slice(0, 15) : '複数の要素') : 'スライドの設定';
  $('selection-count').textContent = first ? `${items.length}個を選択中${first.group ? ' · グループ' : ''}${first.locked ? ' · ロック' : ''}` : '要素を選択してください';
  const geometry = items.length > 1 ? { ...first, ...bounds(items) } : first;
  for (const prop of ['x', 'y', 'width', 'height', 'rotation', 'opacity', 'lineHeight']) {
    $('prop-' + prop).value = geometry ? Math.round(geometry[prop] * 100) / 100 : '';
  }

  const filled = items.find(e => C.hasFill(e.type));
  const outlined = items.find(e => C.hasStroke(e.type));
  const noFillable = items.find(e => C.isTextShape(e.type) || e.type === 'triangle' || e.type === 'text');
  const strokeWeighted = items.find(e => C.hasStroke(e.type) || e.type === 'arrow');
  const strokeStyled = items.find(e => C.hasStroke(e.type) || e.type === 'arrow' || e.type === 'line');
  const text = items.find(e => C.supportsText(e.type));
  const textBox = items.find(e => e.type === 'text');
  const radiusItem = items.find(e => ['rect', 'image', 'text'].includes(e.type));
  const image = items.find(e => e.type === 'image');

  $('shape-fill').closest('label').hidden = !filled;
  $('fill-swatches-row').hidden = !filled;
  $('shape-outline').hidden = !strokeStyled;
  $('shape-no-fill').closest('label').hidden = !noFillable;
  $('shape-stroke').closest('label').hidden = !outlined;
  $('shape-stroke-width').closest('label').hidden = !strokeWeighted;
  $('shape-stroke-style').closest('label').hidden = !strokeStyled;
  $('prop-borderRadius').closest('label').hidden = !radiusItem;
  $('vertical-align').closest('label').hidden = !text;
  $('text-fit').closest('label').hidden = !text;
  $('fit-text-box-btn').hidden = !text;
  $('prop-lineHeight').closest('label').hidden = !text;
  $('prop-padding').closest('label').hidden = !textBox;
  $('image-fit').closest('label').hidden = !image;
  $('prop-shadow').closest('label').hidden = !first;
  $('prop-textShadow').closest('label').hidden = !text;
  $('prop-locked').closest('label').hidden = !first;

  if (filled) $('shape-fill').value = filled.fill;
  if (noFillable) {
    $('shape-no-fill').checked = !!noFillable.noFill;
    $('shape-no-fill').indeterminate = items.some(e => (C.isTextShape(e.type) || e.type === 'triangle' || e.type === 'text') && !!e.noFill !== !!noFillable.noFill);
  }
  if (outlined) $('shape-stroke').value = outlined.stroke;
  if (strokeWeighted) $('shape-stroke-width').value = strokeWeighted.strokeWidth;
  if (strokeStyled) $('shape-stroke-style').value = strokeStyled.strokeStyle || 'solid';
  if (radiusItem) $('prop-borderRadius').value = radiusItem.borderRadius || 0;
  if (textBox) $('prop-padding').value = Number.isFinite(textBox.padding) ? textBox.padding : 4;
  if (text) {
    $('vertical-align').value = text.verticalAlign;
    $('text-fit').value = text.textFit || (text.type === 'text' ? 'grow' : 'none');
    $('prop-lineHeight').value = text.lineHeight;
    document.querySelector('[data-action="text-shadow"]').setAttribute('aria-pressed', String(!!text.textShadow));
    $('prop-textShadow').checked = !!text.textShadow;
    if (!editor) {
      $('font-size').value = text.fontSize;
      $('font-family').value = text.fontFamily;
      $('text-color').value = text.color;
    }
  } else {
    document.querySelector('[data-action="text-shadow"]').setAttribute('aria-pressed', 'false');
  }
  if (image) $('image-fit').value = image.fit;
  if (first) {
    $('prop-shadow').checked = !!first.shadow;
    $('prop-locked').checked = !!first.locked;
  }

  $('slide-name').value = s.name;
  $('slide-hidden').checked = !!s.hidden;
  $('background-color').value = s.background;
  const hasGrad = !!s.backgroundEnd;
  $('bg-gradient-enabled').checked = hasGrad;
  $('bg-end-wrap').hidden = !hasGrad;
  $('bg-angle-wrap').hidden = !hasGrad;
  $('background-color-end').value = s.backgroundEnd || '#dbece5';
  $('background-angle').value = s.backgroundAngle ?? 135;
  $('bg-overlay-wrap').hidden = !s.backgroundImage;
  $('background-overlay').value = s.backgroundOverlay ?? 0;
  $('show-slide-number').checked = !!deck.showSlideNumber;
  $('slide-transition').value = s.transition || 'none';
  $('current-slide-name').textContent = s.name;
  $('notes-count').textContent = `${Array.from(s.notes || '').length}文字`;
  document.querySelectorAll('[data-action="delete"], [data-action="duplicate"]').forEach(n => { n.disabled = !first; });
}
function updateSelection() {
  Array.from(canvas.children).forEach(node => { if (node.dataset.elementId) node.classList.toggle('selected', selected.has(node.dataset.elementId)); });
  const targets = [...selected].filter(id => !currentSlide().elements.find(e => e.id === id)?.locked).map(nodeFor).filter(Boolean);
  moveable.target = editor ? null : targets.length === 1 ? targets[0] : targets;
  selecto.setSelectedTargets(targets);
  moveable.elementGuidelines = currentSlide().elements.filter(e => !selected.has(e.id) && !e.hidden).map(e => nodeFor(e.id)).filter(Boolean);
  moveable.updateRect(); updateProperties(); renderLayers();
}
function choose(ids, toggle = false) {
  const expanded = new Set(ids);
  ids.forEach(id => { const e = currentSlide().elements.find(item => item.id === id); if (e?.group) currentSlide().elements.filter(item => item.group === e.group).forEach(item => expanded.add(item.id)); });
  if (toggle) expanded.forEach(id => { if (selected.has(id)) selected.delete(id); else selected.add(id); });
  else selected = expanded;
  updateSelection();
}
function render() {
  current = Math.min(Math.max(0, current), deck.slides.length - 1);
  selected = new Set([...selected].filter(id => currentSlide().elements.some(e => e.id === id)));
  // Moveable's controls live outside the document canvas and survive this redraw.
  C.renderSlide(currentSlide(), canvas, slideRenderOptions(current));
  $('deck-name').value = deck.name; $('speaker-notes').value = currentSlide().notes;
  renderRail(); updateSelection(); updateHistory(); fit();
  if ($('sorter-dialog').open) renderSorter();
}
function selectSlide(index) { finishEditing(); current = index; selected.clear(); render(); }
function startEditing(id, clickCoords = null) {
  const data = currentSlide().elements.find(e => e.id === id);
  if (!data || data.locked || data.hidden || !C.supportsText(data.type) || editingId === id) return;
  finishEditing(); selected = new Set([id]); editingId = id;
  const pad = data.type === 'text' ? (Number.isFinite(data.padding) ? data.padding : 4) : 4;
  const lineFloor = Math.ceil(data.fontSize * data.lineHeight + pad * 2 + (data.strokeWidth || 0) * 2);
  editingBaseHeight = Math.min(data.height, Math.max(lineFloor, 40));
  const node = nodeFor(id); node.classList.add('editing'); node.replaceChildren();
  editor = new Editor({
    element: node,
    extensions: [StarterKit.configure({ undoRedo: false, heading: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false, link: false, dropcursor: false, gapcursor: false, trailingNode: false }), TextStyle, Color, FontFamily, FontSize, TextAlign.configure({ types: ['paragraph'] })],
    content: data.content,
    editorProps: { attributes: { 'aria-label': 'テキスト編集', spellcheck: 'false' }, handleKeyDown: (_view, event) => {
      if (event.isComposing || _view.composing) return false;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(event.shiftKey); return true; }
      if (event.key === 'Tab') {
        event.preventDefault();
        if (editor?.isActive('listItem')) {
          if (event.shiftKey) editor.commands.liftListItem('listItem');
          else editor.commands.sinkListItem('listItem');
        } else if (!event.shiftKey) {
          editor?.commands.insertContent('\t');
        }
        return true;
      }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finishEditing(); canvas.focus(); return true; }
      return false;
    } },
    onUpdate: ({ editor: instance }) => {
      data.content = C.cleanDoc(instance.getJSON());
      syncTextBoxHeight(editingId, { allowShrink: true, minHeight: editingBaseHeight });
      clearTimeout(textTimer); textTimer = setTimeout(flushText, 500);
      // Flag the draft immediately; do not lose the final keystrokes on close.
      $('save-status').textContent = '編集中…';
    },
    onSelectionUpdate: updateTextToolbar
  });
  const handle = document.createElement('div');
  handle.className = 'edit-drag-handle';
  handle.textContent = '⋮⋮ 移動';
  handle.title = 'ドラッグして枠を移動';
  handle.addEventListener('pointerdown', ev => {
    if (ev.button !== 0 || spacePressed) return;
    ev.preventDefault(); ev.stopPropagation();
    pointerMove = {
      id: ev.pointerId, x: ev.clientX, y: ev.clientY,
      altClone: false, cloned: false, keepEditing: true,
      items: [{ id: data.id, x: data.x, y: data.y, width: data.width, height: data.height }]
    };
    gesture = true;
  });
  node.append(handle);
  updateSelection();
  if (clickCoords) {
    const pos = editor.view.posAtCoords({ left: clickCoords.clientX, top: clickCoords.clientY });
    editor.commands.setTextSelection(pos ? pos.pos : Math.max(1, editor.state.doc.content.size - 1));
  } else {
    editor.commands.setTextSelection(Math.max(1, editor.state.doc.content.size - 1));
  }
  editor.view.focus(); updateTextToolbar();
}
function updateTextToolbar() {
  if (!editor) return;
  const attrs = editor.getAttributes('textStyle'), e = selection()[0];
  $('font-size').value = parseFloat(attrs.fontSize) || e.fontSize;
  $('font-family').value = attrs.fontFamily || e.fontFamily;
  $('text-color').value = C.color(attrs.color, e.color);
  [
    ['bold', 'bold'], ['italic', 'italic'], ['underline', 'underline'],
    ['strike', 'strike'], ['bullet', 'bulletList'], ['ordered', 'orderedList']
  ].forEach(([action, mark]) => {
    document.querySelector(`[data-action="${action}"]`)?.setAttribute('aria-pressed', String(editor.isActive(mark)));
  });
}
function format(command, value) {
  if (editor) {
    const chain = editor.chain();
    const methods = {
      bold: 'toggleBold', italic: 'toggleItalic', underline: 'toggleUnderline', strike: 'toggleStrike',
      bullet: 'toggleBulletList', ordered: 'toggleOrderedList',
      color: 'setColor', fontFamily: 'setFontFamily', fontSize: 'setFontSize', textAlign: 'setTextAlign'
    };
    chain[methods[command]](command === 'fontSize' ? `${value}px` : value).run();
    if (editingId) syncTextBoxHeight(editingId, { allowShrink: true, minHeight: editingBaseHeight });
    editor.view.focus(); updateTextToolbar(); return;
  }
  const text = selection().filter(e => C.supportsText(e.type));
  if (!text.length) { notify('テキストを選択してください。部分書式はダブルクリックして文字を選択します。'); return; }
  commit(() => text.forEach(e => {
    if (['fontSize', 'fontFamily', 'color'].includes(command)) {
      const applied = command === 'fontSize' ? `${value}px` : value;
      e[command] = value;
      const walk = node => { if (node.type === 'text') { node.marks ||= []; let mark = node.marks.find(m => m.type === 'textStyle'); if (!mark) { mark = { type: 'textStyle', attrs: {} }; node.marks.push(mark); } mark.attrs[command] = applied; } (node.content || []).forEach(walk); };
      walk(e.content);
    } else if (command === 'textAlign') {
      const walk = node => { if (node.type === 'paragraph') node.attrs = { ...node.attrs, textAlign: value }; (node.content || []).forEach(walk); }; walk(e.content);
    } else {
      // Use the same ProseMirror commands for whole-box formatting and partial text.
      const temp = new Editor({ extensions: [StarterKit.configure({ undoRedo: false, link: false }), TextStyle, Color, FontFamily, FontSize, TextAlign.configure({ types: ['paragraph'] })], content: e.content });
      temp.commands.selectAll();
      temp.commands[{ bold: 'toggleBold', italic: 'toggleItalic', underline: 'toggleUnderline', strike: 'toggleStrike', bullet: 'toggleBulletList', ordered: 'toggleOrderedList' }[command]]();
      e.content = C.cleanDoc(temp.getJSON()); temp.destroy();
    }
  }));
  text.forEach(e => {
    if (e.textFit === 'grow' && syncTextBoxHeight(e.id)) {
      history.entries[history.index] = C.clone(deck);
      renderRail();
    }
  });
}
function undo(redo = false) {
  finishEditing(); const slideId = currentSlide().id;
  deck = redo ? history.redo() : history.undo();
  current = Math.max(0, deck.slides.findIndex(s => s.id === slideId)); selected.clear(); changed(); render();
}
function addElements(elements) {
  if (currentSlide().elements.length + elements.length > 200) { notify('1枚のスライドに配置できる要素は200個までです。', true); return; }
  commit(() => { currentSlide().elements.push(...elements); selected = new Set(elements.map(e => e.id)); });
}
function template(kind) {
  const names = { title: 'タイトル', section: 'セクション見出し', body: '見出しと本文', 'two-col': '2カラム', bilingual: '日中対訳', quote: '引用カード', blank: '白紙' };
  const s = C.slide(names[kind] || 'スライド');
  const text = (value, options) => C.element('text', { content: C.textDoc(value), ...options });
  if (kind === 'title') s.elements = [text('ここにタイトルを入力', { x: 110, y: 225, width: 1060, height: 150, fontSize: 68 }), text('サブタイトル', { x: 115, y: 405, width: 1000, height: 90, fontSize: 30, color: '#657c83' })];
  if (kind === 'section') s.elements = [C.element('rect', { x: 110, y: 265, width: 14, height: 190, fill: '#15574b' }), text('セクションタイトル', { x: 150, y: 255, width: 1000, height: 120, fontSize: 60 }), text('概要やポイントを簡潔に', { x: 152, y: 390, width: 980, height: 70, fontSize: 28, color: '#657c83' })];
  if (kind === 'body' || kind === 'bilingual' || kind === 'two-col') s.elements.push(text('ここに見出しを入力', { x: 90, y: 65, width: 1100, height: 100, fontSize: 52 }));
  if (kind === 'body') s.elements.push(text('ここに本文を入力\n伝えたいことを、わかりやすく。', { x: 100, y: 210, width: 1080, height: 420, fontSize: 36 }));
  if (kind === 'two-col') s.elements.push(
    C.element('rect', { x: 90, y: 205, width: 520, height: 420, fill: '#f3f7f5', borderRadius: 16, verticalAlign: 'top', content: C.textDoc('左側の見出し\n\n・要点1\n・要点2') }),
    C.element('rect', { x: 670, y: 205, width: 520, height: 420, fill: '#f3f7f5', borderRadius: 16, verticalAlign: 'top', content: C.textDoc('右側の見出し\n\n・要点1\n・要点2') })
  );
  if (kind === 'bilingual') s.elements.push(C.element('rect', { x: 630, y: 215, width: 2, height: 380, fill: '#d4e0da' }), text('日本語の本文', { x: 90, y: 215, width: 490, height: 390, fontSize: 36 }), text('中文内容', { x: 690, y: 215, width: 490, height: 390, fontSize: 36 }));
  if (kind === 'quote') s.elements = [
    C.element('rect', { x: 140, y: 140, width: 1000, height: 440, fill: '#f5f8f6', stroke: '#15574b', strokeWidth: 2, borderRadius: 20 }),
    text('「ここに引用や大切な聖句を入力します」', { x: 190, y: 210, width: 900, height: 240, fontSize: 44, fontFamily: 'Noto Serif JP' }),
    text('― 出典・箇所', { x: 190, y: 470, width: 900, height: 60, fontSize: 28, color: '#587564' })
  ];
  return s;
}
function addSlide(s = C.slide()) {
  if (deck.slides.length >= 500) return notify('スライドは500枚までです。', true);
  commit(() => { deck.slides.splice(current + 1, 0, s); current++; selected.clear(); });
}
function cloneWithFreshIds(source, offset = 24) {
  const items = C.clone(source), groups = new Map();
  for (const item of items) {
    item.id = C.id();
    item.x += offset;
    item.y += offset;
    delete item.locked;
    if (item.group) {
      if (!groups.has(item.group)) groups.set(item.group, C.id());
      item.group = groups.get(item.group);
    }
  }
  return items;
}
function insertCopies(source) {
  if (!source?.length) return;
  addElements(cloneWithFreshIds(source, 24));
}
function copySelection() {
  if (!selected.size) return;
  finishEditing();
  clipboard = C.clone(selection());
}
function styleKeys(type) {
  const keys = ['opacity', 'shadow', 'borderRadius', 'strokeStyle'];
  if (C.supportsText(type)) keys.push('fontSize', 'fontFamily', 'color', 'verticalAlign', 'lineHeight', 'textShadow', 'textFit');
  if (C.hasFill(type)) keys.push('fill');
  if (C.isTextShape(type) || type === 'triangle' || type === 'text') keys.push('noFill');
  if (C.hasStroke(type)) keys.push('stroke', 'strokeWidth');
  if (type === 'arrow') keys.push('strokeWidth');
  if (type === 'text') keys.push('padding');
  if (type === 'image') keys.push('fit');
  return keys;
}
function visitContent(node, visit) {
  visit(node);
  for (const child of node.content || []) visitContent(child, visit);
}
function copyStyle() {
  if (selected.size !== 1) return;
  finishEditing();
  const [source] = selection();
  const properties = Object.fromEntries(styleKeys(source.type).map(key => [key, source[key]]));
  copiedStyle = { properties };
  if (source.content) {
    visitContent(source.content, node => {
      if (node.type === 'paragraph') copiedStyle.align ??= node.attrs?.textAlign || 'left';
      if (node.type === 'text') copiedStyle.marks ??= C.clone(node.marks || []);
    });
  }
  notify('書式をコピーしました。適用先で「書式を貼り付け」を選んでください。');
}
function pasteStyle() {
  if (!copiedStyle || !selected.size) return;
  commit(() => {
    for (const target of selection()) {
      for (const key of styleKeys(target.type)) {
        if (key in copiedStyle.properties) target[key] = copiedStyle.properties[key];
      }
      if (target.content && copiedStyle.align) {
        visitContent(target.content, node => {
          if (node.type === 'paragraph') node.attrs = { ...node.attrs, textAlign: copiedStyle.align };
          if (node.type === 'text') node.marks = C.clone(copiedStyle.marks || []);
        });
      }
    }
  });
}
function moveOneLayer(direction) {
  const order = [...currentSlide().elements];
  // Work from the leading edge so adjacent selected items move as a block.
  let moved = false;
  for (let i = direction > 0 ? order.length - 2 : 1; i >= 0 && i < order.length; i -= direction) {
    const next = i + direction;
    if (selected.has(order[i].id) && !selected.has(order[next].id)) {
      [order[i], order[next]] = [order[next], order[i]];
      moved = true;
    }
  }
  if (moved) commit(() => { currentSlide().elements = order; });
}
function align(direction) {
  const items = units(selection()); if (!items.length) return;
  const frame = items.length === 1 ? { x: 0, y: 0, width: C.WIDTH, height: C.HEIGHT } : bounds(items);
  commit(() => items.forEach(unit => {
    let dx = 0, dy = 0;
    if (direction === 'left') dx = frame.x - unit.x;
    if (direction === 'center') dx = frame.x + (frame.width - unit.width) / 2 - unit.x;
    if (direction === 'right') dx = frame.x + frame.width - unit.width - unit.x;
    if (direction === 'top') dy = frame.y - unit.y;
    if (direction === 'middle') dy = frame.y + (frame.height - unit.height) / 2 - unit.y;
    if (direction === 'bottom') dy = frame.y + frame.height - unit.height - unit.y;
    unit.elements.forEach(e => { e.x += dx; e.y += dy; });
  }));
}
function distribute(axis) {
  const items = units(selection()).sort((a, b) => a[axis] - b[axis]);
  if (items.length < 3) return notify('等間隔に配置する要素を3個以上選択してください。');
  const size = axis === 'x' ? 'width' : 'height';
  commit(() => { const start = items[0][axis], end = items.at(-1)[axis] + items.at(-1)[size]; const gap = (end - start - items.reduce((sum, e) => sum + e[size], 0)) / (items.length - 1); let position = start; items.forEach(unit => { const delta = position - unit[axis]; unit.elements.forEach(e => { e[axis] += delta; }); position += unit[size] + gap; }); });
}
function matchSize(axis) {
  const items = selection();
  if (items.length < 2) return notify('サイズを揃える要素を2個以上選択してください。');
  const targetSize = items[0][axis];
  commit(() => items.slice(1).forEach(e => { e[axis] = targetSize; }));
}
async function readImage(file) {
  if (!file || !['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) throw new Error('PNG・JPEG・GIF・WebP の画像（12MB以下）を選択してください。');
  const src = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
  C.image(src);
  const img = new Image(); img.src = src; await img.decode();
  return { src, width: img.naturalWidth, height: img.naturalHeight };
}
async function insertImage(file, purpose = 'element') {
  // Image decoding is asynchronous: retain the slide where the action began.
  const targetId = currentSlide().id;
  const data = await readImage(file);
  if (currentSlide().id !== targetId) throw new Error('スライドが切り替わりました。挿入先で画像を選び直してください。');
  if (purpose === 'background') commit(() => { currentSlide().backgroundImage = data.src; });
  else { const ratio = Math.min(800 / data.width, 500 / data.height, 1); const width = Math.max(20, data.width * ratio), height = Math.max(8, data.height * ratio); addElements([C.element('image', { src: data.src, fit: 'contain', width, height, x: (C.WIDTH - width) / 2, y: (C.HEIGHT - height) / 2 })]); }
}
function exportDeck() {
  finishEditing();
  const clean = C.validate(deck);
  const blob = new Blob([JSON.stringify(clean)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url;
  link.download = `${deck.name.replace(/[\\/:*?"<>|]/g, '_') || 'スライド'}.assembly-slides.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000); notify('画像を含む編集可能な資料ファイルを保存しました。');
}
function replaceDeck(value) {
  finishEditing(); deck = value; current = 0; selected.clear(); history = new C.History(deck); changed(); render();
}
async function handlePptxFile(file) {
  if (!file) return;
  const result = await P.importPptx(await file.arrayBuffer(), file.name);
  pendingPptx = result;
  $('pptx-summary').textContent = `「${result.deck.name}」（スライド ${result.deck.slides.length} 枚）を取り込む準備ができました。取り込み方法を選択してください。`;
  const warnParts = [];
  if (result.warnings.skippedImages) warnParts.push(`未対応形式またはサイズ超過の画像 ${result.warnings.skippedImages} 件をスキップしました。`);
  if (result.warnings.truncatedElements) warnParts.push('要素数が200個を超えたスライドは一部を省略しました。');
  $('pptx-warning').hidden = !warnParts.length;
  $('pptx-warning').textContent = warnParts.join(' ');
  $('pptx-dialog').showModal();
}
async function importDeck(file) {
  if (!file) return;
  if (/\.pptx$/i.test(file.name) || file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    await handlePptxFile(file);
    return;
  }
  if (file.size > 40 * 1024 * 1024) throw new Error('読み込める資料ファイルは40MBまでです。');
  // Validate before replacing the current draft. Invalid files never modify it.
  const value = C.validate(JSON.parse(await file.text()));
  if (!confirm('現在の資料を読み込んだ資料に置き換えます。必要な場合は先に「資料を保存」で保存してください。')) return;
  replaceDeck(value); await save(); notify('資料を読み込みました。');
}
function present() {
  finishEditing(); published = { deck: C.validate(deck), index: current };
  projectedSlideId = deck.slides[current]?.id || null;
  const host = bridge();
  if (host) {
    host.receive(published);
    $('projection-state').textContent = `${current + 1}枚目を投影へ反映しました`;
    renderRail();
    return;
  }
  if (!standaloneWindow || standaloneWindow.closed) {
    standaloneWindow = window.open('./present.html?v=4', 'assembly-slides-projector', 'width=1280,height=720,resizable=yes');
    if (!standaloneWindow) return notify('投影画面を開けません。ポップアップを許可してください。', true);
    standaloneWindow.focus();
    standaloneWindow.addEventListener('load', () => { standaloneWindow.SlideShow?.apply(published); });
  } else standaloneWindow.SlideShow?.apply(published);
  $('projection-state').textContent = `${current + 1}枚目を投影へ反映しました`;
  renderRail();
}
function navigate(delta, output = false) {
  const next = output
    ? C.nextVisibleIndex(deck.slides, current, delta)
    : Math.max(0, Math.min(deck.slides.length - 1, current + delta));
  if (next !== current) selectSlide(next);
  if (output) present();
}
function getCurrentBible() {
  const data = bridge()?.getContext();
  if (!data?.bible) { notify('集会管理で聖句を選択してから、もう一度取得してください。', true); return; }
  $('bible-reference').value = data.bible.reference || ''; $('bible-japanese').value = data.bible.japanese || ''; $('bible-chinese').value = data.bible.chinese || '';
}
function insertBible(intoCurrent = false) {
  const reference = $('bible-reference').value.trim(), jp = $('bible-japanese').value.trim(), ch = $('bible-chinese').value.trim();
  if (!jp && !ch) return notify('聖句本文を入力してください。', true);
  if (intoCurrent) {
    const added = [C.element('text', { x: 90, y: 65, width: 1100, height: 90, fontSize: 48, content: C.textDoc(reference || '聖句') })];
    if (jp && ch) {
      added.push(
        C.element('text', { x: 90, y: 185, width: 510, height: 410, fontSize: 30, content: C.textDoc(jp) }),
        C.element('text', { x: 680, y: 185, width: 510, height: 410, fontSize: 30, content: C.textDoc(ch) })
      );
    } else {
      added.push(C.element('text', { x: 100, y: 185, width: 1080, height: 420, fontSize: 32, content: C.textDoc(jp || ch) }));
    }
    addElements(added);
    $('bible-dialog').close();
    return;
  }
  const s = template(jp && ch ? 'bilingual' : 'body'); s.name = reference || '聖句';
  s.elements.filter(e => e.type === 'text')[0].content = C.textDoc(reference || '聖句');
  const texts = s.elements.filter(e => e.type === 'text'); texts[1].content = C.textDoc(jp || ch);
  if (jp && ch) texts[2].content = C.textDoc(ch);
  texts.slice(1).forEach(e => { e.fontSize = 32; }); addSlide(s); $('bible-dialog').close();
}
function getCurrentHymn() {
  const hymn = bridge()?.getContext()?.hymn;
  if (!hymn) { notify('集会管理で讃美歌を選択してから、もう一度取得してください。', true); return; }
  $('hymn-number').value = hymn.number || '';
  $('hymn-title-ja').value = hymn.japaneseTitle || '';
  $('hymn-title-zh').value = hymn.chineseTitle || '';
  const firstVerse = hymn.jaVerses?.[0]?.lines?.join('\n') || hymn.zhVerses?.[0]?.lines?.join('\n') || '';
  $('hymn-lyrics').value = firstVerse;
}
function insertHymn() {
  const num = $('hymn-number').value.trim();
  const titleJa = $('hymn-title-ja').value.trim();
  const titleZh = $('hymn-title-zh').value.trim();
  const lyrics = $('hymn-lyrics').value.trim();
  if (!titleJa && !titleZh && !lyrics) return notify('曲名または歌詞を入力してください。', true);
  const heading = [num ? `${num}番` : '', titleJa || titleZh].filter(Boolean).join(' ');
  const s = C.slide(heading || '讃美歌');
  s.elements.push(C.element('text', { x: 90, y: 55, width: 1100, height: 90, fontSize: 48, content: C.textDoc(heading || '讃美歌') }));
  if (titleJa && titleZh) {
    s.elements.push(C.element('text', { x: 95, y: 138, width: 1090, height: 54, fontSize: 28, color: '#587564', content: C.textDoc(titleZh) }));
  }
  if (lyrics) {
    s.elements.push(C.element('text', { x: 100, y: titleJa && titleZh ? 210 : 175, width: 1080, height: 440, fontSize: 34, content: C.textDoc(lyrics) }));
  }
  addSlide(s);
  $('hymn-dialog').close();
}
function meetingCover() {
  const data = bridge()?.getContext()?.info;
  if (!data) return notify('集会管理の「スライド編集」から開くと集会情報を取り込めます。', true);
  const s = template('title'); s.name = data.jtitle || data.worship || '集会';
  s.elements[0].content = C.textDoc(data.jtitle || data.worship || '集会');
  s.elements[1].content = C.textDoc([data.ctitle, data.worship, data.speecher ? `説教：${data.speecher}` : '', data.translator ? `通訳：${data.translator}` : ''].filter(Boolean).join('\n'));
  s.elements[1].height = 220; s.elements[1].y = 390; addSlide(s);
}
function applyTextColorClear(slide, textColor) {
  slide.elements.filter(e => e.type === 'text').forEach(e => {
    e.color = textColor;
    const walk = node => {
      (node.marks || []).filter(m => m.type === 'textStyle').forEach(m => { delete m.attrs.color; });
      (node.content || []).forEach(walk);
    };
    walk(e.content);
  });
}
function applyThemeToAll() {
  const src = currentSlide();
  const sampleText = src.elements.find(e => e.type === 'text');
  commit(() => {
    deck.slides.forEach(s => {
      s.background = src.background;
      if (src.backgroundEnd) {
        s.backgroundEnd = src.backgroundEnd;
        s.backgroundAngle = src.backgroundAngle;
      } else {
        delete s.backgroundEnd;
      }
      if (src.backgroundImage) {
        s.backgroundImage = src.backgroundImage;
        s.backgroundOverlay = src.backgroundOverlay;
      } else {
        delete s.backgroundImage;
        s.backgroundOverlay = 0;
      }
      if (sampleText) applyTextColorClear(s, sampleText.color);
    });
  });
  notify('すべてのスライドにデザインを適用しました。');
}
function renderSorter() {
  const grid = $('sorter-grid');
  grid.replaceChildren();
  deck.slides.forEach((s, index) => {
    const card = document.createElement('div');
    card.className = `sorter-card${index === current ? ' active' : ''}${s.hidden ? ' is-hidden' : ''}`;
    card.draggable = true;
    card.dataset.slideId = s.id;
    const thumb = document.createElement('div'); thumb.className = 'sorter-card-thumb';
    const miniature = document.createElement('div');
    C.renderSlide(s, miniature, slideRenderOptions(index));
    thumb.append(miniature);
    const foot = document.createElement('div'); foot.className = 'sorter-card-foot';
    const title = document.createElement('span'); title.className = 'sorter-card-title';
    title.textContent = `${index + 1}. ${s.name}${s.hidden ? '（スキップ）' : ''}`;
    const btns = document.createElement('div'); btns.className = 'sorter-card-actions';
    const dup = document.createElement('button'); dup.type = 'button'; dup.textContent = '複製';
    dup.addEventListener('click', e => { e.stopPropagation(); selectSlide(index); actions['duplicate-slide'](); });
    const hide = document.createElement('button'); hide.type = 'button'; hide.textContent = s.hidden ? '表示' : 'スキップ';
    hide.addEventListener('click', e => { e.stopPropagation(); selectSlide(index); actions['toggle-slide-hidden'](); });
    btns.append(dup, hide);
    foot.append(title, btns);
    card.append(thumb, foot);
    grid.append(card);
    C.fitTextElements(miniature);
    miniature.style.transform = `translate(-50%, -50%) scale(${(thumb.clientWidth || 190) / C.WIDTH})`;
    card.addEventListener('click', () => { selectSlide(index); $('sorter-dialog').close(); });
    card.addEventListener('dragstart', event => { draggedSlide = s.id; event.dataTransfer.setData('text/plain', s.id); });
    card.addEventListener('dragover', event => { if (draggedSlide) { event.preventDefault(); card.classList.add('drag-over'); } });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('dragend', () => { draggedSlide = null; grid.querySelectorAll('.drag-over').forEach(n => n.classList.remove('drag-over')); });
    card.addEventListener('drop', event => {
      event.preventDefault(); if (!draggedSlide || draggedSlide === s.id) return;
      const sourceId = draggedSlide; draggedSlide = null;
      commit(() => {
        const active = currentSlide().id;
        const from = deck.slides.findIndex(v => v.id === sourceId);
        const to = deck.slides.findIndex(v => v.id === s.id);
        const [moved] = deck.slides.splice(from, 1);
        deck.slides.splice(to, 0, moved);
        current = deck.slides.findIndex(v => v.id === active);
      });
    });
  });
}
function runPrint() {
  finishEditing();
  const mode = document.querySelector('input[name="print-mode"]:checked')?.value || 'slides';
  const includeHidden = $('print-include-hidden').checked;
  const host = $('print-sheets');
  host.replaceChildren();
  const targets = deck.slides.map((s, idx) => ({ s, idx })).filter(({ s }) => includeHidden || !s.hidden);
  if (!targets.length) return notify('印刷するスライドがありません。', true);
  targets.forEach(({ s, idx }) => {
    const sheet = document.createElement('section'); sheet.className = 'print-sheet';
    const wrap = document.createElement('div'); wrap.className = 'print-canvas-wrap';
    const node = document.createElement('div');
    C.renderSlide(s, node, deck.showSlideNumber ? { slideNumber: { current: idx + 1, total: deck.slides.length } } : {});
    node.style.transform = `translate(-50%, -50%) scale(${960 / C.WIDTH})`;
    wrap.style.width = '960px'; wrap.style.height = '540px';
    wrap.append(node);
    sheet.append(wrap);
    if (mode === 'notes') {
      const notes = document.createElement('div'); notes.className = 'print-notes';
      const head = document.createElement('div'); head.className = 'print-notes-title';
      head.textContent = `${idx + 1}. ${s.name}`;
      const body = document.createElement('div'); body.textContent = s.notes || '（ノートなし）';
      notes.append(head, body);
      sheet.append(notes);
    }
    host.append(sheet);
  });
  $('print-dialog').close();
  window.print();
}
function formatTimer(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}
function toggleTimer() {
  if (timerInterval) {
    clearInterval(timerInterval); timerInterval = null;
    $('timer-toggle').textContent = '開始';
  } else {
    $('timer-toggle').textContent = '停止';
    timerInterval = setInterval(() => {
      timerSeconds++;
      $('timer-display').textContent = formatTimer(timerSeconds);
    }, 1000);
  }
}
const actions = {
  'new-deck': () => { finishEditing(); $('new-dialog').showModal(); },
  'confirm-new': () => { replaceDeck(C.deck()); $('new-dialog').close(); },
  import: () => { finishEditing(); $('import-file').click(); },
  'import-pptx': () => { finishEditing(); $('import-pptx-file').click(); },
  'confirm-pptx-append': () => {
    if (!pendingPptx) return;
    if (deck.slides.length + pendingPptx.deck.slides.length > 500) {
      return notify('合計スライド数が500枚を超えるため追加できません。', true);
    }
    const added = pendingPptx.deck.slides;
    commit(() => {
      const startIndex = deck.slides.length;
      deck.slides.push(...added);
      current = startIndex;
      selected.clear();
    });
    pendingPptx = null;
    $('pptx-dialog').close();
    notify(`PPTXから ${added.length} 枚のスライドを追加しました。`);
  },
  'confirm-pptx-replace': async () => {
    if (!pendingPptx) return;
    const nextDeck = pendingPptx.deck;
    pendingPptx = null;
    $('pptx-dialog').close();
    replaceDeck(nextDeck);
    await save();
    notify('PPTXを新しい資料として読み込みました。');
  },
  export: exportDeck,
  'add-slide': () => addSlide(),
  'duplicate-slide': () => { const s = C.clone(currentSlide()); s.id = C.id(); s.name += ' のコピー'; const groups = new Map(); s.elements.forEach(e => { e.id = C.id(); if (e.group) { if (!groups.has(e.group)) groups.set(e.group, C.id()); e.group = groups.get(e.group); } }); addSlide(s); },
  'delete-slide': () => {
    const last = deck.slides.length === 1;
    $('delete-description').textContent = `${current + 1} 枚目「${currentSlide().name}」を削除します。${last ? '最後の1枚なので、編集用の白紙を1枚用意します。' : ''}「元に戻す」で復元できます。`;
    $('delete-dialog').dataset.slideId = currentSlide().id;
    $('delete-dialog').showModal();
  },
  'confirm-delete-slide': () => {
    const dialog = $('delete-dialog');
    const index = deck.slides.findIndex(s => s.id === dialog.dataset.slideId);
    dialog.close();
    if (index < 0) return;
    commit(() => {
      deck.slides.splice(index, 1);
      if (!deck.slides.length) deck.slides.push(C.slide('白紙'));
      current = Math.min(index, deck.slides.length - 1);
      selected.clear();
    });
    focusThumbnail();
  },
  'toggle-slide-hidden': () => commit(() => { currentSlide().hidden = !currentSlide().hidden; }),
  'slide-up': () => { if (current > 0) commit(() => { const [s] = deck.slides.splice(current, 1); deck.slides.splice(--current, 0, s); }); },
  'slide-down': () => { if (current < deck.slides.length - 1) commit(() => { const [s] = deck.slides.splice(current, 1); deck.slides.splice(++current, 0, s); }); },
  'add-text': () => { const e = C.element('text', { width: 560, height: 76, content: C.textDoc('テキストを入力') }); addElements([e]); startEditing(e.id); editor?.commands.selectAll(); },
  'fit-text-box': () => {
    const targets = selection().filter(e => C.supportsText(e.type));
    if (!targets.length) return;
    commit(() => {}, { keepEditing: !!editor });
    let changedHeight = false;
    targets.forEach(e => { if (syncTextBoxHeight(e.id, { forceFit: true })) changedHeight = true; });
    if (changedHeight) { history.entries[history.index] = C.clone(deck); renderRail(); }
  },
  'add-image': () => { imagePurpose = 'element'; $('image-file').click(); },
  'background-image': () => { imagePurpose = 'background'; $('image-file').click(); },
  'clear-background': () => commit(() => { delete currentSlide().backgroundImage; currentSlide().backgroundOverlay = 0; }),
  'add-rect': () => addElements([C.element('rect')]),
  'add-rounded-rect': () => addElements([C.element('rect', { borderRadius: 24 })]),
  'add-ellipse': () => addElements([C.element('ellipse')]),
  'add-triangle': () => addElements([C.element('triangle', { width: 260, height: 220 })]),
  'add-arrow': () => addElements([C.element('arrow', { width: 360, height: 64, fill: '#15574b', strokeWidth: 6 })]),
  'add-line': () => addElements([C.element('line', { width: 500, height: 8, fill: '#15574b' })]),
  'apply-theme-all': applyThemeToAll,
  duplicate: () => { finishEditing(); insertCopies(selection()); },
  copy: () => { copySelection(); notify('要素をコピーしました。'); },
  cut: () => { copySelection(); actions.delete(); },
  paste: () => insertCopies(clipboard),
  'copy-style': copyStyle, 'paste-style': pasteStyle,
  delete: () => {
    const deletable = selection().filter(e => !e.locked);
    if (!deletable.length) {
      if (selection().some(e => e.locked)) notify('ロックされた要素は削除できません。');
      return;
    }
    const ids = new Set(deletable.map(e => e.id));
    commit(() => { currentSlide().elements = currentSlide().elements.filter(e => !ids.has(e.id)); ids.forEach(id => selected.delete(id)); });
  },
  bold: () => format('bold'), italic: () => format('italic'), underline: () => format('underline'), strike: () => format('strike'),
  bullet: () => format('bullet'), ordered: () => format('ordered'),
  'font-smaller': () => {
    const next = C.number(Number($('font-size').value || 44) - 4, 44, 8, 240);
    $('font-size').value = next;
    format('fontSize', next);
  },
  'font-larger': () => {
    const next = C.number(Number($('font-size').value || 44) + 4, 44, 8, 240);
    $('font-size').value = next;
    format('fontSize', next);
  },
  'text-shadow': () => {
    const targets = selection().filter(e => C.supportsText(e.type));
    if (!targets.length) return notify('テキストまたは図形を選択してください。');
    const next = !targets[0].textShadow;
    commit(() => targets.forEach(e => { e.textShadow = next; }), { keepEditing: !!editor });
    selection().forEach(e => { const node = nodeFor(e.id); if (node) C.styleElement(node, e); });
  },
  'align-text-left': () => format('textAlign', 'left'), 'align-text-center': () => format('textAlign', 'center'), 'align-text-right': () => format('textAlign', 'right'),
  'align-left': () => align('left'), 'align-center': () => align('center'), 'align-right': () => align('right'), 'align-top': () => align('top'), 'align-middle': () => align('middle'), 'align-bottom': () => align('bottom'),
  'distribute-x': () => distribute('x'), 'distribute-y': () => distribute('y'),
  'match-width': () => matchSize('width'), 'match-height': () => matchSize('height'),
  'rotate-90': () => { if (selected.size) commit(() => selection().forEach(e => { e.rotation = ((e.rotation + 90) % 360 + 360) % 360; })); },
  'rotate-reset': () => { if (selected.size) commit(() => selection().forEach(e => { e.rotation = 0; })); },
  'toggle-lock': () => {
    if (!selected.size) return;
    const next = !selection().every(e => e.locked);
    commit(() => selection().forEach(e => { e.locked = next; }));
  },
  forward: () => moveOneLayer(1), backward: () => moveOneLayer(-1),
  front: () => commit(() => { const chosen = selection(); currentSlide().elements = [...currentSlide().elements.filter(e => !selected.has(e.id)), ...chosen]; }),
  back: () => commit(() => { const chosen = selection(); currentSlide().elements = [...chosen, ...currentSlide().elements.filter(e => !selected.has(e.id))]; }),
  group: () => { if (selected.size < 2) return notify('2個以上の要素を選択してください。'); commit(() => { const group = C.id(); selection().forEach(e => { e.group = group; }); }); },
  ungroup: () => commit(() => selection().forEach(e => { delete e.group; })),
  undo: () => undo(), redo: () => undo(true), present, previous: () => navigate(-1, true), next: () => navigate(1, true),
  blackout: () => { if (bridge()) bridge().blackout(); else if (standaloneWindow && !standaloneWindow.closed) standaloneWindow.SlideShow?.blackout(); else notify('先にスライドを投影してください。'); },
  'zoom-in': () => zoom(0.1), 'zoom-out': () => zoom(-0.1),
  'zoom-fit': () => { $('zoom').value = 'fit'; fit(); },
  'insert-bible': () => { finishEditing(); $('bible-dialog').showModal(); },
  'get-current-bible': getCurrentBible,
  'confirm-bible': () => insertBible(false),
  'confirm-bible-current': () => insertBible(true),
  'insert-hymn': () => { finishEditing(); $('hymn-dialog').showModal(); },
  'get-current-hymn': getCurrentHymn,
  'confirm-hymn': insertHymn,
  'meeting-cover': meetingCover,
  'open-sorter': () => { finishEditing(); $('sorter-dialog').showModal(); renderSorter(); },
  'open-print': () => { finishEditing(); $('print-dialog').showModal(); },
  'confirm-print': runPrint,
  'open-shortcuts': () => { finishEditing(); $('shortcuts-dialog').showModal(); },
  'timer-toggle': toggleTimer,
  'timer-reset': () => { timerSeconds = 0; $('timer-display').textContent = '00:00'; }
};
function zoom(delta) {
  const value = Math.max(.15, Math.min(2, Math.round((scale + delta) * 100) / 100));
  let option = Array.from($('zoom').options).find(o => Number(o.value) === value);
  if (!option) { option = new Option(`${Math.round(value * 100)}%`, String(value)); $('zoom').add(option); }
  $('zoom').value = String(value); fit();
}

// Keep manipulation controls outside the canvas so they cannot enter a projection.
const moveable = new Moveable(space, {
  container: space, target: [], draggable: false, passDragArea: true, resizable: true, rotatable: true, origin: false,
  snappable: true, snapThreshold: 6, snapDirections: { top: true, left: true, right: true, bottom: true, center: true, middle: true },
  elementSnapDirections: { top: true, left: true, right: true, bottom: true, center: true, middle: true },
  verticalGuidelines: [0, 640, 1280], horizontalGuidelines: [0, 360, 720], snapContainer: canvas,
  throttleDrag: 1, throttleResize: 1, throttleRotate: 1, checkInput: true,
  keepRatio: false, useResizeObserver: true, useMutationObserver: true
});
const selecto = new Selecto({ container: space, dragContainer: canvas, selectableTargets: ['#canvas > .slide-element:not([data-locked="true"])'], selectByClick: false, selectFromInside: false, toggleContinueSelect: ['shift'], hitRate: 0, checkInput: true });
selecto.on('dragStart', event => { if (editor || gesture || spacePressed || event.inputEvent.target.closest('.moveable-control-box')) event.stop(); });
selecto.on('selectEnd', event => { if (event.isDragStartEnd || event.isClick || editor || gesture || spacePressed) return; choose(event.selected.map(n => n.dataset.elementId)); });
const gestureStart = event => {
  if (editor) { event.stop?.(); return; }
  gesture = true;
  const events = event.events || [event];
  for (const item of events) {
    const data = currentSlide().elements.find(e => e.id === item.target.dataset.elementId);
    item.datas.start = { x: data.x, y: data.y, width: data.width, height: data.height, rotation: data.rotation };
    if (item.set) {
      if (event.type?.startsWith('rotate') || 'setRotation' in item) item.set(data.rotation);
    }
    item.dragStart?.set([0, 0]);
  }
};
function resize(event) {
  const start = event.datas.start;
  if (!start) return;
  const text = event.target.classList.contains('slide-text');
  event.target.style.width = `${Math.max(text ? 20 : 1, event.width)}px`; event.target.style.height = `${Math.max(text ? 8 : 1, event.height)}px`;
  const translation = event.drag?.beforeTranslate || [0, 0];
  event.target.style.left = `${start.x + translation[0]}px`; event.target.style.top = `${start.y + translation[1]}px`;
}
function rotate(event) {
  if (!event.datas.start) return;
  event.target.style.transform = `rotate(${event.beforeRotate ?? event.rotate}deg)`;
  const translation = event.drag?.beforeTranslate || [0, 0];
  event.target.style.left = `${event.datas.start.x + translation[0]}px`; event.target.style.top = `${event.datas.start.y + translation[1]}px`;
}
function gestureEnd(event) {
  if (!gesture) return;
  gesture = false;
  const targets = event.targets || (event.target ? [event.target] : []);
  let modified = !!event.forceModified;
  targets.forEach(node => {
    const data = currentSlide().elements.find(e => e.id === node.dataset.elementId); if (!data) return;
    const rotation = /rotate\(([-\d.]+)deg\)/.exec(node.style.transform);
    const values = { x: parseFloat(node.style.left), y: parseFloat(node.style.top), width: parseFloat(node.style.width), height: parseFloat(node.style.height), rotation: rotation ? Number(rotation[1]) : data.rotation };
    for (const [key, value] of Object.entries(values)) if (Number.isFinite(value) && Math.abs(data[key] - value) > .01) { data[key] = value; modified = true; }
    if (data.textFit === 'grow' && syncTextBoxHeight(data.id)) modified = true;
    else if (data.textFit === 'shrink') C.fitTextElements(canvas);
  });
  if (modified) {
    history.push(deck); changed(); renderRail(); updateProperties(); updateHistory();
    if (!event.keepEditing) {
      targets.forEach(node => {
        const data = currentSlide().elements.find(e => e.id === node.dataset.elementId);
        if (data?.type === 'arrow') C.renderSlide(currentSlide(), canvas, slideRenderOptions(current));
      });
    }
  }
  moveable.updateRect();
  if (event.keepEditing) editor?.view.focus();
}
moveable.on('resizeStart', gestureStart).on('rotateStart', event => { gestureStart(event); event.set(selection()[0]?.rotation || 0); });
moveable.on('resize', resize).on('rotate', rotate);
moveable.on('resizeEnd', gestureEnd).on('rotateEnd', gestureEnd);
moveable.on('resizeGroupStart', gestureStart).on('rotateGroupStart', gestureStart);
moveable.on('resizeGroup', e => e.events.forEach(resize)).on('rotateGroup', e => e.events.forEach(rotate));
moveable.on('resizeGroupEnd', gestureEnd).on('rotateGroupEnd', gestureEnd);

let pointerMove = null;
function snapMove(items, dx, dy) {
  canvas.querySelectorAll('.snap-guide').forEach(n => n.remove());
  if (!$('snap').checked) return [dx, dy];
  const x = Math.min(...items.map(e => e.x)), right = Math.max(...items.map(e => e.x + e.width));
  const y = Math.min(...items.map(e => e.y)), bottom = Math.max(...items.map(e => e.y + e.height));
  const others = currentSlide().elements.filter(e => !selected.has(e.id) && !e.hidden);
  const axes = [
    { values: [x + dx, (x + right) / 2 + dx, right + dx], guides: [0, 640, 1280, ...others.flatMap(e => [e.x, e.x + e.width / 2, e.x + e.width])], axis: 'x' },
    { values: [y + dy, (y + bottom) / 2 + dy, bottom + dy], guides: [0, 360, 720, ...others.flatMap(e => [e.y, e.y + e.height / 2, e.y + e.height])], axis: 'y' }
  ];
  return axes.map((axis, index) => {
    let nearest = 6 / scale, adjustment = 0, line = null;
    for (const anchor of axis.values) for (const guide of axis.guides) if (Math.abs(guide - anchor) < nearest) { nearest = Math.abs(guide - anchor); adjustment = guide - anchor; line = guide; }
    if (line !== null) {
      const guide = document.createElement('div'); guide.className = 'snap-guide';
      Object.assign(guide.style, { position: 'absolute', background: '#de6e9d', pointerEvents: 'none', zIndex: 30, ...(axis.axis === 'x' ? { left: `${line}px`, top: 0, width: `${1 / scale}px`, height: '720px' } : { top: `${line}px`, left: 0, height: `${1 / scale}px`, width: '1280px' }) }); canvas.append(guide);
    }
    return [dx, dy][index] + adjustment;
  });
}

stage.addEventListener('pointerdown', event => {
  if (spacePressed && event.button === 0) {
    event.preventDefault(); event.stopPropagation();
    panState = { id: event.pointerId, x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
    stage.setPointerCapture(event.pointerId);
    stage.classList.add('is-panning-active');
  }
}, true);
stage.addEventListener('pointermove', event => {
  if (!panState || panState.id !== event.pointerId) return;
  stage.scrollLeft = panState.left - (event.clientX - panState.x);
  stage.scrollTop = panState.top - (event.clientY - panState.y);
});
function endPan(event) {
  if (!panState || panState.id !== event.pointerId) return;
  panState = null;
  stage.classList.remove('is-panning-active');
  if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
}
stage.addEventListener('pointerup', endPan);
stage.addEventListener('pointercancel', endPan);
stage.addEventListener('wheel', event => {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    zoom(event.deltaY < 0 ? 0.1 : -0.1);
  }
}, { passive: false });

canvas.addEventListener('pointerdown', event => {
  if (spacePressed || event.button !== 0 || event.target.closest('.moveable-control-box')) return;
  const node = event.target.closest('.slide-element');
  if (editor && node?.dataset.elementId === editingId) return;
  // Commit focused property fields before taking a pointer gesture snapshot.
  if (document.activeElement?.matches('input, textarea, select')) document.activeElement.blur();
  finishEditing();
  if (node) {
    const id = node.dataset.elementId;
    const data = currentSlide().elements.find(e => e.id === id);
    if (data?.locked) { if (!event.shiftKey) choose([]); return; }
    const alreadySingleSelected = !event.shiftKey && !event.altKey && selected.size === 1 && selected.has(id) && C.supportsText(data.type);
    if (event.shiftKey) { choose([id], true); return; }
    if (!selected.has(id)) choose([id]);
    canvas.focus({ preventScroll: true });
    event.preventDefault(); event.stopPropagation();
    const movableItems = selection().filter(e => !e.locked);
    if (!movableItems.length) return;
    pointerMove = {
      id: event.pointerId, x: event.clientX, y: event.clientY,
      altClone: event.altKey, cloned: false, reclickEdit: alreadySingleSelected ? id : null,
      items: movableItems.map(e => ({ id: e.id, x: e.x, y: e.y, width: e.width, height: e.height }))
    };
    gesture = true;
  } else if (!event.shiftKey) choose([]);
});
document.addEventListener('pointermove', event => {
  if (!pointerMove || pointerMove.id !== event.pointerId) return;
  if (Math.hypot(event.clientX - pointerMove.x, event.clientY - pointerMove.y) < 3 && !canvas.hasPointerCapture(event.pointerId)) return;
  if (!canvas.hasPointerCapture(event.pointerId)) canvas.setPointerCapture(event.pointerId);
  if (pointerMove.altClone && !pointerMove.cloned && currentSlide().elements.length + selection().length <= 200) {
    const clones = cloneWithFreshIds(selection(), 0);
    currentSlide().elements.push(...clones);
    selected = new Set(clones.map(c => c.id));
    C.renderSlide(currentSlide(), canvas, slideRenderOptions(current));
    pointerMove.items = clones.map(e => ({ id: e.id, x: e.x, y: e.y, width: e.width, height: e.height }));
    pointerMove.cloned = true;
    updateSelection();
  }
  const [dx, dy] = snapMove(pointerMove.items, (event.clientX - pointerMove.x) / scale, (event.clientY - pointerMove.y) / scale);
  for (const start of pointerMove.items) {
    const node = nodeFor(start.id); if (!node) continue;
    node.style.left = `${start.x + dx}px`; node.style.top = `${start.y + dy}px`;
  }
  moveable.updateRect();
});
function endPointerMove(event, cancel = false) {
  if (!pointerMove || pointerMove.id !== event.pointerId) return;
  const wasCloned = pointerMove.cloned;
  const keepEditing = !!pointerMove.keepEditing;
  const reclickId = !cancel && !wasCloned && pointerMove.reclickEdit && Math.hypot(event.clientX - pointerMove.x, event.clientY - pointerMove.y) < 3 ? pointerMove.reclickEdit : null;
  if (cancel) {
    if (wasCloned) {
      const clonedIds = new Set(pointerMove.items.map(i => i.id));
      currentSlide().elements = currentSlide().elements.filter(e => !clonedIds.has(e.id));
      selected.clear();
      pointerMove = null; gesture = false; canvas.querySelectorAll('.snap-guide').forEach(n => n.remove());
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      render(); return;
    }
    for (const start of pointerMove.items) { const node = nodeFor(start.id); if (node) { node.style.left = `${start.x}px`; node.style.top = `${start.y}px`; } }
  }
  const targets = pointerMove.items.map(e => nodeFor(e.id)).filter(Boolean);
  pointerMove = null; canvas.querySelectorAll('.snap-guide').forEach(n => n.remove());
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  gestureEnd({ targets, forceModified: wasCloned, keepEditing });
  if (reclickId) startEditing(reclickId, { clientX: event.clientX, clientY: event.clientY });
}
document.addEventListener('pointerup', event => endPointerMove(event));
document.addEventListener('pointercancel', event => endPointerMove(event, true));
canvas.addEventListener('dblclick', event => { const node = event.target.closest('.slide-element'); if (node) startEditing(node.dataset.elementId); });
stage.addEventListener('pointerdown', event => { if (!spacePressed && (event.target === stage || event.target === space)) { finishEditing(); choose([]); } });
document.addEventListener('pointerdown', event => { if (editor && !event.target.closest('.ribbon, .ribbon-tabs, #element-properties, .editing')) finishEditing(); });
// Toolbar buttons must retain the text selection until their command runs.
document.querySelectorAll('.ribbon button, .history-actions button').forEach(button => button.addEventListener('mousedown', event => event.preventDefault()));
document.addEventListener('click', event => {
  const swatch = event.target.closest('.color-swatches button[data-swatch]');
  if (swatch && ready) {
    const color = swatch.dataset.swatch;
    const target = swatch.closest('.color-swatches').dataset.colorTarget;
    if (target === 'text') {
      $('text-color').value = color;
      format('color', color);
    } else if (target === 'fill') {
      $('shape-fill').value = color;
      commit(() => selection().filter(e => C.hasFill(e.type)).forEach(e => {
        e.fill = color;
        if ('noFill' in e) e.noFill = false;
      }));
    }
    return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action) { if (!ready) return; try { const result = actions[action]?.(); if (result?.catch) result.catch(e => notify(e.message, true)); } catch (e) { notify(e.message, true); } }
  const tab = event.target.closest('[data-tab]')?.dataset.tab;
  if (tab) {
    document.querySelectorAll('[data-tab]').forEach(n => { n.setAttribute('aria-selected', String(n.dataset.tab === tab)); n.tabIndex = n.dataset.tab === tab ? 0 : -1; });
    document.querySelectorAll('.ribbon').forEach(n => { n.hidden = n.id !== `panel-${tab}`; });
  }
  const theme = event.target.closest('[data-theme]')?.dataset.theme;
  if (theme && ready && themes[theme]) {
    const t = themes[theme];
    commit(() => {
      const s = currentSlide();
      s.background = t.bg;
      if (t.end) { s.backgroundEnd = t.end; s.backgroundAngle = t.angle; }
      else delete s.backgroundEnd;
      applyTextColorClear(s, t.text);
    });
  }
  const layout = event.target.closest('[data-template]')?.dataset.template;
  if (layout && ready) addSlide(template(layout));
});
const elementMenu = $('element-menu');
const slideMenu = $('slide-menu');
const optionsButton = $('element-options');
let menuTrigger = canvas, slideMenuTrigger = null;
function closeElementMenu(restoreFocus = false) {
  if (elementMenu.hidden) return;
  elementMenu.hidden = true;
  optionsButton.setAttribute('aria-expanded', 'false');
  if (restoreFocus) menuTrigger.focus({ preventScroll: true });
}
function closeSlideMenu(restoreFocus = false) {
  if (slideMenu.hidden) return;
  slideMenu.hidden = true;
  if (restoreFocus && slideMenuTrigger) slideMenuTrigger.focus({ preventScroll: true });
}
function openElementMenu(x, y, trigger) {
  closeSlideMenu();
  finishEditing();
  menuTrigger = trigger;
  const count = selected.size;
  const enabled = {
    paste: !!clipboard, 'copy-style': count === 1, 'paste-style': count > 0 && !!copiedStyle,
    group: units(selection()).length > 1, ungroup: selection().some(e => e.group)
  };
  for (const button of elementMenu.querySelectorAll('button')) {
    button.disabled = !(enabled[button.dataset.action] ?? (count > 0));
  }
  elementMenu.hidden = false;
  optionsButton.setAttribute('aria-expanded', 'true');
  elementMenu.style.left = Math.max(4, Math.min(x, innerWidth - elementMenu.offsetWidth - 4)) + 'px';
  elementMenu.style.top = Math.max(4, Math.min(y, innerHeight - elementMenu.offsetHeight - 4)) + 'px';
  elementMenu.querySelector('button:enabled')?.focus();
}
function openSlideMenu(x, y, trigger) {
  closeElementMenu();
  finishEditing();
  slideMenuTrigger = trigger;
  slideMenu.querySelector('[data-action="slide-up"]').disabled = current === 0;
  slideMenu.querySelector('[data-action="slide-down"]').disabled = current >= deck.slides.length - 1;
  slideMenu.hidden = false;
  slideMenu.style.left = Math.max(4, Math.min(x, innerWidth - slideMenu.offsetWidth - 4)) + 'px';
  slideMenu.style.top = Math.max(4, Math.min(y, innerHeight - slideMenu.offsetHeight - 4)) + 'px';
  slideMenu.querySelector('button:enabled')?.focus();
}
optionsButton.addEventListener('click', () => {
  if (!elementMenu.hidden) return closeElementMenu(true);
  const box = optionsButton.getBoundingClientRect();
  openElementMenu(box.left, box.bottom, optionsButton);
});
canvas.addEventListener('contextmenu', event => {
  if (event.target.closest('.editing') || gesture) return;
  const node = event.target.closest('.slide-element');
  if (!node && !clipboard) return;
  event.preventDefault();
  finishEditing();
  if (!node) choose([]);
  else if (!selected.has(node.dataset.elementId)) choose([node.dataset.elementId]);
  openElementMenu(event.clientX, event.clientY, canvas);
});
canvas.addEventListener('keydown', event => {
  if (event.target !== canvas || !selected.size || !(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) return;
  event.preventDefault();
  const rect = nodeFor(selection()[0].id).getBoundingClientRect();
  openElementMenu(rect.left, rect.top, canvas);
});
for (const [menu, closeFn] of [[elementMenu, closeElementMenu], [slideMenu, closeSlideMenu]]) {
  menu.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); closeFn(true); return; }
    if (event.key === 'Tab') { closeFn(true); return; }
    const buttons = [...menu.querySelectorAll('button:enabled')];
    const index = buttons.indexOf(document.activeElement);
    const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: buttons.length - 1 }[event.key];
    if (next !== undefined && buttons.length) {
      event.preventDefault(); buttons[(next + buttons.length) % buttons.length].focus();
    }
  });
  menu.addEventListener('click', event => { if (event.target.closest('button:enabled')) closeFn(true); });
}
document.addEventListener('pointerdown', event => {
  if (!elementMenu.contains(event.target) && !optionsButton.contains(event.target)) closeElementMenu();
  if (!slideMenu.contains(event.target)) closeSlideMenu();
});
window.addEventListener('blur', () => { closeElementMenu(); closeSlideMenu(); });
window.addEventListener('resize', () => { closeElementMenu(); closeSlideMenu(); });
document.querySelector('[role=tablist]').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = Array.from(document.querySelectorAll('[data-tab]')), index = tabs.indexOf(document.activeElement);
  if (index < 0) return; event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].click(); tabs[next].focus();
});
$('font-family').addEventListener('change', () => format('fontFamily', $('font-family').value));
$('font-size').addEventListener('change', () => format('fontSize', C.number($('font-size').value, 44, 8, 240)));
$('text-color').addEventListener('input', () => format('color', $('text-color').value));
$('background-color').addEventListener('change', () => { const value = $('background-color').value; commit(() => { currentSlide().background = value; }); });
$('bg-gradient-enabled').addEventListener('change', () => {
  const checked = $('bg-gradient-enabled').checked;
  commit(() => {
    if (checked) currentSlide().backgroundEnd = $('background-color-end').value || '#dbece5';
    else delete currentSlide().backgroundEnd;
  });
});
$('background-color-end').addEventListener('change', () => {
  const value = $('background-color-end').value;
  commit(() => { currentSlide().backgroundEnd = value; });
});
$('background-angle').addEventListener('change', () => {
  const value = C.number($('background-angle').value, 135, 0, 360);
  commit(() => { currentSlide().backgroundAngle = value; });
});
$('background-overlay').addEventListener('input', () => {
  const value = C.number($('background-overlay').value, 0, 0, 0.8);
  commit(() => { currentSlide().backgroundOverlay = value; });
});
$('show-slide-number').addEventListener('change', () => {
  const value = $('show-slide-number').checked;
  commit(() => { deck.showSlideNumber = value; });
});
$('slide-transition').addEventListener('change', () => {
  const value = $('slide-transition').value;
  commit(() => { currentSlide().transition = value; });
});
$('slide-hidden').addEventListener('change', () => {
  const value = $('slide-hidden').checked;
  commit(() => { currentSlide().hidden = value; });
});
$('shape-fill').addEventListener('change', () => {
  const value = $('shape-fill').value;
  commit(() => selection().filter(e => C.hasFill(e.type)).forEach(e => { e.fill = value; if ('noFill' in e) e.noFill = false; }));
});
for (const [id, prop] of [['shape-stroke', 'stroke'], ['shape-stroke-width', 'strokeWidth'], ['shape-no-fill', 'noFill'], ['shape-stroke-style', 'strokeStyle'], ['vertical-align', 'verticalAlign'], ['text-fit', 'textFit']]) {
  $(id).addEventListener('change', () => {
    const input = $(id);
    const value = input.type === 'checkbox' ? input.checked : input.type === 'number' ? C.number(input.value, 0, 0, 24) : input.value;
    const targets = selection().filter(e => {
      if (prop === 'verticalAlign' || prop === 'textFit') return C.supportsText(e.type);
      if (prop === 'noFill') return C.isTextShape(e.type) || e.type === 'triangle' || e.type === 'text';
      if (prop === 'strokeWidth') return C.hasStroke(e.type) || e.type === 'arrow';
      if (prop === 'strokeStyle') return C.hasStroke(e.type) || e.type === 'arrow' || e.type === 'line';
      return C.hasStroke(e.type);
    });
    if (targets.length) commit(() => targets.forEach(e => {
      e[prop] = prop === 'strokeWidth' && e.type === 'arrow' ? C.number(value, 6, 2, 24) : value;
      if (prop === 'stroke' && !e.strokeWidth) e.strokeWidth = 1;
    }));
  });
}
$('prop-borderRadius').addEventListener('change', () => {
  const value = C.number($('prop-borderRadius').value, 0, 0, 200);
  commit(() => selection().filter(e => ['rect', 'image', 'text'].includes(e.type)).forEach(e => { e.borderRadius = value; }));
});
$('prop-padding').addEventListener('change', () => {
  const value = C.number($('prop-padding').value, 4, 0, 64);
  commit(() => selection().filter(e => e.type === 'text').forEach(e => { e.padding = value; }));
  selection().forEach(e => { if (e.textFit === 'grow' && syncTextBoxHeight(e.id)) { history.entries[history.index] = C.clone(deck); renderRail(); } });
  C.fitTextElements(canvas);
});
$('prop-shadow').addEventListener('change', () => {
  const value = $('prop-shadow').checked;
  commit(() => selection().forEach(e => { e.shadow = value; }));
});
$('prop-textShadow').addEventListener('change', () => {
  const value = $('prop-textShadow').checked;
  commit(() => selection().filter(e => C.supportsText(e.type)).forEach(e => { e.textShadow = value; }));
});
$('prop-locked').addEventListener('change', () => {
  const value = $('prop-locked').checked;
  commit(() => selection().forEach(e => { e.locked = value; }));
});
$('image-fit').addEventListener('change', () => { const value = $('image-fit').value; commit(() => selection().filter(e => e.type === 'image').forEach(e => { e.fit = value; })); });
document.querySelectorAll('[data-prop]').forEach(input => input.addEventListener('change', () => {
  const value = C.number(input.value, 0, Number(input.min), Number(input.max));
  commit(() => {
    const items = selection(), prop = input.dataset.prop;
    if (items.length < 2 || !['x', 'y', 'width', 'height', 'rotation'].includes(prop)) { items.forEach(e => { e[prop] = value; }); return; }
    const frame = bounds(items);
    if (prop === 'x' || prop === 'y') items.forEach(e => { e[prop] += value - frame[prop]; });
    else if (prop === 'width' || prop === 'height') {
      const axis = prop === 'width' ? 'x' : 'y', ratio = value / frame[prop];
      items.forEach(e => { e[axis] = frame[axis] + (e[axis] - frame[axis]) * ratio; e[prop] *= ratio; });
    } else {
      const delta = value - items[0].rotation, angle = delta * Math.PI / 180, cx = frame.x + frame.width / 2, cy = frame.y + frame.height / 2;
      items.forEach(e => { const x = e.x + e.width / 2 - cx, y = e.y + e.height / 2 - cy; e.x = cx + x * Math.cos(angle) - y * Math.sin(angle) - e.width / 2; e.y = cy + x * Math.sin(angle) + y * Math.cos(angle) - e.height / 2; e.rotation += delta; });
    }
  }, { keepEditing: !!editor });
  selection().forEach(e => {
    const node = nodeFor(e.id);
    if (node) C.styleElement(node, e);
    if (e.textFit === 'grow' && syncTextBoxHeight(e.id)) {
      history.entries[history.index] = C.clone(deck);
      renderRail();
    }
  });
  C.fitTextElements(canvas);
  moveable.updateRect();
}));
$('deck-name').addEventListener('change', () => commit(() => { deck.name = $('deck-name').value.trim() || '無題'; }));
$('slide-name').addEventListener('change', () => { const value = $('slide-name').value.trim() || 'スライド'; commit(() => { currentSlide().name = value; }); });
$('speaker-notes').addEventListener('input', () => {
  currentSlide().notes = $('speaker-notes').value;
  $('notes-count').textContent = `${Array.from(currentSlide().notes).length}文字`;
  clearTimeout(textTimer); textTimer = setTimeout(flushText, 500);
  $('save-status').textContent = '編集中…';
});
$('toggle-notes').addEventListener('click', () => {
  const panel = $('notes-panel');
  if (panel.classList.contains('is-expanded')) {
    panel.classList.remove('is-expanded');
    panel.classList.add('is-collapsed');
    $('toggle-notes').textContent = '表示 ▴';
  } else if (panel.classList.contains('is-collapsed')) {
    panel.classList.remove('is-collapsed');
    $('toggle-notes').textContent = '展開 ▾';
  } else {
    panel.classList.add('is-expanded');
    $('toggle-notes').textContent = '折りたたむ ▾';
  }
});
$('zoom').addEventListener('change', fit);
$('snap').addEventListener('change', () => { moveable.snappable = $('snap').checked; });
$('show-grid').addEventListener('change', () => { canvas.classList.toggle('show-grid', $('show-grid').checked); });
$('import-file').addEventListener('change', async () => { try { await importDeck($('import-file').files[0]); } catch (e) { notify(`資料を読み込めません。${e.message}`, true); } finally { $('import-file').value = ''; } });
$('import-pptx-file').addEventListener('change', async () => { try { await handlePptxFile($('import-pptx-file').files[0]); } catch (e) { notify(`PPTXを読み込めません。${e.message}`, true); } finally { $('import-pptx-file').value = ''; } });
$('image-file').addEventListener('change', async () => { try { if ($('image-file').files[0]) await insertImage($('image-file').files[0], imagePurpose); } catch (e) { notify(e.message, true); } finally { $('image-file').value = ''; } });
canvas.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
canvas.addEventListener('drop', async e => {
  if (!e.dataTransfer.files.length) return;
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  try {
    if (/\.pptx$/i.test(file.name)) await handlePptxFile(file);
    else await insertImage(file);
  } catch (error) { notify(error.message, true); }
});
document.addEventListener('paste', async event => {
  if (editor || event.target.closest('input, textarea, [contenteditable=true]')) return;
  const image = Array.from(event.clipboardData?.files || []).find(f => f.type.startsWith('image/'));
  if (image) { event.preventDefault(); try { await insertImage(image); } catch (e) { notify(e.message, true); } }
});
document.addEventListener('keydown', event => {
  if (!ready || event.isComposing || document.querySelector('dialog[open]')) return;
  if (gesture) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (pointerMove) endPointerMove({ pointerId: pointerMove.id }, true);
      else { moveable.stopDrag(); gesture = false; render(); }
    }
    return;
  }
  if (event.key === 'Shift') moveable.keepRatio = true;
  const input = event.target.closest('input, textarea, select, [contenteditable=true]');
  if (event.code === 'Space' && !input && !editor) {
    event.preventDefault();
    if (!spacePressed) { spacePressed = true; stage.classList.add('is-panning'); }
    return;
  }
  if (event.key === 'Escape') { finishEditing(); choose([]); return; }
  const mod = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
  if (mod && key === 's') { event.preventDefault(); exportDeck(); return; }
  if (input) return;
  if (event.key === '?' || (event.shiftKey && event.key === '/')) { event.preventDefault(); actions['open-shortcuts'](); return; }
  if ((event.key === 'F2' || event.key === 'Enter') && selected.size === 1 && !selection()[0].locked && C.supportsText(selection()[0].type)) {
    event.preventDefault(); startEditing(selection()[0].id); return;
  }
  if (mod && key === 'z') { event.preventDefault(); undo(event.shiftKey); }
  else if (mod && key === 'y') { event.preventDefault(); undo(true); }
  else if (mod && key === 'a') { event.preventDefault(); choose(currentSlide().elements.filter(e => !e.locked && !e.hidden).map(e => e.id)); }
  else if (mod && key === 'd') { event.preventDefault(); actions.duplicate(); }
  else if (mod && event.shiftKey && key === 'c') { event.preventDefault(); actions['copy-style'](); }
  else if (mod && event.shiftKey && key === 'v') { event.preventDefault(); actions['paste-style'](); }
  else if (mod && (key === 'c' || key === 'x') && selected.size) { event.preventDefault(); actions[key === 'c' ? 'copy' : 'cut'](); }
  else if (mod && key === 'v' && clipboard) { event.preventDefault(); actions.paste(); }
  else if (mod && event.shiftKey && key === 'g') { event.preventDefault(); actions.ungroup(); }
  else if (mod && key === 'g') { event.preventDefault(); actions.group(); }
  else if (mod && key === ']') { event.preventDefault(); actions.forward(); }
  else if (mod && key === '[') { event.preventDefault(); actions.backward(); }
  else if (mod && key === 'l') { event.preventDefault(); actions['toggle-lock'](); }
  else if (mod && key === '0') { event.preventDefault(); actions['zoom-fit'](); }
  else if (mod && (key === '=' || key === '+')) { event.preventDefault(); actions['zoom-in'](); }
  else if (mod && key === '-') { event.preventDefault(); actions['zoom-out'](); }
  else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); actions.delete(); }
  else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && selected.size) {
    event.preventDefault();
    const movable = selection().filter(e => !e.locked);
    if (!movable.length) return;
    const step = event.shiftKey ? 10 : 1;
    commit(() => movable.forEach(e => {
      if (event.key === 'ArrowLeft') e.x -= step;
      if (event.key === 'ArrowRight') e.x += step;
      if (event.key === 'ArrowUp') e.y -= step;
      if (event.key === 'ArrowDown') e.y += step;
    }));
  }
  else if (event.key === 'PageDown') { event.preventDefault(); navigate(1); }
  else if (event.key === 'PageUp') { event.preventDefault(); navigate(-1); }
  else if (event.key === 'F5') { event.preventDefault(); present(); }
});
document.addEventListener('keyup', event => {
  if (event.key === 'Shift') moveable.keepRatio = false;
  if (event.code === 'Space') { spacePressed = false; panState = null; stage.classList.remove('is-panning', 'is-panning-active'); }
});
window.addEventListener('blur', () => { moveable.keepRatio = false; spacePressed = false; panState = null; stage.classList.remove('is-panning', 'is-panning-active'); });
window.addEventListener('afterprint', () => { $('print-sheets').replaceChildren(); });
window.addEventListener('beforeunload', event => {
  flushText();
  if (revision !== savedRevision) { save(); event.preventDefault(); event.returnValue = ''; }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && ready) { flushText(); save(); } });
new ResizeObserver(() => { if (ready) { fit(); renderRail(); } }).observe(stage);
// Used only by the same-origin projection window; never exposes mutable draft data.
window.SlideStudio = {
  navigate: delta => navigate(delta, true),
  syncProjected: (slideId, index) => {
    projectedSlideId = slideId || null;
    if (Number.isFinite(index)) $('projection-state').textContent = `${index + 1}枚目を投影中`;
    renderRail();
  }
};
async function init() {
  try {
    storage = await openStorage(); const saved = await storage.load();
    if (saved) deck = C.validate(saved);
    savedRevision = revision; $('save-status').textContent = 'この端末に保存済み';
  } catch (e) {
    storage = null; $('save-status').textContent = '自動保存できません';
    notify(`自動保存を利用できません。元の保存データは上書きしません。「資料を保存」をご利用ください。${e.message || ''}`, true);
  }
  history = new C.History(deck); ready = true; document.body.inert = false; $('workspace').inert = false; render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('../service-worker.js').catch(() => {});
}
init();
