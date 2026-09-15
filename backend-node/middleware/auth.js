const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * JWT Authentication Middleware
 *
 * Replaces Spring Boot's JwtAuthFilter + JwtUtils + UserDetailsServiceImpl.
 *
 * Algorithm:
 *   1. Read Authorization header: "Bearer <token>"
 *   2. Verify token with JWT_SECRET (same secret as Spring Boot)
 *   3. Extract email from token subject (sub claim)
 *   4. Look up user in MongoDB by email
 *   5. Attach full user document to req.user
 *   6. Call next() to continue the request chain
 *
 * On any failure: respond 401 { message: "Unauthorized" }
 *
 * Public routes that bypass this middleware:
 *   POST /api/auth/signup
 *   POST /api/auth/login
 *   GET  /uploads/*  (static file serving)
 *   GET  /api/uploads/images
 */
const protect = async (req, res, next) => {
  try {
    // 1. Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.substring(7); // strip "Bearer "

    // 2. Verify and decode token
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // 3. Extract email from token subject
    //    Spring Boot JwtUtils.generateToken(email) sets subject = email
    const email = payload.sub;
    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // 4. Find user in database
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // 5. Attach user to request (available in all downstream route handlers)
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Unauthorized' });
  }
};

module.exports = protect;
