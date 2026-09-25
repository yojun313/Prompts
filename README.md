# 웹앱 스킬셋 — 데스크톱 · 모바일 · 아이폰 홈 화면 앱

UnivDash(tmux · pm2 · git 대시보드)를 만들면서 실제로 부딪히고 해결한 것들을 정리한 문서입니다.
모든 코드는 실제로 동작을 확인한 코드에서 뽑았습니다.

| 문서 | 내용 |
|---|---|
| [01-iphone-webapp.md](01-iphone-webapp.md) | **아이폰 홈 화면 앱(PWA)**: 뷰포트 · 확대 금지 · 노치/홈 인디케이터 · 키보드 · 상태바 버그 |
| [02-app-icon.md](02-app-icon.md) | **홈 화면 아이콘이 제대로 나오게**: apple-touch-icon · manifest · PNG 생성 |
| [03-app-like-ux.md](03-app-like-ux.md) | 앱처럼 느껴지는 UI: 하단 탭바 · 바텀 시트 · 터치 반응 · 슬라이드 패널 · 뒤로 가기 |
| [04-responsive-layout.md](04-responsive-layout.md) | 데스크톱 ↔ 모바일 레이아웃: 사이드바 · 목록/상세 · 가로 넘침 잡기 · 테마(다크/라이트) |
| [05-security.md](05-security.md) | 관리용 웹앱 보안: CSP · 자체 호스팅 · CSRF · 세션 · 2단계 인증 · 로그인 제한 |
| [06-realtime-and-input.md](06-realtime-and-input.md) | WebSocket 실시간 · 파일 첨부(드래그앤드롭/붙여넣기) · 모바일 한글 입력 |
| [07-testing-mobile.md](07-testing-mobile.md) | 실제 폰 없이 모바일 검증: Playwright · safe-area 흉내 · iOS 뷰포트 모킹 |
| [08-design-theme.md](08-design-theme.md) | **디자인 · 테마 전략**: 글래스 다크 디자인 원칙 · 토큰 · 컴포넌트 · 테마 4종 × 다크/라이트 · 깜빡임 없는 적용 |
| [09-native-touch-feel.md](09-native-touch-feel.md) | **누르는 느낌을 아이폰 앱처럼**: 즉시 눌림 · 천천히 풀림 · sticky hover 제거 · iOS 햅틱 · 44pt 터치 영역 · 느린 버튼 표시 |

`scripts/` — 바로 쓸 수 있는 도구

| 파일 | 용도 |
|---|---|
| `render_icons.py` | SVG 한 장으로 홈 화면 아이콘 PNG(180/192/512/32) 만들기 |
| `mobile_audit.py` | 모든 페이지를 휴대폰 크기로 열어 가로 넘침 · 16px 미만 입력창 · JS 오류 찾기 (노치 흉내 옵션) |
| `ios_viewport_sim.py` | iOS 홈 화면 앱의 뷰포트 · 키보드 동작을 흉내 내 레이아웃 검증 |
| `build_css.sh` | Tailwind 를 CDN 없이 CSS 파일로 빌드 |

`templates/` — 복사해서 시작하는 뼈대

| 파일 | 용도 |
|---|---|
| `head.html` | `<head>` 에 넣을 메타 태그 전부 (뷰포트, 아이콘, manifest, 상태바) |
| `manifest.webmanifest` | 홈 화면 앱 매니페스트 |
| `icon.svg` | 아이콘 원본 예시 (꽉 찬 정사각형) |
| `viewport.js` | 키보드 · 확대 · 뷰포트 처리 스크립트 |
| `mobile.css` | 앱 셸 · safe-area · 탭바 · 터치 · 누르는 느낌 CSS |
| `press.js` | 눌림 표시 · iOS/안드로이드 햅틱 · 느린 버튼 표시 (09) |

## 빠른 시작

```bash
# 1) 템플릿 복사: templates/head.html → <head>, viewport.js · mobile.css → static/
# 2) 아이콘 만들기
uv run --with playwright python scripts/render_icons.py templates/icon.svg static/icons/
# 3) 휴대폰 크기 점검 (노치 흉내)
AUDIT_SAFE_AREA=59,34 uv run --with playwright python scripts/mobile_audit.py http://127.0.0.1:8000 out/ / /settings
# 4) iOS 키보드 흉내 점검
uv run --with playwright python scripts/ios_viewport_sim.py http://127.0.0.1:8000/chat "#input" ".composer" ".tabbar"
```

## 가장 중요한 9가지 (먼저 읽기)

1. **입력창 글자는 16px 이상** — 아니면 iOS 가 포커스할 때 화면을 확대한다.
2. **홈 화면 앱 상태바는 `black`(불투명)** — `black-translucent` 는 화면 아래가 상태바 높이만큼 잘리는 iOS 버그가 있다.
3. **아이콘은 PNG, 꽉 찬 정사각형, 투명 없음** — iOS 는 SVG 아이콘을 쓰지 않고, 모서리는 iOS 가 둥글게 자른다.
4. **키보드 = 입력칸 포커스로 판단** — iOS 는 innerHeight 가 같이 줄어드는 경우가 있어 높이 차이로는 못 잡는다.
5. **safe-area 여백은 `!important` 또는 높은 우선순위로** — Tailwind 같은 유틸리티 CSS 가 뒤에 오면 덮어쓴다. Safari 탭에서는 inset 이 0 이라 티가 안 나고 홈 화면 앱에서만 깨진다.
6. **그리드는 기본 열을 꼭 지정** (`grid-cols-[minmax(0,1fr)]`) — 안 하면 긴 텍스트 폭으로 늘어나 모바일에서 가로로 넘친다.
7. **관리용 앱은 외부 CDN 을 쓰지 말고 CSP `script-src 'self'`** — CDN 이 뚫리면 서버 권한이 넘어간다.
8. **다크 기준으로 쓰고 라이트는 한곳에서 반전** — 템플릿은 `text-white/60` 같은 다크 유틸리티만, 라이트 모드는 CSS 에서 쓰는 클래스만 골라 덮어쓴다. 터미널 영역은 테마와 무관하게 항상 어둡게.
9. **누를 땐 0ms, 뗄 땐 200ms · hover 는 `(hover: hover)` 에서만** — 이 두 가지만 해도 "웹 같은" 터치감이 사라진다. iOS 햅틱은 숨긴 `input[switch]` 를 사용자 탭 안에서 click().
