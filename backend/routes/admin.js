import express from "express";
import { auth, requireRole } from "../middleware/auth.js";
import AILog from "../models/AILog.js";
import IssueReport from "../models/IssueReport.js";
import User from "../models/User.js";

const router = express.Router();

// GET /api/admin/students (for instructor dashboard - allows instructors too)
router.get('/students', auth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const students = await User.find({ role: 'student' }).select('name email studentId learnerProfile role').lean();
  res.json(students);
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

export default router;
