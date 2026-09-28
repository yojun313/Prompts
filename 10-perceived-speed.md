# 10. 반응 속도 — 누른 뒤 화면이 빨리 바뀌게

09 번(누르는 느낌)을 적용해도 **눌린 게 보인 뒤 화면이 늦게 바뀌면** 여전히 굼떠 보인다.
아래는 디자인은 전혀 건드리지 않고 반응 속도만 올리는 방법이다. 효과가 큰 순서대로 적었다.

UnivDash 에서 잰 값 (Playwright · CPU 4배 느리게 · 390×844):

| | 전 | 후 |
|---|---|---|
| 탭바로 페이지 이동 (DOMContentLoaded) | 530~790ms, **매번 0.8~1.4MB 다시 받음** | 150~220ms, 0KB (전부 캐시) |
| 다시 연 세션의 화면 · 채팅 | "불러오는 중..." → 서버 응답 후 | **즉시** (캐시 → 새 데이터로 교체) |
| 처음 여는 세션의 채팅 | 탭 후 요청 시작 | 손가락이 닿는 순간 요청 → 뗄 때 이미 도착 |

---

## 1. 정적 파일: 버전 붙인 주소 + 1년 immutable 캐시 (효과 가장 큼)

**증상**
- 보안 미들웨어가 모든 응답에 `Cache-Control: no-store` 를 붙이고 있었다.
- 그래서 페이지를 옮길 때마다 JS · CSS · 라이브러리를 전부 다시 받았다.

**해결**
- 템플릿에서 `/static/app.js` 대신 `{{ asset('app.js') }}` 를 쓴다. 그러면 `/static/app.js?v=<mtime·크기 해시>` 가 된다.
- `?v=` 가 붙은 요청만 1년 `immutable` 로 캐시시킨다.
- 파일을 고치면 주소가 바뀌므로 새로고침 없이도 새 파일을 받는다.

```python
# app/assets.py
STATIC_DIR = Path(__file__).resolve().parent / "static"
_cache: dict[str, tuple[int, int, str]] = {}


def asset_url(path: str) -> str:
    rel = path.lstrip("/")
    try:
        st = (STATIC_DIR / rel).stat()
    except OSError:
        return f"/static/{rel}"
    hit = _cache.get(rel)
    if hit and hit[0] == st.st_mtime_ns and hit[1] == st.st_size:
        return hit[2]
    url = f"/static/{rel}?v={format((st.st_mtime_ns ^ (st.st_size << 20)) & 0xFFFFFFFFFF, 'x')}"
    _cache[rel] = (st.st_mtime_ns, st.st_size, url)
    return url


def install(templates):  # Jinja2Templates 마다 한 번
    templates.env.globals["asset"] = asset_url


def static_cache_control(path: str, query: str) -> bytes | None:
    if not path.startswith("/static/"):
        return None  # 페이지 · API 는 no-store 그대로
    if any(p.startswith("v=") for p in query.split("&")):
        return b"public, max-age=31536000, immutable"
    if path.startswith("/static/vendor/"):
        return b"public, max-age=2592000"  # CSS 안에서 상대 경로로 부르는 글꼴 등
    return b"no-cache"  # 아이콘 · manifest: ETag 로 304
```

```python
# 보안 미들웨어의 응답 헤더 부분
if b"cache-control" not in present:
    raw.append((b"cache-control", static_cache_control(path, query) or b"no-store"))
```

```bash
# 템플릿 일괄 치환: src="/static/x.js" · href="/static/x.css" → asset()
python3 - <<'EOF'
import re, glob
for p in glob.glob('app/templates/*.html'):
    s = open(p).read()
    n = re.sub(r'(src|href)="/static/([^"]+\.(?:js|css))"', lambda m: f'{m.group(1)}="{{{{ asset(\'{m.group(2)}\') }}}}"', s)
    if n != s: open(p, 'w').write(n)
EOF
```

