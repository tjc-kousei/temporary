/* Small integration layer. The editor and its dependencies load only in a separate window. */
(function () {
  'use strict';
  let snapshot = null, editorWindow = null;
  function notifyEditor() {
    try {
      if (editorWindow && !editorWindow.closed && snapshot) {
        const slide = snapshot.deck.slides[snapshot.index];
        editorWindow.SlideStudio?.syncProjected?.(slide?.id, snapshot.index);
      }
    } catch { /* Ignore cross-origin or closing editor window. */ }
  }
  function render(win, animate = false) {
    const host = win?.document.getElementById('slides-view');
    if (!host || !snapshot) return;
    const canvas = host.querySelector('.slide-canvas') || win.document.createElement('div');
    if (!canvas.parentNode) host.append(canvas);
    const slide = snapshot.deck.slides[snapshot.index];
    SlideCore.renderSlide(slide, canvas, {
      slideNumber: snapshot.deck.showSlideNumber ? { current: snapshot.index + 1, total: snapshot.deck.slides.length } : null
    });
    if (animate) {
      canvas.classList.remove('slide-transition-fade', 'slide-transition-slide');
      if (slide.transition && slide.transition !== 'none') {
        void canvas.offsetWidth;
        canvas.classList.add(`slide-transition-${slide.transition}`);
      }
    }
    const fit = () => SlideCore.fitCanvas(canvas, host);
    fit();
    if (!host.__slideObserver && window.ResizeObserver) {
      host.__slideObserver = new ResizeObserver(fit); host.__slideObserver.observe(host);
    }
  }
  function openEditor() {
    if (!editorWindow || editorWindow.closed) {
      editorWindow = window.open(new URL('./slides/index.html', window.location.href).href, 'assembly-slide-editor', 'width=1500,height=950,resizable=yes,scrollbars=yes');
    }
    if (editorWindow) editorWindow.focus();
    else showToast('スライド編集画面を開けません。ポップアップを許可してください。', 'error');
  }
  function show(focusExisting = true) {
    if (!snapshot) { showToast('スライド編集画面で「投影へ反映」を押してください'); openEditor(); return; }
    checkwindow('slides', focusExisting);
    getProjectionWindows().forEach(win => render(win, false));
    refreshProjectionConsole();
    notifyEditor();
  }
  function receive(value) {
    const deck = SlideCore.validate(value.deck);
    snapshot = { deck, index: Math.floor(SlideCore.number(value.index, 0, 0, deck.slides.length - 1)) };
    show(false);
  }
  function navigate(delta) {
    if (!snapshot || currentMode !== 'slides') return;
    const next = SlideCore.nextVisibleIndex(snapshot.deck.slides, snapshot.index, delta);
    if (next === snapshot.index) return;
    snapshot.index = next;
    getProjectionWindows().forEach(win => render(win, true));
    refreshProjectionConsole();
    notifyEditor();
  }
  function getContext() {
    const row = projectedBible && findBibleRow(projectedBible.book, projectedBible.chapter, projectedBible.verse);
    let hymn = null;
    if (typeof currentTitleInfo !== 'undefined' && currentTitleInfo) {
      const jaMap = typeof selectedHymnLyrics !== 'undefined' ? selectedHymnLyrics?.ja : null;
      const zhMap = typeof selectedHymnLyrics !== 'undefined' ? selectedHymnLyrics?.zh : null;
      hymn = {
        number: String(currentTitleInfo[0] || '').trim(),
        chineseTitle: currentTitleInfo[1] || '',
        japaneseTitle: currentTitleInfo[2] || '',
        jaVerses: jaMap ? [...jaMap.entries()].map(([label, lines]) => ({ label, lines })) : [],
        zhVerses: zhMap ? [...zhMap.entries()].map(([label, lines]) => ({ label, lines })) : []
      };
    }
    return {
      info: readInfoInputs(),
      bible: row ? { reference: row[3], japanese: row[4], chinese: row[2] } : null,
      hymn
    };
  }
  window.SlideProjection = { openEditor, show, receive, render, navigate, getContext, blackout: () => toggleBlackout() };
})();
