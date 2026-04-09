import type { NextApiRequest, NextApiResponse } from "next";

// 네이버 부동산 법정동 코드 검색 프록시
// 실제 운영 시 네이버 지역 검색 API로 교체 가능
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const { q } = req.query as { q: string };
  if (!q?.trim()) return res.status(400).json({ error: "검색어를 입력하세요." });

  try {
    // 네이버 부동산 지역 검색 API (비공식)
    const url = `https://m.land.naver.com/search/searchAddressHighlight?query=${encodeURIComponent(q)}`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Referer": "https://m.land.naver.com/",
      },
    });
    const data = await resp.json();

    // 구/시/동 단위만 필터링
    const results = (data.result || [])
      .filter((item: { cortarNo: string }) =>
        item.cortarNo && item.cortarNo.length >= 5
      )
      .slice(0, 8)
      .map((item: { cortarName: string; cortarNo: string; cortarAddress?: string }) => ({
        name:    item.cortarName,
        cortarNo: item.cortarNo,
        address:  item.cortarAddress || "",
      }));

    return res.status(200).json({ results });
  } catch {
    // API 실패 시 내장 코드 테이블에서 검색
    const fallback = KNOWN_REGIONS.filter(
      (r) => r.name.includes(q) || r.address.includes(q)
    ).slice(0, 8);
    return res.status(200).json({ results: fallback });
  }
}

// 주요 서울 자치구 내장 코드 (API 폴백용)
const KNOWN_REGIONS = [
  { name: "강남구",   cortarNo: "11680", address: "서울특별시 강남구" },
  { name: "강동구",   cortarNo: "11740", address: "서울특별시 강동구" },
  { name: "강북구",   cortarNo: "11305", address: "서울특별시 강북구" },
  { name: "강서구",   cortarNo: "11500", address: "서울특별시 강서구" },
  { name: "관악구",   cortarNo: "11620", address: "서울특별시 관악구" },
  { name: "광진구",   cortarNo: "11215", address: "서울특별시 광진구" },
  { name: "구로구",   cortarNo: "11530", address: "서울특별시 구로구" },
  { name: "금천구",   cortarNo: "11545", address: "서울특별시 금천구" },
  { name: "노원구",   cortarNo: "11350", address: "서울특별시 노원구" },
  { name: "도봉구",   cortarNo: "11320", address: "서울특별시 도봉구" },
  { name: "동대문구", cortarNo: "11230", address: "서울특별시 동대문구" },
  { name: "동작구",   cortarNo: "11590", address: "서울특별시 동작구" },
  { name: "마포구",   cortarNo: "11440", address: "서울특별시 마포구" },
  { name: "서대문구", cortarNo: "11410", address: "서울특별시 서대문구" },
  { name: "서초구",   cortarNo: "11650", address: "서울특별시 서초구" },
  { name: "성동구",   cortarNo: "11200", address: "서울특별시 성동구" },
  { name: "성북구",   cortarNo: "11290", address: "서울특별시 성북구" },
  { name: "송파구",   cortarNo: "11710", address: "서울특별시 송파구" },
  { name: "양천구",   cortarNo: "11470", address: "서울특별시 양천구" },
  { name: "영등포구", cortarNo: "11560", address: "서울특별시 영등포구" },
  { name: "용산구",   cortarNo: "11170", address: "서울특별시 용산구" },
  { name: "은평구",   cortarNo: "11380", address: "서울특별시 은평구" },
  { name: "종로구",   cortarNo: "11110", address: "서울특별시 종로구" },
  { name: "중구",     cortarNo: "11140", address: "서울특별시 중구" },
  { name: "중랑구",   cortarNo: "11260", address: "서울특별시 중랑구" },
  { name: "수원시",   cortarNo: "41110", address: "경기도 수원시" },
  { name: "성남시",   cortarNo: "41130", address: "경기도 성남시" },
  { name: "부천시",   cortarNo: "41190", address: "경기도 부천시" },
  { name: "안양시",   cortarNo: "41170", address: "경기도 안양시" },
  { name: "고양시",   cortarNo: "41280", address: "경기도 고양시" },
  { name: "용인시",   cortarNo: "41460", address: "경기도 용인시" },
];
