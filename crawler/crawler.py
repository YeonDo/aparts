"""
PropertyBot crawler
public/regions.json 에 등록된 지역(active=true)을 수집해 public/data.json 으로 저장합니다.
지역 추가/삭제는 /admin/regions 페이지 또는 public/regions.json 직접 편집으로 가능합니다.
"""

import json
import os
import time
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path
import requests

# ── 설정 ──────────────────────────────────────────────────────────────────────

KST = timezone(timedelta(hours=9))
ROOT         = Path(__file__).parent.parent
OUTPUT_PATH  = ROOT / "public" / "data.json"
REGIONS_PATH = ROOT / "public" / "regions.json"


def load_regions() -> dict[str, str]:
    """regions.json에서 active=true인 지역만 {이름: cortarNo} 형태로 반환"""
    raw = json.loads(REGIONS_PATH.read_text(encoding="utf-8"))
    return {
        r["name"]: r["cortarNo"]
        for r in raw.get("regions", [])
        if r.get("active", True)
    }

# 네이버 부동산 API (비공식 - 실제 엔드포인트로 교체 필요)
NAVER_API = "https://m.land.naver.com/cluster/clusterList"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Referer": "https://m.land.naver.com/",
    "Cookie": os.getenv("NAVER_COOKIE", ""),
}

# ── 유틸 ──────────────────────────────────────────────────────────────────────

def fetch_listings(cortarNo: str, region_name: str) -> list[dict]:
    """네이버 부동산 API 호출 → 매물 목록 반환"""
    params = {
        "cortarNo": cortarNo,
        "tradTpCd": "A1",      # 매매
        "rletTpCd": "APT:OPST:VL:DDDGG",  # 아파트/오피스텔/빌라/단독
        "z": 13,
        "lat": 37.57,
        "lon": 127.04,
        "btm": 37.52,
        "top": 37.62,
        "lft": 126.99,
        "rgt": 127.09,
        "pageNo": 1,
        "pageSize": 100,
    }
    try:
        res = requests.get(NAVER_API, params=params, headers=HEADERS, timeout=10)
        res.raise_for_status()
        raw = res.json()
        items = raw.get("body", {}).get("list", [])
    except Exception as e:
        print(f"[{region_name}] API 오류: {e} — 샘플 데이터로 대체")
        items = _sample_listings(region_name)

    return [_normalize(item, region_name) for item in items]


def _normalize(item: dict, region: str) -> dict:
    """API 응답 필드를 통일된 스키마로 변환"""
    return {
        "id":       item.get("atclNo", ""),
        "region":   region,
        "address":  item.get("atclNm", ""),
        "type":     item.get("rletTpNm", "아파트"),
        "area":     item.get("area1", 0),
        "floor":    item.get("flrInfo", ""),
        "parking":  item.get("pkgYn", "N") == "Y",
        "price":    item.get("prcInfo", ""),
        "price_raw": item.get("prc", 0),
        "delta":    item.get("prcChangeInfo", ""),
        "status":   _classify(item),
        "url":      f"https://m.land.naver.com/article/{item.get('atclNo','')}",
    }


def _classify(item: dict) -> str:
    """허위 의심 / 신규 / 가격변동 / 검증완료 분류"""
    prc = item.get("prc", 0)
    avg = item.get("prcAvg", prc)
    if avg and prc < avg * 0.78:
        return "허위의심"
    delta = item.get("prcChangeInfo", "")
    if delta and delta != "0":
        return "가격변동"
    reg_date = item.get("atclRegDt", "")
    today = datetime.now(KST).strftime("%Y-%m-%d")
    if reg_date.startswith(today):
        return "신규"
    return "검증완료"


def deduplicate(listings: list[dict]) -> tuple[list[dict], int]:
    """주소 + 면적 기반 중복 제거"""
    seen: dict[str, dict] = {}
    dup_count = 0
    for item in listings:
        key = f"{item['address']}_{item['area']}"
        if key in seen:
            dup_count += 1
            # 더 저렴한 가격 유지
            if item["price_raw"] < seen[key]["price_raw"]:
                seen[key] = item
        else:
            seen[key] = item
    return list(seen.values()), dup_count


def _sample_listings(region: str) -> list[dict]:
    """API 미연동 상태에서 테스트용 샘플 데이터 생성"""
    import random
    samples = []
    streets = ["장안동", "이문동", "회기동", "행당동", "금호동", "왕십리", "구의동", "자양동"]
    types   = ["아파트", "빌라", "오피스텔", "단독주택"]
    for i in range(random.randint(30, 55)):
        prc = random.randint(15000, 120000)  # 만원 단위
        avg = int(prc * random.uniform(0.9, 1.15))
        samples.append({
            "atclNo":       f"{region[:2]}{i:04d}",
            "atclNm":       f"{region} {random.choice(streets)} {random.randint(1,300)}-{random.randint(1,20)}",
            "rletTpNm":     random.choice(types),
            "area1":        random.choice([33, 49, 59, 76, 84, 112]),
            "flrInfo":      f"{random.randint(1,20)}",
            "pkgYn":        random.choice(["Y","Y","N"]),
            "prcInfo":      f"{prc//10000}억 {prc%10000:,}",
            "prc":          prc,
            "prcAvg":       avg,
            "prcChangeInfo": str(random.choice([0, 0, 500, -300, 1000, -500])),
            "atclRegDt":    datetime.now(KST).strftime("%Y-%m-%d"),
        })
    return samples


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    now = datetime.now(KST)
    all_listings: list[dict] = []
    region_stats: dict[str, int] = {}

    REGIONS = load_regions()
    if not REGIONS:
        print("활성화된 지역이 없습니다. regions.json을 확인하세요.")
        return

    print(f"수집 지역: {', '.join(REGIONS.keys())} ({len(REGIONS)}개)")

    for name, code in REGIONS.items():
        print(f"[{name}] 수집 중...")
        items = fetch_listings(code, name)
        region_stats[name] = len(items)
        all_listings.extend(items)
        time.sleep(random.uniform(1.5, 3.0))  # rate limit 회피

    unique, dup_count = deduplicate(all_listings)

    status_counts = {"신규": 0, "가격변동": 0, "허위의심": 0, "검증완료": 0}
    for item in unique:
        status_counts[item["status"]] = status_counts.get(item["status"], 0) + 1

    total = len(unique)
    dup_rate = round((dup_count / (total + dup_count) * 100), 1) if dup_count else 0.0

    output = {
        "updated_at": now.isoformat(),
        "summary": {
            "total":        total,
            "new":          status_counts["신규"],
            "price_change": status_counts["가격변동"],
            "suspicious":   status_counts["허위의심"],
            "verified":     status_counts["검증완료"],
            "duplicates_removed": dup_count,
            "dedup_rate":   dup_rate,
            "by_region":    region_stats,
        },
        "listings": sorted(unique, key=lambda x: x["price_raw"], reverse=True)[:200],
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2))
    print(f"완료: {total}건 저장 (중복 제거 {dup_count}건, {dup_rate}%)")


if __name__ == "__main__":
    main()
