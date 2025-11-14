import express from "express";
import { auth, requireRole } from "../middleware/auth.js";
import Item from "../models/Item.js";

const router = express.Router();

// GET /api/question-bank - List all questions (admin/instructor)
router.get("/", auth, requireRole("admin", "instructor"), async (req, res) => {
  try {
    const { topic, type, difficulty, limit = 50, offset = 0 } = req.query;
    const query = {};
    
    if (topic) query.topics = { $in: [topic] };
    if (type) query.type = type;
    if (difficulty) query.difficulty = parseInt(difficulty);
    
    const items = await Item.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit), 100))
      .skip(Number(offset))
      .select("type question choices answer explanation difficulty bloom topics gradingMethod createdAt")
      .lean();
    
    const total = await Item.countDocuments(query);
    
    return res.json({
      items: items.map(i => ({
        ...i,
        _id: String(i._id),
      })),
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/question-bank/:id - Get question details
router.get("/:id", auth, requireRole("admin", "instructor"), async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ error: "Question not found" });
    
    return res.json({
      ...item,
      _id: String(item._id),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/question-bank - Create new question
router.post("/", auth, requireRole("admin", "instructor"), async (req, res) => {
  try {
    const {
      type,
      question,
      choices = [],
      answer,
      explanation = "",
      difficulty = 2,
      bloom = "remember",
      topics = [],
      gradingMethod,
      hints = [],
      skills = [],
    } = req.body || {};
    
    if (!type || !question || answer === undefined) {
      return res.status(400).json({ error: "type, question, and answer are required" });
    }
    
    const validTypes = ["mcq", "fill_blank", "short_answer", "match", "reorder"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` });
    }
    
    // Auto-set grading method if not provided
    let finalGradingMethod = gradingMethod;
    if (!finalGradingMethod) {
      if (type === "mcq") finalGradingMethod = "exact";
      else if (type === "fill_blank") finalGradingMethod = "levenshtein";
      else if (type === "short_answer") finalGradingMethod = "semantic";
      else if (type === "match") finalGradingMethod = "pair_match";
      else if (type === "reorder") finalGradingMethod = "sequence_check";
      else finalGradingMethod = "exact";
    }
    
    // Validate type-specific requirements
    if (type === "mcq" && (!Array.isArray(choices) || choices.length < 3 || choices.length > 5)) {
      return res.status(400).json({ error: "MCQ must have 3-5 choices" });
    }
    if (type === "match" && (!Array.isArray(answer) || !answer.every(pair => Array.isArray(pair) && pair.length === 2))) {
      return res.status(400).json({ error: "Match answer must be array of [key, value] pairs" });
    }
    if (type === "reorder" && (!Array.isArray(answer) || answer.length === 0)) {
      return res.status(400).json({ error: "Reorder answer must be non-empty array" });
    }
    
    const item = await Item.create({
      type,
      question,
      choices,
      answer,
      explanation,
      difficulty: Math.max(1, Math.min(5, parseInt(difficulty) || 2)),
      bloom,
      cognitiveLevel: bloom,
      topics: Array.isArray(topics) ? topics : [topics].filter(Boolean),
      gradingMethod: finalGradingMethod,
      hints,
      skills,
      createdBy: req.user._id,
      aiGenerated: false,
    });
    
    return res.status(201).json({
      ...item.toObject(),
      _id: String(item._id),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/question-bank/:id - Update question
router.put("/:id", auth, requireRole("admin", "instructor"), async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Question not found" });
    
    const {
      type,
      question,
      choices,
      answer,
      explanation,
      difficulty,
      bloom,
      topics,
      gradingMethod,
      hints,
      skills,
    } = req.body || {};
    
    if (type) item.type = type;
    if (question) item.question = question;
    if (choices !== undefined) item.choices = choices;
    if (answer !== undefined) item.answer = answer;
    if (explanation !== undefined) item.explanation = explanation;
    if (difficulty !== undefined) item.difficulty = Math.max(1, Math.min(5, parseInt(difficulty) || 2));
    if (bloom) item.bloom = bloom;
    if (topics !== undefined) item.topics = Array.isArray(topics) ? topics : [topics].filter(Boolean);
    if (gradingMethod) item.gradingMethod = gradingMethod;
    if (hints !== undefined) item.hints = hints;
    if (skills !== undefined) item.skills = skills;
    
    await item.save();
    
    return res.json({
      ...item.toObject(),
      _id: String(item._id),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/question-bank/:id - Delete question
router.delete("/:id", auth, requireRole("admin", "instructor"), async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Question not found" });
    
    await Item.findByIdAndDelete(req.params.id);
    
    return res.json({ ok: true, message: "Question deleted successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/question-bank/stats - Get question bank statistics
router.get("/stats/summary", auth, requireRole("admin", "instructor"), async (req, res) => {
  try {
    const total = await Item.countDocuments();
    const byType = await Item.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } }
    ]);
    const byDifficulty = await Item.aggregate([
      { $group: { _id: "$difficulty", count: { $sum: 1 } } }
    ]);
    
    return res.json({
      total,
      byType: byType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byDifficulty: byDifficulty.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;

