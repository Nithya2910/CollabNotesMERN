const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User model — mirrors User.java exactly.
 *
 * Fields:
 *   username  - unique, indexed (same as @Indexed(unique=true))
 *   email     - unique, indexed, always stored lowercase
 *   password  - bcrypt hashed, hidden from JSON output (mirrors @JsonIgnore)
 *   avatar    - optional avatar URL
 *   timestamps - createdAt / updatedAt (mirrors LocalDateTime fields)
 *
 * JSON shape: both `id` and `_id` are present in responses, mirroring
 * Spring Boot's dual @JsonProperty("_id") + @JsonProperty("id") alias pattern.
 */
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username must be at most 30 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,  // always stored lowercase — mirrors email.toLowerCase() in AuthService
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,    // never returned in queries — mirrors @JsonIgnore on getPassword()
    },
    avatar: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      select: false,
    },
    otpExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,           // adds createdAt + updatedAt
    collection: 'users',        // same collection name as Spring Boot @Document
  }
);

// ── Pre-save hook: hash password with rounds=12 ───────────────────────────
// Matches Spring Boot's BCryptPasswordEncoder(12)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Instance method: compare passwords ───────────────────────────────────
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── toJSON transform: expose both `id` and `_id` ─────────────────────────
// Mirrors Spring Boot's dual @JsonProperty("_id") + getIdAlias() pattern.
// Also removes __v, password, and OTP fields from all responses.
userSchema.set('toJSON', {
  virtuals: true,           // includes virtual `id` field (string alias of _id)
  versionKey: false,        // removes __v
  transform: (doc, ret) => {
    delete ret.password;    // never expose password hash
    delete ret.otp;         // never expose OTP
    delete ret.otpExpires;  // never expose OTP expiration
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
