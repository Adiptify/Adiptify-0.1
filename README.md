Now I'll create the comprehensive technical README for your Adiptify project. Based on my analysis of the repository structure, documentation files, and codebase, here's the detailed technical README:

```markdown name=README.md url=https://github.com/Adiptify/Adiptify-0.1

# Adiptify v0.1 - AI-Enhanced Adaptive Learning Platform

**A production-ready MERN stack educational platform with Ollama LLM integration, adaptive learning rules engine, proctoring capabilities, and advanced assessment features.**

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [Core Features](#core-features)
4. [Project Structure](#project-structure)
5. [Backend Technical Specifications](#backend-technical-specifications)
6. [Frontend Technical Specifications](#frontend-technical-specifications)
7. [Database Schema](#database-schema)
8. [API Endpoints Reference](#api-endpoints-reference)
9. [Installation & Setup](#installation--setup)
10. [Docker Deployment](#docker-deployment)
11. [Configuration](#configuration)
12. [Task Implementation Guide](#task-implementation-guide)
13. [Performance & Scaling](#performance--scaling)
14. [Security Considerations](#security-considerations)
15. [Testing Strategy](#testing-strategy)
16. [Troubleshooting](#troubleshooting)

---

## System Overview

### Problem Statement

Adiptify is an adaptive learning platform designed to provide personalized educational experiences through:

- **AI-Driven Content Generation**: Ollama-powered dynamic quiz generation using DeepSeek-V3.1
- **Adaptive Rules Engine**: JSON-driven next-question selection based on mastery scores
- **Multi-Modal Assessment**: MCQ, Fill-in-the-Blank, Short Answer, Match, and Reorder questions
- **Privacy-Focused Proctoring**: Screen-based monitoring without camera/snapshot requirements
- **Mastery Tracking**: Exponential Moving Average (EMA) based learner progression
- **Bulk Operations**: Import users, questions, and quizzes at scale

### Key Metrics

- **Version**: 0.1.0
- **Stack**: MERN (MongoDB, Express, React, Node.js)
- **LLM Backend**: Ollama with DeepSeek-V3.1:671b-cloud
- **Database**: MongoDB (Mongoose ODM)
- **Frontend Build**: Vite + React 18.3 + Tailwind CSS
- **API Style**: RESTful with JWT authentication

---

## Architecture & Technology Stack

### Technology Landscape

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND TIER                          │
│  React 18.3 | Vite | Tailwind CSS | React Router v6        │
│  html2canvas | jsPDF | react-markdown                       │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/REST
┌──────────────────────────▼──────────────────────────────────┐
│                      API TIER (Express)                     │
│  Node.js | Express 4.18 | CORS | Morgan (logging)          │
│  JWT Auth | Role-based Access Control (RBAC)               │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼────────┐ ┌──────▼────────┐ ┌──────▼────────┐
│   Ollama API   │ │   MongoDB     │ │   Redis       │
│   (Local/      │ │   (Mongoose)  │ │   (Optional   │
│    Hosted)     │ │               │ │    Job Queue) │
└────────────────┘ └───────────────┘ └───────────────┘
```

### Component Technology

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Runtime** | Node.js | LTS | Server execution environment |
| **Web Framework** | Express.js | 4.18.2 | REST API server |
| **Database ORM** | Mongoose | 7.8.0 | MongoDB object modeling |
| **Authentication** | JWT (jsonwebtoken) | 9.0.2 | Token-based auth & RBAC |
| **Password Hashing** | bcrypt | 5.1.1 | Secure password storage |
| **HTTP Client** | axios | 1.7.7 | Ollama API calls |
| **Logging** | Morgan | 1.10.0 | HTTP request logging |
| **Markdown** | marked | 12.0.2 | Parse & render markdown |
| **Frontend Framework** | React | 18.3.1 | UI component library |
| **Build Tool** | Vite | 5.4.0 | Fast bundler & dev server |
| **Styling** | Tailwind CSS | 3.4.10 | Utility-first CSS |
| **Routing** | React Router | 6.26.2 | Client-side navigation |
| **PDF Export** | jsPDF | 3.0.3 | Generate downloadable PDFs |
| **Canvas Capture** | html2canvas | 1.4.1 | Screenshot for PDFs |

---

## Core Features

### 1. **Intelligent Question Generation** 
**Module**: `/backend/services/ollamaService.js`  
**LLM Model**: DeepSeek-V3.1:671b-cloud via Ollama API

#### Features:
- **Multi-Level Generation**: Automatically generates questions across EASY/MEDIUM/HARD difficulty bands
- **Bloom's Taxonomy Integration**: Questions tagged with cognitive levels (remember, understand, apply, analyze, evaluate, create)
- **Schema Validation**: Enforces strict JSON output with semantic validation
- **Caching & Reuse**: 30-day TTL for generated quizzes to avoid redundant API calls
- **Prompt Engineering**: Deterministic, schema-based prompts for consistent output

#### Implementation Details:

```javascript
// Example Generation Flow
POST /api/ai/generate
Payload: {
  topic: "Linear Algebra",
  levels: { easy: 2, medium: 3, hard: 2 },
  saveToBank: true
}

Response: {
  generatedQuizId: "...",
  linkedItemIds: [...],
  items: [
    {
      id: "seed_linear_algebra_1234567890",
      question: "What is the determinant of [[1,2],[3,4]]?",
      type: "mcq",
      options: ["-2", "2", "1", "10"],
      correctIndex: 0,
      difficulty: 2,
      bloom: "apply",
      topics: ["Linear Algebra:Determinants"],
      explanation: "...",
      hint: "..."
    }
  ]
}
```

---

### 2. **Adaptive Rules Engine**
**Module**: `/backend/services/rulesEngine.js`  
**Logic Type**: JSON-driven, heuristic-based

#### Features:
- **Mastery-Based Difficulty Selection**: Maps mastery score [0-100] to difficulty buckets
- **Prerequisite Enforcement**: Chain topics with prerequisite validation
- **Cooldown Logic**: 48-hour cooldown prevents repetition of same items
- **Spaced Repetition**: SM-2 algorithm integration for review scheduling
- **Streak Tracking**: Bonus difficulty increases on 3+ correct streak

#### Algorithm:

