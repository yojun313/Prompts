# 03. 웹이 아니라 앱처럼 느껴지는 UI 패턴

## 1. 하단 탭바 (휴대폰에서만)

데스크톱은 사이드바, 휴대폰은 하단 탭바. 같은 레이아웃 템플릿 안에서 `md:hidden` 으로 나눈다.

```html
<main class="flex-1 flex flex-col min-w-0 h-full">
  <header>…</header>
  {% block content %}{% endblock %}

  <nav class="tabbar md:hidden" aria-label="하단 메뉴">
    {% for key, href, icon, label in [('workspace','/','fa-terminal','터미널'), ('server','/server','fa-server','서버'), ('git','/git','fa-code-branch','Git')] %}
    <a href="{{ href }}" class="tab-item {{ 'active' if active_page == key }}" {% if active_page == key %}aria-current="page"{% endif %}>
      <span class="tab-icon"><i class="fas {{ icon }}"></i>{% if key == 'workspace' %}<span id="tabBadge" class="tab-badge hidden"></span>{% endif %}</span>
      <span class="tab-label">{{ label }}</span>
    </a>
    {% endfor %}
  </nav>

  <footer class="hidden md:block">…</footer>   <!-- 푸터는 데스크톱만 -->
</main>
```

```css
.tabbar {
  display: flex; flex-shrink: 0; z-index: 30;
  /* 홈 인디케이터와 살짝 겹치게 해야 네이티브 탭바처럼 낮아 보인다 */
  padding: 6px 6px max(6px, calc(env(safe-area-inset-bottom) - 12px));
  background: rgba(10, 13, 24, .92);
  backdrop-filter: blur(20px) saturate(160%); -webkit-backdrop-filter: blur(20px) saturate(160%);
  border-top: 1px solid rgba(255, 255, 255, .08);
}
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
            padding: 5px 0 2px; border-radius: 12px; color: rgba(255,255,255,.45); -webkit-tap-highlight-color: transparent; }
.tab-item .tab-icon { position: relative; font-size: 18px; height: 20px; }
.tab-item .tab-label { font-size: 10.5px; font-weight: 700; }
.tab-item.active { color: #93c5fd; }
.tab-badge { position: absolute; top: -5px; left: 13px; min-width: 16px; height: 16px; padding: 0 4px;
             border-radius: 999px; background: #f59e0b; color: #111827; font-size: 10px; font-weight: 800;
             display: flex; align-items: center; justify-content: center; }
.tab-badge.hidden { display: none; }
html.kb-open .tabbar { display: none; }  /* 키보드 올라오면 숨김 */
```

배지 갱신 (주의가 필요한 개수):

```js
const badge = document.getElementById('tabBadge');
badge.textContent = n > 99 ? '99+' : String(n);
badge.classList.toggle('hidden', !n);
document.title = n ? `(${n}) ${baseTitle}` : baseTitle;   // 탭 제목에도
```

## 2. 바텀 시트 (모바일) = 가운데 모달 (데스크톱)

`alert/confirm/prompt` 대신. 같은 마크업을 폭에 따라 다르게 보이게 한다.

```html
<div id="sheetOverlay" class="sheet-overlay" hidden>
  <div class="tdx-sheet" role="dialog" aria-modal="true">
    <div class="sheet-grip"></div>
    <div id="sheetBody"></div>
  </div>
</div>
```

