import mongoose from "mongoose";

const proctorLogSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: "AssessmentSession", index: true, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
  violationType: {
    type: String,
    enum: [
      "tab_switch",
      "window_blur",
      "copy_attempt",
      "paste_attempt",
      "right_click_attempt",
      "devtools_opened",
      "screenshot_key_pressed",
      "page_exit_attempt"
    ],
    required: true,
  },
  severity: { type: String, enum: ["minor", "major"], default: "minor" },
  details: { type: String, default: "" },
  timestamp: { type: Date, default: () => new Date(), index: true },
}, { _id: true, timestamps: true });

proctorLogSchema.index({ session: 1, user: 1, timestamp: -1 });
proctorLogSchema.index({ session: 1, timestamp: -1 });

export const ProctorLog = mongoose.model("ProctorLog", proctorLogSchema);
export default ProctorLog;

