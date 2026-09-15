const express = require('express');
const mongoose = require('mongoose');
const Note = require('../models/Note');
const User = require('../models/User');
const Folder = require('../models/Folder');
const protect = require('../middleware/auth');

/**
 * Notes Router — replaces NoteController.java + NoteService.java
 *
 * All routes are protected (JWT required).
 *
 * Routes:
 *   GET    /api/notes              → get all accessible notes
 *   GET    /api/notes/:id          → get single note by id
 *   POST   /api/notes              → create new note
 *   PUT    /api/notes/:id          → update note (title, content, folder)
 *   DELETE /api/notes/:id          → soft-delete note (owner only)
 *   POST   /api/notes/:id/share    → share note with user by email/username
 *   POST   /api/notes/:id/restore  → restore to a previous version by index
 */
const router = express.Router();

// All note routes are protected
router.use(protect);

// ── Helper: check access ──────────────────────────────────────────────────
// Mirrors NoteService.hasAccess(note, userId)
const hasAccess = (note, userId) => {
  const uid = userId.toString();
  const ownerId = note.owner?._id?.toString() || note.owner?.toString();
  if (ownerId === uid) return true;
  return note.collaborators.some(
    (c) => (c._id?.toString() || c.toString()) === uid
  );
};

// ── Helper: populate note fields ──────────────────────────────────────────
// Populates owner + collaborators (without password) + folder
// Mirrors Spring Boot's @DBRef auto-loading behaviour
const populateNote = (query) =>
  query
    .populate('owner', '-password')
    .populate('collaborators', '-password')
    .populate('folder');

// ── GET /api/notes ────────────────────────────────────────────────────────
// Returns all notes where user is owner OR collaborator, not soft-deleted.
// Mirrors NoteRepository.findUserNotes(userId) @Query:
//   { $and: [{ $or: [{owner.$id:?0},{collaborators.$id:?0}] }, {isDeleted:false}] }
router.get('/', async (req, res) => {
  try {
    const notes = await populateNote(
      Note.find({
        $or: [
          { owner: req.user._id },
          { collaborators: req.user._id },
        ],
        isDeleted: false,
      }).sort({ updatedAt: -1 })
    );
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch notes' });
  }
});

// ── GET /api/notes/:id ────────────────────────────────────────────────────
// Mirrors NoteController.getNoteById()
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Note not found' });
    }

    const note = await populateNote(Note.findById(req.params.id));

    if (!note || note.isDeleted) {
      return res.status(404).json({ message: 'Note not found' });
    }

    if (!hasAccess(note, req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ note });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch note' });
  }
});

// ── POST /api/notes ───────────────────────────────────────────────────────
// Mirrors NoteController.createNote()
router.post('/', async (req, res) => {
  try {
    const { title = 'Untitled Note', content = '', folder } = req.body;

    const noteData = {
      title,
      content,
      owner: req.user._id,
    };

    // Validate and attach folder if provided
    if (folder) {
      const folderDoc = await Folder.findById(folder);
      if (folderDoc) noteData.folder = folderDoc._id;
    }

    const note = await Note.create(noteData);

    // Return populated note
    const populated = await populateNote(Note.findById(note._id));
    res.status(201).json({ note: populated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create note' });
  }
});

// ── PUT /api/notes/:id ────────────────────────────────────────────────────
// Mirrors NoteController.updateNote() + NoteService.updateNote()
// Handles: title, content (with version history), folder reassignment
router.put('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Note not found' });
    }

    const note = await populateNote(Note.findById(req.params.id));

    if (!note || note.isDeleted) {
      return res.status(404).json({ message: 'Note not found' });
    }

    if (!hasAccess(note, req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { title, content, folder } = req.body;

    // Update title
    if (title !== undefined) {
      note.title = title;
    }

    // Update content + push version snapshot if content changed
    // Mirrors NoteService.updateNote() version history logic:
    //   if (newContent != null && !newContent.equals(note.getContent())) → save snapshot
    //   Keep only last 10 versions
    if (content !== undefined) {
      const newContent = content;
      if (newContent !== note.content) {
        // Snapshot the current content before overwriting
        note.versions.push({
          content: note.content,
          savedByUserId: req.user._id.toString(),
          savedByUsername: req.user.username,
          savedAt: new Date(),
        });

        // Keep only last 10 versions — mirrors Java's subList(size-10, size)
        if (note.versions.length > 10) {
          note.versions = note.versions.slice(note.versions.length - 10);
        }
      }
      note.content = newContent;
    }

    // Update folder (null = move to unfiled)
    if ('folder' in req.body) {
      if (folder === null || folder === '') {
        note.folder = null;
      } else {
        const folderDoc = await Folder.findById(folder);
        note.folder = folderDoc ? folderDoc._id : note.folder;
      }
    }

    note.updatedAt = new Date();
    await note.save();

    // Re-fetch with full population for the response
    const updated = await populateNote(Note.findById(note._id));
    res.json({ note: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update note' });
  }
});

// ── DELETE /api/notes/:id ─────────────────────────────────────────────────
// Mirrors NoteController.deleteNote() — OWNER ONLY, soft delete
router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Note not found' });
    }

    const note = await Note.findById(req.params.id).populate('owner');

    if (!note || note.isDeleted) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Owner-only check — mirrors: !note.getOwner().getId().equals(user.getId())
    const ownerId = note.owner?._id?.toString() || note.owner?.toString();
    if (ownerId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can delete this note' });
    }

    // Soft delete — mirrors NoteService.softDeleteNote()
    note.isDeleted = true;
    note.updatedAt = new Date();
    await note.save();

    res.json({ message: 'Note deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete note' });
  }
});

