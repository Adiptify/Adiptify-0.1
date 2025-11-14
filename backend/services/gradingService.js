import ollama from "ollama";
import { config } from "../config/index.js";

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score (0-1) using Levenshtein distance
 */
function levenshteinSimilarity(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(str1.toLowerCase().trim(), str2.toLowerCase().trim());
  return 1 - (distance / maxLen);
}

/**
 * Grade short answer using semantic LLM evaluation
 * @param {string} studentAnswer - Student's answer
 * @param {string|Array} reference - Reference answer(s)
 * @param {string} context - Optional context/topic
 * @returns {Promise<Object>} Grading result with similarity, isCorrect, explanation, confidence
 */
async function gradeSemantic(studentAnswer, reference, context = "") {
  const references = Array.isArray(reference) ? reference : [reference];
  const referenceText = references.map(r => `"${r}"`).join(" OR ");

  const prompt = `You are an automated grader. Given the student's short answer and the model's reference answer(s), return a JSON object:
{
  "similarity": 0.0-1.0,
  "isCorrect": true|false,
  "explanation": "short explanation how student's answer maps to reference",
  "confidence": 0.0-1.0
}
Rules:
- Use semantic equivalence (paraphrase detection) not surface matching.
- If similarity >= 0.75 -> isCorrect true
- Keep explanation concise (<= 60 words)

Student Answer: "${studentAnswer}"
Reference Answer(s): ${referenceText}
${context ? `Context: ${context}` : ""}

Return ONLY valid JSON, no other text.`;

  try {
    const result = await Promise.race([
      ollama.generate({
        model: config.ollamaModel,
        prompt,
        format: 'json',
        stream: false,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('LLM timeout')), 10000))
    ]);

    const responseText = result.response || "{}";
    const parsed = JSON.parse(responseText);

    // Validate and normalize
    const similarity = Math.max(0, Math.min(1, parseFloat(parsed.similarity) || 0));
    const isCorrect = similarity >= 0.75 || parsed.isCorrect === true;
    const confidence = Math.max(0, Math.min(1, parseFloat(parsed.confidence) || 0.5));
    const explanation = parsed.explanation || "Semantic evaluation completed.";

    return {
      similarity,
      isCorrect,
      explanation,
      confidence,
      score: similarity, // Use similarity as normalized score
    };
  } catch (error) {
    console.error("Semantic grading failed:", error);
    // Fallback to levenshtein if LLM fails
    const fallbackSimilarity = levenshteinSimilarity(
      studentAnswer,
      references[0] || ""
    );
    return {
      similarity: fallbackSimilarity,
      isCorrect: fallbackSimilarity >= 0.8,
      explanation: "LLM grading unavailable; using text similarity fallback.",
      confidence: 0.5,
      score: fallbackSimilarity,
      needsManualGrading: true, // Flag for instructor review
    };
  }
}

/**
 * Grade match question (pair matching)
 * @param {Array} studentAnswer - Array of [key, value] pairs
 * @param {Array} reference - Array of [key, value] pairs
 * @returns {Object} Grading result
 */
function gradeMatch(studentAnswer, reference) {
  if (!Array.isArray(studentAnswer) || !Array.isArray(reference)) {
    return { isCorrect: false, score: 0, gradingDetails: { error: "Invalid format" } };
  }

  // Normalize: convert to string pairs for comparison
  const normalizePair = (pair) => {
    if (Array.isArray(pair) && pair.length >= 2) {
      return [String(pair[0]).toLowerCase().trim(), String(pair[1]).toLowerCase().trim()];
    }
    return null;
  };

  const refPairs = reference.map(normalizePair).filter(Boolean);
  const studentPairs = studentAnswer.map(normalizePair).filter(Boolean);

  if (refPairs.length === 0) {
    return { isCorrect: false, score: 0, gradingDetails: { error: "Invalid reference" } };
  }

  // Count correct matches
  let correctCount = 0;
  const matchedRefs = new Set();

  for (const studentPair of studentPairs) {
    for (let i = 0; i < refPairs.length; i++) {
      if (matchedRefs.has(i)) continue;
      const refPair = refPairs[i];
      if (studentPair[0] === refPair[0] && studentPair[1] === refPair[1]) {
        correctCount++;
        matchedRefs.add(i);
        break;
      }
    }
  }

  const score = refPairs.length > 0 ? correctCount / refPairs.length : 0;
  const isCorrect = score >= 1.0; // All pairs must match for full credit

  return {
    isCorrect,
    score,
    gradingDetails: {
      correctCount,
      totalPairs: refPairs.length,
      partialCredit: score,
    },
  };
}

