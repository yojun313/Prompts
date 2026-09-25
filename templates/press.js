// 아이폰 앱처럼 누르는 느낌 — 눌림 표시 · 햅틱 · 느린 버튼 표시 (09-native-touch-feel.md)
// <head> 에서 바로 불러도 된다 (document 에만 리스너를 건다). CSS 는 templates/mobile.css 의 "누르는 느낌" 부분.
(function () {
  'use strict';

  // 버튼처럼 흐려질 것 / 목록 줄처럼 배경이 진해질 것 — 프로젝트에 맞게 고친다
  const PRESSABLE = 'button, [role="button"], a[href], summary, .pressable, .row';
  const ROW = '.row, .list-item';

  // ── 햅틱 ──────────────────────────────────────────────────────────────
  // 안드로이드: navigator.vibrate. iOS 는 vibrate 가 없다.
  // iOS 18+: <input type="checkbox" switch> 를 토글하면 시스템이 햅틱을 낸다 → 숨긴 스위치의 label 을 click().
  // ⚠️ 사용자 제스처(click/touchend 처리 중)에서만 울린다. await 뒤 · setTimeout 안 · WebSocket 메시지에서는 무시된다.
  let hapticLabel = null;
  function haptic(pattern = 8) {
    try {
      if (typeof navigator.vibrate === 'function') { navigator.vibrate(pattern); return; }
      if (!document.body) return;
      if (!hapticLabel) {
        hapticLabel = document.createElement('label');
        hapticLabel.setAttribute('aria-hidden', 'true');
        // display:none 이면 안 울린다 — 화면 밖에 1px 로 둔다
        hapticLabel.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.setAttribute('switch', '');
        box.tabIndex = -1;
        hapticLabel.appendChild(box);
        // 가짜 클릭이 "바깥 클릭 → 메뉴 닫기" 처리로 번지지 않게
        const stop = (event) => event.stopPropagation();
        hapticLabel.addEventListener('click', stop);
        box.addEventListener('click', stop);
        document.body.appendChild(hapticLabel);
      }
      hapticLabel.click();
    } catch (e) { /* noop */ }
  }

  // ── 눌림 표시 ─────────────────────────────────────────────────────────
  // 누르는 순간 0ms 로 .is-pressed, 뗄 때 .press-release 로 200ms 에 걸쳐 복귀.
  // 목록 줄은 70ms 늦게 (스크롤하려고 댄 손가락에 번쩍이지 않게), 10px 넘게 움직이거나 스크롤이 시작되면 취소.
  let pressed = null;
  let pressTimer = 0;
  let pressStart = null;
  function release(fade = true) {
    clearTimeout(pressTimer);
    const el = pressed;
    pressed = null;
    if (!el || !el.classList.contains('is-pressed')) return;
    el.classList.remove('is-pressed');
    if (!fade) return;
    el.classList.add('press-release');
    setTimeout(() => el.classList.remove('press-release'), 220);
  }
  const opts = { capture: true, passive: true };
  document.addEventListener('pointerdown', (event) => {
    if (event.button > 0) return;
    release(false);
    const target = event.target.closest?.(PRESSABLE);   // 가장 안쪽 — 줄 안의 ⋯ 버튼을 누르면 그 버튼만
    if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return;
    pressed = target;
    pressStart = { x: event.clientX, y: event.clientY };
    if (event.pointerType !== 'mouse' && target.matches(ROW)) pressTimer = setTimeout(() => pressed?.classList.add('is-pressed'), 70);
    else target.classList.add('is-pressed');
  }, opts);
  document.addEventListener('pointermove', (event) => {
    if (pressed && pressStart && Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > 10) release(false);
  }, opts);
  document.addEventListener('pointerup', () => {
    // 70ms 안에 톡 친 줄도 눌림을 한 번 보여 준다
    if (pressed && !pressed.classList.contains('is-pressed')) {
      clearTimeout(pressTimer);
      const el = pressed;
      el.classList.add('is-pressed');
      pressTimer = setTimeout(() => { if (pressed === el) release(true); }, 90);
      return;
    }
    release(true);
  }, opts);
  document.addEventListener('pointercancel', () => release(false), opts);   // iOS: 스크롤이 시작되면 온다
  document.addEventListener('scroll', () => release(false), opts);
  document.addEventListener('dragstart', () => release(false), opts);
  // iOS Safari 는 touchstart 리스너가 하나라도 있어야 CSS :active 를 적용한다
  document.addEventListener('touchstart', () => {}, { passive: true });

  // 고르는 동작(세그먼트 · 필터 · 스위치 · 확인)에는 가벼운 햅틱
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-haptic], .segmented button, .filter-chip')) haptic(6);
  });

  // ── 느린 버튼 ─────────────────────────────────────────────────────────
  // 방금 누른 버튼이 시작한 요청이 120ms 넘게 걸리면 그 버튼을 .is-busy (흐림 + 다시 누르기 막기)
  let lastTap = null;
  document.addEventListener('click', (event) => {
    if (hapticLabel && hapticLabel.contains(event.target)) return;
    const el = event.target.closest?.('button, [role="button"]');
    lastTap = el ? { el, t: performance.now() } : null;
  }, true);
  async function api(url, init) {
    const tap = lastTap && performance.now() - lastTap.t < 80 ? lastTap.el : null;
    lastTap = null;
    if (!tap) return fetch(url, init);
    const timer = setTimeout(() => tap.classList.add('is-busy'), 120);
    try { return await fetch(url, init); } finally { clearTimeout(timer); tap.classList.remove('is-busy'); }
  }

  window.NativeFeel = { haptic, api };
})();
