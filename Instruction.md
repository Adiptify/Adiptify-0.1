# Cursor Instructions — Adiptify (Ollama + MERN + AI)

**Purpose:** This document contains information to implement an AI-enhanced adaptive learning platform (Nimbus) that uses **Ollama** as the LLM backend. Follow the instructions in sequence. Each block is a self-contained Cursor prompt designed to generate working code, configuration, or documentation. The instructions strictly follow the original problem statement: adaptive rules engine, mastery tracking, dynamic quizzes, remediation, assessment modes, instructor console, analytics, JWT roles, performance & scale, testing, Docker Compose, and seed data.
---
## Quick summary: what we will build

* **Backend:** Node.js + Express + MongoDB (Mongoose) + Ollama API adapter. Stateless REST APIs. JWT auth.
* **Frontend:** React + Tailwind + components for student/instructor flows + Chatbot UI.
* **AI:** Ollama LLM (local or hosted) used to generate multi-level questions, explanations, notes, chat responses, and PDFs.
* **Rules Engine:** JSON-driven evaluation for next-question selection, prerequisites, remediation triggers, spaced repetition.
* **Storage:** Single primary MongoDB for users, items, attempts, mastery; plus a dedicated `generated_quizzes` collection for AI-generated quizzes (persisted for future reuse and auditing).
* **Ops:** Docker Compose to run API, MongoDB, and optionally Ollama; deployment instructions for Render/Vercel/Atlas.
---
## How Ollama fits in

* **Role:** Ollama is the LLM provider. It will be used for:

  * Generating multi-level question sets from a plain topic string.
  * Creating explanations, topic summaries, remediation notes, and downloadable PDFs.
  * Driving the chatbot assistant.
* **Why Ollama:** runs locally or on your own VM, giving control over privacy, cost, and latency.
* **Integration pattern:** Backend acts as the middleman. The backend sends structured prompts to Ollama and receives JSON/Markdown outputs. The backend validates and persists these outputs.

---

## System-wide considerations (must-follow)

1. **Persist generated content**: store every AI-generated question set in `generated_quizzes` with references to `items` when saved permanently.
2. **Validation**: Always validate AI outputs for schema (difficulty ∈ [1..5], bloom ∈ permitted values, unique `seedId`).
3. **Rate limits & queues**: Use job queue (Bull / Redis) if question generation is heavy. Cursor prompts should scaffold a simple queue if needed.
4. **Security**: Don't expose Ollama directly to the browser. All calls go through backend with API auth + rate limiting.
5. **Auditing**: Save prompt+response pair for every generation (for debugging & moderation).
6. **Reusability**: If a generated quiz matches an existing topic and seed within a TTL (e.g., 30 days), reuse instead of regenerating.

---

## Collections/schema overview (high-level)

* `users`: auth + role + learnerProfile
* `items`: master item bank (manual or AI-generated items saved here)
* `attempts`: every attempt (item-level)
* `quiz_sessions`: per-quiz session (list of item ids, mode, user, timestamps)
* `generated_quizzes`: raw AI-generated packs with metadata (topic, prompt, seed, items[], createdAt, sourceModel)
* `rules`: stored JSON rules for adaptation
* `analytics_cache`: optional aggregated stats

---

## Docker Compose (skeleton)

We'll include a service for: `api`, `mongo`, and optional `ollama` (if you run Ollama locally). Add Redis if you implement queues.

`docker-compose.yml` snippets are provided in Cursor prompts below.

---

# Cursor Prompt Blocks (Follow in order)

> **Important**: Each block is a single Cursor instruction. Run them sequentially. Where prompts require answers (like your repo name or domain), fill those placeholders.

---

### 1) Project bootstrap

**Prompt to Cursor:**
"""
Create a new MERN project structure called `nimbus-ollama` with two folders: `backend` and `frontend`. In backend initialize npm, install express, mongoose, cors, jsonwebtoken, bcrypt, axios, node-fetch; create a minimal `app.js` with a health-check route `/api/ping`. In frontend create a React app using Vite (or CRA) with Tailwind preconfigured and a simple home page that fetches `/api/ping` and displays the result. Include `docker/` folder and a `docker-compose.yml` skeleton referencing `api` and `mongo` services.
"""

---

### 2) Add environment & config files

