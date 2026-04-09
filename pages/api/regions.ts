import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import fs from "fs";

const REGIONS_PATH = path.join(process.cwd(), "public", "regions.json");

export interface Region {
  name: string;
  cortarNo: string;
  active: boolean;
}

function readRegions(): Region[] {
  const raw = fs.readFileSync(REGIONS_PATH, "utf-8");
  return JSON.parse(raw).regions as Region[];
}

function writeRegions(regions: Region[]) {
  fs.writeFileSync(REGIONS_PATH, JSON.stringify({ regions }, null, 2), "utf-8");
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET — 전체 목록 반환
  if (req.method === "GET") {
    return res.status(200).json({ regions: readRegions() });
  }

  // POST — 새 지역 추가
  if (req.method === "POST") {
    const { name, cortarNo } = req.body as { name: string; cortarNo: string };
    if (!name?.trim() || !cortarNo?.trim()) {
      return res.status(400).json({ error: "name과 cortarNo가 필요합니다." });
    }
    const regions = readRegions();
    if (regions.find((r) => r.cortarNo === cortarNo)) {
      return res.status(409).json({ error: "이미 등록된 지역 코드입니다." });
    }
    regions.push({ name: name.trim(), cortarNo: cortarNo.trim(), active: true });
    writeRegions(regions);
    return res.status(201).json({ regions });
  }

  // PATCH — active 토글
  if (req.method === "PATCH") {
    const { cortarNo, active } = req.body as { cortarNo: string; active: boolean };
    const regions = readRegions();
    const idx = regions.findIndex((r) => r.cortarNo === cortarNo);
    if (idx === -1) return res.status(404).json({ error: "지역을 찾을 수 없습니다." });
    regions[idx].active = active;
    writeRegions(regions);
    return res.status(200).json({ regions });
  }

  // DELETE — 지역 삭제
  if (req.method === "DELETE") {
    const { cortarNo } = req.body as { cortarNo: string };
    const regions = readRegions().filter((r) => r.cortarNo !== cortarNo);
    writeRegions(regions);
    return res.status(200).json({ regions });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
