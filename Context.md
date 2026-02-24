
# Adiptify — Adaptive Learning Platform

An intelligent, AI-powered educational system that personalizes learning experiences through adaptive quizzes, real-time mastery tracking, and intelligent tutoring.

---

## 🎯 Core Features

### **Adaptive Quiz Generation & Personalization**
- **AI-Powered Question Generation** – Ollama LLM (DeepSeek-v3.1) dynamically generates diverse question types
- **Multiple Question Types** – MCQ, Fill-in-the-blank, Short Answer, Matching, Reordering
- **Difficulty Scaling** – Questions adjust based on learner mastery levels (1-5 difficulty weights: 0.6–1.4)
- **Smart Grading** – Context-aware evaluation:
  - MCQ: Exact matching
  - Fill-blanks: Levenshtein similarity (≥0.8 threshold)
  - Short answers: LLM semantic evaluation (≥0.75 similarity)
  - Matching & Reordering: Partial credit scoring

### **Adaptive Mastery System**
- **EMA-Based Tracking** – Exponential Moving Average algorithm tracks topic proficiency (0-100 scale)
- **Dynamic Difficulty Selection** – Rules engine picks next questions based on current mastery
- **Performance Metrics** – Streak bonuses (+5 per 3-correct streak), time penalties (-2 if >1.5× expected time)
- **Topic-Based Progress** – Mastery tracked per-topic across student's learning path

### **Intelligent Tutoring & Chat**
- **Context-Aware AI Assistant** – Ollama chatbot provides personalized explanations considering:
  - Student's current mastery levels per topic
  - Weak topics (<60% mastery)
  - Recent quiz scores & assessment performance
  - Cognitive readiness (foundational vs. advanced)
- **Learning Resource Integration** – Web search & fetch capabilities for supplementary materials
- **Adaptive Explanations** – Responses scale from basic to advanced based on mastery profile

### **Assessment & Quiz Management**
- **AI-Generated Assessments** – Multi-type assessments with Bloom's taxonomy alignment
- **Quiz Session Tracking** – Records start time, completion time, individual attempts, scores
- **Remediation Suggestions** – AI analyzes mistakes and recommends targeted learning actions
- **Proctoring System** – Screen-only violation detection & monitoring (no camera/biometrics)

### **Instructor & Admin Console**
- **Dashboard Analytics** – View student cohort performance, mastery trends, weak topics
- **Mass Assessment Import** – JSON-based question bank upload & management
- **Subject Locking** – Control which subjects students can access
- **Proctoring Oversight** – View violation logs, override quiz sessions, restore sessions
- **Question Bank Management** – Manage, filter, and organize assessment items

### **Role-Based Access Control**
- **Student Portal** – Dashboard with mastery tracking, quiz history, learning recommendations
- **Instructor Portal** – Quiz management, assessment generation, cohort analytics
- **Admin Portal** – System-wide analytics, user management, rule configuration
- **JWT Authentication** – Stateless, role-based authorization with token refresh

---

## 🛠️ Technology Stack

### **Backend**
| Component | Technology |
|-----------|-----------|
| **Runtime** | Node.js (v20+, Alpine) |
| **Framework** | Express.js (REST API) |
| **Database** | MongoDB + Mongoose ODM |
| **LLM Integration** | Ollama API (DeepSeek-v1:7b / DeepSeek-v3.1) |
| **Authentication** | JWT (jsonwebtoken) + bcrypt password hashing |
| **Text Processing** | Levenshtein distance (fill-blank grading) |
| **Utilities** | Axios, Morgan, CORS, dotenv |

### **Frontend**
| Component | Technology |
|-----------|-----------|
| **Library** | React 18.3.1 |
| **Build Tool** | Vite 5.4.0 |
| **Styling** | Tailwind CSS 3.4.10 + PostCSS |
| **Routing** | React Router v6.26.2 |
| **Export** | html2canvas + jsPDF (PDF generation) |
| **HTTP Client** | Fetch API |

