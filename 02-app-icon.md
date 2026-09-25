# 02. 홈 화면 아이콘이 제대로 나오게 하기

## 규칙 요약

| 항목 | 규칙 | 이유 |
|---|---|---|
| 형식 | **PNG** | iOS 는 SVG `apple-touch-icon` 을 쓰지 않는다 |
| 크기 | 180×180 (`apple-touch-icon`), 192 · 512 (manifest), 32 (파비콘) | 180 = iPhone @3x 60pt |
| 모양 | **꽉 찬 정사각형, 투명 없음, 모서리 둥글게 하지 않기** | iOS 가 직접 둥글게 자른다. 투명 부분은 검게 나온다 |
| 여백 | 중요한 그림은 가운데 80% 안에 | 모서리가 잘리고 안드로이드 maskable 은 원형으로도 잘린다 |
| 반영 | 아이콘을 바꾸면 **홈 화면에서 지우고 다시 추가** | 추가할 때 한 번만 읽는다 |
| 경로 | 로그인 없이 받을 수 있는 곳(`/static/...`) | 로그인 페이지로 리다이렉트되면 아이콘이 안 나온다 |

## 1. `<head>`

```html
<link rel="icon" type="image/svg+xml" href="/static/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/static/icons/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/static/icons/apple-touch-icon.png">
<link rel="manifest" href="/static/manifest.webmanifest">
<meta name="apple-mobile-web-app-title" content="UnivDash">   <!-- 아이콘 아래 이름 -->
```

로그인 페이지에도 똑같이 넣는다 (로그인 화면에서 "홈 화면에 추가" 하는 경우가 많다).

## 2. `manifest.webmanifest`

```json
{
  "name": "UnivDash",
  "short_name": "UnivDash",
  "id": "/",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#05070f",
  "theme_color": "#05070f",
  "lang": "ko",
  "icons": [
    { "src": "/static/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/static/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/static/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- CSP 를 쓰면 `manifest-src 'self'` 필요 (default-src 'self' 면 자동 포함).

## 3. 원본 SVG — 꽉 찬 정사각형

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2563eb"/>
      <stop offset="0.55" stop-color="#7c3aed"/>
      <stop offset="1" stop-color="#a21caf"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.25" cy="0.15" r="0.9">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="0.6" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <!-- rx 없음: iOS 가 모서리를 자른다 -->
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#glow)"/>
  <!-- 가운데 영역에 그림 -->
  <rect x="212" y="262" width="600" height="500" rx="72" fill="#0b1020" fill-opacity="0.55" stroke="#fff" stroke-opacity="0.35" stroke-width="10"/>
  <circle cx="290" cy="330" r="17" fill="#f87171"/>
  <circle cx="345" cy="330" r="17" fill="#fbbf24"/>
  <circle cx="400" cy="330" r="17" fill="#34d399"/>
  <path d="M322 470 L432 555 L322 640" fill="none" stroke="#fff" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M492 640 H672" stroke="#fff" stroke-width="46" stroke-linecap="round"/>
</svg>
```

브라우저 탭 파비콘(`favicon.svg`)은 같은 그림에 `rx="230"` 을 줘서 둥글게 만든다 (탭에서는 브라우저가 안 자르니까).

## 4. PNG 만들기 — 헤드리스 크롬으로 렌더링

ImageMagick · cairosvg 없이 Playwright 만으로 정확하게 만든다: `scripts/render_icons.py`

```bash
uv run --with playwright python scripts/render_icons.py path/to/icon.svg path/to/output_dir
# 처음이면: uv run --with playwright python -m playwright install chromium
```

만들어지는 파일: `apple-touch-icon.png`(180), `icon-192.png`, `icon-512.png`, `favicon-32.png`

핵심 코드:

```python
page = await browser.new_page(viewport={"width": size, "height": size})
await page.set_content(
    f"<html><body style='margin:0'><div style='width:{size}px;height:{size}px'>"
    f"{svg.replace('<svg ', '<svg width=100% height=100% ')}</div></body></html>"
)
await page.screenshot(path=out, omit_background=False)  # 투명 없이
```

## 5. 확인

1. 파일 확인: `file icons/*.png` → `180 x 180, 8-bit/color RGB` (RGBA 가 아니어야 좋음)
2. 브라우저에서 `/static/icons/apple-touch-icon.png` 가 **로그아웃 상태에서도** 열리는지
3. 아이폰 Safari → 공유 → 홈 화면에 추가 → 미리보기 아이콘 확인
4. 아이콘을 바꿨다면 기존 홈 화면 아이콘 **삭제 후 다시 추가**
