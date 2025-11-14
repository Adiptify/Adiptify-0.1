import User from "../models/User.js";

const DEFAULT_ALPHA = 0.2;
const difficultyWeight = [0.6, 0.8, 1.0, 1.2, 1.4]; // Indexed by difficulty-1

/**
 * Update mastery using the new adaptive formula
 * @param {string} userId - User ID
 * @param {string} topic - Topic name
 * @param {number} masteryOld - Current mastery (0-100)
 * @param {number} scoreNormalized - Normalized score [0..1]
 * @param {number} difficulty - Item difficulty (1-5)
 * @param {number} timeTakenMs - Time taken in milliseconds
 * @param {number} expectedMs - Expected time in milliseconds (optional, defaults to 20000)
 * @param {number} streak - Current streak count
 * @returns {Promise<Object>} Updated mastery data
 */
export async function updateMastery(userId, topic, masteryOld, scoreNormalized, difficulty, timeTakenMs = 0, expectedMs = 20000, streak = 0) {
  const user = await User.findById(userId);
  if (!user) return null;

  const topics = user.learnerProfile?.topics || new Map();
  const current = topics.get(topic) || { mastery: 0, attempts: 0, streak: 0, timeOnTask: 0 };

  // Use provided masteryOld or current mastery
  const mastery = masteryOld !== undefined ? masteryOld : (current.mastery || 0);

  // Get difficulty weight
  const dw = difficultyWeight[Math.max(0, Math.min(4, difficulty - 1))] || 1.0;

  // Calculate raw gain
  const rawGain = scoreNormalized * dw * 10; // Scale to roughly 0-14

  // EMA-like update
  const masteryNew = mastery * (1 - DEFAULT_ALPHA) + DEFAULT_ALPHA * Math.min(100, mastery + rawGain);

  // Streak bonus: +5 for every 3 streak up to 15
  const streakBonus = Math.min(15, Math.floor((streak || current.streak || 0) / 3) * 5);

  // Time penalty: if timeTaken > expectedMs * 1.5 then -2
  const timePenalty = timeTakenMs > expectedMs * 1.5 ? 2 : 0;

  // Final mastery (clamped 0-100)
  const finalMastery = Math.max(0, Math.min(100, Math.round(masteryNew + streakBonus - timePenalty)));

  // Update streak
  const newStreak = scoreNormalized >= 0.75 ? (current.streak || 0) + 1 : 0;

  const next = {
    mastery: finalMastery,
    attempts: (current.attempts || 0) + 1,
    streak: newStreak,
    timeOnTask: (current.timeOnTask || 0) + (timeTakenMs || 0),
  };

  topics.set(topic, next);
  user.learnerProfile.topics = topics;
  user.learnerProfile.lastActiveAt = new Date();

  await user.save();
  return next;
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use updateMastery with explicit parameters instead
 */
export async function updateMasteryLegacy(userId, topic, item, isCorrect, timeTakenMs) {
  const scoreNormalized = isCorrect ? 1 : 0;
  const difficulty = item?.difficulty || 2;
  const user = await User.findById(userId);
  if (!user) return null;
  
  const topics = user.learnerProfile?.topics || new Map();
  const current = topics.get(topic) || { mastery: 0, attempts: 0, streak: 0, timeOnTask: 0 };
  
  return await updateMastery(
    userId,
    topic,
    current.mastery,
    scoreNormalized,
    difficulty,
    timeTakenMs,
    20000,
    current.streak
  );
}

export default { updateMastery, updateMasteryLegacy };


