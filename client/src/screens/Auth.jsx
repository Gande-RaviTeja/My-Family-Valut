import { useState, useEffect } from "react";
import { api } from "../api.js";
import {
  signUpUser,
  loginUser as loginFirebaseUser,
  resendVerificationEmail,
  verifyEmailCode,
  logoutFirebaseUser,
  resetPassword,
  auth,
} from "../firebase.js";
import { EyeIcon, EyeOffIcon } from "../components/icons.jsx";

function PasswordInput({ value, onChange, placeholder = "••••••••", minLength = 6, required = true }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div style={{ position: "relative", width: "100%", display: "flex", alignItems: "center" }}>
      <input
        type={showPassword ? "text" : "password"}
        placeholder={placeholder}
        minLength={minLength}
        value={value}
        onChange={onChange}
        required={required}
        style={{ width: "100%", paddingRight: "40px", boxSizing: "border-box" }}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        title={showPassword ? "Hide Password" : "Show Password"}
        style={{
          position: "absolute",
          right: "12px",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-soft)",
          outline: "none",
        }}
      >
        {showPassword ? <EyeOffIcon size={18} color="var(--purple)" /> : <EyeIcon size={18} color="var(--ink-soft)" />}
      </button>
    </div>
  );
}

export default function Auth({ onLogin, onSignUp, onGuest }) {
  const [tab, setTab] = useState("login"); // 'login' | 'register' | 'verify' | 'invite' | 'create-account'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  // Verification Pending state
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [resendSuccessMsg, setResendSuccessMsg] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [isUnverifiedLogin, setIsUnverifiedLogin] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Create Family form state
  const [createName, setCreateName] = useState("");
  const [createFamilyName, setCreateFamilyName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createConfirmPassword, setCreateConfirmPassword] = useState("");

  // Invitation state
  const [inviteToken, setInviteToken] = useState("");
  const [inviteData, setInviteData] = useState(null);
  const [inviteExpired, setInviteExpired] = useState(false);

  // Complete Invitation / Create Account form state
  const [invitedEmail, setInvitedEmail] = useState("");
  const [accName, setAccName] = useState("");
  const [accPassword, setAccPassword] = useState("");
  const [accConfirmPassword, setAccConfirmPassword] = useState("");

  useEffect(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    // 1. Firebase Email Link Parsing (mode=verifyEmail & oobCode=...)
    const mode = params.get("mode");
    const oobCode = params.get("oobCode");
    if (mode === "verifyEmail" && oobCode) {
      handleFirebaseVerificationLink(oobCode);
      return;
    }

    // 2. Invitation Token Parsing (/invite/:token, ?invite=token, or ?code=token)
    let token = params.get("invite") || params.get("code");
    if (!token && path.includes("/invite/")) {
      token = path.split("/invite/")[1]?.split("/")[0]?.split("?")[0];
    }

    if (token) {
      setInviteToken(token);
      try {
        localStorage.setItem("pending_invite_token", token);
      } catch {}
      setTab("invite");
      fetchInviteDetails(token);
      return;
    }

    // 3. Email Verification Route Parsing (/verify-email)
    if (path.includes("/verify-email")) {
      setTab("verify");
    }
  }, []);

  async function handleFirebaseVerificationLink(oobCode) {
    setLoading(true);
    setError("");
    setInfoMessage("Verifying your email with Firebase...");
    try {
      await verifyEmailCode(oobCode);
      const pendingInviteToken = localStorage.getItem("pending_invite_token") || inviteToken;
      if (auth.currentUser?.email) {
        await api.markEmailVerified(auth.currentUser.email, pendingInviteToken).catch(() => {});
      }
      if (pendingInviteToken) {
        localStorage.removeItem("pending_invite_token");
      }
      await logoutFirebaseUser().catch(() => {});
      setInfoMessage("Your email has been verified successfully! Please sign in to access your dashboard.");
      setTab("login");
    } catch (err) {
      setError(err.message || "Verification link expired or invalid. Please sign in to request a fresh link.");
      setTab("login");
    } finally {
      setLoading(false);
    }
  }

  async function fetchInviteDetails(token) {
    setLoading(true);
    setError("");
    try {
      const data = await api.getInvite(token);
      if (data.valid) {
        setInviteData(data);
        setInvitedEmail(data.email || "");
        setInviteExpired(false);
      } else {
        setInviteExpired(true);
        setError("This invitation is no longer valid.");
      }
    } catch (err) {
      setInviteExpired(true);
      setError(err.message || "This invitation is no longer valid.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckVerified() {
    setLoading(true);
    setError("");
    setInfoMessage("");
    setResendSuccessMsg("");
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await currentUser.reload();
        if (currentUser.emailVerified) {
          const pendingInviteToken = localStorage.getItem("pending_invite_token") || inviteToken;
          await api.markEmailVerified(currentUser.email, pendingInviteToken).catch(() => {});
          if (pendingInviteToken) {
            localStorage.removeItem("pending_invite_token");
          }
          await logoutFirebaseUser().catch(() => {});
          setInfoMessage("Your email has been verified successfully! Please sign in to access your account.");
          setTab("login");
        } else {
          setError("Your email has not been verified yet. Please check your inbox and click the verification link.");
        }
      } else {
        setInfoMessage("Please sign in with your credentials to verify your account status.");
        setTab("login");
      }
    } catch (err) {
      setError(err.message || "Failed to check email verification status.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!loginEmail.trim()) {
      setError("Please enter your email address first to receive a password reset link.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await resetPassword(loginEmail.trim());
      setInfoMessage(`Password reset link sent to ${loginEmail.trim()}! Please check your email inbox.`);
    } catch (err) {
      setError(err.message || "Failed to send password reset email.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    const emailToResend = pendingVerificationEmail || loginEmail.trim() || createEmail.trim() || invitedEmail.trim();
    if (!emailToResend) {
      setError("Please enter your email address to resend verification link.");
      return;
    }
    setError("");
    setResendSuccessMsg("");
    setResendLoading(true);
    try {
      await resendVerificationEmail(emailToResend, loginPassword);
      setResendSuccessMsg(`✉️ A fresh verification link has been sent to ${emailToResend}! Please check your inbox and spam folder.`);
    } catch (err) {
      setError(err.message || "Unable to send verification link.");
    } finally {
      setResendLoading(false);
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;
    if (loginPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    setError("");
    setInfoMessage("");
    setIsUnverifiedLogin(false);
    setLoading(true);

    try {
      const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
      const isPlaceholderKey = !apiKey || apiKey === "YOUR_FIREBASE_API_KEY";

      if (!isPlaceholderKey && !loginEmail.toLowerCase().includes("demo") && !loginEmail.toLowerCase().includes("test")) {
        try {
          const fbUser = await loginFirebaseUser(loginEmail.trim(), loginPassword);
          const pendingInviteToken = localStorage.getItem("pending_invite_token") || inviteToken;
          await api.markEmailVerified(fbUser.email, pendingInviteToken).catch(() => {});
          if (pendingInviteToken) {
            localStorage.removeItem("pending_invite_token");
          }
        } catch (fbErr) {
          if (fbErr.message && (fbErr.message.toLowerCase().includes("verify") || fbErr.code === "auth/email-not-verified")) {
            setIsUnverifiedLogin(true);
            setPendingVerificationEmail(loginEmail.trim());
            setError("Please verify your email before signing in.");
            setLoading(false);
            return;
          } else {
            throw fbErr;
          }
        }
      }

      const pendingInviteToken = localStorage.getItem("pending_invite_token") || inviteToken;
      if (pendingInviteToken) {
        await api.markEmailVerified(loginEmail.trim(), pendingInviteToken).catch(() => {});
      }

      const data = await api.loginUser({ email: loginEmail.trim(), password: loginPassword });
      onLogin(data.user);
    } catch (err) {
      if (err.message && (err.message.toLowerCase().includes("verify") || err.code === "auth/email-not-verified")) {
        setIsUnverifiedLogin(true);
        setPendingVerificationEmail(loginEmail.trim());
        setError("Please verify your email before signing in.");
      } else {
        setError(err.message || "Invalid email or password");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateFamilySubmit(e) {
    e.preventDefault();
    if (!createName.trim() || !createEmail.trim() || !createPassword) return;
    if (createPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (createConfirmPassword && createPassword !== createConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setInfoMessage("");
    setLoading(true);

    try {
      const cleanFamily = createFamilyName.trim() || `${createName.trim()}'s Family`;

      // 1. Create Family in MongoDB
      await api.createFamily({
        name: createName.trim(),
        email: createEmail.trim(),
        password: createPassword,
        confirmPassword: createConfirmPassword,
        familyName: cleanFamily,
      });

      // 2. Firebase Auth signup (dispatches Firebase verification email)
      const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
      const isPlaceholderKey = !apiKey || apiKey === "YOUR_FIREBASE_API_KEY";
      if (!isPlaceholderKey) {
        try {
          await signUpUser(createEmail.trim(), createPassword, createName.trim());
        } catch (fbErr) {
          console.log("Firebase signup note:", fbErr.message);
        }
      }

      // 3. Show Verification Page (Must NOT go to dashboard)
      setPendingVerificationEmail(createEmail.trim());
      setLoginEmail(createEmail.trim());
      setTab("verify");
    } catch (err) {
      setError(err.message || "Failed to create family.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptInviteClick() {
    if (!inviteToken) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.acceptInvite(inviteToken);

      if (res.action === "joined" && res.user) {
        setInfoMessage(`Successfully joined ${res.user.familyName || "family"}! Redirecting...`);
        setTimeout(() => {
          onLogin(res.user);
        }, 1000);
      } else if (res.action === "verify_required") {
        setPendingVerificationEmail(res.email);
        setTab("verify");
      } else if (res.action === "create_account_required") {
        setInvitedEmail(res.email || "");
        setTab("create-account");
      }
    } catch (err) {
      setError(err.message || "Failed to accept invitation.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAccountInviteSubmit(e) {
    e.preventDefault();
    if (!accName.trim() || !accPassword) return;
    if (accPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (accConfirmPassword && accPassword !== accConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      await api.createAccountInvite({
        token: inviteToken,
        email: invitedEmail.trim(),
        name: accName.trim(),
        password: accPassword,
        confirmPassword: accConfirmPassword,
      });

      if (inviteToken) {
        try {
          localStorage.setItem("pending_invite_token", inviteToken);
        } catch {}
      }

      // Firebase Auth signup (dispatches Firebase verification email)
      const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
      const isPlaceholderKey = !apiKey || apiKey === "YOUR_FIREBASE_API_KEY";
      if (!isPlaceholderKey && invitedEmail) {
        try {
          await signUpUser(invitedEmail.trim(), accPassword, accName.trim());
        } catch (fbErr) {
          console.log("Firebase signup note:", fbErr.message);
        }
      }

      setPendingVerificationEmail(invitedEmail.trim());
      setLoginEmail(invitedEmail.trim());
      setTab("verify");
    } catch (err) {
      setError(err.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card card">
        {/* Brand Header */}
        <div className="auth-header">
          <div className="auth-logo">🏡</div>
          <h1 className="brand-title">My Home</h1>
          <p className="brand-tagline">Private Family Digital Vault & Household Finances</p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="alert-error" style={{ marginBottom: 20 }}>
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Global Info Banner */}
        {infoMessage && (
          <div className="alert-info" style={{ marginBottom: 20 }}>
            <span>ℹ️ {infoMessage}</span>
          </div>
        )}

        {/* Tab Selection Navigation (Create Family & Sign In ONLY) */}
        {tab !== "verify" && tab !== "invite" && tab !== "create-account" && (
          <div className="auth-tabs">
            <button
              className={`auth-tab ${tab === "login" ? "active" : ""}`}
              onClick={() => {
                setTab("login");
                setError("");
                setInfoMessage("");
                setIsUnverifiedLogin(false);
              }}
            >
              Sign In
            </button>
            <button
              className={`auth-tab ${tab === "register" ? "active" : ""}`}
              onClick={() => {
                setTab("register");
                setError("");
                setInfoMessage("");
                setIsUnverifiedLogin(false);
              }}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* VIEW 1: SIGN IN */}
        {tab === "login" && (
          <div>
            <h2 className="auth-title">Welcome Back</h2>
            <p className="auth-subtitle">Sign in to access your family vault & shared finances</p>

            <form onSubmit={handleLoginSubmit} className="modal-form">
              <label>
                Email Address
                <input
                  type="email"
                  placeholder="e.g. parent@family.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </label>
              <label>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Password</span>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--purple)",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <PasswordInput
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </label>

              {isUnverifiedLogin ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn-primary auth-submit-btn"
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                  >
                    {resendLoading ? "Sending..." : "Resend Verification Email ✉️"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary auth-submit-btn"
                    onClick={() => setIsUnverifiedLogin(false)}
                  >
                    Back
                  </button>
                </div>
              ) : (
                <button type="submit" className="btn-primary auth-submit-btn" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In ➔"}
                </button>
              )}
            </form>
          </div>
        )}

        {/* VIEW 2: CREATE FAMILY */}
        {tab === "register" && (
          <div>
            <h2 className="auth-title">Sign Up</h2>
            <p className="auth-subtitle">Create a brand new family vault and become the Family Admin</p>

            <form onSubmit={handleCreateFamilySubmit} className="modal-form">
              <label>
                Full Name
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                />
              </label>
              <label>
                Family Name
                <input
                  type="text"
                  placeholder="e.g. The Sharma Family"
                  value={createFamilyName}
                  onChange={(e) => setCreateFamilyName(e.target.value)}
                  required
                />
              </label>
              <label>
                Email Address
                <input
                  type="email"
                  placeholder="rahul@family.com"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  required
                />
              </label>
              <label>
                Password
                <PasswordInput
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                />
              </label>
              <label>
                Confirm Password
                <PasswordInput
                  value={createConfirmPassword}
                  onChange={(e) => setCreateConfirmPassword(e.target.value)}
                />
              </label>
              <button type="submit" className="btn-primary auth-submit-btn" disabled={loading}>
                {loading ? "Creating Family..." : "Create Family ➔"}
              </button>
            </form>
          </div>
        )}

        {/* VIEW 3: VERIFY EMAIL PAGE */}
        {tab === "verify" && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>✉️</div>
            <h2 className="auth-title" style={{ marginBottom: 8 }}>Verify Your Email</h2>
            <p className="auth-subtitle" style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 24, lineHeight: 1.6 }}>
              Please check your email address ({pendingVerificationEmail || loginEmail || createEmail || invitedEmail}) and click the verification link to verify your account.
            </p>

            {resendSuccessMsg && (
              <div className="alert-info" style={{ marginBottom: 20 }}>
                <span>{resendSuccessMsg}</span>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                type="button"
                className="btn-primary auth-submit-btn"
                onClick={handleCheckVerified}
                disabled={loading}
              >
                {loading ? "Checking Status..." : "I've Verified My Email ➔"}
              </button>

              <button
                type="button"
                className="btn-secondary auth-submit-btn"
                onClick={handleResendVerification}
                disabled={resendLoading}
              >
                {resendLoading ? "Sending Link..." : "Resend Verification Email ✉️"}
              </button>

              <button
                type="button"
                className="btn-secondary auth-submit-btn"
                style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--ink-soft)" }}
                onClick={async () => {
                  await logoutFirebaseUser().catch(() => {});
                  setTab("login");
                  setError("");
                  setInfoMessage("");
                }}
              >
                Back to Sign In
              </button>
            </div>
          </div>
        )}

        {/* VIEW 4: INVITATION PAGE (/invite/:token) */}
        {tab === "invite" && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            {inviteExpired ? (
              <div>
                <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
                <h2 className="auth-title">Invitation Expired</h2>
                <p className="auth-subtitle" style={{ marginBottom: 24 }}>This invitation is no longer valid.</p>
                <button
                  type="button"
                  className="btn-primary auth-submit-btn"
                  onClick={() => {
                    setTab("login");
                    setError("");
                  }}
                >
                  Request New Invitation
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 44, marginBottom: 12 }}>📩</div>
                <h2 className="auth-title">You've Been Invited!</h2>
                <p className="auth-subtitle" style={{ marginBottom: 20 }}>
                  You have been invited to join a family digital vault
                </p>

                {inviteData && (
                  <div style={{ background: "var(--purple-tint)", borderRadius: 14, padding: "18px 20px", marginBottom: 24, textAlign: "left" }}>
                    <div style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 800, color: "var(--purple)", marginBottom: 6 }}>
                      Family Details
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>
                      🏡 {inviteData.familyName || "Family Vault"}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 6 }}>
                      Invited By: <strong>{inviteData.inviterName || "Family Admin"}</strong>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="btn-primary auth-submit-btn"
                  onClick={handleAcceptInviteClick}
                  disabled={loading}
                >
                  {loading ? "Processing..." : "Accept Invitation ➔"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW 5: CREATE ACCOUNT PAGE (/create-account?invite={token}) */}
        {tab === "create-account" && (
          <div>
            <h2 className="auth-title">Complete Your Invitation</h2>
            <p className="auth-subtitle">You've been invited to join a family. Create your account to continue.</p>

            <form onSubmit={handleCreateAccountInviteSubmit} className="modal-form">
              <label>
                Full Name
                <input
                  type="text"
                  placeholder="e.g. Member Name"
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  required
                />
              </label>
              <label>
                {(invitedEmail && inviteData?.email) ? "Email Address (Pre-filled from invitation)" : "Email Address"}
                <input
                  type="email"
                  placeholder="e.g. member@gmail.com"
                  value={invitedEmail}
                  onChange={(e) => setInvitedEmail(e.target.value)}
                  readOnly={Boolean(invitedEmail && inviteData?.email)}
                  style={{
                    background: (invitedEmail && inviteData?.email) ? "#F1F5F9" : "#FFFFFF",
                    cursor: (invitedEmail && inviteData?.email) ? "not-allowed" : "text",
                    fontWeight: 600,
                    color: (invitedEmail && inviteData?.email) ? "#64748B" : "var(--ink)",
                  }}
                  required
                />
              </label>
              <label>
                Password
                <PasswordInput
                  value={accPassword}
                  onChange={(e) => setAccPassword(e.target.value)}
                />
              </label>
              <label>
                Confirm Password
                <PasswordInput
                  value={accConfirmPassword}
                  onChange={(e) => setAccConfirmPassword(e.target.value)}
                />
              </label>
              <button type="submit" className="btn-primary auth-submit-btn" disabled={loading}>
                {loading ? "Creating Account..." : "Create Account ➔"}
              </button>
            </form>
          </div>
        )}

        {/* Footer Guest Link */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            type="button"
            onClick={onGuest}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--ink-soft)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Just exploring? Take a tour in Guest Mode
          </button>
        </div>
      </div>
    </div>
  );
}

