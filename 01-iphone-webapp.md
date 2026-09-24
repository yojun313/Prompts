# 01. 아이폰 홈 화면 앱(PWA) 만들기

Safari 에서 **공유 → 홈 화면에 추가** 하면 주소창 없이 전체 화면 앱처럼 열리는 웹앱을 만드는 방법.
Xcode · 앱스토어 · 개발자 계정($99)이 필요 없다.

> 네이티브 래퍼(Capacitor, WKWebView)는 Mac + Xcode + 개발자 계정이 필요하고, 무료 계정은 7일마다 재설치해야 한다.
> 개인 도구라면 PWA 가 가장 쉽다.

---

## 1. 필수 `<head>` 태그

```html
<!-- 확대 금지 + 노치까지 화면 사용 + (안드로이드) 키보드가 올라오면 레이아웃 축소 -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content">

<!-- 홈 화면 앱 -->
<link rel="manifest" href="/static/manifest.webmanifest">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<!-- ⚠️ black-translucent 쓰지 말 것 (아래 5번) -->
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="앱이름">
<meta name="application-name" content="앱이름">
<meta name="theme-color" content="#05070f">

<!-- 아이콘 (02-app-icon.md) -->
<link rel="icon" type="image/svg+xml" href="/static/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/static/icons/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/static/icons/apple-touch-icon.png">
```

- `apple-mobile-web-app-*` 메타와 아이콘은 **홈 화면에 추가하는 순간 한 번만 읽힌다.** 바꾸면 홈 화면에서 지우고 다시 추가해야 반영된다.
- 홈 화면 앱은 Safari 와 **쿠키/로그인을 따로 가진다.** 처음 한 번은 앱 안에서 로그인해야 한다.
- 서버는 `.webmanifest` 를 `application/manifest+json` 으로 보내야 한다 (Python `mimetypes` 는 기본으로 맞게 준다).

---

## 2. 확대(줌) 막기 — 3단계가 모두 필요

### (1) 입력창 글자 16px 이상 ← 가장 중요

iOS Safari 는 **16px 미만 입력창에 포커스하면 화면을 자동 확대**한다. 확대되면 레이아웃이 통째로 어긋난다.

```css
@media (pointer: coarse), (max-width: 767.98px) {
  input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]),
  textarea, select { font-size: 16px !important; }
}
```

데스크톱에서는 작게 쓰고 싶으면 반대로:

```css
.prompt-input { font-size: 16px; }
@media (min-width: 1024px) { .prompt-input { font-size: 14px; } }
```

### (2) 뷰포트 메타 `maximum-scale=1, user-scalable=no`

### (3) 핀치 제스처 · 두 번 탭

```css
html { touch-action: manipulation; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
```

```js
const coarse = matchMedia('(pointer: coarse)').matches;
if (coarse) {
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) =>
    document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
  // 두 손가락만 막는다
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
}
```

> ❌ **하지 말 것:** `touchend` 에서 300ms 안의 두 번째 탭을 `preventDefault` 하는 흔한 코드.
> 서로 다른 버튼을 빠르게 누르는 것(예: Esc 두 번)까지 먹어버린다. `touch-action: manipulation` 이면 충분하다.

---

## 3. 노치 · 상태바 · 홈 인디케이터 (safe-area)

`viewport-fit=cover` 를 쓰면 `env(safe-area-inset-*)` 로 여백을 직접 줘야 한다.

```css
.safe-top    { padding-top: max(1.25rem, env(safe-area-inset-top)) !important; }
.safe-bottom { padding-bottom: max(0.5rem, env(safe-area-inset-bottom)) !important; }
header.safe-top-header {
  padding-top: env(safe-area-inset-top) !important;
  height: calc(3.5rem + env(safe-area-inset-top)) !important;  /* 헤더 높이 = 내용 + inset */
}
```

### ⚠️ 함정: 유틸리티 CSS 가 safe-area 를 덮어쓴다

Tailwind 를 **뒤에** 불러오면 `h-14`, `p-5`, `pb-2` 같은 유틸리티가 safe-area 규칙을 이긴다.

- Safari 탭: inset 이 0 → 아무 문제 없어 보임
- 홈 화면 앱: inset 이 47~59px → 헤더가 찌그러지고 아래 내용이 헤더 위로 올라옴

→ safe-area 규칙은 `!important` 또는 더 높은 선택자(`header.safe-top-header`)로. 그리고 **반드시 inset 을 흉내 내서 테스트**한다 (07-testing-mobile.md).

### 화면 고정 요소 · 버튼

```html
<!-- 로그인 화면의 떠 있는 버튼도 상태바를 피한다 -->
<button style="position:fixed; top:max(16px, calc(env(safe-area-inset-top) + 8px)); right:16px">
```

---

## 4. 키보드 대응 — 입력창이 키보드에 가리지 않게

### iOS 의 동작 이해

- 안드로이드(Chrome): `interactive-widget=resizes-content` 면 레이아웃 자체가 줄어든다 → 그냥 `100%` 로 충분.
- iOS: 레이아웃 크기는 그대로 두고 **보이는 영역(visualViewport)만 줄이고 위로 민다** (`offsetTop`).
  게다가 홈 화면 앱에서는 `innerHeight` 도 같이 줄어드는 경우가 있어 **높이 차이로 키보드를 감지할 수 없다.**

### 해결: 앱 셸을 고정하고, 키보드일 때만 보이는 영역에 맞춘다

