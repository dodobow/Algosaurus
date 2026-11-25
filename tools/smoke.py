"""실행 중인 로컬 서버를 통해 실제 v4 계정·추천 흐름을 검증한다."""
import argparse
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen


def get(path, **params):
    try:
        with urlopen('http://127.0.0.1:8765' + path + '?' + urlencode(params), timeout=100) as response:
            return json.load(response)
    except HTTPError as exc:
        try:
            error = json.load(exc)['error']
            raise SystemExit(f"{exc.code} {error['code']}: {error['message']} (retryAfter={error.get('retryAfter')})") from None
        finally:
            exc.close()
    except URLError:
        raise SystemExit('로컬 서버를 먼저 실행해 줘: python -m server.app') from None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('handle', help='solved.ac 핸들')
    parser.add_argument('--goal', choices=['beginner', 'job', 'contest'], default='contest')
    parser.add_argument('--difficulty', type=int, choices=range(-2, 3), default=0)
    parser.add_argument('--analysis', action='store_true')
    args = parser.parse_args()
    profile = get('/api/profile', handle=args.handle)
    boj = ', '.join(account['handle'] for account in profile['ojAccounts'] if account['ojId'] == 'boj') or '(없음)'
    print(f"solved.ac={profile['handle']} BOJ={boj} tier={profile['tier']} rating={profile['rating']}")
    params = dict(handle=profile['handle'], goal=args.goal, difficulty=args.difficulty, mode='default')
    recommendation = get('/api/recommend', **params)
    print('recommendation=' + json.dumps(recommendation, ensure_ascii=False))
    if args.analysis:
        analysis = get('/api/analysis', **params)
        print('analysis=' + json.dumps(analysis, ensure_ascii=False))
        print('weak=' + json.dumps(get('/api/recommend', **params, weak='true'), ensure_ascii=False))


if __name__ == '__main__':
    main()
