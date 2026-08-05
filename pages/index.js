import React, { useState, useEffect, useRef, useCallback } from "react";

const TOPICS = [
  { id: 1, title: "企画の概要", hint: "どんな企画か、ひとことで" },
  { id: 2, title: "背景・課題", hint: "なぜ今これが必要か" },
  { id: 3, title: "目的・ゴール", hint: "何を達成したいか" },
  { id: 4, title: "ターゲット", hint: "誰に向けたものか" },
  { id: 5, title: "施策内容", hint: "具体的に何をするか" },
  { id: 6, title: "差別化・強み", hint: "他との違いは何か" },
  { id: 7, title: "スケジュール", hint: "いつ、どの順で進めるか" },
  { id: 8, title: "予算・体制", hint: "いくらで、誰がやるか" },
  { id: 9, title: "リスク・懸念点", hint: "何が引っかかるか" },
  { id: 10, title: "期待効果・KPI", hint: "成功をどう測るか" },
];

const TONES = [
  {
    id: "kicchiri",
    label: "きっちり",
    emoji: "📐",
    accent: "#3B4A6B",
    soft: "#E7EAF1",
    concernLabel: "確認事項",
    initialQuestion:
      "はじめに、今回の企画の概要を教えてください。要点を簡潔にまとめていただけると助かります。",
    persona:
      "丁寧で論理的、抜け漏れを厳しく確認する真面目なプランナー。敬語で端的に話す。絵文字は使わない。",
  },
  {
    id: "flat",
    label: "フラット",
    emoji: "🙂",
    accent: "#E08E45",
    soft: "#FBEEE0",
    concernLabel: "気になる点",
    initialQuestion:
      "まず、どんな企画か教えてください。思いついてることをそのまま書いてもらえれば大丈夫です。",
    persona: "フランクで話しやすい同僚のような口調。柔らかいけれど的確に突っ込む。",
  },
  {
    id: "ouen",
    label: "励まし",
    emoji: "🌱",
    accent: "#5B8C5A",
    soft: "#E9F1E6",
    concernLabel: "ちょっと確認",
    initialQuestion:
      "まずは気軽に教えてください！どんな企画を考えていますか？思いついたことから書いてみましょう。",
    persona:
      "前向きで励ますトーン。指摘するときも良い点を認めつつ、優しく問いかける。適度に絵文字を使う。",
  },
  {
    id: "rough",
    label: "ラフ相談",
    emoji: "💬",
    accent: "#9B6FB0",
    soft: "#F1E9F5",
    concernLabel: "これ気になる!",
    initialQuestion: "おっ、企画きた？とりあえずどんな感じか、思いつくまま書いてみて〜",
    persona:
      "雑談感覚でテンション高く、絵文字も交えるノリの良い相棒。ただし指摘の鋭さは緩めない。",
  },
];

const PROJECTS_INDEX_KEY = "pb:projects";
const projectKey = (id) => `pb:project:${id}`;

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function stripFences(text) {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  return t.trim();
}

function getTone(id) {
  return TONES.find((t) => t.id === id) || TONES[1];
}

async function callAI(system, user) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, user }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API request failed");
  return data.text;
}

function defaultOutline() {
  const o = {};
  TOPICS.forEach((t) => {
    o[t.id] = { summary: "", complete: false };
  });
  return o;
}

