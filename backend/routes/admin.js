import express from "express";
import { auth, requireRole } from "../middleware/auth.js";
import AILog from "../models/AILog.js";
import IssueReport from "../models/IssueReport.js";
import User from "../models/User.js";
import Item from "../models/Item.js";
import GeneratedAssessment from "../models/GeneratedAssessment.js";
import bcrypt from "bcrypt";

const router = express.Router();

// GET /api/admin/students (for instructor dashboard - allows instructors too)
router.get('/students', auth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const students = await User.find({ role: 'student' }).select('name email studentId learnerProfile role').lean();
  res.json(students);
});

// ==================== USER MANAGEMENT ====================
/**
 * GET /api/admin/users
 * List all users with optional filters (admin only)
 */
router.get('/users', auth, requireRole('admin'), async (req, res) => {
  const { role, q, limit = 50, offset = 0 } = req.query;
  const filter = {};
  
  if (role) filter.role = role;
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { studentId: { $regex: q, $options: 'i' } }
    ];
  }

  const users = await User.find(filter)
    .select('-passwordHash')
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit), 100))
    .skip(Number(offset))
    .lean();

  const total = await User.countDocuments(filter);

  res.json({
    users,
    total,
    limit: Number(limit),
    offset: Number(offset)
  });
});

/**
 * GET /api/admin/users/:id
 * Get user details (admin only)
 */
router.get('/users/:id', auth, requireRole('admin'), async (req, res) => {
  const user = await User.findById(req.params.id).select('-passwordHash').lean();
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

/**
 * POST /api/admin/users
 * Create a new user (admin only)
 */
router.post('/users', auth, requireRole('admin'), async (req, res) => {
  const { name, email, password, role = 'student', studentId } = req.body || {};
  
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields: name, email, password' });
  }

  // Validate role
  if (!['student', 'instructor', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be student, instructor, or admin' });
  }

  // Student must have studentId
  if (role === 'student' && !studentId) {
    return res.status(400).json({ error: 'Student ID is required for student role' });
  }

  // Check for existing user
  const existing = await User.findOne({ 
    $or: [
      { email },
      ...(studentId && role === 'student' ? [{ studentId }] : [])
    ]
  });

  if (existing) {
    if (existing.email === email) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    if (existing.studentId === studentId && role === 'student') {
      return res.status(409).json({ error: 'Student ID already registered' });
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    passwordHash,
    role,
    studentId: role === 'student' ? studentId : undefined,
  });

  res.status(201).json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    studentId: user.studentId,
  });
});

/**
 * PUT /api/admin/users/:id
 * Update user (admin only)
 */
router.put('/users/:id', auth, requireRole('admin'), async (req, res) => {
  const { name, email, role, studentId, lockedSubjects } = req.body || {};
  const user = await User.findById(req.params.id);
  
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Update fields
  if (name !== undefined) user.name = name;
  if (email !== undefined) {
    // Check email uniqueness
    const existing = await User.findOne({ email, _id: { $ne: user._id } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });
    user.email = email;
  }
  if (role !== undefined) {
    if (!['student', 'instructor', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    user.role = role;
    // If changing from student, remove studentId requirement
    if (role !== 'student') {
      user.studentId = undefined;
    }
  }
  if (studentId !== undefined && user.role === 'student') {
    // Check studentId uniqueness
    const existing = await User.findOne({ studentId, _id: { $ne: user._id }, role: 'student' });
    if (existing) return res.status(409).json({ error: 'Student ID already in use' });
    user.studentId = studentId;
  }
  if (lockedSubjects !== undefined && Array.isArray(lockedSubjects)) {
    user.lockedSubjects = lockedSubjects;
  }

  await user.save();
  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    studentId: user.studentId,
    lockedSubjects: user.lockedSubjects,
  });
});

/**
 * POST /api/admin/users/:id/reset-password
 * Reset user password (admin only)
 */
router.post('/users/:id/reset-password', auth, requireRole('admin'), async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.json({ ok: true, message: 'Password reset successfully' });
});

/**
 * DELETE /api/admin/users/:id
 * Delete user (admin only)
 */
router.delete('/users/:id', auth, requireRole('admin'), async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Prevent deleting yourself
  if (String(user._id) === String(req.user._id)) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true, message: 'User deleted successfully' });
});

