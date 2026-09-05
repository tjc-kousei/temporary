// Both layouts share the same live input and projection state.
const infoFields = ['worship', 'jtitle', 'ctitle', 'speecher', 'translator', 'hymn', 'hymn2nd'];
let projectedBible = null;
let searchReturnFocus = null;
let projectionObserver = null;
let observedProjectionDocument = null;
let previewTimer = null;
let previewMarkup = '';

function readInfoInputs() {
  return Object.fromEntries(infoFields.map(key => [key, document.getElementById(key).value]));
}

function updateLiveInfo() {
  saveCookies();
  commit();
  renderPlannedHymns();
}

function getSavedUiStyle() {
  try { return localStorage.getItem('meetingUiStyle') === 'modern' ? 'modern' : 'classic'; }
  catch { return 'classic'; }
}

function setUiStyle(style, { persist = true } = {}) {
  const selected = style === 'modern' ? 'modern' : 'classic';
  document.documentElement.dataset.uiStyle = selected;
  const select = document.getElementById('ui-style-select');
  select.value = selected;
  select.dispatchEvent(new Event('sync-selection'));
  if (persist) {
    try { localStorage.setItem('meetingUiStyle', selected); }
    catch { /* The selection still works for this page session. */ }
  }
  const fullscreen = document.getElementById('fullscreen-toggle');
  const slot = selected === 'classic' ? document.getElementById('classic-fullscreen-slot') : document.querySelector('.projection-toolbar-secondary');
  slot.prepend(fullscreen);
  updateLayoutLabels();
  updateFullscreenButton();
  refreshProjectionConsole();
}

function updateLayoutLabels() {
  const classic = document.documentElement.dataset.uiStyle === 'classic';
  document.getElementById('register-verse-btn').textContent = classic ? '📌 記憶' : '聖句を登録';
  document.getElementById('clear-verses-btn').textContent = classic ? '🗑️ 消去' : '登録を全消去';
  const history = document.getElementById('history');
  if (history.options[0]) history.options[0].textContent = classic ? '📖 履歴' : '登録した聖句';
  history.dispatchEvent(new Event('sync-selection'));
}

function renderPlannedHymns() {
  const wrap = document.getElementById('planned-hymns');
  wrap.replaceChildren();
  const label = document.createElement('span');
  label.textContent = '礼拝讃美歌から選択';
  wrap.append(label);
  let count = 0;
  ['hymn', 'hymn2nd'].forEach((key, index) => {
    const number = getNormalizedHymnNumber(document.getElementById(key).value);
    if (!number) return;
    count++;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-btn';
    button.textContent = `${index + 1}曲目：${number}番`;
    button.addEventListener('click', () => {
      document.getElementById('prehymn').value = number;
      recievehymn(number);
    });
    wrap.append(button);
  });
  if (!count) {
    const hint = document.createElement('small');
    hint.textContent = '基本情報に番号を入力すると、ここから選べます。';
    wrap.append(hint);
  }
}

function findBibleRow(book, chapter, verse) {
  if (book === '' || !Abbre[book] || !/^\d+$/.test(String(chapter)) || !/^\d+$/.test(String(verse))) return null;
  return bible.find(row => row && row[3] === `${Abbre[book]}${Number(chapter)}:${Number(verse)}`) || null;
}

function setBibleStatus(message) {
  const status = document.getElementById('verse_count_display');
  if (status) status.textContent = message;
}

function clearBibleInputs() {
  document.getElementById('syou').value = '';
  document.getElementById('setu').value = '';
  syou = '';
  setu = '';
  countVersesInChapter();
  showBible();
}

function navigateBible(direction) {
  const base = { book: abbre, chapter: syou, verse: setu };
  const nextVerse = Number(base.verse) + direction;
  if (!findBibleRow(base.book, base.chapter, nextVerse)) {
    setBibleStatus('この章には移動先の節がありません。投影内容は保持しています。');
    return;
  }
  abbre = base.book;
  syou = base.chapter;
  setu = String(nextVerse);
  document.getElementById('syou').value = syou;
  document.getElementById('setu').value = setu;
  updateBibleBookSelectionUi();
  countVersesInChapter();
  if (showBible()) checkwindow('bible');
}

function toggleBlackout() {
  const doc = getDisplayDocument();
  if (!doc?.getElementById('projection-blackout')) return;
  doc.body.classList.toggle('is-blacked-out');
  refreshProjectionConsole();
}

function bindProjectionPreview() {
  const doc = getDisplayDocument();
  if (!doc?.getElementById('title-view') || observedProjectionDocument === doc) return;
  projectionObserver?.disconnect();
  observedProjectionDocument = doc;
  previewMarkup = '';
  projectionObserver = new MutationObserver(() => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(refreshProjectionConsole, 80);
  });
  projectionObserver.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
  display_win.addEventListener('resize', refreshProjectionConsole);
  refreshProjectionConsole();
}

