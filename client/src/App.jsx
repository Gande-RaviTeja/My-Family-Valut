import { useState, useEffect } from "react";
import TabBar from "./components/TabBar.jsx";
import Auth from "./screens/Auth.jsx";
import Dashboard from "./screens/Dashboard.jsx";
import Profile from "./screens/Profile.jsx";
import Folder from "./screens/Folder.jsx";
import Expenses from "./screens/Expenses.jsx";
import Grocery from "./screens/Grocery.jsx";
import FamilyAI from "./screens/FamilyAI.jsx";
import Account from "./screens/Account.jsx";
import { SparkleAIIcon, HomeIcon, BellIcon } from "./components/icons.jsx";
import { logoutFirebaseUser } from "./firebase.js";
import { api } from "./api.js";
import { parseDueDays, isDueWithinDays } from "./utils/billHelper.js";

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("myhome_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const familyKey = user?.familyId || user?.inviteCode || "FAM-DEFAULT";

  const [screen, setScreen] = useState(() => {
    return localStorage.getItem("myhome_screen") || "dashboard";
  });

  const [prevScreen, setPrevScreen] = useState("dashboard");
  const [memberId, setMemberId] = useState("chandrakala");
  const [activeFolder, setActiveFolder] = useState(null);
  
  const [readNotifIds, setReadNotifIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`myhome_read_notifs_${familyKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Sync unpaid bills due <= 3 days into dynamic notifications
  useEffect(() => {
    if (!user) return;

    const buildBillNotifications = (bList) => {
      if (!Array.isArray(bList)) return;
      const billNotifs = bList
        .filter((b) => !b.paid && isDueWithinDays(b.dueIn, 3))
        .map((b) => {
          const id = `bill-${b.id || b._id || b.name}`;
          const dueDays = parseDueDays(b.dueIn);
          const timeText = dueDays === 0 ? "Due Today ⚡" : dueDays === 1 ? "Due Tomorrow" : `Due in ${b.dueIn}`;
          return {
            id,
            billId: b.id || b._id,
            text: `⚡ Bill Reminder: "${b.name}" (₹${Number(b.amount || 0).toLocaleString("en-IN")}) is due in ${b.dueIn}!`,
            time: timeText,
            read: readNotifIds.includes(id),
            dueDays,
          };
        });

      setNotifications(billNotifs);
    };

    // Load from local cache first
    try {
      const saved = localStorage.getItem(`myhome_bills_${familyKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) buildBillNotifications(parsed);
      }
    } catch {}

    // Fetch live from server
    api.getFamilyExpenses(familyKey)
      .then((serverBills) => {
        if (Array.isArray(serverBills)) {
          const formatted = serverBills.map((b) => ({
            id: b._id || b.id,
            name: b.name,
            amount: b.amount,
            dueIn: b.dueIn || "3 days",
            paid: Boolean(b.paid),
            addedBy: b.addedBy || "User",
          }));
          buildBillNotifications(formatted);
        }
      })
      .catch(() => {});
  }, [user, familyKey, readNotifIds, screen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function markAllNotificationsRead() {
    const allIds = notifications.map((n) => n.id);
    const updatedReadIds = Array.from(new Set([...readNotifIds, ...allIds]));
    setReadNotifIds(updatedReadIds);
    try {
      localStorage.setItem(`myhome_read_notifs_${familyKey}`, JSON.stringify(updatedReadIds));
    } catch {}
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function handleToggleNotifications() {
    const nextState = !showNotifications;
    setShowNotifications(nextState);

    // If opening dropdown, automatically mark all notifications as read!
    if (nextState && unreadCount > 0) {
      markAllNotificationsRead();
    }
  }

  function changeScreen(nextScreen) {
    if (screen !== nextScreen && screen !== "ai") {
      setPrevScreen(screen);
    }
    setScreen(nextScreen);
    localStorage.setItem("myhome_screen", nextScreen);
  }

  function toggleAiScreen() {
    if (screen === "ai") {
      const target = prevScreen || "dashboard";
      setScreen(target);
      localStorage.setItem("myhome_screen", target);
    } else {
      setPrevScreen(screen);
      setScreen("ai");
      localStorage.setItem("myhome_screen", "ai");
    }
  }

  function openMember(id) {
    setMemberId(id);
    changeScreen("profile");
  }

  function openFolder(folder) {
    setActiveFolder(folder);
    changeScreen("folder");
  }

  function handleLogin(userData) {
    setUser(userData);
    localStorage.setItem("myhome_user", JSON.stringify(userData));
    setNotifications(userData?.isGuest ? INITIAL_NOTIFICATIONS : []);
    setScreen("dashboard");
    localStorage.setItem("myhome_screen", "dashboard");
  }

  function handleSignUp(userData) {
    setUser(userData);
    localStorage.setItem("myhome_user", JSON.stringify(userData));
    setNotifications([]);
    setScreen("dashboard");
    localStorage.setItem("myhome_screen", "dashboard");
  }

  function handleGuest() {
    const guestUser = {
      name: "Guest User",
      familyName: "Sample Family Portal",
      email: "guest@myhome.app",
      familyId: "FAM-GUEST",
      isGuest: true,
      isFresh: false,
    };
    setUser(guestUser);
    localStorage.setItem("myhome_user", JSON.stringify(guestUser));
    setScreen("dashboard");
    localStorage.setItem("myhome_screen", "dashboard");
  }

  async function handleSignOut() {
    try {
      await logoutFirebaseUser().catch(() => {});
    } catch {
      // Ignored if offline
    }
    setUser(null);
    localStorage.removeItem("myhome_user");
    localStorage.removeItem("myhome_screen");
    sessionStorage.clear();
    setScreen("dashboard");
    setShowUserMenu(false);
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // Unauthenticated -> Render Auth Screen
  if (!user) {
    return (
      <Auth
        onLogin={handleLogin}
        onSignUp={handleSignUp}
        onGuest={handleGuest}
      />
    );
  }

  function renderScreen() {
    switch (screen) {
      case "dashboard":
        return <Dashboard user={user} onOpenMember={openMember} onOpenBills={() => changeScreen("expenses")} />;
      case "profile":
        return <Profile user={user} memberId={memberId} onBack={() => changeScreen("dashboard")} onOpenFolder={openFolder} />;
      case "folder":
        return <Folder user={user} folder={activeFolder} onBack={() => changeScreen("profile")} />;
      case "expenses":
        return <Expenses user={user} />;
      case "grocery":
        return <Grocery user={user} />;
      case "ai":
        return <FamilyAI user={user} onBack={() => setScreen(prevScreen || "dashboard")} />;
      case "account":
        return <Account user={user} onSignOut={handleSignOut} />;
      default:
        return <Dashboard user={user} onOpenMember={openMember} onOpenBills={() => changeScreen("expenses")} />;
    }
  }

  const activeTab = screen === "folder" ? "profile" : screen;

  return (
    <div className="app-shell">
      {/* Guest Mode Banner */}
      {user.isGuest && (
        <div className="guest-banner">
          <span>You are exploring in <strong>Guest Mode</strong>.</span>
          <button className="guest-signup-pill" onClick={handleSignOut}>
            Create Fresh Portal
          </button>
        </div>
      )}

      <header className="desktop-header">
        <div className="header-container">
          <div className="brand" onClick={() => changeScreen("dashboard")}>
            <div className="brand-badge">🏡</div>
            <div className="brand-text">
              <span className="brand-title">My Home</span>
              <span className="brand-subtitle">{user.familyName || "Family Portal"}</span>
            </div>
          </div>

          <TabBar active={activeTab} onChange={changeScreen} variant="desktop" />

          <div className="header-actions">
            <div className="family-key-badge" style={{ fontWeight: 700, letterSpacing: "0.03em" }}>
              CODE: {(user.inviteCode || user.familyId || "").length === 24 ? `FAM-${(user.inviteCode || user.familyId).slice(-6).toUpperCase()}` : (user.inviteCode || user.familyId)}
            </div>

            {/* Notification Bell */}
            <div className="notification-wrapper">
              <button className="bell" onClick={handleToggleNotifications} title="Notifications">
                <BellIcon color="#726F8C" size={19} />
                {unreadCount > 0 && (
                  <span className="bell-badge-count">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="notification-dropdown card">
                  <div className="notification-header">
                    <strong>Notifications ({notifications.length})</strong>
                    {unreadCount > 0 && (
                      <button className="mark-read-btn" onClick={markAllNotificationsRead}>
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="notification-list">
                    {notifications.length === 0 ? (
                      <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600 }}>
                        No upcoming bills or notifications 🔔<br />
                        <span style={{ fontSize: 11.5, color: "var(--ink-soft)", fontWeight: 400 }}>You are all caught up!</span>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`notification-item${n.read ? " read" : ""}`}
                          onClick={() => {
                            if (n.billId) {
                              changeScreen("expenses");
                              setShowNotifications(false);
                            }
                          }}
                          style={{ cursor: n.billId ? "pointer" : "default" }}
                          title={n.billId ? "Click to view bill in Expenses" : ""}
                        >
                          <p style={{ margin: 0, fontWeight: 700, fontSize: 12.5 }}>{n.text}</p>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                            <span style={{ fontSize: 10.5, color: "var(--ink-soft)", fontWeight: 600 }}>{n.time}</span>
                            {n.billId && <span style={{ fontSize: 10, color: "var(--purple)", fontWeight: 700 }}>View Bill ➔</span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Badge & Menu */}
            <div className="user-menu-wrapper" style={{ position: "relative" }}>
              <button className="user-avatar-btn" onClick={() => setShowUserMenu(!showUserMenu)}>
                <div className="avatar-img" style={{ width: 36, height: 36, fontSize: 14, background: "var(--purple)", margin: 0 }}>
                  {user.name.charAt(0)}
                </div>
              </button>
              {showUserMenu && (
                <div className="user-dropdown card">
                  <div className="user-dropdown-info">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <div className="user-dropdown-divider" />
                  <button className="user-dropdown-item" onClick={() => { changeScreen("account"); setShowUserMenu(false); }}>
                    Account Settings
                  </button>
                  <button className="user-dropdown-item danger" onClick={handleSignOut}>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="main-container">{renderScreen()}</div>
      </main>

      {/* Floating On-Screen Family AI Access Button */}
      <button
        className={`floating-ai-fab${screen === "ai" ? " active" : ""}`}
        onClick={toggleAiScreen}
        title={screen === "ai" ? "Close AI (Return Back)" : "Ask Family AI Assistant"}
      >
        <SparkleAIIcon size={22} color="#FFFFFF" />
        <span className="fab-ai-text">{screen === "ai" ? "✕" : "AI"}</span>
      </button>

      <div className="mobile-tabbar-wrapper">
        <TabBar active={activeTab} onChange={changeScreen} variant="bottom" />
      </div>
    </div>
  );
}
