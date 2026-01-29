import express from "express";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import fs from "fs";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = process.env.PORT || 3000;
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (_req, file, cb) {
    // Keep original filename or add timestamp to prevent overwrites
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, basename + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.obj', '.glb', '.gltf'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .obj, .glb, and .gltf files are allowed'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  }
});

app.use(express.json());
app.use("/uploads", express.static(uploadsDir));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/list", (_req, res) => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      res.status(500).json({ error: "Failed to list uploads" });
      return;
    }
    const objs = files
      .filter((file) => [".obj", ".glb", ".gltf"].includes(path.extname(file).toLowerCase()))
      .map((file) => ({
        name: file,
        url: `/uploads/${file}`
      }));
    res.json({ items: objs });
  });
});

app.post("/api/upload", upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  res.json({
    success: true,
    file: {
      name: req.file.filename,
      originalName: req.file.originalname,
      url: `/uploads/${req.file.filename}`,
      size: req.file.size
    }
  });
});

app.use((err, _req, res, _next) => {
  if (err?.message?.includes("Only .obj")) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: "Server error" });
});

export function startServer(port = PORT) {
  return app.listen(port, () => {
    console.log(`Viewer platform running on http://localhost:${port}`);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
