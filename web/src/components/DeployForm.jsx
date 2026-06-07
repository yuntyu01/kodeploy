import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Eye, EyeOff, GitBranch, Plus, Trash2 } from "lucide-react";
import { createDeploy, CUSTOM_DOMAIN_CNAME_TARGET, getEnvVars, listBuilds, RUNTIMES, setDomain, stageDump } from "../api/deploy.js";
import { useAuth } from "../contexts/AuthContext.jsx";

// 서버 슬롯 선택지 — RUNTIMES(python/java) + "none"(서버 없음, 정적 단독)
const SERVER_CHOICES = [...RUNTIMES, "none"];

const RUNTIME_META = {
  python: { name: "Python", tag: "FastAPI · uvicorn" },
  java: { name: "Java", tag: "Spring Boot · JDK 17+" },
  none: { name: "사용 안 함", tag: "정적 사이트 단독" },
};

// runtime별 기본 listen 포트
const DEFAULT_PORTS = {
  python: 8000,
  java: 8080,
};

export default function DeployForm({ onRequestGuide }) {
  const navigate = useNavigate();
  const { user, openLogin, refresh } = useAuth();
  // 1유저=1앱 — user.app_name이 있으면 첫 배포 끝난 상태. 이름 입력란 숨기고 그 이름 재사용.
  const isFirstDeploy = !user?.app_name;
  const [repoUrl, setRepoUrl] = useState("");
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("main");
  const [port, setPort] = useState(DEFAULT_PORTS[RUNTIMES[0]] ?? 80);
  const [buildMode, setBuildMode] = useState("auto");
  const [dockerfilePath, setDockerfilePath] = useState("Dockerfile");
  const [projectPath, setProjectPath] = useState("");
  // 정적 슬롯 — 토글 + 빌드 입력. repo/branch 비우면 서버 repo/branch 사용.
  const [useStatic, setUseStatic] = useState(false);
  const [staticRepoUrl, setStaticRepoUrl] = useState("");
  const [staticBranch, setStaticBranch] = useState("");
  const [staticProjectPath, setStaticProjectPath] = useState("");
  const [buildCmd, setBuildCmd] = useState("npm ci && npm run build");
  const [outputDir, setOutputDir] = useState("dist");
  // 정적 빌드 타임 변수 — 번들에 공개되는 값(VITE_*)이라 visibility 토글 없는 단순 key/value
  const [staticEnvRows, setStaticEnvRows] = useState([{ key: "", value: "" }]);
  const [dbType, setDbType] = useState("none");
  const [useRedis, setUseRedis] = useState(false);
  const [useStorage, setUseStorage] = useState(false);
  const [runtime, setRuntime] = useState(RUNTIMES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // 고급 옵션(캐시·환경변수·초기데이터) 접기/펼치기 — 기본 접힘. 진입장벽 낮추려 핵심만 위에 노출.
  const [showAdvanced, setShowAdvanced] = useState(false);
  // 초기 DB 덤프 파일 — mysql 선택 + 첨부 시 배포 후 자동 복원 (stage → token → 자동 restore).
  const [initDumpFile, setInitDumpFile] = useState(null);
  // 커스텀 도메인(서브도메인 전용) — 배포 성공 후 setDomain 호출. 입력 안 하면 스킵.
  const [customDomain, setCustomDomain] = useState("");
  // 환경변수 row 편집 — 활동 패널 EnvBody와 동일 UI.
  // 재배포 시점에 기존 env 받아와 채움. 첫 배포면 빈 row 하나.
  const [envRows, setEnvRows] = useState([
    { key: "", value: "", visible: true },
  ]);
  // repo + branch 유효성 — GitHub API branches/{br} 호출 결과.
  // state: "idle" | "checking" | "ok" | "notfound" | "invalid" | "error"
  const [repoCheck, setRepoCheck] = useState({ state: "idle" });

  // 재배포 시 기존 세팅 복원 — 최신 빌드 + 환경변수를 폼에 채움
  useEffect(() => {
    if (!user?.app_name) {
      restoredRef.current = true;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [builds, envData] = await Promise.all([listBuilds(), getEnvVars()]);
        if (cancelled) return;
        // 슬롯별 최신 빌드 — 서버(runtime≠static)와 정적을 따로 복원
        const serverLatest = builds.find(
          (b) => b.kind !== "env_change" && b.runtime !== "static",
        );
        const staticLatest = builds.find(
          (b) => b.kind !== "env_change" && b.runtime === "static",
        );
        if (serverLatest) {
          setRepoUrl(serverLatest.repo_url.replace(/\.git$/, ""));
          setBranch(serverLatest.branch || "main");
          setRuntime(
            RUNTIMES.includes(serverLatest.runtime) ? serverLatest.runtime : RUNTIMES[0],
          );
          setDbType(serverLatest.db_type || "none");
          setUseRedis(serverLatest.use_redis || false);
          setUseStorage(serverLatest.use_storage || false);
          setBuildMode(
            ["dockerfile", "auto"].includes(serverLatest.build_mode)
              ? serverLatest.build_mode
              : "auto",
          );
          if (serverLatest.build_mode === "dockerfile") {
            setDockerfilePath(serverLatest.dockerfile_path || "Dockerfile");
          }
          if (serverLatest.build_mode === "auto" && serverLatest.project_path) {
            setProjectPath(serverLatest.project_path);
          }
          setPort(serverLatest.port || DEFAULT_PORTS[serverLatest.runtime] || 80);
        } else if (user?.site_enabled) {
          // 정적 단독 구성 — 서버 "사용 안 함" 복원
          setRuntime("none");
        }
        // 정적 토글은 user.site_enabled(선언값)가 진실원 — 토글 off 후에도
        // 빌드 히스토리에 static 빌드가 남아 있으므로 히스토리로 판단하면 안 됨.
        setUseStatic(!!user?.site_enabled);
        if (staticLatest) {
          if (!serverLatest) {
            // 메인 repo 입력이 곧 정적 repo (정적 단독)
            setRepoUrl(staticLatest.repo_url.replace(/\.git$/, ""));
            setBranch(staticLatest.branch || "main");
          } else if (staticLatest.repo_url !== serverLatest.repo_url) {
            setStaticRepoUrl(staticLatest.repo_url.replace(/\.git$/, ""));
            if (staticLatest.branch !== serverLatest.branch) {
              setStaticBranch(staticLatest.branch || "");
            }
          }
          setStaticProjectPath(staticLatest.project_path || "");
          setBuildCmd(staticLatest.build_cmd ?? ""); // ""도 유효(빌드 없음) — ||로 덮으면 안 됨
          setOutputDir(staticLatest.output_dir || "dist");
          const staticEnvEntries = Object.entries(staticLatest.static_env || {});
          if (staticEnvEntries.length) {
            setStaticEnvRows(staticEnvEntries.map(([k, v]) => ({ key: k, value: v })));
          }
        }
        restoredRef.current = true;
        const entries = Object.entries(envData.env || {});
        if (entries.length) {
          setEnvRows(
            entries.map(([k, v]) => ({ key: k, value: v, visible: false })),
          );
        }
      } catch {
        // 401 등 — 기본값 그대로
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.app_name]);

  // repo URL + branch 입력 시 디바운스 500ms 후 GitHub API로 유효성 확인.
  // unauthenticated 호출이라 private repo는 항상 notfound로 떨어짐 (사용자에게 안내).
  useEffect(() => {
    const url = repoUrl.trim();
    if (!url) {
      setRepoCheck({ state: "idle" });
      return;
    }
    const m = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
    if (!m) {
      setRepoCheck({ state: "invalid" });
      return;
    }
    const [, owner, repo] = m;
    const br = branch.trim() || "main";
    setRepoCheck({ state: "checking" });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(br)}`,
          { headers: { Accept: "application/vnd.github+json" } },
        );
        if (res.status === 200) {
          setRepoCheck({ state: "ok" });
        } else if (res.status === 404) {
          setRepoCheck({ state: "notfound" });
        } else {
          setRepoCheck({ state: "error", code: res.status });
        }
      } catch {
        setRepoCheck({ state: "error" });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [repoUrl, branch]);

  const addStaticEnvRow = () =>
    setStaticEnvRows((r) => [...r, { key: "", value: "" }]);
  const removeStaticEnvRow = (i) =>
    setStaticEnvRows((r) =>
      r.length === 1 ? [{ key: "", value: "" }] : r.filter((_, idx) => idx !== i),
    );
  const updateStaticEnvRow = (i, field, val) =>
    setStaticEnvRows((r) =>
      r.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)),
    );

  const addEnvRow = () =>
    setEnvRows((r) => [...r, { key: "", value: "", visible: true }]);
  const removeEnvRow = (i) =>
    setEnvRows((r) =>
      r.length === 1
        ? [{ key: "", value: "", visible: true }]
        : r.filter((_, idx) => idx !== i),
    );
  const updateEnvRow = (i, field, val) =>
    setEnvRows((r) =>
      r.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)),
    );
  const toggleEnvVisible = (i) =>
    setEnvRows((r) =>
      r.map((row, idx) =>
        idx === i ? { ...row, visible: !row.visible } : row,
      ),
    );

  // Dockerfile 모드 + 해당 runtime 변경 시 우측 가이드 패널 자동 표시.
  // auto 모드면 패널 닫기. X 버튼으로 닫아도 buildMode/runtime이 안 바뀌면 다시 안 열림.
  // 서버 사용 안 함이면 빌드 방식 자체가 없으므로 항상 닫기.
  useEffect(() => {
    onRequestGuide?.(buildMode === "dockerfile" && runtime !== "none" ? runtime : null);
  }, [buildMode, runtime, onRequestGuide]);

  // runtime 변경 시 default 포트 자동 적용. 초기 복원 중에는 skip.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!restoredRef.current) return;
    const def = DEFAULT_PORTS[runtime];
    if (def) setPort(def);
  }, [runtime]);

  const serverNone = runtime === "none";
  // 서버도 정적도 없으면 배포할 게 없음
  const disabled = !repoUrl.trim() || submitting || (serverNone && !useStatic);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (disabled) return;
    // 미로그인이면 API 호출 전에 LoginModal 띄움 (API도 401로 막지만 UX 단축)
    if (!user) {
      openLogin?.();
      return;
    }
    setError(null);
    setSubmitting(true);
    // 환경변수 row → dict (빈 KEY는 무시, 같은 KEY 중복이면 뒤 row가 이김)
    const envDict = {};
    for (const { key, value } of envRows) {
      const k = key.trim();
      if (!k) continue;
      envDict[k] = value;
    }
    // 정적 빌드 타임 변수 — 동일 규칙
    const staticEnvDict = {};
    for (const { key, value } of staticEnvRows) {
      const k = key.trim();
      if (!k) continue;
      staticEnvDict[k] = value;
    }
    // 서버 사용 안 함이면 서버 전용 옵션(DB/캐시/스토리지/환경변수)은 무의미 — 폼 상태에 남은 옛 값 무시.
    const effectiveDbType = serverNone ? "none" : dbType;
    try {
      // 초기 DB 덤프가 있으면 먼저 stage → 토큰 발급 (mysql/postgres 선택 시에만 의미 있음).
      let initDumpToken = null;
      if ((effectiveDbType === "mysql" || effectiveDbType === "postgres") && initDumpFile) {
        const staged = await stageDump(initDumpFile);
        initDumpToken = staged.token;
      }
      await createDeploy({
        repoUrl: repoUrl.trim(),
        // 첫 배포: 사용자가 입력한 이름 또는 자동 생성(서버 측). 두 번째부터는 user.app_name 재사용되니 보냄 의미 없음.
        name: isFirstDeploy ? name.trim() || undefined : undefined,
        branch: branch.trim() || "main",
        port: Number(port) || 80,
        runtime,                                   // "python" | "java" | "none"
        dbType: effectiveDbType,
        useRedis: serverNone ? false : useRedis,
        useStorage: serverNone ? false : useStorage,
        buildMode: serverNone ? "auto" : buildMode, // 서버 없으면 미사용 — 스키마 통과용 placeholder
        dockerfilePath:
          !serverNone && buildMode === "dockerfile" ? dockerfilePath.trim() || "Dockerfile" : "Dockerfile",
        projectPath:
          !serverNone && buildMode === "auto" ? projectPath.trim().replace(/^\/+|\/+$/g, "") : "",
        useStatic,
        staticRepoUrl: useStatic ? staticRepoUrl.trim() : "",
        staticBranch: useStatic ? staticBranch.trim() : "",
        staticProjectPath: useStatic ? staticProjectPath.trim().replace(/^\/+|\/+$/g, "") : "",
        buildCmd: useStatic ? buildCmd.trim() : "",
        outputDir: useStatic ? outputDir.trim() : "",
        staticEnv: useStatic ? staticEnvDict : {},
        env: serverNone ? {} : envDict,
        initDumpToken,
      });
      // 첫 배포면 user.app_name이 백엔드에 박혔으니 AuthContext 갱신 — Dashboard에서 즉시 반영
      if (isFirstDeploy) await refresh();
      // 커스텀 도메인 입력 시 — 배포로 app_name 확정됐으니 이어서 연결 (서브도메인 전용).
      const cd = customDomain.trim();
      if (cd) {
        try {
          await setDomain(cd);
        } catch (err2) {
          setError(`배포는 시작됐어요. 단, 커스텀 도메인 연결 실패: ${err2.message}`);
          setSubmitting(false);
          return;
        }
      }
      navigate("/dashboard");
    } catch (err) {
      if (err.status === 401) {
        openLogin?.();
        setSubmitting(false);
        return;
      }
      setError(err.message || "배포 요청 실패");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="kd-fade-in w-[520px] max-w-[90vw] mx-auto pb-12">
      <h2
        className="text-[22px] text-fg-1 mb-2"
        style={{ fontWeight: 510, letterSpacing: -0.5 }}
      >
        GitHub 저장소 배포
      </h2>
      <p className="text-[13px] text-fg-3 mb-6">
        저장소 주소를 입력하면 빌드 후 클러스터에 자동 배포해요.
      </p>

      {/* GitHub URL + Branch */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <div
            className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
            style={{ fontWeight: 590 }}
          >
            GitHub 링크
          </div>
          <div
            className="flex items-center rounded-md px-3"
            style={{
              border: "1px solid rgba(255,255,255,0.09)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <GitBranch size={15} strokeWidth={1.6} className="text-fg-3 mr-2 shrink-0" />
            <input
              autoFocus
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/username/repo"
              className="flex-1 bg-transparent outline-none text-[14px] text-fg-1 py-2 placeholder:text-fg-3"
              style={{ fontWeight: 510 }}
              disabled={submitting}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
        </div>
        <div className="w-28 shrink-0">
          <div
            className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
            style={{ fontWeight: 590 }}
          >
            브랜치
          </div>
          <input
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
            className="w-full bg-transparent outline-none text-[14px] text-fg-1 rounded-md px-3 py-2 placeholder:text-fg-3"
            style={{
              border: "1px solid rgba(255,255,255,0.09)",
              background: "rgba(255,255,255,0.02)",
              fontWeight: 510,
            }}
            disabled={submitting}
          />
        </div>
      </div>

      {/* repo + branch 유효성 — GitHub API로 확인 (디바운스 500ms) */}
      {repoCheck.state !== "idle" && (
        <div className="-mt-3 mb-5 text-[11px]" style={{ fontWeight: 450 }}>
          {repoCheck.state === "checking" && (
            <span className="text-fg-4">저장소 확인 중…</span>
          )}
          {repoCheck.state === "ok" && (
            <span style={{ color: "#818be0" }}>✓ 저장소와 브랜치 확인됨</span>
          )}
          {repoCheck.state === "invalid" && (
            <span style={{ color: "#a13c3c", fontWeight: 510 }}>
              GitHub URL 형식이 올바르지 않아요
            </span>
          )}
          {repoCheck.state === "notfound" && (
            <span style={{ color: "#a13c3c", fontWeight: 510 }}>
              저장소 또는 브랜치를 찾을 수 없어요 (private이면 표시 안 됨)
            </span>
          )}
          {repoCheck.state === "error" && (
            <span className="text-fg-4">
              확인 실패{repoCheck.code ? ` (${repoCheck.code})` : ""}
            </span>
          )}
        </div>
      )}

      {/* 서버 슬롯 — python/java/사용 안 함(정적 단독) */}
      <div className="mb-5">
        <div
          className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2.5"
          style={{ fontWeight: 590 }}
        >
          서버 런타임
        </div>
        <div className="flex gap-1.5">
          {SERVER_CHOICES.map((r) => {
            const meta = RUNTIME_META[r] || { name: r, tag: "" };
            const active = runtime === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRuntime(r)}
                className="flex-1 h-10 rounded-lg text-[13px] transition-colors flex items-center justify-center"
                style={{
                  background: active ? "rgba(129,139,224,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? "rgba(129,139,224,0.25)" : "rgba(255,255,255,0.06)"}`,
                  color: active ? "#818be0" : "#8a8f98",
                  fontWeight: 510,
                }}
                disabled={submitting}
              >
                {meta.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* DB — 한 앱에 한 DB만 (mysql/postgres 동시 사용 X). 서버 없으면 숨김. */}
      {!serverNone && (
      <div className="mb-5">
        <div
          className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2.5"
          style={{ fontWeight: 590 }}
        >
          데이터베이스
        </div>
        <div className="flex gap-1.5">
          {[
            { id: "none", name: "사용 안 함" },
            { id: "mysql", name: "MySQL 8.4" },
            { id: "postgres", name: "PostgreSQL 16" },
          ].map((d) => {
            const active = dbType === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDbType(d.id)}
                className="flex-1 h-10 rounded-lg text-[13px] transition-colors flex items-center justify-center"
                style={{
                  background: active ? "rgba(129,139,224,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? "rgba(129,139,224,0.25)" : "rgba(255,255,255,0.06)"}`,
                  color: active ? "#818be0" : "#8a8f98",
                  fontWeight: 510,
                }}
                disabled={submitting}
              >
                {d.name}
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* Build mode — 서버 빌드 방식. 서버 없으면 숨김. */}
      {!serverNone && (
      <div className="mb-6">
        <div className="flex gap-3">
          <div className={buildMode === "dockerfile" ? "flex-1" : "w-full"}>
            <div
              className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2.5"
              style={{ fontWeight: 590 }}
            >
              빌드 방식
            </div>
            <div className="flex gap-1.5">
              {[
                { id: "auto", name: "자동 빌드" },
                { id: "dockerfile", name: "Dockerfile" },
              ].map((m) => {
                const active = buildMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setBuildMode(m.id)}
                    className="flex-1 h-10 rounded-lg text-[13px] transition-all flex items-center justify-center"
                    style={{
                      background: active ? "rgba(129,139,224,0.12)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${active ? "rgba(129,139,224,0.25)" : "rgba(255,255,255,0.06)"}`,
                      color: active ? "#818be0" : "#8a8f98",
                      fontWeight: 510,
                    }}
                    disabled={submitting}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>
          {buildMode === "dockerfile" && (
            <div className="w-24 shrink-0">
              <div
                className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2.5"
                style={{ fontWeight: 590 }}
              >
                포트
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full h-10 bg-transparent outline-none text-fg-1 text-[14px] rounded-md px-3"
                style={{
                  border: "1px solid rgba(255,255,255,0.09)",
                  background: "rgba(255,255,255,0.02)",
                  fontWeight: 510,
                }}
                disabled={submitting}
              />
            </div>
          )}
        </div>
        {buildMode === "dockerfile" && (
          <div className="mt-3">
            <div
              className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
              style={{ fontWeight: 590 }}
            >
              Dockerfile 경로
            </div>
            <input
              value={dockerfilePath}
              onChange={(e) => setDockerfilePath(e.target.value)}
              placeholder="Dockerfile"
              className="w-full bg-transparent outline-none text-fg-1 text-[14px] rounded-md px-3 py-2 placeholder:text-fg-3"
              style={{
                border: "1px solid rgba(255,255,255,0.09)",
                background: "rgba(255,255,255,0.02)",
                fontWeight: 510,
              }}
              disabled={submitting}
            />
            <p className="text-[11px] text-fg-3 mt-2" style={{ fontWeight: 450 }}>
              프로젝트 루트에 Dockerfile이 있어야 합니다. 서브 디렉토리에 있으면{" "}
              <span style={{ color: "#d0d6e0" }}>subdir/Dockerfile</span> 같이
              입력.
            </p>
          </div>
        )}
        {buildMode === "auto" && (
          <div className="mt-3">
            <div
              className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
              style={{ fontWeight: 590 }}
            >
              앱 디렉토리 (선택)
            </div>
            <input
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              placeholder="비워두면 자동 탐색 (예: backend)"
              className="w-full bg-transparent outline-none text-fg-1 text-[14px] rounded-md px-3 py-2 placeholder:text-fg-3"
              style={{
                border: "1px solid rgba(255,255,255,0.09)",
                background: "rgba(255,255,255,0.02)",
                fontWeight: 510,
              }}
              disabled={submitting}
            />
            <p className="text-[11px] text-fg-3 mt-2" style={{ fontWeight: 450 }}>
              <span style={{ color: "#d0d6e0" }}>pom.xml</span>,{" "}
              <span style={{ color: "#d0d6e0" }}>requirements.txt</span> 같은
              파일이 있는 폴더 경로를 입력하세요.
              <br />
              모노레포·비표준 구조면 자동 탐색이 실패할 수 있어요.
            </p>
          </div>
        )}
      </div>
      )}

      {/* Domain — 첫 배포에만 표시. 두 번째부터는 user.app_name fix되어 변경 불가 (안내만). */}
      <div className="mb-6">
        <div
          className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
          style={{ fontWeight: 590 }}
        >
          도메인
        </div>
        {isFirstDeploy ? (
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="비워두면 자동으로 채워져요"
              className="bg-transparent outline-none text-fg-1 text-[14px] rounded-md px-3 py-2 w-1/2 placeholder:text-fg-3"
              style={{
                border: "1px solid rgba(255,255,255,0.09)",
                background: "rgba(255,255,255,0.02)",
                fontWeight: 510,
              }}
              disabled={submitting}
            />
            <span className="text-[14px] text-fg-3 shrink-0" style={{ fontWeight: 510 }}>.kodeploy.com</span>
          </div>
        ) : (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-md"
            style={{
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <span className="text-[14px] text-fg-1" style={{ fontWeight: 510 }}>
              {user.app_name}
            </span>
            <span className="text-[14px] text-fg-3" style={{ fontWeight: 510 }}>
              .kodeploy.com
            </span>
            <span className="ml-auto text-[10.5px] text-fg-4" style={{ fontWeight: 510 }}>
              앱 이름은 변경 불가
            </span>
          </div>
        )}
      </div>

      {/* 고급 옵션 — 캐시 · 환경변수. 기본 접힘. 핵심 흐름(repo→runtime→배포)을 방해하지 않도록 맨 아래로. */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full flex items-center gap-2 py-2 text-fg-3 hover:text-fg-1 transition-colors"
        >
          <ChevronDown
            size={14}
            strokeWidth={2}
            className="transition-transform"
            style={{ transform: showAdvanced ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
          <span className="text-[12px]" style={{ fontWeight: 540 }}>
            고급 옵션
          </span>
          <span className="text-[11px] text-fg-4" style={{ fontWeight: 450 }}>
            {serverNone ? "커스텀 도메인" : "캐시 · 환경변수"}
          </span>
        </button>

        {showAdvanced && (
          <div
            className="mt-3 flex flex-col gap-6 px-4 py-4 rounded-xl"
            style={{
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.015)",
            }}
          >
            {/* 캐시 + 스토리지 — 서버 없으면 숨김 */}
            {!serverNone && (
            <>
            <div>
              <div
                className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2.5"
                style={{ fontWeight: 590 }}
              >
                캐시
              </div>
              <div className="flex gap-1.5">
                {[
                  { id: false, name: "사용 안 함" },
                  { id: true, name: "Redis 7" },
                ].map((r) => {
                  const active = useRedis === r.id;
                  return (
                    <button
                      key={String(r.id)}
                      type="button"
                      onClick={() => setUseRedis(r.id)}
                      className="flex-1 h-10 rounded-lg text-[13px] transition-colors flex items-center justify-center"
                      style={{
                        background: active ? "rgba(129,139,224,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${active ? "rgba(129,139,224,0.25)" : "rgba(255,255,255,0.06)"}`,
                        color: active ? "#818be0" : "#8a8f98",
                        fontWeight: 510,
                      }}
                      disabled={submitting}
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 오브젝트 스토리지 — R2 앱당 버킷. 켜면 S3 호환 자격증명이 앱에 자동 주입됨. */}
            <div>
              <div
                className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2.5"
                style={{ fontWeight: 590 }}
              >
                오브젝트 스토리지
              </div>
              <div className="flex gap-1.5">
                {[
                  { id: false, name: "사용 안 함" },
                  { id: true, name: "R2 (S3 호환)" },
                ].map((s) => {
                  const active = useStorage === s.id;
                  return (
                    <button
                      key={String(s.id)}
                      type="button"
                      onClick={() => setUseStorage(s.id)}
                      className="flex-1 h-10 rounded-lg text-[13px] transition-colors flex items-center justify-center"
                      style={{
                        background: active ? "rgba(129,139,224,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${active ? "rgba(129,139,224,0.25)" : "rgba(255,255,255,0.06)"}`,
                        color: active ? "#818be0" : "#8a8f98",
                        fontWeight: 510,
                      }}
                      disabled={submitting}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
            </>
            )}

            {/* 커스텀 도메인 — 서브도메인 전용(CNAME). 배포 직후 setDomain 호출. */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="text-[10.5px] tracking-[0.08em] text-fg-3" style={{ fontWeight: 590 }}>
                  커스텀 도메인 (선택)
                </div>
                <button
                  type="button"
                  onClick={() => onRequestGuide?.("custom-domain")}
                  className="text-[11px] text-fg-3 hover:text-fg-1 transition-colors"
                  style={{ fontWeight: 510 }}
                >
                  가이드 보기
                </button>
              </div>
              <input
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value.toLowerCase())}
                placeholder="app.example.com"
                spellCheck={false}
                autoCapitalize="off"
                className="w-full px-2.5 py-1.5 rounded-md bg-transparent outline-none text-[12.5px] text-fg-1 placeholder:text-fg-4"
                style={{ border: "1px solid rgba(255,255,255,0.09)", fontWeight: 510 }}
                disabled={submitting}
              />
              {customDomain.trim() && (
                <div
                  className="mt-2 flex items-center gap-2 px-2.5 py-2 rounded-md text-[11.5px]"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", fontWeight: 510 }}
                >
                  <span className="text-fg-4 w-12 shrink-0">CNAME</span>
                  <span className="text-fg-2 truncate">{customDomain.trim()}</span>
                  <span className="text-fg-4 shrink-0">→</span>
                  <span className="text-[#a4abee] truncate flex-1">{CUSTOM_DOMAIN_CNAME_TARGET}</span>
                </div>
              )}
              <p className="text-[11px] text-fg-4 mt-1.5" style={{ lineHeight: 1.5 }}>
                <span className="text-fg-3">서브도메인만</span> 가능해요(예: app.example.com). 배포 후 위 CNAME 한 줄을
                도메인 DNS에 추가하면 인증서가 자동 발급됩니다. 루트(apex) 도메인은 미지원.
              </p>
            </div>

            {/* 환경변수 — 서버 슬롯 전용 (정적 nginx는 안 읽음) */}
            {!serverNone && (
            <div>
              <div
                className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2.5"
                style={{ fontWeight: 590 }}
              >
                환경변수 (선택)
              </div>
              <div className="flex flex-col gap-1.5">
                {envRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      value={row.key}
                      onChange={(e) =>
                        updateEnvRow(i, "key", e.target.value.toUpperCase())
                      }
                      placeholder="KEY"
                      spellCheck={false}
                      autoCapitalize="characters"
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-transparent outline-none text-[12.5px] text-fg-1 placeholder:text-fg-4"
                      style={{
                        border: "1px solid rgba(255,255,255,0.09)",
                        fontWeight: 510,
                      }}
                      disabled={submitting}
                    />
                    <input
                      value={
                        row.visible
                          ? row.value
                          : "•".repeat(Math.min(row.value.length, 12))
                      }
                      onChange={(e) =>
                        row.visible && updateEnvRow(i, "value", e.target.value)
                      }
                      onFocus={() => !row.visible && toggleEnvVisible(i)}
                      readOnly={!row.visible}
                      placeholder="value"
                      spellCheck={false}
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-transparent outline-none text-[12.5px] text-fg-1 placeholder:text-fg-4"
                      style={{
                        border: "1px solid rgba(255,255,255,0.09)",
                        fontWeight: 510,
                      }}
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      onClick={() => toggleEnvVisible(i)}
                      className="w-7 h-7 rounded-md text-fg-4 hover:text-fg-1 hover:bg-white/[0.04] flex items-center justify-center shrink-0"
                      title={row.visible ? "숨기기" : "보기"}
                    >
                      {row.visible ? (
                        <EyeOff size={12} strokeWidth={1.8} />
                      ) : (
                        <Eye size={12} strokeWidth={1.8} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeEnvRow(i)}
                      className="w-7 h-7 rounded-md text-fg-4 hover:text-red-300 hover:bg-white/[0.04] flex items-center justify-center shrink-0"
                      title="삭제"
                    >
                      <Trash2 size={12} strokeWidth={1.8} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addEnvRow}
                className="mt-3 flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] text-fg-3 hover:text-fg-1 hover:bg-white/[0.04]"
                style={{ fontWeight: 510 }}
              >
                <Plus size={11} strokeWidth={2} /> 변수 추가
              </button>
              <p
                className="text-[11px] text-fg-4 mt-2"
                style={{ fontWeight: 450, lineHeight: 1.55 }}
              >
                빈 KEY row는 무시돼요. 빈 값으로 두면 환경변수 변경 없이 빌드만 트리거.
              </p>
            </div>
            )}

            {/* 초기 데이터 — DB(mysql/postgres) 선택 시에만. 배포 후 DB Ready되면 자동 복원 (마이그레이션용). */}
            {!serverNone && (dbType === "mysql" || dbType === "postgres") && (
              <div>
                <div
                  className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2.5"
                  style={{ fontWeight: 590 }}
                >
                  초기 데이터 (선택)
                </div>
                <div className="flex items-center gap-2.5">
                  <label
                    className="px-3 py-1.5 rounded-lg text-[12px] cursor-pointer shrink-0 transition-colors"
                    style={{ background: "rgba(255,255,255,0.05)", color: "#dde0e4", fontWeight: 510, border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    파일 선택
                    <input
                      type="file"
                      accept=".sql,.gz,.sql.gz,application/sql,application/gzip"
                      onChange={(e) => setInitDumpFile(e.target.files?.[0] || null)}
                      className="hidden"
                      disabled={submitting}
                    />
                  </label>
                  <span className="text-[11px] truncate min-w-0" style={{ color: initDumpFile ? "#c5cad2" : "#6b7280" }}>
                    {initDumpFile ? initDumpFile.name : "선택된 파일 없음"}
                  </span>
                  {initDumpFile && (
                    <button
                      type="button"
                      onClick={() => setInitDumpFile(null)}
                      className="text-[11px] text-fg-4 hover:text-fg-2 transition-colors shrink-0"
                      title="선택 취소"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p
                  className="text-[11px] text-fg-4 mt-2"
                  style={{ fontWeight: 450, lineHeight: 1.55 }}
                >
                  .sql · .sql.gz 덤프를 올리면 배포 후 MySQL에 자동 복원돼요. 기존 데이터를 덮어씁니다.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 정적 사이트 세트 — 슬롯 전체(토글·repo·빌드·변수)를 한 묶음으로. 켜면
          {app}.kodeploy.com=정적 / 서버={app}-api, 커스텀 도메인도 정적에 연결. */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2.5">
          <div
            className="text-[10.5px] tracking-[0.08em] text-fg-3"
            style={{ fontWeight: 590 }}
          >
            정적 사이트
          </div>
          {useStatic && (
            <button
              type="button"
              onClick={() => onRequestGuide?.("static")}
              className="text-[11px] text-fg-3 hover:text-fg-1 transition-colors"
              style={{ fontWeight: 510 }}
            >
              가이드 보기
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          {[
            { id: false, name: "선택 안 함" },
            { id: true, name: "정적 사이트" },
          ].map((s) => {
            const active = useStatic === s.id;
            return (
              <button
                key={String(s.id)}
                type="button"
                onClick={() => setUseStatic(s.id)}
                className="flex-1 h-10 rounded-lg text-[13px] transition-colors flex items-center justify-center"
                style={{
                  background: active ? "rgba(129,139,224,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? "rgba(129,139,224,0.25)" : "rgba(255,255,255,0.06)"}`,
                  color: active ? "#818be0" : "#8a8f98",
                  fontWeight: 510,
                }}
                disabled={submitting}
              >
                {s.name}
              </button>
            );
          })}
        </div>
        {useStatic && (
          <div
            className="mt-3 flex flex-col gap-5 px-4 py-4 rounded-xl"
            style={{
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.015)",
            }}
          >
            {!serverNone && (
              <p className="text-[11px] text-fg-4" style={{ fontWeight: 450, lineHeight: 1.5 }}>
                정적 사이트가 <span className="text-fg-3">{(user?.app_name || name.trim() || "앱이름")}.kodeploy.com</span>을
                받고, 서버는 <span className="text-fg-3">{(user?.app_name || name.trim() || "앱이름")}-api.kodeploy.com</span>으로
                제공돼요. 커스텀 도메인도 정적 사이트에 연결됩니다.
              </p>
            )}
            <div className="flex gap-3">
              <div className="flex-1">
                <div
                  className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
                  style={{ fontWeight: 590 }}
                >
                  정적 저장소 (선택)
                </div>
                <input
                  value={staticRepoUrl}
                  onChange={(e) => setStaticRepoUrl(e.target.value)}
                  placeholder="비우면 위 저장소 사용"
                  spellCheck={false}
                  className="w-full bg-transparent outline-none text-fg-1 text-[13px] rounded-md px-3 py-2 placeholder:text-fg-4"
                  style={{
                    border: "1px solid rgba(255,255,255,0.09)",
                    fontWeight: 510,
                  }}
                  disabled={submitting}
                />
              </div>
              <div className="w-28 shrink-0">
                <div
                  className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
                  style={{ fontWeight: 590 }}
                >
                  브랜치
                </div>
                <input
                  value={staticBranch}
                  onChange={(e) => setStaticBranch(e.target.value)}
                  placeholder={branch.trim() || "main"}
                  className="w-full bg-transparent outline-none text-fg-1 text-[13px] rounded-md px-3 py-2 placeholder:text-fg-4"
                  style={{
                    border: "1px solid rgba(255,255,255,0.09)",
                    fontWeight: 510,
                  }}
                  disabled={submitting}
                />
              </div>
            </div>
            <div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <div
                    className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
                    style={{ fontWeight: 590 }}
                  >
                    빌드 커맨드
                  </div>
                  <input
                    value={buildCmd}
                    onChange={(e) => setBuildCmd(e.target.value)}
                    placeholder="npm ci && npm run build"
                    spellCheck={false}
                    className="w-full bg-transparent outline-none text-fg-1 text-[13px] rounded-md px-3 py-2 placeholder:text-fg-4"
                    style={{
                      border: "1px solid rgba(255,255,255,0.09)",
                      fontWeight: 510,
                    }}
                    disabled={submitting}
                  />
                </div>
                <div className="w-32 shrink-0">
                  <div
                    className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
                    style={{ fontWeight: 590 }}
                  >
                    출력 디렉토리
                  </div>
                  <input
                    value={outputDir}
                    onChange={(e) => setOutputDir(e.target.value)}
                    placeholder="dist"
                    spellCheck={false}
                    className="w-full bg-transparent outline-none text-fg-1 text-[13px] rounded-md px-3 py-2 placeholder:text-fg-4"
                    style={{
                      border: "1px solid rgba(255,255,255,0.09)",
                      fontWeight: 510,
                    }}
                    disabled={submitting}
                  />
                </div>
              </div>
              <p className="text-[11px] text-fg-4 mt-2" style={{ fontWeight: 450, lineHeight: 1.55 }}>
                빌드 결과물(출력 디렉토리)만 서빙돼요 — Vite는{" "}
                <span className="text-fg-3">dist</span>, CRA는{" "}
                <span className="text-fg-3">build</span>. 커맨드를 비우면 빌드 없이
                저장소 파일을 그대로 서빙합니다 (순수 HTML).
              </p>
            </div>
            <div>
              <div
                className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
                style={{ fontWeight: 590 }}
              >
                앱 디렉토리 (선택)
              </div>
              <input
                value={staticProjectPath}
                onChange={(e) => setStaticProjectPath(e.target.value)}
                placeholder="모노레포면 프론트 폴더 (예: frontend)"
                className="w-full bg-transparent outline-none text-fg-1 text-[13px] rounded-md px-3 py-2 placeholder:text-fg-4"
                style={{
                  border: "1px solid rgba(255,255,255,0.09)",
                  fontWeight: 510,
                }}
                disabled={submitting}
              />
            </div>
            {/* 빌드 타임 변수 — 빌드 스테이지 ENV로 주입. 번들에 박혀 공개되므로 시크릿 금지. */}
            <div>
              <div
                className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
                style={{ fontWeight: 590 }}
              >
                빌드 타임 변수 (선택)
              </div>
              <div className="flex flex-col gap-1.5">
                {staticEnvRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      value={row.key}
                      onChange={(e) =>
                        updateStaticEnvRow(i, "key", e.target.value.toUpperCase())
                      }
                      placeholder="VITE_API_URL"
                      spellCheck={false}
                      autoCapitalize="characters"
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-transparent outline-none text-[12.5px] text-fg-1 placeholder:text-fg-4"
                      style={{
                        border: "1px solid rgba(255,255,255,0.09)",
                        fontWeight: 510,
                      }}
                      disabled={submitting}
                    />
                    <input
                      value={row.value}
                      onChange={(e) => updateStaticEnvRow(i, "value", e.target.value)}
                      placeholder="value"
                      spellCheck={false}
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-transparent outline-none text-[12.5px] text-fg-1 placeholder:text-fg-4"
                      style={{
                        border: "1px solid rgba(255,255,255,0.09)",
                        fontWeight: 510,
                      }}
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      onClick={() => removeStaticEnvRow(i)}
                      className="w-7 h-7 rounded-md text-fg-4 hover:text-red-300 hover:bg-white/[0.04] flex items-center justify-center shrink-0"
                      title="삭제"
                    >
                      <Trash2 size={12} strokeWidth={1.8} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addStaticEnvRow}
                className="mt-2.5 flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] text-fg-3 hover:text-fg-1 hover:bg-white/[0.04]"
                style={{ fontWeight: 510 }}
              >
                <Plus size={11} strokeWidth={2} /> 변수 추가
              </button>
              <p
                className="text-[11px] text-fg-4 mt-2"
                style={{ fontWeight: 450, lineHeight: 1.55 }}
              >
                <span className="text-fg-3">VITE_</span> 같은 빌드 타임 값이 번들에
                들어가요 — 브라우저에 공개되니 <span className="text-fg-3">시크릿은 금지</span>.
                서버 환경변수(고급 옵션)와는 별개입니다.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Deploy button */}
      <button
        type="submit"
        disabled={disabled}
        className="w-full py-3 rounded-md text-[14px] text-white transition-colors disabled:opacity-40"
        style={{ background: "#6672d5", fontWeight: 510 }}
        onMouseEnter={(e) =>
          !disabled && (e.currentTarget.style.background = "#828fff")
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = "#6672d5")}
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white kd-spin" />
            배포 요청 중
          </span>
        ) : (
          "배포 시작"
        )}
      </button>

      {error && (
        <div
          className="mt-3 px-3 py-2 rounded-md text-[12px]"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#fca5a5",
          }}
        >
          {error}
        </div>
      )}
    </form>
  );
}
