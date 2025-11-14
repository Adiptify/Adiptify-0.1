import mongoose from "mongoose";

const attemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", index: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: "AssessmentSession", index: true },
    isCorrect: { type: Boolean, required: true },
    userAnswer: { type: mongoose.Schema.Types.Mixed }, // Supports string, array, or object
    score: { type: Number, default: 0 }, // Normalized [0..1] score
    gradingDetails: { type: mongoose.Schema.Types.Mixed, default: null }, // Stores LLM grading results, similarity scores, etc.
    timeTakenMs: { type: Number, default: 0 },
    explanation: { type: String, default: "" }, // Optional LLM explanation stored after attempt
    proctorLogRefs: [{ type: mongoose.Schema.Types.ObjectId, ref: "ProctorLog" }], // Links to proximate proctor events
  },
  { timestamps: true }
);

attemptSchema.index({ user: 1, item: 1 });

export const Attempt = mongoose.model("Attempt", attemptSchema);
export default Attempt;


