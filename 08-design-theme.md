# 08. 디자인 · 테마 전략 (글래스 다크 대시보드)

UnivDash / PM2Dash 에 쓴 디자인 시스템. 한 벌의 마크업으로 **테마 4종 × 다크/라이트** 를 지원한다.

## 1. 디자인 원칙

| 원칙 | 구현 |
|---|---|
| **다크 우선** | 템플릿은 다크 기준 유틸리티(`text-white/60`, `bg-white/5`)로 쓰고, 라이트는 CSS 에서 일괄 반전 |
| **유리(glass) 표면** | 반투명 배경 + `backdrop-filter: blur` + 얇은 흰 테두리. 강도 3단계 (`glass-soft` < `glass` < `glass-strong`) |
| **배경은 은은한 빛** | 단색 대신 radial-gradient 2~4개를 겹친 "오로라" — 유리 표면이 살아난다 |
| **투명도로 위계** | 제목 `text-white/90`, 본문 `/70`, 보조 `/50`, 라벨 `/40`, 희미 `/35` — 색을 늘리지 않고 투명도로 |
| **포인트 색은 의미별로** | 파랑=선택·주요, 초록=정상·완료, 주황/호박=주의·응답 필요, 빨강=오류·위험, 보라=AI/브랜드, 청록=Git |
| **작은 대문자 라벨** | `text-[10px] font-bold uppercase tracking-wider text-white/40` — 카드 제목, 섹션 제목 |
| **숫자는 고정폭** | `font-mono` (JetBrains Mono) — CPU %, 토큰 수, 해시, 경로 |
| **터미널은 항상 어둡게** | 테마 · 라이트 모드와 무관하게 `.terminal { background: #05070c }` |
| **모션은 짧게, 끌 수 있게** | 150~240ms, `prefers-reduced-motion` 이면 끔 |

## 2. 기본 토큰 (theme.css)

```css
body {
  font-family: 'Inter', 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, -apple-system, sans-serif;
  color: #fff;
  /* 오로라 배경: 파랑 · 보라 · 초록 빛 + 아주 어두운 남색 */
  background: radial-gradient(circle at 10% 10%, rgba(59,130,246,.20), transparent 35%),
              radial-gradient(circle at 90% 0%,  rgba(168,85,247,.18), transparent 40%),
              radial-gradient(circle at 50% 100%, rgba(16,185,129,.10), transparent 45%),
              #05070f;
  background-attachment: fixed;
}
.font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }

/* 유리 표면 3단계 */
.glass        { background: rgba(255,255,255,.05); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,.09); }
.glass-strong { background: rgba(255,255,255,.07); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,.12); }
.glass-soft   { background: rgba(255,255,255,.03); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.07); }

/* 입력창: 포커스 때 파란 링 */
.glass-input { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12); transition: background 150ms, border-color 150ms, box-shadow 150ms; }
.glass-input:focus { background: rgba(255,255,255,.09); border-color: rgba(96,165,250,.6); box-shadow: 0 0 0 3px rgba(59,130,246,.15); outline: none; }

/* 주요 버튼: 파랑 → 보라 그라디언트 + 빛 */
.btn-glow { color: #fff; background: linear-gradient(135deg, #3b82f6, #8b5cf6); box-shadow: 0 8px 24px rgba(59,130,246,.30);
            transition: box-shadow 150ms, transform 150ms, opacity 150ms; }
.btn-glow:hover  { box-shadow: 0 10px 30px rgba(139,92,246,.40); transform: translateY(-1px); }
.btn-glow:active { transform: translateY(0); }

/* 사이드바 현재 메뉴 */
.nav-link.active { background: rgba(59,130,246,.15); color: #93c5fd; border-color: rgba(96,165,250,.25); }

/* 터미널 · 로그 · diff — 테마 무관 항상 어둡게 */
.terminal { background: #05070c; color: #cbd5e1; border-color: rgba(255,255,255,.08); }

.scale-up-animation { animation: scaleUp .2s ease-out; }
@keyframes scaleUp { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: scale(1); } }
```

