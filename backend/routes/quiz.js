import express from "express";
import { auth } from "../middleware/auth.js";
import { selectItems } from "../services/rulesEngine.js";
import QuizSession from "../models/QuizSession.js";
import Attempt from "../models/Attempt.js";
import Item from "../models/Item.js";
import { updateMastery } from "../services/masteryService.js";

const router = express.Router();

// POST /api/quiz/start -> creates QuizSession after calling rules engine
router.post("/start", auth, async (req, res) => {
  const { mode = "formative", requestedTopics = [], limit = 6, difficulty } = req.body || {};
  
  // Try to get items, with retry logic for generated quizzes
  let selection = await selectItems({ userId: req.user._id, sessionContext: { mode, requestedTopics, difficulty }, limit });
  
  // If no items found, wait a bit and try once more (for recently generated quizzes)
  if (!selection.itemIds || selection.itemIds.length === 0) {
    // Wait 2 seconds for background generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    selection = await selectItems({ userId: req.user._id, sessionContext: { mode, requestedTopics, difficulty }, limit });
  }
  
  if (!selection.itemIds || selection.itemIds.length === 0) {
    // Still no items - return queued status
    return res.status(202).json({ queued: true, message: "Preparing questions for this topic. Please wait a few seconds and retry." });
  }
  
  // Ensure we have at least some items
  if (selection.itemIds.length < 1) {
    return res.status(400).json({ error: "Could not find or generate questions for this topic. Please try a different topic." });
  }
  
  const session = await QuizSession.create({
    user: req.user._id,
    mode,
    itemIds: selection.itemIds,
    currentIndex: 0,
    metadata: { rulesUsed: selection.metadata, requestedTopics, difficulty },
    status: "active",
  });
  return res.json({ sessionId: session._id, _id: session._id, itemIds: session.itemIds, currentIndex: session.currentIndex, total: session.itemIds.length });
});

// GET /api/quiz/active -> fetch latest active session for user
router.get("/active", auth, async (req, res) => {
  const session = await QuizSession.findOne({ user: req.user._id, status: "active" })
    .sort({ createdAt: -1 })
    .lean();
  if (!session) return res.status(404).json({ error: "No active session" });
  return res.json(session);
});

// GET /api/quiz/session/:id -> fetch a specific session
router.get("/session/:id", auth, async (req, res) => {
  const session = await QuizSession.findById(req.params.id).lean();
  if (!session || String(session.user) !== String(req.user._id)) return res.status(404).json({ error: "Session not found" });
  return res.json(session);
});

// GET /api/quiz/session/:id/details -> session with attempts and item data
router.get("/session/:id/details", auth, async (req, res) => {
  const session = await QuizSession.findById(req.params.id).lean();
  if (!session || String(session.user) !== String(req.user._id)) return res.status(404).json({ error: "Session not found" });

  const attempts = await Attempt.find({ session: session._id }).sort({ createdAt: 1 }).lean();
  const itemIds = session.itemIds || [];
  const items = await Item.find({ _id: { $in: itemIds } }).lean();
  const idToItem = new Map(items.map(i => [String(i._id), i]));

  const results = itemIds.map((id, idx) => {
    const item = idToItem.get(String(id));
    const attempt = attempts.find(a => String(a.item) === String(id)) || null;
    return {
      index: idx,
      itemId: id,
      question: item?.question || '',
      choices: item?.choices || [],
      correctAnswer: item?.answer || '',
      explanation: item?.explanation || '',
      topics: item?.topics || [],
      difficulty: item?.difficulty,
      attempt: attempt ? {
        isCorrect: attempt.isCorrect,
        userAnswer: attempt.userAnswer,
        timeTakenMs: attempt.timeTakenMs,
        createdAt: attempt.createdAt,
      } : null,
    };
  });

  res.json({
    session: {
      _id: session._id,
      mode: session.mode,
      status: session.status,
      score: session.score,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
      metadata: session.metadata,
      total: itemIds.length,
    },
    results,
  });
});