- 로그인 템플릿처럼 `Jinja2Templates` 를 따로 만드는 곳에도 `install()` 을 부른다. 빠뜨리면 `asset` 이 정의되지 않았다는 오류가 난다.
- HTML · API 응답은 계속 `no-store`. 로그인이 필요한 화면이 디스크에 남지 않게.
- 서비스 워커는 필요 없다. immutable HTTP 캐시만으로 두 번째 방문부터 0KB 다. CSP 에서 `worker-src 'none'` 을 유지할 수 있다.
- 확인: `curl -sI "…/static/app.js?v=x" | grep -i cache-control`. Playwright 에서는 `performance.getEntriesByType('resource')` 의 `transferSize === 0` 개수를 센다.

## 2. 탭바는 손가락이 닿는 순간 이동

- iOS 탭바는 **누르는 순간(touch down)** 탭이 바뀐다. 웹 링크는 뗄 때(click) 이동한다.
- 그래서 탭 한 번에 80~120ms 가 그냥 사라진다.

```js
let navTo = '';
document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  const link = e.target.closest?.('.tabbar a.tab-item, a.nav-link');
  if (!link || link.getAttribute('aria-current') === 'page' || link.target) return;
  if (e.pointerType !== 'mouse' && !link.closest('.tabbar')) return;   // 스크롤되는 사이드바 서랍은 터치면 click 에서
  document.querySelectorAll('.tabbar a.tab-item.active').forEach((a) => a.classList.remove('active'));
  if (link.classList.contains('tab-item')) link.classList.add('active');  // 선택 표시도 즉시
  navTo = link.href;
  location.href = link.href;
}, { capture: true });
document.addEventListener('click', (e) => {            // 뒤따라오는 click 으로 두 번 이동하지 않게
  const a = e.target.closest?.('a[href]');
  if (a && navTo && a.href === navTo) e.preventDefault();
}, true);
window.addEventListener('pageshow', () => { navTo = ''; });   // 뒤로 가기로 돌아왔을 때 초기화
```

- 스크롤되는 목록 안의 링크에는 쓰지 않는다. 스크롤하려고 댄 손가락에 이동해 버린다.
  - 탭바처럼 고정된 곳에만 쓴다.
  - 마우스는 스크롤과 헷갈릴 일이 없으므로 사이드바에도 쓴다 (mousedown).
- 확인: CDP `Input.dispatchTouchEvent touchStart` 만 보내고 URL 이 바뀌는지, 떼고 나서 `history.length` 가 **1** 만 늘었는지.

## 3. 페이지 사이 흰 화면 없애기 (모양은 그대로)

```css
@view-transition { navigation: auto; }   /* Chrome 126+ · Safari 18.2+ */
::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation-duration: 0s; }
```

- 새 페이지가 그릴 준비가 될 때까지 이전 화면을 그대로 둔다.
- 애니메이션은 0초라 디자인 변화(크로스페이드)는 없고 깜빡임만 사라진다.

## 4. 전에 본 화면은 캐시로 즉시 → 새 데이터로 교체 (stale-while-revalidate)

- 네이티브 앱은 화면을 다시 열 때 **마지막 내용을 먼저 보여 주고** 뒤에서 갱신한다.
- 웹은 보통 "불러오는 중..." 을 띄우고 기다린다.

```js
const chatCache = new Map();                  // id → 마지막 응답 (최근 12개, Map 순서로 LRU)
function cacheChat(id, data) {
  chatCache.delete(id); chatCache.set(id, data);
  if (chatCache.size > 12) chatCache.delete(chatCache.keys().next().value);
}
async function open(id) {
  const cached = chatCache.get(id);
  if (cached) show(cached); else showSpinner();
  const data = await (inflight.get(id) || fetchData(id));   // 미리 받는 중이면 그걸 기다린다 (5번)
  cacheChat(id, data);
  if (id !== currentId) return;                              // 그 사이 다른 걸 열었으면 버린다
  const same = cached && cached.total === data.total
    && JSON.stringify(cached.items.at(-1)) === JSON.stringify(data.items.at(-1));
  if (!same) show(data);                                     // 같으면 다시 그리지 않는다 (깜빡임 · 스크롤 튐 방지)
  subscribeLive(id, data.total);                             // 실시간 구독은 새 데이터 기준으로
}
```

- 실시간 화면(WebSocket 으로 오는 터미널 화면)도 같은 방식이다.
  - 마지막으로 받은 화면을 `pane → screen` 으로 저장해 둔다.
  - 창을 바꾸면 그 화면부터 그린다.