```css
.sheet-overlay { position: fixed; inset: 0; z-index: 400; background: rgba(5,7,15,.55);
                 backdrop-filter: blur(4px); display: flex; align-items: flex-end; justify-content: center; }
.sheet-overlay[hidden] { display: none; }
.tdx-sheet { width: 100%; max-height: calc(var(--app-h) - 40px); overflow-y: auto; overscroll-behavior: contain;
             border-radius: 22px 22px 0 0; background: rgba(20,25,40,.96); border: 1px solid rgba(255,255,255,.12);
             padding-bottom: max(12px, env(safe-area-inset-bottom)); animation: scaleUp .2s ease-out; }
.sheet-grip { width: 38px; height: 4px; border-radius: 99px; background: rgba(148,163,184,.4); margin: 8px auto 4px; }
@media (min-width: 640px) {
  .sheet-overlay { align-items: center; padding: 20px; }
  .tdx-sheet { max-width: 420px; border-radius: 18px; }
  .sheet-grip { display: none; }
}
.sheet-action { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 48px; /* 손가락 크기 */
                padding: 10px 12px; border-radius: 12px; font-size: 14px; font-weight: 600; }
.sheet-action.danger { color: #f87171; }
```

세 가지 헬퍼만 있으면 대부분 해결된다:

```js
function openSheet(html, onMount, onClose) { body.innerHTML = html; overlay.hidden = false; onMount?.(body); /* … */ }
function closeSheet() { overlay.hidden = true; body.innerHTML = ''; /* onClose 호출 */ }
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSheet(); });   // 바깥 탭 → 닫기
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

// 1) 메뉴
actionSheet({ title, subtitle, actions: [{ icon, label, sub, desc, danger, current, onClick }, 'sep', …] });
// 2) 입력 폼 (onSubmit 이 throw 하면 토스트, true 반환하면 안 닫음)
formSheet({ title, fields: [{ name, label, value, placeholder, maxlength }], extraHtml, submitLabel, onMount, onSubmit });
// 3) 확인 (Promise<boolean>)
if (await confirmSheet({ title: '창 종료', message: '…', confirmLabel: '종료', danger: true })) { … }
```

- 폼 입력칸은 `font-size: 16px` (iOS 확대 방지), 모바일에서는 자동 포커스하지 않는다 (키보드가 갑자기 뜸).
- 시트 안 체크박스는 `width:100%` 같은 입력창 스타일이 먹지 않게 따로 지정한다:
  `.sheet-form input[type="checkbox"] { width: 18px; height: 18px; padding: 0; }`
- 다른 페이지 스크립트도 쓰게 `window.AppUI = { actionSheet, formSheet, confirmSheet, toast }` 로 공개.

## 3. 목록 → 전체 화면 상세 (슬라이드 패널) + 뒤로 가기

모바일에서 항목을 누르면 상세가 오른쪽에서 밀려 들어오고, **안드로이드 뒤로 가기 / iOS 스와이프 / 헤더 ←** 모두로 닫힌다.

```css
@media (max-width: 1023.98px) {
  #detailPane { position: fixed; left: 0; right: 0; top: var(--vv-top); height: var(--app-h); z-index: 60;
                background: var(--shell-bg); transform: translateX(100%); visibility: hidden;
                transition: transform 240ms cubic-bezier(.2,.8,.2,1), visibility 0s linear 240ms; }
  body.detail-open #detailPane { transform: none; visibility: visible; transition: transform 240ms cubic-bezier(.2,.8,.2,1); }
}
@media (prefers-reduced-motion: reduce) { #detailPane { transition: none !important; } }
```