```
1. INPUT: userId, sessionContext (mode, topics), attemptHistory
2. BUILD_TOPIC_QUEUE:
   - Sort topics by ascending masteryScore
   - Respect prerequisites from rules engine
3. FOR_EACH_TOPIC:
   - Calculate difficulty bucket: 
     masteryScore < 30 → EASY (difficulty 1-2)
     30-70 → MEDIUM (difficulty 2-3)
     > 70 → HARD (difficulty 4-5)
   - Query Item collection with filters:
     * topic matches
     * difficulty matches
     * not in currentSession
     * lastAttempt > 48 hours ago (cooldown)
4. FALLBACK_TO_AI:
   - If insufficient items → Queue GeneratedQuiz generation
   - Minimum 2 distinct skills per quiz
5. OUTPUT: Ordered itemIds with selection rationale
```

#### Difficulty Mapping:

| Mastery Score | Difficulty Band | Difficulty Level |
|---|---|---|
| 0-20 | Very Weak | 1 (Trivial) |
| 21-40 | Weak | 1-2 (Easy) |
| 41-60 | Average | 2-3 (Medium) |
| 61-80 | Strong | 3-4 (Hard) |
| 81-100 | Expert | 4-5 (Very Hard) |

---

### 3. **Multi-Modal Question Types**
**Module**: `/backend/services/gradingService.js`  
**Grading Methods**: Exact, Levenshtein, Semantic, Pair-Match, Sequence-Check

#### Supported Question Types:

| Type | Answer Format | Grading Method | LLM Required | Threshold |
|------|---|---|---|---|
| **MCQ** | String (choice text) | Exact match | ❌ | 100% |
| **Fill-in-Blank** | String | Levenshtein distance | ❌ | ≥0.8 |
| **Short Answer** | String/Array | Semantic similarity | ✅ | ≥0.75 |
| **Match** | Array of [key, value] pairs | Pair matching | ❌ | Partial credit |
| **Reorder** | Array of items | Sequence check | ❌ | Per-position scoring |

#### Grading Examples:

```javascript
// MCQ Grading
answer: "Paris"
correct: "Paris"
result: { correct: true, score: 1.0 }

// Fill-in-Blank Grading (Levenshtein)
answer: "Pais"
correct: "Paris"
similarity: 0.83 (exceeds 0.8 threshold)
result: { correct: true, score: 0.83 }

// Short Answer (Semantic)
answer: "OOP allows objects to take multiple forms"
correct: "Polymorphism is the ability of objects to take many forms"
LLM Similarity: 0.82 (exceeds 0.75 threshold)
result: { correct: true, score: 0.82, reasoning: "..." }

// Match
answer: [[Mozart, Austrian], [Beethoven, German]]
correct: [[Mozart, Austrian], [Beethoven, German], [Chopin, Polish]]
matches: 2/3 correct
result: { correct: false, score: 0.67 }

// Reorder
answer: [evaporation, condensation, precipitation, collection]
correct: [evaporation, condensation, precipitation, collection]
result: { correct: true, score: 1.0 }
```

---

### 4. **Privacy-Focused Proctoring System**
**Module**: `/backend/routes/proctor.js`  
**Approach**: Screen-based monitoring (NO camera/snapshots)

#### Security Mechanisms:

| Mechanism | Detection Method | Action on Trigger |
|---|---|---|
| **Tab Switch** | Page visibility API | Count violations; 3rd switch = major violation |
| **Copy/Paste Blocking** | onCopy/onPaste event listeners | Prevent clipboard access |
| **Right-Click Block** | onContextMenu prevention | Disable context menu |
| **DevTools Detection** | F12, Ctrl+Shift+I/J detection | Flag as major violation |
| **Risk Scoring** | majorViolations × 5 + minorViolations × 1 | Auto-invalidate at ≥20 |

#### Configuration:

```env
PROCTOR_RISK_THRESHOLD=20
ALLOW_TAB_SWITCHES_DEFAULT=2
```

#### Risk Scoring System:

```
Minor Violation (1 point):
- Copy/paste attempt
- Right-click attempt
- Single tab switch (within allowed count)

Major Violation (5 points):
- Excessive tab switches (3+)
- DevTools detected
- Suspicious activity patterns

Auto-Invalidation:
riskScore >= PROCTOR_RISK_THRESHOLD → Session invalidated
Session.status = "invalidated"
Session.invalidationReason = "Proctoring violations exceeded"
```

#### API Response Example:

```json
{
  "sessionId": "...",
  "itemIds": ["..."],
  "proctorConfig": {
    "blockTabSwitch": true,
    "blockCopyPaste": true,
    "blockRightClick": true,
    "allowTabSwitchCount": 2,
    "requireSnapshots": false,
    "riskThreshold": 20
  }
}
```

---

### 5. **Mastery Tracking & Adaptive Progression**
**Module**: `/backend/services/masteryService.js`  
**Algorithm**: Exponential Moving Average (EMA)

#### Mastery Calculation:

```
masteryNew = masteryOld × (1 - α) + (masteryOld + rawGain) × α

Where:
- α (alpha) = 0.2 (default learning rate)
- rawGain = difficulty_weight × correctness × streak_bonus - time_penalty
- difficulty_weight = [0.6, 0.8, 1.0, 1.2, 1.4] for difficulty 1-5
- streak_bonus = +5 per 3-correct streak (max +15)
- time_penalty = -2 if time > expectedTime × 1.5
```

#### Mastery Bands:

| Score Range | Level | Description |
|---|---|---|
| 0-20 | Novice | Fundamental gaps; requires basic remediation |
| 21-40 | Beginner | Can answer easy questions; needs practice |
| 41-60 | Intermediate | Solid grasp; can tackle medium difficulty |
| 61-80 | Advanced | Strong understanding; ready for hard questions |
| 81-100 | Expert | Mastery achieved; focus on application/synthesis |

#### Remediation Trigger:

```javascript
If (last 5 attempts in topic contain 2+ wrong) {
  triggerRemediationTask({
    topic,
    userId,
    diagnosis: "conceptual_gap",
    nextQuizTime: now + 24hours,
    type: "micro-quiz"
  });
}
```

---

### 6. **Admin & Instructor Management**
**Modules**: `/backend/routes/admin.js`, `/backend/routes/questionBank.js`

#### User Management Capabilities:

- **Role-Based Access Control**: student, instructor, admin roles
- **Mass User Import**: Bulk CSV/JSON user creation with validation
- **Subject Locking**: Lock/unlock topics per student
- **Learner Profiles**: Track topics, mastery, attempts, streaks, time-on-task
- **Password Reset**: Admin-initiated credential reset

