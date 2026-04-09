import type { GetStaticProps, NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import path from "path";
import fs from "fs";
import styles from "../styles/Dashboard.module.css";

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface Listing {
  id: string;
  region: string;
  address: string;
  type: string;
  area: number;
  floor: string;
  parking: boolean;
  price: string;
  price_raw: number;
  delta: string;
  status: "신규" | "가격변동" | "허위의심" | "검증완료";
  url: string;
}

interface Summary {
  total: number;
  new: number;
  price_change: number;
  suspicious: number;
  verified: number;
  duplicates_removed: number;
  dedup_rate: number;
  by_region: Record<string, number>;
}

interface Props {
  updatedAt: string;
  summary: Summary;
  listings: Listing[];
  activeRegions: string[];
}

// ── 정적 데이터 로딩 ──────────────────────────────────────────────────────────

export const getStaticProps: GetStaticProps<Props> = async () => {
  const filePath = path.join(process.cwd(), "public", "data.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);

  const regionsPath = path.join(process.cwd(), "public", "regions.json");
  const regionsRaw = fs.readFileSync(regionsPath, "utf-8");
  const { regions } = JSON.parse(regionsRaw);
  const activeRegions = regions.filter((r: { active: boolean }) => r.active).map((r: { name: string }) => r.name);

  return {
    props: {
      updatedAt: data.updated_at,
      summary:   data.summary,
      listings:  data.listings.slice(0, 50),
      activeRegions,
    },
  };
};

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

const STATUS_CLASS: Record<string, string> = {
  "신규":     styles.tagNew,
  "가격변동": styles.tagPrice,
  "허위의심": styles.tagDup,
  "검증완료": styles.tagOk,
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

const Dashboard: NextPage<Props> = ({ updatedAt, summary, listings, activeRegions }) => {
  const maxRegion = Math.max(...Object.values(summary.by_region));

  return (
    <>
      <Head>
        <title>PropertyBot · 일일 매물 리포트</title>
        <meta name="description" content={`${activeRegions.join("/")} 자동 수집 매물 리포트`} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className={styles.main}>
        {/* 헤더 */}
        <header className={styles.topbar}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>
              <svg viewBox="0 0 16 16" width="16" height="16" fill="white">
                <path d="M8 1L1 6v9h5v-5h4v5h5V6z"/>
              </svg>
            </span>
            PropertyBot
            <span className={styles.badgeLive}>실시간</span>
          </div>
          <div className={styles.headerRight}>
            <span className={styles.meta}>
              {fmtDate(updatedAt)} · {activeRegions.join(" / ")}
            </span>
            <Link href="/admin/regions" className={styles.manageLink}>
              지역 관리
            </Link>
          </div>
        </header>

        {/* 지표 카드 */}
        <section className={styles.metrics}>
          <div className={styles.metric}>
            <div className={styles.mLabel}>오늘 수집 매물</div>
            <div className={styles.mValue}>{summary.total}</div>
            <div className={`${styles.mSub} ${styles.up}`}>목표 100건 {summary.total >= 100 ? "✓" : `(${summary.total}/100)`}</div>
          </div>
          <div className={styles.metric}>
            <div className={styles.mLabel}>중복 제거율</div>
            <div className={styles.mValue}>{summary.dedup_rate}%</div>
            <div className={`${styles.mSub} ${summary.dedup_rate >= 95 ? styles.up : styles.down}`}>
              목표 95% {summary.dedup_rate >= 95 ? "초과" : "미달"}
            </div>
          </div>
          <div className={styles.metric}>
            <div className={styles.mLabel}>신규 매물</div>
            <div className={styles.mValue}>{summary.new}</div>
            <div className={styles.mSub}>최근 24시간</div>
          </div>
          <div className={styles.metric}>
            <div className={styles.mLabel}>허위 의심</div>
            <div className={styles.mValue}>{summary.suspicious}</div>
            <div className={`${styles.mSub} ${summary.suspicious > 0 ? styles.down : styles.up}`}>
              {summary.suspicious > 0 ? "검토 필요" : "이상 없음"}
            </div>
          </div>
        </section>

        <div className={styles.twoCol}>
          {/* 매물 목록 */}
          <section className={styles.card}>
            <div className={styles.cardTitle}>신규 매물 목록</div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>주소</th>
                  <th>정보</th>
                  <th>가격</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className={styles.addrLink}>
                        {l.address}
                      </a>
                    </td>
                    <td className={styles.detail}>
                      {l.type} · {l.area}㎡ · {l.floor}층
                      {l.parking ? " · 주차" : ""}
                    </td>
                    <td className={styles.price}>
                      <div>{l.price}</div>
                      {l.delta && l.delta !== "0" && (
                        <div className={Number(l.delta) > 0 ? styles.up : styles.down}>
                          {Number(l.delta) > 0 ? "▲" : "▼"} {Math.abs(Number(l.delta)).toLocaleString()}만
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`${styles.tag} ${STATUS_CLASS[l.status]}`}>
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 사이드 */}
          <aside className={styles.side}>
            <div className={styles.card}>
              <div className={styles.cardTitle}>지역별 수집 현황</div>
              {Object.entries(summary.by_region).map(([name, count]) => (
                <div key={name} className={styles.regionBar}>
                  <div className={styles.regionLabel}>
                    <span>{name}</span><span>{count}건</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${Math.round((count / maxRegion) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>중복 분석</div>
              <div className={styles.dupRow}>
                <div className={styles.dupCircle}>{summary.dedup_rate}%</div>
                <div>
                  <div className={styles.dupNum}>{summary.duplicates_removed}건 중복 제거</div>
                  <div className={styles.dupLabel}>주소 기반 · 면적 유사도</div>
                </div>
              </div>
              <div className={styles.dupRow}>
                <div className={`${styles.dupCircle} ${styles.dupRed}`}>의심 {summary.suspicious}</div>
                <div>
                  <div className={styles.dupNum}>허위 매물 패턴 감지</div>
                  <div className={styles.dupLabel}>시세 대비 22% 이상 낮음</div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <footer className={styles.footer}>
          PropertyBot · 자동 수집 데이터입니다. 투자 판단에 직접 사용하지 마세요.
        </footer>
      </main>
    </>
  );
};

export default Dashboard;