**Prompt to Cursor:**
"""
In `backend/.env.example` put placeholders for:
MONGO_URI, JWT_SECRET, PORT, OLLAMA_BASE_URL, OLLAMA_API_KEY (if applicable), REDIS_URL (optional). Create `config/index.js` to load env vars and export a config object.
"""

---

### 3) User Auth (JWT roles)

**Prompt to Cursor:**
"""
Create user model with Mongoose fields: name, email, passwordHash, role (student, instructor, admin), learnerProfile (topics: Map with mastery, attempts, streak, timeOnTask). Build auth routes: /api/auth/register, /api/auth/login, /api/auth/refresh (refresh tokens optional). Implement middleware `auth.js` that verifies JWT and attaches `req.user`. Hash passwords with bcrypt. Ensure role-based middleware `requireRole(role)` exists.
"""

---

### 4) Item and Generated Quiz schemas

**Prompt to Cursor:**
"""
Create two Mongoose models: `Item` and `GeneratedQuiz`.

* Item: type (mcq, short, code), question, choices, answer, difficulty(1..5), bloom, topics[], skills[], tags[], hints[], explanation, createdBy, seedId (string), aiGenerated (boolean), createdAt.
* GeneratedQuiz: topic, prompt, sourceModel, seedId, items: [raw item representations], status (draft/published), linkedItemIds (array of Item _ids if saved to Item), createdBy, createdAt.
  Add index on Item.topics and Item.difficulty.
  """

---

### 5) Ollama adapter service

**Prompt to Cursor:**
"""
Create `services/ollamaService.js`. This module should:

* Export `generateQuestionsFromTopic(topic, options)` which calls Ollama using `fetch` or `axios` to `OLLAMA_BASE_URL`.
* Build robust prompts (templates provided below) and pass them to Ollama.
* Validate and parse Ollama responses into an array of item objects matching Item schema.
* Save prompt+response into GeneratedQuiz collection (with status `draft`) and return parsed items.
* Implement retries with exponential backoff and save failed attempts with error logs.
  Include unit tests for the parsing function (mock Ollama responses).
  """

---

### 6) Prompt templates (use exactly these; copy/paste)

**Prompt to Cursor:**
"""
Create a `prompts/ollamaPrompts.js` file exporting these templates:

1. QUESTION GENERATOR (multi-level):

```
You are an expert content generator. Given a topic: "{{topic}}", generate **N** questions grouped by difficulty levels: EASY, MEDIUM, HARD. For each question produce JSON with fields: id (unique seed id), type (mcq/short/code), question, choices (empty array for non-MCQ), answer (canonical), explanation (concise), difficulty (1..5), bloom (one of: remember, understand, apply, analyze, evaluate, create), topics (array), skills (array), hints (array up to 2). Output a JSON array only. Ensure no markdown or extra text. Validate that difficulty maps: EASY -> 1-2, MEDIUM -> 2-3, HARD -> 4-5. Ensure deterministic seed generation by adding 'seed_<topic>_<timestamp>' to each id.
```

2. EXPLANATION GENERATOR (for wrong answers):

```
You are an expert tutor. Given: question, studentAnswer, correctAnswer, topic. Produce a JSON object with: conciseExplanation (bullet points, <= 120 words), summary (<= 60 words), remedialSteps (3 ordered action items), resourceLinks (3 links, can be external), suggestedPractice (1-2 practice prompts). Output JSON only.
```

3. TOPIC SUMMARY / NOTES (downloadable):

```
You are a textbook author. Given topic and mistakes list produce a study note in markdown containing: 1) short summary 2) key formulas/definitions 3) examples 4) step-by-step mini exercises with answers 5) recommended next topics. Output in Markdown.
```

4. CHATBOT TEMPLATE:

```
Provide a helpful answer to the user's query. Keep responses ≤ 300 words. If user asks to explain a question, include: short explanation, 1 example, and a 1-line next step. When helpful, ask clarifying question. Include JSON meta: {level: <difficulty estimate 1..5>, topics: [], resources: []} as a second JSON-only line.
```

Save these templates to `prompts/ollamaPrompts.js` and ensure `ollamaService` injects variables safely.
"""

---

### 7) API: Generate Questions endpoint

