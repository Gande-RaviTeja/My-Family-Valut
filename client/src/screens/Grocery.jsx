import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Grocery({ user }) {
  const familyKey = user?.familyId || user?.inviteCode || "FAM-DEFAULT";
  const STORAGE_KEY = `myhome_grocery_${familyKey}`;

  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.error("Error reading saved grocery items:", err);
    }
    return [];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const currentUser = {
    name: user?.name || "You",
    color: "#7C3AED",
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error("Error persisting grocery items:", err);
    }
  }, [items, STORAGE_KEY]);

  useEffect(() => {
    load();
  }, [familyKey]);

  async function load() {
    setError("");
    try {
      const dbItems = await api.getGroceryItems(familyKey);
      if (Array.isArray(dbItems) && dbItems.length > 0) {
        setItems(dbItems);
      }
    } catch (err) {
      // If offline/guest, keep local cache
    } finally {
      setLoading(false);
    }
  }

  async function addItem() {
    const name = input.trim();
    if (!name) return;
    setInput("");

    const tempItem = {
      _id: `local-${Date.now()}`,
      name,
      checked: false,
      addedBy: currentUser,
    };

    const updated = [tempItem, ...items];
    setItems(updated);

    try {
      const created = await api.addGroceryItem(name, currentUser, familyKey);
      if (created && created._id) {
        setItems((prev) =>
          prev.map((it) => (it._id === tempItem._id ? created : it))
        );
      }
    } catch (err) {
      console.error("Error saving grocery item to server:", err);
    }
  }

  async function toggleItem(id) {
    const updated = items.map((it) => (it._id === id ? { ...it, checked: !it.checked } : it));
    setItems(updated);

    try {
      if (id && typeof id === "string" && !id.startsWith("local-")) {
        await api.toggleGroceryItem(id);
      }
    } catch (err) {
      console.error("Error toggling grocery item:", err);
    }
  }

  async function deleteItem(id) {
    const updated = items.filter((it) => it._id !== id);
    setItems(updated);

    try {
      if (id && typeof id === "string" && !id.startsWith("local-")) {
        await api.deleteGroceryItem(id);
      }
    } catch (err) {
      console.error("Error deleting grocery item:", err);
    }
  }

  return (
    <div className="grocery-view">
      <div className="top-row">
        <div>
          <div className="greet-label">SHARED FAMILY LIST</div>
          <div className="greet-name" style={{ fontSize: 24 }}>
            Grocery List
          </div>
        </div>
      </div>

      <div className="grocery-sync">
        <span className="dot"></span>
        Synced live for {user?.familyName || "your family"} · everyone can add or check off items
      </div>

      {error && <div className="grocery-error">{error}</div>}

      <div className="grocery-input-row">
        <input
          type="text"
          placeholder={`Add an item as ${currentUser.name} — e.g. Milk, 2 packs`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
        />
        <button className="grocery-add-btn" onClick={addItem} disabled={!input.trim()}>
          +
        </button>
      </div>

      <div className="card">
        {loading && items.length === 0 ? (
          <div className="grocery-empty">Loading…</div>
        ) : items.length === 0 ? (
          <div className="grocery-empty">Nothing on the list yet. Add the first item above.</div>
        ) : (
          items.map((item) => (
            <div className={`grocery-item${item.checked ? " checked" : ""}`} key={item._id}>
              <div
                className={`grocery-check${item.checked ? " checked" : ""}`}
                onClick={() => toggleItem(item._id)}
              >
                {item.checked && (
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <p className="grocery-item-name">{item.name}</p>
                <div className="grocery-item-meta">
                  <span
                    className="grocery-item-avatar"
                    style={{ background: item.addedBy?.color || "#7C3AED" }}
                  >
                    {(item.addedBy?.name || "?").charAt(0).toUpperCase()}
                  </span>
                  Added by {item.addedBy?.name}
                </div>
              </div>
              <button
                className="close-btn"
                style={{ fontSize: "14px", color: "var(--ink-soft)", padding: "4px 8px" }}
                onClick={() => deleteItem(item._id)}
                title="Delete item"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
