const BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  // Auth & Family Management
  createFamily: (data) =>
    request("/auth/create-family", { method: "POST", body: JSON.stringify(data) }),
  inviteMember: (data) =>
    request("/auth/invite-member", { method: "POST", body: JSON.stringify(data) }),
  getInvite: (token) => request(`/auth/invite/${token}`),
  acceptInvite: (token) =>
    request("/auth/accept-invite", { method: "POST", body: JSON.stringify({ token }) }),
  createAccountInvite: (data) =>
    request("/auth/create-account-invite", { method: "POST", body: JSON.stringify(data) }),
  verifyEmail: (token, inviteToken) =>
    request(`/auth/verify-email?token=${encodeURIComponent(token)}${inviteToken ? `&inviteToken=${encodeURIComponent(inviteToken)}` : ""}`),
  resendVerification: (email) =>
    request("/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) }),
  loginUser: (data) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  markEmailVerified: (email, inviteToken) =>
    request("/auth/mark-verified", { method: "POST", body: JSON.stringify({ email, inviteToken }) }),
  getFamilyMembers: (familyId) => request(`/auth/members/${familyId}`),
  updateMemberPermission: (memberId, permission) =>
    request("/auth/members/permission", {
      method: "PATCH",
      body: JSON.stringify({ memberId, permission }),
    }),
  renameMemberGlobally: (memberId, newName) =>
    request("/auth/members/rename", {
      method: "PATCH",
      body: JSON.stringify({ memberId, newName }),
    }),
  removeMember: (memberId) =>
    request(`/auth/members/${memberId}`, { method: "DELETE" }),

  getFamily: () => request("/family"),
  getMembers: () => request("/family/members"),
  getMemberDocuments: (id) => request(`/family/members/${id}/documents`),
  getRecentUploads: () => request("/family/uploads/recent"),
  getExpenses: () => request("/family/expenses"),

  // Dynamic MongoDB Expenses & Bills
  getFamilyExpenses: (familyId) => request(`/expenses/family/${encodeURIComponent(familyId)}`),
  addExpense: (data) =>
    request("/expenses", { method: "POST", body: JSON.stringify(data) }),
  toggleExpense: (id) => request(`/expenses/${id}/toggle`, { method: "PATCH" }),
  deleteExpense: (id) => request(`/expenses/${id}`, { method: "DELETE" }),

  getGroceryItems: (familyId) => request(`/grocery${familyId ? `?familyId=${encodeURIComponent(familyId)}` : ""}`),
  addGroceryItem: (name, addedBy, familyId) =>
    request("/grocery", { method: "POST", body: JSON.stringify({ name, addedBy, familyId }) }),
  toggleGroceryItem: (id) => request(`/grocery/${id}/toggle`, { method: "PATCH" }),
  deleteGroceryItem: (id) => request(`/grocery/${id}`, { method: "DELETE" }),

  // Groq AI Integration
  askFamilyAI: (promptText, userContext) =>
    request("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ promptText, userContext }),
    }),
  autoFillDocumentInfo: (filename) =>
    request("/ai/autofill", {
      method: "POST",
      body: JSON.stringify({ filename }),
    }),

  // MongoDB Document Storage
  getFamilyDocuments: (familyId) => request(`/documents/family/${familyId}`),
  searchFamilyDocuments: (familyId, query) =>
    request(`/documents/search/${familyId}?q=${encodeURIComponent(query || "")}`),
  uploadDocument: (docData) =>
    request("/documents", {
      method: "POST",
      body: JSON.stringify(docData),
    }),
  deleteDocument: (id) => request(`/documents/${id}`, { method: "DELETE" }),
};