**Prompt to Cursor:**
"""
Create endpoint `POST /api/ai/generate` with payload `{ topic: string, levels: {easy:2, medium:2, hard:2}, saveToBank: boolean }`.
Behavior:

1. Validate topic and rate-limit per-user.
2. Call `ollamaService.generateQuestionsFromTopic`.
3. Save raw AI response to `GeneratedQuiz` with `status: draft` and link to `req.user._id`.
4. If `saveToBank` is true then convert parsed items into `Item` documents (with `aiGenerated: true`) and set `GeneratedQuiz.status = published` with `linkedItemIds` filled.
5. Return saved GeneratedQuiz id & (optionally) linked Item ids.
   """

---

### 8) Storing & Reusing generated quizzes

**Prompt to Cursor:**
"""
Add logic in `generate` endpoint:

* Before calling Ollama, search `generated_quizzes` for recent (within 30 days) records where `topic` and `levels` match exactly and `status: published`. If found, return that record (cache hit).
* Add API `GET /api/ai/generated/:id` to fetch the generated quiz.
* Add admin API `POST /api/ai/publish/:id` to convert raw generated items into Item collection and mark as published.
  """

---

### 9) Rules Engine integration (detailed)

**Prompt to Cursor:**
"""
Implement `rulesEngine.js` with these behaviors:

* Input: userId, sessionContext {mode, requestedTopics (optional)}, attemptHistory (last N attempts)
* Steps:

  1. Build topic priority list: sort topics by ascending masteryScore, but respect prerequisites from rules.
  2. For each chosen topic, pick difficulty bucket based on mastery score mapping.
  3. Query `Item` collection for items that match topic + difficulty + not recently asked (cooldown: 48 hours) and that are not used in current session.
  4. If insufficient items, consult `generated_quizzes` published records for topic and difficulty; if still insufficient, trigger Ollama generation via a background job.
  5. Ensure uniqueness and coverage: at least 2 distinct skills per quiz if possible.
  6. Output: ordered array of item ids + metadata (why chosen, rule id, timestamp).
     Include unit tests for major paths (normal path, ai fallback, prerequisite block).
     """

---

### 10) Quiz Session lifecycle & persistence

**Prompt to Cursor:**
"""
Design QuizSession model and endpoints:

* Model `QuizSession`: user, mode (diagnostic/formative/summative), itemIds[], currentIndex, startedAt, completedAt, score, metadata (rulesUsed, sourceGeneratedQuizId), timeLimit, status.
* POST /api/quiz/start -> creates QuizSession after calling rules engine to get itemIds.
* POST /api/quiz/answer -> submit single answer: logs Attempt doc, returns immediate feedback (correct, explanation). If wrong -> call explanation generator to produce remedial content (save it in Attempts.explanationGeneratedId).
* POST /api/quiz/finish -> marks session completed, computes final score, runs analytics hooks to update learnerProfile.mastery, streaks, timeOnTask.
  """

---

### 11) Attempt & Mastery update logic

**Prompt to Cursor:**
"""
Implement service `masteryService.updateMastery(userId, topic, item, isCorrect, timeTaken)` using Exponential Moving Average:

* masteryNew = alpha * score + (1-alpha) * masteryOld, where score = correct ? 1 : 0; choose alpha = 0.2 by default.
* Increase streak if correct; reset on wrong.
* Update attempts and timeOnTask.
* Trigger rule checks: if 2 wrong in same topic within last 5 attempts -> push remediationTask to the user's dashboard and schedule a short adaptive micro-quiz within 24 hours.
  Store audit log of mastery updates.
  """

---

### 12) Explanations & Notes endpoints

**Prompt to Cursor:**
"""
Create endpoints:

* `POST /api/ai/explain` (payload: {questionId, userAnswer, topic}) -> calls Ollama explanation generator prompt, returns JSON explanation and saves in Attempts.explanation.
* `POST /api/ai/notes` (payload: {topic, mistakes[]}) -> calls Topic Summary prompt, returns Markdown. Store it in `generated_quizzes` as a `notes` field and also offer as downloadable PDF via `/api/notes/:id/download`.
  Implement server-side rendering of Markdown to PDF using `markdown-pdf` or `puppeteer`.
  """

---

### 13) Chatbot integration

