import express from "express";
import { auth } from "../middleware/auth.js";
import GeneratedAssessment from "../models/GeneratedAssessment.js";
import { marked } from "marked";
import path from "path";
import fs from "fs";

const router = express.Router();

// GET /api/notes/:id/download -> returns a simple HTML file from markdown
router.get("/:id/download", auth, async (req, res) => {
  const doc = await GeneratedAssessment.findById(req.params.id).lean();
  if (!doc || !doc.notes) return res.status(404).json({ error: "Notes not found" });
  const html = `<!DOCTYPE html><html><head><meta charset='utf-8'><title>${doc.topic} Notes</title></head><body>${marked.parse(doc.notes)}</body></html>`;

  const outDir = path.join(process.cwd(), "tmp_notes");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, `${String(doc._id)}.html`);
  fs.writeFileSync(filePath, html);
  res.download(filePath, `${doc.topic.replace(/\s+/g, '_')}_notes.html`);
});

export default router;