#### Question Bank Management:

- **Bulk Item Import**: Import questions via JSON with validation
- **Question Types**: MCQ, fill-in-blank, short-answer, match, reorder
- **Metadata Tagging**: Difficulty (1-5), Bloom's level, topics, skills, hints
- **Auto-Publishing**: Convert draft → published status with validation
- **Audit Trail**: Track creation, modification, publication history

#### API Examples:

```bash
# Create user
POST /api/admin/users
Body: {
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secure123",
  "role": "student",
  "studentId": "STU001"
}

# Import items
POST /api/admin/import/items
Body: {
  "source": "semester1",
  "items": [
    {
      "type": "mcq",
      "question": "What is 2+2?",
      "choices": ["3", "4", "5"],
      "answer": "4",
      "difficulty": 1,
      "bloom": "remember"
    }
  ]
}

# Lock subject for student
PUT /api/admin/users/:id
Body: {
  "lockedSubjects": ["advanced_algorithms"]
}
```

---

### 7. **PDF & Notes Generation**
**Module**: `/backend/routes/notes.js`  
**Technology**: marked (markdown parser) + puppeteer/markdown-pdf

#### Features:

- **Study Notes Generation**: AI-generated topic summaries
- **PDF Export**: Download quizzes as formatted PDFs
- **Markdown Support**: Parse and render formatted content
- **Customization**: Include hints, explanations, resources

#### Generated Content Structure:

```markdown
# Topic: Linear Algebra

## Summary
Brief overview of the topic...

## Key Definitions & Formulas
- **Determinant**: A scalar value derived from matrix elements
- **Formula**: For 2×2 matrix [[a,b],[c,d]], det = ad - bc

## Examples
Worked examples with step-by-step solutions...

## Practice Exercises
Mini-problems for reinforcement...

## Recommended Resources
Links to videos, articles, documentation...
```

---

### 8. **Chatbot Assistant**
**Module**: `/backend/routes/chat.js`  
**LLM**: Ollama with context injection

#### Features:

- **Context-Aware Responses**: Incorporates user's recent attempts and weak topics
- **Rate Limiting**: Per-user throttling to prevent abuse
- **Chat History**: Persistent logs for analytics
- **Quick Actions**: 
  - "Explain last question"
  - "Generate notes for topic"
  - "Next recommended quiz"
  - "Show my progress"

#### Prompt Template:

```
You are a helpful educational AI assistant for an adaptive learning platform.

User's Recent Performance:
- Weak topics: {{weakTopics}}
- Recent attempts: {{lastAttempts}}
- Mastery profile: {{masteryProfile}}

User Query: {{userMessage}}

Provide a helpful response (≤300 words). If explaining a concept:
1. Brief explanation
2. One concrete example
3. Next learning step

Keep tone encouraging and supportive.
```

---

## Project Structure

```
Adiptify/
├── backend/
│   ├── app.js                          # Express app entry point
│   ├── package.json                    # Backend dependencies
│   ├── .env.example                    # Environment template
│   ├── Dockerfile                      # Container image definition
│   │
│   ├── config/
│   │   └── index.js                    # Config loader & validation
│   │
│   ├── models/                         # Mongoose schemas
│   │   ├── User.js                     # User + learnerProfile
│   │   ├── Item.js                     # Question bank items
│   │   ├── GeneratedQuiz.js            # AI-generated quizzes
│   │   ├── QuizSession.js              # Quiz attempt sessions
│   │   ├── Attempt.js                  # Individual question attempts
│   │   ├── ProctoringLog.js            # Proctoring violation logs
│   │   └── Rule.js                     # Adaptation rules (JSON)
│   │
│   ├── middleware/
│   │   ├── auth.js                     # JWT verification & RBAC
│   │   ├── errorHandler.js             # Global error handling
│   │   └── rateLimiter.js              # Rate limiting middleware
│   │
│   ├── routes/
│   │   ├── auth.js                     # /api/auth/* endpoints
│   │   ├── ai.js                       # /api/ai/* endpoints
│   │   ├── notes.js                    # /api/notes/* endpoints
│   │   ├── chat.js                     # /api/chat/* endpoints
│   │   ├── admin.js                    # /api/admin/* endpoints
│   │   ├── learning.js                 # /api/learning/* endpoints
│   │   ├── proctor.js                  # /api/proctor/* endpoints
│   │   ├── assessment.js               # /api/assessment/* endpoints
│   │   ├── questionBank.js             # /api/question-bank/* endpoints
│   │   └── issues.js                   # /api/report-issue endpoint
│   │
│   ├── services/
│   │   ├── ollamaService.js            # Ollama API integration
│   │   ├── rulesEngine.js              # Adaptive rules logic
│   │   ├── masteryService.js           # EMA mastery calculation
│   │   ├── gradingService.js           # Answer grading logic
│   │   └── authService.js              # Auth utilities (JWT, bcrypt)
│   │
│   ├── prompts/
│   │   ├── ollamaPrompts.js            # Prompt templates
│   │   └── systemPrompts.js            # System-level prompts
│   │
│   └── scripts/
│       └── seed.js                     # Database seeding script
│
├── frontend/
│   ├── package.json                    # Frontend dependencies
│   ├── index.html                      # HTML entry point
│   ├── vite.config.js                  # Vite configuration
│   ├── tailwind.config.js              # Tailwind customization
│   ├── postcss.config.js               # PostCSS configuration
│   │
│   └── src/
│       ├── main.jsx                    # React app entry
│       ├── App.jsx                     # Root component
│       │
│       ├── pages/
│       │   ├── StudentDashboard.jsx    # Student main view
│       │   ├── QuizPage.jsx            # Quiz taking interface
│       │   ├── ResultsPage.jsx         # Post-quiz feedback
│       │   ├── AdminDashboard.jsx      # Admin console
│       │   ├── InstructorDashboard.jsx # Instructor analytics
│       │   └── LoginPage.jsx           # Authentication
│       │
│       ├── components/
│       │   ├── QuestionDisplay.jsx     # Question renderer
│       │   ├── AnswerInput.jsx         # Answer input component
│       │   ├── MasteryHeatmap.jsx      # Topic mastery visualization
│       │   ├── Chatbot.jsx             # Chat interface
│       │   ├── NavigationBar.jsx       # Header navigation
│       │   └── ProctoringMonitor.jsx   # Proctoring UI
│       │
│       ├── services/
│       │   ├── apiClient.js            # Axios instance with auth
│       │   ├── authService.js          # Auth state management
│       │   └── quizService.js          # Quiz API calls
│       │
│       ├── hooks/
│       │   ├── useAuth.js              # Authentication hook
│       │   └── useQuiz.js              # Quiz state hook
│       │
│       ├── styles/
│       │   └── globals.css             # Global styles
│       │
│       └── utils/
│           ├── formatters.js           # Date/time formatting
│           └── validators.js           # Input validation
│
├── docker/
│   └── Dockerfile.mongo                # MongoDB Dockerfile
│
├── docker-compose.yml                  # Multi-container orchestration
├── Instruction.md                      # Implementation instructions
├── ADMIN_USER_MANAGEMENT.md            # Admin API documentation
├── BULK_UPLOAD_GUIDE.md                # Bulk import guide
├── PROCTORING_IMPLEMENTATION.md        # Proctoring specification
├── CREDENTIALS.md                      # Credential templates
├── FRONTEND_BACKEND_FEATURE_MAP.md     # Feature mapping
├── performance.md                      # Performance tuning guide
└── README.md                           # This file
```

