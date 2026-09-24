# 04. 데스크톱 ↔ 모바일 반응형 레이아웃

## 1. 앱 셸 구조

```
body (flex, 화면 고정)
├── aside#sidebar        데스크톱: 고정 폭 w-64 / 모바일: 왼쪽에서 슬라이드 (☰)
└── main (flex-col)
    ├── header           제목 + 상태 배지 + 액션 버튼
    ├── content          flex-1 min-h-0 overflow-y-auto  ← 스크롤은 여기서만
    ├── nav.tabbar       모바일만 (03 문서)
    └── footer           데스크톱만
```

**핵심: 문서(body)는 스크롤하지 않고, 내용 영역만 스크롤한다.** 그래야 헤더/탭바가 고정되고 iOS 고무줄 튕김이 없다.

```html
<body class="app-shell text-white flex overflow-hidden">
  <div id="sidebarOverlay" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 hidden md:hidden"></div>
  <aside id="sidebar" class="fixed inset-y-0 left-0 z-50 w-64 glass-strong border-r border-white/10 flex flex-col
                             transition-transform duration-300 -translate-x-full md:relative md:translate-x-0 flex-shrink-0">…</aside>
  <main class="flex-1 flex flex-col min-w-0 h-full relative">
    <header class="h-14 glass … safe-top-header">…</header>
    <div class="flex-1 overflow-y-auto p-4 md:p-6 safe-bottom">
      <div class="max-w-7xl mx-auto">…</div>
    </div>
  </main>
</body>
```

사이드바: 모바일은 열고 닫기, 데스크톱은 접기(localStorage 기억)

```js
const md = matchMedia('(min-width: 768px)');
menuButton.addEventListener('click', () => {
  if (md.matches) { const c = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem('sidebar', c); }
  else setSidebarOpen(true);
});
function setSidebarOpen(open) {
  sidebar.classList.toggle('-translate-x-full', !open);
  overlay.classList.toggle('hidden', !open);
  menuButton.setAttribute('aria-expanded', String(open));
}
```
```css
@media (min-width: 768px) { body.sidebar-collapsed #sidebar { display: none; } }
```

## 2. 목록 + 상세 (마스터-디테일)

- `lg` 이상: 왼쪽 목록(340px) + 오른쪽 상세 나란히
- `lg` 미만: 목록이 전체 폭, 상세는 전체 화면 슬라이드 패널 (03 문서 3번)

```html
<div class="flex-1 min-h-0 flex">
  <section id="listPane" class="flex-1 lg:flex-none lg:w-[340px] xl:w-[360px] min-w-0 flex flex-col lg:border-r border-white/10">
    <div class="p-3 border-b">검색 · 필터 칩</div>
    <div class="flex-1 min-h-0 overflow-y-auto">목록</div>
  </section>
  <section id="detailPane" class="flex-1 min-w-0 flex flex-col">…</section>
</div>
```

**`min-h-0` / `min-w-0` 을 잊지 말 것** — flex 자식은 기본 `min-height:auto` 라서 내용만큼 늘어나 스크롤이 안 된다.

사이드바(256) + 목록(340) 때문에 `md`(768)에서는 상세가 너무 좁다 → 두 칸 배치는 `lg`(1024)부터.

## 3. 가로 넘침(horizontal overflow) 잡기

모바일에서 화면이 옆으로 밀리거나 글자가 잘리는 원인 1순위: **열을 지정하지 않은 grid**.

```html
<!-- ❌ 모바일에서 열이 긴 텍스트(truncate 여도) 폭으로 늘어난다 (545px) -->
<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
<!-- ✅ 기본 열을 지정 -->
<div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
<div class="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
```

- 한 열이어도 `grid-cols-[minmax(0,1fr)]` — `1fr` 은 최소값이 auto 라서 내용 때문에 늘어난다.
- 넓은 표 · diff · 코드: 감싸는 요소에 `overflow-x-auto`, 표 자체는 `min-w-[720px]`.
- 긴 경로 · 해시: `truncate` + 부모 `min-w-0`.
- 자동 점검 스크립트: `scripts/mobile_audit.py` (오른쪽 끝이 화면 밖인 요소와 16px 미만 입력창을 찾아 준다).

## 4. 휴대폰에서만 숨기기 / 바꾸기

| 요소 | 모바일 | 데스크톱 |
|---|---|---|
| 페이지 설명 문구 | `hidden sm:block` | 보임 |
| 푸터 | `hidden md:block` | 보임 |
| 연결 상태 배지 | `hidden sm:inline-flex` | 보임 |
| 하단 탭바 | 보임 | `md:hidden` |
| 뒤로 가기 버튼 | 보임 | `lg:hidden` |
| 액션 버튼 줄 | 세로로 쌓기 `flex-col sm:flex-row` | 가로 |

## 5. 터미널 · 코드 같은 넓은 내용 보기 방식

한 가지 방식으로는 폰과 데스크톱을 다 만족시키지 못한다 → 사용자가 고르게 하고 기기별로 기억.

| 방식 | CSS | 기본값 |
|---|---|---|
| 줄바꿈 | `white-space: pre-wrap; overflow-wrap: anywhere` | 휴대폰 |
| 화면 맞춤 | 글자 크기 = 폭 ÷ (열 수 × 글자폭 비율), 최소 8px | 데스크톱 |
| 원본 | `white-space: pre` + 가로 스크롤 | — |

```js
// 고정폭 글꼴의 글자폭 비율 재기 (폰트 로드 후)
const ctx = document.createElement('canvas').getContext('2d');
ctx.font = "100px 'JetBrains Mono', monospace";
const ratio = ctx.measureText('MMMMMMMMMM').width / 1000;   // ≈ 0.6
const size = Math.max(8, Math.min(15, (el.clientWidth - 24) / (cols * ratio)));
```

줄바꿈 모드에서 모바일 가독성 향상 요령:
- `────` 만 있는 줄 → 얇은 구분선 `<div class="t-rule">` 로 바꾸기
- 공백 12칸 이상 → 3칸으로 줄이기 (오른쪽 정렬 텍스트가 여러 줄로 깨지는 것 방지)

## 6. 모바일 우선 폰트 · 크기

- 본문 14px, 보조 11~12px, 라벨 9~10px 대문자 + 자간 넓게(`tracking-wider`)
- 입력창 16px (모바일)
- 한글 폴백: `'Inter', 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif`
- 고정폭: `'JetBrains Mono', ui-monospace, 'D2Coding', monospace` + `font-variant-ligatures: none`
- 테마 · 색 전략은 08-design-theme.md
