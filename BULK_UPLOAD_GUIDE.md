# Bulk Upload Guide

This guide explains how to use the bulk upload endpoints for importing questions, quizzes, and users into Adiptify.

## Endpoints

### 1. Import Items (Questions)
**POST** `/api/admin/import/items`  
**Access:** Admin, Instructor

### 2. Import Quizzes
**POST** `/api/admin/import/quizzes`  
**Access:** Admin, Instructor

### 3. Bulk Import (All Types)
**POST** `/api/admin/import/bulk`  
**Access:** Admin only

## JSON Formats

### Items (Questions) Format

```json
{
  "source": "semester1_import",
  "items": [
    {
      "type": "mcq",
      "question": "What is the output of 2 + 2?",
      "choices": ["3", "4", "5", "22"],
      "answer": "4",
      "gradingMethod": "exact",
      "difficulty": 1,
      "bloom": "remember",
      "topics": ["arithmetic/basic"],
      "hints": ["Check addition"],
      "explanation": "2 + 2 equals 4"
    },
    {
      "type": "fill_blank",
      "question": "The capital of France is ____.",
      "answer": "Paris",
      "gradingMethod": "levenshtein",
      "difficulty": 1,
      "bloom": "remember",
      "topics": ["geography/europe"]
    },
    {
      "type": "short_answer",
      "question": "Explain polymorphism in OOP.",
      "answer": "Ability of objects to take many forms; same interface can operate on different underlying types",
      "gradingMethod": "semantic",
      "difficulty": 3,
      "bloom": "understand",
      "topics": ["programming/oop"]
    },
    {
      "type": "match",
      "question": "Match composers to their nationality.",
      "answer": [
        ["Mozart", "Austrian"],
        ["Beethoven", "German"],
        ["Chopin", "Polish"]
      ],
      "gradingMethod": "pair_match",
      "difficulty": 3,
      "bloom": "understand",
      "topics": ["music/history"]
    },
    {
      "type": "reorder",
      "question": "Order the steps of the water cycle.",
      "answer": ["evaporation", "condensation", "precipitation", "collection"],
      "gradingMethod": "sequence_check",
      "difficulty": 2,
      "bloom": "understand",
      "topics": ["science/environment"]
    }
  ]
}
```

### Quizzes Format

```json
{
  "source": "semester1_quizzes",
  "quizzes": [
    {
      "topic": "JavaScript Basics",
      "prompt": "Quiz on JavaScript fundamentals",
      "status": "published",
      "proctored": false,
      "levels": {
        "easy": 2,
        "medium": 3,
        "hard": 1
      },
      "items": [
        {
          "type": "mcq",
          "question": "What is a closure in JavaScript?",
          "choices": [
            "A function that has access to variables in its outer scope",
            "A way to close a file",
            "A JavaScript keyword",
            "A type of loop"
          ],
          "answer": "A function that has access to variables in its outer scope",
          "difficulty": 3,
          "bloom": "understand",
          "topics": ["javascript"]
        },
        {
          "type": "short_answer",
          "question": "Explain the difference between let, const, and var.",
          "answer": "let and const are block-scoped, var is function-scoped. const cannot be reassigned.",
          "difficulty": 2,
          "bloom": "understand",
          "topics": ["javascript"]
        }
      ]
    }
  ]
}
```

### Users Format (Admin Only)

```json
{
  "users": [
    {
      "name": "John Doe",
      "email": "john.doe@example.com",
      "password": "securePassword123",
      "role": "student",
      "studentId": "STU001"
    },
    {
      "name": "Jane Instructor",
      "email": "jane.instructor@example.com",
      "password": "securePassword123",
      "role": "instructor"
    },
    {
      "name": "Admin User",
      "email": "admin@example.com",
      "password": "securePassword123",
      "role": "admin"
    }
  ]
}
```

### Combined Bulk Import Format

```json
{
  "items": [
    {
      "type": "mcq",
      "question": "Sample question?",
      "choices": ["A", "B", "C"],
      "answer": "A",
      "difficulty": 1,
      "bloom": "remember",
      "topics": ["sample"]
    }
  ],
  "quizzes": [
    {
      "topic": "Sample Topic",
      "status": "draft",
      "items": [
        {
          "type": "mcq",
          "question": "Quiz question?",
          "choices": ["A", "B"],
          "answer": "A",
          "difficulty": 2,
          "bloom": "understand",
          "topics": ["sample"]
        }
      ]
    }
  ],
  "users": [
    {
      "name": "Test Student",
      "email": "test@example.com",
      "password": "password123",
      "role": "student",
      "studentId": "TEST001"
    }
  ]
}
```

## Question Types & Grading Methods

| Type | Default Grading Method | Answer Format |
|------|----------------------|---------------|
| `mcq` | `exact` | String (choice text) |
| `fill_blank` | `levenshtein` | String |
| `short_answer` | `semantic` | String or Array of exemplar answers |
| `match` | `pair_match` | Array of `[key, value]` pairs |
| `reorder` | `sequence_check` | Array of items in correct order |

## Response Format

### Success Response

```json
{
  "inserted": 5,
  "failed": 0,
  "total": 5,
  "errors": null
}
```

### Response with Errors

```json
{
  "inserted": 3,
  "failed": 2,
  "total": 5,
  "errors": [
    {
      "index": 1,
      "error": "Missing required fields: type, question, answer",
      "item": { ... }
    },
    {
      "index": 4,
      "error": "Invalid type: invalid_type",
      "item": { ... }
    }
  ]
}
```

### Bulk Import Response

```json
{
  "summary": {
    "items": {
      "total": 10,
      "inserted": 9,
      "failed": 1
    },
    "quizzes": {
      "total": 2,
      "inserted": 2,
      "failed": 0
    },
    "users": {
      "total": 5,
      "inserted": 5,
      "failed": 0
    }
  },
  "errors": [
    {
      "type": "items",
      "errors": [
        {
          "index": 5,
          "error": "Missing required fields",
          "item": { ... }
        }
      ]
    }
  ]
}
```

## Example cURL Commands

### Import Items

```bash
curl -X POST http://localhost:4000/api/admin/import/items \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @items.json
```

### Import Quizzes

```bash
curl -X POST http://localhost:4000/api/admin/import/quizzes \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @quizzes.json
```

### Bulk Import

```bash
curl -X POST http://localhost:4000/api/admin/import/bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @bulk_import.json
```

## Notes

- **Validation**: All items are validated before insertion. Invalid items are skipped and reported in the errors array.
- **Duplicates**: Email and Student ID uniqueness is checked. Duplicates will fail with appropriate error messages.
- **Auto-publishing**: If a quiz is imported with `status: "published"` and has items, those items are automatically created and linked.
- **Permissions**: 
  - Items and Quizzes: Admin and Instructor
  - Users: Admin only
  - Bulk Import: Admin only

