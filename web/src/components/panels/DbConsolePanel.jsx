// DB 콘솔 — 쿼리 입력 + 결과 표(HTML table). raw 터미널은 [표|터미널] 토글로 같이 제공.
// 표 모드가 기본: CLI ASCII 표가 패널 폭에서 깨지는 문제를 백엔드가 구조화 결과로 돌려
// 직접 렌더해서 해결(가로 스크롤·sticky 헤더). 트랜잭션/USE 같은 세션 상태가 필요하면 터미널.
import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Play, Search, Table2, TerminalSquare, X } from "lucide-react";
import { runDbQuery } from "../../api/deploy.js";
import DbTerminalPanel from "./DbTerminalPanel.jsx";

export default function DbConsolePanel() {
  const [mode, setMode] = useState("table"); // "table" | "terminal"

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* 헤더 + 모드 토글 */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="text-[11px] text-fg-3" style={{ fontWeight: 510 }}>
          DB 콘솔
        </span>
        <div className="ml-auto flex items-center gap-0.5 p-0.5 rounded-md" style={{ background: "rgba(255,255,255,0.04)" }}>
          <ToggleBtn active={mode === "table"} onClick={() => setMode("table")} icon={Table2} label="표" />
          <ToggleBtn active={mode === "terminal"} onClick={() => setMode("terminal")} icon={TerminalSquare} label="터미널" />
        </div>
      </div>

      {/* 두 모드 모두 마운트 유지 — 터미널 WebSocket이 토글 시 끊기지 않게 display로 전환 */}
      <div className="flex-1 min-h-0 flex flex-col" style={{ display: mode === "table" ? "flex" : "none" }}>
        <QueryConsole />
      </div>
      <div className="flex-1 min-h-0 flex flex-col" style={{ display: mode === "terminal" ? "flex" : "none" }}>
        <DbTerminalPanel bare />
      </div>
    </div>
  );
}

function PageBtn({ icon: Icon, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-0.5 rounded transition-colors"
      style={{
        color: disabled ? "#4a4f57" : "#aeb3bd",
        cursor: disabled ? "default" : "pointer",
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.color = "#dde0e4"; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.color = "#aeb3bd"; }}
    >
      <Icon size={13} strokeWidth={2} />
    </button>
  );
}

function ToggleBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors"
      style={{
        background: active ? "rgba(129,139,224,0.18)" : "transparent",
        color: active ? "#c4c9f5" : "#8a8f98",
        fontWeight: 510,
      }}
    >
      <Icon size={11} strokeWidth={1.8} />
      {label}
    </button>
  );
}