// ==================== ASSESSMENT REPORTS ====================
// These routes must come BEFORE the admin-only middleware to allow instructors
/**
 * GET /api/admin/assessment-reports
 * Get assessment reports with analytics (admin/instructor)
 */
router.get('/assessment-reports', auth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { userId, topic, mode, status, startDate, endDate, limit = 50, offset = 0 } = req.query;
  const AssessmentSession = (await import('../models/AssessmentSession.js')).default;
  const Attempt = (await import('../models/Attempt.js')).default;
  const Item = (await import('../models/Item.js')).default;

  const filter = {};
  if (userId) filter.user = userId;
  if (mode) filter.mode = mode;
  if (status) filter.status = status;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const sessions = await AssessmentSession.find(filter)
    .populate('user', 'name email studentId')
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit), 100))
    .skip(Number(offset))
    .lean();

  // Filter by topic if provided
  let filteredSessions = sessions;
  if (topic) {
    filteredSessions = sessions.filter(s => {
      const topics = s.metadata?.requestedTopics || [];
      return topics.some(t => t.toLowerCase().includes(topic.toLowerCase()));
    });
  }

  // Enrich with attempt data
  const enriched = await Promise.all(
    filteredSessions.map(async (session) => {
      const attempts = await Attempt.find({ session: session._id }).lean();
      const items = await Item.find({ _id: { $in: session.itemIds || [] } }).lean();
      
      const correctCount = attempts.filter(a => a.isCorrect).length;
      const totalItems = session.itemIds?.length || 0;
      const avgTime = attempts.length > 0
        ? Math.round(attempts.reduce((sum, a) => sum + (a.timeTakenMs || 0), 0) / attempts.length)
        : 0;

      return {
        ...session,
        _id: String(session._id),
        userId: String(session.user?._id || session.user),
        userName: session.user?.name || 'Unknown',
        userEmail: session.user?.email || '',
        studentId: session.user?.studentId || '',
        totalItems,
        correctCount,
        incorrectCount: attempts.filter(a => !a.isCorrect).length,
        unansweredCount: totalItems - attempts.length,
        avgTimeMs: avgTime,
        proctorViolations: session.proctorSummary?.totalViolations || 0,
        proctorRiskScore: session.proctorSummary?.riskScore || 0,
        invalidated: session.invalidated || false,
      };
    })
  );

  const total = await AssessmentSession.countDocuments(filter);

  res.json({
    reports: enriched,
    total,
    limit: Number(limit),
    offset: Number(offset),
  });
});

/**
 * GET /api/admin/assessment-reports/stats
 * Get aggregated assessment statistics (admin/instructor)
 */
