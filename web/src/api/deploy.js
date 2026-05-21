// API base는 빌드 시 VITE_API_BASE로 주입 (없으면 같은 origin 사용)
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {}
    throw new Error(`${res.status} ${detail}`);
  }
  return res.json();
}

// 백엔드 schemas.Runtime과 sync (python/java). 추가 시 UI dropdown도 같이.
export const RUNTIMES = ["python", "java"];
// 백엔드 schemas.BuildMode와 sync ("dockerfile"=유저 Dockerfile / "auto"=nixpacks 자동)
export const BUILD_MODES = ["dockerfile", "auto"];

export function createDeploy({
  repoUrl,
  branch = "main",
  port = 80,
  runtime,
  name,
  useDb = false,
  buildMode = "dockerfile",
  dockerfilePath = "Dockerfile",
  projectPath = "",
}) {
  return request("/deploy", {
    method: "POST",
    body: JSON.stringify({
      repo_url: repoUrl,
      branch,
      port,
      runtime,
      name: name?.trim() || null,                 // 빈 값이면 서버가 app-<hex8> 자동 생성
      use_db: useDb,                              // true면 같은 ns에 mysql 자동 프로비저닝
      build_mode: buildMode,                      // "dockerfile" | "auto"(nixpacks)
      dockerfile_path: dockerfilePath || "Dockerfile",
      project_path: projectPath || "",            // auto 모드 — 서브디렉토리. 빈 값=repo root
    }),
  });
}

export function getBuild(buildId) {
  return request(`/deploy/${buildId}`);
}

export function listBuilds() {
  return request("/deploy");
}
