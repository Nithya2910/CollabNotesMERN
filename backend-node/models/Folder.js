const mongoose = require('mongoose');

/**
 * Folder model — mirrors Folder.java exactly.
 *
 * Fields:
 *   name       - folder display name (required)
 *   owner      - ref to User (required, indexed)
 *   timestamps - createdAt / updatedAt
 *
 * JSON shape: both `id` and `_id` present, mirroring Spring Boot's
 * @JsonProperty("_id") + getIdAlias() pattern.
 */
const folderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Folder name is required'],
      trim: true,
      maxlength: [100, 'Folder name must be at most 100 characters'],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'folders',  // same collection name as Spring Boot @Document
  }
);

// ── toJSON transform: expose both `id` and `_id` ─────────────────────────
// The frontend reads f.id || f._id throughout Dashboard.jsx
folderSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
});

module.exports = mongoose.model('Folder', folderSchema);