### **DevOps & Deployment**
| Component | Technology |
|-----------|-----------|
| **Containerization** | Docker (Node.js 20-Alpine base) |
| **Orchestration** | Docker Compose (multi-service) |
| **Frontend Hosting** | Vercel ([adiptify.vercel.app](https://adiptify.vercel.app)) |
| **Backend Deployment** | Node.js with environment variables |
| **Database** | MongoDB Atlas (cloud) or local instance |

---

## 📊 Key System Capabilities

### **Rules Engine & Adaptive Selection**
- **Difficulty Calculation** – Based on mastery + question difficulty weight
- **Prerequisite Checking** – Enforces topic dependencies before advancing
- **Spaced Repetition** – Intelligently spaces reviews based on retention data
- **Remediation Triggers** – Auto-suggests learning paths when mastery drops

### **Data Models**
- **User** – Learner profiles, credentials, role assignment
- **Item** – Question bank entries with metadata (type, difficulty, Bloom's level, topic)
- **GeneratedQuiz** – AI-generated quiz records (draft/published status)
- **QuizSession** – Quiz attempt sessions with metadata
- **Attempt** – Individual question responses with scores
- **ProctoringLog** – Violation tracking & timestamps
- **Rule** – JSON-driven adaptation rules

### **AI Prompt Engineering**
- **Question Generator** – Produces varied, high-quality questions with Bloom's alignment
- **Assessment Generator** – Multi-type assessments with strict JSON schema validation
- **Remediation Generator** – Analyzes errors, generates targeted improvement suggestions
- **Chat System** – Context-aware, personalized learning conversations
- **Explanation Generator** – Topic-specific explanations at variable difficulty levels

---

## 🔌 API Overview

| Category | Endpoints |
|----------|-----------|
| **Auth** | `POST /api/auth/register`, `/login`, `/verify`, `GET /api/auth/me` |
| **AI & Quiz** | `POST /api/ai/generate`, `POST /api/assessment/generate`, `GET /api/assessment/:id` |
| **Quiz Sessions** | `POST /api/quiz/start`, `POST /api/quiz/submit`, `GET /api/quiz/:id` |
| **Chat & Tutoring** | `POST /api/chat/message`, `POST /api/learning/search`, `POST /api/learning/fetch` |
| **Learning Progress** | `GET /api/learning/progress`, `GET /api/learning/mastery`, `GET /api/learning/attempts` |
| **Admin** | `GET /api/admin/users`, `GET /api/admin/reports`, `POST /api/proctor/override` |
| **Notes & Resources** | `GET/POST /api/notes`, `DELETE /api/notes/:id` |

---

## 📈 Mastery Algorithm


rawGain = scoreNormalized × difficultyWeight[difficulty-1]
+ bonusFromStreak (if applicable)
- timePenalty (if time exceeded)

masteryNew = masteryOld × (1 - α) + α × (masteryOld + rawGain)
where α = 0.2 (learning rate constant)


**Result:** Smooth, realistic mastery progression that responds to performance, difficulty, and pacing.

---

## 🔐 Security & Architecture

- **Password Security** – bcrypt hashing (10 salt rounds)
- **API Authentication** – JWT bearer tokens with role-based middleware
- **Rate Limiting** – Per-user endpoint throttling
- **CORS Protection** – Environment-based origin control
- **Error Handling** – Centralized error middleware with safe error responses
- **Database Validation** – Mongoose schema enforcement

---

## 🌟 Unique Differentiators

✅ **Local LLM Integration** – No external API costs; runs Ollama locally  
✅ **Comprehensive Question Types** – 5+ question formats vs. typical MCQ-only systems  
✅ **Real Adaptive Logic** – Rules engine + mastery algorithm, not just random selection  
✅ **Instructor-Friendly** – Mass import, analytics, proctoring oversight  
✅ **Privacy-First Proctoring** – Screen monitoring only; no biometric tracking  
✅ **Semantic Grading** – LLM-based evaluation for open-ended answers  

---

## 📦 Project Scale

- **Backend:** ~15 service modules, 8 API route files, JSON-driven prompts
- **Frontend:** ~20 React pages, role-based layouts, real-time state management
- **Database:** 7 MongoDB collections with full relationship mapping
- **LLM Integration:** 5+ prompt templates with strict JSON schemas
- **Docker Ready:** Compose file for local + production deployments

---

## 🔗 Live Demo

**URL:** https://adiptify.vercel.app  
**Repository:** https://github.com/Adiptify/Adiptify-0.1  
**Primary Language:** JavaScript (99.1%)

```

This README focuses on **what the system does**, **how it works technically**, and the **tech stack used** — without setup instructions!