router.get('/assessment-reports/stats', auth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { startDate, endDate } = req.query;
  const AssessmentSession = (await import('../models/AssessmentSession.js')).default;
  const Attempt = (await import('../models/Attempt.js')).default;

  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  const sessions = await AssessmentSession.find(dateFilter).lean();
  const allAttempts = await Attempt.find({
    session: { $in: sessions.map(s => s._id) }
  }).lean();

  // Calculate statistics
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(s => s.status === 'completed').length;
  const invalidatedSessions = sessions.filter(s => s.invalidated).length;
  const proctoredSessions = sessions.filter(s => s.proctored).length;

  const totalAttempts = allAttempts.length;
  const correctAttempts = allAttempts.filter(a => a.isCorrect).length;
  const avgScore = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + (s.score || 0), 0) / sessions.length)
    : 0;

  // Group by mode
  const byMode = {};
  sessions.forEach(s => {
    const mode = s.mode || 'formative';
    if (!byMode[mode]) {
      byMode[mode] = { count: 0, totalScore: 0, completed: 0 };
    }
    byMode[mode].count++;
    byMode[mode].totalScore += s.score || 0;
    if (s.status === 'completed') byMode[mode].completed++;
  });

  const modeStats = Object.entries(byMode).map(([mode, data]) => ({
    mode,
    count: data.count,
    avgScore: Math.round(data.totalScore / data.count),
    completed: data.completed,
  }));

  // Group by topic
  const byTopic = {};
  sessions.forEach(s => {
    const topics = s.metadata?.requestedTopics || [];
    topics.forEach(topic => {
      if (!byTopic[topic]) {
        byTopic[topic] = { count: 0, totalScore: 0, completed: 0 };
      }
      byTopic[topic].count++;
      byTopic[topic].totalScore += s.score || 0;
      if (s.status === 'completed') byTopic[topic].completed++;
    });
  });

  const topicStats = Object.entries(byTopic)
    .map(([topic, data]) => ({
      topic,
      count: data.count,
      avgScore: Math.round(data.totalScore / data.count),
      completed: data.completed,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  res.json({
    overview: {
      totalSessions,
      completedSessions,
      invalidatedSessions,
      proctoredSessions,
      totalAttempts,
      correctAttempts,
      avgScore,
      accuracy: totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0,
    },
    byMode: modeStats,
    byTopic: topicStats,
  });
});

/**
 * GET /api/admin/assessment-reports/:sessionId
 * Get detailed report for a specific assessment session (admin/instructor)
 */
router.get('/assessment-reports/:sessionId', auth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const AssessmentSession = (await import('../models/AssessmentSession.js')).default;
  const Attempt = (await import('../models/Attempt.js')).default;
  const Item = (await import('../models/Item.js')).default;
  const ProctorLog = (await import('../models/ProctorLog.js')).default;

  const session = await AssessmentSession.findById(req.params.sessionId)
    .populate('user', 'name email studentId')
    .lean();

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const attempts = await Attempt.find({ session: session._id }).sort({ createdAt: 1 }).lean();
  const items = await Item.find({ _id: { $in: session.itemIds || [] } }).lean();
  const proctorLogs = await ProctorLog.find({ session: session._id })
    .sort({ timestamp: 1 })
    .lean();

  const idToItem = new Map(items.map(i => [String(i._id), i]));

  const results = (session.itemIds || []).map((id, idx) => {
    const item = idToItem.get(String(id));
    const attempt = attempts.find(a => String(a.item) === String(id)) || null;
    return {
      index: idx,
      itemId: String(id),
      question: item?.question || '',
      type: item?.type || 'mcq',
      choices: item?.choices || [],
      correctAnswer: item?.answer || '',
      explanation: item?.explanation || '',
      topics: item?.topics || [],
      difficulty: item?.difficulty,
      bloom: item?.bloom,
      attempt: attempt ? {
        isCorrect: attempt.isCorrect,
        userAnswer: attempt.userAnswer,
        score: attempt.score || 0,
        timeTakenMs: attempt.timeTakenMs,
        createdAt: attempt.createdAt,
        gradingDetails: attempt.gradingDetails,
        explanation: attempt.explanation || item?.explanation,
      } : null,
    };
  });

  res.json({
    session: {
      _id: String(session._id),
      user: {
        _id: String(session.user?._id || session.user),
        name: session.user?.name || 'Unknown',
        email: session.user?.email || '',
        studentId: session.user?.studentId || '',
      },
      mode: session.mode,
      status: session.status,
      score: session.score || 0,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
      metadata: session.metadata || {},
      proctored: session.proctored || false,
      proctorSummary: session.proctorSummary || {},
      invalidated: session.invalidated || false,
      total: session.itemIds?.length || 0,
    },
    statistics: {
      total: session.itemIds?.length || 0,
      correct: attempts.filter(a => a.isCorrect).length,
      incorrect: attempts.filter(a => !a.isCorrect).length,
      unanswered: (session.itemIds?.length || 0) - attempts.length,
      accuracy: (session.itemIds?.length || 0) > 0
        ? Math.round((attempts.filter(a => a.isCorrect).length / (session.itemIds?.length || 1)) * 100)
        : 0,
      score: session.score || 0,
    },
    results,
    proctorLogs: proctorLogs.map(log => ({
      _id: String(log._id),
      violationType: log.violationType,
      severity: log.severity,
      details: log.details,
      timestamp: log.timestamp,
    })),
  });
});

