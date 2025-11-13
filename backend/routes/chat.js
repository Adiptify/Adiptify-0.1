import express from "express";
import ollama from "ollama";
import { auth } from "../middleware/auth.js";
import { config } from "../config/index.js";
import { logAILLM } from "../middleware/aiLogger.js";
import User from "../models/User.js";
import Attempt from "../models/Attempt.js";
import QuizSession from "../models/QuizSession.js";

const router = express.Router();

router.post("/", auth, async (req, res) => {
  const { message, context = {} } = req.body || {};
  
  // Fetch user's mastery profile and recent quiz history for context
  const user = await User.findById(req.user._id).lean();
  const learnerProfile = user?.learnerProfile || {};
  
  // Convert Map to plain object if needed (Mongoose Maps need special handling)
  let topics = {};
  if (learnerProfile?.topics) {
    if (learnerProfile.topics instanceof Map) {
      topics = Object.fromEntries(learnerProfile.topics);
    } else if (typeof learnerProfile.topics === 'object' && learnerProfile.topics !== null) {
      // Handle both plain objects and Mongoose Map-like structures
      topics = learnerProfile.topics;
    }
  }
  
  // Debug log (can be removed in production)
  if (Object.keys(topics).length > 0) {
    console.log(`[Chat] User ${user?.name} mastery topics:`, Object.keys(topics));
  }
  
  // Get recent quiz sessions with scores for context
  const recentSessions = await QuizSession.find({ 
    user: req.user._id, 
    status: 'completed' 
  }).sort({ completedAt: -1 }).limit(5).lean();
  
  const recentAttempts = recentSessions.length > 0 
    ? await Attempt.find({ 
        session: { $in: recentSessions.map(s => s._id) } 
      }).populate('item', 'topics').sort({ createdAt: -1 }).limit(20).lean()
    : [];
  
  // Build quiz performance summary
  const quizPerformance = recentSessions.map(s => {
    const topics = s.metadata?.requestedTopics || [];
    return {
      score: s.score || 0,
      topic: topics[0] || 'Unknown',
      date: s.completedAt ? new Date(s.completedAt).toLocaleDateString() : '',
      mode: s.mode || 'formative'
    };
  });
  
  const averageScore = quizPerformance.length > 0
    ? Math.round(quizPerformance.reduce((sum, q) => sum + q.score, 0) / quizPerformance.length)
    : 0;
  
  const recentScores = quizPerformance.slice(0, 3).map(q => `${q.topic}: ${q.score}%`).join(', ');
  
  // Build detailed mastery breakdown
  // Note: mastery is stored as decimal (0-1), convert to percentage (0-100)
  const masteryDetails = Object.entries(topics).map(([topic, data]) => {
    const masteryDecimal = data?.mastery || 0;
    const masteryPercent = Math.round(masteryDecimal * 100);
    const attempts = data?.attempts || 0;
    const streak = data?.streak || 0;
    const level = masteryPercent >= 80 ? 'Advanced' : masteryPercent >= 60 ? 'Intermediate' : masteryPercent >= 40 ? 'Beginner' : 'Needs Practice';
    return `- ${topic}: ${masteryPercent}% mastery (${level}), ${attempts} attempts, ${streak} current streak`;
  });
  
  const masterySummary = masteryDetails.length > 0 
    ? `\n${masteryDetails.join('\n')}` 
    : '\nNo mastery data available yet.';
  
  // Identify strong and weak topics (using percentage for comparison)
  const strongTopics = Object.entries(topics)
    .filter(([_, data]) => ((data?.mastery || 0) * 100) >= 60)
    .map(([topic, data]) => `${topic} (${Math.round((data?.mastery || 0) * 100)}%)`);
  
  const weakTopics = Object.entries(topics)
    .filter(([_, data]) => ((data?.mastery || 0) * 100) < 60)
    .map(([topic, data]) => `${topic} (${Math.round((data?.mastery || 0) * 100)}%)`);
  
  const recentTopics = [...new Set(recentAttempts.map(a => {
    const itemTopics = a.item?.topics || [];
    return Array.isArray(itemTopics) ? itemTopics[0] : null;
  }).filter(Boolean))];
  
  // Build comprehensive system context
  const systemContext = `You are an AI tutor helping a student named ${user?.name || 'the student'}. 

STUDENT'S CURRENT MASTERY LEVELS:
${masterySummary}

STRONG TOPICS (≥60% mastery): ${strongTopics.length > 0 ? strongTopics.join(', ') : 'None yet'}
WEAK TOPICS (<60% mastery): ${weakTopics.length > 0 ? weakTopics.join(', ') : 'None yet'}
RECENTLY PRACTICED TOPICS: ${recentTopics.length > 0 ? recentTopics.join(', ') : 'None'}

QUIZ PERFORMANCE:
- Average Quiz Score: ${averageScore}%
- Recent Quiz Scores: ${recentScores || 'No recent quizzes'}
- Total Quizzes Completed: ${recentSessions.length}

INSTRUCTIONS:
- When the student asks about improving their score, analyze their recent quiz performance and mastery levels
- Reference their actual quiz scores and mastery percentages in your response
- If they ask "how to fix my score" or "how to improve", provide specific, actionable advice based on:
  * Their weak topics (topics with <60% mastery)
  * Their recent quiz scores
  * Their current mastery levels
- For topics with low mastery (<60%), provide foundational explanations and step-by-step guidance
- For topics with higher mastery (≥60%), you can provide more advanced concepts and challenges
- Personalize your responses based on their exact mastery percentages and quiz scores
- If they ask about a topic they haven't practiced, suggest starting with basics
- Be encouraging and acknowledge their progress
- Keep responses detailed but concise (300-500 words)
- Always mention their current mastery level and recent quiz performance when discussing improvement

Example: If student asks "how to fix my score" and has 20% mastery in "Deep Learning" with recent quiz score of 30%, say: "I see you're at 20% mastery in Deep Learning and your recent quiz score was 30%. To improve, let's focus on building a strong foundation in the basics..."`;

  const messages = [
    { role: 'system', content: systemContext },
    { role: 'user', content: message }
  ];
  
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  let aiResponse = '', error = null, status = 'success', tokens = 0;
  try {
    const reply = await ollama.chat({ model: config.ollamaModel, messages, stream: true });
    for await (const part of reply) {
      if (part.message && part.message.content) {
        aiResponse += part.message.content;
        res.write(part.message.content);
        res.flush && res.flush();
      }
      if (part.eval_count) tokens += part.eval_count;
    }
    res.end();
  } catch (e) {
    status = 'error'; error = e.message; res.write('(AI failed: ' + e.message + ')'); res.end();
  }
  // Log outside streaming (OK for history analytics)
  logAILLM({
    userId: req.user?._id,
    userName: req.user?.name,
    role: req.user?.role,
    endpoint: '/api/chat',
    params: { message, context },
    status, error, tokens, model: config.ollamaModel, request: message, response: aiResponse
  });
});

export default router;


