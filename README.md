# 🌳🦖 알고사우루스 (Algosaurus)

solved.ac 공식 API v4를 사용하는 Vanilla JavaScript Chrome 확장이야. 프로필 조회, 목표·난이도 설정, 안 푼 BOJ 문제 추천, 태그·내실 분석과 약점 추천을 제공해.

구성은 **Chrome 확장 → localhost Python 서버 → solved.ac API v4**야. 앱 시크릿은 서버에만 두고, 사용자 OAuth는 사용하지 않아. 공개 프로필과 특정 계정의 풀이를 명시한 검색으로 필요한 기능을 구현했어.

## 준비

- Python 3.11 이상, Chrome 120 이상
- [solved.ac Backstage](https://backstage.solved.ac/developer/apps)에 등록한 앱의 Client ID와 Client Secret
- 본인의 **solved.ac 핸들**. BOJ 핸들과 다를 수 있어.
- 검증 명령을 실행하려면 Node.js 20 이상. npm 설치와 외부 패키지는 필요 없어.

## 실행과 확장 설치

```powershell
cd C:\Projects\Algosaurus
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

`.env`를 열어 `SOLVED_CLIENT_ID`와 `SOLVED_CLIENT_SECRET`을 입력한 뒤 실행해. 비밀값을 Git이나 확장 코드에 넣지 마. 기존 환경변수가 있으면 `.env`보다 우선해.

```powershell
python -m server.app
```

기본 주소는 `http://127.0.0.1:8765`야. 서버는 이 컴퓨터의 loopback에만 열리고 외부 패키지는 설치하지 않아.

1. Chrome에서 `chrome://extensions/`를 열고 개발자 모드를 켜.
2. **압축 해제된 확장 프로그램을 로드**에서 `C:\Projects\Algosaurus`를 선택해. 기존 사용자는 같은 위치의 확장을 새로고침해.
3. 팝업에 solved.ac 핸들을 입력하고 **조회**를 눌러. 기존 프로필 카드의 이름에 마우스를 올리면 solved.ac와 연결된 BOJ 핸들을 구분해서 확인할 수 있어.
4. **My Page**에서 입문·취업·대회 목표와 난이도(-2~2)를 골라. 미설정 기본값은 대회·보통이야.
5. 설정 페이지를 열면 기존 흐름대로 태그와 내실을 자동 분석해. 난이도 변경은 추천 범위만 갱신하고, 기본 태그 모드에서는 목표를 바꿔도 재분석하지 않아. 계정·태그 모드·맞춤 모드의 목표가 바뀌면 해당 분석을 불러오고, 성공한 분석은 15분간 재사용해.
6. 팝업에서 **목표 맞춤** 또는 **약점 보충**으로 추천받고 BOJ 링크를 열어.

추천은 설정 난이도, 한국어 문제문, BOJ 제출 가능 조건을 적용하고 조회한 solved.ac 사용자의 풀이를 제외해. 실제 링크는 문제 상세의 `ojLinks`에서 받아. solved.ac 문제 번호로 BOJ URL을 만들지 않아.

2026-11-25에 `dodobow`의 실제 프로필·목표 추천·약점 추천·기본/취업 맞춤 분석을 확인했고, 팝업에서 추천한 BOJ 18223번의 문제 본문까지 열었어. Chrome 저장소 대역을 사용한 화면 검증이며, 실제 확장 설치·코드 제출 검증과는 구분해.

## 설정값

| 값 | 용도 |
| --- | --- |
| `SOLVED_CLIENT_ID` | Backstage 앱 ID. 필수 |
| `SOLVED_CLIENT_SECRET` | 서버 전용 앱 시크릿. 필수 |
| `PORT` | 기본 8765. 변경하면 `shared/api.js`의 `API_BASE`도 맞춰 줘 |
| `ALLOWED_EXTENSION_IDS` | 선택. `chrome://extensions/`의 ID를 쉼표로 지정하면 해당 확장만 허용해 |

이 구성은 개인 로컬 실행용이야. 공용 서버 배포는 포함하지 않아. 배포할 때는 별도 서버 인증·HTTPS·정확한 확장 Origin과 host 권한 구성이 필요해.

## 기존 사용자

기존 `goal_<핸들>`, `diff_<핸들>`, `mode_<핸들>`을 보존해. 최초 v4 전환에서는 저장된 ID가 BOJ 핸들일 수 있으므로 solved.ac 핸들을 확인하고 직접 조회해야 해.

새 프로필의 인증된 BOJ 연결이 옛 ID와 일치하면 목표·난이도·모드를 새 solved.ac 핸들로 복사해. 이미 있는 새 설정과 옛 키는 덮어쓰거나 지우지 않아. 연결이 확인되지 않으면 기존 설정은 남겨 두고 새 계정의 기본값을 사용해. 이전 약점·티어·레이팅 합 캐시는 재사용하지 않아.

약점 추천용 분석은 서버에서 계정·태그 모드·맞춤 모드의 목표별로 15분간 유지해. 난이도 변경과 기본 모드의 목표 변경에는 그대로 사용할 수 있어. 다른 분석 조건·기한 만료·서버 재시작 뒤에는 해당 조건으로 분석해야 해. API 실패와 실제 429 대기 시간, 분석 데이터 부족, 추천 결과 없음은 화면에 구분해서 표시해.

로컬 호출 예산이 부족하면 서버에서 요청당 최대 10초간 기다려. 분석 도중 오류가 나도 검증된 성공 페이지는 15분간 재사용하므로, 재시도 때 앞부분을 다시 조회하지 않아. 프로필은 30초간 재사용해. solved.ac의 실제 429는 `Retry-After` 동안 새 외부 호출을 차단하고 남은 시간을 표시해. 오류 후에는 표시된 시간이 지난 뒤 설정 페이지를 새로고침해.

## 분석 지표

- 프로필과 기본 태그 모드의 **공식 레이팅**은 API 응답 값을 사용해. 목표 맞춤 카드의 숫자는 난이도합이고, 티어 배지·색상은 분석한 문제들의 **평균 난이도**를 반올림한 값이야. 툴팁에 평균값과 배지 기준을 표시해. 맞춤 배지는 공식 사용자·태그 티어가 아니야.
- 태그군은 상위 50개 레이팅 대상 고유 문제 세트의 **난이도합**을 비교해. 기본 8개·목표 맞춤 10개 그룹을 제공해. 평균 대비 ±10%로 강점·균형·약점을 나누며, 모두 0이면 판단 불가야.
- 내실은 상위 200개 레이팅 대상 고유 문제 세트의 난이도 균형 지표야. 같은 세트의 소문제는 가장 높은 난이도 하나로 계산해. 데이터가 부족하거나 조회가 실패하면 점수를 만들지 않아.
- 맞춤 지표는 공식 레이팅이나 객관적인 실력 점수가 아니야. 태그군 중첩과 범위의 영향을 받아.

변경된 레이팅·태그 키·검색·중복 처리의 근거와 정확한 계산식은 [v4 전환 설계](docs/api-v4.md)에 적어 뒀어.

## 검증

```powershell
python -m unittest discover -s tests -p 'test_*.py' -v
npm test
python tools/check.py
```

테스트는 모의 upstream과 Chrome 저장소·DOM 대역을 사용해. 실제 인증 API 검증과 구분한 결과는 [검증 기록](docs/verification.md)을 참고해.

시크릿 없이 실제 HTML/JS를 브라우저에서 확인하려면 API 서버를 끈 상태에서 다음을 실행해. 테스트 데이터만 반환하고 Chrome storage 대신 테스트용 localStorage를 사용해.

```powershell
python -m tests.dev_server
# http://127.0.0.1:8765/popup/popup.html
```

실제 API로 화면을 확인하려면 `.env`를 준비한 뒤 `python -m tests.dev_server --live`로 실행해. 이 모드도 Chrome 저장소는 테스트용 localStorage로 대체하므로 실제 확장 설치 검증은 아니야. 모의 서버와 실제 서버는 모두 같은 8765 포트를 사용하니 하나씩 실행해.

인증정보가 설정된 실제 서버를 실행한 뒤에는 다음으로 프로필·추천을 확인할 수 있어.

```powershell
python tools/smoke.py <solved.ac_핸들> --goal job --difficulty 1
python tools/smoke.py <solved.ac_핸들> --analysis
```

## 확장 배포 파일

```powershell
python tools/package_extension.py
```

`.local/Algosaurus-extension.zip`에 manifest·팝업·설정·공통 모듈·아이콘만 담아. 서버, `.env`, 테스트, 로컬 백업은 포함하지 않아. 이 ZIP을 풀어 확장으로 설치할 수 있어. 기존 설치 경로를 바꾸면 Chrome의 확장 ID와 저장소가 달라질 수 있으므로 기존 사용자는 같은 경로에서 갱신해.

## 공식 문서

- [API v4 문서](https://backstage.solved.ac/ko/developer/docs#description/introduction)
- [v4 변경 공지](https://solved.ac/notices/v4)
- [공식 API 제공 안내](https://solved.ac/notices/261117-api)

MIT License.
