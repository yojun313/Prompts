# 06. 실시간 연결 · 첨부 · 모바일 입력

## 1. WebSocket 하나로 실시간 화면

```
client → server : {"t":"sub","pane":"%3"} / {"t":"prompt",...,"id":7} / {"t":"keys",...}
server → client : {"t":"windows",...} / {"t":"screen",...} / {"t":"ack","id":7} / {"t":"error","message","id"}
```

서버: 수신 루프 + 푸시 루프 두 개. **바뀌었을 때만** 보낸다.

```python
async def pump(ch):
    while True:
        await ch.push_screen()  # 이전과 JSON 이 같으면 안 보냄
        try:
            await asyncio.wait_for(
                ch.wake.wait(), timeout=0.4
            )  # 입력 직후엔 wake 로 즉시 갱신
        except TimeoutError:
            pass
        ch.wake.clear()
```

- 여러 탭이 동시에 폴링해도 원본 조회는 한 번: 1.5초 캐시 (`threading.Lock` + 타임스탬프)
- 메시지 크기 제한 (64KB), JSON 파싱 실패는 일반 오류 문구로 (파서 메시지 노출 금지)
- 블로킹 작업은 `await asyncio.to_thread(...)`

클라이언트: 자동 재연결 + 요청/응답(ack) 매칭

```js
function send(message, { ack = false } = {}) {
  if (ws?.readyState !== WebSocket.OPEN) return ack ? Promise.reject(new Error('연결되어 있지 않습니다')) : Promise.resolve();
  if (!ack) { ws.send(JSON.stringify(message)); return Promise.resolve(); }
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('응답 시간 초과')); }, 10000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ ...message, id }));
  });
}
ws.onclose = (e) => {
  if (e.code === 1008) { location.href = '/login'; return; }         // 인증 실패
  retry = Math.min(retry + 1, 5);
  setTimeout(connect, [0, 800, 1500, 3000, 6000, 10000][retry]);    // 백오프
};
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { retry = 0; connect(); } });
addEventListener('online', () => { retry = 0; connect(); });
```

- 휴대폰은 백그라운드에서 소켓이 끊긴다 → 화면으로 돌아오면 즉시 재연결 + 상태 새로고침
- 연결 상태를 점(초록/노랑/빨강)과 배지로 보여준다
- 상태 변화(작업 완료 · 응답 필요)는 **보고 있지 않은 항목만** 토스트 + 진동

## 2. ANSI 색 터미널 출력을 HTML 로 (라이브러리 없이)

서버는 `tmux capture-pane -p -e` 로 ANSI 그대로 보내고, 브라우저에서 SGR 만 해석한다.

```js
const SGR = /\x1b\[([0-9;:]*)m/g;
const OTHER = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[0-9;?]*[A-Za-ln-z]|\x1b[()][A-Za-z0-9]|\x1b[=>78]/g;
// 코드: 0 리셋, 1 굵게, 2 흐리게, 3 기울임, 4 밑줄, 7 반전, 9 취소선, 22/23/24/27/29 해제,
// 30-37/90-97 전경, 40-47/100-107 배경, 38;5;n / 48;5;n (256색), 38;2;r;g;b (트루컬러), 39/49 기본
```

- 텍스트는 반드시 `escapeHtml` 후 `<span style>` 로 감싼다 (XSS 방지)
- 커서: 넓은 글자(한글 = 2칸)를 계산해 해당 칸을 `<span class="cur">` 로
- 화면 아래 빈 줄은 잘라내되 커서 줄은 남긴다
- 전체 화면 앱(Claude Code 등, alternate screen)은 tmux 스크롤백이 없다 → 앱 자체 로그(JSONL)를 읽어 "대화 기록" 으로 보여주기

## 3. 파일 첨부 — 선택 · 붙여넣기 · 드래그앤드롭

```html
<div class="relative flex-1">
  <textarea id="promptInput" class="pl-4 pr-11 …"></textarea>
  <button id="attachBtn" class="attach-btn" aria-label="사진이나 파일 첨부">📎</button>
  <input id="fileInput" type="file" multiple class="hidden">   <!-- accept 없음 → iOS: 사진 보관함 · 카메라 · 파일 -->
</div>
<div id="attachTray" class="hidden …"></div>   <!-- 미리보기 칩 + 진행률 + ✕ -->
```

