import type { NextPage, GetServerSideProps } from "next";
import Head from "next/head";
import { useState, useRef } from "react";
import Link from "next/link";
import path from "path";
import fs from "fs";
import type { Region } from "./api/regions";
import styles from "../styles/RegionAdmin.module.css";

interface SearchResult {
  name: string;
  cortarNo: string;
  address: string;
}

interface Props {
  initialRegions: Region[];
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const filePath = path.join(process.cwd(), "public", "regions.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const { regions } = JSON.parse(raw);
  return { props: { initialRegions: regions } };
};

const RegionAdmin: NextPage<Props> = ({ initialRegions }) => {
  const [regions, setRegions]           = useState<Region[]>(initialRegions);
  const [query, setQuery]               = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching]       = useState(false);
  const [toast, setToast]               = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 토스트 ──────────────────────────────────────────────────────────────────
  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ── 지역 검색 (디바운스 300ms) ───────────────────────────────────────────────
  function handleQueryChange(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search-region?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        // 이미 등록된 지역 제외
        const registered = new Set(regions.map((r) => r.cortarNo));
        setSearchResults((data.results || []).filter((r: SearchResult) => !registered.has(r.cortarNo)));
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  // ── 지역 추가 ────────────────────────────────────────────────────────────────
  async function addRegion(result: SearchResult) {
    const res = await fetch("/api/regions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: result.name, cortarNo: result.cortarNo }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error, "err"); return; }
    setRegions(data.regions);
    setQuery("");
    setSearchResults([]);
    showToast(`${result.name} 추가됨`);
  }

  // ── 활성화 토글 ──────────────────────────────────────────────────────────────
  async function toggleRegion(cortarNo: string, active: boolean) {
    const res = await fetch("/api/regions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cortarNo, active }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error, "err"); return; }
    setRegions(data.regions);
  }

  // ── 지역 삭제 ────────────────────────────────────────────────────────────────
  async function deleteRegion(cortarNo: string) {
    const res = await fetch("/api/regions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cortarNo }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error, "err"); return; }
    setRegions(data.regions);
    setPendingDelete(null);
    showToast("삭제됨");
  }

  const activeCount = regions.filter((r) => r.active).length;

  return (
    <>
      <Head>
        <title>지역 관리 · PropertyBot</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* 토스트 */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === "err" ? styles.toastErr : styles.toastOk}`}>
          {toast.msg}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {pendingDelete && (
        <div className={styles.modalBack}>
          <div className={styles.modal}>
            <p className={styles.modalTitle}>지역을 삭제할까요?</p>
            <p className={styles.modalSub}>
              {regions.find((r) => r.cortarNo === pendingDelete)?.name} — 다음 크롤링부터 수집이 중단됩니다.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.btnGhost} onClick={() => setPendingDelete(null)}>취소</button>
              <button className={styles.btnDanger} onClick={() => deleteRegion(pendingDelete)}>삭제</button>
            </div>
          </div>
        </div>
      )}

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
          </div>
          <Link href="/" className={styles.backLink}>← 대시보드로</Link>
        </header>

        <div className={styles.pageTitle}>
          <h1>검색 지역 관리</h1>
          <span className={styles.countBadge}>
            활성 {activeCount} / 전체 {regions.length}개 지역
          </span>
        </div>

        {/* 검색 */}
        <section className={styles.card}>
          <div className={styles.cardTitle}>지역 추가</div>
          <div className={styles.searchWrap}>
            <div className={styles.inputWrap}>
              <svg className={styles.searchIcon} viewBox="0 0 16 16" width="14" height="14">
                <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="10" y1="10" x2="14" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <input
                className={styles.searchInput}
                type="text"
                placeholder="구/시 이름으로 검색 (예: 마포구, 수원시)"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
              />
              {searching && <span className={styles.spinner} />}
              {query && (
                <button className={styles.clearBtn} onClick={() => { setQuery(""); setSearchResults([]); }}>
                  ✕
                </button>
              )}
            </div>

            {/* 검색 결과 드롭다운 */}
            {searchResults.length > 0 && (
              <ul className={styles.dropdown}>
                {searchResults.map((r) => (
                  <li key={r.cortarNo} className={styles.dropItem} onClick={() => addRegion(r)}>
                    <div className={styles.dropName}>{r.name}</div>
                    <div className={styles.dropAddr}>{r.address}</div>
                    <span className={styles.dropAdd}>+ 추가</span>
                  </li>
                ))}
              </ul>
            )}
            {query && !searching && searchResults.length === 0 && (
              <div className={styles.noResult}>검색 결과가 없습니다.</div>
            )}
          </div>

          <p className={styles.hint}>
            변경사항은 다음 크롤링(매일 오전 8시)부터 반영됩니다.
            GitHub Actions에서 수동 실행하면 즉시 적용됩니다.
          </p>
        </section>

        {/* 등록된 지역 목록 */}
        <section className={styles.card}>
          <div className={styles.cardTitle}>등록된 지역</div>
          {regions.length === 0 && (
            <div className={styles.empty}>등록된 지역이 없습니다. 위에서 추가하세요.</div>
          )}
          <ul className={styles.regionList}>
            {regions.map((r) => (
              <li key={r.cortarNo} className={`${styles.regionItem} ${!r.active ? styles.inactive : ""}`}>
                <div className={styles.regionInfo}>
                  <span className={styles.regionName}>{r.name}</span>
                  <span className={styles.regionCode}>코드 {r.cortarNo}</span>
                </div>
                <div className={styles.regionActions}>
                  {/* 활성/비활성 토글 */}
                  <label className={styles.toggle} title={r.active ? "클릭하면 비활성화" : "클릭하면 활성화"}>
                    <input
                      type="checkbox"
                      checked={r.active}
                      onChange={(e) => toggleRegion(r.cortarNo, e.target.checked)}
                    />
                    <span className={styles.toggleTrack}>
                      <span className={styles.toggleThumb} />
                    </span>
                    <span className={styles.toggleLabel}>{r.active ? "수집 중" : "비활성"}</span>
                  </label>
                  {/* 삭제 버튼 */}
                  <button
                    className={styles.deleteBtn}
                    onClick={() => setPendingDelete(r.cortarNo)}
                    title="지역 삭제"
                  >
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3">
                      <path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5L11 4"/>
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 수동 실행 안내 */}
        <section className={styles.card}>
          <div className={styles.cardTitle}>즉시 반영하기</div>
          <p className={styles.hint} style={{ marginBottom: "10px" }}>
            지역을 추가·삭제한 뒤 바로 크롤링을 실행하려면 GitHub Actions에서 수동으로 트리거하세요.
          </p>
          <a
            href="https://github.com/YOUR_USERNAME/propertybot/actions/workflows/daily.yml"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.actionLink}
          >
            GitHub Actions에서 수동 실행 →
          </a>
        </section>
      </main>
    </>
  );
};

export default RegionAdmin;
