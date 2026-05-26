// API base는 빌드 시 VITE_API_BASE로 주입 (없으면 같은 origin 사용)
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",                       // cookie session 첨부
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {}
    const err = new Error(`${res.status} ${detail}`);
    err.status = res.status;                      // UI에서 401 분기 가능
    throw err;
  }
  return res.json();
}

// 백엔드 schemas.Runtime과 sync (python/java). 추가 시 UI dropdown도 같이.
export const RUNTIMES = ["python", "java"];
// 백엔드 schemas.BuildMode와 sync ("dockerfile"=유저 Dockerfile / "auto"=nixpacks 자동)
export const BUILD_MODES = ["dockerfile", "auto"];
// 백엔드 schemas.DbType과 sync — 한 앱에 한 DB만
export const DB_TYPES = ["none", "mysql", "postgres"];

export function createDeploy({
  repoUrl,
  branch = "main",
  port = 80,
  runtime,
  name,
  dbType = "none",
  buildMode = "dockerfile",
  dockerfilePath = "Dockerfile",
  projectPath = "",
  env = {},
}) {
  return request("/deploy", {
    method: "POST",
    body: JSON.stringify({
      repo_url: repoUrl,
      branch,
      port,
      runtime,
      name: name?.trim() || null,                 // 빈 값이면 서버가 app-<hex8> 자동 생성
      db_type: dbType,                            // "none" | "mysql" | "postgres"
      build_mode: buildMode,                      // "dockerfile" | "auto"(nixpacks)
      dockerfile_path: dockerfilePath || "Dockerfile",
      project_path: projectPath || "",            // auto 모드 — 서브디렉토리. 빈 값=repo root
      env,                                        // 첫 배포: Secret 생성. 재배포: replace. 빈 dict면 backend가 무시.
    }),
  });
}

export function getBuild(buildId) {
  return request(`/deploy/${buildId}`);
}

export function listBuilds() {
  return request("/deploy");
}

// 최근 GitHub 커밋 (public repo만 — backend가 unauthenticated로 호출).
// 응답: [{sha, message, author, date, url}, ...]
export function listRecentCommits() {
  return request("/deploy/commits");
}

// 사용자 앱 환경변수 — {app_name}-env Secret을 진실원으로 GET/PUT.
// 첫 배포 전이거나 한 번도 설정 안 했으면 빈 dict.
export function getEnvVars() {
  return request("/deploy/env");
}

// 전체 replace — 보낸 dict가 새 전체 상태. 저장 직후 Pod 자동 재시작.
export function setEnvVars(env) {
  return request("/deploy/env", {
    method: "PUT",
    body: JSON.stringify({ env }),
  });
}

// 앱 완전 삭제 — K8s 리소스 + PVC + builds + user.app_name 리셋.
// 응답 후 AuthContext.refresh()로 user 재조회해야 UI가 empty state로 전환됨.
export function deleteApp() {
  return request("/deploy/app", { method: "DELETE" });
}

// 현재 앱 Pod 상태 — 빌드와 독립. 응답: { status: "running" | "pending" | "crashing" | "missing" }
export function getAppStatus() {
  return request("/deploy/app/status");
}

// 런타임 로그 스냅샷 (현재 + 이전 인스턴스)
export function getAppLogs() {
  return request("/deploy/app/logs");
}