업로드는 XHR (진행률 이벤트가 있어서), 본문 = 파일 그대로:

```js
const xhr = new XMLHttpRequest();
xhr.open('POST', '/api/uploads');
xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name));   // 사용자 정의 헤더 = CORS 사전요청 필요 → CSRF 방어에도 도움
xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
xhr.upload.onprogress = (e) => { if (e.lengthComputable) item.progress = e.loaded / e.total; };
xhr.send(file);
```

붙여넣기 (스크린샷):

```js
input.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.items || [])].filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter(Boolean);
  if (files.length) { e.preventDefault(); addFiles(files); }
});
```

드래그앤드롭 (영역에 놓기 + 목록 항목 위에 놓으면 그 항목에):

```js
let depth = 0;
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
document.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; showDrop(e); });
document.addEventListener('dragover',  (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; showDrop(e); });
document.addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; if (!--depth) hideDrop(); });
document.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return; e.preventDefault(); hideDrop();
  const item = e.target.closest?.('.win-item'); if (item) select(item.dataset.key);
  addFiles([...e.dataTransfer.files]);
});
addEventListener('blur', hideDrop);   // 창 밖으로 끌고 나가면 오버레이가 남는 것 방지
```

- 미리보기는 `URL.createObjectURL(file)` → CSP `img-src blob:` 필요, 다 쓰면 `revokeObjectURL`
- iPad · 분할 화면에서는 모바일도 드롭이 온다 (같은 코드로 동작)
- Claude Code / Codex 에 이미지 첨부: 파일 **경로를 bracketed paste 로 하나씩** 붙여넣으면 `[Image #1]` 로 인식된다
  (`tmux load-buffer` + `paste-buffer -p`, 그 뒤 잠깐 쉬고 Enter)

## 4. 모바일에서 터미널에 "직접 입력" (한글 IME 포함)

모바일 키보드는 `keydown` 대신 `keyCode 229` + `input`/`composition` 이벤트만 준다.
빈 입력칸에서는 안드로이드가 백스페이스 이벤트를 안 주므로 **보이지 않는 문자(sentinel)를 채워 두고 값의 변화로 판단**한다.

```js
const SENTINEL = '​​';
function reset() { input.value = SENTINEL; input.setSelectionRange(2, 2); }
function flush() {
  const v = input.value;
  if (v.startsWith(SENTINEL)) {
    v.slice(SENTINEL.length).split('\n').forEach((part, i) => { if (i) sendKey('Enter'); if (part) sendText(part); });
  } else {
    for (let i = 0; i < Math.max(1, SENTINEL.length - v.length); i++) sendKey('BSpace');   // 지워졌다
  }
  reset();
}
input.addEventListener('focus', reset);
input.addEventListener('input', (e) => { if (!e.isComposing) flush(); });
input.addEventListener('compositionupdate', (e) => { banner.textContent = `입력 중: ${e.data}`; });  // 조합 중 미리보기
input.addEventListener('compositionend', () => setTimeout(flush, 0));
input.addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;                   // 모바일 · 한글 조합 중
  // Enter, Backspace, 방향키, Tab/Shift+Tab, Ctrl+문자 → 키 이름으로 보내고 preventDefault
  // 인쇄 가능한 한 글자(데스크톱) → preventDefault 후 텍스트로
});
```

입력 받개는 화면 밖에 두되 포커스 가능하게:

```css
.direct-input { position: fixed; left: 0; bottom: 0; width: 1px; height: 1px; opacity: 0; font-size: 16px; pointer-events: none; }
```

## 5. 빠른 문구 · 최근 기록 · 초안

- 자주 쓰는 프롬프트(“계속 진행해줘”, “/compact”)를 localStorage 에 저장, 탭 = 입력창에 넣기, 길게 누름 = 바로 보내기
- 최근 보낸 20개 기억
- 항목(창)별 입력 초안 저장 → 다른 창 갔다 와도 유지, 보내면 삭제
