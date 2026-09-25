# 09. 누르는 느낌을 아이폰 앱처럼

화면 구성은 앱 같은데 **버튼을 누를 때 뭔가 웹 같다**면 원인은 거의 이 7가지다.
네이티브 iOS 버튼(UIButton · UITableViewCell)이 하는 일을 웹에서 그대로 흉내 낸다.

| # | 웹이 기본으로 하는 것 | 아이폰 앱이 하는 것 | 해결 |
|---|---|---|---|
| 1 | 탭 하이라이트를 꺼 두면 **누르는 동안 아무 변화 없음**. iOS Safari 는 touchstart 리스너가 없으면 `:active` 도 안 켠다 | 손가락이 닿는 순간 버튼이 흐려진다 | JS 로 `.is-pressed` 를 붙인다 (+ 빈 touchstart 리스너) |
| 2 | `transition: 150ms` 때문에 **눌림 색이 늦게** 나온다 | 누를 땐 **즉시(0ms)**, 뗄 땐 **천천히(~200ms)** 돌아온다 | 눌림은 `transition: none`, 뗄 때만 transition 을 준다 |
| 3 | 탭하면 `:hover` 가 **남아 있다** (sticky hover) | hover 가 없다 | `:hover` 를 `@media (hover: hover)` 안으로 |
| 4 | 진동이 없다 (iOS 에는 `navigator.vibrate` 가 없음) | 스위치 · 선택 · 길게 누르기에 햅틱 | iOS 18+ **숨긴 스위치 체크박스** 트릭 |
| 5 | 22~30px 버튼 → **빗나간다** | 최소 44pt 터치 영역 | `::after { inset: -8px }` 로 터치 영역만 넓힌다 |
| 6 | 스크롤하려고 목록에 손을 대면 **줄이 번쩍인다** | 줄은 조금 늦게(~70ms) 하이라이트, 움직이면 취소 | 줄은 70ms 지연 + 10px 움직이면 취소 |
| 7 | 서버 응답 전까지 **아무 반응 없음** → 또 누른다 | 누른 버튼이 바로 "처리 중" | 방금 누른 버튼이 시작한 요청이 120ms 넘으면 `.is-busy` |

> 복사해서 쓰는 코드: `templates/press.js` + `templates/mobile.css` 의 "누르는 느낌" 부분.
> UnivDash 에서는 `app/static/common.js` 와 `app/static/app.css` 끝부분에 들어 있다.

---

## 1·2. 눌림 표시 — "즉시 눌리고 천천히 풀린다"

CSS `:active` 만으로는 부족하다.
- iOS Safari 는 문서에 `touchstart` 리스너가 **하나도 없으면** `:active` 를 적용하지 않는다.
- `:active` 는 스크롤하려고 손을 댄 순간에도 켜져서 목록 줄이 번쩍인다.
- 요소마다 이미 `transition` 이 달려 있어서, 누를 때도 150ms 늦게 바뀐다.

그래서 **문서 전체에 포인터 리스너 한 벌**을 달고 클래스를 직접 붙인다.

```js
const PRESSABLE = 'button, [role="button"], a[href], summary, .row';
const ROW = '.row';                        // 목록 줄: 배경만 진해지고 70ms 늦게
let pressed = null, pressTimer = 0, pressStart = null;

function release(fade = true) {
  clearTimeout(pressTimer);
  const el = pressed; pressed = null;
  if (!el || !el.classList.contains('is-pressed')) return;
  el.classList.remove('is-pressed');
  if (!fade) return;                       // 스크롤로 취소된 것은 즉시 사라진다
  el.classList.add('press-release');       // 손을 뗀 것은 200ms 에 걸쳐 돌아온다
  setTimeout(() => el.classList.remove('press-release'), 220);
}
const opts = { capture: true, passive: true };   // passive: 스크롤을 절대 막지 않는다
document.addEventListener('pointerdown', (e) => {
  if (e.button > 0) return;
  release(false);
  const t = e.target.closest?.(PRESSABLE);       // 가장 안쪽 → 줄 안의 ⋯ 버튼을 누르면 그 버튼만
  if (!t || t.disabled) return;
  pressed = t; pressStart = { x: e.clientX, y: e.clientY };
  if (e.pointerType !== 'mouse' && t.matches(ROW)) pressTimer = setTimeout(() => pressed?.classList.add('is-pressed'), 70);
  else t.classList.add('is-pressed');
}, opts);
document.addEventListener('pointermove', (e) => {
  if (pressed && Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > 10) release(false);
}, opts);
document.addEventListener('pointerup', () => {
  // 70ms 안에 톡 친 줄도 한 번은 보여 준다 (추가와 제거를 같은 프레임에 하면 안 보인다)
  if (pressed && !pressed.classList.contains('is-pressed')) {
    const el = pressed; clearTimeout(pressTimer); el.classList.add('is-pressed');
    pressTimer = setTimeout(() => { if (pressed === el) release(true); }, 90);
    return;
  }
  release(true);
}, opts);
document.addEventListener('pointercancel', () => release(false), opts);  // iOS: 스크롤이 시작되면 온다
document.addEventListener('scroll', () => release(false), opts);         // capture 라 안쪽 스크롤도 잡힌다
document.addEventListener('dragstart', () => release(false), opts);
document.addEventListener('touchstart', () => {}, { passive: true });    // iOS :active 켜기
```