router.use(auth, requireRole('admin'));
// GET /api/admin/ai-logs
router.get('/ai-logs', async (req, res) => {
  const { userId, role, endpoint, status, model, q, limit=50 } = req.query;
  const filter = {};
  if (userId) filter.userId = userId;
  if (role) filter.role = role;
  if (endpoint) filter.endpoint = endpoint;
  if (status) filter.status = status;
  if (model) filter.model = model;
  if (q) filter.userName = { $regex: q, $options: 'i' };
  const logs = await AILog.find(filter).sort({timestamp:-1}).limit(Math.min(Number(limit), 200)).lean();
  res.json(logs);
});
// GET /api/admin/ai-usage-stats
router.get('/ai-usage-stats', async (req, res) => {
  const now = new Date();
  const last7 = new Date(now.getTime()-7*864e5);
  const all = await AILog.find({ timestamp: { $gte: last7 } }).lean();
  // aggregate
  const aiCallsToday = all.filter(r => r.timestamp > new Date(now.getTime()-864e5)).length;
  const callsLast7d = all.length;
  const errorRate = (all.filter(r => r.status==='error').length/(callsLast7d||1));
  const userMap = {};
  const endpointMap = { };
  const topicMap = {};
  for (const item of all) {
    userMap[item.userName] = (userMap[item.userName]||0)+1;
    endpointMap[item.endpoint] = (endpointMap[item.endpoint]||0)+1;
    if(item.params && item.params.topic) topicMap[item.params.topic] = (topicMap[item.params.topic]||0)+1;
  }
  function top(map) { return Object.entries(map).sort((a,b)=>b[1]-a[1])[0]?.[0]||'' }
  res.json({
    aiCallsToday, callsLast7d, errorRate, 
    topUser: top(userMap),
    topEndpoint: top(endpointMap),
    topTopic: top(topicMap)
  });
});
// GET /api/admin/reports
router.get('/reports', async (req, res) => {
  const { reportedBy, role, panel, section, status='open', limit=100 } = req.query;
  const filter = {};
  if (reportedBy) filter.reportedBy = reportedBy;
  if (role) filter.role = role;
  if (panel) filter.panel = panel;
  if (section) filter.section = section;
  if (status) filter.status = status;
  const reports = await IssueReport.find(filter).sort({createdAt:-1}).limit(Math.min(Number(limit),200)).lean();
  res.json(reports);
});
// POST /api/admin/reports/:id/respond
router.post('/reports/:id/respond', async (req, res) => {
  const { response } = req.body;
  const report = await IssueReport.findById(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  report.adminResponse = response;
  report.status = 'closed';
  await report.save();
  res.json({ ok: true });
});

// Subject management (admin/instructor only)
router.post('/students/:id/subjects', auth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { subject } = req.body;
  if (!subject || typeof subject !== 'string') return res.status(400).json({ error: 'Invalid subject' });
  const student = await User.findById(req.params.id);
  if (!student || student.role !== 'student') return res.status(404).json({ error: 'Not found' });
  if (!student.learnerProfile) student.learnerProfile = {};
  if (!student.learnerProfile.topics) student.learnerProfile.topics = new Map();
  const isMap = student.learnerProfile.topics instanceof Map;
  if ((isMap && student.learnerProfile.topics.has(subject)) || (!isMap && Object.hasOwn(student.learnerProfile.topics, subject))) {
    return res.status(200).json({ message: 'Subject already exists.' });
  }
  const defaultObj = { mastery: 0, attempts: 0, streak: 0, timeOnTask: 0 };
  if (isMap) student.learnerProfile.topics.set(subject, defaultObj);
  else student.learnerProfile.topics[subject] = defaultObj;
  await student.save();
  res.json({ ok: true });
});

router.delete('/students/:id/subjects/:subject', auth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { id, subject } = req.params;
  const student = await User.findById(id);
  if (!student || student.role !== 'student') return res.status(404).json({ error: 'Not found' });
  if (!student.learnerProfile?.topics) return res.status(404).json({ error: 'Subject list empty.' });
  const isMap = student.learnerProfile.topics instanceof Map;
  if (isMap) student.learnerProfile.topics.delete(subject);
  else delete student.learnerProfile.topics[subject];
  await student.save();
  res.json({ ok: true });
});

router.get('/students/:id/subjects', auth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const student = await User.findById(req.params.id);
  if (!student || student.role !== 'student') return res.status(404).json({ error: 'Not found' });
  let topics = student.learnerProfile?.topics;
  if (!topics) return res.json([]);
  if (topics instanceof Map) topics = Array.from(topics.keys());
  else topics = Object.keys(topics);
  res.json(topics);
});

// ==================== BULK UPLOAD ====================
/**
 * POST /api/admin/import/items
 * Mass import items from JSON (admin/instructor)
 */