```css
:root { --app-h: 100%; --vv-top: 0px; }
html:has(body.app-shell) { height: 100%; overflow: hidden; }
body.app-shell {
  position: fixed; left: 0; right: 0;
  top: var(--vv-top);          /* iOS 가 보이는 영역을 밀어 올린 만큼 따라간다 */
  height: var(--app-h);
  width: 100%; overflow: hidden; overscroll-behavior: none;
}
/* 모바일 전체 화면 패널도 같은 변수 사용 */
@media (max-width: 1023.98px) {
  #termPane { position: fixed; left: 0; right: 0; top: var(--vv-top); height: var(--app-h); }
}
```

```js
const coarse = matchMedia('(pointer: coarse)').matches;
const isEditable = (el) => !!el && (el.tagName === 'TEXTAREA' || el.isContentEditable
  || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'file', 'range'].includes(el.type)));
let lastVisible = 0;

function syncViewport() {
  const vv = window.visualViewport;
  const root = document.documentElement;
  const typing = coarse && isEditable(document.activeElement);
  const visible = vv ? vv.height : innerHeight;
  // 키보드 판단: 입력칸 포커스 (iOS) 또는 보이는 영역이 확 줄어듦
  const keyboard = !!vv && (typing || innerHeight - vv.height > 80);
  root.style.setProperty('--app-h', keyboard ? `${Math.round(visible)}px` : '100%');
  root.style.setProperty('--vv-top', keyboard ? `${Math.round(vv.offsetTop)}px` : '0px');
  root.classList.toggle('kb-open', typing);                 // 탭바 숨기기 등에 사용
  if (scrollY || scrollX) scrollTo(0, 0);                   // 문서가 밀려 올라간 것 되돌리기
  if (visible < lastVisible && typing) {                    // 줄어들면 입력칸이 보이게
    const el = document.activeElement;
    requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest' }));
  }
  lastVisible = visible;
}
syncViewport();
visualViewport?.addEventListener('resize', syncViewport);
visualViewport?.addEventListener('scroll', syncViewport);
addEventListener('resize', syncViewport);
addEventListener('scroll', () => { if (scrollY) scrollTo(0, 0); }, { passive: true });
if (coarse) {
  // 키보드 애니메이션 동안 resize 가 안 오는 경우가 있어 몇 번 더 잰다
  const soon = () => [0, 100, 300, 600].forEach((ms) => setTimeout(syncViewport, ms));
  document.addEventListener('focusin', soon);
  document.addEventListener('focusout', soon);
  addEventListener('orientationchange', soon);
}
```

```css
html.kb-open .tabbar { display: none; }                          /* 입력 공간 확보 */
html.kb-open .composer.safe-bottom { padding-bottom: .25rem !important; } /* 키보드가 덮으니 inset 불필요 */
```

- 키보드 위 `^ ∨ ✓` 막대(폼 보조 막대)는 Safari 가 붙이는 것이라 웹에서 없앨 수 없다.
- 입력 중 키 버튼(Esc 등)을 누르면 키보드가 내려가지 않게: `pointerdown` · `mousedown` 에서 `preventDefault()` (03 문서).

---

## 5. ⚠️ 상태바 `black-translucent` 버그

`black-translucent` 로 하면 페이지가 상태바 밑(y=0)부터 그려지는데, **iOS 가 실제로 그리는 영역은 화면 아래에서 상태바 높이(약 59pt)만큼 짧다.**

증상과 원인 추적 순서 (실제로 겪은 것):

| 시도 | 결과 |
|---|---|
| 높이 `visualViewport.height` | 아래에 59pt 검은 띠 |
| 높이 `100%` | 똑같이 아래 검은 띠 |
| 높이 `screen.height` 로 강제 | 탭바가 화면 밖으로 밀려 **잘림** → 그려지는 영역 자체가 짧다는 증거 |
| 상태바 `black` (불투명) | ✅ 앱이 상태바 아래부터 화면 끝까지 빈틈 없이 |

→ **홈 화면 앱은 `black` 을 쓰고, `theme-color` 와 헤더 색을 어둡게 맞추면 티가 나지 않는다.**
→ 바꾼 뒤에는 **홈 화면 아이콘을 지우고 다시 추가**해야 적용된다.

---

## 6. 앱처럼 보이게 하는 나머지

```css
@media (pointer: coarse), (max-width: 767.98px) {
  /* 버튼 · 메뉴는 길게 눌러도 글자 선택 · 미리보기 안 뜨게 */
  body.app-shell { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  /* 내용 영역은 선택 가능하게 되돌린다 */
  body.app-shell :is(input, textarea, pre, code, table, .term-screen, .chat-list, .select-text) {
    -webkit-user-select: text; user-select: text; -webkit-touch-callout: default;
  }
  ::-webkit-scrollbar { width: 0; height: 0; }
  .overflow-y-auto, .overflow-auto, .overflow-x-auto { overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
  button:active, .tab-item:active { opacity: .65; }   /* 누르는 느낌 */
}
button, a { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
```

- 페이지 설명 문구 · 푸터는 휴대폰에서 숨긴다 (`hidden sm:block`, `hidden md:block`).
- 하단 탭바, 바텀 시트, 뒤로 가기 처리 → 03-app-like-ux.md

---

## 7. 체크리스트

- [ ] 뷰포트 메타 (`maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content`)
- [ ] 모든 입력창 16px 이상 (모바일)
- [ ] 상태바 `black`, `theme-color` 설정
- [ ] safe-area 여백이 유틸리티 CSS 에 지지 않는지 (inset 흉내 테스트)
- [ ] 키보드: 입력칸 포커스 시 `--app-h = visualViewport.height`
- [ ] apple-touch-icon 180 PNG (02 문서)
- [ ] 홈 화면에서 **지우고 다시 추가**해서 확인