```css
/* 누를 때: 0ms. 버튼은 흐려지고 살짝 작아진다 */
.is-pressed { transition: none !important; opacity: .5; scale: .96; }
/* 넓은 버튼 · 탭은 작아지면 어색하다 → 흐려지기만 */
:is(.tab-item, .w-full).is-pressed { scale: none; }
/* 목록 줄: 흐려지지 않고 배경만 진해진다 (UITableViewCell) */
:is(.row).is-pressed { opacity: 1; scale: none; box-shadow: inset 0 0 0 999px rgba(255,255,255,.08); }
html.light :is(.row).is-pressed { box-shadow: inset 0 0 0 999px rgba(15,23,42,.07); }
/* 뗄 때: 천천히. scale 은 살짝 튕기는 곡선 */
.press-release { transition: opacity .2s ease-out, scale .2s cubic-bezier(.2,.9,.3,1.2), box-shadow .25s ease-out !important; }
@media (prefers-reduced-motion: reduce) { .is-pressed { scale: none; } }
```

**요점**
- `transform: scale()` 이 아니라 **개별 `scale` 속성**을 쓴다. 이미 `transform: translateX()` 를 쓰는 요소(슬라이드 패널, 칩 등)를 덮어쓰지 않는다.
- 줄 하이라이트는 `background` 대신 **`box-shadow: inset 0 0 0 999px`** 로 덧칠한다. 선택됨 · 활성 같은 기존 배경색을 건드리지 않고, transition 도 된다.
- `press-release` 의 transition 에 `!important` 를 주는 이유: 요소마다 달린 `transition: background 150ms` 같은 규칙이 이기면 뗄 때 즉시 돌아와 버린다. 220ms 뒤에 클래스를 빼므로 부작용은 없다.
- 터미널(xterm) 같은 영역은 `PRESSABLE` 에서 빼 둔다.
- 기존의 `button:active { opacity: .65 }` · `.x:active { background }` 규칙은 지운다 (두 벌이 섞이면 뗄 때 깜빡인다).

## 3. sticky hover 없애기

휴대폰은 탭하면 그 요소가 `:hover` 상태로 **다른 곳을 누를 때까지 남는다**. 모든 `:hover` 를 hover 가 되는 기기에서만 켠다.

```css
@media (hover: hover) {
  .row:hover { background: rgba(255,255,255,.05); }
}
```

Tailwind (v3.4):

```js
// tailwind.config.js
module.exports = { future: { hoverOnlyWhenSupported: true }, /* ... */ };
// → hover:bg-white/10 이 @media (hover:hover) and (pointer:fine) 안으로 들어간다
```

이미 있는 CSS 파일은 손으로 고치지 말고 스크립트로 한 번에 감싼다. 최상위 규칙 중 선택자에 `:hover` 가 있는 것만 골라 `@media (hover: hover) { … }` 로 감싼다.
`.a:hover, .a:focus-visible` 처럼 섞인 규칙은 **나눈다**. hover 가 아닌 부분까지 감싸면 휴대폰에서 포커스 표시가 사라진다.

```python
# 최상위(중첩 안 된) 규칙만. 섞인 선택자는 hover 아닌 부분을 제자리에 두고 hover 부분만 바로 뒤에 감싼다 (순서 = 우선순위 유지)
if not prelude.startswith("@") and ":hover" in prelude:
    hov = [s for s in split_selectors(prelude) if ":hover" in s]
    rest = [s for s in split_selectors(prelude) if ":hover" not in s]
    out = (
        (", ".join(rest) + " " + block + "\n" if rest else "")
        + "@media (hover: hover) { "
        + ", ".join(hov)
        + " "
        + block
        + " }"
    )
```