router.post('/import/items', auth, requireRole('admin', 'instructor'), async (req, res) => {
  const { source = 'manual_import', items = [] } = req.body || {};
  
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items must be a non-empty array' });
  }

  const inserted = [];
  const failed = [];
  const errors = [];

  for (let i = 0; i < items.length; i++) {
    const itemData = items[i];
    try {
      // Validate required fields
      if (!itemData.type || !itemData.question || itemData.answer === undefined) {
        throw new Error('Missing required fields: type, question, answer');
      }

      // Validate type enum
      const validTypes = ['mcq', 'fill_blank', 'short_answer', 'match', 'reorder'];
      if (!validTypes.includes(itemData.type)) {
        throw new Error(`Invalid type: ${itemData.type}. Must be one of: ${validTypes.join(', ')}`);
      }

      // Set default gradingMethod if not provided
      let gradingMethod = itemData.gradingMethod;
      if (!gradingMethod) {
        if (itemData.type === 'mcq') gradingMethod = 'exact';
        else if (itemData.type === 'fill_blank') gradingMethod = 'levenshtein';
        else if (itemData.type === 'short_answer') gradingMethod = 'semantic';
        else if (itemData.type === 'match') gradingMethod = 'pair_match';
        else if (itemData.type === 'reorder') gradingMethod = 'sequence_check';
      }

      // Create item document
      const item = await Item.create({
        type: itemData.type,
        question: itemData.question,
        choices: itemData.choices || [],
        answer: itemData.answer,
        gradingMethod,
        difficulty: itemData.difficulty || 2,
        bloom: itemData.bloom || 'remember',
        topics: itemData.topics || [],
        hints: itemData.hints || [],
        explanation: itemData.explanation || '',
        createdBy: req.user._id,
        aiGenerated: false,
      });

      inserted.push(item._id);
    } catch (error) {
      failed.push(i);
      errors.push({
        index: i,
        error: error.message || 'Unknown error',
        item: itemData,
      });
    }
  }

  return res.json({
    inserted: inserted.length,
    failed: failed.length,
    total: items.length,
    errors: errors.length > 0 ? errors : undefined,
  });
});

/**
 * POST /api/admin/user/:id/lock-subject
 * Lock a subject for a user
 */
router.post('/user/:id/lock-subject', auth, requireRole('admin'), async (req, res) => {
  const { subjectCode } = req.body || {};
  if (!subjectCode || typeof subjectCode !== 'string') {
    return res.status(400).json({ error: 'subjectCode is required' });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (!user.lockedSubjects) user.lockedSubjects = [];
  if (!user.lockedSubjects.includes(subjectCode)) {
    user.lockedSubjects.push(subjectCode);
    await user.save();
  }

  return res.json({ ok: true, lockedSubjects: user.lockedSubjects });
});

/**
 * DELETE /api/admin/user/:id/lock-subject/:subjectCode
 * Unlock a subject for a user
 */
router.delete('/user/:id/lock-subject/:subjectCode', auth, requireRole('admin'), async (req, res) => {
  const { id, subjectCode } = req.params;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.lockedSubjects && user.lockedSubjects.includes(subjectCode)) {
    user.lockedSubjects = user.lockedSubjects.filter(s => s !== subjectCode);
    await user.save();
  }

  return res.json({ ok: true, lockedSubjects: user.lockedSubjects || [] });
});

/**
 * POST /api/admin/import/assessments
 * Mass import generated assessments from JSON (admin/instructor)
 */