/**
 * Grade reorder question (sequence check)
 * @param {Array} studentAnswer - Array of items in student's order
 * @param {Array} reference - Array of items in correct order
 * @returns {Object} Grading result
 */
function gradeReorder(studentAnswer, reference) {
  if (!Array.isArray(studentAnswer) || !Array.isArray(reference)) {
    return { isCorrect: false, score: 0, gradingDetails: { error: "Invalid format" } };
  }

  if (studentAnswer.length !== reference.length) {
    return {
      isCorrect: false,
      score: 0,
      gradingDetails: { error: "Length mismatch" },
    };
  }

  // Count correct positions
  let correctPositions = 0;
  for (let i = 0; i < reference.length; i++) {
    const normalizedStudent = String(studentAnswer[i] || "").toLowerCase().trim();
    const normalizedRef = String(reference[i] || "").toLowerCase().trim();
    if (normalizedStudent === normalizedRef) {
      correctPositions++;
    }
  }

  const score = reference.length > 0 ? correctPositions / reference.length : 0;
  const isCorrect = score >= 1.0; // All positions must be correct

  return {
    isCorrect,
    score,
    gradingDetails: {
      correctPositions,
      totalPositions: reference.length,
      partialCredit: score,
    },
  };
}

/**
 * Grade an item based on its type and grading method
 * @param {Object} item - Item document
 * @param {any} userAnswer - User's answer (string, array, or object)
 * @param {Object} context - Optional context (topic, etc.)
 * @returns {Promise<Object>} Grading result
 */
export async function gradeItem(item, userAnswer, context = {}) {
  if (!item || !item.type) {
    throw new Error("Invalid item");
  }

  const gradingMethod = item.gradingMethod || "exact";
  let result = {
    isCorrect: false,
    score: 0,
    gradingDetails: null,
    explanation: "",
  };

  try {
    switch (item.type) {
      case "mcq":
        // Exact match for MCQ
        const normalizedAnswer = String(userAnswer || "").trim().toLowerCase();
        const normalizedCorrect = String(item.answer || "").trim().toLowerCase();
        result.isCorrect = normalizedAnswer === normalizedCorrect;
        result.score = result.isCorrect ? 1 : 0;
        result.gradingDetails = { method: "exact" };
        break;

      case "fill_blank":
        if (gradingMethod === "levenshtein") {
          const similarity = levenshteinSimilarity(
            String(userAnswer || ""),
            String(item.answer || "")
          );
          result.isCorrect = similarity >= 0.8;
          result.score = similarity;
          result.gradingDetails = { method: "levenshtein", similarity };
        } else {
          // Fallback to exact
          result.isCorrect = String(userAnswer || "").trim().toLowerCase() ===
            String(item.answer || "").trim().toLowerCase();
          result.score = result.isCorrect ? 1 : 0;
          result.gradingDetails = { method: "exact" };
        }
        break;

      case "short_answer":
        if (gradingMethod === "semantic") {
          const semanticResult = await gradeSemantic(
            String(userAnswer || ""),
            item.answer,
            context.topic || item.topics?.[0] || ""
          );
          result.isCorrect = semanticResult.isCorrect;
          result.score = semanticResult.score;
          result.gradingDetails = semanticResult;
          result.explanation = semanticResult.explanation;
          if (semanticResult.needsManualGrading) {
            result.needsManualGrading = true;
          }
        } else {
          // Fallback to levenshtein
          const similarity = levenshteinSimilarity(
            String(userAnswer || ""),
            String(item.answer || "")
          );
          result.isCorrect = similarity >= 0.8;
          result.score = similarity;
          result.gradingDetails = { method: "levenshtein", similarity };
        }
        break;

      case "match":
        result = gradeMatch(userAnswer, item.answer);
        break;

      case "reorder":
        result = gradeReorder(userAnswer, item.answer);
        break;

      default:
        throw new Error(`Unsupported item type: ${item.type}`);
    }
  } catch (error) {
    console.error("Grading error:", error);
    result.error = error.message;
    result.needsManualGrading = true;
  }

  return result;
}

export default { gradeItem };

