import mongoose from "mongoose";

let isConnecting = false;

export async function connectDB() {
  if (mongoose.connection.readyState === 1 || isConnecting) {
    return;
  }

  isConnecting = true;
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/my-home";
  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB connected successfully -> ${uri}`);
    isConnecting = false;
  } catch (err) {
    isConnecting = false;
    console.error("❌ MongoDB connection attempt failed:", err.message);
    throw err;
  }
}
