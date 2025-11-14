import express from "express";
import { auth } from "../middleware/auth.js";
import { updateSummary, getSessionLogs, overrideSession } from "../services/proctorService.js";
import AssessmentSession from "../models/AssessmentSession.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

/**
 * POST /api/proctor/event
 * Log a proctor violation event
 */
router.post("/event", auth, async (req, res) => {
  const { sessionId, violationType, details = "" } = req.body || {};
  
  if (!sessionId || !violationType) {
    return res.status(400).json({ error: "sessionId and violationType are required" });
  }

  // Verify session belongs to user
  const session = await AssessmentSession.findById(sessionId);
  if (!session || String(session.user) !== String(req.user._id)) {
    return res.status(404).json({ error: "Session not found" });
  }

  if (!session.proctored) {
    return res.status(400).json({ error: "Session is not proctored" });
  }

  try {
    const result = await updateSummary(sessionId, violationType, null, details);
    return res.status(201).json({
      ok: true,
      logId: result.logId,
      proctorSummary: result.proctorSummary,
      invalidated: result.invalidated,
      status: result.status,
    });
  } catch (error) {
    console.error("Proctor event error:", error);
    return res.status(500).json({ error: error.message || "Failed to log proctor event" });
  }
});

/**
 * GET /api/proctor/session/:sessionId/logs
 * Get proctor logs for a session (instructor/admin only)
 */
router.get("/session/:sessionId/logs", auth, async (req, res) => {
  const { sessionId } = req.params;
  const { limit = 50, offset = 0, violationType, severity } = req.query;

  // Verify session exists
  const session = await AssessmentSession.findById(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  // Check permissions: user must own session OR be instructor/admin
  const isOwner = String(session.user) === String(req.user._id);
  const isInstructorOrAdmin = req.user.role === "instructor" || req.user.role === "admin";

  if (!isOwner && !isInstructorOrAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const logs = await getSessionLogs(sessionId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      violationType,
      severity,
    });

    return res.json({
      sessionId,
      logs,
      total: logs.length,
    });
  } catch (error) {
    console.error("Get proctor logs error:", error);
    return res.status(500).json({ error: error.message || "Failed to get logs" });
  }
});

/**
 * POST /api/proctor/session/:sessionId/override
 * Override session invalidation (instructor/admin only)
 */
router.post("/session/:sessionId/override", auth, requireRole("instructor", "admin"), async (req, res) => {
  const { sessionId } = req.params;
  const { action, reason } = req.body || {};

  if (!action || !["invalidate", "restore"].includes(action)) {
    return res.status(400).json({ error: "action must be 'invalidate' or 'restore'" });
  }

  if (!reason || typeof reason !== "string") {
    return res.status(400).json({ error: "reason is required" });
  }

  try {
    const updatedSession = await overrideSession(sessionId, action, reason, req.user._id);
    return res.json({
      ok: true,
      session: {
        _id: updatedSession._id,
        status: updatedSession.status,
        invalidated: updatedSession.invalidated,
        proctorSummary: updatedSession.proctorSummary,
      },
    });
  } catch (error) {
    console.error("Override session error:", error);
    return res.status(500).json({ error: error.message || "Failed to override session" });
  }
});

/**
 * GET /api/proctor/session/:sessionId/summary
 * Get proctor summary for a session
 */
router.get("/session/:sessionId/summary", auth, async (req, res) => {
  const { sessionId } = req.params;

  const session = await AssessmentSession.findById(sessionId).select("proctorSummary proctorConfig invalidated status").lean();
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  // Check permissions
  const isOwner = String(session.user) === String(req.user._id);
  const isInstructorOrAdmin = req.user.role === "instructor" || req.user.role === "admin";

  if (!isOwner && !isInstructorOrAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  return res.json({
    sessionId,
    proctorSummary: session.proctorSummary || {},
    proctorConfig: session.proctorConfig || {},
    invalidated: session.invalidated || false,
    status: session.status,
  });
});

export default router;

