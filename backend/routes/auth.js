import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { config } from "../config/index.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  const { name, email, password, studentId, role } = req.body;
  if (role && role!=='student') return res.status(403).json({ error: "Only student registration is allowed." });
  if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });
  if (!studentId) return res.status(400).json({ error: "Student ID (Roll No) is required." });
  const existing = await User.findOne({ $or: [ { email }, { studentId } ] });
  if (existing && existing.email === email) return res.status(409).json({ error: "Email already in use" });
  if (existing && existing.studentId === studentId) return res.status(409).json({ error: "Student ID already registered" });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role: "student", studentId });
  return res.json({ id: user._id });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });
  const token = jwt.sign({ _id: user._id, role: user.role, email: user.email, name: user.name }, config.jwtSecret, { expiresIn: "7d" });
  return res.json({ token });
});

// GET /api/me - Get current user profile
router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user._id).select('-passwordHash').lean();
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json(user);
});

// POST /api/auth/proctor-consent - Save proctor consent
router.post("/proctor-consent", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.proctorConsent = true;
    await user.save();
    return res.json({ ok: true, message: "Consent saved" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to save consent: " + error.message });
  }
});

export default router;


