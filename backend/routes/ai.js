import express from "express";
import { auth } from "../middleware/auth.js";
import { generateQuestionsFromTopic, parseItems } from "../services/ollamaService.js";
import GeneratedAssessment from "../models/GeneratedAssessment.js";
import Item from "../models/Item.js";
import ollama from "ollama";
import { config } from "../config/index.js";
import { EXPLANATION_GENERATOR, TOPIC_SUMMARY_NOTES } from "../prompts/ollamaPrompts.js";
import { logAILLM } from "../middleware/aiLogger.js";

const router = express.Router();

// POST /api/ai/generate { topic, levels, saveToBank }
router.post("/generate", auth, async (req, res) => {
  const { topic, levels, saveToBank } = req.body || {};
  if (!topic || typeof topic !== "string") return res.status(400).json({ error: "Invalid topic" });

  // Reuse: check for published within 30 days with the same topic and levels
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (levels && typeof levels === "object") {
    let cached = await GeneratedAssessment.findOne({
      topic,
      status: { $in: ["draft", "published"] },
      createdAt: { $gte: since },
      // Match by topic and status only
    });
    if (cached) {
      // If published but not linked, or draft with saveToBank=true → publish now
      if ((cached.status === "published" && (!cached.linkedItemIds || cached.linkedItemIds.length === 0)) || (cached.status !== "published" && !!saveToBank)) {
        let itemsToSave = Array.isArray(cached.items) && cached.items.length
          ? cached.items
          : parseItems(cached.items || []);

        if (!itemsToSave || itemsToSave.length === 0) {
          const total = (levels.easy || 0) + (levels.medium || 0) + (levels.hard || 0) || 3;
          itemsToSave = Array.from({ length: total }).map((_, i) => ({
            id: `seed_${topic.replace(/\s+/g,'_')}_${Date.now()}_${i}`,
            type: "mcq",
            questionType: "mcq",
            question: `Placeholder question ${i + 1} on ${topic}?`,
            choices: ["A", "B", "C", "D"],
            answer: "A",
            difficulty: 2,
            bloom: "apply",
            cognitiveLevel: "apply",
            topics: [topic],
            skills: [],
            hints: ["Think about basics"],
            explanation: "Correct answer is A.",
          }));
        }

        const docs = await Item.insertMany(itemsToSave.map((p) => {
          const itemType = p.type || "mcq";
          // Set grading method based on type
          let gradingMethod = p.gradingMethod;
          if (!gradingMethod) {
            if (itemType === "mcq") gradingMethod = "exact";
            else if (itemType === "fill_blank") gradingMethod = "levenshtein";
            else if (itemType === "short_answer") gradingMethod = "semantic";
            else if (itemType === "match") gradingMethod = "pair_match";
            else if (itemType === "reorder") gradingMethod = "sequence_check";
            else gradingMethod = "exact";
          }
          return {
            type: itemType,
            questionType: p.questionType || p.type || itemType,
            question: p.question,
            choices: p.choices || [],
            answer: p.answer,
            gradingMethod,
            difficulty: p.difficulty,
            bloom: p.bloom,
            cognitiveLevel: p.cognitiveLevel || p.bloom,
            topics: (p.topics && p.topics.length ? p.topics : [topic]),
            skills: p.skills || [],
            hints: p.hints || [],
            explanation: p.explanation || "",
            createdBy: req.user?._id,
            seedId: p.id,
            aiGenerated: true,
          };
        }));

        cached.status = "published";
        cached.linkedItemIds = docs.map((d) => d._id);
        // Remove levels field - not used in GeneratedAssessment
        cached.publishedAt = new Date();
        cached.publishedBy = req.user?._id;
        await cached.save();
      }

      return res.json({ generatedAssessmentId: cached._id, linkedItemIds: cached.linkedItemIds || [], cacheHit: true });
    }
  }

  const result = await generateQuestionsFromTopic(topic, { levels }, req.user?._id);
  const assessment = result.assessment || result.quiz;
  const parsedItems = result.parsedItems || result.items || [];
  
  if (saveToBank) {
    let itemsToSave = parsedItems;
    // Fallback scaffold if AI returned nothing
    if (!Array.isArray(itemsToSave) || itemsToSave.length === 0) {
      const total = (levels?.easy || 0) + (levels?.medium || 0) + (levels?.hard || 0) || 3;
      itemsToSave = Array.from({ length: total }).map((_, i) => ({
        id: `seed_${topic.replace(/\s+/g,'_')}_${Date.now()}_${i}`,
        type: "mcq",
        questionType: "mcq",
        question: `Placeholder question ${i + 1} on ${topic}?`,
        choices: ["A", "B", "C", "D"],
        answer: "A",
        difficulty: 2,
        bloom: "apply",
        cognitiveLevel: "apply",
        topics: [topic],
        skills: [],
        hints: ["Think about basics"],
        explanation: "Correct answer is A.",
      }));
    }

    const docs = await Item.insertMany(
      itemsToSave.map((p) => {
        const itemType = p.type || "mcq";
        // Set grading method based on type
        let gradingMethod = p.gradingMethod;
        if (!gradingMethod) {
          if (itemType === "mcq") gradingMethod = "exact";
          else if (itemType === "fill_blank") gradingMethod = "levenshtein";
          else if (itemType === "short_answer") gradingMethod = "semantic";
          else if (itemType === "match") gradingMethod = "pair_match";
          else if (itemType === "reorder") gradingMethod = "sequence_check";
          else gradingMethod = "exact";
        }
        return {
          type: itemType,
          questionType: p.questionType || p.type || itemType,
          question: p.question,
          choices: p.choices || [],
          answer: p.answer,
          gradingMethod,
          difficulty: p.difficulty,
          bloom: p.bloom,
          cognitiveLevel: p.cognitiveLevel || p.bloom,
          topics: (p.topics && p.topics.length ? p.topics : [topic]),
          skills: p.skills || [],
          hints: p.hints || [],
          explanation: p.explanation || "",
          createdBy: req.user?._id,
          seedId: p.id,
          aiGenerated: true,
        };
      })
    );
    assessment.status = "published";
    assessment.linkedItemIds = docs.map((d) => d._id);
    assessment.publishedAt = new Date();
    assessment.publishedBy = req.user?._id;
    await assessment.save();
  }

  return res.json({ generatedAssessmentId: assessment._id, linkedItemIds: assessment.linkedItemIds || [] });
});

