const express = require('express');
const mongoose = require('mongoose');
const Folder = require('../models/Folder');
const Note = require('../models/Note');
const protect = require('../middleware/auth');

/**
 * Folders Router — replaces FolderController.java + FolderService.java
 *
 * All routes are protected.
 *
 * Routes:
 *   GET    /api/folders      → get all folders owned by current user
 *   POST   /api/folders      → create a new folder
 *   PUT    /api/folders/:id  → rename folder (owner only)
 *   DELETE /api/folders/:id  → delete folder (owner only)
 */
const router = express.Router();

router.use(protect);

// ── GET /api/folders ──────────────────────────────────────────────────────
// Mirrors FolderController.getFolders()
router.get('/', async (req, res) => {
  try {
    const folders = await Folder.find({ owner: req.user._id })
      .populate('owner', '-password')
      .sort({ createdAt: -1 });

    res.json({ folders });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch folders' });
  }
});

// ── POST /api/folders ─────────────────────────────────────────────────────
// Mirrors FolderController.createFolder()
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Folder name is required' });
    }

    const folder = await Folder.create({
      name: name.trim(),
      owner: req.user._id,
    });

    const populated = await Folder.findById(folder._id).populate('owner', '-password');
    res.status(201).json({ folder: populated || folder });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create folder' });
  }
});

// ── PUT /api/folders/:id ──────────────────────────────────────────────────
// Mirrors FolderController.updateFolder() — owner only
router.put('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const folder = await Folder.findById(req.params.id);
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const ownerId = folder.owner?._id?.toString() || folder.owner?.toString();
    if (ownerId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name } = req.body;
    if (name !== undefined && name.trim() !== '') {
      folder.name = name.trim();
    }

    await folder.save();
    const populated = await Folder.findById(folder._id).populate('owner', '-password');
    res.json({ folder: populated || folder });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update folder' });
  }
});

// ── DELETE /api/folders/:id ───────────────────────────────────────────────
// Mirrors FolderController.deleteFolder() — owner only
router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const folder = await Folder.findById(req.params.id);
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const ownerId = folder.owner?._id?.toString() || folder.owner?.toString();
    if (ownerId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Un-folder any notes belonging to this folder before deletion
    await Note.updateMany({ folder: folder._id }, { $set: { folder: null } });

    await Folder.findByIdAndDelete(req.params.id);
    res.json({ message: 'Folder deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete folder' });
  }
});

module.exports = router;