function loadProjectsIndex() {
  try {
    const raw = localStorage.getItem(PROJECTS_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveProjectsIndex(list) {
  try {
    localStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(list));
  } catch (e) {}
}

function loadProject(id) {
  try {
    const raw = localStorage.getItem(projectKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveProject(id, data) {
  try {
    localStorage.setItem(projectKey(id), JSON.stringify(data));
  } catch (e) {}
}

function deleteProjectStorage(id) {
  try {
    localStorage.removeItem(projectKey(id));
  } catch (e) {}
}

function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

export default function ProposalBuilder() {
  const [screen, setScreen] = useState("home"); // 'home' | 'project'
  const [projects, setProjects] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [projectId, setProjectId] = useState(null);
  const [title, setTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [toneId, setToneId] = useState("flat");
  const [messages, setMessages] = useState([]);
  const [outline, setOutline] = useState(defaultOutline());
  const [currentTopicId, setCurrentTopicId] = useState(1);
  const [allComplete, setAllComplete] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState("chat");
  const [proposalText, setProposalText] = useState("");
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState(null);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef(null);

  const tone = getTone(toneId);

  useEffect(() => {
    setProjects(loadProjectsIndex());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, view]);

  // persist current project on change
  useEffect(() => {
    if (!loaded || screen !== "project" || !projectId) return;
    const completeCount = TOPICS.filter((t) => outline[t.id]?.complete).length;
    saveProject(projectId, {
      title,
      toneId,
      messages,
      outline,
      currentTopicId,
      allComplete,
      proposalText,
    });
    setProjects((prev) => {
      const next = prev.map((p) =>
        p.id === projectId
          ? { ...p, title, toneId, updatedAt: Date.now(), progress: completeCount }
          : p
      );
      saveProjectsIndex(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, toneId, messages, outline, currentTopicId, allComplete, proposalText]);

  const createProject = (initialToneId) => {
    const t = getTone(initialToneId);
    const id = uid();
    const now = Date.now();
    const newTitle = "新しい企画";
    const initialMessages = [
      { id: uid(), role: "question", topicId: 1, isConcern: false, text: t.initialQuestion },
    ];
    saveProject(id, {
      title: newTitle,
      toneId: t.id,
      messages: initialMessages,
      outline: defaultOutline(),
      currentTopicId: 1,
      allComplete: false,
      proposalText: "",
    });
    const idxEntry = { id, title: newTitle, toneId: t.id, createdAt: now, updatedAt: now, progress: 0 };
    const nextIndex = [idxEntry, ...projects];
    saveProjectsIndex(nextIndex);
    setProjects(nextIndex);
    openProject(id);
  };

  const openProject = (id) => {
    const data = loadProject(id);
    if (!data) return;
    setProjectId(id);
    setTitle(data.title || "新しい企画");
    setToneId(data.toneId || "flat");
    setMessages(data.messages || []);
    setOutline(data.outline || defaultOutline());
    setCurrentTopicId(data.currentTopicId || 1);
    setAllComplete(!!data.allComplete);
    setProposalText(data.proposalText || "");
    setView("chat");
    setError(null);
    setProposalError(null);
    setScreen("project");
  };

  const backToHome = () => {
    setScreen("home");
    setProjectId(null);
  };

  const deleteProject = (id, e) => {
    e.stopPropagation();
    if (!confirm("この企画を削除します。よろしいですか？")) return;
    deleteProjectStorage(id);
    const next = projects.filter((p) => p.id !== id);
    saveProjectsIndex(next);
    setProjects(next);
  };

  const completeCount = TOPICS.filter((t) => outline[t.id]?.complete).length;

  const buildSystemPrompt = () => {
    const outlineSnapshot = TOPICS.map(
      (t) => `${t.id}. ${t.title}: ${outline[t.id]?.summary || "(未記入)"} ${outline[t.id]?.complete ? "[記入済み]" : ""}`
    ).join("\n");

    return `あなたは企画書づくりを手伝うプランナーです。
話し方のトーン: 「${tone.label}」。${tone.persona}
このトーンを一貫して守り、question フィールドの文章をそのトーンで書いてください。

ユーザーは企画のアイデアを断片的に話します。あなたの仕事は次の2つです。
1) ユーザーの直前の回答を、今のトピックの要約として整理する
2) その回答に対して、疑問点・懸念点・矛盾・詰めが甘い部分を1つだけ問いかけて潰す。十分に詰められたと判断したら、次のトピックの最初の質問に移る

トピック一覧（順番に進める。番号は工程の順序）:
${TOPICS.map((t) => `${t.id}. ${t.title}（${t.hint}）`).join("\n")}

現在のトピックID: ${currentTopicId}

現在の骨子の状態:
${outlineSnapshot}

必ず以下のJSON形式のみで返答してください。他の文章、前置き、コードフェンスは一切つけないこと。
{
  "updatedTopicId": number,
  "updatedSummary": string,
  "topicComplete": boolean,
  "nextTopicId": number,
  "isConcern": boolean,
  "question": string,
  "allComplete": boolean
}`;
  };

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    const answerMsg = { id: uid(), role: "answer", topicId: currentTopicId, text };
    setMessages((prev) => [...prev, answerMsg]);
    setInput("");
    setLoading(true);

    const system = buildSystemPrompt();
    const recentContext = messages
      .slice(-8)
      .map((m) => (m.role === "answer" ? `A: ${m.text}` : `Q: ${m.text}`))
      .join("\n");
    const userPrompt = `直近の会話:\n${recentContext}\n\nユーザーの最新の回答:\n${text}`;

    try {
      const raw = await callAI(system, userPrompt);
      const parsed = JSON.parse(stripFences(raw));

      setOutline((prev) => ({
        ...prev,
        [parsed.updatedTopicId]: {
          summary: parsed.updatedSummary || prev[parsed.updatedTopicId]?.summary || "",
          complete: !!parsed.topicComplete,
        },
      }));

      const nextId = Math.min(parsed.nextTopicId || currentTopicId, TOPICS.length);
      setCurrentTopicId(nextId);
      setAllComplete(!!parsed.allComplete);

      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "question", topicId: nextId, isConcern: !!parsed.isConcern, text: parsed.question },
      ]);
    } catch (e) {
      setError("応答の取得に失敗しました。もう一度送信してください。");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, currentTopicId, outline, tone]);

  const handleGenerateProposal = useCallback(async () => {
    setProposalError(null);
    setProposalLoading(true);
    setView("proposal");
    const outlineText = TOPICS.map((t) => `## ${t.title}\n${outline[t.id]?.summary || "（情報なし）"}`).join("\n\n");

    const system = `あなたは実務経験の長い企画プランナーです。以下の骨子情報をもとに、社内で通用する完成度の高い企画書をMarkdown形式で作成してください。
構成は「タイトル」「エグゼクティブサマリー（3〜4文）」に続けて、以下のトピックの順にセクションを作ること。情報が薄い部分は骨子の内容から自然に補って、文章として整えること（不自然に「情報なし」とは書かない）。
文体はビジネス文書として適切な、丁寧で読みやすい日本語にすること（対話中のカジュアルなトーンは反映しない）。
出力はMarkdown本文のみ。前置き、コードフェンス、説明文は一切つけないこと。`;

    const userPrompt = `骨子情報:\n\n${outlineText}`;

    try {
      const raw = await callAI(system, userPrompt);
      setProposalText(stripFences(raw));
    } catch (e) {
      setProposalError("企画書の生成に失敗しました。もう一度お試しください。");
    } finally {
      setProposalLoading(false);
    }
  }, [outline]);

  const handleResetProject = () => {
    if (!confirm("この企画の内容をすべて削除して最初からやり直しますか？")) return;
    const t = getTone(toneId);
    setMessages([{ id: uid(), role: "question", topicId: 1, isConcern: false, text: t.initialQuestion }]);
    setOutline(defaultOutline());
    setCurrentTopicId(1);
    setAllComplete(false);
    setProposalText("");
    setView("chat");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(proposalText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {}
  };

  const renderMarkdown = (md) => {
    const lines = md.split("\n");
    const els = [];
    let listBuf = [];
    const flushList = (key) => {
      if (listBuf.length) {
        els.push(
          <ul className="doc-list" key={"list-" + key}>
            {listBuf.map((li, i) => (
              <li key={i}>{li}</li>
            ))}
          </ul>
        );
        listBuf = [];
      }
    };
    lines.forEach((line, idx) => {
      const l = line.trim();
      if (l.startsWith("# ")) {
        flushList(idx);
        els.push(<h1 className="doc-h1" key={idx}>{l.slice(2)}</h1>);
      } else if (l.startsWith("## ")) {
        flushList(idx);
        els.push(<h2 className="doc-h2" key={idx}>{l.slice(3)}</h2>);
      } else if (l.startsWith("### ")) {
        flushList(idx);
        els.push(<h3 className="doc-h3" key={idx}>{l.slice(4)}</h3>);
      } else if (l.startsWith("- ") || l.startsWith("・")) {
        listBuf.push(l.replace(/^[-・]\s*/, ""));
      } else if (l === "") {
        flushList(idx);
        els.push(<div className="doc-space" key={idx} />);
      } else {
        flushList(idx);
        els.push(<p className="doc-p" key={idx}>{l}</p>);
      }
    });
    flushList("end");
    return els;
  };

  const rootStyle = { "--accent": tone.accent, "--accent-soft": tone.soft };

  if (screen === "home") {
    return (
      <div className="app-root" style={{ "--accent": "#E08E45", "--accent-soft": "#FBEEE0" }}>
        <style>{css}</style>
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">✎</span>
            <div>
              <div className="brand-title">企画書ビルダー</div>
              <div className="brand-sub">問いで、思考を編む</div>
            </div>
          </div>
        </header>
        <div className="scroll-area">
          <button className="new-project-btn" onClick={() => createProject("flat")}>
            ＋ 新しい企画を始める
          </button>

          {loaded && projects.length === 0 && (
            <div className="empty-proposal">
              <p>まだ企画がありません。「＋ 新しい企画を始める」から始めましょう。</p>
            </div>
          )}

          {projects.map((p) => {
            const pt = getTone(p.toneId);
            return (
              <div className="project-card" key={p.id} onClick={() => openProject(p.id)}>
                <div className="project-card-top">
                  <span className="project-tone-badge" style={{ background: pt.soft, color: pt.accent }}>
                    {pt.emoji} {pt.label}
                  </span>
                  <button className="delete-btn" onClick={(e) => deleteProject(p.id, e)} title="削除">
                    ✕
                  </button>
                </div>
                <div className="project-title">{p.title}</div>
                <div className="project-meta">
                  <span>更新: {fmtDate(p.updatedAt)}</span>
                  <span className="project-progress">{p.progress || 0} / {TOPICS.length}</span>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${((p.progress || 0) / TOPICS.length) * 100}%`, background: pt.accent }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="app-root" style={rootStyle}>
      <style>{css}</style>

      <header className="topbar">
        <button className="back-btn" onClick={backToHome}>
          ← 一覧
        </button>
        {editingTitle ? (
          <input
            className="title-input"
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
          />
        ) : (
          <div className="brand-title clickable" onClick={() => setEditingTitle(true)}>
            {title}
          </div>
        )}
        <div className="topbar-right">
          <div className="progress-chip">
            <span className="mono">{String(completeCount).padStart(2, "0")}</span>
            <span className="progress-slash">/</span>
            <span className="mono">{String(TOPICS.length).padStart(2, "0")}</span>
          </div>
          <button className="icon-btn" onClick={handleResetProject} title="この企画をリセット">
            ↺
          </button>
        </div>
      </header>

      <div className="tone-row">
        {TONES.map((t) => (
          <button
            key={t.id}
            className={"tone-pill" + (t.id === toneId ? " tone-pill-active" : "")}
            style={t.id === toneId ? { background: t.accent, color: "#fff" } : {}}
            onClick={() => setToneId(t.id)}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      <nav className="tabs">
        <button className={"tab" + (view === "chat" ? " tab-active" : "")} onClick={() => setView("chat")}>
          対話
        </button>
        <button className={"tab" + (view === "outline" ? " tab-active" : "")} onClick={() => setView("outline")}>
          骨子
        </button>
        <button className={"tab" + (view === "proposal" ? " tab-active" : "")} onClick={() => setView("proposal")}>
          企画書
        </button>
      </nav>

      {view === "chat" && (
        <div className="chat-view">
          <div className="scroll-area" ref={scrollRef}>
            {allComplete && <div className="banner">主要な論点は揃いました。「企画書」タブから生成できます。</div>}
            {messages.map((m) => {
              if (m.role === "answer") {
                return (
                  <div className="bubble answer" key={m.id}>
                    <div className="bubble-text">{m.text}</div>
                  </div>
                );
              }
              const topic = TOPICS.find((t) => t.id === m.topicId);
              return (
                <div className={"bubble question" + (m.isConcern ? " concern" : "")} key={m.id}>
                  <div className="bubble-label">
                    <span className="topic-tag mono">
                      {String(m.topicId).padStart(2, "0")} {topic?.title}
                    </span>
                    {m.isConcern && <span className="concern-tag">{tone.concernLabel}</span>}
                  </div>
                  <div className="bubble-text">{m.text}</div>
                </div>
              );
            })}
            {loading && (
              <div className="bubble question loading-bubble">
                <div className="bubble-text">考えています…</div>
              </div>
            )}
            {error && <div className="error-text">{error}</div>}
          </div>

          <div className="input-bar">
            <textarea
              className="input-textarea"
              placeholder="ここに答えを書いてください"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              rows={3}
            />
            <div className="input-row">
              <span className="hint-text">⌘/Ctrl + Enter で送信</span>
              <button className="send-btn" onClick={handleSubmit} disabled={loading || !input.trim()}>
                送信
              </button>
            </div>
          </div>
        </div>
      )}

      {view === "outline" && (
        <div className="outline-view scroll-area">
          {TOPICS.map((t) => (
            <div className="outline-row" key={t.id}>
              <div className="outline-num-col">
                <span className="mono outline-num">{String(t.id).padStart(2, "0")}</span>
                {outline[t.id]?.complete && <span className="check-badge">✓</span>}
              </div>
              <div className="outline-body">
                <div className="outline-title">{t.title}</div>
                <div className="outline-summary">
                  {outline[t.id]?.summary || <span className="outline-empty">まだ記入されていません</span>}
                </div>
              </div>
            </div>
          ))}
          <button className="generate-btn" onClick={handleGenerateProposal} disabled={proposalLoading}>
            企画書を生成する
          </button>
        </div>
      )}

      {view === "proposal" && (
        <div className="proposal-view scroll-area">
          {proposalLoading && <div className="banner">企画書を作成しています…</div>}
          {proposalError && <div className="error-text">{proposalError}</div>}
          {!proposalLoading && !proposalText && !proposalError && (
            <div className="empty-proposal">
              <p>まだ企画書は生成されていません。</p>
              <button className="generate-btn" onClick={handleGenerateProposal}>
                企画書を生成する
              </button>
            </div>
          )}
          {proposalText && (
            <>
              <div className="proposal-toolbar">
                <button className="copy-btn" onClick={handleCopy}>
                  {copied ? "コピーしました" : "コピー"}
                </button>
                <button className="regen-btn" onClick={handleGenerateProposal} disabled={proposalLoading}>
                  再生成
                </button>
              </div>
              <div className="doc-paper">{renderMarkdown(proposalText)}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }

.app-root {
  --bg: #FAF7F2;
  --card: #FFFFFF;
  --ink: #33322E;
  --ink-soft: #928C7E;
  --line: #ECE6D8;
  --accent: #E08E45;
  --accent-soft: #FBEEE0;
  font-family: 'Zen Kaku Gothic New', 'Noto Sans JP', sans-serif;
  background: var(--bg);
  color: var(--ink);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  max-width: 720px;
  margin: 0 auto;
}

.mono { font-family: 'JetBrains Mono', monospace; }

.topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 18px 10px;
}
.brand { display: flex; align-items: center; gap: 10px; }
.brand-mark {
  width: 36px; height: 36px;
  border-radius: 12px;
  background: var(--accent);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
}
.brand-title { font-family: 'Zen Maru Gothic', sans-serif; font-weight: 700; font-size: 17px; }
.brand-title.clickable { cursor: pointer; flex: 1; }
.brand-sub { font-size: 11px; color: var(--ink-soft); margin-top: 1px; }
.topbar-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.back-btn {
  border: none;
  background: var(--card);
  border-radius: 999px;
  padding: 7px 14px;
  font-size: 13px;
  color: var(--ink-soft);
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.title-input {
  flex: 1;
  font-family: 'Zen Maru Gothic', sans-serif;
  font-weight: 700;
  font-size: 16px;
  border: none;
  border-bottom: 2px solid var(--accent);
  background: transparent;
  color: var(--ink);
  padding: 4px 2px;
}
.progress-chip {
  font-size: 13px; padding: 5px 12px;
  border-radius: 999px;
  background: var(--card);
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  display: flex; gap: 3px; align-items: baseline;
}
.progress-slash { color: var(--ink-soft); }
.icon-btn {
  border: none;
  background: var(--card);
  border-radius: 999px;
  width: 34px; height: 34px;
  font-size: 15px;
  cursor: pointer;
  color: var(--ink-soft);
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.icon-btn:hover { color: var(--accent); }

.tone-row {
  display: flex;
  gap: 6px;
  padding: 6px 16px 4px;
  overflow-x: auto;
}
.tone-pill {
  flex-shrink: 0;
  border: none;
  background: var(--card);
  color: var(--ink-soft);
  border-radius: 999px;
  padding: 6px 13px;
  font-size: 12.5px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.tone-pill-active { font-weight: 700; }

.tabs { display: flex; padding: 10px 16px 0; gap: 6px; }
.tab {
  flex: 1;
  padding: 9px 0;
  background: var(--card);
  border: none;
  border-radius: 12px 12px 0 0;
  font-size: 13.5px;
  color: var(--ink-soft);
  cursor: pointer;
  font-family: inherit;
}
.tab-active { color: var(--accent); font-weight: 700; }

.chat-view, .outline-view, .proposal-view { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.scroll-area { flex: 1; overflow-y: auto; padding: 16px; }

.banner {
  background: var(--accent-soft);
  color: var(--ink);
  font-size: 13px;
  padding: 12px 14px;
  border-radius: 14px;
  margin-bottom: 14px;
}

.bubble { margin-bottom: 12px; max-width: 88%; }
.bubble.answer { margin-left: auto; }
.bubble-label {
  font-size: 11px;
  color: var(--ink-soft);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.topic-tag { color: var(--ink-soft); letter-spacing: 0.02em; }
.concern-tag {
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 1px 9px;
  font-size: 10.5px;
  font-weight: 700;
}
.bubble-text {
  font-size: 14.5px;
  line-height: 1.7;
  padding: 12px 15px;
  border-radius: 16px;
  white-space: pre-wrap;
}
.bubble.question .bubble-text {
  background: var(--card);
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  border-top-left-radius: 4px;
}
.bubble.question.concern .bubble-text {
  background: var(--accent-soft);
}
.bubble.answer .bubble-text {
  background: var(--accent);
  color: #fff;
  border-top-right-radius: 4px;
}
.loading-bubble .bubble-text { color: var(--ink-soft); font-style: italic; background: var(--card); }

.error-text { color: #C0392B; font-size: 13px; padding: 6px 2px; }

.input-bar { padding: 10px 16px 18px; background: var(--bg); }
.input-textarea {
  width: 100%;
  border: none;
  background: var(--card);
  border-radius: 16px;
  padding: 12px 14px;
  font-size: 14px;
  font-family: inherit;
  color: var(--ink);
  resize: none;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.input-textarea:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
.input-row { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
.hint-text { font-size: 11px; color: var(--ink-soft); }
.send-btn {
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 9px 22px;
  border-radius: 999px;
  font-size: 13.5px;
  cursor: pointer;
  font-family: inherit;
}
.send-btn:disabled { opacity: 0.4; cursor: default; }

.outline-row { display: flex; gap: 12px; padding: 14px 4px; }
.outline-num-col { width: 40px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; }
.outline-num { font-size: 13px; color: var(--ink-soft); }
.check-badge {
  margin-top: 5px;
  width: 22px; height: 22px;
  background: var(--accent);
  color: #fff;
  border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px;
}
.outline-title { font-family: 'Zen Maru Gothic', sans-serif; font-weight: 700; font-size: 14.5px; margin-bottom: 4px; }
.outline-summary { font-size: 13px; color: #5C584E; line-height: 1.6; background: var(--card); padding: 10px 12px; border-radius: 12px; }
.outline-empty { color: var(--ink-soft); font-style: italic; }

.generate-btn, .regen-btn, .copy-btn, .new-project-btn {
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 12px 20px;
  border-radius: 999px;
  font-size: 13.5px;
  cursor: pointer;
  font-family: inherit;
  margin-top: 16px;
}
.regen-btn, .copy-btn { background: var(--card); color: var(--accent); margin-top: 0; padding: 8px 16px; }
.new-project-btn { width: 100%; margin: 4px 0 20px; padding: 14px 0; font-size: 14.5px; font-weight: 700; }

.proposal-toolbar { display: flex; gap: 8px; margin-bottom: 14px; }
.doc-paper {
  background: var(--card);
  padding: 22px 20px;
  border-radius: 16px;
}
.doc-h1 { font-family: 'Zen Maru Gothic', sans-serif; font-size: 20px; font-weight: 700; margin: 0 0 12px; color: var(--accent); }
.doc-h2 { font-family: 'Zen Maru Gothic', sans-serif; font-size: 16px; font-weight: 700; margin: 20px 0 8px; }
.doc-h3 { font-size: 14px; font-weight: 700; margin: 12px 0 4px; }
.doc-p { font-size: 13.5px; line-height: 1.85; margin: 0 0 6px; }
.doc-list { margin: 4px 0 10px 18px; padding: 0; font-size: 13.5px; line-height: 1.8; }
.doc-space { height: 4px; }
.empty-proposal { text-align: center; padding: 40px 10px; color: var(--ink-soft); }

.project-card {
  background: var(--card);
  border-radius: 18px;
  padding: 14px 16px;
  margin-bottom: 12px;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}
.project-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.project-tone-badge { font-size: 11.5px; padding: 3px 10px; border-radius: 999px; font-weight: 700; }
.delete-btn { border: none; background: transparent; color: var(--ink-soft); font-size: 13px; cursor: pointer; padding: 4px 6px; }
.delete-btn:hover { color: #C0392B; }
.project-title { font-family: 'Zen Maru Gothic', sans-serif; font-weight: 700; font-size: 15px; margin-bottom: 6px; }
.project-meta { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--ink-soft); margin-bottom: 8px; }
.progress-bar-track { height: 6px; background: var(--bg); border-radius: 999px; overflow: hidden; }
.progress-bar-fill { height: 100%; border-radius: 999px; }

@media (max-width: 480px) {
  .app-root { max-width: 100%; }
  .bubble { max-width: 100%; }
}
`;
