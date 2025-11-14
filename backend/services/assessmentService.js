import ollama from 'ollama';
import { config } from '../config/index.js';
import { ASSESSMENT_GENERATOR_PROMPT } from '../prompts/assessmentPrompts.js';
import GeneratedAssessment from '../models/GeneratedAssessment.js';
import Item from '../models/Item.js';

// Track ongoing generations to prevent duplicates
const ongoingGenerations = new Map();

/**
 * Generate assessment with strict JSON parsing
 * @param {string} topic - Topic for assessment
 * @param {number} questionCount - Number of questions
 * @param {string} userId - User ID creating the assessment
 * @returns {Promise<Object>} Generated assessment with items
 */
export async function generateAssessment(topic, questionCount = 6, userId = null) {
  // Check if generation is already ongoing
  const generationKey = `${topic.toLowerCase().trim()}_${questionCount}`;
  const now = Date.now();
  const lastGeneration = ongoingGenerations.get(generationKey);
  
  if (lastGeneration && (now - lastGeneration < 120000)) { // 2 minutes
    throw new Error('Assessment generation already in progress for this topic. Please wait.');
  }
  
  ongoingGenerations.set(generationKey, now);
  
  const userPrompt = `Generate an assessment for topic: "${topic}" with ${questionCount} questions. 
Include variety: at least 1 MCQ, 1 fill_blank, 1 short_answer, 1 match, and 1 reorder question.
Distribute the remaining questions across these types.
Output ONLY valid JSON following the exact schema.`;

  try {
    const response = await ollama.chat({
      model: config.ollamaModel || 'deepseek-r1:7b',
      messages: [
        { role: 'system', content: ASSESSMENT_GENERATOR_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      format: 'json',
      stream: false,
      keep_alive: '5m',
      options: {
        temperature: 0.7,
        num_predict: 4000,
      },
    });

    let rawResponse = response.message.content;
    
    // Clean JSON - remove markdown code blocks if present
    rawResponse = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(rawResponse);
    } catch (parseError) {
      // Try to extract JSON from response
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse JSON from AI response');
      }
    }

    // Validate structure
    if (!parsed.assessmentTitle || !parsed.topic || !Array.isArray(parsed.questions)) {
      throw new Error('Invalid assessment structure from AI');
    }

    // Validate and normalize questions
    const validatedQuestions = [];
    const errors = [];

    for (let i = 0; i < parsed.questions.length; i++) {
      const q = parsed.questions[i];
      
      // Validate type
      const validTypes = ['mcq', 'fill_blank', 'short_answer', 'match', 'reorder'];
      if (!validTypes.includes(q.type)) {
        errors.push(`Question ${i + 1}: Invalid type "${q.type}"`);
        continue;
      }

      // Validate required fields
      if (!q.question || q.difficulty === undefined || !q.bloom) {
        errors.push(`Question ${i + 1}: Missing required fields`);
        continue;
      }

      // Validate type-specific requirements
      if (q.type === 'mcq') {
        if (!Array.isArray(q.choices) || q.choices.length < 3 || q.choices.length > 5) {
          errors.push(`Question ${i + 1}: MCQ must have 3-5 choices`);
          continue;
        }
        if (!q.answer || typeof q.answer !== 'string') {
          errors.push(`Question ${i + 1}: MCQ answer must be a string`);
          continue;
        }
      } else if (q.type === 'match') {
        if (!Array.isArray(q.answer) || q.answer.length === 0) {
          errors.push(`Question ${i + 1}: Match answer must be array of pairs`);
          continue;
        }
        // Validate pairs
        if (!q.answer.every(pair => Array.isArray(pair) && pair.length === 2)) {
          errors.push(`Question ${i + 1}: Match answer must be array of [key, value] pairs`);
          continue;
        }
      } else if (q.type === 'reorder') {
        if (!Array.isArray(q.answer) || q.answer.length === 0) {
          errors.push(`Question ${i + 1}: Reorder answer must be array`);
          continue;
        }
        if (!Array.isArray(q.choices) || q.choices.length === 0) {
          errors.push(`Question ${i + 1}: Reorder must have choices array`);
          continue;
        }
      }

      // Normalize difficulty and bloom
      const difficulty = Math.max(1, Math.min(5, Math.round(q.difficulty || 3)));
      const bloom = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'].includes(q.bloom) 
        ? q.bloom 
        : 'apply';

      validatedQuestions.push({
        ...q,
        difficulty,
        bloom,
        topics: [parsed.topic],
        skills: q.skills || [],
        hints: q.hints || [],
        explanation: q.explanation || '',
      });
    }

    if (validatedQuestions.length === 0) {
      throw new Error('No valid questions generated. Errors: ' + errors.join('; '));
    }

    // Create GeneratedAssessment
    const assessment = await GeneratedAssessment.create({
      topic: parsed.topic,
      title: parsed.assessmentTitle,
      items: validatedQuestions,
      rawResponse: rawResponse,
      validated: errors.length === 0,
      createdBy: userId,
      status: 'draft',
    });

    // Create Item documents for each question
    const itemDocs = [];
    for (const q of validatedQuestions) {
      // Determine grading method based on type
      let gradingMethod = 'exact';
      if (q.type === 'fill_blank') gradingMethod = 'levenshtein';
      else if (q.type === 'short_answer') gradingMethod = 'semantic';
      else if (q.type === 'match') gradingMethod = 'pair_match';
      else if (q.type === 'reorder') gradingMethod = 'sequence_check';

      const item = await Item.create({
        type: q.type,
        questionType: q.type,
        question: q.question,
        choices: q.choices || [],
        answer: q.answer,
        gradingMethod,
        difficulty: q.difficulty,
        bloom: q.bloom,
        cognitiveLevel: q.bloom,
        topics: q.topics || [parsed.topic],
        skills: q.skills || [],
        hints: q.hints || [],
        explanation: q.explanation || '',
        createdBy: userId,
        seedId: q.id || `assessment_${assessment._id}_${Date.now()}_${itemDocs.length}`,
        aiGenerated: true,
      });
      itemDocs.push(item);
    }

    // Link items to assessment
    assessment.linkedItemIds = itemDocs.map(i => i._id);
    await assessment.save();

    // Clean up generation tracking
    ongoingGenerations.delete(generationKey);
    
    return {
      assessment: {
        _id: String(assessment._id),
        topic: assessment.topic,
        title: assessment.title,
        status: assessment.status,
        itemCount: itemDocs.length,
        validated: assessment.validated,
        createdAt: assessment.createdAt,
      },
      items: itemDocs.map(i => ({
        _id: String(i._id),
        type: i.type,
        question: i.question,
        difficulty: i.difficulty,
        bloom: i.bloom,
      })),
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    // Clean up on error
    ongoingGenerations.delete(generationKey);
    console.error('Assessment generation error:', error);
    throw new Error('Failed to generate assessment: ' + error.message);
  }
}

export default { generateAssessment };

