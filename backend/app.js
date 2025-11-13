import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import aiRoutes from "./routes/ai.js";
import quizRoutes from "./routes/quiz.js";
import notesRoutes from "./routes/notes.js";
import chatRoutes from "./routes/chat.js";
import quizzesRoutes from "./routes/quizzes.js";
import adminRoutes from './routes/admin.js';
import issueRoutes from './routes/issues.js';
import learningRoutes from './routes/learning.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Health check
app.get("/api/ping", (req, res) => {
  res.json({ ok: true, message: "pong" });
});

app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/quizzes", quizzesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/', issueRoutes); // routes/issues.js exports router with POST /api/report-issue
app.use('/api/learning', learningRoutes);

// Mongo connection (lazy connect if URI present)
const MONGO_URI = process.env.MONGO_URI;
if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI, { dbName: process.env.MONGO_DB || "nimbus" })
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.error("MongoDB connection error", err));
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});