router.post('/import/assessments', auth, requireRole('admin', 'instructor'), async (req, res) => {
  const { source = 'manual_import', assessments = [] } = req.body || {};
  
  if (!Array.isArray(assessments) || assessments.length === 0) {
    return res.status(400).json({ error: 'assessments must be a non-empty array' });
  }

  const inserted = [];
  const failed = [];
  const errors = [];

  for (let i = 0; i < assessments.length; i++) {
    const assessmentData = assessments[i];
    try {
      // Validate required fields
      if (!assessmentData.topic) {
        throw new Error('Missing required field: topic');
      }

      // Validate items array if provided
      let parsedItems = [];
      if (assessmentData.items && Array.isArray(assessmentData.items)) {
        // Validate each item in the assessment
        for (const itemData of assessmentData.items) {
          if (!itemData.type || !itemData.question || itemData.answer === undefined) {
            throw new Error('Invalid item: missing type, question, or answer');
          }
          parsedItems.push(itemData);
        }
      }

      // Create GeneratedAssessment document
      const assessment = await GeneratedAssessment.create({
        topic: assessmentData.topic,
        title: assessmentData.title || `${assessmentData.topic} Assessment`,
        prompt: assessmentData.prompt || `Bulk imported assessment for ${assessmentData.topic}`,
        sourceModel: assessmentData.sourceModel || 'manual_import',
        seedId: assessmentData.seedId || `bulk_${Date.now()}_${i}`,
        items: parsedItems,
        validated: parsedItems.length > 0,
        status: assessmentData.status || 'draft',
        createdBy: req.user._id,
        proctored: assessmentData.proctored || false,
        proctorConfig: assessmentData.proctorConfig || {},
      });

      // If status is published and we have items, create Item documents
      if (assessment.status === 'published' && parsedItems.length > 0) {
        const itemDocs = await Item.insertMany(
          parsedItems.map((p) => ({
            type: p.type || 'mcq',
            questionType: p.questionType || p.type || 'mcq',
            question: p.question,
            choices: p.choices || [],
            answer: p.answer,
            gradingMethod: p.gradingMethod || (p.type === 'mcq' ? 'exact' : p.type === 'fill_blank' ? 'levenshtein' : p.type === 'short_answer' ? 'semantic' : p.type === 'match' ? 'pair_match' : 'sequence_check'),
            difficulty: p.difficulty || 2,
            bloom: p.bloom || 'remember',
            cognitiveLevel: p.cognitiveLevel || p.bloom || 'remember',
            topics: p.topics && p.topics.length ? p.topics : [assessmentData.topic],
            skills: p.skills || [],
            hints: p.hints || [],
            explanation: p.explanation || '',
            createdBy: req.user._id,
            seedId: p.id || `bulk_${assessment._id}_${Date.now()}_${parsedItems.indexOf(p)}`,
            aiGenerated: false,
          }))
        );
        
        assessment.linkedItemIds = itemDocs.map(d => d._id);
        assessment.publishedAt = new Date();
        assessment.publishedBy = req.user._id;
        await assessment.save();
      }

      inserted.push(assessment._id);
    } catch (error) {
      failed.push(i);
      errors.push({
        index: i,
        error: error.message || 'Unknown error',
        assessment: assessmentData,
      });
    }
  }

  return res.json({
    inserted: inserted.length,
    failed: failed.length,
    total: assessments.length,
    errors: errors.length > 0 ? errors : undefined,
  });
});

/**
 * POST /api/admin/import/subject
 * Bulk import items and quizzes for a specific subject (admin/instructor)
 */
