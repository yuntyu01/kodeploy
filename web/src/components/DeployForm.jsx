import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, Eye, EyeOff, GitBranch, Plus, Trash2 } from "lucide-react";
import { createDeploy, CUSTOM_DOMAIN_CNAME_TARGET, getEnvVars, getReservedKeys, listBuilds, listGithubBranches, listGithubRepos, RUNTIMES, setDomain, stageDump } from "../api/deploy.js";
import { GITHUB_INSTALL_URL } from "../api/auth.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import InfoHint from "./InfoHint.jsx";

const RUNTIME_META = {
  python: { name: "Python", tag: "FastAPI · uvicorn" },
  java: { name: "Java", tag: "Spring Boot · JDK 17+" },
  php: { name: "PHP", tag: "Apache · PHP 8" },
  javascript: { name: "JavaScript", tag: "Node.js · Express/Next" },
  none: { name: "사용 안 함", tag: "정적 사이트 단독" },
};

// runtime별 기본 listen 포트
const DEFAULT_PORTS = {
  python: 8000,
  java: 8080,
  php: 8080,
  javascript: 3000,
};

// 섹션 토글 / 선택지 버튼 공통 스타일 - 백엔드·프론트엔드·DB·빌드방식 등에서 재사용.
const choiceStyle = (active) => ({
  background: active ? "rgba(129,139,224,0.12)" : "var(--kd-surface)",
  border: `1px solid ${active ? "rgba(129,139,224,0.25)" : "var(--line-2)"}`,
  color: active ? "#818be0" : "var(--fg-3)",
  fontWeight: 510,
});