## 3. 자주 쓰는 컴포넌트 조합 (Tailwind)

```html
<!-- 카드 -->
<div class="glass rounded-2xl p-5 shadow-xl">
  <p class="text-xs text-white/50 font-bold uppercase tracking-wider"><i class="fas fa-microchip mr-1.5 text-emerald-400"></i>CPU Total</p>
  <h3 class="text-3xl font-mono font-bold text-emerald-400 mt-2">3.5 %</h3>
</div>

<!-- 작은 지표 카드 (4개 그리드) -->
<article class="glass-soft rounded-xl p-4">
  <p class="text-[9px] font-bold uppercase tracking-wider text-white/35">Branch</p>
  <p class="mt-2 truncate font-mono text-sm font-bold text-cyan-400">main</p>
</article>

<!-- 상태 배지 -->
<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> ONLINE
</span>

<!-- 진행 막대 -->
<div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
  <div class="h-full bg-gradient-to-r from-blue-500 to-sky-400 transition-all duration-500" style="width:42%"></div>
</div>

<!-- 브랜드 로고 블록 -->
<div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-blue-900/30"><i class="fas fa-layer-group text-sm"></i></div>
<h1 class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 tracking-tight">UnivDash</h1>

<!-- 아이콘 버튼 (터치 38~44px) -->
<button class="w-10 h-10 rounded-xl border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition">…</button>

<!-- 위험 작업 버튼: 평소 연하게, hover 때 진하게 -->
<button class="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-600 hover:text-white transition">…</button>
```

상태 아이콘 (목록 왼쪽 36px 네모):

```css
.status-icon { width: 36px; height: 36px; border-radius: 11px; display: flex; align-items: center; justify-content: center; }
.st-idle    { background: rgba(16,185,129,.12); color: #34d399; }   /* ✓ 대기 */
.st-busy    { background: rgba(59,130,246,.15); color: #60a5fa; }   /* 회전 스피너 = 작업 중 */
.st-waiting { background: rgba(245,158,11,.16); color: #fbbf24; animation: pulse 1.6s infinite; }  /* 응답 필요 */
.st-shell   { background: rgba(148,163,184,.12); color: #94a3b8; }
```

브랜드 알약 (서비스 구분): Claude `#d97757` 계열, Codex `#10a37f` 계열 — 배경 16% · 테두리 30% · 글자 밝게.

## 4. 테마 시스템 — 4종 × 다크/라이트

`<html>` 속성 두 개로 전부 제어한다.

| 속성 | 값 | 의미 |
|---|---|---|
| `data-ui-theme` | (없음) / `mesh` / `apple` / `mono` | 오로라 / 그라디언트 메시 / 애플 글래스 / 미니멀 플랫 |
| `data-ui-theme-mode` | (없음) / `light` | 다크(기본) / 라이트 |

### 테마별 배경