- 캐시 개수는 꼭 제한한다. 긴 화면이나 채팅은 하나에 수백 KB 다.
- **같은지 비교**할 때 개수만 보면 안 된다. 마지막 항목 내용도 비교해야 제자리에서 바뀐 메시지를 놓치지 않는다.

## 5. 누르기 시작할 때 미리 받기 (prefetch on press / hover)

- 손가락이 닿고(pointerdown) 떼기(click)까지 80~120ms, 마우스를 올리고 누르기까지는 수백 ms 가 걸린다.
- 이 시간에 요청을 먼저 보낸다.

```js
const inflight = new Map();
function prefetch(id) {
  if (chatCache.has(id) || inflight.has(id) || id === currentId) return;
  const req = fetchData(id).then((d) => { cacheChat(id, d); return d; }).finally(() => inflight.delete(id));
  req.catch(() => {});                          // 처리 안 된 거부 경고 방지 (open() 이 다시 기다린다)
  inflight.set(id, req);
}
let hoverTimer = 0;
list.addEventListener('pointerdown', (e) => {
  const row = e.target.closest('.row');
  if (row && !e.target.closest('[data-more]')) prefetch(row.dataset.id);
}, { passive: true });
list.addEventListener('pointerover', (e) => {    // 마우스: 80ms 머물면
  if (e.pointerType !== 'mouse') return;
  const row = e.target.closest('.row');
  clearTimeout(hoverTimer);
  if (row) hoverTimer = setTimeout(() => prefetch(row.dataset.id), 80);
});
```

- **읽기(GET)만** 미리 받는다. 상태를 바꾸는 요청은 절대 미리 보내지 않는다.

## 6. 보내기는 낙관적으로

- 메시지를 보내면 서버 응답을 기다리지 않고 **바로 말풍선을 띄운다.** 실패하면 지우고 입력창에 되돌린다.
- UnivDash 는 이미 이렇게 하고 있었다 (`addOptimistic` / `removeOptimistic`).

## 7. 재 보고 고치기 — 추측으로 최적화하지 않는다

손대기 전에 먼저 잰다. UnivDash 에서는 아래처럼 쟀고, 병목이 아닌 것은 건드리지 않았다.
- 긴 작업(long task)은 8초 대기 · 6초 연속 화면 갱신 동안 **0개**였다. 목록 · 화면 렌더링은 병목이 아니었다.
- 시트는 원래 애니메이션 없이 바로 뜨고, 패널은 240ms 빠른 곡선이었다. 바꿀 필요가 없었다.

```python
# Playwright: 휴대폰 흉내 + 느린 CPU
cdp = await ctx.new_cdp_session(page)
await cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
# 페이지 이동 비용
nav = await page.evaluate("""() => { const n = performance.getEntriesByType('navigation')[0];
  const r = performance.getEntriesByType('resource');
  return { dcl: Math.round(n.domContentLoadedEventEnd), fetched: r.filter(x => x.transferSize > 0).length,
           kb: Math.round(r.reduce((a, x) => a + x.transferSize, 0) / 1024) }; }""")
# 메인 스레드 막힘
await page.add_init_script(
    "window.__lt=[]; new PerformanceObserver(l => l.getEntries().forEach(e => __lt.push(Math.round(e.duration)))).observe({type:'longtask', buffered:true});"
)
```

## 체크리스트

- [ ] 정적 파일 주소에 `?v=` + `immutable` 1년, HTML · API 는 `no-store` 유지
- [ ] 두 번째 페이지 이동부터 `transferSize > 0` 인 리소스가 0개
- [ ] 탭바 이동은 pointerdown, 선택 표시도 즉시, 두 번 이동 방지
- [ ] `@view-transition { navigation: auto }` + 애니메이션 0초
- [ ] 다시 여는 화면은 캐시 먼저 → 새 데이터로 교체 (같으면 다시 그리지 않기), 캐시 개수 제한
- [ ] 목록 항목은 pointerdown / hover 때 GET 을 미리 보내기
- [ ] 보내기는 낙관적 UI
- [ ] 바꾸기 전후로 CPU 4배 느리게 해서 재기