router.post('/import/subject', auth, requireRole('admin', 'instructor'), async (req, res) => {
  const { subject, items = [], quizzes = [] } = req.body || {};
  
  if (!subject || typeof subject !== 'string') {
    return res.status(400).json({ error: 'subject is required' });
  }

  const results = {
    items: { inserted: 0, failed: 0, errors: [] },
    quizzes: { inserted: 0, failed: 0, errors: [] },
  };

  // Import items for this subject
  if (Array.isArray(items) && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const itemData = items[i];
      try {
        if (!itemData.type || !itemData.question || itemData.answer === undefined) {
          throw new Error('Missing required fields');
        }

        const validTypes = ['mcq', 'fill_blank', 'short_answer', 'match', 'reorder'];
        if (!validTypes.includes(itemData.type)) {
          throw new Error(`Invalid type: ${itemData.type}`);
        }

        let gradingMethod = itemData.gradingMethod;
        if (!gradingMethod) {
          if (itemData.type === 'mcq') gradingMethod = 'exact';
          else if (itemData.type === 'fill_blank') gradingMethod = 'levenshtein';
          else if (itemData.type === 'short_answer') gradingMethod = 'semantic';
          else if (itemData.type === 'match') gradingMethod = 'pair_match';
          else if (itemData.type === 'reorder') gradingMethod = 'sequence_check';
        }

        // Ensure subject is in topics array
        const topics = itemData.topics || [];
        if (!topics.includes(subject)) {
          topics.push(subject);
        }

        await Item.create({
          type: itemData.type,
          question: itemData.question,
          choices: itemData.choices || [],
          answer: itemData.answer,
          gradingMethod,
          difficulty: itemData.difficulty || 2,
          bloom: itemData.bloom || 'remember',
          topics,
          hints: itemData.hints || [],
          explanation: itemData.explanation || '',
          createdBy: req.user._id,
          aiGenerated: false,
        });
        results.items.inserted++;
      } catch (error) {
        results.items.failed++;
        results.items.errors.push({ index: i, error: error.message, item: itemData });
      }
    }
  }

  // Import assessments for this subject
  if (Array.isArray(quizzes) && quizzes.length > 0) {
    for (let i = 0; i < quizzes.length; i++) {
      const assessmentData = quizzes[i];
      try {
        // Override topic with subject
        const topic = subject;
        
        let parsedItems = [];
        if (assessmentData.items && Array.isArray(assessmentData.items)) {
          parsedItems = assessmentData.items.map(item => ({
            ...item,
            topics: item.topics && item.topics.length ? [...item.topics, subject] : [subject],
          }));
        }

        const assessment = await GeneratedAssessment.create({
          topic,
          title: assessmentData.title || `${subject} Assessment`,
          prompt: assessmentData.prompt || `Bulk imported assessment for ${subject}`,
          sourceModel: assessmentData.sourceModel || 'manual_import',
          seedId: assessmentData.seedId || `bulk_${subject}_${Date.now()}_${i}`,
          items: parsedItems,
          validated: parsedItems.length > 0,
          status: assessmentData.status || 'draft',
          createdBy: req.user._id,
          proctored: assessmentData.proctored || false,
          proctorConfig: assessmentData.proctorConfig || {},
        });

        // Auto-publish if status is published
        if (assessment.status === 'published' && parsedItems.length > 0) {
          const itemDocs = await Item.insertMany(
            parsedItems.map((p) => ({
              type: p.type || 'mcq',
              questionType: p.questionType || p.type || 'mcq',
              question: p.question,
              choices: p.choices || [],
              answer: p.answer,
              gradingMethod: p.gradingMethod || (p.type === 'mcq' ? 'exact' : p.type === 'fill_blank' ? 'levenshtein' : p.type === 'short_answer' ? 'semantic' : p.type === 'match' ? 'pair_match' : 'sequence_check'),
              difficulty: p.difficulty || 2,
              bloom: p.bloom || 'remember',
              cognitiveLevel: p.cognitiveLevel || p.bloom || 'remember',
              topics: p.topics && p.topics.length ? p.topics : [subject],
              skills: p.skills || [],
              hints: p.hints || [],
              explanation: p.explanation || '',
              createdBy: req.user._id,
              seedId: p.id || `bulk_${assessment._id}_${Date.now()}_${parsedItems.indexOf(p)}`,
              aiGenerated: false,
            }))
          );
          
          assessment.linkedItemIds = itemDocs.map(d => d._id);
          assessment.publishedAt = new Date();
          assessment.publishedBy = req.user._id;
          await assessment.save();
        }

        results.quizzes.inserted++;
      } catch (error) {
        results.quizzes.failed++;
        results.quizzes.errors.push({ index: i, error: error.message, assessment: assessmentData });
      }
    }
  }

  return res.json({
    subject,
    summary: {
      items: { total: items.length, ...results.items },
      quizzes: { total: quizzes.length, ...results.quizzes },
    },
    errors: [
      ...(results.items.errors.length > 0 ? [{ type: 'items', errors: results.items.errors }] : []),
      ...(results.quizzes.errors.length > 0 ? [{ type: 'quizzes', errors: results.quizzes.errors }] : []),
    ],
  });
});

/**
 * POST /api/admin/import/bulk
 * Bulk import multiple types (items, quizzes, users) in one request (admin only)
 */
