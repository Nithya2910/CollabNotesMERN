const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const protect = require('../middleware/auth');
const { sendVerificationOtpEmail } = require('../utils/emailService');

/**
 * Auth Router — CollabNotes Authentication System
 *
 * Routes:
 *   POST /api/auth/signup      → initiate registration & send 6-digit verification OTP
 *   POST /api/auth/verify-otp  → verify OTP, activate account & return JWT
 *   POST /api/auth/resend-otp  → generate & send fresh OTP to unverified account
 *   POST /api/auth/login       → authenticate verified user & return JWT
 *   GET  /api/auth/me          → return current user from JWT (protected)
 */
const router = express.Router();

// ── Helper: generate JWT ──────────────────────────────────────────────────
const generateToken = (email) =>
  jwt.sign({ sub: email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ── Helper: generate 6-digit numeric OTP ─────────────────────────────────
const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

// ── POST /api/auth/signup ─────────────────────────────────────────────────
router.post(
  '/signup',
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters'),
    body('email').trim().isEmail().withMessage('Invalid email address'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { username, email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      // 1. Check if email already exists in database
      const existingUserByEmail = await User.findOne({ email: normalizedEmail });

      if (existingUserByEmail) {
        // If already verified (or legacy user without isVerified=false), strictly reject duplicate registration
        if (existingUserByEmail.isVerified !== false) {
          return res.status(400).json({ message: 'An account already exists with this email.' });
        }

        // If user exists but is not yet verified, check if requested username belongs to someone else
        const userWithSameUsername = await User.findOne({ username });
        if (userWithSameUsername && userWithSameUsername._id.toString() !== existingUserByEmail._id.toString()) {
          return res.status(400).json({ message: 'Username is already taken!' });
        }

        // Update pending unverified account with new details and fresh OTP
        const otp = generateOtp();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        existingUserByEmail.username = username;
        existingUserByEmail.password = password; // Pre-save hook will hash
        existingUserByEmail.otp = otp;
        existingUserByEmail.otpExpires = otpExpires;
        await existingUserByEmail.save();

        // Send verification email
        try {
          await sendVerificationOtpEmail(normalizedEmail, otp);
        } catch (emailErr) {
          console.error('Email delivery error:', emailErr.message);
          return res.status(500).json({
            message: 'Unable to send verification email. Please try again.',
          });
        }

        return res.status(200).json({
          message: 'Verification OTP sent to your email.',
          email: normalizedEmail,
          requiresVerification: true,
        });
      }

      // 2. Check if username is taken
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({ message: 'Username is already taken!' });
      }

      // 3. Create new unverified user with 6-digit OTP
      const otp = generateOtp();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const newUser = new User({
        username,
        email: normalizedEmail,
        password,
        isVerified: false,
        otp,
        otpExpires,
      });

      await newUser.save();

      // Send verification email
      try {
        await sendVerificationOtpEmail(normalizedEmail, otp);
      } catch (emailErr) {
        console.error('Email delivery error:', emailErr.message);
        return res.status(500).json({
          message: 'Unable to send verification email. Please try again.',
        });
      }

      return res.status(201).json({
        message: 'Verification OTP sent to your email.',
        email: normalizedEmail,
        requiresVerification: true,
      });
    } catch (err) {
      if (err.code === 11000) {
        if (err.keyPattern?.email) {
          return res.status(400).json({ message: 'An account already exists with this email.' });
        }
        if (err.keyPattern?.username) {
          return res.status(400).json({ message: 'Username is already taken!' });
        }
      }
      return res.status(500).json({ message: 'Server error during registration' });
    }
  }
);

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────
router.post(
  '/verify-otp',
  [
    body('email').trim().isEmail().withMessage('Invalid email address'),
    body('otp').trim().notEmpty().withMessage('Verification OTP is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { email, otp } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      // Find user including hidden OTP fields
      const user = await User.findOne({ email: normalizedEmail }).select('+otp +otpExpires');

      if (!user) {
        return res.status(400).json({ message: 'User not found' });
      }

      if (user.isVerified) {
        return res.status(400).json({ message: 'Account is already verified. Please log in.' });
      }

      if (!user.otp || !user.otpExpires) {
        return res.status(400).json({ message: 'No pending verification OTP found. Please request a new one.' });
      }

      // Check OTP expiry (10 minutes)
      if (Date.now() > user.otpExpires.getTime()) {
        return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
      }

      // Check OTP match
      if (user.otp !== otp.toString().trim()) {
        return res.status(400).json({ message: 'Invalid OTP code. Please try again.' });
      }

      // Mark user as verified and clear OTP fields
      user.isVerified = true;
      user.otp = undefined;
      user.otpExpires = undefined;
      await user.save();

      // Generate token upon successful verification
      const token = generateToken(user.email);

      return res.status(200).json({
        message: 'Email verified successfully! Welcome to CollabNotes.',
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
      });
    } catch (err) {
      return res.status(500).json({ message: 'Server error during verification' });
    }
  }
);

// ── POST /api/auth/resend-otp ─────────────────────────────────────────────
router.post(
  '/resend-otp',
  [body('email').trim().isEmail().withMessage('Invalid email address')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const user = await User.findOne({ email: normalizedEmail }).select('+otp +otpExpires');

      if (!user) {
        return res.status(400).json({ message: 'User not found with this email' });
      }

      if (user.isVerified) {
        return res.status(400).json({ message: 'Account is already verified. Please log in.' });
      }

      // Generate new OTP and reset 10-minute expiry
      const otp = generateOtp();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();

      // Send verification email
      try {
        await sendVerificationOtpEmail(normalizedEmail, otp);
      } catch (emailErr) {
        console.error('Email delivery error on resend:', emailErr.message);
        return res.status(500).json({
          message: 'Unable to send verification email. Please try again.',
        });
      }

      return res.status(200).json({
        message: 'A new verification OTP has been sent to your email.',
        email: normalizedEmail,
      });
    } catch (err) {
      return res.status(500).json({ message: 'Server error while resending OTP' });
    }
  }
);

// ── POST /api/auth/login ──────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('Invalid email address'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const user = await User.findOne({ email: normalizedEmail }).select('+password');

      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Check if user is verified (only block if isVerified is explicitly false)
      if (user.isVerified === false) {
        return res.status(403).json({
          message: 'Please verify your email address before logging in.',
          requiresVerification: true,
          email: user.email,
        });
      }

      // Generate token
      const token = generateToken(user.email);

      return res.status(200).json({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
      });
    } catch (err) {
      return res.status(500).json({ message: 'Server error during login' });
    }
  }
);

// ── GET /api/auth/me ──────────────────────────────────────────────────────
router.get('/me', protect, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
    },
  });
});

module.exports = router;