// POST /api/quiz/answer -> submit answer for current question
router.post("/answer", auth, async (req, res) => {
  const { sessionId, answer, answerIndex, timeTakenMs = 0 } = req.body || {};
  const session = await QuizSession.findById(sessionId);
  if (!session || String(session.user) !== String(req.user._id)) return res.status(404).json({ error: "Session not found" });
  if (session.status !== "active") return res.status(400).json({ error: "Session not active" });

  const itemId = session.itemIds[session.currentIndex];
  if (!itemId) return res.status(400).json({ error: "No current item", currentIndex: session.currentIndex, total: session.itemIds.length });
  const item = await Item.findById(itemId).lean();

  let submittedAnswer = typeof answer === "string" ? answer : "";
  if ((submittedAnswer === null || submittedAnswer === "") && Number.isInteger(answerIndex) && Array.isArray(item?.choices)) {
    submittedAnswer = String(item.choices[answerIndex] ?? "");
  }
  if (submittedAnswer === "") return res.status(400).json({ error: "Provide answer or answerIndex" });

  const normalize = (v) => String(v ?? "").trim().toLowerCase();
  const isCorrect = normalize(submittedAnswer) === normalize(item?.answer || "");

  await Attempt.create({
    user: req.user._id,
    item: itemId,
    session: session._id,
    isCorrect,
    userAnswer: submittedAnswer,
    timeTakenMs,
  });

  // Mastery update (approximate: use first topic or session mode if none)
  const topic = (item?.topics && item.topics[0]) || "general";
  await updateMastery(req.user._id, topic, item, isCorrect, timeTakenMs);

  // Advance index
  session.currentIndex = Math.min(session.currentIndex + 1, session.itemIds.length);
  await session.save();

  const hasMore = session.currentIndex < session.itemIds.length;
  return res.json({
    isCorrect,
    correctAnswer: item?.answer,
    currentIndex: session.currentIndex,
    hasMore,
    nextItemId: hasMore ? session.itemIds[session.currentIndex] : null,
    itemId,
  });
});

// Helper: GET /api/quiz/current?sessionId=...
router.get("/current", auth, async (req, res) => {
  const { sessionId } = req.query || {};
  const session = await QuizSession.findById(sessionId || "");
  if (!session || String(session.user) !== String(req.user._id)) return res.status(404).json({ error: "Session not found" });
  const itemId = session.itemIds[session.currentIndex];
  const item = itemId ? await Item.findById(itemId).lean() : null;
  if (!item) return res.status(404).json({ error: "No current item found" });
  return res.json({
    sessionId: session._id,
    currentIndex: session.currentIndex,
    total: session.itemIds.length,
    item: {
      _id: item._id,
      question: item.question,
      choices: item.choices || [],
      type: item.type,
      difficulty: item.difficulty,
      topics: item.topics || [],
      explanation: item.explanation || "",
    },
  });
});

// GET /api/quiz/sessions -> get user's quiz sessions
router.get("/sessions", auth, async (req, res) => {
  const { status, limit = 10 } = req.query;
  const filter = { user: req.user._id };
  if (status) filter.status = status;
  const sessions = await QuizSession.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit), 50))
    .lean();
  res.json(sessions);
});

// POST /api/quiz/finish -> finalize session
router.post("/finish", auth, async (req, res) => {
  const { sessionId } = req.body || {};
  const session = await QuizSession.findById(sessionId);
  if (!session || String(session.user) !== String(req.user._id)) return res.status(404).json({ error: "Session not found" });

  // Compute quiz-based score: proportion of correct attempts out of total questions in quiz
  const attempts = await Attempt.find({ session: session._id }).lean();
  const totalQuestions = session.itemIds?.length || 0;
  const correct = attempts.filter((a) => a.isCorrect).length;
  
  // Score is based on quiz completion, not just attempts
  // If user didn't answer all questions, count unanswered as incorrect
  const answeredCount = attempts.length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const score = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;

  session.score = score;
  session.status = "completed";
  session.completedAt = new Date();
  await session.save();

  return res.json({ 
    sessionId: session._id, 
    score, 
    correct,
    total: totalQuestions,
    answered: answeredCount,
    unanswered: unansweredCount,
    attempts: attempts.length 
  });
});

export default router;


