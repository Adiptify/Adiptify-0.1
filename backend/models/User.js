import mongoose from "mongoose";

const learnerProfileSchema = new mongoose.Schema(
  {
    topics: {
      type: Map,
      of: new mongoose.Schema(
        {
          mastery: { type: Number, default: 0 },
          attempts: { type: Number, default: 0 },
          streak: { type: Number, default: 0 },
          timeOnTask: { type: Number, default: 0 },
        },
        { _id: false }
      ),
      default: {},
    },
    preferredMode: { type: String, enum: ["mcq", "fill_blank", "short_answer", "match", "reorder", "mixed"], default: "mixed" },
    lastActiveAt: { type: Date, default: () => new Date() }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    studentId: { type: String, required: function() { return this.role === 'student'; }, index: true, sparse: true, unique: false },
    role: { type: String, enum: ["student", "instructor", "admin"], default: "student" },
    learnerProfile: { type: learnerProfileSchema, default: () => ({}) },
    proctorConsent: { type: Boolean, default: false },
    lockedSubjects: { type: [String], default: [] } // Subjects locked for this user
  },
  { timestamps: true }
);
userSchema.index({ role: 1, studentId: 1 }, { unique: true, partialFilterExpression: { role: 'student' } });

export const User = mongoose.model("User", userSchema);
export default User;