function refreshProjectionConsole() {
  const doc = getDisplayDocument();
  const connected = !!doc?.getElementById('title-view');
  const blackedOut = connected && doc.body.classList.contains('is-blacked-out');
  const names = { title: '基本情報', hymn: '讃美歌', bible: '聖書', capture: '画面キャプチャ' };
  const status = document.getElementById('projection-status');
  const preview = document.getElementById('projection-preview');
  const frame = document.getElementById('projection-preview-frame');
  const video = document.getElementById('projection-preview-video');
  const empty = document.getElementById('preview-empty');
  const blackButton = document.getElementById('blackout-toggle');
  const modeText = blackedOut ? '黒画面' : names[currentMode];
  const statusText = connected ? `投影中：${modeText}` : '投影画面：未接続';
  if (status.textContent !== statusText) status.textContent = statusText;
  document.getElementById('preview-mode').textContent = connected ? modeText : '未接続';
  document.querySelector('.projection-status').classList.toggle('is-connected', connected);
  document.querySelector('.projection-status').classList.toggle('is-blacked-out', blackedOut);
  blackButton.disabled = !connected;
  blackButton.textContent = blackedOut ? '投影を再開' : '黒画面にする';
  blackButton.setAttribute('aria-pressed', String(blackedOut));
  Object.keys(names).forEach(mode => {
    const selected = connected && mode === currentMode;
    const button = document.getElementById(`btn-mode-${mode}`);
    button.classList.toggle('primary', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  if (!connected) {
    preview.classList.remove('is-blacked-out');
    frame.hidden = true;
    video.hidden = true;
    video.srcObject = null;
    empty.hidden = false;
    empty.textContent = '上部の表示ボタンから投影画面を開いてください';
    document.getElementById('projection-description').textContent = '投影画面は接続されていません。';
    projectionObserver?.disconnect();
    observedProjectionDocument = null;
    return;
  }
  if (document.documentElement.dataset.uiStyle !== 'modern') {
    frame.hidden = true;
    video.hidden = true;
    video.srcObject = null;
    return;
  }
  const width = Math.max(1, display_win.innerWidth);
  const height = Math.max(1, display_win.innerHeight);
  preview.style.aspectRatio = `${width} / ${height}`;
  empty.hidden = !blackedOut;
  empty.textContent = blackedOut ? '黒画面を投影中' : '';
  preview.classList.toggle('is-blacked-out', blackedOut);
  const isCapture = currentMode === 'capture' && captureStream?.active;
  video.hidden = blackedOut || !isCapture;
  if (video.srcObject !== (isCapture ? captureStream : null)) video.srcObject = isCapture ? captureStream : null;
  frame.hidden = blackedOut || isCapture;
  const view = doc.getElementById(`${currentMode}-view`);
  const summary = currentMode === 'capture' ? (isCapture ? '選択した画面を共有しています。' : '画面キャプチャが接続されていません。') : (view?.innerText.trim().replace(/\s+/g, ' ') || '表示内容がありません。');
  document.getElementById('projection-description').textContent = blackedOut
    ? `投影を一時停止しています。再開すると「${names[currentMode]}」を表示します。` : summary;
  if (!frame.hidden) {
    // Mirror rendered DOM and computed font sizes. Scripts never run in this sandboxed preview.
    const head = Array.from(doc.head.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('');
    const body = doc.body.cloneNode(true);
    body.querySelectorAll('script, iframe, object, embed').forEach(el => el.remove());
    body.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).filter(attr => attr.name.startsWith('on')).forEach(attr => el.removeAttribute(attr.name));
    });
    const rootStyle = doc.documentElement.getAttribute('style') || '';
    const markup = head + rootStyle + body.outerHTML;
    const target = frame.contentDocument;
    if (target && markup !== previewMarkup) {
      previewMarkup = markup;
      target.documentElement.lang = 'ja';
      target.documentElement.setAttribute('style', rootStyle);
      if (target.head.dataset.previewHead !== head) {
        target.head.replaceChildren();
        const base = target.createElement('base');
        base.href = doc.baseURI;
        target.head.append(base);
        doc.head.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => target.head.append(target.importNode(el, true)));
        target.head.dataset.previewHead = head;
      }
      target.body.replaceWith(target.importNode(body, true));
    }
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
    frame.style.transform = `scale(${preview.clientWidth / width})`;
  }
}

function initProjectionConsole() {
  document.getElementById('projection-preview-frame').addEventListener('load', () => { previewMarkup = ''; refreshProjectionConsole(); });
  setUiStyle(getSavedUiStyle(), { persist: false });
  updateLiveInfo();
  loadLastUpdated();
  new ResizeObserver(refreshProjectionConsole).observe(document.getElementById('projection-preview'));
  // Window closure has no reliable cross-browser notification; poll only the connection, not preview content.
  setInterval(() => {
    if (observedProjectionDocument && (!display_win || display_win.closed)) refreshProjectionConsole();
  }, 500);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || bibleSearchModal?.style.display !== 'block') return;
    const visibleModals = Array.from(document.querySelectorAll('.search-modal')).filter(el => el.style.display === 'block');
    if (visibleModals.some(el => el !== bibleSearchModal)) return;
    const focusable = Array.from(bibleSearchModal.querySelectorAll('button, input, select, textarea, a[href], [tabindex]'))
      .filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (!first) return;
    if (!bibleSearchModal.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });
  refreshProjectionConsole();
}

// GitHub Pages exposes the published HTML timestamp in Last-Modified.
// Do not substitute the visitor's current date when metadata is unavailable.
function showLastUpdated(value) {
  const timestamp = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(timestamp)) return false;
  const date = new Date(timestamp);
  const time = document.getElementById('last-updated-time');
  time.dateTime = date.toISOString();
  time.textContent = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
  document.getElementById('last-updated').hidden = false;
  document.getElementById('last-updated').title = '公開ページの更新日（日本時間）';
  return true;
}

async function loadLastUpdated() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(window.location.href, { method: 'HEAD', cache: 'no-cache', signal: controller.signal });
    if (response.ok) showLastUpdated(response.headers.get('Last-Modified'));
  } catch { /* Offline or missing metadata: leave the date hidden. */ }
  finally { clearTimeout(timer); }
}