**Prompt to Cursor:**
"""
Create `/api/chat` endpoint that accepts {message, context (optional)}. It should:

* Prepend recent user attempts and weak topics to the prompt to provide context-aware answers.
* Rate-limit per user.
* Return the LLM response plus JSON meta.
* Save chat log to DB for analytics.
* On the frontend, build a floating Chatbot component that authenticates with current user token.
  """

---

### 14) UI/UX priorities (Cursor prompt)

**Prompt to Cursor:**
"""
Create React components and pages with Tailwind and shadcn style:

* Student Dashboard (mastery heatmap, recommended next quizzes)
* Quiz Page: one-question-per-screen, timer, explanation modal
* Results Page: per-question report + downloadable notes button
* Admin Page: generated quiz management (preview, publish), rule editor (JSON editor), analytics
* Chatbot UI: floating widget, message history, quick actions ("explain last question", "generate notes for topic")
  Use Framer Motion for subtle animations. Ensure responsive & accessible design.
  """

---

### 15) Docker Compose including Ollama (optional)

**Prompt to Cursor:**
"""
Provide a `docker-compose.yml` with these services:

* `mongo` (official image)
* `api` (backend image, built from Dockerfile)
* `ollama` (if you run Ollama as a container — include example but comment that you may run Ollama on a separate host)
* `redis` (optional for queue)
  Provide example Dockerfile for backend and simple health checks.
  """

---

### 16) Performance & scale considerations (Cursor instruction)

**Prompt to Cursor:**
"""
Add a `performance.md` with recommendations:

* Use Redis caching for frequent item retrievals.
* Add indexes on Item.topics, Item.difficulty, Attempts.user+item.
* Rate-limit AI endpoints and queue heavy generation requests.
* Use connection pooling and graceful shutdown for backend.
* Consider sharding or read-replicas for MongoDB when scaling.
  """

---

### 17) Testing plan (unit & integration)

**Prompt to Cursor:**
"""
Add Jest tests for:

* `rulesEngine` selection logic (edge cases)
* `ollamaService.parseResponse` (with mocked responses)
* `masteryService.updateMastery` calculations
* Integration test: generate -> publish -> start quiz -> submit -> mastery change
  Include sample seed data for tests.
  """

---

### 18) Seed data & demo script

**Prompt to Cursor:**
"""
Create seed scripts that populate:

* 5 sample topics (Arithmetic, Algebra, Geometry, Statistics, Probability)
* 30 items across topics (mix of MCQ, short, code)
* 2 instructors and 10 students with randomized mastery profiles
* 3 JSON rules for adaptation
  Provide a demo script `scripts/runDemo.js` which simulates 20 quiz sessions and outputs mastery trajectories.
  """

---

### 19) Deployment steps (Cursor prompt)

**Prompt to Cursor:**
"""
Create `DEPLOY.md` describing deployment to:

* MongoDB Atlas (getting connection string)
* Render for backend (environment variables, build/start commands)
* Vercel for frontend (build & env vars)
* If using Ollama remotely, how to set OLLAMA_BASE_URL and secure it behind firewall / token.
  Add health-check endpoints and readiness checks; provide example `render.yaml` or `vercel.json` if applicable.
  """

---

### 20) One-week execution plan (daily tasks)

**Prompt to Cursor:**
"""
Generate a one-week sprint plan with daily checklists for a 2-3 person team that covers: project bootstrap, auth, item bank, rules engine, AI integration, frontend pages, analytics, testing, Dockerization, and deployment. Include acceptance criteria per day and demo milestones.
"""

---

## Additional implementation details (must-follow)

### A) Persisting Generated Quizzes

* **Why separate collection?** Allows auditing, re-use, moderation, and decouples raw AI output from canonical `items`.
* **When to publish to `items`:** After human review OR automated schema validation + QA checks (basic). The `publish` operation creates `Item` docs and links them.
* **Metadata to store in `generated_quizzes`:** topic, prompt, sourceModel, modelVersion, rawResponse, parsedItems, validationResult, publishedAt, publishedBy.

### B) Prompt engineering tips

* Keep instructions deterministic and strict: request JSON-only output and include explicit schema examples.
* Include system-level guardrails: do not include offensive or copyrighted content.
* Always ask the LLM to include a `seedId` to track provenance.