```css
/* 그라디언트 메시 — 색이 천천히 도는 배경 (30초 hue-rotate) */
html[data-ui-theme="mesh"] body::before {
  content: ""; position: fixed; inset: 0; z-index: -1;
  background: radial-gradient(at 18% 20%, var(--m1) 0, transparent 52%), radial-gradient(at 82% 15%, var(--m2) 0, transparent 52%),
              radial-gradient(at 15% 82%, var(--m3) 0, transparent 52%), radial-gradient(at 85% 85%, var(--m4) 0, transparent 52%), var(--mbase);
  animation: hue 30s linear infinite;
}
@keyframes hue { to { filter: hue-rotate(360deg); } }
html[data-ui-theme="mesh"]:not([data-ui-theme-mode="light"]) body { --mbase:#14151f; --m1:hsl(190 70% 55%/.26); --m2:hsl(310 60% 60%/.22); --m3:hsl(45 70% 55%/.18); --m4:hsl(260 60% 62%/.22); }
html[data-ui-theme="mesh"][data-ui-theme-mode="light"] body   { --mbase:#eef0f4; --m1:hsl(200 60% 65%/.20); --m2:hsl(300 45% 68%/.16); --m3:hsl(40 65% 68%/.15); --m4:hsl(255 45% 68%/.15); }

/* 애플 글래스 — 진한 월페이퍼 + 유리에 채도 올리기 */
html[data-ui-theme="apple"] :is(.glass, .glass-strong, .glass-soft) {
  backdrop-filter: blur(30px) saturate(180%); -webkit-backdrop-filter: blur(30px) saturate(180%);
}

/* 미니멀 플랫 — 블러 제거, 단색 표면 (저사양 · 가독성 우선) */
html[data-ui-theme="mono"] :is(.glass, .glass-strong, .glass-soft) { backdrop-filter: none !important; }
html[data-ui-theme="mono"]:not([data-ui-theme-mode="light"]) .glass { background: #12151d; border-color: rgba(255,255,255,.08); }
html[data-ui-theme="mono"][data-ui-theme-mode="light"] .glass     { background: #ffffff; border-color: rgba(15,23,42,.10); }

@media (prefers-reduced-motion: reduce) { html[data-ui-theme="mesh"] body::before { animation: none; } }
```

### 라이트 모드 = "쓰는 유틸리티만 골라 반전"

템플릿마다 `dark:` 변형을 붙이는 대신, **실제로 쓰는 다크 유틸리티 목록을 라이트용으로 한곳에서 덮어쓴다.**
장점: 템플릿이 짧고, 새 페이지도 다크 기준으로만 쓰면 된다.

```css
html[data-ui-theme-mode="light"] body { color: #101828; }
/* 텍스트 투명도 → 진한 남회색 단계로 */
html[data-ui-theme-mode="light"] .text-white    { color: #101828 !important; }
html[data-ui-theme-mode="light"] .text-white\/90 { color: #1a2233 !important; }
html[data-ui-theme-mode="light"] .text-white\/70 { color: #34405c !important; }
html[data-ui-theme-mode="light"] .text-white\/50 { color: #5a6781 !important; }
html[data-ui-theme-mode="light"] .text-white\/40 { color: #6b7490 !important; }
/* 흰 반투명 배경 · 테두리 → 남색 반투명 */
html[data-ui-theme-mode="light"] .bg-white\/5     { background-color: rgba(15,23,42,.04) !important; }
html[data-ui-theme-mode="light"] .border-white\/10 { border-color: rgba(15,23,42,.10) !important; }
/* 포인트 색은 한 단계 진하게 (밝은 배경 대비) */
html[data-ui-theme-mode="light"] .text-blue-400    { color: #2563eb !important; }
html[data-ui-theme-mode="light"] .text-emerald-400 { color: #047857 !important; }
html[data-ui-theme-mode="light"] .text-amber-400   { color: #b45309 !important; }
/* 유리는 흰 반투명 */
html[data-ui-theme-mode="light"] .glass       { background: rgba(255,255,255,.60); border-color: rgba(15,23,42,.08); }
html[data-ui-theme-mode="light"] .glass-input { background: rgba(255,255,255,.7); border-color: rgba(15,23,42,.12); color: #101828; }
/* 단, 색 있는 배경 위 흰 글자는 흰색 유지 */
html[data-ui-theme-mode="light"] :is(.btn-glow, .bg-gradient-to-r.text-white, .bg-gradient-to-br.text-white) { color: #fff !important; }
/* 오로라 라이트 배경 */
html[data-ui-theme-mode="light"]:not([data-ui-theme]) body {
  background: radial-gradient(circle at 10% 10%, rgba(99,102,241,.14), transparent 35%),
              radial-gradient(circle at 90% 0%, rgba(236,72,153,.10), transparent 40%),
              radial-gradient(circle at 50% 100%, rgba(16,185,129,.10), transparent 45%), #eef0f9;
}
```

직접 만든 컴포넌트(칩, 탭바, 시트)는 컴포넌트 CSS 에 라이트 규칙을 같이 둔다:

```css
.filter-chip { border: 1px solid rgba(255,255,255,.10); background: rgba(255,255,255,.04); color: rgba(255,255,255,.55); }
html[data-ui-theme-mode="light"] .filter-chip { border-color: rgba(15,23,42,.10); background: rgba(15,23,42,.03); color: #47536e; }
```

### 첫 화면 깜빡임 막기 — head 에서 동기 실행

CSS 보다 **먼저** 저장된 테마를 적용해야 흰 화면 → 다크 전환 깜빡임이 없다. CSP 때문에 인라인 대신 파일(`theme-boot.js`), `defer` 없이.

```js
// theme-boot.js — <head> 맨 위에서 <script src="/static/theme-boot.js"></script>
(function(){try{
  var d=document.documentElement, s=localStorage.getItem('app-theme-style'), m=localStorage.getItem('app-theme');
  if(s&&s!=='default') d.setAttribute('data-ui-theme',s);
  if(m!=='light'&&m!=='dark') m=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';   // 처음엔 OS 설정
  if(m==='light') d.setAttribute('data-ui-theme-mode','light');
  d.style.colorScheme=m;    // 스크롤바 · 폼 컨트롤 색도 맞춤
}catch(e){}})();
```

### 테마 선택 모달

- 헤더 🎨 버튼 → 2×2 격자로 테마 견본(원형 그라디언트) + 다크 모드 스위치
- 선택하면 localStorage 저장 + `window.dispatchEvent(new CustomEvent('app:themechange', { detail: { theme, style } }))`
- 차트(Chart.js)는 이 이벤트를 받아 격자선 · 눈금 색을 바꾼다:

```js
function chartColors() {
  const light = document.documentElement.getAttribute('data-ui-theme-mode') === 'light';
  return light ? { grid: 'rgba(15,23,42,.08)', ticks: '#5a6781' }
               : { grid: 'rgba(255,255,255,.07)', ticks: 'rgba(255,255,255,.45)' };
}
addEventListener('app:themechange', () => { const c = chartColors(); chart.options.scales.y.grid.color = c.grid; chart.update('none'); });
```

## 5. 모바일에서 달라지는 디자인

- 유리 효과(`backdrop-filter`)는 모바일 전체 화면 패널에서 끈다 → 성능 + 뒤 목록이 비쳐 보이는 것 방지
  ```css
  @media (max-width: 1023.98px) { #termPane .glass { backdrop-filter: none; } #termPane { background: var(--shell-bg); } }
  :root { --shell-bg: #070a13; } html[data-ui-theme-mode="light"] { --shell-bg: #eef0f7; }
  ```
- 상태바(`theme-color`)와 헤더 색을 맞춘다 (`#05070f`)
- 탭바 · 시트는 불투명도 92~96% 로 (뒤 내용이 비치면 글자가 안 읽힘)

## 6. 아이콘 · 폰트

- 아이콘: Font Awesome 6 (자체 호스팅) — `fa-terminal`, `fa-server`, `fa-code-branch`, `fa-robot`, `fa-folder-tree`
- 폰트: Inter(본문) + JetBrains Mono(숫자·코드), 자체 호스팅 가변 폰트 woff2, 한글은 시스템 폰트 폴백
- 앱 아이콘: 브랜드 그라디언트(파랑→보라→자홍) + 흰 기호 — 02-app-icon.md

## 7. 새 페이지를 만들 때 순서

1. 레이아웃 템플릿 상속, `active_page` 로 메뉴 활성
2. 다크 기준 유틸리티로 작성 (`glass` 카드, `text-white/xx`, 의미별 포인트 색)
3. 새로 쓴 `text-white/xx`, `bg-white/xx`, `border-white/xx`, 포인트 색이 라이트 반전 목록에 있는지 확인
4. 모바일 폭(390)에서 가로 넘침 점검 (07 문서)
5. Tailwind 빌드 다시 하기 (`scripts/build_css.sh`)
6. 라이트 모드 + 4개 테마 스크린샷 한 번씩
