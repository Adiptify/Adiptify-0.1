import express from "express";
import { auth } from "../middleware/auth.js";
import { generateLearningModule, webSearch, webFetch } from "../services/webSearchService.js";
import User from "../models/User.js";

const router = express.Router();

function dedupeWebResults(results) {
  const seen = new Set();
  const usedDomains = new Set();
  const deduped = [];
  for (const r of results) {
    const key = (r.url || "") + "::" + (r.title || "");
    const domain = r.url?.match(/^https?:\/\/(?:www\.)?([^\/]+)/)?.[1] || "unknown";
    if (!domain || usedDomains.has(domain)) continue; // 1 per domain
    if (r.title && r.url && !seen.has(key)) {
      deduped.push(r);
      seen.add(key);
      usedDomains.add(domain);
    }
  }
  return deduped;
}

// Updated module route: prefer GFG, fetch/extract content and return as Markdown
router.get("/module/:topic", auth, async (req, res) => {
  try {
    const topic = decodeURIComponent(req.params.topic);
    const searchResults = await webSearch(topic, 8, 'geeksforgeeks.org');
    // pick best result from geeksforgeeks
    const gfg = searchResults.find(r => r.url && r.url.includes("geeksforgeeks.org"));
    let markdown = '', url = '', title = '';
    if (gfg && gfg.url) {
      const fetched = await webFetch(gfg.url);
      markdown = (fetched.content || gfg.content || '');
      title = fetched.title || gfg.title || topic;
      url = gfg.url;
    }
    // If nothing, fallback to AI summary
    if (!markdown) {
      const ai = await generateLearningModule(topic, true);
      markdown = ai.content;
    }
    // Clean up markdown (ensure minimal wrapping)
    if (!/^#/.test(markdown.trim())) markdown = `# ${title || topic}\n\n` + markdown;
    // Add extra: always return 'resources' (top 3 GFG + top 2 other links)
    const topGfgs = searchResults.filter(r=>r.url?.includes('geeksforgeeks.org')).slice(0,3);
    const others = searchResults.filter(r=>!r.url?.includes('geeksforgeeks.org')).slice(0,2);
    res.json({
      topic,
      content: markdown,
      mainUrl: url,
      resources: [...topGfgs, ...others].map(r=>({ title: r.title, url: r.url })),
      provider: gfg ? 'geeksforgeeks' : 'ai',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/learning/search - Search for learning resources
router.post("/search", auth, async (req, res) => {
  try {
    const { query, maxResults = 5 } = req.body || {};
    if (!query) return res.status(400).json({ error: "Query required" });
    const results = await webSearch(query, maxResults);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/learning/fetch - Fetch web page content
router.post("/fetch", auth, async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: "URL required" });
    const content = await webFetch(url);
    res.json(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Student self-adds new subject
router.post("/subject", auth, async (req, res) => {
  const { subject } = req.body;
  if (!subject || typeof subject !== 'string') return res.status(400).json({ error: 'Invalid subject' });
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (!user.learnerProfile) user.learnerProfile = {};
  if (!user.learnerProfile.topics) user.learnerProfile.topics = new Map();
  const isMap = user.learnerProfile.topics instanceof Map;
  if ((isMap && user.learnerProfile.topics.has(subject)) || (!isMap && Object.hasOwn(user.learnerProfile.topics, subject))) {
    return res.status(200).json({ message: 'Subject already exists.' });
  }
  const defaultObj = { mastery: 0, attempts: 0, streak: 0, timeOnTask: 0 };
  if (isMap) user.learnerProfile.topics.set(subject, defaultObj);
  else user.learnerProfile.topics[subject] = defaultObj;
  await user.save();
  res.json({ ok: true });
});

// Get ALL subjects used in the system (union of all students' topics)
router.get('/subjects', auth, async (req, res) => {
  // (Optionally make this admin-only)
  const all = await User.find({ role: 'student' }).select('learnerProfile.topics').lean();
  const subSet = new Set();
  for (const u of all) {
    let topics = u.learnerProfile?.topics;
    if (!topics) continue;
    if (topics instanceof Map) for (const k of topics.keys()) subSet.add(k);
    else for (const k of Object.keys(topics)) subSet.add(k);
  }
  res.json(Array.from(subSet));
});

// Get my subjects (the current student's topics)
router.get('/mysubjects', auth, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json([]);
  let topics = user.learnerProfile?.topics;
  if (!topics) return res.json([]);
  let arr = topics instanceof Map ? Array.from(topics.keys()) : Object.keys(topics);
  res.json(arr);
});

export default router;