// ── POST /api/notes/:id/share ─────────────────────────────────────────────
// Mirrors NoteController.shareNote() + NoteService.shareNote()
// Owner-only. Finds target by email OR username. Prevents self-share and duplicates.
router.post('/:id/share', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Note not found' });
    }

    const { identifier } = req.body;
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ message: 'Email or username is required' });
    }

    const note = await populateNote(Note.findById(req.params.id));

    if (!note || note.isDeleted) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Owner-only — mirrors: !note.getOwner().getId().equals(actor.getId())
    const ownerId = note.owner?._id?.toString() || note.owner?.toString();
    if (ownerId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can share this note' });
    }

    // Find target user by email OR username
    // Mirrors: userRepository.findByEmail(identifier.toLowerCase())
    //             .or(() -> userRepository.findByUsername(identifier))
    const id = identifier.trim();
    const target = await User.findOne({
      $or: [
        { email: id.toLowerCase() },
        { username: id },
      ],
    });

    if (!target) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Prevent self-share — mirrors: target.getId().equals(actor.getId())
    if (target._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot share a note with yourself' });
    }

    // Prevent duplicate collaborator — mirrors: alreadyCollab check
    const alreadyCollab = note.collaborators.some(
      (c) => (c._id?.toString() || c.toString()) === target._id.toString()
    );
    if (alreadyCollab) {
      return res.status(400).json({ message: 'User is already a collaborator' });
    }

    // Add collaborator and save
    note.collaborators.push(target._id);
    await note.save();

    // Re-fetch with population for the response
    const updated = await Note.findById(note._id).populate('collaborators', '-password');

    res.json({
      message: `Note shared with ${target.username}`,
      collaborators: updated.collaborators,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to share note' });
  }
});

// ── POST /api/notes/:id/restore ───────────────────────────────────────────
// Mirrors NoteController.restoreVersion() + NoteService.restoreVersion()
// Restores content from a previous version snapshot by index.
// Saves current content as a new snapshot before restoring.
router.post('/:id/restore', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Note not found' });
    }

    const { versionIndex } = req.body;
    if (versionIndex === undefined || versionIndex === null) {
      return res.status(400).json({ message: 'Version index is required' });
    }

    const note = await populateNote(Note.findById(req.params.id));

    if (!note || note.isDeleted) {
      return res.status(404).json({ message: 'Note not found' });
    }

    if (!hasAccess(note, req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Validate index — mirrors: versionIndex < 0 || versionIndex >= versions.size()
    if (versionIndex < 0 || versionIndex >= note.versions.length) {
      return res.status(400).json({ message: 'Version not found' });
    }

    const targetVersion = note.versions[versionIndex];

    // Snapshot current content before overwriting — mirrors Java's "snapshot" logic
    note.versions.push({
      content: note.content,
      savedByUserId: req.user._id.toString(),
      savedByUsername: req.user.username,
      savedAt: new Date(),
    });

    // Restore the target version content
    note.content = targetVersion.content;

    // Trim to last 10 versions
    if (note.versions.length > 10) {
      note.versions = note.versions.slice(note.versions.length - 10);
    }

    note.updatedAt = new Date();
    await note.save();

    const updated = await populateNote(Note.findById(note._id));
    res.json({ note: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to restore version' });
  }
});

module.exports = router;
