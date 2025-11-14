# Admin User Management API

Complete user management endpoints for administrators.

## Endpoints

### 1. List Users
**GET** `/api/admin/users`  
**Access:** Admin only

**Query Parameters:**
- `role` (optional): Filter by role (`student`, `instructor`, `admin`)
- `q` (optional): Search by name, email, or studentId
- `limit` (optional, default: 50): Maximum results (max 100)
- `offset` (optional, default: 0): Pagination offset

**Response:**
```json
{
  "users": [
    {
      "_id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "student",
      "studentId": "STU001",
      "lockedSubjects": [],
      "learnerProfile": { ... },
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

### 2. Get User Details
**GET** `/api/admin/users/:id`  
**Access:** Admin only

**Response:**
```json
{
  "_id": "...",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "student",
  "studentId": "STU001",
  "lockedSubjects": ["advanced_algorithms"],
  "learnerProfile": {
    "topics": { ... },
    "preferredMode": "mixed",
    "lastActiveAt": "..."
  },
  "proctorConsent": false,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### 3. Create User
**POST** `/api/admin/users`  
**Access:** Admin only

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "role": "student",
  "studentId": "STU001"
}
```

**Response:**
```json
{
  "id": "...",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "student",
  "studentId": "STU001"
}
```

**Validation:**
- `name`, `email`, `password` are required
- `role` must be `student`, `instructor`, or `admin`
- `studentId` is required if `role` is `student`
- Email and Student ID must be unique

### 4. Update User
**PUT** `/api/admin/users/:id`  
**Access:** Admin only

**Request Body:**
```json
{
  "name": "John Updated",
  "email": "john.new@example.com",
  "role": "instructor",
  "studentId": null,
  "lockedSubjects": ["topic1", "topic2"]
}
```

**Response:**
```json
{
  "id": "...",
  "name": "John Updated",
  "email": "john.new@example.com",
  "role": "instructor",
  "studentId": null,
  "lockedSubjects": ["topic1", "topic2"]
}
```

**Notes:**
- All fields are optional
- Changing role from `student` to another role removes `studentId`
- Email and Student ID uniqueness is validated

### 5. Reset Password
**POST** `/api/admin/users/:id/reset-password`  
**Access:** Admin only

**Request Body:**
```json
{
  "newPassword": "newSecurePassword123"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Password reset successfully"
}
```

**Validation:**
- Password must be at least 6 characters

### 6. Delete User
**DELETE** `/api/admin/users/:id`  
**Access:** Admin only

**Response:**
```json
{
  "ok": true,
  "message": "User deleted successfully"
}
```

**Notes:**
- Cannot delete your own account
- Returns 400 if attempting to delete yourself

## Example Usage

### List all students
```bash
curl -X GET "http://localhost:4000/api/admin/users?role=student" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Search users
```bash
curl -X GET "http://localhost:4000/api/admin/users?q=john" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create a new instructor
```bash
curl -X POST http://localhost:4000/api/admin/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Instructor",
    "email": "jane@example.com",
    "password": "password123",
    "role": "instructor"
  }'
```

### Update user role
```bash
curl -X PUT http://localhost:4000/api/admin/users/USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "instructor"
  }'
```

### Lock subjects for a user
```bash
curl -X PUT http://localhost:4000/api/admin/users/USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lockedSubjects": ["advanced_algorithms", "machine_learning"]
  }'
```

### Reset password
```bash
curl -X POST http://localhost:4000/api/admin/users/USER_ID/reset-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newPassword": "newPassword123"
  }'
```

### Delete user
```bash
curl -X DELETE http://localhost:4000/api/admin/users/USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Missing required fields: name, email, password"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "error": "User not found"
}
```

### 409 Conflict
```json
{
  "error": "Email already in use"
}
```

## Integration Notes

- All endpoints require admin authentication
- Password hashes are never returned in responses
- User deletion is permanent (consider soft delete if needed)
- Subject locking prevents users from starting quizzes on those topics
- Role changes automatically handle studentId requirements

