# 05. 관리용 웹앱 보안 (서버 권한을 다루는 대시보드)

터미널 입력 · pm2 · git 을 웹에서 다루는 앱은 **뚫리면 서버 셸을 넘겨주는 것**과 같다. 아래를 기본으로 켠다.
(FastAPI/Starlette 기준이지만 개념은 어디든 같다.)

## 1. 외부 CDN 없애기 → CSP `script-src 'self'`

CDN 스크립트(Tailwind Play CDN, jsdelivr …)가 바뀌거나 뚫리면 관리 화면에서 임의 코드가 실행된다.

1. 라이브러리를 버전 고정해서 내려받아 `/static/vendor/` 에 둔다
   ```bash
   curl -fsSL -o static/vendor/chart.umd.min.js https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js
   curl -fsSL -o static/vendor/fontawesome/css/all.min.css https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css
   # webfonts/*.woff2 도 css 의 url(../webfonts/…) 에 맞춰 받는다
   ```
2. Tailwind 는 CDN 대신 빌드 (`scripts/build_css.sh`, 독립 실행 CLI — node 불필요)
   - 템플릿 · JS 에 새 클래스를 쓰면 **다시 빌드**해야 한다.
   - JS 에서 클래스를 `bg-${color}` 처럼 조립하지 않는다 (빌드가 못 찾는다).
   - **CSS 순서**: CDN 은 스타일을 `<head>` 끝에 넣으므로 빌드 CSS 도 **맨 마지막**에 불러야 같은 모양이 된다.
     (단, 그러면 safe-area 규칙이 유틸리티에 지므로 `!important` — 01 문서)
3. 인라인 `<script>` 를 파일로 뺀다 (첫 페인트 전 테마 적용 스니펫도 `theme-boot.js` 로, defer 없이 head 에서)
4. `onclick=""` 같은 인라인 핸들러 금지 → `data-*` 속성 + 이벤트 위임
5. 폰트도 자체 호스팅 (`@fontsource-variable/*` 의 woff2)

```python
CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self'",                    # 인라인 · eval · 외부 스크립트 불가
    "style-src 'self' 'unsafe-inline'",     # style="width:40%" 같은 속성용 (스타일은 코드 실행 불가)
    "font-src 'self'",
    "img-src 'self' data: blob:",           # blob: 첨부 미리보기
    "media-src 'self' blob:",
    "connect-src 'self'",                   # fetch · WebSocket (same-origin wss 포함)
    "manifest-src 'self'",
    "worker-src 'none'", "object-src 'none'", "frame-src 'none'",
    "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
])
# HTTPS 면 + "; upgrade-insecure-requests"
```

그 밖의 헤더:

```python
{
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Cache-Control": "no-store",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",   # HTTPS 일 때
}
# Server 헤더 제거 (uvicorn server_header=False)
```

## 2. API 문서 · 오류 정보 숨기기

```python
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

@app.exception_handler(RequestValidationError)
async def _(request, exc):
    return JSONResponse(status_code=422, content={"detail": "잘못된 요청입니다."})  # 스키마 노출 금지
```

## 3. CSRF · WebSocket 탈취 막기

쿠키로 인증하면 다른 사이트가 사용자의 브라우저로 POST 를 보낼 수 있다.

```python
def is_same_origin(headers) -> bool:
    source = headers.get("origin") or headers.get("referer")
    if not source or source == "null":
        return False                      # 없으면 거부 (현대 브라우저는 POST · WS 에 항상 Origin 을 보낸다)
    return urlsplit(source).netloc.lower() == (headers.get("host") or "").lower()

# ASGI 미들웨어에서: POST/PUT/PATCH/DELETE 와 모든 WebSocket 에 적용 → 403 / close(1008)
```

- 쿠키: `HttpOnly`, `SameSite=Strict`, HTTPS 면 `Secure` + **`__Host-` 접두사** (하위 도메인이 덮어쓰지 못함)
- 로그아웃도 POST 로만 (GET 로그아웃은 `<img src=/logout>` 로 강제 로그아웃 가능)
- **Host 허용 목록** (`ALLOWED_HOSTS=dash.example.com`) → DNS rebinding 차단

## 4. 로그인

```python
# 비밀번호: 평문이면 12자 이상 강제, 또는 PBKDF2 해시로 저장
def hash_password(pw, iterations=600_000):
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${b64(salt)}${b64(dk)}"

# 비교는 항상 상수 시간
hmac.compare_digest(a.encode(), b.encode())
```

**2단계 인증(TOTP, 표준 라이브러리만으로)**