---

## Backend Technical Specifications

### Technology Stack Detail

**Runtime**: Node.js with ES6 Modules  
**Framework**: Express.js 4.18.2 (RESTful API)  
**Database**: MongoDB + Mongoose ODM  
**Authentication**: JWT (jsonwebtoken 9.0.2)  
**Security**: bcrypt password hashing  
**LLM Integration**: Ollama SDK + axios  

### Core Modules

#### 1. Authentication (`/backend/routes/auth.js`)

**Endpoints**:
```
POST   /api/auth/register        # Create new user
POST   /api/auth/login           # Authenticate & get JWT
POST   /api/auth/refresh         # Refresh expiring token
GET    /api/auth/me              # Get current user profile
PUT    /api/auth/change-password # Update password
```

**JWT Payload**:
```javascript
{
  userId: "...",
  email: "user@example.com",
  role: "student|instructor|admin",
  iat: 1234567890,
  exp: 1234567890 + (7 days in seconds)
}
```

**Password Security**:
- Hashed with bcrypt (rounds: 10)
- Salted automatically
- Never stored in plain text

---

#### 2. AI Integration (`/backend/routes/ai.js`)

**Endpoints**:
```
POST   /api/ai/generate          # Generate quiz questions
GET    /api/ai/generated/:id     # Fetch generated quiz
POST   /api/ai/publish/:id       # Publish to item bank
POST   /api/ai/explain           # Explain wrong answer
POST   /api/ai/notes             # Generate study notes
```

**Question Generation Flow**:

```
POST /api/ai/generate
├─ Validate topic & rate limit
├─ Check cache (30-day TTL)
├─ Call ollamaService.generateQuestionsFromTopic()
│  ├─ Build prompt from template
│  ├─ Call Ollama API with retry logic
│  ├─ Parse JSON response
│  └─ Validate schema
├─ Save to GeneratedQuiz (status: draft)
├─ If saveToBank=true:
│  ├─ Create Item documents
│  ├─ Link to GeneratedQuiz
│  └─ Set status: published
└─ Return response
```

**Ollama Service** (`/backend/services/ollamaService.js`):

```javascript
export async function generateQuestionsFromTopic(topic, options = {}) {
  // options: { levels: {easy, medium, hard}, retries, timeout }
  // Returns: Array of validated Item objects
  // Throws: OllamaError if API fails after retries
}

export async function generateExplanation(question, studentAnswer, correct, topic) {
  // Returns: { explanation, remedialSteps, resources }
}

export async function generateTopicNotes(topic, mistakes) {
  // Returns: Markdown string
}
```

---

#### 3. Quiz Management (`/backend/routes/assessment.js`)

**Endpoints**:
```
POST   /api/assessment/start         # Begin quiz session
POST   /api/assessment/answer        # Submit answer
GET    /api/assessment/:sessionId    # Get session details
POST   /api/assessment/finish        # Complete quiz
GET    /api/assessment/results/:id   # View results
```

**Quiz Session Lifecycle**:

```
1. POST /api/assessment/start
   ├─ Validate user & mode
   ├─ Call rulesEngine.selectItems()
   ├─ Create QuizSession document
   └─ Return sessionId + itemIds

2. POST /api/assessment/answer (per question)
   ├─ Validate answer format
   ├─ Call gradingService.gradeAnswer()
   ├─ Create Attempt document
   ├─ If wrong: call ollamaService.generateExplanation()
   ├─ If proctored: check proctoring violations
   └─ Return feedback

3. POST /api/assessment/finish
   ├─ Mark session as completed
   ├─ Calculate final score
   ├─ Update learnerProfile.mastery (per topic)
   ├─ Update streaks, timeOnTask
   ├─ Trigger remediation if needed
   └─ Return complete results
```

**Grading Service** (`/backend/services/gradingService.js`):

```javascript
export function gradeAnswer(attempt, item) {
  // attempt: { answer, submittedAt }
  // item: { type, answer, gradingMethod }
  // Returns: { correct, score, feedback, explanation }
  
  switch (item.type) {
    case "mcq":
      return gradeExact(attempt.answer, item.answer);
    case "fill_blank":
      return gradeLevenshtein(attempt.answer, item.answer, 0.8);
    case "short_answer":
      return gradeSemanticSimilarity(attempt.answer, item.answer);
    case "match":
      return gradeMatching(attempt.answer, item.answer);
    case "reorder":
      return gradeSequence(attempt.answer, item.answer);
  }
}
```

---

#### 4. Rules Engine (`/backend/services/rulesEngine.js`)

**Core Algorithm**:

```javascript
export async function selectItems(userId, sessionContext, attemptHistory) {
  // 1. Fetch user's mastery profile
  const masterySummary = await getMasteryProfile(userId);
  
  // 2. Build topic priority queue
  const topics = buildTopicQueue(masterySummary);
  
  // 3. For each topic, select items
  const selectedItems = [];
  for (const topic of topics) {
    const difficultyBucket = getDifficultyBucket(masterySummary[topic]);
    
    // Query items matching topic + difficulty + not recent
    const items = await Item.find({
      topics: topic,
      difficulty: { $in: difficultyBucket },
      _id: { $nin: recentItems },
      lastAttempt: { $lte: Date.now() - 48*60*60*1000 }
    }).limit(5);
    
    // Fallback to generated quizzes if needed
    if (items.length < minRequired) {
      await queueGenerationJob(topic, difficultyBucket);
    }
    
    selectedItems.push(...items);
  }
  
  return selectedItems.slice(0, sessionContext.limit);
}

function getDifficultyBucket(masteryScore) {
  if (masteryScore < 30) return [1, 2];      // EASY
  if (masteryScore < 70) return [2, 3];      // MEDIUM
  return [4, 5];                             // HARD
}
```

