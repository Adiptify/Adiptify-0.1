import Item from "../models/Item.js";
import { generateQuestionsFromTopic } from "./ollamaService.js";
import GeneratedQuiz from "../models/GeneratedQuiz.js";

// Track ongoing generations to prevent duplicates (with timestamps)
const ongoingGenerations = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of ongoingGenerations.entries()) {
    if (now - timestamp > 300000) { // 5 minutes
      ongoingGenerations.delete(key);
    }
  }
}, 60000); // Check every minute

export async function selectItems({ userId, sessionContext, limit = 6 }) {
  const topics = sessionContext?.requestedTopics || [];
  const mode = sessionContext?.mode || "formative";
  const requestedDifficulty = sessionContext?.difficulty || [];

  // Use requested difficulty if provided, otherwise map mode to difficulty buckets
  const difficultyBuckets = requestedDifficulty.length ? requestedDifficulty : 
    (mode === "diagnostic" ? [1, 2, 3] : mode === "summative" ? [3, 4, 5] : [2, 3]);

  const query = {
    topics: topics.length ? { $in: topics } : { $exists: true },
    difficulty: { $in: difficultyBuckets },
  };
  
  let items = await Item.find(query).limit(limit).lean();
  
  // If not enough items, try to find published generated quizzes for this topic
  if (items.length < limit && topics.length > 0) {
    const topic = topics[0];
    
    // First check for recently published quizzes (within last 7 days)
    const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const generated = await GeneratedQuiz.findOne({
      topic: { $regex: new RegExp(`^${topic}$`, 'i') },
      status: "published",
      linkedItemIds: { $exists: true, $ne: [] },
      publishedAt: { $gte: recentCutoff },
    }).sort({ publishedAt: -1 }).lean();
    
    if (generated && generated.linkedItemIds) {
      const generatedItems = await Item.find({
        _id: { $in: generated.linkedItemIds },
        difficulty: { $in: difficultyBuckets },
      }).limit(limit - items.length).lean();
      items = [...items, ...generatedItems];
    }
    
    // Also check draft quizzes that might have items
    if (items.length < limit) {
      const draftQuiz = await GeneratedQuiz.findOne({
        topic: { $regex: new RegExp(`^${topic}$`, 'i') },
        status: { $in: ["draft", "published"] },
        parsedItems: { $exists: true, $ne: [] },
        createdAt: { $gte: recentCutoff },
      }).sort({ createdAt: -1 }).lean();
      
      if (draftQuiz && draftQuiz.parsedItems && draftQuiz.parsedItems.length > 0) {
        // Auto-publish draft if it has valid items
        if (draftQuiz.status === "draft" && draftQuiz.parsedItems.length >= limit - items.length) {
          const itemsToSave = draftQuiz.parsedItems.slice(0, limit - items.length);
          const docs = await Item.insertMany(
            itemsToSave.map((p) => ({
              type: p.type || "mcq",
              questionType: p.questionType || p.type || "mcq",
              question: p.question,
              choices: p.choices || [],
              answer: p.answer,
              difficulty: p.difficulty,
              bloom: p.bloom,
              cognitiveLevel: p.cognitiveLevel || p.bloom,
              topics: (p.topics && p.topics.length ? p.topics : [topic]),
              skills: p.skills || [],
              hints: p.hints || [],
              explanation: p.explanation || "",
              createdBy: userId,
              seedId: p.id,
              aiGenerated: true,
            }))
          );
          
          draftQuiz.status = "published";
          draftQuiz.linkedItemIds = docs.map((d) => d._id);
          draftQuiz.publishedAt = new Date();
          await GeneratedQuiz.findByIdAndUpdate(draftQuiz._id, {
            status: "published",
            linkedItemIds: docs.map((d) => d._id),
            publishedAt: new Date(),
          });
          
          items = [...items, ...docs.map(d => d.toObject())];
        }
      }
    }
  }
  
  // If still not enough, check if generation is already in progress to prevent duplicates
  if (items.length < limit && topics.length > 0) {
    const topic = topics[0];
    const generationKey = `${topic.toLowerCase().trim()}_${JSON.stringify(difficultyBuckets)}`;
    const now = Date.now();
    
    // Check if generation is already ongoing (within last 2 minutes)
    const lastGeneration = ongoingGenerations.get(generationKey);
    if (!lastGeneration || (now - lastGeneration > 120000)) {
      const levels = { easy: 0, medium: 0, hard: 0 };
      difficultyBuckets.forEach(d => {
        if (d <= 2) levels.easy++;
        else if (d <= 3) levels.medium++;
        else levels.hard++;
      });
      
      // Mark as ongoing with timestamp
      ongoingGenerations.set(generationKey, now);
      
      // Fire-and-forget generation; do not block the selection path
      generateQuestionsFromTopic(topic, { levels }, userId)
        .then(() => {
          // Keep in map for 2 minutes to prevent immediate duplicates
          setTimeout(() => {
            const current = ongoingGenerations.get(generationKey);
            if (current === now) {
              ongoingGenerations.delete(generationKey);
            }
          }, 120000); // 2 min cooldown
        })
        .catch((e) => {
          console.error("Background generation failed:", e);
          const current = ongoingGenerations.get(generationKey);
          if (current === now) {
            ongoingGenerations.delete(generationKey);
          }
        });
    } else {
      console.log(`[RulesEngine] Skipping duplicate generation for ${generationKey} (last: ${Math.round((now - lastGeneration) / 1000)}s ago)`);
    }
  }
  
  // At: inside selectItems, after 'if (items.length < limit && topics.length > 0) {' (after draftQuiz branch)
  if (items.length < limit && topics.length > 0) {
    // Try fallback: scan last 2 'draft' or 'published' GeneratedQuiz for this topic and publish items if possible
    const topic = topics[0];
    const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentDrafts = await GeneratedQuiz.find({
      topic: { $regex: new RegExp(`^${topic}$`, 'i') },
      status: { $in: ["draft", "published"] },
      createdAt: { $gte: recentCutoff },
    }).sort({ createdAt: -1 }).limit(2).lean();
    for (const quiz of recentDrafts) {
      if (quiz.parsedItems && quiz.parsedItems.length > 0) {
        // Insert Items if not already linked/published
        const alreadyLinked = Array.isArray(quiz.linkedItemIds) && quiz.linkedItemIds.length >= quiz.parsedItems.length;
        if (!alreadyLinked) {
          const docs = await Item.insertMany(quiz.parsedItems.map((p) => ({
            type: p.type || "mcq",
            questionType: p.questionType || p.type || "mcq",
            question: p.question,
            choices: p.choices || [],
            answer: p.answer,
            difficulty: p.difficulty,
            bloom: p.bloom,
            cognitiveLevel: p.cognitiveLevel || p.bloom,
            topics: (p.topics && p.topics.length ? p.topics : [topic]),
            skills: p.skills || [],
            hints: p.hints || [],
            explanation: p.explanation || "",
            createdBy: userId,
            seedId: p.id,
            aiGenerated: true,
          })));
          await GeneratedQuiz.findByIdAndUpdate(quiz._id, {
            status: "published",
            linkedItemIds: docs.map((d) => d._id),
            publishedAt: new Date(),
          });
          items = [...items, ...docs.map(d => d.toObject())].slice(0, limit);
          console.log(`[rulesEngine] Auto-published and inserted fallback items for topic ${topic}`);
          break;
        }
      }
    }
  }

  // At the END of selectItems, right before the final return statement (line before 'return { itemIds...')
  if (items.length < 1 && topics.length > 0) {
    // As final fallback, generate 6 dummy MCQ items for the first requested topic
    const topic = topics[0];
    const dummyItems = Array.from({ length: 6 }).map((_, i) => ({
      type: "mcq",
      questionType: "mcq",
      question: `Placeholder question ${i+1} for '${topic}'?`,
      choices: ["A", "B", "C", "D"],
      answer: "A",
      difficulty: 2,
      bloom: "apply",
      cognitiveLevel: "apply",
      topics: [topic],
      skills: [],
      hints: ["Pick the most basic answer."],
      explanation: "Correct answer is A.",
      createdBy: userId,
      seedId: `dummy_${topic}_${Date.now()}_${i}`,
      aiGenerated: false
    }));
    const docs = await Item.insertMany(dummyItems);
    items = docs.map(d => d.toObject());
    console.error(`[rulesEngine] No quiz content found for topic '${topic}'. Inserted 6 DUMMY MCQs as fallback.`);
  }

  return {
    itemIds: items.map((i) => i._id),
    metadata: { reason: "rules_selection_with_ai_fallback", mode, topics, difficultyBuckets },
  };
}

export default { selectItems };