function QueryConsole() {
  const [sql, setSql] = useState("");
  const [result, setResult] = useState(null); // { columns, rows, row_count, truncated, duration_ms, message, db_type }
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState(""); // 받아온 결과 안에서 셀 부분일치 필터
  const [executedSql, setExecutedSql] = useState(""); // 실제 실행/페이징 중인 쿼리(textarea 편집과 분리)
  const taRef = useRef(null);

  // 한 페이지 fetch — 실행(offset 0)과 페이지 이동이 공유.
  const fetchPage = async (q, offset) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await runDbQuery(q, offset);
      setResult(res);
      setExecutedSql(q);
    } catch (e) {
      setError(e.message || "쿼리 실패");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const run = () => {
    const q = sql.trim();
    if (!q || loading) return;
    setFilter(""); // 새 쿼리마다 필터 초기화
    fetchPage(q, 0);
  };

  // 필터 적용 — 모든 셀 중 하나라도 검색어를 포함하면 통과(대소문자 무시).
  const hasTable = result && result.columns && result.columns.length > 0;
  const filteredRows = useMemo(() => {
    if (!hasTable) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return result.rows;
    return result.rows.filter((r) =>
      r.some((v) => (v ?? "").toLowerCase().includes(q))
    );
  }, [hasTable, result, filter]);

  // 여러 페이지에 걸친 결과인지 — 이전/다음 버튼 + "페이지당 N개" 힌트 노출 조건.
  const multiPage = hasTable && result.paginated && (result.offset > 0 || result.has_more);

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      run();
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col" style={{ background: "#0a0a0b" }}>
      {/* 결과 영역 (위) */}
      <div className="flex-1 min-h-0 overflow-auto scroll-thin">
        <ResultView
          result={result}
          rows={filteredRows}
          filterActive={hasTable && filter.trim() !== ""}
          error={error}
          loading={loading}
        />
      </div>

      {/* 상태 줄 (검색 + 카운트) */}
      {result && !error && (
        <div
          className="flex items-center gap-3 px-3 py-1 shrink-0 text-[10.5px] text-fg-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          {hasTable && (
            <div className="flex items-center gap-1.5">
              <Search size={11} strokeWidth={1.8} className="text-fg-4" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="결과 내 검색"
                spellCheck={false}
                className="bg-transparent outline-none text-[11px] w-32"
                style={{ color: "#dde0e4" }}
              />
              {filter && (
                <button onClick={() => setFilter("")} className="text-fg-4 hover:text-fg-1">
                  <X size={10} strokeWidth={2} />
                </button>
              )}
            </div>
          )}
          <span>
            {result.message
              ? result.message
              : filter.trim()
                ? `${filteredRows.length} / ${result.row_count}행`
                : multiPage
                  ? `${result.offset + 1}–${result.offset + result.row_count}행`
                  : `${result.row_count}행`}
          </span>
          {multiPage && (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5">
                <PageBtn
                  icon={ChevronLeft}
                  disabled={loading || result.offset === 0}
                  onClick={() => fetchPage(executedSql, Math.max(0, result.offset - result.page_size))}
                />
                <PageBtn
                  icon={ChevronRight}
                  disabled={loading || !result.has_more}
                  onClick={() => fetchPage(executedSql, result.offset + result.page_size)}
                />
              </div>
              <span>페이지당 {result.page_size}개</span>
            </div>
          )}
          {result.truncated && (
            <span style={{ color: "#d9a441" }}>· 상위 {result.row_count}행만 표시 (페이징 불가)</span>
          )}
          <span className="ml-auto">{result.duration_ms}ms · {result.db_type}</span>
        </div>
      )}

      {/* 쿼리 입력 (아래) */}
      <div className="shrink-0 flex flex-col" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <textarea
          ref={taRef}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          placeholder="SELECT * FROM ...   (⌘/Ctrl+Enter 로 실행)"
          className="w-full resize-none px-3 py-2 text-[12.5px] outline-none scroll-thin"
          style={{
            height: 96,
            background: "#0c0d0e",
            color: "#dde0e4",
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            lineHeight: 1.5,
          }}
        />
        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className="text-[10.5px] text-fg-4">⌘/Ctrl + Enter</span>
          <button
            onClick={run}
            disabled={loading || !sql.trim()}
            className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] transition-colors"
            style={{
              background: loading || !sql.trim() ? "rgba(129,139,224,0.15)" : "#5b63b8",
              color: loading || !sql.trim() ? "#8a8f98" : "#fff",
              fontWeight: 510,
              cursor: loading || !sql.trim() ? "default" : "pointer",
            }}
          >
            <Play size={11} strokeWidth={2} fill="currentColor" />
            {loading ? "실행 중…" : "실행"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultView({ result, rows, filterActive, error, loading }) {
  if (loading && !result) {
    return <Centered text="실행 중…" />;
  }
  if (error) {
    return (
      <div className="p-3">
        <pre
          className="text-[12px] whitespace-pre-wrap rounded-md p-3"
          style={{
            background: "rgba(224,108,117,0.08)",
            color: "#e8a7ad",
            border: "1px solid rgba(224,108,117,0.2)",
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
        >
          {error}
        </pre>
      </div>
    );
  }
  if (!result) {
    return <Centered text="쿼리를 입력하고 실행하세요" />;
  }
  if (!result.columns || result.columns.length === 0) {
    return <Centered text={result.message || "결과 없음"} />;
  }
  if (rows.length === 0) {
    return <Centered text={filterActive ? "검색 결과 없음" : "0 rows"} />;
  }
  return <ResultTable columns={result.columns} rows={rows} />;
}

// nullish(빈값 / mysql "NULL")는 방향과 무관하게 항상 아래로.
function _isNullish(v) {
  return v === "" || v === "NULL";
}

// 두 값 비교 — 양쪽 다 숫자로 파싱되면 수치 비교, 아니면 사전식.
function _cmp(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (a !== "" && b !== "" && Number.isFinite(na) && Number.isFinite(nb)) {
    return na - nb;
  }
  return a.localeCompare(b, undefined, { numeric: true });
}

function ResultTable({ columns, rows }) {
  // sort: { col: number, dir: "asc" | "desc" } | null. 헤더 클릭 = asc → desc → 원래순.
  const [sort, setSort] = useState(null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const { col, dir } = sort;
    const sign = dir === "asc" ? 1 : -1;
    // 원본 보존(rows는 prop) — 복사 후 정렬.
    return [...rows].sort((ra, rb) => {
      const a = ra[col] ?? "";
      const b = rb[col] ?? "";
      const an = _isNullish(a);
      const bn = _isNullish(b);
      if (an && bn) return 0;
      if (an) return 1; // nullish는 항상 끝
      if (bn) return -1;
      return _cmp(a, b) * sign;
    });
  }, [rows, sort]);

  const onSort = (col) => {
    setSort((prev) => {
      if (!prev || prev.col !== col) return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return null; // desc 다음 클릭 → 원래 순서로
    });
  };

  return (
    <table className="text-[12px]" style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
      <thead>
        <tr>
          {columns.map((c, i) => {
            const active = sort && sort.col === i;
            return (
              <th
                key={i}
                onClick={() => onSort(i)}
                title="클릭하면 정렬 (오름 → 내림 → 해제)"
                className="text-left px-3 py-1.5 sticky top-0 select-none cursor-pointer"
                style={{
                  background: "#141517",
                  color: active ? "#c4c9f5" : "#aeb3bd",
                  fontWeight: 560,
                  borderBottom: "1px solid rgba(255,255,255,0.12)",
                  borderRight: "1px solid rgba(255,255,255,0.04)",
                  whiteSpace: "nowrap",
                }}
              >
                <span className="inline-flex items-center gap-1">
                  {c}
                  {active && (sort.dir === "asc"
                    ? <ChevronUp size={12} strokeWidth={2} />
                    : <ChevronDown size={12} strokeWidth={2} />)}
                </span>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row, ri) => (
          <tr key={ri} style={{ background: ri % 2 ? "rgba(255,255,255,0.015)" : "transparent" }}>
            {row.map((val, ci) => (
              <td
                key={ci}
                title={val}
                className="px-3 py-1"
                style={{
                  color: "#dde0e4",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  borderRight: "1px solid rgba(255,255,255,0.03)",
                  whiteSpace: "nowrap",
                  maxWidth: 420,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                }}
              >
                {val === "NULL" ? <span style={{ color: "#5c6370", fontStyle: "italic" }}>NULL</span> : val}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Centered({ text }) {
  return (
    <div className="h-full flex items-center justify-center">
      <span className="text-[12px] text-fg-4">{text}</span>
    </div>
  );
}
