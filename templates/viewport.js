// 모바일 뷰포트 처리: 키보드 대응 · 확대 막기 · kb-open 표시
// <body class="app-shell"> 와 mobile.css 와 함께 쓴다.
(function () {
  'use strict';
  const coarse = matchMedia('(pointer: coarse)').matches;
  const isEditable = (el) => !!el && (el.tagName === 'TEXTAREA' || el.isContentEditable
    || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'file', 'range'].includes(el.type)));
  let lastVisible = 0;

  function syncViewport() {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const typing = coarse && isEditable(document.activeElement);
    const visible = vv ? vv.height : innerHeight;
    // 평소엔 100%. 키보드(입력칸 포커스 또는 보이는 영역이 확 줄어듦)일 때만 보이는 영역에 맞춘다.
    // iOS 홈 화면 앱은 innerHeight 도 같이 줄어드는 경우가 있어 높이 차이만으로는 감지 못 한다.
    const keyboard = !!vv && (typing || innerHeight - vv.height > 80);
    root.style.setProperty('--app-h', keyboard ? `${Math.round(visible)}px` : '100%');
    root.style.setProperty('--vv-top', keyboard ? `${Math.round(vv.offsetTop)}px` : '0px');
    root.classList.toggle('kb-open', typing);
    if (scrollY || scrollX) scrollTo(0, 0);
    if (visible < lastVisible && typing) {
      const el = document.activeElement;
      requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
    }
    lastVisible = visible;
  }

  syncViewport();
  visualViewport?.addEventListener('resize', syncViewport);
  visualViewport?.addEventListener('scroll', syncViewport);
  addEventListener('resize', syncViewport);
  addEventListener('scroll', () => { if (scrollY) scrollTo(0, 0); }, { passive: true });

  if (coarse) {
    const soon = () => [0, 100, 300, 600].forEach((ms) => setTimeout(syncViewport, ms));
    document.addEventListener('focusin', soon);
    document.addEventListener('focusout', soon);
    addEventListener('orientationchange', soon);
    // 핀치 확대 막기 (두 번 탭 확대는 CSS touch-action: manipulation 이 막는다 — touchend 는 건드리지 말 것)
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
    document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  }
})();
