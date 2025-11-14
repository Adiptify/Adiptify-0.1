import mongoose from "mongoose";

const generatedAssessmentSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    title: { type: String, required: true },
    items: { type: Array, default: [] }, // Raw parsed items from AI
    rawResponse: { type: mongoose.Schema.Types.Mixed }, // Full AI response
    validated: { type: Boolean, default: false }, // Whether items passed validation
    status: { type: String, enum: ["draft", "published", "failed"], default: "draft" },
    linkedItemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Item" }], // Published items
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    publishedAt: { type: Date },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // Proctor support
    proctored: { type: Boolean, default: false },
    proctorConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

generatedAssessmentSchema.index({ topic: 1, status: 1 });
generatedAssessmentSchema.index({ createdBy: 1 });

export const GeneratedAssessment = mongoose.model("GeneratedAssessment", generatedAssessmentSchema);
export default GeneratedAssessment;