router.post('/import/bulk', auth, requireRole('admin'), async (req, res) => {
  const { items = [], quizzes = [], users = [] } = req.body || {};
  
  const results = {
    items: { inserted: 0, failed: 0, errors: [] },
    quizzes: { inserted: 0, failed: 0, errors: [] },
    users: { inserted: 0, failed: 0, errors: [] },
  };

  // Import items
  if (Array.isArray(items) && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const itemData = items[i];
      try {
        if (!itemData.type || !itemData.question || itemData.answer === undefined) {
          throw new Error('Missing required fields');
        }

        const validTypes = ['mcq', 'fill_blank', 'short_answer', 'match', 'reorder'];
        if (!validTypes.includes(itemData.type)) {
          throw new Error(`Invalid type: ${itemData.type}`);
        }

        let gradingMethod = itemData.gradingMethod;
        if (!gradingMethod) {
          if (itemData.type === 'mcq') gradingMethod = 'exact';
          else if (itemData.type === 'fill_blank') gradingMethod = 'levenshtein';
          else if (itemData.type === 'short_answer') gradingMethod = 'semantic';
          else if (itemData.type === 'match') gradingMethod = 'pair_match';
          else if (itemData.type === 'reorder') gradingMethod = 'sequence_check';
        }

        await Item.create({
          type: itemData.type,
          question: itemData.question,
          choices: itemData.choices || [],
          answer: itemData.answer,
          gradingMethod,
          difficulty: itemData.difficulty || 2,
          bloom: itemData.bloom || 'remember',
          topics: itemData.topics || [],
          hints: itemData.hints || [],
          explanation: itemData.explanation || '',
          createdBy: req.user._id,
          aiGenerated: false,
        });
        results.items.inserted++;
      } catch (error) {
        results.items.failed++;
        results.items.errors.push({ index: i, error: error.message, item: itemData });
      }
    }
  }

  // Import assessments
  if (Array.isArray(quizzes) && quizzes.length > 0) {
    for (let i = 0; i < quizzes.length; i++) {
      const assessmentData = quizzes[i];
      try {
        if (!assessmentData.topic) throw new Error('Missing topic');

        let parsedItems = [];
        if (assessmentData.items && Array.isArray(assessmentData.items)) {
          parsedItems = assessmentData.items;
        }

        await GeneratedAssessment.create({
          topic: assessmentData.topic,
          title: assessmentData.title || `${assessmentData.topic} Assessment`,
          prompt: assessmentData.prompt || `Bulk imported assessment for ${assessmentData.topic}`,
          sourceModel: assessmentData.sourceModel || 'manual_import',
          seedId: assessmentData.seedId || `bulk_${Date.now()}_${i}`,
          items: parsedItems,
          validated: parsedItems.length > 0,
          status: assessmentData.status || 'draft',
          createdBy: req.user._id,
        });
        results.quizzes.inserted++;
      } catch (error) {
        results.quizzes.failed++;
        results.quizzes.errors.push({ index: i, error: error.message, assessment: assessmentData });
      }
    }
  }

  // Import users (bulk user creation)
  if (Array.isArray(users) && users.length > 0) {
    for (let i = 0; i < users.length; i++) {
      const userData = users[i];
      try {
        if (!userData.name || !userData.email || !userData.password) {
          throw new Error('Missing required fields: name, email, password');
        }

        const role = userData.role || 'student';
        if (role === 'student' && !userData.studentId) {
          throw new Error('Student ID required for student role');
        }

        const existing = await User.findOne({ 
          $or: [
            { email: userData.email },
            ...(userData.studentId && role === 'student' ? [{ studentId: userData.studentId }] : [])
          ]
        });

        if (existing) {
          throw new Error('User already exists');
        }

        const passwordHash = await bcrypt.hash(userData.password, 10);
        await User.create({
          name: userData.name,
          email: userData.email,
          passwordHash,
          role,
          studentId: role === 'student' ? userData.studentId : undefined,
        });
        results.users.inserted++;
      } catch (error) {
        results.users.failed++;
        results.users.errors.push({ index: i, error: error.message, user: { ...userData, password: '[REDACTED]' } });
      }
    }
  }

  return res.json({
    summary: {
      items: { total: items.length, ...results.items },
      quizzes: { total: quizzes.length, ...results.quizzes },
      users: { total: users.length, ...results.users },
    },
    errors: [
      ...(results.items.errors.length > 0 ? [{ type: 'items', errors: results.items.errors }] : []),
      ...(results.quizzes.errors.length > 0 ? [{ type: 'quizzes', errors: results.quizzes.errors }] : []),
      ...(results.users.errors.length > 0 ? [{ type: 'users', errors: results.users.errors }] : []),
    ],
  });
});

export default router;