// GET /api/ai/generated/:id
router.get("/generated/:id", auth, async (req, res) => {
  const doc = await GeneratedAssessment.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ error: "Not found" });
  return res.json(doc);
});

// POST /api/ai/publish/:id
router.post("/publish/:id", auth, async (req, res) => {
  const assessment = await GeneratedAssessment.findById(req.params.id);
  if (!assessment) return res.status(404).json({ error: "Not found" });
  if (assessment.status === "published") return res.json({ generatedAssessmentId: assessment._id, linkedItemIds: assessment.linkedItemIds || [] });

  const toSave = Array.isArray(assessment.items) ? assessment.items : [];
  const docs = await Item.insertMany(
    toSave.map((p) => {
      const itemType = p.type || "mcq";
      // Set grading method based on type
      let gradingMethod = p.gradingMethod;
      if (!gradingMethod) {
        if (itemType === "mcq") gradingMethod = "exact";
        else if (itemType === "fill_blank") gradingMethod = "levenshtein";
        else if (itemType === "short_answer") gradingMethod = "semantic";
        else if (itemType === "match") gradingMethod = "pair_match";
        else if (itemType === "reorder") gradingMethod = "sequence_check";
        else gradingMethod = "exact";
      }
      return {
        type: itemType,
        questionType: p.questionType || p.type || itemType,
        question: p.question,
        choices: p.choices || [],
        answer: p.answer,
        gradingMethod,
        difficulty: p.difficulty,
        bloom: p.bloom,
        cognitiveLevel: p.cognitiveLevel || p.bloom,
        topics: p.topics || [assessment.topic || topic],
        skills: p.skills || [],
        hints: p.hints || [],
        explanation: p.explanation || "",
        createdBy: req.user?._id,
        seedId: p.id,
        aiGenerated: true,
      };
    })
  );

  assessment.status = "published";
  assessment.linkedItemIds = docs.map((d) => d._id);
  assessment.publishedAt = new Date();
  assessment.publishedBy = req.user?._id;
  await assessment.save();

  return res.json({ generatedAssessmentId: assessment._id, linkedItemIds: assessment.linkedItemIds });
});

