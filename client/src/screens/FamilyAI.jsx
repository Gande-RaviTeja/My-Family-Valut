import { useState, useEffect, useRef } from "react";
import { api } from "../api.js";
import { SparkleAIIcon } from "../components/icons.jsx";

export default function FamilyAI({ user, onBack }) {
  const userName = user?.name || "there";
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  const STORAGE_KEY = `myhome_ai_chat_${user?.familyId || user?.email || "user"}`;

  const defaultWelcome = {
    sender: "ai",
    text: `Hello ${userName}! I am your Family AI Assistant. You can ask me to find any public family document across all family members, review upcoming bills, or inspect grocery items!`,
  };

  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.log("Error loading saved chat history:", err);
    }
    return [defaultWelcome];
  });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom whenever messages or loading state change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Save chat history to sessionStorage whenever messages update
  useEffect(() => {
    try {
      if (messages && messages.length > 0) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      }
    } catch (err) {
      console.log("Error persisting chat history:", err);
    }
  }, [messages, STORAGE_KEY]);

  function handleClearChat() {
    if (window.confirm("Clear conversation history for this session?")) {
      setMessages([defaultWelcome]);
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  useEffect(() => {
    if (user?.familyId && !user.isGuest) {
      api.getFamilyMembers(user.familyId)
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setMembers(data);
          } else {
            setMembers([{ name: user.name || "User" }]);
          }
        })
        .catch(() => {
          setMembers([{ name: user?.name || "User" }]);
        });
    } else {
      setMembers([{ name: user?.name || "User" }]);
    }
  }, [user]);

  const familyMembersList = members.length > 0 ? members : [{ name: user?.name || "User" }];
  const getMemberName = (idx) => familyMembersList[idx % familyMembersList.length]?.name || user?.name || "User";

  const suggestionPrompts = familyMembersList.length === 1
    ? [
      `Show all public documents of ${getMemberName(0)}`,
      `Find ${getMemberName(0)}'s education certificates`,
      `List all public bank & property documents in family`,
      `Find ${getMemberName(0)}'s health cards and medical reports`,
      `Which documents are publicly shared by ${getMemberName(0)}?`,
    ]
    : [
      `Show all public documents of ${getMemberName(0)}`,
      `Find ${getMemberName(1)}'s education certificates`,
      `List all public bank & property documents in family`,
      `Find ${getMemberName(2 % familyMembersList.length)}'s health cards and medical reports`,
      `Which documents are publicly shared by ${getMemberName(3 % familyMembersList.length)}?`,
    ];

  async function handleSend(textToSend) {
    const promptText = textToSend || query;
    if (!promptText.trim() || loading) return;

    const userMsg = { sender: "user", text: promptText };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setQuery("");

    setLoading(true);

    try {
      const res = await api.askFamilyAI(promptText, user);
      setMessages((prev) => [...prev, { sender: "ai", text: res.text }]);
    } catch (err) {
      console.error("Error communicating with Family AI:", err);
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: `Sorry, I encountered an issue retrieving responses (${err.message}). Please ensure the server is running and configured.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ai-view">
      <div className="top-row" style={{ marginBottom: 16 }}>
        <div>
          <div className="greet-label back-link" onClick={onBack}>
            ← BACK
          </div>
          <div className="greet-name" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>Family AI Search & Assistant</span>
            <div className="ai-header-status">
              <span className="ai-status-dot" />
              <span>AI Online</span>
            </div>
          </div>
        </div>
        {messages.length > 1 && (
          <button
            type="button"
            className="file-action-btn"
            onClick={handleClearChat}
            style={{ color: "var(--ink-soft)", background: "#FFF", fontWeight: 700, fontSize: 12.5, borderRadius: 10 }}
            title="Clear conversation history for this session"
          >
            🧹 Clear Chat
          </button>
        )}
      </div>

      {/* Main Glassmorphic Chat Window */}
      <div className="ai-chat-window">
        {messages.map((m, idx) => (
          <div key={idx} className={`ai-msg-group ${m.sender}`}>
            <div className={`ai-avatar ${m.sender}`}>
              {m.sender === "ai" ? <SparkleAIIcon size={18} color="#FFFFFF" /> : userInitial}
            </div>
            <div className="ai-msg-bubble">
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="ai-msg-group ai">
            <div className="ai-avatar ai">
              <SparkleAIIcon size={18} color="#FFFFFF" />
            </div>
            <div className="ai-thinking-card">
              <span>⚡ Family AI is analyzing vault records & thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Chips */}
      <div style={{ marginTop: 20 }}>
        <div className="ai-suggestions-head">
          <SparkleAIIcon size={14} color="var(--purple)" />
          <span>Suggested Questions</span>
        </div>
        <div className="ai-suggestions-row">
          {suggestionPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="ai-suggestion-chip"
              onClick={() => handleSend(prompt)}
              disabled={loading}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="ai-input-card"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2.2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder="Search any public family document, bills, or ask a question..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          className="ai-send-btn"
          disabled={!query.trim() || loading}
          title="Send message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  );
}