---

#### 5. Mastery Service (`/backend/services/masteryService.js`)

**EMA Calculation**:

```javascript
export async function updateMastery(userId, topic, item, isCorrect, timeTaken) {
  const alpha = 0.2; // Learning rate
  
  // Get current mastery for topic
  const user = await User.findById(userId);
  const currentMastery = user.learnerProfile.topics.get(topic)?.mastery || 0;
  
  // Calculate raw gain
  const difficultyWeight = [0.6, 0.8, 1.0, 1.2, 1.4][item.difficulty - 1];
  const correctness = isCorrect ? 1 : 0;
  const timeBonus = timeTaken < expectedTime ? 0.1 : 0;
  
  let rawGain = difficultyWeight * (correctness + timeBonus);
  
  // Apply streak bonus
  const streak = await getTopicStreak(userId, topic);
  if (streak >= 3) rawGain += 5 * Math.min(streak / 3, 3); // Max +15
  
  // Apply time penalty
  if (timeTaken > expectedTime * 1.5) rawGain -= 2;
  
  // EMA update
  const newMastery = currentMastery * (1 - alpha) + 
                     (currentMastery + rawGain) * alpha;
  
  // Clamp to [0, 100]
  const clampedMastery = Math.max(0, Math.min(100, newMastery));
  
  // Update user profile
  user.learnerProfile.topics.set(topic, {
    mastery: clampedMastery,
    attempts: (user.learnerProfile.topics.get(topic)?.attempts || 0) + 1,
    streak: isCorrect ? streak + 1 : 0,
    lastAttempt: new Date(),
    timeOnTask: (user.learnerProfile.topics.get(topic)?.timeOnTask || 0) + timeTaken
  });
  
  await user.save();
  
  // Trigger remediation if needed
  if (await shouldTriggerRemediation(userId, topic)) {
    await triggerRemediationTask(userId, topic);
  }
}
```

---

#### 6. Admin Routes (`/backend/routes/admin.js`)

**User Management**:
```
GET    /api/admin/users              # List users (paginated)
GET    /api/admin/users/:id          # Get user details
POST   /api/admin/users              # Create user
PUT    /api/admin/users/:id          # Update user
POST   /api/admin/users/:id/reset-password  # Reset password
DELETE /api/admin/users/:id          # Delete user
```

**Bulk Operations**:
```
POST   /api/admin/import/items       # Bulk import questions
POST   /api/admin/import/quizzes     # Bulk import quizzes
POST   /api/admin/import/bulk        # Combined import (items + quizzes + users)
```

**Analytics**:
```
GET    /api/admin/analytics/cohort   # Cohort-level analytics
GET    /api/admin/analytics/user/:id # User-level analytics
GET    /api/admin/proctor-logs       # Proctoring violation logs
```

---

### Environment Variables

**Required**:
```env
MONGO_URI=mongodb://localhost:27017
MONGO_DB=nimbus
JWT_SECRET=your_jwt_secret_key_here
PORT=4000
```

**Optional**:
```env
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-v3.1:671b-cloud
OLLAMA_API_KEY=

# Proctoring
PROCTOR_RISK_THRESHOLD=20
ALLOW_TAB_SWITCHES_DEFAULT=2

# Redis (for job queue)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info

# Deployment
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

---

## Frontend Technical Specifications

### Framework & Tools

**React 18.3** with concurrent rendering  
**Vite 5.4** for lightning-fast HMR  
**Tailwind CSS 3.4** for utility-first styling  
**React Router 6** for client-side navigation  

### Key Components

#### 1. Student Dashboard

**Path**: `/frontend/src/pages/StudentDashboard.jsx`

**Features**:
- Mastery heatmap visualization (topics × difficulty)
- Recommended next quizzes based on rules engine
- Recent attempts with pass/fail indicators
- Time-on-task tracking
- Streak tracking per topic

**Data Flow**:
```
Dashboard Mount
├─ useAuth() hook → verify JWT
├─ fetch /api/learning/profile → get learnerProfile
├─ fetch /api/learning/recommendations → get suggested quizzes
└─ Render mastery heatmap + quiz buttons
```

---

#### 2. Quiz Taking Interface

**Path**: `/frontend/src/pages/QuizPage.jsx`

**Flow**:
```
1. Click "Start Quiz"
   POST /api/assessment/start
   │
2. Display first question
   GET /api/assessment/:sessionId
   ├─ Render QuestionDisplay component
   ├─ Start timer
   └─ Enable Proctoring (if proctored mode)
   
3. Student submits answer
   POST /api/assessment/answer
   ├─ Display immediate feedback
   ├─ Show explanation (if incorrect)
   └─ Auto-advance to next question
   
4. After last question
   POST /api/assessment/finish
   └─ Redirect to ResultsPage
```

**Proctoring Features** (Frontend):

```javascript
// ProctoringMonitor.jsx
useEffect(() => {
  // Tab visibility tracking
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Tab switched away
      sendViolation('tab_switch');
    }
  });
  
  // Copy/paste blocking
  document.addEventListener('copy', e => {
    e.preventDefault();
    sendViolation('copy_attempt');
  });
  
  // Right-click blocking
  document.addEventListener('contextmenu', e => {
    e.preventDefault();
    sendViolation('right_click');
  });
  
  // DevTools detection
  document.addEventListener('keydown', e => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
      sendViolation('devtools_opened');
    }
  });
}, [sessionId]);
```

---

#### 3. Results & Analytics

**Path**: `/frontend/src/pages/ResultsPage.jsx`

**Displays**:
- Overall score & accuracy per topic
- Per-question breakdown (correct/incorrect)
- Mastery change visualization
- Download notes button
- Recommended remediation
- Share results (optional)

---

#### 4. Admin Dashboard

**Path**: `/frontend/src/pages/AdminDashboard.jsx`

**Sections**:
- **User Management**: Create/edit/delete users, reset passwords
- **Question Bank**: Import/manage questions, bulk operations
- **Quiz Management**: Create/edit/publish quizzes
- **Analytics**: Cohort performance, weak areas, trends
- **Proctoring**: View violation logs, override sessions
- **Rules Editor**: JSON editor for adaptation rules

---

### API Client Abstraction

**Path**: `/frontend/src/services/apiClient.js`

```javascript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.VITE_API_URL || 'http://localhost:4000',
  timeout: 10000,
});

