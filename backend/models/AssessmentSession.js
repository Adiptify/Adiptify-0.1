import mongoose from "mongoose";

const assessmentSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    mode: { type: String, enum: ["diagnostic", "formative", "summative", "proctored"], default: "formative" },
    itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Item" }],
    currentIndex: { type: Number, default: 0 },
    startedAt: { type: Date, default: () => new Date() },
    completedAt: { type: Date },
    score: { type: Number, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed },
    timeLimit: { type: Number },
    status: { type: String, enum: ["active", "completed", "cancelled", "invalidated"], default: "active" },
    // Proctor config (screen-only)
    proctored: { type: Boolean, default: false },
    proctorConfig: {
      blockTabSwitch: { type: Boolean, default: true },
      blockCopyPaste: { type: Boolean, default: true },
      blockRightClick: { type: Boolean, default: true },
      allowTabSwitchCount: { type: Number, default: 2 }, // User allowed up to 2 switches; 3rd causes escalation
      requireSnapshots: { type: Boolean, default: false }, // No snapshots per spec
      snapshotIntervalSec: { type: Number, default: 0 }
    },
    proctorSummary: {
      minorViolations: { type: Number, default: 0 },
      majorViolations: { type: Number, default: 0 },
      totalViolations: { type: Number, default: 0 },
      riskScore: { type: Number, default: 0 },
      tabSwitchCount: { type: Number, default: 0 } // Track tab switches for escalation
    },
    proctorLogs: [{ type: mongoose.Schema.Types.ObjectId, ref: "ProctorLog" }],
    invalidated: { type: Boolean, default: false }
  },
  { timestamps: true }
);

assessmentSessionSchema.index({ user: 1, status: 1 });
assessmentSessionSchema.index({ createdAt: -1 });

export const AssessmentSession = mongoose.model("AssessmentSession", assessmentSessionSchema);
export default AssessmentSession;

