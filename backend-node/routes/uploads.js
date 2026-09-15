const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const protect = require('../middleware/auth');

/**
 * Uploads Router — replaces UploadController.java + UploadService.java
 *
 * Routes:
 *   POST /api/uploads         → upload file (image or PDF), returns { url: '/uploads/...' }
 *   GET  /api/uploads/images  → list all image URLs for ImageGalleryModal
 */
const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ── Multer Storage Configuration ──────────────────────────────────────────
// Matches Spring Boot UploadService: UUID + "_" + originalFilename
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename and prepend UUID
    const cleanName = path.basename(file.originalname).replace(/\s+/g, '_');
    cb(null, `${uuidv4()}_${cleanName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10) * 1024 * 1024, // 10MB
  },
});

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);

// ── POST /api/uploads ─────────────────────────────────────────────────────
// Protected endpoint for file uploads
router.post('/', protect, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size exceeds limit of 10MB' });
      }
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(500).json({ message: `File upload failed: ${err.message}` });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  });
});

// ── GET /api/uploads/images ───────────────────────────────────────────────
// Public endpoint used by ImageGalleryModal to list all uploaded images
router.get('/images', (req, res) => {
  try {
    if (!fs.existsSync(uploadDir)) {
      return res.json({ images: [] });
    }

    const files = fs.readdirSync(uploadDir);
    const imageUrls = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return IMAGE_EXTENSIONS.has(ext);
      })
      .map((file) => `/uploads/${file}`);

    res.json({ images: imageUrls });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve images', images: [] });
  }
});

module.exports = router;
