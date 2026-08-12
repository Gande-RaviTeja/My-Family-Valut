import { Router } from "express";
import Document from "../models/Document.js";

const router = Router();

// Fallback catalog if database is empty on first run
const FALLBACK_PUBLIC_DOCUMENTS = [
  { name: "Aadhaar — Chandrakala.pdf", member: "Chandrakala", category: "Identity", privacy: "Shared with family", date: "2024-01-15" },
  { name: "PAN Card — Chandrakala.pdf", member: "Chandrakala", category: "Identity", privacy: "Shared with family", date: "2024-02-10" },
  { name: "MA Degree Certificate.pdf", member: "Chandrakala", category: "Education", privacy: "Shared with family", date: "2023-06-20" },
  { name: "Aadhaar — Ravi.pdf", member: "Ravi", category: "Identity", privacy: "Shared with family", date: "2024-01-12" },
  { name: "Union Bank Statement.pdf", member: "Ravi", category: "Banking", privacy: "Shared with family", date: "2024-07-01" },
  { name: "10th Class Marks Memo.pdf", member: "Sindhu", category: "Education", privacy: "Shared with family", date: "2021-05-15" },
  { name: "B.Tech Degree Certificate.pdf", member: "Sindhu", category: "Education", privacy: "Shared with family", date: "2024-06-30" },
  { name: "Senior Citizen Card — Lakshmi.pdf", member: "Lakshmi", category: "Identity", privacy: "Shared with family", date: "2023-09-10" },
];

router.post("/chat", async (req, res) => {
  try {
    const { promptText, userContext } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!promptText || !promptText.trim()) {
      return res.status(400).json({ message: "Prompt text is required" });
    }

    const userName = userContext?.name || "Family Member";
    const familyName = userContext?.familyName || "Family";
    const familyId = userContext?.familyId || userContext?.inviteCode;

    // 1. Fetch real documents from MongoDB for this specific family
    let dbDocs = [];
    try {
      const query = { privacy: "Shared with family" };
      if (familyId) query.familyId = familyId;
      dbDocs = await Document.find(query).lean();
    } catch (err) {
      console.log("Could not query MongoDB for documents:", err.message);
    }

    // Only use fallback catalog for guest / unregistered preview mode
    const isRegisteredFamily = !!userContext?.familyId && !userContext?.isGuest;
    const availableDocs = isRegisteredFamily ? dbDocs : (dbDocs.length > 0 ? dbDocs : FALLBACK_PUBLIC_DOCUMENTS);

    const docCatalogSummary = availableDocs.length > 0
      ? availableDocs
          .map(
            (d) =>
              `• Document: "${d.name}" | Member: ${d.member} | Category: ${d.category} | Privacy: ${d.privacy} | Date: ${d.createdAt ? new Date(d.createdAt).toISOString().split('T')[0] : (d.date || 'Recent')}`
          )
          .join("\n")
      : "(No documents uploaded to this family vault yet)";

    const systemPrompt = `You are "Family AI", a smart assistant for the ${familyName} digital portal.
Your primary job is to help family members find and query PUBLIC/SHARED family documents across ALL family members in real time.

PRIVACY RULES & DIRECTIVES:
1. You MUST ONLY reference and display documents marked as "Shared with family" (Public to family).
2. NEVER reveal or acknowledge Private or Parents-only documents to unauthorized queries.
3. Match documents intelligently by member name, category, or document title keywords.
4. Be warm, helpful, accurate, and concise. Format lists with clear bullet points.
5. Current User interacting with you: ${userName}

LIVE CATALOG OF PUBLIC FAMILY DOCUMENTS IN DATABASE (${availableDocs.length} Total):
${docCatalogSummary}`;

    if (!apiKey) {
      return res.json({
        text: `[Groq AI Offline] Found ${availableDocs.length} public documents in ${familyName}. Please check GROQ_API_KEY in server/.env.`,
      });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: promptText },
        ],
        temperature: 0.3,
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API Error:", response.status, errorText);
      return res.status(500).json({
        message: `Groq AI error (${response.status}). Please check API key.`,
      });
    }

    const data = await response.json();
    const replyText = data.choices?.[0]?.message?.content || "No response received from Groq AI.";

    return res.json({ text: replyText });
  } catch (error) {
    console.error("AI Chat Route Error:", error);
    return res.status(500).json({ message: "Failed to query Family AI: " + error.message });
  }
});

// POST /api/ai/autofill - Automatically analyze file name and return suggested Category, Clean Title & Privacy via Groq AI
router.post("/autofill", async (req, res) => {
  try {
    const { filename } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!filename || !filename.trim()) {
      return res.status(400).json({ message: "Filename is required" });
    }

    if (!apiKey) {
      const name = filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
      let category = "Identity";
      const lower = name.toLowerCase();
      if (lower.includes("bank") || lower.includes("passbook") || lower.includes("statement") || lower.includes("loan") || lower.includes("tax")) {
        category = "Banking";
      } else if (lower.includes("degree") || lower.includes("memo") || lower.includes("10th") || lower.includes("inter") || lower.includes("school") || lower.includes("college") || lower.includes("cert")) {
        category = "Education";
      } else if (lower.includes("health") || lower.includes("blood") || lower.includes("report") || lower.includes("prescription") || lower.includes("xray") || lower.includes("medical") || lower.includes("doctor")) {
        category = "Medical";
      } else if (lower.includes("land") || lower.includes("deed") || lower.includes("house") || lower.includes("registration") || lower.includes("property")) {
        category = "Property";
      }

      return res.json({
        cleanName: name,
        category,
        privacy: "Shared with family",
      });
    }

    const systemPrompt = `You are a Document Categorization AI. Analyze the uploaded document filename and classify it into one of these exact 5 Categories:
- Identity
- Banking
- Education
- Medical
- Property

Respond strictly with valid JSON only in this exact format:
{
  "cleanName": "Clean Formatted Title without file extensions or underscores",
  "category": "One of: Identity, Banking, Education, Medical, Property",
  "privacy": "Shared with family"
}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Filename: "${filename}"` },
        ],
        temperature: 0.1,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";
    const cleanJsonStr = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJsonStr);

    return res.json({
      cleanName: parsed.cleanName || filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
      category: ["Identity", "Banking", "Education", "Medical", "Property"].includes(parsed.category) ? parsed.category : "Identity",
      privacy: parsed.privacy || "Shared with family",
    });
  } catch (error) {
    console.error("Groq AutoFill Error:", error.message);
    const name = (req.body.filename || "").replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
    return res.json({
      cleanName: name || "Document",
      category: "Identity",
      privacy: "Shared with family",
    });
  }
});

export default router;
