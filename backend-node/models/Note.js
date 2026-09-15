const mongoose = require('mongoose');

/**
 * Note model — mirrors Note.java exactly.
 *
 * Embedded VersionSchema mirrors the Note.Version inner class.
 * Versions are stored as plain embedded objects (no sub-doc references),
 * exactly matching Spring Boot's design decision to avoid @DBRef inside
 * embedded documents.
 *
 * Fields:
 *   title         - note title (default "Untitled Note")
 *   content       - markdown content
 *   owner         - ref to User (required, indexed)
 *   collaborators - array of User refs
 *   versions      - embedded history snapshots (max 10, trimmed in routes)
 *   folder        - optional ref to Folder
 *   isDeleted     - soft delete flag (mirrors isDeleted boolean in Java)
 *   timestamps    - createdAt / updatedAt
 */

// ── Embedded Version schema ───────────────────────────────────────────────
// Mirrors Note.Version inner class exactly:
//   content         → version content snapshot
//   savedByUserId   → stores userId as string (not a ref)
//   savedByUsername → username at time of save
//   savedAt         → timestamp
const versionSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      default: '',
    },
    savedByUserId: {
      type: String,   // stored as string, not ObjectId ref — same as Java
    },
    savedByUsername: {
      type: String,
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }  // no sub-document _id, same as Java embedded class
);

// ── Main Note schema ──────────────────────────────────────────────────────
const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: 'Untitled Note',
      trim: true,
    },
    content: {
      type: String,
      default: '',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    collaborators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    versions: {
      type: [versionSchema],
      default: [],
    },
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'notes',
  }
);

// ── Compound indexes for the getUserNotes query ───────────────────────────
// Mirrors Spring Boot's NoteRepository @Query:
// { $and: [{ $or: [{"owner.$id":?0},{"collaborators.$id":?0}] }, {"isDeleted":false}] }
noteSchema.index({ owner: 1, isDeleted: 1 });
noteSchema.index({ collaborators: 1, isDeleted: 1 });

// ── toJSON transform: expose both `id` and `_id` ─────────────────────────
// Mirrors Spring Boot's dual @JsonProperty pattern so frontend code that
// reads either note.id or note._id continues to work.
noteSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
});

module.exports = mongoose.model('Note', noteSchema);
