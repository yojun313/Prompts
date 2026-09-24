# 07. 실제 폰 없이 모바일 검증하기

"아이폰에서 보니 깨져요" 를 줄이려면 **폰 크기 렌더링 + safe-area 흉내 + iOS 뷰포트 모킹** 3가지를 돌린다.

## 준비

```bash
# Playwright 를 프로젝트에 설치하지 않고 일회성으로 실행
uv run --with playwright python -m playwright install chromium   # 처음 한 번
uv run --with playwright python scripts/mobile_audit.py http://127.0.0.1:8765 out/
```

## 1. 폰 크기로 열기

```python
ctx = await browser.new_context(
    viewport={"width": 390, "height": 844},   # iPhone 14/15/16
    device_scale_factor=3, is_mobile=True, has_touch=True,   # has_touch → (pointer: coarse) 가 참이 된다
    color_scheme="dark",
)
```

## 2. 자동 점검: 가로 넘침 · 작은 입력창 (`scripts/mobile_audit.py`)

```js
() => {
  const vw = document.documentElement.clientWidth;
  const wide = [...document.querySelectorAll('body *')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width && r.right > vw + 1 && !el.closest('.overflow-x-auto, .overflow-auto, pre, table');
  });
  const small = [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]), textarea, select')]
    .filter((el) => el.offsetParent && parseFloat(getComputedStyle(el).fontSize) < 16);
  return { docWidth: document.documentElement.scrollWidth, vw, wide, small };
}
```

넘치는 요소를 찾으면 **부모를 거슬러 올라가며** 폭과 `grid-template-columns` 를 찍어 원인을 찾는다:

```js
let el = document.getElementById('gitBranch'); const out = [];
while (el && el !== document.body) {
  const cs = getComputedStyle(el);
  out.push(`${el.tagName}.${el.className} w=${el.getBoundingClientRect().width} cols=${cs.gridTemplateColumns}`);
  el = el.parentElement;
}
```
→ `cols=545px` 인 grid 를 찾으면 그게 범인 (04 문서 3번).

## 3. 노치 · 홈 인디케이터 흉내 (Chrome DevTools Protocol)

```python
cdp = await ctx.new_cdp_session(page)
await cdp.send("Emulation.setSafeAreaInsetsOverride",
               {"insets": {"top": 59, "bottom": 34, "left": 0, "right": 0}})
# 이제 env(safe-area-inset-*) 가 실제 값이 된다 → 헤더 높이가 56+59 인지 측정
```

이걸로 "Safari 탭에선 멀쩡한데 홈 화면 앱에서만 헤더가 찌그러지는" 문제를 재현했다.

## 4. iOS 홈 화면 앱 뷰포트 모킹 (`scripts/ios_viewport_sim.py`)

크롬은 iOS 처럼 "레이아웃은 그대로, 보이는 영역만 줄이는" 키보드를 재현하지 못한다 → 값 자체를 흉내 낸다.

```js
// add_init_script 로 페이지 스크립트보다 먼저 실행
const vv = new EventTarget();
vv.height = 785; vv.width = 390; vv.offsetTop = 0; vv.scale = 1;
Object.defineProperty(window, 'visualViewport', { get: () => vv });
Object.defineProperty(window, 'innerHeight', { get: () => (SHRINK ? vv.height : 785) });
Object.defineProperty(navigator, 'standalone', { get: () => true });
window.__keyboard = (open) => { vv.height = open ? 785 - 336 : 785; vv.dispatchEvent(new Event('resize')); };
```

검증 항목:

| 상황 | 기대 |
|---|---|
| 키보드 없음 | 탭바 아래 끝 == 화면 끝 |
| 입력칸 포커스 + `__keyboard(true)` | 입력창 아래 끝 == 키보드 위 끝 (785−336) |
| `innerHeight` 가 같이 줄어드는 경우 / 안 줄어드는 경우 | 둘 다 통과 |
| 키보드 닫기 | 원래대로 |

> 모킹은 **실제 폰에서 받은 스크린샷의 숫자**(검은 띠 높이 = 상태바 높이 등)를 근거로 만든다.
> 추측으로 강제 높이를 넣었다가 오히려 잘리는 일이 있었다 — 가설은 한 번에 하나씩, 폰 스크린샷으로 확인.

## 5. 인터랙션까지 확인

```python
await page.set_input_files("#fileInput", ["red.png", "notes.txt"])       # 파일 선택
await page.evaluate("""() => { const dt = new DataTransfer();              // 드래그앤드롭
  dt.items.add(new File(['x'], 'shot.png', {type: 'image/png'}));
  const el = document.querySelector('#termScroll'), r = el.getBoundingClientRect();
  for (const k of ['dragenter', 'dragover', 'drop'])
    el.dispatchEvent(new DragEvent(k, {bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.x + 20, clientY: r.y + 20})); }""")
await page.evaluate("""() => { const dt = new DataTransfer();              // 붙여넣기
  dt.items.add(new File(['img'], 'image.png', {type: 'image/png'}));
  document.getElementById('promptInput').dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true})); }""")
await page.go_back()                                                        # 뒤로 가기로 패널 닫힘 확인
page.on("console", lambda m: m.type == "error" and errors.append(m.text))   # CSP 위반 = "Refused to …"
```

## 6. 스크린샷 여러 장을 한 장으로 붙여 보기

```python
from PIL import Image
ims = [Image.open(f) for f in files]
out = Image.new('RGB', (sum(i.width for i in ims) // 2, max(i.height for i in ims) // 2))
x = 0
for im in ims:
    im = im.resize((im.width // 2, im.height // 2)); out.paste(im, (x, 0)); x += im.width
out.save('all.png')
```

## 7. 실제 기기 확인 순서

1. Safari 탭에서 확인
2. 홈 화면에 추가 → 완전히 종료 후 실행 (메타 태그를 바꿨으면 **지우고 다시 추가**)
3. 목록 화면 위/아래 끝, 입력칸 누르기(키보드), 회전
4. 문제가 있으면 스크린샷 → 숫자(몇 pt 가 비는지) 로 원인 추정 → 모킹으로 재현 → 수정