(UnivDash 에서 app.css 52개 · theme.css 22개 규칙을 이렇게 바꿨다. 끝나면 `{` 와 `}` 개수가 같은지 꼭 확인한다.)

## 4. 아이폰 햅틱 (iOS 18+)

iOS Safari 에는 `navigator.vibrate` 가 **없다**.
대신 iOS 18 부터 `<input type="checkbox" switch>`(네이티브 스위치)를 토글하면 시스템 햅틱이 나온다. 숨긴 스위치의 label 을 `click()` 한다.

```js
let hapticLabel = null;
function haptic(pattern = 8) {
  if (typeof navigator.vibrate === 'function') { navigator.vibrate(pattern); return; }   // 안드로이드
  if (!hapticLabel) {
    hapticLabel = document.createElement('label');
    hapticLabel.setAttribute('aria-hidden', 'true');
    hapticLabel.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
    const box = document.createElement('input');
    box.type = 'checkbox'; box.setAttribute('switch', ''); box.tabIndex = -1;
    hapticLabel.appendChild(box);
    const stop = (e) => e.stopPropagation();          // ⚠️ 가짜 클릭이 "바깥 클릭 → 메뉴 닫기"로 번지지 않게
    hapticLabel.addEventListener('click', stop); box.addEventListener('click', stop);
    document.body.appendChild(hapticLabel);
  }
  hapticLabel.click();
}
```

**꼭 지킬 것**
- **사용자 제스처 안에서만** 울린다 (click/touchend 처리 중). 아래 경우에는 조용히 무시된다.
  - `await fetch()` 뒤
  - `setTimeout` 안 (길게 누르기 타이머도 포함)
  - WebSocket 메시지 처리 중

  → "보내기"라면 요청을 보내기 **전에** 울린다.
  ```js
  async function send() {
    sendBtn.disabled = true;
    haptic(10);                // ✅ 누른 그 순간
    await api('/send', …);     // haptic 을 여기 뒤에 두면 iOS 에서 안 울린다
  }
  ```
- `display: none` 인 스위치는 안 울린다. 화면 밖에 1px 로 둔다.
- 캡처 단계(`addEventListener(..., true)`)로 문서 클릭을 보는 코드가 있으면, 가짜 클릭을 무시하게 한다 (`hapticLabel.contains(e.target)`).
- 햅틱은 **아껴 쓴다.** 아래 경우에만 울린다.
  - 선택이 바뀔 때 (세그먼트 · 필터 · 스위치)
  - 확인 버튼
  - 메시지 보내기
  - 특수 키
  - 길게 누르기 (안드로이드만)

  일반 버튼마다 울리면 오히려 싸구려 같다.

```js
// 선택성 동작에 가벼운 햅틱 (UISelectionFeedbackGenerator 자리)
document.addEventListener('click', (e) => {
  if (e.target.closest?.('.segmented button, .filter-chip, [data-yes], [data-haptic]')) haptic(6);
});
```

## 5. 터치 영역 44pt — 보이는 크기는 그대로

탭 닫기 ✕, ⋯, 작은 아이콘 버튼은 디자인상 22~30px 이다. 모양은 두고 **터치 영역만** 넓힌다.

```css
@media (pointer: coarse) {
  .icon-btn { position: relative; }
  .icon-btn::after { content: ''; position: absolute; inset: -8px; }   /* 사방 8px → 30px 버튼이 46px */
}
```

- 이미 `position: absolute` 인 버튼(첨부 ✕ 등)에는 `position: relative` 를 넣지 않는다. `::after` 만 준다.
- `::after`(또는 `::before`)를 이미 쓰는 요소는 피한다.
- 이웃 버튼과 겹치면 **뒤에 있는 버튼이 이긴다.** 버튼 사이 간격이 16px 보다 좁으면 inset 을 줄인다.
- 검증: `document.elementFromPoint(버튼 왼쪽 - 5px, 가운데)` 가 그 버튼이면 된다.

## 6. 스크롤 중 번쩍임 · 잘못 눌림

