import ProctorLog from "../models/ProctorLog.js";
import AssessmentSession from "../models/AssessmentSession.js";

const PROCTOR_RISK_THRESHOLD = parseInt(process.env.PROCTOR_RISK_THRESHOLD) || 20;
const ALLOW_TAB_SWITCHES_DEFAULT = parseInt(process.env.ALLOW_TAB_SWITCHES_DEFAULT) || 2;

/**
 * Update proctor summary when a violation occurs
 * @param {string} sessionId - Quiz session ID
 * @param {string} violationType - Type of violation (tab_switch, copy_attempt, etc.)
 * @param {string} severity - "minor" or "major" (will be auto-determined for tab_switch)
 * @param {string} details - Additional details about the violation
 * @returns {Promise<Object>} Updated proctor summary
 */
export async function updateSummary(sessionId, violationType, severity = null, details = "") {
  const session = await AssessmentSession.findById(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  // Determine severity based on violation type and context
  let finalSeverity = severity;
  if (!finalSeverity) {
    // Auto-determine severity: devtools_opened and page_exit_attempt are always major
    if (violationType === "devtools_opened" || violationType === "page_exit_attempt") {
      finalSeverity = "major";
    } else if (violationType === "tab_switch") {
      // Check tab switch count - if already at limit, next switch is major
      const currentTabSwitchCount = session.proctorSummary?.tabSwitchCount || 0;
      const allowTabSwitchCount = session.proctorConfig?.allowTabSwitchCount || ALLOW_TAB_SWITCHES_DEFAULT;
      
      if (currentTabSwitchCount >= allowTabSwitchCount) {
        finalSeverity = "major"; // Exceeded allowed switches
      } else {
        finalSeverity = "minor";
      }
    } else {
      finalSeverity = "minor"; // Default to minor
    }
  }

  // Create ProctorLog entry
  const log = await ProctorLog.create({
    session: sessionId,
    user: session.user,
    violationType,
    severity: finalSeverity,
    details,
    timestamp: new Date(),
  });

  // Update session proctor summary atomically
  const update = {
    $push: { proctorLogs: log._id },
  };

  // Increment appropriate counters
  if (finalSeverity === "minor") {
    update.$inc = {
      "proctorSummary.minorViolations": 1,
      "proctorSummary.totalViolations": 1,
    };
  } else {
    update.$inc = {
      "proctorSummary.majorViolations": 1,
      "proctorSummary.totalViolations": 1,
    };
  }

  // Increment tab switch count if applicable
  if (violationType === "tab_switch") {
    update.$inc = update.$inc || {};
    update.$inc["proctorSummary.tabSwitchCount"] = 1;
  }

  // Recompute riskScore: major*5 + minor*1
  const currentMinor = session.proctorSummary?.minorViolations || 0;
  const currentMajor = session.proctorSummary?.majorViolations || 0;
  const newMinor = finalSeverity === "minor" ? currentMinor + 1 : currentMinor;
  const newMajor = finalSeverity === "major" ? currentMajor + 1 : currentMajor;
  const newRiskScore = newMajor * 5 + newMinor * 1;

  update.$set = {
    "proctorSummary.riskScore": newRiskScore,
  };

  // Auto-invalidate if riskScore >= threshold
  if (newRiskScore >= PROCTOR_RISK_THRESHOLD) {
    update.$set.invalidated = true;
    update.$set.status = "invalidated";
  }

  await AssessmentSession.findByIdAndUpdate(sessionId, update);

  // Fetch updated session to return summary
  const updatedSession = await AssessmentSession.findById(sessionId).lean();
  return {
    logId: log._id,
    proctorSummary: updatedSession.proctorSummary,
    invalidated: updatedSession.invalidated || false,
    status: updatedSession.status,
  };
}

/**
 * Get proctor logs for a session
 * @param {string} sessionId - Quiz session ID
 * @param {Object} options - Query options (limit, offset, violationType, severity)
 * @returns {Promise<Array>} Array of proctor logs
 */
export async function getSessionLogs(sessionId, options = {}) {
  const { limit = 50, offset = 0, violationType, severity } = options;
  
  const query = { session: sessionId };
  if (violationType) query.violationType = violationType;
  if (severity) query.severity = severity;

  const logs = await ProctorLog.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(offset)
    .lean();

  return logs;
}

/**
 * Override session invalidation (for instructor/admin)
 * @param {string} sessionId - Quiz session ID
 * @param {string} action - "invalidate" or "restore"
 * @param {string} reason - Reason for override
 * @param {string} adminId - Admin/Instructor user ID
 * @returns {Promise<Object>} Updated session
 */
export async function overrideSession(sessionId, action, reason, adminId) {
  const session = await AssessmentSession.findById(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  if (action === "invalidate") {
    session.invalidated = true;
    session.status = "invalidated";
  } else if (action === "restore") {
    session.invalidated = false;
    if (session.status === "invalidated") {
      session.status = "active"; // Restore to active if it was invalidated
    }
  }

  // Store override metadata
  if (!session.metadata) session.metadata = {};
  session.metadata.override = {
    action,
    reason,
    adminId,
    timestamp: new Date(),
  };

  await session.save();
  return session.toObject();
}

export default { updateSummary, getSessionLogs, overrideSession };

