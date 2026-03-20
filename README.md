# 동백전 납부 매칭 PWA

학원/업체에서 동백전 QR 결제 납부 현황을 관리하는 PWA 앱입니다.

## 주요 기능

- 👥 **회원 명단 관리** - 실명 + 마스킹 패턴 등록
- 💳 **동백전 결제 내역 입력** - 날짜/시간/결제자/금액
- 📸 **캡처 사진 AI 인식** - Gemini API로 자동 추출 (드래그앤드롭, 클릭, Ctrl+V 붙여넣기)
- ✅ **납부 현황 확인** - 월별 납부/미납/확인필요 분류
- 📥 **CSV 내보내기** - 엑셀에서 열 수 있는 파일 저장

## GitHub Pages 배포 방법

### 1단계: 아이콘 생성
`icons/` 폴더에 아이콘 이미지 2개가 필요해요:
- `icon-192.png` (192x192px)
- `icon-512.png` (512x512px)

아래 사이트에서 무료로 만들 수 있어요:
👉 https://favicon.io/favicon-generator/
- Text: 🌸 또는 동백
- Background: #e85d75
- 다운로드 후 icons 폴더에 넣기

### 2단계: GitHub에 올리기
1. GitHub 접속 → 새 저장소 만들기 (New repository)
2. 저장소 이름: `dongbaek-pwa` (공개(Public)로 설정)
3. 이 폴더의 모든 파일을 업로드
   - `index.html`
   - `style.css`
   - `app.js`
   - `manifest.json`
   - `sw.js`
   - `icons/icon-192.png`
   - `icons/icon-512.png`

### 3단계: GitHub Pages 활성화
1. 저장소 → Settings → Pages
2. Source: "Deploy from a branch"
3. Branch: main / (root)
4. Save

약 1~2분 후 `https://[내GitHub아이디].github.io/dongbaek-pwa` 에서 접속 가능!

### 4단계: 폰에 설치
- 크롬에서 위 URL 접속
- 주소창 오른쪽 "⋮" → "홈 화면에 추가"
- 또는 상단에 설치 배너가 뜰 수 있음

## Gemini API 키 발급

1. https://aistudio.google.com 접속
2. 구글 계정으로 로그인
3. 왼쪽 메뉴 "Get API Key" 클릭
4. "Create API Key" 클릭
5. 키 복사
6. 앱 오른쪽 상단 ⚙️ 설정 → API 키 입력

## 사용 방법

### 회원 등록
- 실명: 김철수
- 마스킹 패턴: 김*수 (* 하나가 글자 하나를 대체)
- 월 납부액: 50000

### 캡처 인식
1. 학부모에게 동백전 결제 캡처 받기
2. 캡처 탭에서 사진 업로드 (드래그, 클릭, 또는 Ctrl+V)
3. Gemini AI가 자동으로 날짜/시간/금액/이름 추출
4. 확인 후 "내역에 저장"

### 납부 현황
- 해당 월 선택
- "자동 매칭 실행" 버튼으로 마스킹 패턴 기반 자동 매칭
- 확인필요 항목은 클릭해서 수동 매칭
- CSV 내보내기로 엑셀에서 확인 가능