export default function DeployForm({ onRequestGuide }) {
  const navigate = useNavigate();
  const { user, openLogin, refresh } = useAuth();
  // 1유저=1앱 - user.app_name이 있으면 첫 배포 끝난 상태. 이름 입력란 숨기고 그 이름 재사용.
  const isFirstDeploy = !user?.app_name;
  const [repoUrl, setRepoUrl] = useState("");          // 백엔드 GitHub 링크 (백엔드 OFF면 미사용 - 프론트 링크가 repo)
  const [ghRepos, setGhRepos] = useState([]);            // 연결된 installation repo 목록 (private repo 리스트)
  const [repoListCollapsed, setRepoListCollapsed] = useState(false);  // 연결된 repo 리스트 접기 - 링크칸 우측 토글 / 선택 시 자동 접힘
  const [ghBranches, setGhBranches] = useState([]);      // 선택 repo의 브랜치 목록 (브랜치 드롭다운)
  const [branchOpen, setBranchOpen] = useState(false);   // 브랜치 드롭다운 열림 여부
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("main");
  const [port, setPort] = useState(DEFAULT_PORTS[RUNTIMES[0]] ?? 80);
  const [buildMode, setBuildMode] = useState("detect");  // detect=자동감지(기본) / dockerfile / auto(nixpacks)
  const [dockerfilePath, setDockerfilePath] = useState("Dockerfile");
  const [projectPath, setProjectPath] = useState("");
  // 정적 슬롯 - 토글 + 빌드 입력. repo/branch 비우면 서버 repo/branch 사용.
  const [useStatic, setUseStatic] = useState(false);
  const [staticRepoUrl, setStaticRepoUrl] = useState("");
  const [staticBranch, setStaticBranch] = useState("");
  const [staticProjectPath, setStaticProjectPath] = useState("");
  const [buildCmd, setBuildCmd] = useState("npm ci && npm run build");
  const [outputDir, setOutputDir] = useState("dist");
  // 정적 빌드 타임 변수 - 번들에 공개되는 값(VITE_*)이라 visibility 토글 없는 단순 key/value
  const [staticEnvRows, setStaticEnvRows] = useState([{ key: "", value: "" }]);
  const [dbType, setDbType] = useState("none");
  const [useRedis, setUseRedis] = useState(false);
  // 영속저장소(런타임 무관) - 단일 셀렉터. "none"=ephemeral / "local"=PVC / "object"=R2.
  const [storage, setStorage] = useState("none");
  const [volumeMountPath, setVolumeMountPath] = useState("/var/www/html/data");  // local 전용 - 그누보드 기본값
  const [runtime, setRuntime] = useState(RUNTIMES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // 섹션별 고급 옵션 접기/펼치기 - 기본 접힘. 핵심(repo→runtime→배포)만 위에 노출.
  const [showServerAdvanced, setShowServerAdvanced] = useState(false);   // 백엔드 고급(빌드방식·캐시·저장소·환경변수·초기데이터)
  const [showStaticAdvanced, setShowStaticAdvanced] = useState(false);   // 프론트 고급(빌드 타임 변수)
  const [showCustomDomain, setShowCustomDomain] = useState(false);       // 커스텀 도메인 박스 - 도메인 섹션 아래 독립 접이식
  // 초기 DB 덤프 파일 - mysql 선택 + 첨부 시 배포 후 자동 복원 (stage → token → 자동 restore).
  const [initDumpFile, setInitDumpFile] = useState(null);
  // 커스텀 도메인(서브도메인 전용) - 배포 성공 후 setDomain 호출. 입력 안 하면 스킵.
  const [customDomain, setCustomDomain] = useState("");
  // 환경변수 row 편집 - 활동 패널 EnvBody와 동일 UI.
  // 재배포 시점에 기존 env 받아와 채움. 첫 배포면 빈 row 하나.
  const [envRows, setEnvRows] = useState([
    { key: "", value: "", visible: true },
  ]);
  // repo + branch 유효성 - GitHub API branches/{br} 호출 결과.
  // state: "idle" | "checking" | "ok" | "notfound" | "invalid" | "error"
  const [repoCheck, setRepoCheck] = useState({ state: "idle" });
  // dep별 자동 주입 env 키 맵 — 로그인 시 1회 fetch, 이후 토글/타이핑은 로컬 비교.
  const [reservedMap, setReservedMap] = useState(null);

  // 재배포 시 기존 세팅 복원 - 최신 빌드 + 환경변수를 폼에 채움
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
        // 슬롯별 최신 빌드 - 서버(runtime≠static)와 정적을 따로 복원
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
          setStorage(serverLatest.storage || "none");
          if (serverLatest.volume_mount_path) setVolumeMountPath(serverLatest.volume_mount_path);
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
          // 정적 단독 구성 - 서버 "사용 안 함" 복원
          setRuntime("none");
        }
        // 정적 토글은 user.site_enabled(선언값)가 진실원 - 토글 off 후에도
        // 빌드 히스토리에 static 빌드가 남아 있으므로 히스토리로 판단하면 안 됨.
        setUseStatic(!!user?.site_enabled);
        if (staticLatest) {
          if (!serverLatest) {
            // 정적 단독 - 백엔드 OFF라 상단 공유칸이 없으므로 프론트 GitHub 링크에 복원.
            setStaticRepoUrl(staticLatest.repo_url.replace(/\.git$/, ""));
            setStaticBranch(staticLatest.branch || "");
          } else if (staticLatest.repo_url !== serverLatest.repo_url) {
            setStaticRepoUrl(staticLatest.repo_url.replace(/\.git$/, ""));
            if (staticLatest.branch !== serverLatest.branch) {
              setStaticBranch(staticLatest.branch || "");
            }
          }
          setStaticProjectPath(staticLatest.project_path || "");
          setBuildCmd(staticLatest.build_cmd ?? ""); // ""도 유효(빌드 없음) - ||로 덮으면 안 됨
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
        // 401 등 - 기본값 그대로
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.app_name]);

  // repo URL + branch 유효성 확인 (백엔드 GitHub 링크 기준).
  // 연결된 repo(installation)면 ghRepos/ghBranches로 판정 - unauthenticated 404 오판 방지
  // (private도 연결돼 있으면 접근 가능하므로 "찾을 수 없음"으로 떨어지면 안 됨).
  // 미연결이면 디바운스 500ms 후 unauthenticated GitHub API로 확인(공개 repo만; private은 notfound→연결 안내).
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

    // 연결된 저장소면 접근 가능 확정 - 브랜치 목록이 있으면 브랜치 존재까지 판정, 없으면 통과.
    const slug = `${owner}/${repo}`.toLowerCase();
    const connected = ghRepos.some(
      (r) => (r.full_name || "").toLowerCase() === slug,
    );
    if (connected) {
      if (ghBranches.length > 0) {
        const hasBranch = ghBranches.some((b) => b.name === br);
        setRepoCheck({ state: hasBranch ? "ok" : "notfound" });
      } else {
        setRepoCheck({ state: "ok" });
      }
      return;
    }

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
  }, [repoUrl, branch, ghRepos, ghBranches]);

  // repo가 유효하면 그 repo의 브랜치 목록을 받아 드롭다운 채움 (백엔드 경유 - private도).
  // repoCheck와 같은 500ms 디바운스. repo 형식이 안 맞으면 빈 목록.
  useEffect(() => {
    const url = repoUrl.trim();
    if (!url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/)) {
      setGhBranches([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      listGithubBranches(url)
        .then((bs) => !cancelled && setGhBranches(bs || []))
        .catch(() => !cancelled && setGhBranches([]));
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [repoUrl]);

  // 연결됨(installation 있음)이면 접근 가능한 repo 목록 받아 드롭다운 채움. 미연결/실패면 빈 배열.
  useEffect(() => {
    if (!user?.github_connected) {
      setGhRepos([]);
      return;
    }
    let cancelled = false;
    listGithubRepos()
      .then((repos) => !cancelled && setGhRepos(repos || []))
      .catch(() => !cancelled && setGhRepos([]));
    return () => {
      cancelled = true;
    };
  }, [user?.github_connected]);

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

  // runtime 변경 시 default 포트 자동 적용. 초기 복원 중에는 skip.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!restoredRef.current) return;
    const def = DEFAULT_PORTS[runtime];
    if (def) setPort(def);
  }, [runtime]);

  // dep 예약 키 맵 1회 로드 (로그인 후). 실패는 무시 — 백엔드 POST가 최종 방어선.
  useEffect(() => {
    if (!user) return;
    getReservedKeys().then(setReservedMap).catch(() => {});
  }, [user]);

  const serverNone = runtime === "none";
  // 도메인 안내 툴팁 표시용 이름 - 첫 배포 입력값/확정 app_name, 없으면 placeholder
  const appLabel = user?.app_name || name.trim() || "앱이름";
  // 1차 repo - 백엔드 ON이면 백엔드 링크, OFF(정적 단독)면 프론트 링크가 곧 repo.
  const primaryRepo = (serverNone ? staticRepoUrl : repoUrl).trim();
  // 서버도 정적도 없으면 배포할 게 없음 / 1차 repo 비면 불가
  const disabled = !primaryRepo || submitting || (serverNone && !useStatic);

  // 지금 켜진 dep들이 자동 주입하는 예약 키 집합 (서버 슬롯에만 env 주입되므로 serverNone이면 빈 집합).
  // env가 이 키와 충돌하면 Option A로 유저 값이 이겨 관리형 연결이 깨지므로 폼에서 미리 막는다.
  const activeReserved = (() => {
    const s = new Set();
    if (serverNone || !reservedMap) return s;
    if (dbType === "mysql" || dbType === "postgres")
      (reservedMap[dbType] || []).forEach((k) => s.add(k));
    if (useRedis) (reservedMap.redis || []).forEach((k) => s.add(k));
    if (storage === "object") (reservedMap.storage || []).forEach((k) => s.add(k));
    return s;
  })();
  const reservedConflicts = [
    ...new Set(envRows.map((r) => r.key.trim()).filter((k) => activeReserved.has(k))),
  ];

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (disabled) return;
    // 미로그인이면 API 호출 전에 LoginModal 띄움 (API도 401로 막지만 UX 단축)
    if (!user) {
      openLogin?.();
      return;
    }
    if (reservedConflicts.length > 0) {
      setError(
        `${reservedConflicts.join(", ")} 는 선택한 의존성이 자동 주입하는 예약 키예요. ` +
          `환경변수에서 빼거나 해당 의존성을 끄세요.`,
      );
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
    // 정적 빌드 타임 변수 - 동일 규칙
    const staticEnvDict = {};
    for (const { key, value } of staticEnvRows) {
      const k = key.trim();
      if (!k) continue;
      staticEnvDict[k] = value;
    }
    // 서버 사용 안 함이면 서버 전용 옵션(DB/캐시/스토리지/환경변수)은 무의미 - 폼 상태에 남은 옛 값 무시.
    const effectiveDbType = serverNone ? "none" : dbType;
    try {
      // 초기 DB 덤프가 있으면 먼저 stage → 토큰 발급 (mysql/postgres 선택 시에만 의미 있음).
      let initDumpToken = null;
      if ((effectiveDbType === "mysql" || effectiveDbType === "postgres") && initDumpFile) {
        const staged = await stageDump(initDumpFile);
        initDumpToken = staged.token;
      }
      await createDeploy({
        // 백엔드 OFF(정적 단독)면 프론트 링크가 곧 repo_url, static_repo_url은 비워 fallback.
        repoUrl: serverNone ? staticRepoUrl.trim() : repoUrl.trim(),
        // 첫 배포: 사용자가 입력한 이름 또는 자동 생성(서버 측). 두 번째부터는 user.app_name 재사용되니 보냄 의미 없음.
        name: isFirstDeploy ? name.trim() || undefined : undefined,
        branch: (serverNone ? staticBranch.trim() : branch.trim()) || "main",
        port: Number(port) || 80,
        runtime,                                   // "python" | "java" | "php" | "none"
        dbType: effectiveDbType,
        useRedis: serverNone ? false : useRedis,
        storage: serverNone ? "none" : storage,
        volumeMountPath: !serverNone && storage === "local" ? volumeMountPath.trim() : "",
        buildMode: serverNone ? "auto" : buildMode, // 서버 없으면 미사용 - 스키마 통과용 placeholder
        dockerfilePath:
          !serverNone && buildMode === "dockerfile" ? dockerfilePath.trim() || "Dockerfile" : "Dockerfile",
        projectPath:
          !serverNone && buildMode !== "dockerfile" ? projectPath.trim().replace(/^\/+|\/+$/g, "") : "",
        useStatic,
        // 백엔드 ON일 때만 별도 정적 repo/branch - OFF면 repo_url이 곧 정적 repo라 비움.
        staticRepoUrl: useStatic && !serverNone ? staticRepoUrl.trim() : "",
        staticBranch: useStatic && !serverNone ? staticBranch.trim() : "",
        staticProjectPath: useStatic ? staticProjectPath.trim().replace(/^\/+|\/+$/g, "") : "",
        buildCmd: useStatic ? buildCmd.trim() : "",
        outputDir: useStatic ? outputDir.trim() : "",
        staticEnv: useStatic ? staticEnvDict : {},
        env: serverNone ? {} : envDict,
        initDumpToken,
      });
      // 첫 배포면 user.app_name이 백엔드에 박혔으니 AuthContext 갱신 - Dashboard에서 즉시 반영
      if (isFirstDeploy) await refresh();
      // 커스텀 도메인 입력 시 - 배포로 app_name 확정됐으니 이어서 연결 (서브도메인 전용).
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

  // 백엔드/프론트 GitHub 링크 + 브랜치 입력 블록 - 백엔드 섹션의 1차 입력.
  // 연결 repo 인라인 리스트 + 브랜치 드롭다운 + 확인 상태를 한 묶음으로.
  const githubLinkBlock = (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
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
              border: "1px solid var(--line-3)",
              background: "var(--kd-surface)",
            }}
          >
            <GitBranch size={15} strokeWidth={1.6} className="text-fg-3 mr-2 shrink-0" />
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/username/repo"
              className="flex-1 bg-transparent outline-none text-[14px] text-fg-1 py-2 placeholder:text-fg-3"
              style={{ fontWeight: 510 }}
              disabled={submitting}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            {/* 접기 토글 - 연결됐으면 표시(repo 없어도), 링크칸 맨 오른쪽. 아래 박스 접힘/펼침 */}
            {user?.github_connected && (
              <button
                type="button"
                onClick={() => setRepoListCollapsed((v) => !v)}
                className="ml-2 shrink-0 text-fg-3 hover:text-fg-1 transition-colors"
                title={repoListCollapsed ? "연결된 저장소 목록 펼치기" : "접기"}
              >
                {repoListCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
              </button>
            )}
          </div>
          {/* 연결된 repo 박스 - 링크칸 바로 밑, 최대 3개 높이 + 위아래 스크롤. 선택하면 채우고 자동 접기.
              repo가 없어도 박스를 띄워 "연결된 저장소 없음"을 안내(저장소 추가 링크 포함). */}
          {user?.github_connected && !repoListCollapsed && (
            <div
              className="mt-1.5 rounded-md overflow-y-auto scroll-thin"
              style={{
                border: "1px solid var(--line-3)",
                background: "var(--kd-surface)",
                maxHeight: 96, // 항목 32px × 3 = 최대 3개, 넘으면 스크롤
              }}
            >
              {ghRepos.length > 0 ? (
                ghRepos.map((r) => (
                  <button
                    key={r.full_name}
                    type="button"
                    onClick={() => {
                      setRepoUrl(r.html_url);
                      setBranch(r.default_branch || "main");
                      setRepoListCollapsed(true); // 선택하면 자동 접기
                    }}
                    disabled={submitting}
                    className="w-full flex items-center justify-between px-3 text-left hover:bg-[var(--line-1)] transition-colors"
                    style={{ height: 32 }}
                  >
                    <span
                      className="truncate text-[12px] text-fg-2"
                      style={{ fontWeight: 510 }}
                    >
                      {r.full_name}
                    </span>
                    {r.private && (
                      <span className="ml-2 shrink-0 text-[10px] text-fg-4">private</span>
                    )}
                  </button>
                ))
              ) : (
                <div
                  className="px-3 py-2.5 text-[11px] text-fg-4"
                  style={{ fontWeight: 450 }}
                >
                  연결된 저장소가 없어요{" "}
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = GITHUB_INSTALL_URL;
                    }}
                    className="underline hover:text-fg-1 transition-colors"
                    style={{ color: "var(--accent)", fontWeight: 510 }}
                  >
                    저장소 추가
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="w-28 shrink-0 relative">
          <div
            className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
            style={{ fontWeight: 590 }}
          >
            브랜치
          </div>
          <div
            className="flex items-center rounded-md px-3"
            style={{
              border: "1px solid var(--line-3)",
              background: "var(--kd-surface)",
            }}
          >
            <input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="w-full min-w-0 bg-transparent outline-none text-[14px] text-fg-1 py-2 placeholder:text-fg-3"
              style={{ fontWeight: 510 }}
              disabled={submitting}
            />
            {/* 브랜치 드롭다운 토글 - 목록 있을 때만 */}
            {ghBranches.length > 0 && (
              <button
                type="button"
                onClick={() => setBranchOpen((v) => !v)}
                className="ml-1 shrink-0 text-fg-3 hover:text-fg-1 transition-colors"
                title="브랜치 목록"
              >
                <ChevronDown size={15} />
              </button>
            )}
          </div>
          {/* 브랜치 목록 - 칸이 좁아 absolute로 넓게(우측 정렬), 최대 3개 + 스크롤. 선택 시 채우고 닫힘 */}
          {branchOpen && ghBranches.length > 0 && (
            <div
              className="absolute right-0 z-20 mt-1 rounded-md overflow-y-auto scroll-thin"
              style={{
                border: "1px solid var(--line-3)",
                background: "var(--kd-surface)",
                minWidth: 180,
                maxHeight: 96,
              }}
            >
              {ghBranches.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => {
                    setBranch(b.name);
                    setBranchOpen(false);
                  }}
                  disabled={submitting}
                  className="w-full flex items-center justify-between px-3 text-left hover:bg-[var(--line-1)] transition-colors"
                  style={{ height: 32 }}
                >
                  <span
                    className="truncate text-[12px] text-fg-2"
                    style={{ fontWeight: 510 }}
                  >
                    {b.name}
                  </span>
                  {b.protected && (
                    <span className="ml-2 shrink-0 text-[10px] text-fg-4">protected</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 상태 줄 - 좌: private 저장소 연결 상태/버튼 / 우(맨 오른쪽): repo+브랜치 확인 결과. */}
      <div
        className="flex items-center justify-between gap-3 min-h-[16px] text-[11px]"
        style={{ fontWeight: 450 }}
      >
        <div className="min-w-0">
          {user &&
            (user.github_connected ? (
              <span className="text-fg-4">Private 저장소 연결됨</span>
            ) : (
              <span className="text-fg-4">
                Private 저장소예요?{" "}
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = GITHUB_INSTALL_URL;
                  }}
                  className="underline hover:text-fg-1 transition-colors"
                  style={{ color: "var(--accent)", fontWeight: 510 }}
                >
                  GitHub 연결하기
                </button>
              </span>
            ))}
        </div>
        <div className="shrink-0 text-right">
          {repoCheck.state === "checking" && (
            <span className="text-fg-4">저장소 확인 중…</span>
          )}
          {repoCheck.state === "ok" && (
            <span style={{ color: "var(--accent)" }}>저장소와 브랜치 확인됨</span>
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
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="kd-fade-in w-[520px] max-w-[90vw] mx-auto pb-12">
      <h2
        className="text-[22px] text-fg-1 mb-2"
        style={{ fontWeight: 510, letterSpacing: -0.5 }}
      >
        GitHub 저장소 배포
      </h2>
      <p className="text-[13px] text-fg-3 mb-6">
        백엔드·프론트엔드를 켜고 저장소를 넣으면 빌드 후 클러스터에 자동 배포해요
      </p>

      {/* ===== 백엔드 섹션 - 사용 안 함/사용하기 토글. 켜면 GitHub·런타임·DB + 고급옵션. ===== */}
      <div className="mb-6">
        <div className="text-[13px] text-fg-2 mb-2.5" style={{ fontWeight: 590 }}>
          백엔드
        </div>
        <div className="flex gap-1.5">
          {[
            { on: false, name: "사용 안 함" },
            { on: true, name: "사용하기" },
          ].map((opt) => {
            const active = !serverNone === opt.on;
            return (
              <button
                key={String(opt.on)}
                type="button"
                onClick={() => setRuntime(opt.on ? RUNTIMES[0] : "none")}
                className="flex-1 h-10 rounded-lg text-[13px] transition-colors flex items-center justify-center"
                style={choiceStyle(active)}
                disabled={submitting}
              >
                {opt.name}
              </button>
            );
          })}
        </div>

        {!serverNone && (
          <div className="mt-5 flex flex-col gap-5">
            {/* GitHub 링크 + 브랜치 + 확인 상태 */}
            {githubLinkBlock}

            {/* 런타임 3지선다 */}
            <div>
              <div
                className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2.5"
                style={{ fontWeight: 590 }}
              >
                런타임
              </div>
              <div className="flex gap-1.5">
                {RUNTIMES.map((r) => {
                  const meta = RUNTIME_META[r] || { name: r, tag: "" };
                  const active = runtime === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRuntime(r)}
                      className="flex-1 h-10 rounded-lg text-[13px] transition-colors flex items-center justify-center"
                      style={choiceStyle(active)}
                      disabled={submitting}
                    >
                      {meta.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DB - 한 앱에 한 DB만 (mysql/postgres 동시 사용 X). */}
            <div>
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
                      style={choiceStyle(active)}
                      disabled={submitting}
                    >
                      {d.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 백엔드 고급 옵션 - 빌드방식·포트·캐시·저장소·환경변수·초기데이터. 기본 접힘. */}
            <div>
              <button
                type="button"
                onClick={() => setShowServerAdvanced((v) => !v)}
                className="w-full flex items-center gap-2 py-1 text-fg-3 hover:text-fg-1 transition-colors"
              >
                <ChevronDown
                  size={14}
                  strokeWidth={2}
                  className="transition-transform"
                  style={{ transform: showServerAdvanced ? "rotate(0deg)" : "rotate(-90deg)" }}
                />
                <span className="text-[10.5px] tracking-[0.08em]" style={{ fontWeight: 590 }}>
                  고급 옵션
                </span>
                <span className="text-[11px] text-fg-4" style={{ fontWeight: 450 }}>
                  빌드 방식 · 캐시 · 저장소 · 환경변수
                </span>
              </button>

              {showServerAdvanced && (
                <div
                  className="mt-3 flex flex-col gap-6 px-4 py-4 rounded-xl"
                  style={{
                    border: "1px solid var(--line-2)",
                    background: "var(--kd-surface)",
                  }}
                >
                  {/* Build mode - 서버 빌드 방식 + 포트 */}
                  <div>
                    <div className="flex gap-3">
                      <div className={buildMode === "auto" ? "w-full" : "flex-1"}>
                        <div className="flex items-center gap-1 mb-2.5">
                          <span className="text-[10.5px] tracking-[0.08em] text-fg-3" style={{ fontWeight: 590 }}>
                            빌드 방식
                          </span>
                          <InfoHint>
                            <b style={{ color: "var(--fg-1)", fontWeight: 590 }}>선택 안 함</b> - Dockerfile 있으면 그걸로, 없으면 Nixpacks 자동 빌드<br />
                            <b style={{ color: "var(--fg-1)", fontWeight: 590 }}>Dockerfile</b> - 내 Dockerfile로 빌드<br />
                            <b style={{ color: "var(--fg-1)", fontWeight: 590 }}>자동 빌드</b> - Dockerfile 무시하고 Nixpacks로 빌드
                          </InfoHint>
                          {buildMode === "dockerfile" && (
                            <button
                              type="button"
                              onClick={() => onRequestGuide?.(runtime)}
                              className="ml-auto text-[11px] text-fg-3 hover:text-fg-1 transition-colors"
                              style={{ fontWeight: 510 }}
                            >
                              가이드 보기
                            </button>
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          {[
                            { id: "detect", name: "선택 안 함" },
                            { id: "dockerfile", name: "Dockerfile" },
                            { id: "auto", name: "자동 빌드" },
                          ].map((m) => {
                            const active = buildMode === m.id;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setBuildMode(m.id)}
                                className="flex-1 h-10 rounded-lg text-[13px] transition-all flex items-center justify-center"
                                style={choiceStyle(active)}
                                disabled={submitting}
                              >
                                {m.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {buildMode !== "auto" && (
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
                              border: "1px solid var(--line-3)",
                              background: "var(--kd-surface)",
                              fontWeight: 510,
                            }}
                            disabled={submitting}
                          />
                        </div>
                      )}
                    </div>
                    {buildMode === "dockerfile" && (
                      <div className="mt-3">
                        <div className="flex items-center gap-1 mb-2">
                          <span className="text-[10.5px] tracking-[0.08em] text-fg-3" style={{ fontWeight: 590 }}>
                            Dockerfile 경로
                          </span>
                          <InfoHint>
                            프로젝트 루트에 Dockerfile이 있어야 합니다 서브 디렉토리에 있으면 <span style={{ color: "var(--fg-1)" }}>subdir/Dockerfile</span> 같이 입력
                          </InfoHint>
                        </div>
                        <input
                          value={dockerfilePath}
                          onChange={(e) => setDockerfilePath(e.target.value)}
                          placeholder="Dockerfile"
                          className="w-full bg-transparent outline-none text-fg-1 text-[14px] rounded-md px-3 py-2 placeholder:text-fg-3"
                          style={{
                            border: "1px solid var(--line-3)",
                            background: "var(--kd-surface)",
                            fontWeight: 510,
                          }}
                          disabled={submitting}
                        />
                      </div>
                    )}
                    {buildMode !== "dockerfile" && (
                      <div className="mt-3">
                        <div className="flex items-center gap-1 mb-2">
                          <span className="text-[10.5px] tracking-[0.08em] text-fg-3" style={{ fontWeight: 590 }}>
                            앱 디렉토리 (선택)
                          </span>
                          <InfoHint>
                            <span style={{ color: "var(--fg-1)" }}>pom.xml</span>, <span style={{ color: "var(--fg-1)" }}>requirements.txt</span> 같은 파일이 있는 폴더 경로를 입력하세요 모노레포·비표준 구조면 자동 탐색이 실패할 수 있어요
                          </InfoHint>
                        </div>
                        <input
                          value={projectPath}
                          onChange={(e) => setProjectPath(e.target.value)}
                          placeholder="비워두면 자동 탐색 (예: backend)"
                          className="w-full bg-transparent outline-none text-fg-1 text-[14px] rounded-md px-3 py-2 placeholder:text-fg-3"
                          style={{
                            border: "1px solid var(--line-3)",
                            background: "var(--kd-surface)",
                            fontWeight: 510,
                          }}
                          disabled={submitting}
                        />
                      </div>
                    )}
                  </div>

                  {/* 캐시 */}
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
                            style={choiceStyle(active)}
                            disabled={submitting}
                          >
                            {r.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 영속 저장소 - none=ephemeral / local=PVC(mount_path) / object=R2. */}
                  <div>
                    <div className="flex items-center gap-1 mb-2.5">
                      <span className="text-[10.5px] tracking-[0.08em] text-fg-3" style={{ fontWeight: 590 }}>
                        영속 저장소
                      </span>
                      <InfoHint>
                        <b style={{ color: "var(--fg-1)", fontWeight: 590 }}>사용 안 함</b> - 임시 디스크만(재배포 시 초기화)<br />
                        <b style={{ color: "var(--fg-1)", fontWeight: 590 }}>로컬(PVC)</b> - 지정 절대경로에 영속 디스크 마운트, 재시작·재배포에도 데이터 유지(예: <span style={{ color: "var(--fg-1)" }}>/var/www/html/data</span>)<br />
                        <b style={{ color: "var(--fg-1)", fontWeight: 590 }}>오브젝트(R2)</b> - 앱당 R2 버킷 + S3 호환 자격증명 자동 주입
                      </InfoHint>
                      {storage !== "none" && (
                        <button
                          type="button"
                          onClick={() => onRequestGuide?.("storage")}
                          className="ml-auto text-[11px] text-fg-3 hover:text-fg-1 transition-colors"
                          style={{ fontWeight: 510 }}
                        >
                          가이드 보기
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      {[
                        { id: "none", name: "사용 안 함" },
                        { id: "local", name: "로컬 (PVC)" },
                        { id: "object", name: "오브젝트 (R2)" },
                      ].map((s) => {
                        const active = storage === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setStorage(s.id)}
                            className="flex-1 h-10 rounded-lg text-[13px] transition-colors flex items-center justify-center"
                            style={choiceStyle(active)}
                            disabled={submitting}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                    {storage === "local" && (
                      <div className="mt-2">
                        <input
                          value={volumeMountPath}
                          onChange={(e) => setVolumeMountPath(e.target.value)}
                          placeholder="/var/www/html/data"
                          spellCheck={false}
                          autoCapitalize="off"
                          className="w-full px-2.5 py-1.5 rounded-md bg-transparent outline-none text-[12.5px] text-fg-1 placeholder:text-fg-4"
                          style={{ border: "1px solid var(--line-3)", fontWeight: 510 }}
                          disabled={submitting}
                        />
                      </div>
                    )}
                  </div>

                  {/* 환경변수 - 서버 슬롯 전용 (정적 nginx는 안 읽음) */}
                  <div>
                    <div className="flex items-center gap-1 mb-2.5">
                      <span className="text-[10.5px] tracking-[0.08em] text-fg-3" style={{ fontWeight: 590 }}>
                        환경변수 (선택)
                      </span>
                      <InfoHint>
                        빈 KEY row는 무시돼요 빈 값으로 두면 환경변수 변경 없이 빌드만 트리거
                      </InfoHint>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {envRows.map((row, i) => {
                        const conflict =
                          !!row.key.trim() && activeReserved.has(row.key.trim());
                        return (
                        <div key={i} className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
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
                              border: conflict
                                ? "1px solid rgba(239,68,68,0.5)"
                                : "1px solid var(--line-3)",
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
                              border: "1px solid var(--line-3)",
                              fontWeight: 510,
                            }}
                            disabled={submitting}
                          />
                          <button
                            type="button"
                            onClick={() => toggleEnvVisible(i)}
                            className="w-7 h-7 rounded-md text-fg-4 hover:text-fg-1 hover:bg-[var(--line-1)] flex items-center justify-center shrink-0"
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
                            className="w-7 h-7 rounded-md text-fg-4 hover:text-red-300 hover:bg-[var(--line-1)] flex items-center justify-center shrink-0"
                            title="삭제"
                          >
                            <Trash2 size={12} strokeWidth={1.8} />
                          </button>
                        </div>
                        {conflict && (
                          <span
                            className="text-[10.5px] px-1"
                            style={{ color: "var(--err-fg)", fontWeight: 450 }}
                          >
                            선택한 의존성이 자동 주입하는 예약 키예요 — 빼거나 해당 의존성을 끄세요
                          </span>
                        )}
                        </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={addEnvRow}
                      className="mt-3 flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] text-fg-3 hover:text-fg-1 hover:bg-[var(--line-1)]"
                      style={{ fontWeight: 510 }}
                    >
                      <Plus size={11} strokeWidth={2} /> 변수 추가
                    </button>
                  </div>

                  {/* 초기 데이터 - DB(mysql/postgres) 선택 시에만. 배포 후 DB Ready되면 자동 복원. */}
                  {(dbType === "mysql" || dbType === "postgres") && (
                    <div>
                      <div className="flex items-center gap-1 mb-2.5">
                        <span className="text-[10.5px] tracking-[0.08em] text-fg-3" style={{ fontWeight: 590 }}>
                          초기 데이터 (선택)
                        </span>
                        <InfoHint>
                          .sql · .sql.gz 덤프를 올리면 배포 후 DB에 자동 복원돼요 기존 데이터를 덮어씁니다
                        </InfoHint>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <label
                          className="px-3 py-1.5 rounded-lg text-[12px] cursor-pointer shrink-0 transition-colors"
                          style={{ background: "var(--line-1)", color: "var(--fg-1)", fontWeight: 510, border: "1px solid var(--line-2)" }}
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
                        <span className="text-[11px] truncate min-w-0" style={{ color: initDumpFile ? "var(--fg-1)" : "var(--fg-4)" }}>
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
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== 프론트엔드 섹션 - 백엔드와 대칭. 켜면 GitHub·빌드 + 고급옵션(빌드 타임 변수). ===== */}
      <div className="mb-6" style={{ borderTop: "1px solid var(--line-2)", paddingTop: 24 }}>
        <div className="flex items-center gap-2 mb-2.5">
          <div className="text-[13px] text-fg-2" style={{ fontWeight: 590 }}>
            프론트엔드
          </div>
          {useStatic && (
            <button
              type="button"
              onClick={() => onRequestGuide?.("static")}
              className="text-[11px] text-fg-3 hover:text-fg-1 transition-colors"
              style={{ fontWeight: 510 }}
            >
              가이드
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          {[
            { on: false, name: "사용 안 함" },
            { on: true, name: "사용하기" },
          ].map((opt) => {
            const active = useStatic === opt.on;
            return (
              <button
                key={String(opt.on)}
                type="button"
                onClick={() => setUseStatic(opt.on)}
                className="flex-1 h-10 rounded-lg text-[13px] transition-colors flex items-center justify-center"
                style={choiceStyle(active)}
                disabled={submitting}
              >
                {opt.name}
              </button>
            );
          })}
        </div>

        {useStatic && (
          <div className="mt-5 flex flex-col gap-5">
            {/* 정적 GitHub 링크 + 브랜치 - 프론트 핵심. 백엔드 ON이면 비울 시 백엔드와 동일, OFF면 필수. */}
            <div className="flex gap-3">
              <div className="flex-1">
                <div
                  className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
                  style={{ fontWeight: 590 }}
                >
                  GitHub 링크{!serverNone && " (선택)"}
                </div>
                <div
                  className="flex items-center rounded-md px-3"
                  style={{ border: "1px solid var(--line-3)", background: "var(--kd-surface)" }}
                >
                  <GitBranch size={15} strokeWidth={1.6} className="text-fg-3 mr-2 shrink-0" />
                  <input
                    value={staticRepoUrl}
                    onChange={(e) => setStaticRepoUrl(e.target.value)}
                    placeholder={serverNone ? "https://github.com/username/repo" : "비우면 백엔드와 동일"}
                    spellCheck={false}
                    className="flex-1 min-w-0 bg-transparent outline-none text-fg-1 text-[14px] py-2 placeholder:text-fg-3"
                    style={{ fontWeight: 510 }}
                    disabled={submitting}
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
                  value={staticBranch}
                  onChange={(e) => setStaticBranch(e.target.value)}
                  placeholder={serverNone ? "main" : (branch.trim() || "main")}
                  className="w-full bg-[var(--line-1)] outline-none text-fg-1 text-[14px] rounded-md px-3 py-2 placeholder:text-fg-3"
                  style={{
                    border: "1px solid var(--line-3)",
                    fontWeight: 510,
                  }}
                  disabled={submitting}
                />
              </div>
            </div>

            {/* 앱 디렉토리 - 모노레포 프론트 폴더 (정적은 마커 자동탐색 불가, 수동 지정). 코어에 노출(고급옵션 아님). */}
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
                className="w-full bg-[var(--line-1)] outline-none text-fg-1 text-[14px] rounded-md px-3 py-2 placeholder:text-fg-3"
                style={{
                  border: "1px solid var(--line-3)",
                  fontWeight: 510,
                }}
                disabled={submitting}
              />
            </div>

            {/* 프론트 고급 옵션 - 빌드 커맨드·출력·빌드 타임 변수. 백엔드와 대칭. 기본 접힘. */}
            <div>
              <button
                type="button"
                onClick={() => setShowStaticAdvanced((v) => !v)}
                className="w-full flex items-center gap-2 py-1 text-fg-3 hover:text-fg-1 transition-colors"
              >
                <ChevronDown
                  size={14}
                  strokeWidth={2}
                  className="transition-transform"
                  style={{ transform: showStaticAdvanced ? "rotate(0deg)" : "rotate(-90deg)" }}
                />
                <span className="text-[10.5px] tracking-[0.08em]" style={{ fontWeight: 590 }}>
                  고급 옵션
                </span>
                <span className="text-[11px] text-fg-4" style={{ fontWeight: 450 }}>
                  빌드 커맨드 · 출력 · 빌드 타임 변수
                </span>
              </button>

              {showStaticAdvanced && (
                <div
                  className="mt-3 flex flex-col gap-5 px-4 py-4 rounded-xl"
                  style={{
                    border: "1px solid var(--line-2)",
                    background: "var(--kd-surface)",
                  }}
                >
                  {/* 빌드 커맨드 + 출력 디렉토리 */}
                  <div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-1 mb-2">
                          <span className="text-[10.5px] tracking-[0.08em] text-fg-3" style={{ fontWeight: 590 }}>
                            빌드 커맨드
                          </span>
                          <InfoHint>
                            빌드 결과물(출력 디렉토리)만 서빙돼요 - Vite는 <span style={{ color: "var(--fg-1)" }}>dist</span>, CRA는 <span style={{ color: "var(--fg-1)" }}>build</span> 커맨드를 비우면 빌드 없이 저장소 파일을 그대로 서빙합니다(순수 HTML)
                          </InfoHint>
                        </div>
                        <input
                          value={buildCmd}
                          onChange={(e) => setBuildCmd(e.target.value)}
                          placeholder="npm ci && npm run build"
                          spellCheck={false}
                          className="w-full bg-[var(--line-1)] outline-none text-fg-1 text-[14px] rounded-md px-3 py-2 placeholder:text-fg-3"
                          style={{
                            border: "1px solid var(--line-3)",
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
                          className="w-full bg-[var(--line-1)] outline-none text-fg-1 text-[14px] rounded-md px-3 py-2 placeholder:text-fg-3"
                          style={{
                            border: "1px solid var(--line-3)",
                            fontWeight: 510,
                          }}
                          disabled={submitting}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 빌드 타임 변수 - 빌드 스테이지 ENV로 주입. 번들에 박혀 공개되므로 시크릿 금지. */}
                  <div>
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-[10.5px] tracking-[0.08em] text-fg-3" style={{ fontWeight: 590 }}>
                      빌드 타임 변수 (선택)
                    </span>
                    <InfoHint>
                      <span style={{ color: "var(--fg-1)" }}>VITE_</span> 같은 빌드 타임 값은 번들에 박혀 공개되니 시크릿 금지, 서버 환경변수(백엔드 고급 옵션)와는 별개
                    </InfoHint>
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
                            border: "1px solid var(--line-3)",
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
                            border: "1px solid var(--line-3)",
                            fontWeight: 510,
                          }}
                          disabled={submitting}
                        />
                        <button
                          type="button"
                          onClick={() => removeStaticEnvRow(i)}
                          className="w-7 h-7 rounded-md text-fg-4 hover:text-red-300 hover:bg-[var(--line-1)] flex items-center justify-center shrink-0"
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
                    className="mt-2.5 flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] text-fg-3 hover:text-fg-1 hover:bg-[var(--line-1)]"
                    style={{ fontWeight: 510 }}
                  >
                    <Plus size={11} strokeWidth={2} /> 변수 추가
                  </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== 도메인 - 백엔드/프론트와 별개. 첫 배포에만 입력, 이후 고정. ===== */}
      <div className="mb-1" style={{ borderTop: "1px solid var(--line-2)", paddingTop: 24 }}>
        <div className="flex items-center gap-1 mb-2.5">
          <span className="text-[13px] text-fg-2" style={{ fontWeight: 590 }}>
            도메인
          </span>
          <InfoHint>
            <b style={{ color: "var(--fg-1)", fontWeight: 590 }}>백엔드만</b><br />
            - {appLabel}.kodeploy.com<br />
            <b style={{ color: "var(--fg-1)", fontWeight: 590 }}>프론트만</b><br />
            - {appLabel}.kodeploy.com<br />
            <b style={{ color: "var(--fg-1)", fontWeight: 590 }}>프론트+백엔드</b><br />
            - 프론트 = {appLabel}.kodeploy.com<br />
            - 백엔드 = {appLabel}-api.kodeploy.com
          </InfoHint>
        </div>
        {isFirstDeploy ? (
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="비워두면 자동으로 채워져요"
              className="bg-transparent outline-none text-fg-1 text-[14px] rounded-md px-3 py-2 w-1/2 placeholder:text-fg-3"
              style={{
                border: "1px solid var(--line-3)",
                background: "var(--kd-surface)",
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
              border: "1px solid var(--line-2)",
              background: "var(--kd-surface)",
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

      {/* ===== 커스텀 도메인 - 도메인 아래 독립 접이식 박스(고급옵션형 디자인). 서브도메인 전용. ===== */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setShowCustomDomain((v) => !v)}
          className="w-full flex items-center gap-2 py-2 text-fg-3 hover:text-fg-1 transition-colors"
        >
          <ChevronDown
            size={14}
            strokeWidth={2}
            className="transition-transform"
            style={{ transform: showCustomDomain ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
          <span className="text-[10.5px] tracking-[0.08em]" style={{ fontWeight: 590 }}>
            커스텀 도메인
          </span>
          <span className="text-[11px] text-fg-4" style={{ fontWeight: 450 }}>
            선택 · 내 도메인 연결
          </span>
        </button>

        {showCustomDomain && (
          <div
            className="mt-3 px-4 py-4 rounded-xl"
            style={{
              border: "1px solid var(--line-2)",
              background: "var(--kd-surface)",
            }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1">
                <span className="text-[10.5px] tracking-[0.08em] text-fg-3" style={{ fontWeight: 590 }}>
                  커스텀 도메인 (선택)
                </span>
                <InfoHint>
                  <b style={{ color: "var(--fg-1)", fontWeight: 590 }}>서브도메인만</b> 가능 (예: app.example.com)<br />
                  배포 후 위 CNAME을 DNS에 추가하면 인증서 자동 발급 (루트 apex 미지원)<br />
                  <b style={{ color: "var(--fg-1)", fontWeight: 590 }}>프론트+백엔드</b> = 프론트에 연결<br />
                  <b style={{ color: "var(--fg-1)", fontWeight: 590 }}>백엔드만</b> = 백엔드에 연결
                </InfoHint>
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
              style={{ border: "1px solid var(--line-3)", fontWeight: 510 }}
              disabled={submitting}
            />
            {customDomain.trim() && (
              <div
                className="mt-2 flex items-center gap-2 px-2.5 py-2 rounded-md text-[11.5px]"
                style={{ background: "var(--line-1)", border: "1px solid var(--line-2)", fontWeight: 510 }}
              >
                <span className="text-fg-4 w-12 shrink-0">CNAME</span>
                <span className="text-fg-2 truncate">{customDomain.trim()}</span>
                <span className="text-fg-4 shrink-0">→</span>
                <span className="text-[var(--brand-fg)] truncate flex-1">{CUSTOM_DOMAIN_CNAME_TARGET}</span>
              </div>
            )}
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
            <span className="w-3.5 h-3.5 rounded-full border-2 border-[var(--line-3)] border-t-white kd-spin" />
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
            color: "var(--err-fg)",
          }}
        >
          {error}
        </div>
      )}
    </form>
  );
}
