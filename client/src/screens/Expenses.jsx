import { useEffect, useState } from "react";
import { api } from "../api.js";
import { RupeeIcon } from "../components/icons.jsx";

export default function Expenses({ user }) {
  const familyKey = user?.familyId || user?.inviteCode || "FAM-DEFAULT";
  const STORAGE_KEY = `myhome_bills_${familyKey}`;

  // Initial bills loaded directly from localStorage to prevent UI reset on refresh or screen tab change
  const [bills, setBills] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.error("Error reading saved bills:", err);
    }
    return [];
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [filter, setFilter] = useState("all");

  // Form state
  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDue, setBillDue] = useState("3 days");

  // Save to localStorage whenever bills change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
    } catch (err) {
      console.error("Error persisting bills to localStorage:", err);
    }
  }, [bills, STORAGE_KEY]);

  // Fetch persisted bills from MongoDB backend
  useEffect(() => {
    if (familyKey) {
      api.getFamilyExpenses(familyKey)
        .then((serverBills) => {
          if (Array.isArray(serverBills) && serverBills.length > 0) {
            const formatted = serverBills.map((b) => ({
              id: b._id || b.id,
              name: b.name,
              amount: b.amount,
              dueIn: b.dueIn || "3 days",
              paid: Boolean(b.paid),
              addedBy: b.addedBy || user?.name || "User",
            }));
            setBills(formatted);
          }
        })
        .catch(() => {
          // If offline or guest mode, keep local stored bills intact
        });
    }
  }, [familyKey, user]);

  async function togglePaid(id) {
    const updated = bills.map((b) => (b.id === id ? { ...b, paid: !b.paid } : b));
    setBills(updated);

    try {
      if (id && typeof id === "string" && !id.startsWith("local-")) {
        await api.toggleExpense(id);
      }
    } catch (err) {
      console.error("Error toggling bill paid status:", err);
    }
  }

  async function handleDeleteBill(id) {
    const updated = bills.filter((b) => b.id !== id);
    setBills(updated);

    try {
      if (id && typeof id === "string" && !id.startsWith("local-")) {
        await api.deleteExpense(id);
      }
    } catch (err) {
      console.error("Error deleting bill:", err);
    }
  }

  async function handleAddBill(e) {
    e.preventDefault();
    if (!billName.trim() || !billAmount) return;

    const amountNum = parseFloat(billAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const tempId = `local-${Date.now()}`;
    const newBill = {
      id: tempId,
      name: billName.trim(),
      amount: amountNum,
      dueIn: billDue,
      paid: false,
      addedBy: user?.name || "User",
    };

    const updatedBills = [newBill, ...bills];
    setBills(updatedBills);
    setBillName("");
    setBillAmount("");
    setShowAddModal(false);

    // Save to backend database
    try {
      const created = await api.addExpense({
        familyId: familyKey,
        name: newBill.name,
        amount: newBill.amount,
        dueIn: newBill.dueIn,
        addedBy: newBill.addedBy,
      });

      if (created && created._id) {
        setBills((prev) =>
          prev.map((b) => (b.id === tempId ? { ...b, id: created._id } : b))
        );
      }
    } catch (err) {
      console.error("Error saving bill to database:", err);
    }
  }

  const totalAmount = bills.reduce((acc, b) => acc + (b.amount || 0), 0);
  const pendingAmount = bills.filter((b) => !b.paid).reduce((acc, b) => acc + (b.amount || 0), 0);
  const paidAmount = bills.filter((b) => b.paid).reduce((acc, b) => acc + (b.amount || 0), 0);

  const billsPercent = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;
  const pendingPercent = totalAmount > 0 ? 100 - billsPercent : 0;

  const breakdown = [
    { label: "Pending Bills", percent: pendingPercent },
    { label: "Paid Bills", percent: billsPercent },
  ];

  const filteredBills = bills.filter((b) => {
    if (filter === "upcoming") return !b.paid;
    if (filter === "paid") return b.paid;
    return true;
  });

  return (
    <div className="expenses-view">
      <div className="top-row">
        <div>
          <div className="greet-label">FAMILY FINANCES</div>
          <div className="greet-name">Bills & Expenses</div>
        </div>
        <button className="add-bill-btn" onClick={() => setShowAddModal(true)}>
          + Add Bill
        </button>
      </div>

      <div className="expense-hero-card card">
        <div className="hero-label">TOTAL MONTHLY BUDGET & BILLS</div>
        <div className="hero-amount">₹{totalAmount.toLocaleString("en-IN")}</div>
        <div className="hero-bar">
          <div style={{ width: `${pendingPercent}%`, background: "rgba(255,255,255,0.9)" }} />
          <div style={{ width: `${billsPercent}%`, background: "rgba(255,255,255,0.4)" }} />
        </div>
        <div className="hero-breakdown">
          <span>Pending: ₹{pendingAmount.toLocaleString("en-IN")} ({pendingPercent}%)</span>
          <span>Paid: ₹{paidAmount.toLocaleString("en-IN")} ({billsPercent}%)</span>
        </div>
      </div>

      <div className="expenses-grid">
        <div className="expenses-col">
          <div className="section-head">
            <h4>Bills & Reminders</h4>
            <div className="pill-filters">
              <button className={`filter-pill${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>
                All ({bills.length})
              </button>
              <button className={`filter-pill${filter === "upcoming" ? " active" : ""}`} onClick={() => setFilter("upcoming")}>
                Pending ({bills.filter((b) => !b.paid).length})
              </button>
              <button className={`filter-pill${filter === "paid" ? " active" : ""}`} onClick={() => setFilter("paid")}>
                Paid ({bills.filter((b) => b.paid).length})
              </button>
            </div>
          </div>

          <div className="card">
            {filteredBills.length === 0 ? (
              <div className="grocery-empty">No bills found in this section. Click "+ Add Bill" above to add your first bill!</div>
            ) : (
              filteredBills.map((b) => (
                <div className="file-row bill-item-row" key={b.id}>
                  <div className={`file-ico ${b.paid ? "paid-ico" : ""}`} style={{ background: b.paid ? "var(--mint-tint)" : "var(--amber-tint)" }}>
                    <RupeeIcon color={b.paid ? "#3FB6A3" : "#F5A623"} />
                  </div>
                  <div className="file-details">
                    <p className="file-name">{b.name}</p>
                    <div className="file-meta">
                      Due in {b.dueIn} · <strong>₹{b.amount.toLocaleString("en-IN")}</strong>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      className={`status-btn${b.paid ? " paid" : " pending"}`}
                      onClick={() => togglePaid(b.id)}
                    >
                      {b.paid ? "Paid ✓" : "Mark Paid"}
                    </button>
                    <button
                      className="close-btn"
                      style={{ fontSize: "14px", color: "var(--ink-soft)", padding: "4px 8px" }}
                      onClick={() => handleDeleteBill(b.id)}
                      title="Delete bill"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="expenses-col">
          <div className="section-head">
            <h4>Spending by Member</h4>
          </div>
          <div className="card">
            <div className="expense-row">
              <div>
                <p className="file-name" style={{ margin: 0 }}>
                  {user?.name || "User"}
                </p>
                <div className="file-meta">{user?.role === "admin" ? "Family Admin" : "Family Member"}</div>
              </div>
              <div className="expense-amt">₹{totalAmount.toLocaleString("en-IN")}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Bill Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Bill</h3>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddBill} className="modal-form">
              <label>
                Bill Name
                <input
                  type="text"
                  placeholder="e.g. Electricity Bill, WiFi..."
                  value={billName}
                  onChange={(e) => setBillName(e.target.value)}
                  required
                />
              </label>
              <label>
                Amount (₹)
                <input
                  type="number"
                  placeholder="e.g. 2450"
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  required
                />
              </label>
              <label>
                Due In
                <select value={billDue} onChange={(e) => setBillDue(e.target.value)}>
                  <option value="Today">Today (Urgent)</option>
                  <option value="1 day">1 day (Tomorrow)</option>
                  <option value="2 days">2 days</option>
                  <option value="3 days">3 days</option>
                  <option value="7 days">7 days</option>
                  <option value="15 days">15 days</option>
                  <option value="Next month">Next month</option>
                </select>
              </label>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
