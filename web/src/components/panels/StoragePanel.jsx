// 스토리지 패널 — R2 버킷 객체 목록. 업로드는 유저 앱이 하고(KoDeploy는 자격증명만 주입),
// 여기서는 올라온 객체를 보여주기/주소복사/삭제만 한다. 이미지면 썸네일 미리보기, 아니면
// 파일 아이콘 + 다운로드. 버킷엔 이미지 외 객체도 있을 수 있어 전부 표시(이미지만 미리보기).
import { useCallback, useEffect, useState } from "react";
import {
  Copy,
  Check,
  Download,
  File as FileIcon,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { listStorageObjects, deleteStorageObject } from "../../api/deploy.js";

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif", ".bmp", ".ico"];

function isImage(key) {
  const k = key.toLowerCase();
  return IMAGE_EXTS.some((ext) => k.endsWith(ext));
}

function fmtBytes(n) {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function StoragePanel() {
  const [objects, setObjects] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");
  const [preview, setPreview] = useState(null); // 라이트박스로 크게 볼 객체
  const [loaded, setLoaded] = useState(false);

  // 첫 페이지 로드 / 새로고침 — objects 초기화 후 처음부터.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listStorageObjects(null);
      setObjects(res.objects || []);
      setNext(res.next || null);
    } catch (e) {
      setError(e.message || "목록 조회 실패");
      setObjects([]);
      setNext(null);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  // 다음 페이지 — 기존 목록에 이어붙임.
  const loadMore = async () => {
    if (!next || loading) return;
    setLoading(true);
    try {
      const res = await listStorageObjects(next);
      setObjects((prev) => [...prev, ...(res.objects || [])]);
      setNext(res.next || null);
    } catch (e) {
      setError(e.message || "목록 조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const onDeleted = (key) => {
    setObjects((prev) => prev.filter((o) => o.key !== key));
    setPreview((p) => (p && p.key === key ? null : p));
  };

  const q = filter.trim().toLowerCase();
  const shown = q ? objects.filter((o) => o.key.toLowerCase().includes(q)) : objects;

  return (
    <div className="relative flex-1 min-h-0 flex flex-col" style={{ background: "#0a0a0b" }}>
      {/* 헤더 */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="text-[11px] text-fg-3" style={{ fontWeight: 510 }}>
          스토리지
        </span>
        {loaded && !error && (
          <span className="text-[10.5px] text-fg-4">{objects.length}개</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="이름 검색"
              spellCheck={false}
              className="bg-transparent outline-none text-[11px] w-28"
              style={{ color: "#dde0e4" }}
            />
            {filter && (
              <button onClick={() => setFilter("")} className="text-fg-4 hover:text-fg-1">
                <X size={10} strokeWidth={2} />
              </button>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-1 rounded hover:bg-white/[0.06] text-fg-4 hover:text-fg-1 transition-colors"
            title="새로고침"
          >
            <RefreshCw size={12} strokeWidth={1.8} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 min-h-0 overflow-auto scroll-thin p-3">
        {error ? (
          <Centered>
            <span className="text-[12px]" style={{ color: "#e8a7ad" }}>{error}</span>
          </Centered>
        ) : !loaded && loading ? (
          <Centered><span className="text-[12px] text-fg-4">불러오는 중…</span></Centered>
        ) : shown.length === 0 ? (
          <Centered>
            <span className="text-[12px] text-fg-4">
              {q ? "검색 결과 없음" : "객체가 없습니다"}
            </span>
          </Centered>
        ) : (
          <>
            <div
              className="grid gap-2.5"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}
            >
              {shown.map((o) => (
                <ObjectCard
                  key={o.key}
                  obj={o}
                  onPreview={() => isImage(o.key) && o.url && setPreview(o)}
                  onDeleted={onDeleted}
                />
              ))}
            </div>
            {next && !q && (
              <div className="flex justify-center pt-3">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-3 py-1 rounded-md text-[11.5px] transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    color: "#aeb3bd",
                    fontWeight: 510,
                    cursor: loading ? "default" : "pointer",
                  }}
                >
                  {loading ? "불러오는 중…" : "더 보기"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {preview && <Lightbox obj={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function ObjectCard({ obj, onPreview, onDeleted }) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const img = isImage(obj.key) && obj.url;
  const name = obj.key.split("/").pop();

  const copy = async () => {
    if (!obj.url) return;
    try {
      await navigator.clipboard.writeText(obj.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard 거부 — 조용히 무시 */
    }
  };

  const del = async () => {
    setDeleting(true);
    try {
      await deleteStorageObject(obj.key);
      onDeleted(obj.key);
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <div
      className="rounded-lg overflow-hidden flex flex-col"
      style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
    >
      {/* 미리보기 영역 */}
      <button
        onClick={onPreview}
        className="relative flex items-center justify-center h-[110px] overflow-hidden"
        style={{ background: "#0c0d0e", cursor: img ? "zoom-in" : "default" }}
      >
        {img ? (
          <img
            src={obj.url}
            alt={name}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextSibling.style.display = "flex";
            }}
          />
        ) : null}
        <div
          className="absolute inset-0 flex-col items-center justify-center gap-1 text-fg-4"
          style={{ display: img ? "none" : "flex" }}
        >
          {isImage(obj.key) ? (
            <ImageIcon size={26} strokeWidth={1.3} />
          ) : (
            <FileIcon size={26} strokeWidth={1.3} />
          )}
          {!obj.url && <span className="text-[9px] px-1 text-center">공개 URL 없음</span>}
        </div>
      </button>

      {/* 메타 + 액션 */}
      <div className="px-2 py-1.5 flex flex-col gap-1">
        <span
          className="text-[11px] truncate"
          style={{ color: "#dde0e4", fontWeight: 510 }}
          title={obj.key}
        >
          {name}
        </span>
        <div className="flex items-center justify-between">
          <span className="text-[9.5px] text-fg-4">{fmtBytes(obj.size)}</span>
          <div className="flex items-center gap-0.5">
            {obj.url && (
              <a
                href={obj.url}
                target="_blank"
                rel="noreferrer"
                download
                className="p-1 rounded text-fg-4 hover:text-fg-1 hover:bg-white/[0.06] transition-colors"
                title="다운로드 / 새 탭"
              >
                <Download size={12} strokeWidth={1.8} />
              </a>
            )}
            <button
              onClick={copy}
              disabled={!obj.url}
              className="p-1 rounded text-fg-4 hover:text-fg-1 hover:bg-white/[0.06] transition-colors disabled:opacity-40"
              title={obj.url ? "주소 복사" : "공개 URL 없음"}
            >
              {copied ? (
                <Check size={12} strokeWidth={2} style={{ color: "#6dd5a0" }} />
              ) : (
                <Copy size={12} strokeWidth={1.8} />
              )}
            </button>
            {confirming ? (
              <button
                onClick={del}
                disabled={deleting}
                className="px-1.5 py-0.5 rounded text-[9.5px] transition-colors"
                style={{ background: "rgba(224,108,117,0.18)", color: "#e8a7ad", fontWeight: 560 }}
                title="정말 삭제"
              >
                {deleting ? "삭제 중…" : "확인"}
              </button>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="p-1 rounded text-fg-4 hover:bg-white/[0.06] transition-colors"
                style={{ color: "#8a8f98" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#e06c75")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#8a8f98")}
                title="삭제"
              >
                <Trash2 size={12} strokeWidth={1.8} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Lightbox({ obj, onClose }) {
  useEffect(() => {
    // capture 단계 + preventDefault — 최상위 오버레이가 ESC를 먼저 소비해
    // 이 미리보기만 닫힘 (활동 패널 등 뒤 레이어의 ESC 핸들러는 defaultPrevented로 무시).
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 p-6"
      style={{ background: "rgba(0,0,0,0.78)" }}
      onClick={onClose}
    >
      {/* flex-1 + min-h-0 으로 남는 높이에 맞춰 줄어듦 → 큰 이미지도 전체가 보임.
          object-contain이 비율 유지하며 letterbox, max-w-full이 가로 상한. */}
      <img
        src={obj.url}
        alt={obj.key}
        onClick={(e) => e.stopPropagation()}
        className="flex-1 min-h-0 max-w-full object-contain rounded"
      />
      <span
        className="text-[11px] text-fg-3 truncate max-w-full shrink-0"
        title={obj.key}
        onClick={(e) => e.stopPropagation()}
      >
        {obj.key}
      </span>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1.5 rounded-full text-fg-2 hover:text-fg-1"
        style={{ background: "rgba(255,255,255,0.1)" }}
        title="닫기 (Esc)"
      >
        <X size={15} strokeWidth={2} />
      </button>
    </div>
  );
}

function Centered({ children }) {
  return <div className="h-full flex items-center justify-center">{children}</div>;
}
