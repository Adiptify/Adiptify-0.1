import express from "express";
import { auth, requireRole } from "../middleware/auth.js";
import { generateAssessment } from "../services/assessmentService.js";
import GeneratedAssessment from "../models/GeneratedAssessment.js";
import AssessmentSession from "../models/AssessmentSession.js";
import Item from "../models/Item.js";
import { selectItems } from "../services/rulesEngine.js";
import { gradeItem } from "../services/gradingService.js";
import { updateMastery } from "../services/masteryService.js";
import Attempt from "../models/Attempt.js";
import User from "../models/User.js";
import ProctorLog from "../models/ProctorLog.js";
import { updateSummary } from "../services/proctorService.js";

const router = express.Router();

// POST /api/assessment/generate - Generate new assessment
router.post("/generate", auth, async (req, res) => {
  try {
    const { topic, questionCount = 6 } = req.body || {};
    
    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: "Topic is required" });
    }

    // Check if user is instructor or admin
    if (req.user.role !== "instructor" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Only instructors and admins can generate assessments" });
    }

    const result = await generateAssessment(topic, questionCount, req.user._id);
    return res.json({
      message: "Assessment generated successfully!",
      assessmentId: result.assessment?._id || result.assessmentId,
      assessment: result.assessment,
      topic: result.assessment?.topic || topic,
      title: result.assessment?.title,
      itemCount: result.items?.length || result.assessment?.itemCount || 0,
      status: result.assessment?.status || "draft",
    });
  } catch (error) {
    console.error("Assessment generation error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate assessment" });
  }
});

// GET /api/assessment/sessions - List user's assessment sessions (MUST come before /:id)
router.get("/sessions", auth, async (req, res) => {
  try {
    const { status, limit = 20 } = req.query;
    const query = { user: req.user._id };
    if (status) query.status = status;
    
    const sessions = await AssessmentSession.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit), 50))
      .select("mode status score createdAt completedAt itemIds metadata")
      .lean();
    
    return res.json(sessions.map(s => ({
      ...s,
      _id: String(s._id),
      sessionId: String(s._id),
    })));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/assessment/list - List assessments (MUST come before /:id)
router.get("/list", auth, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const query = {};
    if (status) query.status = status;
    
    const assessments = await GeneratedAssessment.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit), 100))
      .select("topic title status createdAt linkedItemIds validated")
      .lean();
    
    const enriched = assessments.map(a => ({
      ...a,
      _id: String(a._id),
      itemCount: a.linkedItemIds?.length || 0,
    }));
    
    return res.json(enriched);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/assessment/current - Get current question (MUST come before /:id)