### C) Safety & Moderation

* Build a small content filter pipeline: after parsing AI outputs run simple checks for profanity, length, or obviously wrong formats. Flag for manual review.

### D) Cost & Ops

* If using Ollama locally, ensure resource sufficiency (GPU/CPU). For multiple concurrent generations, queue jobs.
* Cache frequent topics & reuse published generated quizzes.

---

## Example JSON snippets (for reference)

**GeneratedQuiz document**

```json
{
  "_id": "...",
  "topic": "Algebra - Linear Equations",
  "prompt": "Generate 6 questions...",
  "sourceModel": "ollama-local:vicuna-13b",
  "seedId": "seed_algebra_1690000000",
  "parsedItems": [ {"id":"seed_algebra_169...","question":"...","difficulty":2,...} ],
  "linkedItemIds": [],
  "status": "draft",
  "createdBy": "userId",
  "createdAt": "..."
}
```

**Item document**

```json
{
  "_id":"...",
  "type":"mcq",
  "question":"What is 2x+3=7?",
  "choices":["x=1","x=2","x=3","x=4"],
  "answer":"x=2",
  "difficulty":2,
  "bloom":"apply",
  "topics":["Algebra:Linear Equations"],
  "aiGenerated":true,
  "seedId":"seed_algebra_169...",
  "createdAt":"..."
}
```

# ✅ **Ollama / DeepSeek-V3.1 Prompt Pack (Production-Ready Prompts)**

These are the EXACT prompts you can use in your backend **for quiz generation, explanation generation, rule evaluation, remediation, difficulty scaling, etc.**
They are written specifically for:

✅ **deepseek-v3.1:671b-cloud**
✅ **Ollama API style**
✅ **Your Adaptive Learning Platform Problem Statement**
✅ **MERN stack integration**
✅ **Dynamic quiz generation stored into MongoDB**

---

# ✅ 1) **QUIZ GENERATION PROMPT**

**Purpose:** Generate new MCQs for a topic when item bank does not have enough questions.
**Used by:** `/api/quiz/generate` (internal job)

### **System Prompt**

```
You are an expert Assessment Designer following strict metadata rules. 
Generate high-quality exam questions for an Adaptive Learning Platform.
Follow these rules:
- Output ONLY valid JSON.
- No prose, no commentary.
- Provide MCQs with 1 correct answer.
- Difficulty must match requested difficulty bands: easy, medium, hard.
- Use Bloom’s Taxonomy tags.
- Provide hints and explanations.
- Ensure uniqueness and no plagiarism.
- Respect topic boundaries strictly.
- Follow the schema exactly:

{
  "items": [
    {
      "question": "",
      "options": ["", "", "", ""],
      "correctIndex": 0,
      "topic": "",
      "difficulty": "easy|medium|hard",
      "bloom": "remember|understand|apply|analyze|evaluate|create",
      "skills": [],
      "outcomes": [],
      "explanation": "",
      "hint": ""
    }
  ]
}
```

### **User Prompt**

```
Generate {{count}} high-quality MCQ questions for topic "{{topic}}".
Difficulty distribution (easy/medium/hard): {{difficultyDistributionJSON}}.
Ensure all questions follow the schema exactly.
```

---

# ✅ 2) **EXPLANATION GENERATION PROMPT**

Used when a student answers incorrectly or requests clarification.

### **System Prompt**

```
You are an AI tutor specializing in short, clear explanations with analogies and step-by-step reasoning. 
Output only JSON in the following format:

{
  "explanation": "",
  "remediationResources": []
}

Rules:
- Keep explanations concise (4–6 sentences)
- Add 2–3 remediation links (videos, docs)
- Provide simple breakdowns suitable for beginners.
```

### **User Prompt**

```
Explain why the following answer is correct or incorrect:

Question: "{{question}}"
Correct Answer: "{{correctOption}}"
Student Answer: "{{studentAnswer}}"
Topic: "{{topic}}"
```

---

# ✅ 3) **RULE ENGINE — NEXT QUESTION SELECTION**

Used in your backend to compute the next item dynamically.

### **System Prompt**

