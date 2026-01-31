import express from "express";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = process.env.PORT || 3000;
const uploadsDir = path.join(__dirname, "uploads");
const worldStatePath = path.join(__dirname, "world-state.json");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

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

// Upload - MUST be before express.json() to receive raw body
app.post("/api/upload", express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
  try {
    const filename = req.query.filename;

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const ext = path.extname(filename).toLowerCase();
    if (!['.obj', '.glb', '.gltf'].includes(ext)) {
      return res.status(400).json({ error: 'Only .obj, .glb, and .gltf files are allowed' });
    }

    // Check if body exists
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: 'No file data received' });
    }

    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const basename = path.basename(filename, ext);
    const savedFilename = basename + '-' + uniqueSuffix + ext;
    const filePath = path.join(uploadsDir, savedFilename);

    fs.writeFileSync(filePath, req.body);

    const stats = fs.statSync(filePath);

    res.json({
      success: true,
      file: {
        name: savedFilename,
        url: `/uploads/${savedFilename}`,
        size: stats.size
      }
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// Apply JSON parsing for other routes
app.use(express.json());

// World state - GET
app.get("/api/world", (_req, res) => {
  try {
    if (fs.existsSync(worldStatePath)) {
      const data = fs.readFileSync(worldStatePath, 'utf8');
      res.json(JSON.parse(data));
    } else {
      res.json({ voxels: [] });
    }
  } catch (err) {
    console.error('Load world error:', err);
    res.json({ voxels: [] });
  }
});

// World state - POST
app.post("/api/world", (req, res) => {
  try {
    fs.writeFileSync(worldStatePath, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('Save world error:', err);
    res.status(500).json({ error: 'Failed to save world state' });
  }
});

app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
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
