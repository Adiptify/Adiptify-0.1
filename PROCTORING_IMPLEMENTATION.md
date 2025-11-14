# Screen-Based Proctoring & Multimodal Questions Implementation

## Overview

This document describes the implementation of screen-based proctoring (no camera/snapshots) and support for multiple question types (MCQ, Fill-in-the-blank, Short Answer, Match, Reorder) in the Adiptify learning platform.

## Features Implemented

### 1. Question Types
- **MCQ**: Multiple choice questions with exact matching
- **Fill-in-the-blank**: Levenshtein similarity grading (≥0.8 threshold)
- **Short Answer**: Semantic LLM grading using Ollama/DeepSeek (≥0.75 similarity)
- **Match**: Pair matching with partial credit
- **Reorder**: Sequence checking with partial credit per correct position

### 2. Proctoring (Screen-Only)
- **No webcam or screenshots** - privacy-focused
- **Tab switch monitoring**: Allows 2 switches, 3rd escalates to major violation
- **Copy/paste blocking**: Prevents clipboard operations
- **Right-click blocking**: Prevents context menu access
- **DevTools detection**: Detects F12, Ctrl+Shift+I/J
- **Risk scoring**: `riskScore = majorViolations × 5 + minorViolations × 1`
- **Auto-invalidation**: Session invalidated when `riskScore >= 20` (configurable)

### 3. Adaptive Mastery System
- **Difficulty weights**: [0.6, 0.8, 1.0, 1.2, 1.4] for difficulty 1-5
- **Streak bonus**: +5 mastery per 3-correct streak (max 15)
- **Time penalty**: -2 mastery if time > expected × 1.5
- **EMA-like update**: `masteryNew = masteryOld × (1-α) + α × (masteryOld + rawGain)`

### 4. Admin/Instructor Features
- **Mass import**: JSON import for question banks
- **Subject locking**: Lock/unlock subjects for specific users
- **Proctor logs**: View violation logs and override sessions
- **Session override**: Invalidate or restore sessions manually

## Environment Variables

Add these to your `.env` file:

```env
# Proctoring Configuration
PROCTOR_RISK_THRESHOLD=20          # Risk score threshold for auto-invalidation
ALLOW_TAB_SWITCHES_DEFAULT=2       # Number of allowed tab switches before escalation

# Existing Ollama config (already in use)
OLLAMA_MODEL=deepseek-v3.1:671b-cloud
OLLAMA_API_KEY=your_api_key_here
```

## API Endpoints

### Quiz Endpoints

#### `POST /api/quiz/start`
Start a new quiz session (supports proctored mode).

**Request:**
```json
{
  "mode": "proctored",
  "requestedTopics": ["arrays"],
  "limit": 5,
  "proctored": true
}
```

**Response:**
```json
{
  "sessionId": "...",
  "itemIds": ["..."],
  "proctorConfig": {
    "blockTabSwitch": true,
    "blockCopyPaste": true,
    "blockRightClick": true,
    "allowTabSwitchCount": 2,
    "requireSnapshots": false
  }
}
```

#### `POST /api/quiz/answer`
Submit an answer (automatically checks for invalidation).

**Request:**
```json
{
  "sessionId": "...",
  "answer": "answer text or array",
  "answerIndex": 0,  // For MCQ only
  "timeTakenMs": 5300
}
```

**Response:**
```json
{
  "isCorrect": true,
  "score": 0.87,
  "correctAnswer": "...",
  "explanation": "...",
  "newMastery": 65,
  "needsManualGrading": false
}
```

### Proctor Endpoints

#### `POST /api/proctor/event`
Log a proctor violation event.

**Request:**
```json
{
  "sessionId": "...",
  "violationType": "tab_switch",
  "details": "visibilitychange fired"
}
```

#### `GET /api/proctor/session/:sessionId/logs`
Get proctor logs for a session (instructor/admin only).

#### `POST /api/proctor/session/:sessionId/override`
Override session invalidation (instructor/admin only).

**Request:**
```json
{
  "action": "invalidate" | "restore",
  "reason": "Manual review required"
}
```

### Admin Endpoints

#### `POST /api/admin/import/items`
Mass import questions from JSON.

**Request:**
```json
{
  "source": "semester1_import",
  "items": [
    {
      "type": "mcq",
      "question": "What is 2+2?",
      "choices": ["3", "4", "5"],
      "answer": "4",
      "gradingMethod": "exact",
      "difficulty": 1,
      "bloom": "remember",
      "topics": ["arithmetic"]
    },
    {
      "type": "short_answer",
      "question": "Explain polymorphism.",
      "answer": "Ability of objects to take many forms",
      "gradingMethod": "semantic",
      "difficulty": 3,
      "bloom": "understand",
      "topics": ["oop"]
    }
  ]
}
```

#### `POST /api/admin/user/:id/lock-subject`
Lock a subject for a user.

**Request:**
```json
{
  "subjectCode": "advanced_algorithms"
}
```

#### `DELETE /api/admin/user/:id/lock-subject/:subjectCode`
Unlock a subject for a user.

## Frontend Components

### ProctorGuard Component

Wraps quiz pages to monitor proctoring events.

**Usage:**
```jsx
<ProctorGuard 
  sessionId={sessionId} 
  proctorConfig={proctorConfig}
  onInvalidated={handleInvalidated}
>
  <QuizContent />
</ProctorGuard>
```

**Features:**
- Monitors tab switches, copy/paste, right-click, devtools
- Posts events to `/api/proctor/event`
- Shows consent modal on first load
- Displays invalidation overlay when session is invalidated
- Shows risk score indicator (green/yellow/red)

## Database Schema Changes

### New Models

- **ProctorLog**: Stores violation events (no images)
- **Updated Item**: Added `gradingMethod` field, new question types
- **Updated Attempt**: Added `score`, `gradingDetails`, `proctorLogRefs`
- **Updated QuizSession**: Added `proctored`, `proctorConfig`, `proctorSummary`, `invalidated`
- **Updated User**: Added `proctorConsent`, `lockedSubjects`

## Grading Methods

1. **exact**: String equality (MCQ)
2. **levenshtein**: Text similarity ≥0.8 (Fill-in-the-blank)
3. **semantic**: LLM evaluation ≥0.75 similarity (Short Answer)
4. **pair_match**: Pair comparison with partial credit (Match)
5. **sequence_check**: Position comparison with partial credit (Reorder)

## Testing Checklist

- [ ] Start proctored session returns proctorConfig
- [ ] Tab switch creates minor violation (first 2)
- [ ] 3rd tab switch escalates to major violation
- [ ] Risk score accumulates correctly
- [ ] Session auto-invalidates at threshold (riskScore >= 20)
- [ ] Short answer graded by LLM (semantic)
- [ ] Match/reorder produce correct partial credit
- [ ] Mass import JSON works correctly
- [ ] Subject locking prevents quiz start
- [ ] Instructor can override session invalidation

## Notes

- **No screenshots**: Privacy-focused, only event logs
- **LLM fallback**: If semantic grading fails, falls back to levenshtein
- **Manual grading flag**: Short answers that fail LLM grading are flagged for instructor review
- **Server-side enforcement**: Client-side monitoring is for UX only; server validates all actions

## Migration Notes

Existing quizzes will continue to work. New question types require:
- Updating item `type` field to new enum values
- Setting appropriate `gradingMethod`
- For short_answer items, ensure `answer` is a string or array of exemplar answers