```python
def totp_code(secret_b32, counter, digits=6):
    key = base64.b32decode(secret_b32 + "=" * (-len(secret_b32) % 8), casefold=True)
    h = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    o = h[-1] & 0x0F
    return str((int.from_bytes(h[o:o+4], "big") & 0x7FFFFFFF) % 10**digits).zfill(digits)

# 검증: ±30초 허용, 한 번 쓴 시간 구간은 다시 받지 않기 (재전송 방지)
# 비밀번호가 맞을 때만 코드 검사 (틀린 비밀번호로 유효 코드를 소모시키지 못하게)
# 검증: RFC 6238 부록 B — secret "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", T=59 → 8자리 "94287082"
```

설정 도우미 CLI: `hash-password`(getpass), `totp`(비밀값 + otpauth:// URI + 현재 코드 출력), `secret-key`.

**무차별 대입 제한**
- IP 별: 15분에 5회 실패 → 15분 잠금
- 전체: 모든 IP 합산 15분에 30회 → 전체 잠금 (IP 를 바꿔 가며 하는 공격 대비)
- 오류 문구는 하나로 ("로그인 정보가 올바르지 않습니다") — 무엇이 틀렸는지 알려주지 않기
- 성공 · 실패 · 로그아웃을 IP · User-Agent 와 함께 로그

## 5. 세션 — 서버가 목록을 가진다

서명 쿠키만 쓰면 로그아웃해도 훔친 쿠키가 만료 때까지 유효하다.

- 쿠키엔 임의 세션 ID 만, 서버 파일(0600)에 **SHA-256 해시로만** 저장
- 유효 조건: 목록에 있음 + 최대 12시간 + 유휴 4시간 + **계정 정보 지문 일치**
  (지문 = PBKDF2(아이디+비번+TOTP비밀) → 비밀번호를 바꾸면 모든 세션 자동 무효)
- 로그인 시 세션 재발급 (세션 고정 방지), 로그아웃 · **모든 기기 로그아웃** 이 재시작 후에도 유지
- 열린 WebSocket 도 주기적으로(10초) 세션 재확인, 셸 입력은 매 메시지마다 확인

## 6. 서버 명령 실행

```python
# ✅ shell 없이 인자 리스트, 대상은 실제 존재하는 ID 만
subprocess.run(["tmux", "send-keys", "-t", pane_id, "-l", "--", text], shell=False, timeout=5)
PANE_ID = re.compile(r"^%\d{1,6}$")          # 받은 값 형식 검증 + 현재 목록에 있는지 재확인
NAMED_KEYS = {"Enter", "Escape", "Tab", ...}  # 키 이름은 허용 목록만
SESSION_NAME = re.compile(r"^[\w가-힣][\w\-가-힣]{0,49}$")  # '-' 로 시작 금지 (옵션으로 해석됨)
```

- 설정 파일(JS 등)에 값 넣을 땐 `json.dumps` 로 문자열 리터럴화 → 코드 주입 불가
- 파일을 고칠 땐: 새 내용을 임시 파일에 쓰고 → 원래 도구(node)로 다시 읽어 검증 → 백업 → `os.replace` (원자적)

⚠️ **pm2 로 띄운 파이썬이 node/pm2 를 부르면 죽는 문제**: pm2 가 넣은 `NODE_CHANNEL_FD` 를 물려받아 자식 node 가 abort(-6) 한다.

```python
env = dict(os.environ)
for k in ("NODE_CHANNEL_FD", "NODE_CHANNEL_SERIALIZATION_MODE", "NODE_UNIQUE_ID"):
    env.pop(k, None)
subprocess.run(["node", ...], env=env)
```

## 7. 파일 업로드

- **본문을 읽기 전에** 로그인 확인 (multipart 파싱 전에 디스크를 채우는 공격 방지) → raw body 스트리밍 업로드
- Content-Length 선검사 + 스트리밍 중 누적 크기 검사 → 초과 시 파일 삭제 후 413
- 파일명은 서버가 결정: `<랜덤12hex>-<정리된 이름>`, NFC 정규화, `[^\w.\-]` 제거, `os.open(O_CREAT|O_EXCL, 0o600)`
- 다음 요청에서는 클라이언트 경로가 아닌 **업로드 ID** 로만 가리키고 서버가 경로로 바꾼다
- 다시 내려받는 API 는 만들지 않는다, 보관 기간 지나면 삭제

## 8. 운영 체크리스트

- [ ] `HOST=127.0.0.1` + HTTPS 리버스 프록시(또는 Tailscale)로만 노출
- [ ] `SESSION_HTTPS_ONLY=true`, `ALLOWED_HOSTS=실제도메인`
- [ ] `SECRET_KEY` 32자 이상, TOTP 켜기, 비밀번호 해시
- [ ] 배포 후 확인: `/docs` 404, Origin 없는 POST 403, CSP 헤더, 콘솔에 CSP 위반 없음