```
You are the adaptation rules engine.  
Given user mastery, attempt history, prerequisites, and time spacing — 
you must choose the next question type. 

Return ONLY JSON:

{
  "action": "next_item|remediate|increase_difficulty|decrease_difficulty|review",
  "reason": "",
  "requirements": {
    "topic": "",
    "difficulty": "",
    "skills": []
  }
}

Rules:
- If streak >= 3 → increase difficulty
- If two consecutive wrong → remediation
- If skill gaps detected → enforce prerequisites
- Do not repeat recent items (cooldown logic)
```

### **User Prompt**

```
Evaluate next-question logic using:

Mastery Snapshot: {{masteryJSON}}
Recent Attempts: {{attemptsJSON}}
Requested Mode: "{{mode}}"

Return the next step.
```

---

# ✅ 4) **REMEDIATION PROMPT**

Triggered when the student gets repeated wrong answers.

### System Prompt

```
You are a remediation module generating concise learning steps.
Output JSON ONLY:

{
  "diagnosis": "",
  "commonMistake": "",
  "stepsToFix": [],
  "miniQuiz": [
    {
      "question": "",
      "options": ["", "", "", ""],
      "correctIndex": 0
    }
  ]
}

Rules:
- Identify the specific misunderstanding.
- Suggest correction steps.
- Give 1–2 mini-quiz items for reinforcement.
```

### User Prompt

```
Provide remediation for the following pattern of errors:
{{attemptHistoryJSON}}
Topic: "{{topic}}"
```

---

# ✅ 5) **DIAGNOSTIC (BASELINE) QUIZ GENERATOR**

Used during signup or new-topic entry.

### System Prompt

```
You create diagnostic assessments covering a wide range of subtopics and difficulty levels.
Return JSON only in this structure:

{
  "diagnostic": [
    {
      "question": "",
      "options": ["", "", "", ""],
      "correctIndex": 0,
      "topic": "",
      "subtopic": "",
      "difficulty": "easy|medium|hard"
    }
  ]
}
```

### User Prompt

```
Generate a {{count}}-question diagnostic test for topic "{{topic}}".
Spread coverage across all major subtopics.
```

---

# ✅ 6) **SPACED-REPETITION PROMPT**

Used in the rules engine when determining review items.

### System Prompt

```
You are a spaced repetition algorithm.  
Apply SM-2 principles and choose which topics/items need review.

Return JSON:

{
  "reviewRequired": true|false,
  "items": [itemIdsArray],
  "reason": ""
}
```

### User Prompt

```
Compute spaced repetition needs from:
{{attemptHistoryJSON}}
Current Mastery: {{masteryJSON}}
```

---

# ✅ 7) **ITEM BANK VALIDATION PROMPT**

Used when instructors upload bulk items.

### System Prompt

```
You validate question bank items for correctness, clarity, and metadata completeness.
Return JSON ONLY:

{
  "valid": true|false,
  "errors": [],
  "warnings": [],
  "suggestions": []
}
```

### User Prompt

```
Validate the following imported item:
{{itemJSON}}
```

---

# ✅ 8) **QUIZ SUMMARY + LEARNING PATH PROMPT**

After quiz completion, generate personalized feedback.

### System Prompt

```
You generate individualized learning paths after quiz attempts.
Output JSON ONLY:

{
  "summary": "",
  "strengths": [],
  "weaknesses": [],
  "nextTopics": [],
  "recommendedResources": []
}
```

### User Prompt

```
Generate a personalized learning summary from:
Attempts: {{attemptsJSON}}
Mastery: {{masteryJSON}}
```

---

# ✅ 9) **INSTRUCTOR ANALYTICS PROMPT**

Used to generate insight text for instructor dashboards.

### System Prompt

```
You write concise analytics insights from data.
Return JSON:

{
  "insights": [],
  "flags": []
}
```

### User Prompt

```
Analyse cohort data:
{{analyticsJSON}}
```

---

# ✅ 10) **AI-GENERATED QUIZ STORAGE PROMPT (for logging metadata)**

Used to tag the AI-generated quiz before storing in DB.

### System Prompt

```
Provide metadata description for storing AI-generated quizzes.
Return JSON ONLY:

{
  "generationSummary": "",
  "coverage": {},
  "difficultyStats": {},
  "notes": ""
}
```

### User Prompt

```
Describe metadata for this generated quiz:
{{quizJSON}}
```