// Auth token injection
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired → redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

---

## Database Schema

### Collections Overview

#### 1. Users Collection

```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  passwordHash: String (bcrypt hashed),
  role: "student" | "instructor" | "admin",
  studentId: String (unique, required if role=student),
  
  // Learner profile (for students)
  learnerProfile: {
    topics: Map<String, {
      mastery: Number (0-100),
      attempts: Number,
      streak: Number,
      lastAttempt: Date,
      timeOnTask: Number (seconds)
    }>,
    preferredMode: "diagnostic" | "formative" | "summative" | "mixed",
    lastActiveAt: Date
  },
  
  lockedSubjects: [String], // Topics locked for student
  proctorConsent: Boolean,
  
  createdAt: Date,
  updatedAt: Date
}
```

#### 2. Items Collection

```javascript
{
  _id: ObjectId,
  type: "mcq" | "fill_blank" | "short_answer" | "match" | "reorder",
  question: String,
  
  // MCQ specific
  choices: [String],
  
  // All types
  answer: String | Array | Map,
  gradingMethod: "exact" | "levenshtein" | "semantic" | "pair_match" | "sequence_check",
  
  // Metadata
  difficulty: Number (1-5),
  bloom: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create",
  topics: [String],
  skills: [String],
  tags: [String],
  hints: [String],
  explanation: String,
  
  // Provenance
  createdBy: ObjectId (User),
  aiGenerated: Boolean,
  seedId: String (unique per generation),
  
  createdAt: Date,
  updatedAt: Date
}
```

#### 3. GeneratedQuiz Collection

```javascript
{
  _id: ObjectId,
  topic: String,
  prompt: String,
  sourceModel: String,
  seedId: String (unique),
  
  parsedItems: [{
    id: String,
    question: String,
    difficulty: Number,
    bloom: String,
    ...
  }],
  
  linkedItemIds: [ObjectId], // Links to Item collection
  status: "draft" | "published",
  
  // Metadata
  createdBy: ObjectId (User),
  createdAt: Date,
  publishedAt: Date,
  publishedBy: ObjectId,
  
  // Audit
  validationResult: Object,
  ttl: 30 // days
}
```

#### 4. QuizSession Collection

```javascript
{
  _id: ObjectId,
  user: ObjectId (User),
  mode: "diagnostic" | "formative" | "summative" | "proctored",
  
  itemIds: [ObjectId], // Items in quiz
  currentIndex: Number,
  
  startedAt: Date,
  completedAt: Date,
  timeLimit: Number (seconds),
  
  score: Number,
  status: "active" | "completed" | "invalidated",
  invalidationReason: String,
  
  metadata: {
    rulesUsed: [String],
    sourceGeneratedQuizId: ObjectId,
    proctorConfig: Object
  },
  
  updatedAt: Date
}
```

#### 5. Attempt Collection

```javascript
{
  _id: ObjectId,
  user: ObjectId (User),
  item: ObjectId (Item),
  session: ObjectId (QuizSession),
  
  answer: String | Array,
  correct: Boolean,
  score: Number (0-1),
  
  // Timing
  submittedAt: Date,
  timeTaken: Number (seconds),
  
  // Feedback
  explanation: Object, // From ollamaService
  explanationGeneratedId: ObjectId,
  
  // Metadata
  topicAttempted: String,
  masteryBefore: Number,
  masteryAfter: Number,
  
  createdAt: Date
}
```

#### 6. ProctoringLog Collection

```javascript
{
  _id: ObjectId,
  session: ObjectId (QuizSession),
  user: ObjectId (User),
  
  violations: [{
    type: "tab_switch" | "copy_attempt" | "right_click" | "devtools" | "custom",
    timestamp: Date,
    severity: "minor" | "major",
    details: String
  }],
  
  riskScore: Number,
  autoInvalidated: Boolean,
  
  createdAt: Date
}
```

#### 7. Rules Collection

```javascript
{
  _id: ObjectId,
  name: String,
  
  // Rule definition
  condition: {
    masteryRange: [min, max],
    topicRequired: String,
    prerequisite: [String],
    streakRequired: Number
  },
  
  action: {
    difficulty: "increase" | "decrease" | "maintain",
    nextTopic: String,
    remediation: Boolean
  },
  
  createdBy: ObjectId (User),
  active: Boolean,
  
  createdAt: Date
}
```

---

## API Endpoints Reference

### Authentication Endpoints

```
POST /api/auth/register
├─ Body: { name, email, password, role, studentId? }
├─ Response: { token, user }
└─ Status: 201 Created | 400 Validation Error | 409 Conflict

POST /api/auth/login
├─ Body: { email, password }
├─ Response: { token, user }
└─ Status: 200 OK | 401 Unauthorized

POST /api/auth/refresh
├─ Body: { refreshToken }
├─ Response: { token }
└─ Status: 200 OK | 401 Unauthorized

GET /api/auth/me
├─ Headers: Authorization: Bearer <token>
├─ Response: { user }
└─ Status: 200 OK | 401 Unauthorized
```

### AI Endpoints

```
POST /api/ai/generate
├─ Body: { topic, levels: {easy, medium, hard}, saveToBank }
├─ Response: { generatedQuizId, linkedItemIds, items }
├─ Status: 201 Created | 429 Rate Limited
└─ Access: Authenticated users

GET /api/ai/generated/:id
├─ Response: { topic, items, status, createdAt }
├─ Status: 200 OK | 404 Not Found
└─ Access: Authenticated users

POST /api/ai/explain
├─ Body: { questionId, userAnswer, topic }
├─ Response: { explanation, remedialSteps, resources }
├─ Status: 200 OK
└─ Access: Authenticated users

POST /api/ai/notes
├─ Body: { topic, mistakes: [String] }
├─ Response: { markdown }
├─ Status: 200 OK
└─ Access: Authenticated users
```

### Assessment Endpoints

