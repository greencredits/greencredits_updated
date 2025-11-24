import express from 'express';
import session from 'express-session';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

// Import models
import User from './models/User.js';
import Report from './models/Report.js';
import Credit from './models/Credit.js';
import Admin from './models/Admin.js';
import Worker from './models/Worker.js';

// Import zone config
import { detectZone, detectZoneFromCoordinates, ZONE_CONFIG } from './config/zones.js';

// ⭐ DEPLOYMENT: Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ⭐ DEPLOYMENT: Use PORT from environment or default to 3000
const PORT = process.env.PORT || 3000;

// ⭐ DEPLOYMENT: MongoDB Connection with environment variable
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/greencredits')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'application/pdf';
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Only image and PDF files are allowed!'));
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// ⭐ DEPLOYMENT: Session with environment variable
app.use(session({
  secret: process.env.SESSION_SECRET || 'greencredits-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true
  }
}));

// JWT Middleware
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET || 'jwt-secret-key', (err, user) => {
      if (err) return res.status(403).json({ success: false, error: 'Invalid token' });
      req.user = user;
      next();
    });
  } else {
    next();
  }
};

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId && !req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.adminId) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.session.adminId) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  Admin.findById(req.session.adminId)
    .then(admin => {
      if (!admin || (admin.role !== 'superadmin' && admin.role !== 'super_admin')) {
        return res.status(403).json({ success: false, error: 'Super Admin access required' });
      }
      req.admin = admin;
      next();
    })
    .catch(error => {
      res.status(500).json({ success: false, error: 'Authorization failed' });
    });
};

// Credit system constants
const CREDIT_ACTIONS = {
  REPORT_SUBMITTED: 10,
  REPORT_VERIFIED: 20,
  HIGH_QUALITY_REPORT: 30,
  FIRST_REPORT: 50,
  WEEKLY_STREAK: 25,
  MONTHLY_MILESTONE: 100
};

const BADGE_CRITERIA = [
  { key: 'first_report', name: 'First Step', icon: '🌱', threshold: 1, field: 'reportCount' },
  { key: 'eco_warrior', name: 'Eco Warrior', icon: '♻️', threshold: 10, field: 'reportCount' },
  { key: 'green_champion', name: 'Green Champion', icon: '🏆', threshold: 50, field: 'reportCount' },
  { key: 'planet_hero', name: 'Planet Hero', icon: '🌍', threshold: 100, field: 'reportCount' },
  { key: 'credit_collector', name: 'Credit Collector', icon: '💰', threshold: 500, field: 'totalCredits' },
  { key: 'elite_guardian', name: 'Elite Guardian', icon: '👑', threshold: 1000, field: 'totalCredits' }
];

// ============================================
// USER AUTHENTICATION
// ============================================

app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.json({ success: false, error: 'Email already registered' });
    }

    const user = new User({ name, email, password });
    await user.save();

    const creditAccount = new Credit({
      userId: user._id,
      totalCredits: CREDIT_ACTIONS.FIRST_REPORT,
      availableCredits: CREDIT_ACTIONS.FIRST_REPORT,
      transactions: [{
        type: 'bonus',
        amount: CREDIT_ACTIONS.FIRST_REPORT,
        description: 'Welcome bonus! 🎉'
      }]
    });
    await creditAccount.save();

    req.session.userId = user._id;
    req.session.userName = user.name;

    res.json({ 
      success: true, 
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.json({ success: false, error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password, mobile } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ success: false, error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.json({ success: false, error: 'Invalid credentials' });
    }

    if (mobile) {
      const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET || 'jwt-secret-key',
        { expiresIn: '7d' }
      );
      return res.json({
        success: true,
        token,
        user: { id: user._id, name: user.name, email: user.email }
      });
    }

    req.session.userId = user._id;
    req.session.userName = user.name;

    res.json({ 
      success: true, 
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.json({ success: false, error: 'Login failed' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.json({ success: false, error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// (CONTINUE WITH ALL YOUR EXISTING ROUTES - they're fine!)
// ... keep all your routes as they are ...

// ⭐ DEPLOYMENT: Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============================================
// START SERVER
// ============================================

// ⭐ DEPLOYMENT: Listen on all interfaces (0.0.0.0)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║   🌿 GREEN CREDITS - WASTE MANAGEMENT SYSTEM 🌿               ║
╚═══════════════════════════════════════════════════════════════╝

🚀 Server running on port ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
💾 Database: ${process.env.MONGODB_URI ? 'MongoDB Atlas ✅' : 'Local MongoDB'}

📱 URLS:
   Main App: http://localhost:${PORT}
   Admin Panel: http://localhost:${PORT}/admin.html
   Worker Login: http://localhost:${PORT}/worker-login.html
  `);
});

// Error handling
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});
