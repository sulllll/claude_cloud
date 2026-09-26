# 실시간 트렌드 기록 블로그

구글 트렌드(대한민국) 인기 검색어 1~10위를 **매시간 자동 수집**해서 블로그 페이지에 보여 주고, 기록을 계속 쌓아 둡니다.

- 블로그 주소: https://sulllll.github.io/claude_cloud/
- 기록 파일: `site/data/history.json`, `site/data/history.csv`

## 구조

| 파일 | 역할 |
|---|---|
| `.github/workflows/trends.yml` | 매시간 07분(UTC) 자동 실행 → 수집 → 기록 커밋 → 블로그 배포 |
| `scripts/fetch_trends.py` | 구글 트렌드 RSS에서 TOP 10을 가져와 기록에 추가 (+ 구글 시트에도 추가, 선택) |
| `site/index.html` | 블로그 화면 (지금 TOP 10 / 시간대별 기록 / 자주 올라온 키워드) |
| `tests/test_parse.py` | 파싱·기록 쌓기 테스트 |

## 처음 한 번만 설정

1. 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 변경
2. **Actions** 탭 → `Trends to blog` → **Run workflow** 클릭

## (선택) 구글 시트에도 쌓기

1. Google Cloud에서 서비스 계정을 만들고 JSON 키를 받는다 (Google Sheets API 사용 설정)
2. 구글 시트를 서비스 계정 이메일(`...@...iam.gserviceaccount.com`)에 **편집자**로 공유
3. 저장소 **Settings → Secrets and variables → Actions** 에 `GOOGLE_SERVICE_ACCOUNT_JSON` 이름으로 JSON 내용 전체를 등록
4. 다른 시트를 쓰려면 같은 화면 Variables 탭에 `SHEET_ID` 추가 (기본값은 처음 준 시트)

## 로컬 테스트

```bash
python -m unittest discover -s tests -v
python scripts/fetch_trends.py
```