```
POST /api/assessment/start
├─ Body: { mode, requestedTopics?, limit }
├─ Response: { sessionId, itemIds, proctorConfig? }
├─ Status: 201 Created
└─ Access: Authenticated students

POST /api/assessment/answer
├─ Body: { sessionId, answer, timeTaken }
├─ Response: { correct, score, feedback, explanation? }
├─ Status: 200 OK | 422 Invalid Session
└─ Access: Authenticated students

GET /api/assessment/:sessionId
├─ Response: { session details }
├─ Status: 200 OK | 404 Not Found
└─ Access: Session owner

POST /api/assessment/finish
├─ Body: { sessionId }
├─ Response: { finalScore, results, masteryUpdates }
├─ Status: 200 OK
└─ Access: Session owner
```

### Learning Endpoints

```
GET /api/learning/profile
├─ Response: { topics, streaks, timeOnTask, recommendations }
├─ Status: 200 OK
└─ Access: Authenticated users

GET /api/learning/recommendations
├─ Response: { recommended: [{ topic, difficulty, reason }] }
├─ Status: 200 OK
└─ Access: Authenticated students

GET /api/learning/analytics
├─ Response: { mastery trend, weak areas, strengths }
├─ Status: 200 OK
└─ Access: Authenticated users
```

### Admin Endpoints

```
GET /api/admin/users?role=&q=&limit=50&offset=0
├─ Response: { users: [...], total, limit, offset }
├─ Status: 200 OK
└─ Access: Admins only

POST /api/admin/users
├─ Body: { name, email, password, role, studentId? }
├─ Response: { id, name, email, role }
├─ Status: 201 Created | 400 Validation Error
└─ Access: Admins only

PUT /api/admin/users/:id
├─ Body: { name?, email?, role?, lockedSubjects? }
├─ Response: { updated user }
├─ Status: 200 OK | 404 Not Found
└─ Access: Admins only

POST /api/admin/import/items
├─ Body: { source, items: [...] }
├─ Response: { inserted, failed, errors? }
├─ Status: 200 OK | 400 Validation Error
└─ Access: Admins, Instructors

POST /api/admin/import/quizzes
├─ Body: { source, quizzes: [...] }
├─ Response: { inserted, failed, errors? }
├─ Status: 200 OK
└─ Access: Admins, Instructors

POST /api/admin/import/bulk
├─ Body: { items?, quizzes?, users? }
├─ Response: { summary: { items, quizzes, users } }
├─ Status: 200 OK
└─ Access: Admins only
```

### Proctoring Endpoints

```
POST /api/proctor/violation
├─ Body: { sessionId, type, severity }
├─ Response: { riskScore, sessionInvalidated? }
├─ Status: 200 OK
└─ Access: Proctored quiz sessions

GET /api/proctor/logs
├─ Response: { violations: [...] }
├─ Status: 200 OK
└─ Access: Admins, Instructors

POST /api/proctor/override/:sessionId
├─ Body: { action: "invalidate"|"restore", reason }
├─ Response: { session updated }
├─ Status: 200 OK
└─ Access: Admins only
```

### Chat Endpoints

```
POST /api/chat
├─ Body: { message, context? }
├─ Response: { reply, meta: { topics, level, resources } }
├─ Status: 200 OK | 429 Rate Limited
└─ Access: Authenticated users
```

---

## Installation & Setup

### Prerequisites

- **Node.js**: v16+ (tested on v18 LTS)
- **MongoDB**: v5.0+ (local or Atlas)
- **Ollama**: Installed with deepseek-v3.1:671b-cloud model pulled

### Backend Setup

```bash
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env

# 4. Edit .env with your configuration
nano .env

# 5. Seed database (optional)
npm run seed

# 6. Start server
npm start
# or dev with auto-reload
npm run dev
```

**Backend .env Template**:
```env
MONGO_URI=mongodb://localhost:27017
MONGO_DB=nimbus
JWT_SECRET=your-super-secret-jwt-key-change-this
PORT=4000
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-v3.1:671b-cloud
NODE_ENV=development
```

### Frontend Setup

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Create .env file (if needed)
# VITE_API_URL=http://localhost:4000

# 4. Start development server
npm run dev
# Server runs on http://localhost:5173

# 5. Build for production
npm run build
```

### Ollama Setup

```bash
# 1. Install Ollama from https://ollama.ai

# 2. Download the model
ollama pull deepseek-v3.1:671b-cloud

# 3. Start Ollama server
ollama serve

# Server listens on http://localhost:11434
# Test: curl http://localhost:11434/api/tags
```

---

## Docker Deployment

### Single-Command Docker Compose

```bash
# 1. Ensure Docker & Docker Compose installed
docker --version
docker-compose --version

# 2. Start all services
docker-compose up -d

# Services:
# - API: http://localhost:4000
# - Frontend: http://localhost:3000 (if exposed)
# - MongoDB: localhost:27017
# - Ollama: http://localhost:11434 (optional)
```

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  mongo:
    image: mongo:5.0
    container_name: nimbus-mongo
    environment:
      MONGO_INITDB_DATABASE: nimbus
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/nimbus --quiet
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: nimbus-api
    environment:
      MONGO_URI: mongodb://mongo:27017
      MONGO_DB: nimbus
      JWT_SECRET: ${JWT_SECRET}
      OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://ollama:11434}
      PORT: 4000
    ports:
      - "4000:4000"
    depends_on:
      mongo:
        condition: service_healthy
    healthcheck:
      test: curl -f http://localhost:4000/api/ping || exit 1
      interval: 10s
      timeout: 5s
      retries: 5

  ollama:
    image: ollama/ollama:latest
    container_name: nimbus-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    # Pull model on startup (requires manual intervention)
    # Command: ollama pull deepseek-v3.1:671b-cloud

volumes:
  mongo_data:
  ollama_data:

networks:
  default:
    name: nimbus-network
```

---

## Configuration

### Environment Variables Complete Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MONGO_URI` | String | ` mongodb://localhost:27017` | MongoDB connection string |
| `MONGO_DB` | String | `nimbus` | Database name |
| `JWT_SECRET` | String | (required) | JWT signing secret |
| `PORT` | Number | `4000` | Express server port |
| `OLLAMA_BASE_URL` | String | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | String | `deepseek-v3.1:671b-cloud` | Model name |
| `PROCTOR_RISK_THRESHOLD` | Number | `20` | Risk score limit |
| `ALLOW_TAB_SWITCHES_DEFAULT` | Number | `2` | Allowed tab switches |
| `REDIS_URL` | String | (optional) | Redis connection for job queue |
| `NODE_ENV` | String | `development` | Environment mode |
| `LOG_LEVEL` | String | `info` | Logging verbosity |
| `FRONTEND_URL` | String | `http://localhost:5173` | Frontend URL for CORS |