1번 코드가 이미 처리한다.
- 줄은 70ms 늦게 하이라이트한다.
- 10px 넘게 움직이거나 `pointercancel` · `scroll` 이 오면 즉시(페이드 없이) 취소한다.

그 밖에:
- `touch-action: manipulation` 을 버튼 · 링크 · 라벨 · 목록 줄에 준다. 더블탭 확대 대기(최대 300ms)가 사라져 click 이 바로 온다.
- `-webkit-tap-highlight-color: transparent`: 회색 박스 대신 우리 눌림 표시만 보인다.

```css
button, a, summary, label, [role="button"], .row { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
```

## 7. 느린 버튼은 바로 "처리 중"

모든 버튼에 로딩 코드를 붙이는 대신 **공용 `api()` 에서 한 번에** 처리한다.
방금(80ms 안에) 누른 버튼이 요청을 시작했으면, 그 요청이 120ms 넘게 걸릴 때 버튼에 `.is-busy` 를 붙인다.
120ms 는 빠른 응답에서 깜빡이지 않게 하려는 값이다.

```js
let lastTap = null;
document.addEventListener('click', (e) => {
  if (hapticLabel && hapticLabel.contains(e.target)) return;
  const el = e.target.closest?.('button, [role="button"]');
  lastTap = el && !el.closest('.sheet-overlay') ? { el, t: performance.now() } : null;   // 시트는 곧 닫히므로 제외
}, true);

async function api(url, options) {
  const tap = lastTap && performance.now() - lastTap.t < 80 ? lastTap.el : null;
  lastTap = null;
  if (!tap) return request(url, options);
  const timer = setTimeout(() => tap.classList.add('is-busy'), 120);
  try { return await request(url, options); } finally { clearTimeout(timer); tap.classList.remove('is-busy'); }
}
```

```css
.is-busy { opacity: .55; pointer-events: none; cursor: progress; }   /* 두 번 누르기도 막힌다 */
```

---

## 검증 (Playwright, 실제 폰 없이)

`page.tap()` 은 누르고 떼는 걸 한 번에 해서 "누르는 중"을 볼 수 없다. CDP 로 터치를 나눠 보낸다.

```python
ctx = await browser.new_context(
    viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True
)
cdp = await ctx.new_cdp_session(page)


async def touch(kind, x, y):
    await cdp.send(
        "Input.dispatchTouchEvent",
        {"type": kind, "touchPoints": [] if kind == "touchEnd" else [{"x": x, "y": y}]},
    )


await touch("touchStart", x, y)
await page.wait_for_timeout(16)
# 버튼: is-pressed, opacity 0.5, scale 0.96, transition-duration 0s
await touch("touchEnd", x, y)
await page.wait_for_timeout(30)
# .press-release 로 opacity 가 0.5 → 1 사이 값 (천천히 돌아오는 중)

# 목록 줄: 20ms 엔 아직 아님, 100ms 엔 is-pressed, 30px 움직이면 즉시 해제
# sticky hover: matchMedia('(hover: hover)').matches === false 인지 (is_mobile=True 면 false)
# iOS 햅틱 경로: Navigator.prototype.vibrate 를 undefined 로 바꾸고 haptic() → input[switch].checked 가 바뀌고 문서 click 이 0번
# 터치 영역: elementFromPoint(r.left - 5, 가운데) === 버튼
```

## 체크리스트

- [ ] 빈 `touchstart` 리스너 (passive)
- [ ] 누를 때 0ms · 뗄 때 ~200ms (`.is-pressed` / `.press-release`)
- [ ] 버튼 = 흐려짐 + `scale: .96`, 넓은 버튼 · 탭 = 흐려짐만, 목록 줄 = 배경 덧칠 + 70ms 지연
- [ ] 움직임 10px · `pointercancel` · `scroll` · `dragstart` 이면 즉시 취소
- [ ] 예전 `:active` 규칙 제거
- [ ] 모든 `:hover` 는 `@media (hover: hover)` 안, Tailwind `hoverOnlyWhenSupported`
- [ ] 작은 버튼 터치 영역 ≥ 44px (`::after inset -8px`)
- [ ] `touch-action: manipulation` · `-webkit-tap-highlight-color: transparent`
- [ ] 햅틱: 안드로이드 `vibrate`, iOS 숨긴 `input[switch]`, **제스처 안에서만** · 아껴서
- [ ] 느린 요청은 누른 버튼에 `.is-busy`