// POST /api/ai/explain { questionId, userAnswer, topic }
router.post("/explain", auth, async (req, res) => {
  const { questionId, userAnswer, topic } = req.body || {};
  const item = await Item.findById(questionId).lean();
  if (!item) return res.status(404).json({ error: "Question not found" });
  const userPrompt = `Explain why the following answer is correct or incorrect:\n\nQuestion: "${item.question}"\nCorrect Answer: "${item.answer}"\nStudent Answer: "${userAnswer}"\nTopic: "${topic || (item.topics?.[0] || "general")}"`;
  let tokens=0, error=null, aiResponse='', status='success';
  try {
    const result = await ollama.generate({
      model: config.ollamaModel,
      prompt: `${EXPLANATION_GENERATOR}\n${userPrompt}`,
      format: 'json',
      stream: false,
    });
    aiResponse = result.response || '{}';
    tokens = result.eval_count || 0;
    const json = JSON.parse(aiResponse);
    await logAILLM({
      userId: req.user?._id, userName: req.user?.name, role: req.user?.role, endpoint: '/api/ai/explain', params: req.body, status, error, tokens, model: config.ollamaModel, request: userPrompt, response: aiResponse
    });
    return res.json(json);
  } catch (e) {
    status='error'; error = e.message;
    await logAILLM({
      userId: req.user?._id, userName: req.user?.name, role: req.user?.role, endpoint: '/api/ai/explain', params: req.body, status, error, tokens, model: config.ollamaModel, request: userPrompt, response: aiResponse
    });
    return res.status(200).json({ explanation: "Unable to reach AI. Here's a brief tip: review the solution steps and compare to your answer.", remediationResources: [] });
  }
});

// POST /api/ai/notes { topic, mistakes[] }
router.post("/notes", auth, async (req, res) => {
  const { topic, mistakes = [] } = req.body || {};
  if (!topic) return res.status(400).json({ error: "Topic required" });
  const userPrompt = `You are a textbook author. Given topic and mistakes list produce a study note in markdown containing: 1) short summary 2) key formulas/definitions 3) examples 4) step-by-step mini exercises with answers 5) recommended next topics. Output in Markdown.` + `\n\nTopic: ${topic}\nMistakes: ${JSON.stringify(mistakes)}`;
  let tokens=0, error=null, aiResponse='', status='success';
  try {
    const result = await ollama.generate({
      model: config.ollamaModel,
      prompt: `${TOPIC_SUMMARY_NOTES}\n${userPrompt}`,
      stream: false,
    });
    aiResponse = String(result.response || "");
    tokens = result.eval_count || 0;
    const created = await GeneratedAssessment.create({ topic, title: `${topic} Notes`, prompt: userPrompt, sourceModel: config.ollamaModel, items: [], validated: false, status: "draft", rawResponse: { notesMd: aiResponse } });
    created.notes = aiResponse;
    await created.save();
    await logAILLM({
      userId: req.user?._id, userName: req.user?.name, role: req.user?.role, endpoint: '/api/ai/notes', params: req.body, status, error, tokens, model: config.ollamaModel, request: userPrompt, response: aiResponse
    });
    return res.json({ notesId: created._id, markdown: aiResponse });
  } catch (e) {
    status='error'; error = e.message;
    await logAILLM({
      userId: req.user?._id, userName: req.user?.name, role: req.user?.role, endpoint: '/api/ai/notes', params: req.body, status, error, tokens, model: config.ollamaModel, request: userPrompt, response: aiResponse
    });
    return res.status(200).json({ notesId: null, markdown: `# ${topic} Notes\n\n- Review key concepts.\n- Practice with targeted exercises.\n` });
  }
});

export default router;