---

## Task Implementation Guide

### Task 1: Project Bootstrap
**Status**: ✅ Complete  
**Implemented**: MERN project structure, Express app, React Vite setup  
**Files Created**: All base files in backend & frontend directories  

### Task 2: User Authentication
**Status**: ✅ Complete  
**Endpoints**: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`  
**Security**: JWT tokens, bcrypt password hashing, RBAC middleware  
**Implementation**: `backend/routes/auth.js`, `backend/services/authService.js`  

### Task 3: Item Bank & Question Management
**Status**: ✅ Complete  
**Features**:
- Multi-modal question types (MCQ, fill-blank, short-answer, match, reorder)
- Bulk import with validation
- Difficulty levels 1-5 + Bloom's taxonomy tagging
- Admin management endpoints

**Implementation**: `backend/models/Item.js`, `backend/routes/questionBank.js`, `backend/routes/admin.js`  

### Task 4: AI Question Generation
**Status**: ✅ Complete  
**Features**:
- Ollama integration with DeepSeek-V3.1
- Multi-level generation (easy/medium/hard)
- Schema validation and error handling
- 30-day caching to prevent redundant generations

**Implementation**: `backend/services/ollamaService.js`, `backend/routes/ai.js`  

### Task 5: Adaptive Rules Engine
**Status**: ✅ Complete  
**Features**:
- Mastery-based difficulty selection
- Prerequisite enforcement
- 48-hour cooldown for item repetition
- Spaced repetition logic
- Streak tracking

**Implementation**: `backend/services/rulesEngine.js`  

### Task 6: Quiz Session Management
**Status**: ✅ Complete  
**Features**:
- Session creation with rules engine integration
- Per-item answer submission
- Immediate feedback + explanations
- Session completion & analytics

**Implementation**: `backend/routes/assessment.js`, `backend/models/QuizSession.js`  

### Task 7: Mastery Tracking (EMA)
**Status**: ✅ Complete  
**Algorithm**: Exponential Moving Average with difficulty weighting  
**Features**:
- Real-time mastery updates
- Streak bonuses
- Time penalties
- Remediation trigger logic

**Implementation**: `backend/services/masteryService.js`  

### Task 8: Proctoring System
**Status**: ✅ Complete  
**Features**:
- Privacy-focused (no camera/snapshots)
- Tab switch detection
- Copy/paste blocking
- DevTools detection
- Risk scoring + auto-invalidation

**Implementation**: `backend/routes/proctor.js`, Frontend: `ProctoringMonitor.jsx`  

### Task 9: Bulk Import & Admin Tools
**Status**: ✅ Complete  
**Endpoints**:
- `/api/admin/import/items` - Import questions
- `/api/admin/import/quizzes` - Import quizzes
- `/api/admin/import/bulk` - Combined import

**Implementation**: `backend/routes/admin.js`  

### Task 10: UI/UX Components
**Status**: ✅ Complete  
**Components**:
- Student Dashboard with mastery heatmap
- Quiz taking interface
- Results page with feedback
- Admin console
- Chatbot UI

**Implementation**: `frontend/src/pages/`, `frontend/src/components/`  

### Task 11: Docker & Deployment
**Status**: ✅ Complete  
**Files**: `docker-compose.yml`, `backend/Dockerfile`  
**Services**: MongoDB, Express API, optional Ollama  

### Task 12: Testing & Documentation
**Status**: ✅ Complete  
**Documentation**: This README + additional guides  
**Test Coverage**: Service layer unit tests (seed in backend/scripts)  

---

## Performance & Scaling

### Optimization Strategies

#### 1. Database Indexing
```javascript
// Item schema
itemSchema.index({ topics: 1, difficulty: 1 });
itemSchema.index({ createdAt: -1 });
itemSchema.index({ aiGenerated: 1 });

// Attempt schema
attemptSchema.index({ user: 1, item: 1 });
attemptSchema.index({ user: 1, createdAt: -1 });

// QuizSession schema
quizSessionSchema.index({ user: 1, completedAt: -1 });
```

#### 2. Caching Strategy

```javascript
// Redis caching for frequent queries
const cacheKey = `items:topic:${topic}:difficulty:${difficulty}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// Cache for 30 minutes
const items = await Item.find({ topics: topic, difficulty });
await redis.setex(cacheKey, 1800, JSON.stringify(items));
```

#### 3. Connection Pooling

```javascript
// Mongoose auto-handles with connection pool
// Max connections: 100 (default)
const options = {
  maxPoolSize: 100,
  minPoolSize: 10,
  socketTimeoutMS: 45000,
};
mongoose.connect(MONGO_URI, options);
```

#### 4. Rate Limiting

```javascript
// Per-user rate limiting (prevent abuse)
import rateLimit from 'express-rate-limit';

const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per user
  keyGenerator: (req) => req.user.id,
});

app.post('/api/ai/generate', generateLimiter, generateController);
```

#### 5. Pagination

```javascript
// Always paginate large result sets
GET /api/admin/users?limit=50&offset=0

const skip = parseInt(req.query.offset) || 0;
const limit = Math.min(parseInt(req.query.limit) || 50, 100);

const users = await User.find()
  .skip(skip)
  .limit(limit);
```

### Scaling Considerations

#### Horizontal Scaling
```yaml
# Load balancer → multiple API instances
nginx (load balancer)
├─ api-1 (Node.js instance 1)
├─ api-2 (Node.js instance 2)
└─ api-3 (Node.js instance 3)
```

#### Database Sharding
```
Large user bases → shard by userId
Collections: items (global), attempts (sharded), sessions (sharded)
```

---

## Security Considerations

### Authentication & Authorization

```javascript
// JWT Middleware
export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// RBAC Middleware
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// Usage
app.post('/api/admin/users', authMiddleware, requireRole('admin'), controller);
```

### Password Security

```javascript
// Hash on registration
const hash = await bcrypt.hash(password, 10);
user.passwordHash = hash;

// Verify on login
const match = await bcrypt.compare(password, user.passwordHash);
```

### Input Validation

```javascript
// Example: Validate quiz creation
const schema = {
  topic: { type: 'string', minLength: 3, maxLength: 100 },
  levels: {
    type: 'object',
    properties: {
      easy: { type: 'number',
