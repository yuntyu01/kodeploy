const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
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
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export function listPosts() {
  return request("/community");
}

// velog 블로그 글 목록 — 백엔드 RSS 프록시 (1시간 캐시).
// 응답: [{title, url, thumbnail, date, description}, ...]. 실패 시 [].
export function listBlogPosts() {
  return request("/community/blog");
}

export function getPost(id) {
  return request(`/community/${id}`);
}

export function createPost({ content, isSecret = false }) {
  return request("/community", {
    method: "POST",
    body: JSON.stringify({ content, is_secret: isSecret }),
  });
}

export function createComment(postId, { content, isSecret = false }) {
  return request(`/community/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content, is_secret: isSecret }),
  });
}

export function deletePost(id) {
  return request(`/community/${id}`, { method: "DELETE" });
}

export function deleteComment(id) {
  return request(`/community/comments/${id}`, { method: "DELETE" });
}