```js
function open(key) {
  document.body.classList.add('detail-open');
  history.pushState({ detail: key }, '', `#${encodeURIComponent(key)}`);   // 뒤로 가기로 닫히게
}
function close(fromPopstate = false) {
  if (!fromPopstate && history.state?.detail) { history.back(); return; }  // popstate 에서 마저 닫힘
  document.body.classList.remove('detail-open');
}
addEventListener('popstate', () => { if (document.body.classList.contains('detail-open')) close(true); });
// 새로고침으로 #key 로 들어왔을 때도 뒤로 가기가 목록으로 가게
if (location.hash) { history.replaceState(null, '', location.pathname); history.pushState({ detail: key }, '', `#${key}`); }
```

## 4. 길게 누르기 → 메뉴 (iOS 는 contextmenu 가 없다)

```js
function attachLongPress(root, selector, onLongPress) {
  let timer = null, start = null, fired = false;
  root.addEventListener('pointerdown', (e) => {
    const target = e.target.closest(selector);
    if (!target || e.button > 0 || e.target.closest('button')) return;
    fired = false; start = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => { fired = true; haptic(12); onLongPress(target); }, 520);   // haptic: 09 참고 (타이머 안이라 iOS 는 안 울림)
  });
  const cancel = () => { clearTimeout(timer); timer = null; };
  root.addEventListener('pointermove', (e) => { if (timer && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel(); });
  root.addEventListener('pointerup', cancel);
  root.addEventListener('pointercancel', cancel);
  root.addEventListener('contextmenu', (e) => { const t = e.target.closest(selector); if (!t) return;
    e.preventDefault(); if (!fired) onLongPress(t); cancel(); });                 // 데스크톱 우클릭 · 안드로이드
  root.addEventListener('click', (e) => { if (fired) { e.stopPropagation(); e.preventDefault(); fired = false; } }, true); // 길게 누른 뒤 click 무시
}
```

## 5. 버튼을 눌러도 키보드가 내려가지 않게

입력 중에 툴바 버튼(Esc, ↑, 붙여넣기 등)을 누르면 포커스가 빠져 키보드가 내려간다.

```js
keyBar.addEventListener('pointerdown', (e) => { if (e.target.closest('.key-chip')) e.preventDefault(); });
keyBar.addEventListener('mousedown',   (e) => { if (e.target.closest('.key-chip')) e.preventDefault(); });
keyBar.addEventListener('click', (e) => { /* 여기서 동작. click 은 그대로 온다 */ });
```

## 6. 토스트 (상단, 안전 영역 아래)

```css
.toast-host { position: fixed; left: 50%; transform: translateX(-50%); z-index: 600;
              top: max(12px, env(safe-area-inset-top)); display: grid; gap: 8px; width: min(92vw, 380px); pointer-events: none; }
.toast { pointer-events: auto; display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 14px;
         background: rgba(20,25,40,.95); border: 1px solid rgba(255,255,255,.12); animation: scaleUp .18s ease-out; }
.toast button { margin-left: auto; font-weight: 800; color: #60a5fa; }   /* "되돌리기", "열기" 같은 액션 */
```

- 최대 3개만 쌓고, 액션 버튼(되돌리기/열기)을 달 수 있게 하면 앱처럼 느껴진다.
- 알림 성격이면 `navigator.vibrate?.([20, 60, 20])` (안드로이드 전용 — iOS 햅틱은 09-native-touch-feel.md).

## 7. 작은 것들이 만드는 차이

- 터치 영역 최소 **44×44px** (아이콘 버튼 `w-10 h-10` 이상, 목록 행 `min-height: 60px`)
- 목록 항목: 상태 아이콘 · 제목 · 한 줄 부제 · 메타(시간) · ⋯ 버튼 — 네이티브 목록 셀 구조
- 새 내용 점(unread dot), 상태 점(작업 중 깜빡임), 필터 칩 + 개수
- 스크롤을 위로 올렸을 때만 "↓ 최신" 버튼, 맨 아래면 새 내용 따라 자동 스크롤
- 위로 끝까지 스크롤하면 이전 기록 자동 로드 (버튼 누르게 하지 않기), 보던 위치 유지:
  ```js
  const fromBottom = el.scrollHeight - el.scrollTop;
  prepend(items);
  el.scrollTop = el.scrollHeight - fromBottom;
  ```
- 입력창 자동 높이: `el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight + 2, innerHeight * .38) + 'px'`
- 초안(입력 중인 글)을 항목별로 저장 → 다른 화면 갔다 와도 유지
- Enter 동작: 데스크톱 Enter=전송/Shift+Enter=줄바꿈, 터치 기기 Enter=줄바꿈/버튼=전송, `isComposing`(한글 조합 중)은 무시
