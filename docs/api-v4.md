# v4 전환 근거 (2026-11-20 확인)

공식 자료:

- https://backstage.solved.ac/ko/developer/docs#description/introduction
- https://backstage.solved.ac/api/v4/openapi
- https://solved.ac/notices/v4
- https://solved.ac/notices/261117-api

문서의 원본 OpenAPI와 공식 Backstage 클라이언트의 검색 필터 정의를 직접 확인했다. 공지 두 개는 브라우저에서 본문을 읽었다. 기존 AC 레이팅 도움말은 2025년 기준이라는 경고가 있어 최신 공지와 API 응답을 우선한다.

## 인증과 호출 제한

모든 요청은 앱의 x-client-id, x-client-secret 헤더를 요구한다. public 작업은 사용자 토큰 없이 가능하다. user 작업은 해당 scope의 Bearer 토큰이 필요하다. OAuth는 authorization code + PKCE S256 방식이지만, 공개 프로필과 타인의 풀이를 명시한 검색에는 필요하지 않다. 현재 문서에는 비로그인 검색이 모든 앱의 현 상태라고 명시돼 있어 OAuth를 우회 수단으로 가정하지 않는다.

호출 예산은 기본 600단위, 초당 2단위 충전이다. 앱과 호출자 예산을 함께 적용하고 앱 배율에 따라 변한다. 일반 요청 1, 문제 검색 3, 투표 목록 2단위다. 429의 Retry-After와 X-RateLimit-Limit/Remaining을 제공한다. 서버는 더 보수적인 60단위·초당 1단위와 동시 3요청 제한을 두고, 429 수신 시 앱 전체에 재시도 대기를 적용한다. 자동 재시도로 쿼터를 소모하지 않는다.

비로그인 검색은 100자·8항 제한이다. 임의 q를 클라이언트에서 받지 않고 서버가 제한 내 검색식을 조립한다. 목표별 여러 태그는 분석 후 서버에 저장한 짧은 개별 태그로 순차 추천한다.

## 검색과 응답

공식 필터 정의: `*` 난이도(1~30), `%ko` 한국어 문제문 존재, `@handle`/`s@handle` 특정 solved.ac 사용자의 풀이, `!`/`-`/`~` 부정, `in:boj` BOJ 수록, `solvable_in:boj` BOJ 제출 가능. `@me`는 사용자 토큰의 사용자이므로 사용하지 않는다. 없는 계정을 제외하면 아무것도 제외하지 않을 수 있으므로 프로필을 먼저 확인하고 검색 diagnostics도 검사한다.

`GET /problems?q=...&page=1&sort=level&direction=desc`는 고정 50개 페이지, `problems`, `total`, `page`, `pageSize`를 반환한다. 태그는 `key`와 `aliases`, 부모 태그를 `/tags`에서 확인한다. 문제 상세 경로는 `/problems/{problemId}?sub={subId}`다. 목록의 `id`는 내부 항목 식별자이고 `problemId`와 `subId`가 문제 세트·소문제를 나타낸다. 상세 `ojLinks`의 실제 URL을 사용하며 BOJ ID를 solved.ac ID로 추정하지 않는다.

프로필은 `/users/{handle}`이며 `ojAccounts`가 연결된 OJ 계정이다. solved.ac 핸들과 BOJ 핸들은 다를 수 있다. `tier`는 null일 수 있다. 프로필의 `rating`, `tagRatings` 및 레이팅 구성 값을 그대로 사용한다.

## 최소 구성

Vanilla JS ES 모듈 + Python 3.11 이상 표준 라이브러리 서버다. 브라우저 → 127.0.0.1 고정 서버 → solved.ac 고정 API 경로로 호출한다. 시크릿은 서버 환경변수에만 둔다. 서버는 외부 인터페이스에 바인딩하지 않으며, Host와 확장 Origin을 검사한다. 외부 URL, 임의 API 경로, 임의 검색식은 받지 않는다. 이 서버를 공용 호스팅할 경우 인증·HTTPS·서버 배포 구성을 별도로 설계해야 한다.
