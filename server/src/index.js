import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import groceryRoutes from "./routes/groceryRoutes.js";
import familyRoutes from "./routes/familyRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";

import mongoose from "mongoose";

dotenv.config();

const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000", "http://localhost:5174"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json());


app.get("/api/health", (req, res) => res.json({ status: "ok", dbConnected: mongoose.connection.readyState === 1 }));

// Middleware: Ensure database is connected or auto-reconnect
app.use(async (req, res, next) => {
  if (req.path === "/api/health") return next();

  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch {
      return res.status(503).json({
        message: "Database connection unavailable. Your IP address may not be whitelisted in MongoDB Atlas (Network Access -> Add IP Address: 0.0.0.0/0)."
      });
    }
  }
  next();
});

// Redirect direct backend invite links to client React SPA
app.get("/invite/:token", (req, res) => {
  const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
  res.redirect(`${clientOrigin}/invite/${req.params.token}`);
});

app.use("/api/auth", authRoutes);
app.use("/api/grocery", groceryRoutes);
app.use("/api/family", familyRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/expenses", expenseRoutes);

app.use((req, res) => res.status(404).json({ message: "Not found" }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || "Server error" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server listening on http://127.0.0.1:${PORT}`);
  connectDB().catch((err) => {
    console.warn("⚠️ Server started in fallback mode (MongoDB disconnected).");
  });
});
