import ollama from 'ollama';
import GeneratedAssessment from "../models/GeneratedAssessment.js";
import { config } from "../config/index.js";
import { QUESTION_GENERATOR, EXPLANATION_GENERATOR, TOPIC_SUMMARY_NOTES, CHATBOT_TEMPLATE } from "../prompts/ollamaPrompts.js";

function normalizeDifficulty(d) {
  if (typeof d === "number") return Math.min(5, Math.max(1, d));
  const map = { easy: 2, medium: 3, hard: 4 };
  const key = String(d || "").toLowerCase();
  return map[key] || 3;
}

function normalizeBloom(cognitiveLevel, bloom) {
  const val = String(cognitiveLevel || bloom || "apply").toLowerCase();
  if (["remember","understand","apply","analyze","evaluate","create"].includes(val)) return val;
  // basic mapping
  if (val.includes("analy")) return "analyze";
  if (val.includes("eval")) return "evaluate";
  if (val.includes("creat")) return "create";
  if (val.includes("under")) return "understand";
  if (val.includes("remem")) return "remember";
  return "apply";
}

function validateItem(raw) {
  const difficultyOk = Number.isInteger(raw.difficulty) && raw.difficulty >= 1 && raw.difficulty <= 5;
  const bloomOk = ["remember","understand","apply","analyze","evaluate","create"].includes(raw.bloom);
  return !!(raw.id && raw.type && raw.question && raw.answer && difficultyOk && bloomOk);
}

function coerceArray(response) {
  if (Array.isArray(response)) return response;
  if (response && Array.isArray(response.items)) return response.items;
  return [];
}

export function parseItems(resp) {
  const arr = coerceArray(resp);
  const mapped = arr.map((r) => {
    // Support both schemas - handle all question types
    let type = r.type || (r.options ? "mcq" : "short_answer");
    
    // Normalize type names
    if (type === "short") type = "short_answer";
    if (type === "code") type = "short_answer"; // Code questions become short_answer
    
    // Validate type is one of the allowed types
    const validTypes = ["mcq", "fill_blank", "short_answer", "match", "reorder"];
    if (!validTypes.includes(type)) {
      // Default based on presence of choices
      type = (r.choices && r.choices.length > 0) ? "mcq" : "short_answer";
    }
    
    const choices = r.choices || r.options || [];
    
    // Handle answer based on type
    let answer = r.answer;
    if (answer === null || answer === undefined) {
      // Fallback: try to infer from correctIndex for MCQ
      if (type === "mcq" && Number.isInteger(r.correctIndex) && choices[r.correctIndex] !== undefined) {
        answer = String(choices[r.correctIndex]);
      } else {
        answer = "";
      }
    }
    
    // Ensure answer format matches type
    if (type === "match" && !Array.isArray(answer)) {
      // Try to convert to array of pairs
      if (typeof answer === "string") {
        try {
          answer = JSON.parse(answer);
        } catch {
          answer = [];
        }
      } else {
        answer = [];
      }
    }
    
    if (type === "reorder" && !Array.isArray(answer)) {
      // For reorder, answer should be array
      if (Array.isArray(choices) && choices.length > 0) {
        answer = choices; // Use choices as correct order
      } else {
        answer = [];
      }
    }
    
    const difficulty = normalizeDifficulty(r.difficulty);
    const bloom = normalizeBloom(r.cognitiveLevel, r.bloom);
    
    return {
      id: r.id,
      type,
      questionType: r.type || r.questionType || type,
      question: r.question,
      choices,
      answer,
      explanation: r.explanation || "",
      difficulty,
      bloom,
      cognitiveLevel: r.cognitiveLevel || bloom,
      topics: r.topics || (r.topic ? [r.topic] : []),
      skills: r.skills || [],
      hints: r.hints ? (Array.isArray(r.hints) ? r.hints : [r.hints]) : [],
    };
  });
  return mapped.filter(validateItem);
}

export async function generateQuestionsFromTopic(topic, options = {}, userId = null) {
  const { levels = { easy: 2, medium: 2, hard: 2 } } = options;
  const total = (levels.easy || 0) + (levels.medium || 0) + (levels.hard || 0) || 6;
  const timestamp = Date.now();
  // Build the prompt from template
  const promptTemplate = QUESTION_GENERATOR
    .replaceAll('{{topic}}', topic)
    .replaceAll('{{timestamp}}', String(timestamp));
  const reqPrompt = `${promptTemplate}\nN=${total}`;
  let rawResponse = null;
  let aiOutput = [];
  try {
    // Use ollama.generate with an 8s timeout to prevent long waits
    const generatePromise = ollama.generate({
      model: config.ollamaModel,
      prompt: reqPrompt,
      format: 'json',
      stream: false,
      keep_alive: '2m',
    });
    const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('AI timeout')), 8000));
    const response = await Promise.race([generatePromise, timeoutPromise]);
    rawResponse = response.response || response;
    try {
      aiOutput = typeof rawResponse === 'string' ? JSON.parse(rawResponse) : rawResponse;
    } catch (e) { aiOutput = []; }
  } catch (e) {
    aiOutput = [];
  }
  // Inject seed ids if missing
  const withSeeds = Array.isArray(aiOutput) ? aiOutput.map((r, i) => ({
    ...r,
    id: r.id || `seed_${topic.replace(/\s+/g,'_')}_${timestamp}_${i}`,
  })) : [];
  const parsedItems = parseItems(withSeeds);

  const created = await GeneratedAssessment.create({
    topic,
    title: `${topic} Assessment`,
    prompt: reqPrompt,
    sourceModel: config.ollamaModel,
    seedId: `seed_${topic.replace(/\s+/g,'_')}_${timestamp}`,
    items: withSeeds,
    rawResponse,
    validated: parsedItems.length > 0,
    createdBy: userId || undefined,
    status: "draft",
  });
  return { assessment: created, parsedItems, items: parsedItems };
}

export const __test__ = { parseItems, validateItem };

export default { generateQuestionsFromTopic, parseItems };


