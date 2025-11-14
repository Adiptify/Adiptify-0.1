import ollama from "ollama";
import { config } from "../config/index.js";

/**
 * Generate remediation suggestions based on quiz mistakes
 * @param {Array} mistakes - Array of mistake objects with topic, question, userAnswer, correctAnswer
 * @param {Array} weakTopics - Array of topics where mistakes were made
 * @returns {Promise<Object>} Remediation object with suggestions and recommendations
 */
export async function generateRemediation(mistakes, weakTopics) {
  if (!mistakes || mistakes.length === 0) {
    return {
      remediation: "Great job! No mistakes found.",
      weakTopics: [],
      recommendations: [],
    };
  }

  const mistakesSummary = mistakes.map((m, i) => 
    `${i + 1}. Topic: ${m.topic}\n   Question: ${m.question}\n   Your Answer: ${m.userAnswer}\n   Correct Answer: ${m.correctAnswer}\n   Explanation: ${m.explanation || 'N/A'}`
  ).join('\n\n');

  const prompt = `You are an educational tutor. A student made ${mistakes.length} mistake(s) in a quiz across these topics: ${weakTopics.join(', ')}.

Mistakes made:
${mistakesSummary}

Provide a comprehensive remediation response in JSON format:
{
  "remediation": "A personalized message (2-3 sentences) encouraging the student and summarizing their mistakes",
  "weakTopics": [array of topics that need improvement],
  "recommendations": [
    {
      "topic": "topic name",
      "action": "specific action to improve (1-2 sentences)",
      "resources": ["suggested learning resources or topics to review"],
      "practiceSuggestions": ["specific practice recommendations"]
    }
  ],
  "nextSteps": ["actionable next steps for the student"]
}

Be encouraging, specific, and actionable. Focus on helping the student understand their mistakes and improve.`;

  try {
    const result = await Promise.race([
      ollama.generate({
        model: config.ollamaModel,
        prompt,
        format: 'json',
        stream: false,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Remediation timeout')), 15000))
    ]);

    const responseText = result.response || "{}";
    const parsed = JSON.parse(responseText);

    // Validate and structure response
    return {
      remediation: parsed.remediation || `You made ${mistakes.length} mistake(s). Review the explanations and practice more.`,
      weakTopics: Array.isArray(parsed.weakTopics) ? parsed.weakTopics : weakTopics,
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : weakTopics.map(topic => ({
        topic,
        action: `Review ${topic} fundamentals and practice more questions.`,
        resources: [`/student/learning?topic=${encodeURIComponent(topic)}`],
        practiceSuggestions: [`Take another quiz on ${topic}`, `Review learning modules for ${topic}`],
      })),
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [
        "Review the explanations for each incorrect answer",
        "Practice more questions on weak topics",
        "Use the learning modules to strengthen understanding",
      ],
    };
  } catch (error) {
    console.error("Remediation generation failed:", error);
    // Fallback
    return {
      remediation: `You made ${mistakes.length} mistake(s) across ${weakTopics.length} topic(s). Review the explanations for each incorrect answer and practice more on: ${weakTopics.join(', ')}.`,
      weakTopics,
      recommendations: weakTopics.map(topic => ({
        topic,
        action: `Review ${topic} fundamentals and practice more questions on this topic.`,
        resources: [`/student/learning?topic=${encodeURIComponent(topic)}`],
        practiceSuggestions: [`Take another quiz on ${topic}`, `Review learning modules for ${topic}`],
      })),
      nextSteps: [
        "Review the explanations for each incorrect answer",
        "Practice more questions on weak topics",
        "Use the learning modules to strengthen understanding",
      ],
    };
  }
}

export default { generateRemediation };

