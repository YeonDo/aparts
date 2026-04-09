# PropertyBot Dashboard

동대문구 / 성동구 / 광진구 매물을 매일 자동 수집해 Vercel에 배포하는 파이프라인입니다.

## 구조

```
propertybot/
├── pages/index.tsx          # Next.js 대시보드 UI
├── styles/Dashboard.module.css
├── public/data.json         # 크롤러가 매일 갱신
├── crawler/
│   ├── crawler.py           # 네이버 부동산 수집 스크립트
│   └── requirements.txt
└── .github/workflows/
    └── daily.yml            # GitHub Actions 스케줄러
```

## 배포 방법 (5단계)

### 1. GitHub 레포 생성
```bash
git init && git add . && git commit -m "init"
gh repo create propertybot --public --push
```

### 2. Vercel 연결
1. https://vercel.com/new 에서 GitHub 레포 import
2. Framework: **Next.js** 자동 감지
3. Deploy 클릭 → URL 발급

### 3. GitHub Secrets 설정
`Settings → Secrets → New repository secret`
- `NAVER_COOKIE`: 네이버 로그인 후 브라우저 쿠키값

### 4. Vercel 토큰 추가 (선택 - 강제 재배포 트리거용)
```
VERCEL_TOKEN: vercel.com/account/tokens 에서 발급
```

### 5. 첫 수동 실행
GitHub → Actions 탭 → "Daily PropertyBot Crawl" → Run workflow

## 로컬 테스트

```bash
# 크롤러 테스트
cd crawler && pip install -r requirements.txt
python crawler.py

# 대시보드 로컬 실행
npm install && npm run dev
# → http://localhost:3000
```

## 네이버 쿠키 갱신 주기

네이버 세션 쿠키는 약 30일마다 만료됩니다.
만료 시 크롤러가 샘플 데이터로 폴백하며, GitHub Actions 로그에 경고가 표시됩니다.
`NAVER_COOKIE` Secret을 새 값으로 업데이트하면 자동 복구됩니다.
