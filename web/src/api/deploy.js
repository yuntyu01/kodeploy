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

export function createDeploy({ repoUrl, branch = "main", port = 80 }) {
  return request("/deploy", {
    method: "POST",
    body: JSON.stringify({ repo_url: repoUrl, branch, port }),
  });
}

export function getBuild(buildId) {
  return request(`/deploy/${buildId}`);
}

export function listBuilds() {
  return request("/deploy");
}
