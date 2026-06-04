import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Lock,
  MessageSquare,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import {
  createComment,
  createPost,
  deleteComment,
  deletePost,
  getPost,
  listBlogPosts,
  listPosts,
} from "../api/community.js";
import { useAuth } from "../contexts/AuthContext.jsx";

const SECTIONS = [
  { id: "blog", label: "블로그", icon: Pencil },
  { id: "feedback", label: "건의사항", icon: MessageSquare },
];

// 블로그 글은 백엔드 RSS 프록시(/community/blog)에서 — 새 글 발행 시 재배포 불필요.
function BlogSection() {
  const [posts, setPosts] = useState(null);             // null=로딩 중, []=실패/없음

  useEffect(() => {
    let alive = true;
    listBlogPosts()
      .then((data) => alive && setPosts(data))
      .catch(() => alive && setPosts([]));
    return () => {
      alive = false;
    };
  }, []);

  if (posts === null) {
    return (
      <div className="text-[13px] text-fg-4 py-8" style={{ fontWeight: 450 }}>
        블로그 글을 불러오는 중…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {posts.length === 0 && (
        <div className="text-[13px] text-fg-4 py-8" style={{ fontWeight: 450 }}>
          글을 불러오지 못했어요 — 아래 시리즈 링크에서 직접 볼 수 있습니다.
        </div>
      )}
      {posts.map((post, i) => (
        <a
          key={i}
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex gap-6 rounded-xl overflow-hidden no-underline transition-all p-5"
          style={{
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(129,139,224,0.25)";
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {post.thumbnail && (
            <div
              className="shrink-0 rounded-lg overflow-hidden"
              style={{ width: 260, height: 160 }}
            >
              <img
                src={post.thumbnail}
                alt=""
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <span
                className="text-[11px] px-2 py-0.5 rounded"
                style={{
                  background: "rgba(129,139,224,0.12)",
                  color: "#818be0",
                  fontWeight: 590,
                }}
              >
                velog
              </span>
              <span className="text-[12px] text-fg-4" style={{ fontWeight: 450 }}>
                {post.date}
              </span>
            </div>
            <h3
              className="text-[16px] text-fg-1 mb-1.5 line-clamp-2"
              style={{ fontWeight: 590, letterSpacing: -0.3, lineHeight: 1.4 }}
            >
              {post.title}
            </h3>
            <p
              className="text-[13px] text-fg-3 line-clamp-2"
              style={{ fontWeight: 450, lineHeight: 1.5 }}
            >
              {post.description}
            </p>
          </div>
        </a>
      ))}
      <a
        href="https://velog.io/@yun60/series/KoDeploy"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[13px] text-[#818be0] hover:text-[#a4abee] transition-colors no-underline mt-2"
        style={{ fontWeight: 510 }}
      >
        시리즈 전체 보기
        <ExternalLink size={12} strokeWidth={2} />
      </a>
    </div>
  );
}

function FeedbackSection() {
  const { user, openLogin } = useAuth();
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [writing, setWriting] = useState(false);
  const [content, setContent] = useState("");
  const [isSecret, setIsSecret] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSecret, setCommentSecret] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    try {
      const data = await listPosts();
      setPosts(data);
    } catch {}
    setLoading(false);
  };

  const fetchDetail = async (id) => {
    try {
      const data = await getPost(id);
      setSelectedPost(data);
    } catch {}
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    try {
      await createPost({ content: content.trim(), isSecret });
      setContent("");
      setIsSecret(false);
      setWriting(false);
      fetchPosts();
    } catch {}
  };

  const handleComment = async () => {
    if (!commentText.trim() || !selectedPost) return;
    try {
      await createComment(selectedPost.id, { content: commentText.trim(), isSecret: commentSecret });
      setCommentText("");
      setCommentSecret(false);
      fetchDetail(selectedPost.id);
    } catch {}
  };

  const handleDeletePost = async (id) => {
    try {
      await deletePost(id);
      setSelectedPost(null);
      fetchPosts();
    } catch {}
  };

  const handleDeleteComment = async (id) => {
    try {
      await deleteComment(id);
      if (selectedPost) fetchDetail(selectedPost.id);
    } catch {}
  };

  if (selectedPost) {
    return (
      <div>
        <button
          onClick={() => setSelectedPost(null)}
          className="flex items-center gap-1.5 text-[13px] text-fg-3 hover:text-fg-1 mb-4 transition-colors"
          style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 510 }}
        >
          <ArrowLeft size={14} strokeWidth={2} /> 목록으로
        </button>
        <div className="px-5 py-4 rounded-xl mb-4" style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[13px] text-fg-1" style={{ fontWeight: 510 }}>{selectedPost.author}</span>
            {selectedPost.is_secret && <Lock size={12} className="text-fg-4" />}
            <span className="text-[11px] text-fg-4 ml-auto">{new Date(selectedPost.created_at).toLocaleDateString("ko")}</span>
            {selectedPost.is_mine && (
              <button onClick={() => handleDeletePost(selectedPost.id)} className="text-fg-4 hover:text-red-300 transition-colors" style={{ background: "none", border: "none", cursor: "pointer" }}>
                <Trash2 size={13} strokeWidth={1.8} />
              </button>
            )}
          </div>
          <p className="text-[14px] text-fg-1" style={{ fontWeight: 450, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{selectedPost.content}</p>
        </div>

        <div className="mb-4">
          <div className="text-[12px] text-fg-3 mb-3" style={{ fontWeight: 510 }}>댓글 {selectedPost.comments.length}개</div>
          <div className="flex flex-col gap-2">
            {selectedPost.comments.map((c) => (
              <div key={c.id} className="px-4 py-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] text-fg-2" style={{ fontWeight: 510 }}>{c.author}</span>
                  {c.is_secret && <Lock size={11} className="text-fg-4" />}
                  <span className="text-[11px] text-fg-4 ml-auto">{new Date(c.created_at).toLocaleDateString("ko")}</span>
                  {c.is_mine && (
                    <button onClick={() => handleDeleteComment(c.id)} className="text-fg-4 hover:text-red-300 transition-colors" style={{ background: "none", border: "none", cursor: "pointer" }}>
                      <Trash2 size={12} strokeWidth={1.8} />
                    </button>
                  )}
                </div>
                <p className="text-[13px] text-fg-1" style={{ fontWeight: 450, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.content}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="댓글을 입력하세요"
            className="flex-1 px-3 py-2 rounded-md bg-transparent outline-none text-[13px] text-fg-1 placeholder:text-fg-4"
            style={{ border: "1px solid rgba(255,255,255,0.09)", fontWeight: 450 }}
            onKeyDown={(e) => e.key === "Enter" && handleComment()}
          />
          <button
            onClick={() => setCommentSecret((v) => !v)}
            className="w-8 h-8 rounded-md flex items-center justify-center transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.09)", background: commentSecret ? "rgba(129,139,224,0.12)" : "transparent" }}
            title={commentSecret ? "비밀 댓글" : "공개 댓글"}
          >
            <Lock size={13} strokeWidth={1.8} style={{ color: commentSecret ? "#818be0" : "#62666d" }} />
          </button>
          <button
            onClick={handleComment}
            disabled={!commentText.trim()}
            className="w-8 h-8 rounded-md flex items-center justify-center text-[#818be0] disabled:opacity-40 transition-colors"
            style={{ border: "1px solid rgba(129,139,224,0.2)", background: "rgba(129,139,224,0.05)" }}
          >
            <Send size={13} strokeWidth={2} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        {!writing && (
          <button
            onClick={() => user ? setWriting(true) : openLogin?.()}
            className="px-3.5 py-2 rounded-md text-[13px] text-white transition-colors"
            style={{ background: "#6672d5", fontWeight: 510, border: "none", cursor: "pointer" }}
          >
            글 쓰기
          </button>
        )}
      </div>
      {writing && (
        <div className="mb-5 p-4 rounded-xl" style={{ border: "1px solid rgba(129,139,224,0.2)", background: "rgba(129,139,224,0.03)" }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="불편한 점, 있으면 좋겠는 기능, 버그 등 자유롭게 적어주세요"
            rows={4}
            className="w-full px-3 py-2 rounded-md bg-transparent outline-none text-[14px] text-fg-1 placeholder:text-fg-4 resize-none mb-3"
            style={{ border: "1px solid rgba(255,255,255,0.09)", fontWeight: 450, lineHeight: 1.6 }}
            autoFocus
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSecret((v) => !v)}
              className="flex items-center gap-1.5 text-[12px] transition-colors"
              style={{ background: "none", border: "none", cursor: "pointer", color: isSecret ? "#818be0" : "#8a8f98", fontWeight: 510 }}
            >
              <Lock size={12} strokeWidth={2} />
              {isSecret ? "비밀글" : "공개"}
            </button>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => { setWriting(false); setContent(""); setIsSecret(false); }}
                className="px-3 py-1.5 rounded-md text-[12px] text-fg-3 hover:text-fg-1 transition-colors"
                style={{ background: "none", border: "1px solid rgba(255,255,255,0.09)", cursor: "pointer", fontWeight: 510 }}
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={!content.trim()}
                className="px-3 py-1.5 rounded-md text-[12px] text-white disabled:opacity-40 transition-colors"
                style={{ background: "#6672d5", border: "none", cursor: "pointer", fontWeight: 510 }}
              >
                등록
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-[13px] text-fg-4">불러오는 중...</div>
      ) : posts.length === 0 ? (
        <div className="text-[13px] text-fg-4">아직 글이 없어요. 첫 번째 건의사항을 남겨보세요!</div>
      ) : (
        <div className="flex flex-col gap-2">
          {posts.map((p) => (
            <button
              key={p.id}
              onClick={() => fetchDetail(p.id)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-left w-full transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
            >
              {p.is_secret && <Lock size={13} className="text-fg-4 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-fg-1 truncate" style={{ fontWeight: 510 }}>{p.content}</div>
                <div className="text-[11px] text-fg-4 mt-0.5" style={{ fontWeight: 450 }}>{p.author} · {new Date(p.created_at).toLocaleDateString("ko")}</div>
              </div>
              {p.comment_count > 0 && (
                <span className="text-[11px] text-fg-4 shrink-0" style={{ fontWeight: 510 }}>
                  <MessageSquare size={11} strokeWidth={2} className="inline mr-0.5" />{p.comment_count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SECTION_COMPONENTS = {
  blog: BlogSection,
  feedback: FeedbackSection,
};

export default function Community() {
  const [section, setSection] = useState("blog");
  const Body = SECTION_COMPONENTS[section];

  return (
    <div className="kd-fade-in mx-auto px-6 py-10" style={{ maxWidth: 1040 }}>
      <div className="flex gap-10">
        <aside className="shrink-0" style={{ width: 200 }}>
          <div
            className="text-[11.5px] tracking-[0.08em] text-fg-4 mb-2 px-3"
            style={{ fontWeight: 590 }}
          >
            COMMUNITY
          </div>
          <nav className="flex flex-col gap-0.5">
            {SECTIONS.map((s) => {
              const isActive = s.id === section;
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[14px] text-left transition-colors w-full"
                  style={{
                    color: isActive ? "#dde0e4" : "#8a8f98",
                    background: isActive ? "rgba(129,139,224,0.08)" : "transparent",
                    fontWeight: 510,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <Icon size={15} strokeWidth={1.8} />
                  {s.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          <Body />
        </div>
      </div>
    </div>
  );
}
