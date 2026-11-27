(() => {
  let snapshot, hideTimer;
  const canvas = document.getElementById('canvas'), host = document.getElementById('output');
  const bar = document.getElementById('presenter-bar'), pageLabel = document.getElementById('presenter-page');
  const fit = () => SlideCore.fitCanvas(canvas, host);
  function notifyOpener() {
    try {
      if (snapshot) window.opener?.SlideStudio?.syncProjected?.(snapshot.deck.slides[snapshot.index]?.id, snapshot.index);
    } catch { /* Ignore closed or unreachable opener. */ }
  }
  function renderCurrent(animate = false) {
    if (!snapshot) return;
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
    pageLabel.textContent = `${snapshot.index + 1} / ${snapshot.deck.slides.length}`;
    fit();
    notifyOpener();
  }
  function move(direction) {
    if (!snapshot) return;
    const next = SlideCore.nextVisibleIndex(snapshot.deck.slides, snapshot.index, direction);
    if (next === snapshot.index) return;
    snapshot.index = next;
    renderCurrent(true);
  }
  function toggleFullscreen() {
    const action = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    action?.catch(() => {});
  }
  function showBar() {
    bar.classList.add('is-visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => bar.classList.remove('is-visible'), 3000);
  }
  window.SlideShow = {
    apply(value) {
      const deck = SlideCore.validate(value.deck);
      snapshot = { deck, index: Math.floor(SlideCore.number(value.index, 0, 0, deck.slides.length - 1)) };
      renderCurrent(false);
    },
    blackout() { document.body.classList.toggle('blackout'); }
  };
  new ResizeObserver(fit).observe(host);
  document.addEventListener('mousemove', showBar);
  document.addEventListener('dblclick', event => {
    if (event.target.closest('#presenter-bar')) return;
    toggleFullscreen();
  });
  document.getElementById('present-prev').addEventListener('click', () => move(-1));
  document.getElementById('present-next').addEventListener('click', () => move(1));
  document.getElementById('present-blackout').addEventListener('click', () => window.SlideShow.blackout());
  document.getElementById('present-fullscreen').addEventListener('click', toggleFullscreen);
  document.addEventListener('keydown', event => {
    if (event.key.toLowerCase() === 'b') { window.SlideShow.blackout(); return; }
    const direction = ['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key) ? -1 : 0;
    if (!direction || !snapshot) return;
    event.preventDefault();
    move(direction);
  });
})();