router.get("/current", auth, async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const session = await AssessmentSession.findById(sessionId).lean();
    if (!session || String(session.user) !== String(req.user._id)) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Allow loading questions even if session is completed (for review) or if it's just starting
    // Only block if session is cancelled or invalidated
    if (session.status === "cancelled" || session.status === "invalidated") {
      return res.status(400).json({ 
        error: `Session ${session.status}`,
        message: session.status === "invalidated" 
          ? "This session has been invalidated due to proctoring violations."
          : "This session has been cancelled."
      });
    }

    // If session is completed, still allow viewing but indicate it's completed
    if (session.status === "completed") {
      // Check if there are more questions to show
      if (session.currentIndex >= (session.itemIds?.length || 0)) {
        return res.status(400).json({ 
          error: "Assessment completed",
          message: "This assessment has been completed. View results to see your answers."
        });
      }
    }

    const itemId = session.itemIds[session.currentIndex];
    if (!itemId) {
      return res.status(400).json({ error: "No current item", currentIndex: session.currentIndex, total: session.itemIds.length });
    }

    const item = await Item.findById(itemId).lean();
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    return res.json({
      sessionId: String(session._id),
      currentIndex: session.currentIndex,
      total: session.itemIds.length,
      item: {
        _id: String(item._id),
        type: item.type,
        question: item.question,
        choices: item.choices || [],
        hints: item.hints || [],
        explanation: item.explanation || "",
        difficulty: item.difficulty,
        bloom: item.bloom,
        topics: item.topics || [],
      },
    });
  } catch (error) {
    console.error("Error fetching current assessment item:", error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/assessment/:id - Get assessment details (MUST come after specific routes)
router.get("/:id", auth, async (req, res) => {
  try {
    const assessment = await GeneratedAssessment.findById(req.params.id).lean();
    if (!assessment) return res.status(404).json({ error: "Assessment not found" });
    
    // Populate items if linked
    let items = [];
    if (assessment.linkedItemIds && assessment.linkedItemIds.length > 0) {
      items = await Item.find({ _id: { $in: assessment.linkedItemIds } })
        .select("type question choices answer explanation difficulty bloom topics")
        .lean();
    }
    
    return res.json({
      ...assessment,
      _id: String(assessment._id),
      items: items.map(i => ({ ...i, _id: String(i._id) })),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/assessment/publish/:id - Publish assessment
router.post("/publish/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "instructor" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const assessment = await GeneratedAssessment.findById(req.params.id);
    if (!assessment) return res.status(404).json({ error: "Assessment not found" });

    assessment.status = "published";
    assessment.publishedAt = new Date();
    assessment.publishedBy = req.user._id;
    await assessment.save();

    return res.json({ ok: true, message: "Assessment published successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/assessment/:id - Delete assessment
router.delete("/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "instructor" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    // Validate ObjectId
    if (!req.params.id || !/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
      return res.status(400).json({ error: "Invalid assessment ID format" });
    }

    const assessment = await GeneratedAssessment.findById(req.params.id);
    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    // Optionally delete linked items (commented out - keep items for now)
    // if (assessment.linkedItemIds && assessment.linkedItemIds.length > 0) {
    //   await Item.deleteMany({ _id: { $in: assessment.linkedItemIds } });
    // }

    await GeneratedAssessment.findByIdAndDelete(req.params.id);
    return res.json({ ok: true, message: "Assessment deleted successfully" });
  } catch (error) {
    console.error("Error deleting assessment:", error);
    return res.status(500).json({ error: "Failed to delete assessment: " + error.message });
  }
});

// POST /api/assessment/start - Start assessment session
router.post("/start", auth, async (req, res) => {
  const { mode = "formative", requestedTopics = [], limit = 6, proctored = false } = req.body || {};
  
  // Check for locked subjects
  const user = await User.findById(req.user._id);
  if (user && user.lockedSubjects && user.lockedSubjects.length > 0) {
    const lockedTopics = requestedTopics.filter(topic => user.lockedSubjects.includes(topic));
    if (lockedTopics.length > 0) {
      return res.status(403).json({ 
        error: "Access denied", 
        message: `The following subjects are locked: ${lockedTopics.join(", ")}` 
      });
    }
  }
  
  // Get items (adaptive difficulty based on mastery)
  let selection = await selectItems({ userId: req.user._id, sessionContext: { mode, requestedTopics }, limit });
  
  if (!selection.itemIds || selection.itemIds.length === 0) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    selection = await selectItems({ userId: req.user._id, sessionContext: { mode, requestedTopics }, limit });
  }
  
  if (!selection.itemIds || selection.itemIds.length === 0) {
    return res.status(202).json({ queued: true, message: "Preparing questions. Please wait and retry." });
  }
  
  // Set up proctor config
  const proctorConfig = proctored || mode === "proctored" ? {
    blockTabSwitch: true,
    blockCopyPaste: true,
    blockRightClick: true,
    allowTabSwitchCount: parseInt(process.env.ALLOW_TAB_SWITCHES_DEFAULT) || 2,
    requireSnapshots: false,
    snapshotIntervalSec: 0
  } : undefined;
  
  const session = await AssessmentSession.create({
    user: req.user._id,
    mode: proctored || mode === "proctored" ? "proctored" : mode,
    itemIds: selection.itemIds,
    currentIndex: 0,
    metadata: { rulesUsed: selection.metadata, requestedTopics },
    status: "active",
    proctored: proctored || mode === "proctored",
    proctorConfig: proctorConfig,
  });
  
  return res.json({ 
    sessionId: session._id, 
    _id: session._id, 
    itemIds: session.itemIds, 
    currentIndex: session.currentIndex, 
    total: session.itemIds.length,
    proctorConfig: session.proctorConfig || null
  });
});

// POST /api/assessment/answer - Submit answer
router.post("/answer", auth, async (req, res) => {
  try {
    const { sessionId, answer, answerIndex, timeTakenMs = 0 } = req.body || {};
    const session = await AssessmentSession.findById(sessionId);
    
    if (!session || String(session.user) !== String(req.user._id)) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    // Check if session is invalidated (ALWAYS verify on backend)
    if (session.invalidated || session.status === "invalidated") {
      return res.status(403).json({ 
        error: "Session invalidated", 
        message: "This session has been invalidated due to proctoring violations. Please contact your instructor." 
      });
    }
    
    // Allow submitting answers if session is active or if it's completed but user is reviewing
    // Only block if cancelled
    if (session.status === "cancelled") {
      return res.status(400).json({ error: "Session cancelled", message: "This session has been cancelled." });
    }
    
    // If already completed, don't allow more submissions
    if (session.status === "completed") {
      return res.status(400).json({ 
        error: "Assessment completed", 
        message: "This assessment has already been completed. You cannot submit more answers." 
      });
    }

    const itemId = session.itemIds[session.currentIndex];
    if (!itemId) {
      return res.status(400).json({ error: "No current item", currentIndex: session.currentIndex, total: session.itemIds.length });
    }
    
    const item = await Item.findById(itemId).lean();
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    // Handle different answer formats based on item type
    let submittedAnswer = answer;
    
    // For MCQ, support answerIndex
    if (item.type === "mcq" && (submittedAnswer === null || submittedAnswer === undefined || submittedAnswer === "")) {
      if (Number.isInteger(answerIndex) && Array.isArray(item?.choices)) {
        submittedAnswer = item.choices[answerIndex] ?? "";
      }
    }
    
    if (submittedAnswer === null || submittedAnswer === undefined || submittedAnswer === "") {
      return res.status(400).json({ error: "Provide answer or answerIndex" });
    }

    // Grade using gradingService
    const topic = (item?.topics && item.topics[0]) || "general";
    const gradingResult = await gradeItem(item, submittedAnswer, { topic });
    
    // Get proximate proctor logs (within last 10 seconds)
    const tenSecondsAgo = new Date(Date.now() - 10000);
    const proximateLogs = await ProctorLog.find({
      session: session._id,
      timestamp: { $gte: tenSecondsAgo }
    }).select('_id').lean();

    // Create attempt with grading details
    const attempt = await Attempt.create({
      user: req.user._id,
      item: itemId,
      session: session._id,
      isCorrect: gradingResult.isCorrect,
      userAnswer: submittedAnswer,
      score: gradingResult.score || 0,
      gradingDetails: gradingResult.gradingDetails,
      explanation: gradingResult.explanation || "",
      timeTakenMs,
      proctorLogRefs: proximateLogs.map(log => log._id),
    });

    // Update mastery
    if (topic && topic !== "general") {
      const user = await User.findById(req.user._id);
      const topics = user?.learnerProfile?.topics || new Map();
      const current = topics.get(topic) || { mastery: 0, attempts: 0, streak: 0, timeOnTask: 0 };
      
      await updateMastery(
        req.user._id,
        topic,
        current.mastery,
        gradingResult.score || 0,
        item.difficulty || 3,
        timeTakenMs,
        20000,
        current.streak
      );
    }

    // Move to next question
    session.currentIndex = Math.min(session.currentIndex + 1, session.itemIds.length);
    await session.save();

    const hasMore = session.currentIndex < session.itemIds.length;

    return res.json({
      isCorrect: gradingResult.isCorrect,
      score: gradingResult.score || 0,
      explanation: gradingResult.explanation || item.explanation || "",
      currentIndex: session.currentIndex,
      hasMore,
    });
  } catch (error) {
    console.error("Error submitting answer:", error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/assessment/finish - Finish assessment
router.post("/finish", auth, async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    const session = await AssessmentSession.findById(sessionId);
    
    if (!session || String(session.user) !== String(req.user._id)) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Allow finishing if session is active or if it's already completed (idempotent)
    if (session.status === "cancelled" || session.status === "invalidated") {
      return res.status(400).json({ 
        error: `Session ${session.status}`,
        message: session.status === "invalidated" 
          ? "This session has been invalidated due to proctoring violations."
          : "This session has been cancelled."
      });
    }
    
    // If already completed, return the existing results
    if (session.status === "completed") {
      const attempts = await Attempt.find({ session: session._id }).lean();
      const totalItems = session.itemIds.length;
      const correctCount = attempts.filter(a => a.isCorrect).length;
      const score = totalItems > 0 ? Math.round((correctCount / totalItems) * 100) : 0;
      
      return res.json({
        sessionId: String(session._id),
        _id: String(session._id),
        score,
        total: totalItems,
        correct: correctCount,
        completedAt: session.completedAt,
        alreadyCompleted: true,
      });
    }

    // Get all attempts for this session
    const attempts = await Attempt.find({ session: session._id }).lean();
    const totalItems = session.itemIds.length;
    const correctCount = attempts.filter(a => a.isCorrect).length;
    const score = totalItems > 0 ? Math.round((correctCount / totalItems) * 100) : 0;

    // Update session
    session.status = "completed";
    session.completedAt = new Date();
    session.score = score;
    await session.save();

    return res.json({
      sessionId: String(session._id),
      _id: String(session._id),
      score,
      total: totalItems,
      correct: correctCount,
      completedAt: session.completedAt,
    });
  } catch (error) {
    console.error("Error finishing assessment:", error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/assessment/session/:id/details - Get assessment results
router.get("/session/:id/details", auth, async (req, res) => {
  try {
    // Validate ObjectId format
    if (!req.params.id || !/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
      return res.status(400).json({ error: "Invalid session ID format" });
    }

    const session = await AssessmentSession.findById(req.params.id).lean();
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    // Check ownership
    if (String(session.user) !== String(req.user._id)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const attempts = await Attempt.find({ session: session._id }).sort({ createdAt: 1 }).lean();
    const itemIds = session.itemIds || [];
    
    // Handle empty itemIds
    if (itemIds.length === 0) {
      return res.json({
        session: {
          _id: String(session._id),
          mode: session.mode,
          status: session.status,
          score: session.score || 0,
          createdAt: session.createdAt,
          completedAt: session.completedAt,
          metadata: session.metadata || {},
          total: 0,
        },
        statistics: {
          total: 0,
          correct: 0,
          incorrect: 0,
          unanswered: 0,
          accuracy: 0,
          score: session.score || 0,
        },
        errorsByTopic: {},
        results: [],
      });
    }
    
    const items = await Item.find({ _id: { $in: itemIds } }).lean();
    const idToItem = new Map(items.map(i => [String(i._id), i]));

    // Calculate statistics
    const correctCount = attempts.filter(a => a.isCorrect).length;
    const incorrectCount = attempts.filter(a => !a.isCorrect).length;
    const unansweredCount = itemIds.length - attempts.length;
    
    // Group errors by topic
    const errorsByTopic = {};
    attempts.filter(a => !a.isCorrect).forEach(attempt => {
      const item = idToItem.get(String(attempt.item));
      if (item && item.topics && item.topics.length > 0) {
        const topic = item.topics[0];
        if (!errorsByTopic[topic]) errorsByTopic[topic] = [];
        errorsByTopic[topic].push({
          question: item.question,
          userAnswer: attempt.userAnswer,
          correctAnswer: item.answer,
          explanation: attempt.explanation || item.explanation,
        });
      }
    });

    const results = itemIds.map((id, idx) => {
      const item = idToItem.get(String(id));
      const attempt = attempts.find(a => String(a.item) === String(id)) || null;
      return {
        index: idx,
        itemId: String(id),
        question: item?.question || '',
        type: item?.type || 'mcq',
        choices: item?.choices || [],
        correctAnswer: item?.answer || '',
        explanation: item?.explanation || '',
        topics: item?.topics || [],
        difficulty: item?.difficulty,
        bloom: item?.bloom,
        attempt: attempt ? {
          isCorrect: attempt.isCorrect,
          userAnswer: attempt.userAnswer,
          score: attempt.score || 0,
          timeTakenMs: attempt.timeTakenMs,
          createdAt: attempt.createdAt,
          gradingDetails: attempt.gradingDetails,
          explanation: attempt.explanation || item?.explanation,
        } : null,
      };
    });

    res.json({
      session: {
        _id: String(session._id),
        mode: session.mode,
        status: session.status,
        score: session.score || 0,
        createdAt: session.createdAt,
        completedAt: session.completedAt,
        metadata: session.metadata || {},
        total: itemIds.length,
      },
      statistics: {
        total: itemIds.length,
        correct: correctCount,
        incorrect: incorrectCount,
        unanswered: unansweredCount,
        accuracy: itemIds.length > 0 ? Math.round((correctCount / itemIds.length) * 100) : 0,
        score: session.score || (itemIds.length > 0 ? Math.round((correctCount / itemIds.length) * 100) : 0),
      },
      errorsByTopic,
      results,
    });
  } catch (error) {
    console.error("Error fetching assessment session details:", error);
    return res.status(500).json({ error: "Failed to fetch assessment details: " + error.message });
  }
});

// GET /api/assessment/session/:id/remediation - Get remediation suggestions
router.get("/session/:id/remediation", auth, async (req, res) => {
  try {
    const session = await AssessmentSession.findById(req.params.id).lean();
    if (!session || String(session.user) !== String(req.user._id)) {
      return res.status(404).json({ error: "Session not found" });
    }

    const attempts = await Attempt.find({ session: session._id }).lean();
    const itemIds = session.itemIds || [];
    const items = await Item.find({ _id: { $in: itemIds } }).lean();
    const idToItem = new Map(items.map(i => [String(i._id), i]));

    // Get incorrect attempts
    const mistakes = attempts
      .filter(a => !a.isCorrect)
      .map(attempt => {
        const item = idToItem.get(String(attempt.item));
        return {
          topic: item?.topics?.[0] || 'general',
          question: item?.question || '',
          userAnswer: attempt.userAnswer,
          correctAnswer: item?.answer || '',
          explanation: attempt.explanation || item?.explanation || '',
        };
      });

    if (mistakes.length === 0) {
      return res.json({
        remediation: "Great job! You answered all questions correctly. Keep up the excellent work!",
        weakTopics: [],
        recommendations: [],
      });
    }

    // Group mistakes by topic
    const mistakesByTopic = {};
    mistakes.forEach(m => {
      if (!mistakesByTopic[m.topic]) mistakesByTopic[m.topic] = [];
      mistakesByTopic[m.topic].push(m);
    });

    const weakTopics = Object.keys(mistakesByTopic);
    
    // Generate remediation using AI
    try {
      const { generateRemediation } = await import("../services/remediationService.js");
      const remediation = await generateRemediation(mistakes, weakTopics);
      return res.json(remediation);
    } catch (error) {
      // Fallback remediation
      return res.json({
        remediation: `You made ${mistakes.length} mistake(s) across ${weakTopics.length} topic(s). Review the explanations for each incorrect answer and practice more on: ${weakTopics.join(', ')}.`,
        weakTopics,
        recommendations: weakTopics.map(topic => ({
          topic,
          action: `Review ${topic} fundamentals and practice more questions on this topic.`,
          resources: [`/student/learning?topic=${encodeURIComponent(topic)}`],
        })),
      });
    }
  } catch (error) {
    console.error("Error generating remediation:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;

