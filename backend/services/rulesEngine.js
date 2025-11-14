import Item from "../models/Item.js";
import User from "../models/User.js";
import { generateQuestionsFromTopic } from "./ollamaService.js";
import GeneratedAssessment from "../models/GeneratedAssessment.js";

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

  // Determine difficulty buckets: use requested if provided, otherwise adapt based on user mastery
  let difficultyBuckets = [];
  if (requestedDifficulty.length) {
    difficultyBuckets = requestedDifficulty;
  } else {
    // Adaptive difficulty based on user mastery
    if (topics.length > 0 && userId) {
      try {
        const user = await User.findById(userId).lean();
        const topic = topics[0];
        const learnerProfile = user?.learnerProfile || {};
        const topicsMap = learnerProfile.topics || {};
        
        // Get mastery for the requested topic (handle both Map and object formats)
        let mastery = 0;
        if (topicsMap instanceof Map) {
          mastery = topicsMap.get(topic)?.mastery || 0;
        } else if (typeof topicsMap === 'object' && topicsMap !== null) {
          mastery = topicsMap[topic]?.mastery || 0;
        }
        
        // Handle both old (0-1) and new (0-100) formats
        if (mastery < 1 && mastery > 0) {
          mastery = Math.round(mastery * 100);
        } else {
          mastery = Math.round(mastery);
        }
        
        // Adaptive difficulty selection based on mastery:
        // 0-30%: Easy (1-2) - Build foundation
        // 31-60%: Medium (2-3) - Reinforce learning
        // 61-80%: Medium-Hard (3-4) - Challenge understanding
        // 81-100%: Hard (4-5) - Advanced mastery
        if (mastery <= 30) {
          difficultyBuckets = mode === "diagnostic" ? [1, 2, 3] : [1, 2];
        } else if (mastery <= 60) {
          difficultyBuckets = mode === "diagnostic" ? [1, 2, 3] : mode === "summative" ? [3, 4] : [2, 3];
        } else if (mastery <= 80) {
          difficultyBuckets = mode === "diagnostic" ? [2, 3, 4] : mode === "summative" ? [4, 5] : [3, 4];
        } else {
          difficultyBuckets = mode === "diagnostic" ? [3, 4, 5] : mode === "summative" ? [4, 5] : [4, 5];
        }
      } catch (error) {
        console.error("Error fetching user mastery for adaptive difficulty:", error);
        // Fallback to mode-based difficulty
        difficultyBuckets = mode === "diagnostic" ? [1, 2, 3] : mode === "summative" ? [3, 4, 5] : [2, 3];
      }
    } else {
      // No topic or user ID - use mode-based defaults
      difficultyBuckets = mode === "diagnostic" ? [1, 2, 3] : mode === "summative" ? [3, 4, 5] : [2, 3];
    }
  }

  // PRIORITY 1: Check for published assessments with linkedItemIds FIRST (no date restriction)
  let items = [];
  if (topics.length > 0) {
    const topic = topics[0];
    const publishedAssessment = await GeneratedAssessment.findOne({
      topic: { $regex: new RegExp(`^${topic}$`, 'i') },
      status: "published",
      linkedItemIds: { $exists: true, $ne: [] },
    }).sort({ publishedAt: -1 }).lean();
    
    if (publishedAssessment && publishedAssessment.linkedItemIds && publishedAssessment.linkedItemIds.length > 0) {
      // Use items from published assessment (ignore difficulty filter to use all available items)
      const publishedItems = await Item.find({
        _id: { $in: publishedAssessment.linkedItemIds },
      }).limit(limit).lean();
      items = publishedItems;
      console.log(`[RulesEngine] Using ${publishedItems.length} items from published assessment: ${publishedAssessment._id}`);
    }
  }
  
  // PRIORITY 2: If still not enough, try to find items by topic and difficulty
  if (items.length < limit) {
    const query = {
      topics: topics.length ? { $in: topics } : { $exists: true },
      difficulty: { $in: difficultyBuckets },
    };
    const additionalItems = await Item.find(query).limit(limit - items.length).lean();
    items = [...items, ...additionalItems];
  }
  
  // PRIORITY 3: If still not enough, try to find published generated assessments for this topic (with date restriction)
  if (items.length < limit && topics.length > 0) {
    const topic = topics[0];
    
    // Check for recently published assessments (within last 30 days)
    const recentCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const generated = await GeneratedAssessment.findOne({
      topic: { $regex: new RegExp(`^${topic}$`, 'i') },
      status: "published",
      linkedItemIds: { $exists: true, $ne: [] },
      publishedAt: { $gte: recentCutoff },
    }).sort({ publishedAt: -1 }).lean();
    
    if (generated && generated.linkedItemIds) {
      const existingIds = items.map(i => i._id);
      const generatedItems = await Item.find({
        _id: { $in: generated.linkedItemIds, $nin: existingIds }, // Exclude already selected items
      }).limit(limit - items.length).lean();
      items = [...items, ...generatedItems];
    }
    
    // Also check draft assessments that might have items
    if (items.length < limit) {
      const draftAssessment = await GeneratedAssessment.findOne({
        topic: { $regex: new RegExp(`^${topic}$`, 'i') },
        status: { $in: ["draft", "published"] },
        items: { $exists: true, $ne: [] },
        createdAt: { $gte: recentCutoff },
      }).sort({ createdAt: -1 }).lean();
      
      if (draftAssessment && draftAssessment.items && draftAssessment.items.length > 0) {
        // Auto-publish draft if it has valid items
        if (draftAssessment.status === "draft" && draftAssessment.items.length >= limit - items.length) {
          const itemsToSave = draftAssessment.items.slice(0, limit - items.length);
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
                createdBy: userId,
                seedId: p.id,
                aiGenerated: true,
              };
            })
          );
          
          await GeneratedAssessment.findByIdAndUpdate(draftAssessment._id, {
            status: "published",
            linkedItemIds: docs.map((d) => d._id),
            publishedAt: new Date(),
            publishedBy: userId,
          });
          
          items = [...items, ...docs.map(d => d.toObject())];
        }
      }
    }
  }
  
  // If still not enough, try to generate questions synchronously (with timeout)
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
      
      // Ensure we have at least some questions
      if (levels.easy === 0 && levels.medium === 0 && levels.hard === 0) {
        levels.medium = Math.ceil(limit / 2);
        levels.easy = Math.floor(limit / 2);
      }
      
      // Mark as ongoing with timestamp
      ongoingGenerations.set(generationKey, now);
      
      try {
        // Try synchronous generation with timeout (20 seconds for AI)
        console.log(`[RulesEngine] Generating questions for topic: ${topic} with levels:`, levels);
        const generationPromise = generateQuestionsFromTopic(topic, { levels }, userId);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Generation timeout after 20s')), 20000)
        );
        
        const result = await Promise.race([generationPromise, timeoutPromise]);
        const parsedItems = result?.parsedItems || result?.items || [];
        
        console.log(`[RulesEngine] Generation completed for ${topic}. Got ${parsedItems?.length || 0} items.`);
        
        if (parsedItems && parsedItems.length > 0) {
          // Auto-publish and create items immediately
          const itemsToSave = parsedItems.slice(0, limit - items.length);
          const docs = await Item.insertMany(
            itemsToSave.map((p) => {
              const itemType = p.type || "mcq";
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
                createdBy: userId,
                seedId: p.id,
                aiGenerated: true,
              };
            })
          );
          
          // If result has an assessment, update it to published
          if (result?.assessment?._id) {
            await GeneratedAssessment.findByIdAndUpdate(result.assessment._id, {
              status: "published",
              linkedItemIds: docs.map((d) => d._id),
              publishedAt: new Date(),
              publishedBy: userId,
            });
          }
          
          items = [...items, ...docs.map(d => d.toObject())].slice(0, limit);
          console.log(`[RulesEngine] Successfully generated and published ${docs.length} items for topic: ${topic}`);
        }
        
        // Clean up generation key after delay
        setTimeout(() => {
          const current = ongoingGenerations.get(generationKey);
          if (current === now) {
            ongoingGenerations.delete(generationKey);
          }
        }, 120000);
      } catch (e) {
        console.error(`[RulesEngine] Generation failed for ${topic}:`, e.message);
        // Clean up on error
        const current = ongoingGenerations.get(generationKey);
        if (current === now) {
          ongoingGenerations.delete(generationKey);
        }
        // Continue with fallback items if generation fails
      }
    } else {
      console.log(`[RulesEngine] Skipping duplicate generation for ${generationKey} (last: ${Math.round((now - lastGeneration) / 1000)}s ago)`);
    }
  }
  
  // At: inside selectItems, after 'if (items.length < limit && topics.length > 0) {' (after draftAssessment branch)
  if (items.length < limit && topics.length > 0) {
    // Try fallback: scan last 2 'draft' or 'published' GeneratedAssessment for this topic and publish items if possible
    const topic = topics[0];
    const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentDrafts = await GeneratedAssessment.find({
      topic: { $regex: new RegExp(`^${topic}$`, 'i') },
      status: { $in: ["draft", "published"] },
      createdAt: { $gte: recentCutoff },
    }).sort({ createdAt: -1 }).limit(2).lean();
    for (const assessment of recentDrafts) {
      if (assessment.items && assessment.items.length > 0) {
        // Insert Items if not already linked/published
        const alreadyLinked = Array.isArray(assessment.linkedItemIds) && assessment.linkedItemIds.length >= assessment.items.length;
        if (!alreadyLinked) {
          const docs = await Item.insertMany(assessment.items.map((p) => {
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
              createdBy: userId,
              seedId: p.id,
              aiGenerated: true,
            };
          }));
          await GeneratedAssessment.findByIdAndUpdate(assessment._id, {
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

  // At the END of selectItems, right before the final return statement
  // ONLY use fallback if we truly have NO items after ALL attempts (including published assessments)
  // This should be extremely rare - only if no published assessments exist and generation completely fails
  if (items.length < 1 && topics.length > 0) {
    const topic = topics[0];
    // Double-check: Are there ANY published assessments for this topic?
    const anyPublished = await GeneratedAssessment.findOne({
      topic: { $regex: new RegExp(`^${topic}$`, 'i') },
      status: "published",
      linkedItemIds: { $exists: true, $ne: [] },
    }).lean();
    
    if (anyPublished) {
      // If published assessment exists but we didn't get items, there's a data issue
      console.error(`[RulesEngine] Published assessment ${anyPublished._id} exists but linkedItemIds are invalid or items deleted.`);
      // Try to get items directly from the assessment's items array
      if (anyPublished.items && Array.isArray(anyPublished.items) && anyPublished.items.length > 0) {
        // Create items from assessment's items array
        const docs = await Item.insertMany(
          anyPublished.items.slice(0, limit).map((p) => {
            const itemType = p.type || "mcq";
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
              difficulty: p.difficulty || 2,
              bloom: p.bloom || "remember",
              cognitiveLevel: p.cognitiveLevel || p.bloom || "remember",
              topics: (p.topics && p.topics.length ? p.topics : [topic]),
              skills: p.skills || [],
              hints: p.hints || [],
              explanation: p.explanation || "",
              createdBy: userId,
              seedId: p.id || `assessment_${anyPublished._id}_${Date.now()}_${anyPublished.items.indexOf(p)}`,
              aiGenerated: true,
            };
          })
        );
        // Update assessment with linkedItemIds
        await GeneratedAssessment.findByIdAndUpdate(anyPublished._id, {
          linkedItemIds: docs.map(d => d._id),
        });
        items = docs.map(d => d.toObject());
        console.log(`[RulesEngine] Recovered ${docs.length} items from published assessment items array.`);
      }
    }
    
    // ONLY if absolutely no published assessment exists, use fallback
    if (items.length < 1) {
      console.warn(`[RulesEngine] No items found for topic '${topic}' after all attempts. No published assessments exist. Using fallback.`);
      // As final fallback, generate basic MCQ items with proper grading method
      const dummyItems = Array.from({ length: Math.max(limit, 6) }).map((_, i) => ({
        type: "mcq",
        questionType: "mcq",
        question: `Placeholder question ${i+1} for '${topic}'?`,
        choices: ["Option A", "Option B", "Option C", "Option D"],
        answer: "Option A",
        gradingMethod: "exact",
        difficulty: difficultyBuckets[0] || 2,
        bloom: "remember",
        cognitiveLevel: "remember",
        topics: [topic],
        skills: [],
        hints: ["Review the basics of this topic."],
        explanation: "This is a placeholder question. Please ensure quiz generation is working properly.",
        createdBy: userId,
        seedId: `fallback_${topic}_${Date.now()}_${i}`,
        aiGenerated: false
      }));
      const docs = await Item.insertMany(dummyItems);
      items = docs.map(d => d.toObject());
      console.error(`[RulesEngine] Inserted ${docs.length} FALLBACK MCQs for topic '${topic}'. Check AI generation service.`);
    }
  }

  return {
    itemIds: items.map((i) => i._id),
    metadata: { reason: "rules_selection_with_ai_fallback", mode, topics, difficultyBuckets },
  };
}

export default { selectItems };


