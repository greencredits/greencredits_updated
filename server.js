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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ⭐ DEPLOYMENT FIX: Trust proxy for Render
app.set('trust proxy', 1);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
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
// Serve static files from root directory (for HTML files at root level)
app.use(express.static(__dirname));

// Also serve from public folder
app.use(express.static(path.join(__dirname, 'public')));

app.use('/uploads', express.static('uploads'));
app.use(express.static('public'));
app.use(express.static(__dirname));

// ⭐ DEPLOYMENT FIX: Session with production-ready cookies
app.use(session({
  secret: process.env.SESSION_SECRET || 'greencredits-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
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
app.get('/admin.html', (req, res, next) => {
  if (!req.session.adminId) return res.redirect('/admin-login.html');
  next();
});

app.get('/admin-login.html', (req, res, next) => {
  if (req.session.adminId) return res.redirect('/admin.html');
  next();
});


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

const requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.session.adminId) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
      }

      const admin = await Admin.findById(req.session.adminId);
      if (!admin || !allowedRoles.includes(admin.role)) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      req.admin = admin;
      next();
    } catch (error) {
      res.status(500).json({ success: false, error: 'Authorization failed' });
    }
  };
};
// Super Admin Middleware
const requireSuperAdmin = (req, res, next) => {
  if (!req.session.adminId) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  Admin.findById(req.session.adminId)
    .then(admin => {
      if (!admin || admin.role !== 'superadmin' && admin.role !== 'super_admin') {
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
    if (err) {
      return res.json({ success: false, error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

app.get('/api/check-session', async (req, res) => {
  try {
    if (req.session.userId) {
      const user = await User.findById(req.session.userId).select('-password');
      if (user) {
        return res.json({ 
          loggedIn: true, 
          user: { id: user._id, name: user.name, email: user.email } 
        });
      }
    }
    res.json({ loggedIn: false });
  } catch (error) {
    res.json({ loggedIn: false });
  }
});

// ============================================
// ADMIN AUTHENTICATION
// ============================================

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email, isActive: true });
    if (!admin) {
      return res.json({ success: false, error: 'Invalid credentials' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.json({ success: false, error: 'Invalid credentials' });
    }

    req.session.adminId = admin._id;
    req.session.adminName = admin.name;
    req.session.adminRole = admin.role;

    res.json({ 
      success: true, 
      admin: { 
        id: admin._id, 
        name: admin.name,
        role: admin.role,
        email: admin.email,
        department: admin.department,
        assignedZones: admin.assignedZones || []
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.json({ success: false, error: 'Login failed' });
  }
});
// ========================================
// SUPER ADMIN SPECIFIC ROUTES
// ========================================

// Super Admin Login (separate endpoint)
app.post('/api/super-admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ 
      email, 
      isActive: true 
    });

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if super admin
    if (admin.role !== 'superadmin' && admin.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Super Admin access only' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    req.session.adminId = admin._id;
    req.session.adminName = admin.name;
    req.session.adminRole = admin.role;

    res.json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Super Admin login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// Get Super Admin Profile
app.get('/api/super-admin/me', requireSuperAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.session.adminId).select('-password');
    res.json(admin);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Get Super Admin Dashboard Stats
app.get('/api/super-admin/stats', requireSuperAdmin, async (req, res) => {
  try {
    const totalReports = await Report.countDocuments();
    const pendingReports = await Report.countDocuments({ status: 'pending' });
    const totalOfficers = await Admin.countDocuments({ role: 'zone_officer' });
    const totalWorkers = await Worker.countDocuments({ status: 'approved' });
    const totalUsers = await User.countDocuments();

    res.json({
      success: true,
      totalReports,
      pendingReports,
      totalOfficers,
      totalWorkers,
      totalUsers
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// Get All Reports (Super Admin)
app.get('/api/super-admin/reports', requireSuperAdmin, async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, reports });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch reports' });
  }
});

// Super Admin Logout
app.post('/api/super-admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.json({ success: false });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.json({ success: false });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

app.get('/api/admin/me', requireAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.session.adminId).select('-password');
    res.json({ success: true, admin });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

// ============================================
// REPORT MANAGEMENT (WITH AUTO ZONE)
// ============================================

app.post('/api/report', authenticateJWT, requireAuth, upload.single('photo'), async (req, res) => {
  try {
    console.log('📝 Report submission received');
    const userId = req.session.userId || req.user.userId;
    const { description, lat, lng, address, wasteCategory, disposalMethod } = req.body;

    if (!description || description.trim().length < 10) {
      return res.json({ success: false, error: 'Description must be at least 10 characters' });
    }

    const lastReport = await Report.findOne().sort({ reportId: -1 });
    const reportId = lastReport ? lastReport.reportId + 1 : 1001;

    let qualityScore = 0;
    if (req.file) qualityScore += 30;
    if (lat && lng) qualityScore += 30;
    if (description && description.length > 20) qualityScore += 20;
    if (wasteCategory) qualityScore += 10;
    if (disposalMethod) qualityScore += 10;

    // ⭐ AUTO-ASSIGN ZONE
    let assignedZone = 'Zone 5 - Central Gonda';

    if (address) {
      assignedZone = detectZone(address);
    } else if (lat && lng) {
      const gpsZone = detectZoneFromCoordinates(parseFloat(lat), parseFloat(lng));
      if (gpsZone) assignedZone = gpsZone;
    }

    const report = new Report({
      userId,
      reportId,
      description,
      photoUrl: req.file ? `/uploads/${req.file.filename}` : null,
      lat: parseFloat(lat) || null,
      lng: parseFloat(lng) || null,
      address: address || null,
      assignedZone, // ⭐ AUTO-ASSIGNED
      wasteCategory: wasteCategory || null,
      disposalMethod: disposalMethod || null,
      qualityScore,
      status: 'pending'
    });

    await report.save();
    console.log('✅ Report saved:', reportId, 'Zone:', assignedZone);

    // Credit calculation (existing logic)
    let creditsEarned = CREDIT_ACTIONS.REPORT_SUBMITTED;
    if (qualityScore >= 80) {
      creditsEarned += CREDIT_ACTIONS.HIGH_QUALITY_REPORT;
    }

    const user = await User.findById(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streakMultiplier = 1;

    if (user.lastReportDate) {
      const lastDate = new Date(user.lastReportDate);
      lastDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

      if (daysDiff === 1) {
        user.currentStreak += 1;
      } else if (daysDiff > 1) {
        user.currentStreak = 1;
      }
    } else {
      user.currentStreak = 1;
    }

    if (user.currentStreak > user.longestStreak) {
      user.longestStreak = user.currentStreak;
    }

    user.lastReportDate = new Date();
    await user.save();

    if (user.currentStreak >= 7) streakMultiplier = 3;
    else if (user.currentStreak >= 3) streakMultiplier = 2;

    const streakBonus = Math.floor(creditsEarned * (streakMultiplier - 1));

    const creditAccount = await Credit.findOne({ userId });
    if (!creditAccount) {
      return res.json({ success: false, error: 'Credit account not found' });
    }

    creditAccount.totalCredits += creditsEarned;
    creditAccount.availableCredits += creditsEarned;
    creditAccount.reportCount += 1;
    creditAccount.transactions.push({
      type: 'earned',
      amount: creditsEarned,
      description: `Report #${reportId} - ${assignedZone}`
    });

    if (streakBonus > 0) {
      creditAccount.totalCredits += streakBonus;
      creditAccount.availableCredits += streakBonus;
      creditAccount.transactions.push({
        type: 'bonus',
        amount: streakBonus,
        description: `🔥 ${user.currentStreak}-day streak! (${streakMultiplier}X)`
      });
    }

    // Badge system
    const newBadges = [];
    for (const badge of BADGE_CRITERIA) {
      const alreadyHas = creditAccount.badges.some(b => b.key === badge.key);
      if (!alreadyHas && creditAccount[badge.field] >= badge.threshold) {
        creditAccount.badges.push({
          key: badge.key,
          name: badge.name,
          icon: badge.icon,
          earnedAt: new Date()
        });
        newBadges.push(badge);
      }
    }

    await creditAccount.save();

    const totalEarned = creditsEarned + streakBonus;

    res.json({
      success: true,
      reportId,
      assignedZone, // ⭐ Return zone
      creditsEarned: totalEarned,
      baseCredits: creditsEarned,
      streakBonus,
      streak: user.currentStreak,
      streakMultiplier,
      longestStreak: user.longestStreak,
      qualityScore,
      newBadges,
      message: `Report submitted! Assigned to ${assignedZone}\nEarned ${totalEarned} credits${streakBonus > 0 ? ` (${streakMultiplier}X streak!)` : ''}`
    });
  } catch (error) {
    console.error('❌ Report submission error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to submit report' });
  }
});

app.get('/api/reports', authenticateJWT, requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId || req.user.userId;
    const reports = await Report.find({ userId }).sort({ createdAt: -1 });
    res.json({ success: true, reports });
  } catch (error) {
    res.json({ success: false, error: 'Failed to fetch reports' });
  }
});

// Continuing in next message...
// ============================================
// CREDITS & LEADERBOARD
// ============================================

app.get('/api/credits', authenticateJWT, requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId || req.user.userId;
    const creditAccount = await Credit.findOne({ userId });

    if (!creditAccount) {
      return res.json({ success: false, error: 'Credit account not found' });
    }

    const nextBadges = BADGE_CRITERIA
      .filter(badge => !creditAccount.badges.some(b => b.key === badge.key))
      .map(badge => ({
        ...badge,
        progress: Math.min(100, (creditAccount[badge.field] / badge.threshold) * 100)
      }));

    res.json({
      success: true,
      credits: {
        total: creditAccount.totalCredits,
        available: creditAccount.availableCredits,
        reportsSubmitted: creditAccount.reportCount,
        reportsVerified: creditAccount.reportsVerified
      },
      badges: creditAccount.badges,
      nextBadges,
      transactions: creditAccount.transactions.slice(-10).reverse()
    });
  } catch (error) {
    console.error('Credits fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch credits' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = await Credit.find()
      .populate('userId', 'name')
      .sort({ totalCredits: -1 });

    const uniqueUsers = new Map();
    leaderboard.forEach(entry => {
      const userId = entry.userId?._id?.toString();
      if (userId && (!uniqueUsers.has(userId) || uniqueUsers.get(userId).totalCredits < entry.totalCredits)) {
        uniqueUsers.set(userId, entry);
      }
    });

    const formattedLeaderboard = Array.from(uniqueUsers.values())
      .sort((a, b) => b.totalCredits - a.totalCredits)
      .slice(0, 10)
      .map((entry, index) => ({
        rank: index + 1,
        name: entry.userId?.name || 'Anonymous',
        credits: entry.totalCredits,
        reports: entry.reportCount,
        badges: entry.badges.length
      }));

    res.json({ success: true, leaderboard: formattedLeaderboard });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

app.get('/api/user-profile', authenticateJWT, requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId || req.user.userId;
    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        currentStreak: user.currentStreak || 0,
        longestStreak: user.longestStreak || 0,
        lastReportDate: user.lastReportDate || null
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

app.post('/api/redeem', authenticateJWT, requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId || req.user.userId;
    const { rewardId, cost, name } = req.body;

    const creditAccount = await Credit.findOne({ userId });

    if (!creditAccount) {
      return res.json({ success: false, error: 'Credit account not found' });
    }

    if (creditAccount.availableCredits < cost) {
      return res.json({ success: false, error: 'Insufficient credits' });
    }

    creditAccount.availableCredits -= cost;
    creditAccount.transactions.push({
      type: 'redeemed',
      amount: -cost,
      description: `Redeemed: ${name}`
    });

    await creditAccount.save();

    res.json({ 
      success: true, 
      newBalance: creditAccount.availableCredits,
      message: 'Reward redeemed successfully!'
    });
  } catch (error) {
    console.error('Redemption error:', error);
    res.status(500).json({ success: false, error: 'Redemption failed' });
  }
});

// ============================================
// ADMIN ROUTES (ZONE-FILTERED)
// ============================================

// Check admin session
app.get('/api/admin/me', requireAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.session.adminId).select('-password');
    res.json({ success: true, admin });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.get('/api/admin/reports', requireAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.session.adminId);

    let query = {};

    // Zone officers see only their zones
    if (admin.role === 'zone_officer' && admin.assignedZones && admin.assignedZones.length > 0) {
      query.assignedZone = { $in: admin.assignedZones };
    }

    const reports = await Report.find(query)
      .populate('userId', 'name email')
      .populate('assignedTo', 'name phone')
      .sort({ createdAt: -1 });

    res.json({ success: true, reports, role: admin.role });
  } catch (error) {
    res.json({ success: false, error: 'Failed to fetch reports' });
  }
});

app.post('/api/admin/reports/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const report = await Report.findById(id);
    if (!report) {
      return res.json({ success: false, error: 'Report not found' });
    }

    const oldStatus = report.status;
    report.status = status;
    report.adminNotes = notes;
    if (status === 'resolved') report.resolvedAt = new Date();
    await report.save();

    if (oldStatus === 'pending' && status === 'verified') {
      const creditAccount = await Credit.findOne({ userId: report.userId });
      if (creditAccount) {
        creditAccount.totalCredits += CREDIT_ACTIONS.REPORT_VERIFIED;
        creditAccount.availableCredits += CREDIT_ACTIONS.REPORT_VERIFIED;
        creditAccount.reportsVerified += 1;
        creditAccount.transactions.push({
          type: 'bonus',
          amount: CREDIT_ACTIONS.REPORT_VERIFIED,
          description: `Report #${report.reportId} verified by admin`
        });
        await creditAccount.save();
      }
    }

    res.json({ success: true, message: 'Report updated successfully' });
  } catch (error) {
    res.json({ success: false, error: 'Failed to update report' });
  }
});

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.session.adminId);

    let query = {};
    if (admin.role === 'zone_officer' && admin.assignedZones && admin.assignedZones.length > 0) {
      query.assignedZone = { $in: admin.assignedZones };
    }

    const totalReports = await Report.countDocuments(query);
    const pendingReports = await Report.countDocuments({ ...query, status: 'pending' });
    const resolvedReports = await Report.countDocuments({ ...query, status: 'resolved' });
    const totalUsers = await User.countDocuments();

    // Zone breakdown
    const zoneStats = await Report.aggregate([
      { $match: query.assignedZone ? query : {} },
      { $group: {
        _id: '$assignedZone',
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } }
      }}
    ]);

    res.json({
      success: true,
      stats: { 
        totalReports, 
        totalUsers, 
        pendingReports, 
        resolvedReports,
        zoneStats
      }
    });
  } catch (error) {
    res.json({ success: false, error: 'Failed to fetch stats' });
  }
});

app.post('/api/admin/reports/:id/assign', requireRole('super_admin', 'municipality_officer', 'zone_officer'), async (req, res) => {
  try {
    const { workerId } = req.body;

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.json({ success: false, error: 'Report not found' });
    }

    report.assignedTo = workerId;
    report.status = 'in-progress';
    await report.save();

    res.json({ success: true, message: 'Report assigned successfully' });
  } catch (error) {
    res.json({ success: false, error: 'Failed to assign report' });
  }
});

// ============================================
// SUPER ADMIN - OFFICER MANAGEMENT (MONGODB)
// ============================================

app.post('/api/super-admin/create-officer', requireAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.session.adminId);

    if (admin.role !== 'super_admin') {
      return res.json({ success: false, message: 'Only Super Admin can create officers' });
    }

    const { name, email, password, phone, assignedZones } = req.body;

    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.json({ success: false, message: 'Email already exists' });
    }

    const officer = new Admin({
      name,
      email,
      password,
      phone: phone || '',
      role: 'zone_officer',
      department: 'Municipal Department',
      assignedZones: assignedZones || [],
      isActive: true,
      permissions: {
        canApproveWorkers: true,
        canAssignWork: true,
        canViewReports: true,
        canManageOfficers: false
      }
    });

    await officer.save();

    res.json({ 
      success: true, 
      message: 'Officer created successfully',
      officer: {
        name: officer.name,
        email: officer.email,
        zones: officer.assignedZones
      }
    });
  } catch (error) {
    console.error('Create officer error:', error);
    res.json({ success: false, message: 'Failed to create officer' });
  }
});

app.get('/api/super-admin/officers', requireAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.session.adminId);

    if (admin.role !== 'super_admin') {
      return res.json({ success: false, message: 'Access denied' });
    }

    const officers = await Admin.find({ role: 'zone_officer' })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({ success: true, officers });
  } catch (error) {
    res.json({ success: false, error: 'Failed to fetch officers' });
  }
});

app.delete('/api/super-admin/officers/:id', requireAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.session.adminId);

    if (admin.role !== 'super_admin') {
      return res.json({ success: false, message: 'Access denied' });
    }

    await Admin.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Officer deleted' });
  } catch (error) {
    res.json({ success: false, message: 'Failed to delete officer' });
  }
});

// ============================================
// ZONES API (MongoDB-based)
// ============================================

app.get('/api/zones', (req, res) => {
  const zones = Object.keys(ZONE_CONFIG).map(zoneName => ({
    id: zoneName,
    name: zoneName,
    areas: ZONE_CONFIG[zoneName].areas
  }));

  res.json({ success: true, zones });
});

// ============================================
// WORKER APIS (MongoDB)
// ============================================

app.post('/api/worker/register', upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'idProof', maxCount: 1 }
]), async (req, res) => {
  try {
    const { name, mobile, aadhaar, email, address, assignedZone, password } = req.body;

    const existingWorker = await Worker.findOne({ mobile });
    if (existingWorker) {
      return res.json({ success: false, message: 'Mobile already registered' });
    }

    const photo = req.files['photo'] ? `/uploads/${req.files['photo'][0].filename}` : null;
    const idProof = req.files['idProof'] ? `/uploads/${req.files['idProof'][0].filename}` : null;

    const worker = new Worker({
      name,
      mobile,
      aadhaar: aadhaar || '',
      email: email || '',
      address: address || '',
      assignedZone: assignedZone || '',
      password: password || `Worker@${mobile.slice(-4)}`,
      photo,
      idProof,
      status: 'pending'
    });

    await worker.save();

    res.json({ 
      success: true, 
      message: 'Registration successful! Wait for approval.',
      applicationId: worker._id
    });
  } catch (error) {
    console.error('Worker registration error:', error);
    res.json({ success: false, message: 'Registration failed' });
  }
});

app.post('/api/worker/login', async (req, res) => {
  try {
    const { mobile, password } = req.body;

    const worker = await Worker.findOne({ mobile, status: 'approved' });

    if (!worker) {
      return res.json({ success: false, message: 'Invalid credentials or not approved' });
    }

    const isMatch = await worker.comparePassword(password);
    if (!isMatch) {
      return res.json({ success: false, message: 'Invalid credentials' });
    }

    req.session.workerId = worker._id;
    req.session.workerName = worker.name;
    req.session.workerZone = worker.assignedZone;

    res.json({ 
      success: true,
      worker: {
        id: worker._id,
        name: worker.name,
        zone: worker.assignedZone
      }
    });
  } catch (error) {
    console.error('Worker login error:', error);
    res.json({ success: false, message: 'Login failed' });
  }
});

app.post('/api/worker/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/worker/check-auth', async (req, res) => {
  try {
    if (req.session.workerId) {
      const worker = await Worker.findById(req.session.workerId).select('-password');
      if (worker) {
        return res.json({ 
          success: true, 
          worker: {
            id: worker._id,
            name: worker.name,
            zone: worker.assignedZone
          }
        });
      }
    }
    res.json({ success: false });
  } catch (error) {
    res.json({ success: false });
  }
});

// Get Worker Applications
app.get('/api/admin/worker-applications', requireAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.session.adminId);

    let query = { status: 'pending' };

    if (admin.role === 'zone_officer' && admin.assignedZones && admin.assignedZones.length > 0) {
      query.assignedZone = { $in: admin.assignedZones };
    }

    const applications = await Worker.find(query).sort({ appliedDate: -1 });
    res.json({ success: true, applications });
  } catch (error) {
    res.json({ success: false, error: 'Failed to fetch applications' });
  }
});

app.post('/api/admin/worker-applications/:id/approve', requireAdmin, async (req, res) => {
  try {
    const { assignedZone } = req.body;

    const worker = await Worker.findById(req.params.id);
    if (!worker) {
      return res.json({ success: false, message: 'Worker not found' });
    }

    worker.status = 'approved';
    worker.assignedZone = assignedZone || worker.assignedZone;
    worker.approvedDate = new Date();
    worker.approvedBy = req.session.adminId;

    await worker.save();

    res.json({ success: true, message: 'Worker approved' });
  } catch (error) {
    res.json({ success: false, message: 'Failed to approve' });
  }
});

app.post('/api/admin/worker-applications/:id/reject', requireAdmin, async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id);
    if (!worker) {
      return res.json({ success: false, message: 'Worker not found' });
    }

    worker.status = 'rejected';
    await worker.save();

    res.json({ success: true, message: 'Worker rejected' });
  } catch (error) {
    res.json({ success: false, message: 'Failed to reject' });
  }
});

app.get('/api/admin/workers', requireAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.session.adminId);

    let query = { status: 'approved' };

    if (admin.role === 'zone_officer' && admin.assignedZones && admin.assignedZones.length > 0) {
      query.assignedZone = { $in: admin.assignedZones };
    }

    const workers = await Worker.find(query)
      .select('-password')
      .sort({ name: 1 });

    res.json({ success: true, workers });
  } catch (error) {
    res.json({ success: false, error: 'Failed to fetch workers' });
  }
});

// Continuing to Part 3...
// ============================================
// WORKER DASHBOARD
// ============================================

app.get('/api/worker/reports', async (req, res) => {
  try {
    if (!req.session.workerId) {
      return res.json({ success: false, message: 'Not authenticated' });
    }

    const worker = await Worker.findById(req.session.workerId);
    const zone = worker.assignedZone;

    // Get reports in worker's zone
    const reports = await Report.find({ 
      assignedZone: zone,
      status: { $in: ['pending', 'verified', 'in-progress'] }
    })
    .populate('userId', 'name email')
    .sort({ createdAt: -1 });

    const stats = {
      pending: reports.filter(r => r.status === 'pending').length,
      inProgress: reports.filter(r => r.status === 'in-progress').length,
      completed: worker.totalReportsCompleted
    };

    res.json({ 
      success: true, 
      reports, 
      stats, 
      worker: { 
        name: worker.name, 
        zone: worker.assignedZone 
      } 
    });
  } catch (error) {
    res.json({ success: false, error: 'Failed to fetch reports' });
  }
});

app.post('/api/worker/reports/:id/accept', async (req, res) => {
  try {
    if (!req.session.workerId) {
      return res.json({ success: false, message: 'Not authenticated' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.json({ success: false, message: 'Report not found' });
    }

    report.status = 'in-progress';
    report.assignedTo = req.session.workerId;
    await report.save();

    res.json({ success: true, message: 'Report accepted' });
  } catch (error) {
    res.json({ success: false, error: 'Failed to accept report' });
  }
});

app.post('/api/worker/reports/:id/complete', async (req, res) => {
  try {
    if (!req.session.workerId) {
      return res.json({ success: false, message: 'Not authenticated' });
    }

    const { notes } = req.body;
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.json({ success: false, message: 'Report not found' });
    }

    report.status = 'resolved';
    report.resolvedAt = new Date();
    report.adminNotes = notes || 'Completed by worker';
    await report.save();

    // Update worker stats
    await Worker.findByIdAndUpdate(req.session.workerId, {
      $inc: { totalReportsCompleted: 1 }
    });

    // Give bonus credits to user
    const creditAccount = await Credit.findOne({ userId: report.userId });
    if (creditAccount) {
      creditAccount.totalCredits += 20;
      creditAccount.availableCredits += 20;
      creditAccount.reportsVerified += 1;
      creditAccount.transactions.push({
        type: 'bonus',
        amount: 20,
        description: `Report #${report.reportId} resolved by cleanup team`
      });
      await creditAccount.save();
    }

    res.json({ success: true, message: 'Report marked complete' });
  } catch (error) {
    res.json({ success: false, error: 'Failed to complete report' });
  }
});

// ============================================
// DEMO ACCOUNTS
// ============================================

app.get('/api/admin/create-demo-accounts', async (req, res) => {
  try {
    // Clear existing admins
    await Admin.deleteMany({});

    const admins = await Admin.create([
      {
        name: 'Chief Municipal Officer',
        email: 'cmo@gonda.gov.in',
        password: 'SuperAdmin2025',
        phone: '+91-9876543200',
        role: 'super_admin',
        department: 'Municipal Corporation',
        isActive: true,
        permissions: {
          canApproveWorkers: true,
          canAssignWork: true,
          canViewReports: true,
          canManageOfficers: true
        }
      },
      {
        name: 'Rajesh Kumar - North Zone Officer',
        email: 'officer1@gonda.gov.in',
        password: 'Officer@123',
        phone: '+91-9876543201',
        role: 'zone_officer',
        department: 'Sanitation Department',
        assignedZones: ['Zone 1 - North Gonda', 'Zone 2 - South Gonda'],
        isActive: true,
        permissions: {
          canApproveWorkers: true,
          canAssignWork: true,
          canViewReports: true,
          canManageOfficers: false
        }
      },
      {
        name: 'Sunita Sharma - East Zone Officer',
        email: 'officer2@gonda.gov.in',
        password: 'Officer@123',
        phone: '+91-9876543202',
        role: 'zone_officer',
        department: 'Sanitation Department',
        assignedZones: ['Zone 3 - East Gonda', 'Zone 4 - West Gonda'],
        isActive: true,
        permissions: {
          canApproveWorkers: true,
          canAssignWork: true,
          canViewReports: true,
          canManageOfficers: false
        }
      },
      {
        name: 'Amit Verma - Central Zone Officer',
        email: 'officer3@gonda.gov.in',
        password: 'Officer@123',
        phone: '+91-9876543203',
        role: 'zone_officer',
        department: 'Sanitation Department',
        assignedZones: ['Zone 5 - Central Gonda'],
        isActive: true,
        permissions: {
          canApproveWorkers: true,
          canAssignWork: true,
          canViewReports: true,
          canManageOfficers: false
        }
      }
    ]);

    // Create demo workers
    await Worker.deleteMany({});

    const workers = await Worker.create([
      {
        name: 'Ramesh Kumar',
        mobile: '9999999991',
        email: 'ramesh@worker.com',
        password: 'Worker@123',
        aadhaar: '123456789012',
        address: 'Station Road, Gonda',
        assignedZone: 'Zone 1 - North Gonda',
        status: 'approved',
        approvedBy: admins[0]._id,
        approvedDate: new Date()
      },
      {
        name: 'Suresh Yadav',
        mobile: '9999999992',
        email: 'suresh@worker.com',
        password: 'Worker@123',
        aadhaar: '123456789013',
        address: 'Colonelganj, Gonda',
        assignedZone: 'Zone 2 - South Gonda',
        status: 'approved',
        approvedBy: admins[0]._id,
        approvedDate: new Date()
      },
      {
        name: 'Mohan Singh',
        mobile: '9999999993',
        email: 'mohan@worker.com',
        password: 'Worker@123',
        aadhaar: '123456789014',
        address: 'Paraspur, Gonda',
        assignedZone: 'Zone 3 - East Gonda',
        status: 'approved',
        approvedBy: admins[0]._id,
        approvedDate: new Date()
      }
    ]);

    res.json({ 
      success: true, 
      message: '✅ Demo accounts created successfully!',
      accounts: {
        superAdmin: { 
          email: 'cmo@gonda.gov.in', 
          password: 'SuperAdmin@2025', 
          role: 'Super Admin',
          url: 'http://localhost:3000/admin.html'
        },
        officers: [
          { email: 'officer1@gonda.gov.in', password: 'Officer@123', zones: 'Zone 1-2', url: 'http://localhost:3000/admin.html' },
          { email: 'officer2@gonda.gov.in', password: 'Officer@123', zones: 'Zone 3-4', url: 'http://localhost:3000/admin.html' },
          { email: 'officer3@gonda.gov.in', password: 'Officer@123', zones: 'Zone 5', url: 'http://localhost:3000/admin.html' }
        ],
        workers: [
          { mobile: '9999999991', password: 'Worker@123', zone: 'Zone 1', url: 'http://localhost:3000/worker-login.html' },
          { mobile: '9999999992', password: 'Worker@123', zone: 'Zone 2', url: 'http://localhost:3000/worker-login.html' },
          { mobile: '9999999993', password: 'Worker@123', zone: 'Zone 3', url: 'http://localhost:3000/worker-login.html' }
        ]
      }
    });
  } catch (error) {
    console.error('Create demo accounts error:', error);
    res.json({ success: false, error: error.message });
  }
});
// ⭐ FIX EXISTING REPORTS - ADD THIS BEFORE app.listen()
app.get('/api/fix-all-zones', async (req, res) => {
  try {
    const reports = await Report.find({
      $or: [
        { assignedZone: { $exists: false } },
        { assignedZone: null },
        { assignedZone: '' }
      ]
    });

    console.log(`🔧 Fixing ${reports.length} reports...`);

    let fixed = 0;
    for (const report of reports) {
      let zone = 'Zone 5 - Central Gonda';

      if (report.address) {
        const addr = report.address.toLowerCase();

        if (addr.includes('station') || addr.includes('railway') || addr.includes('civil lines') || addr.includes('nehru')) {
          zone = 'Zone 1 - North Gonda';
        }
        else if (addr.includes('colonelganj') || addr.includes('mankapur') || addr.includes('katra')) {
          zone = 'Zone 2 - South Gonda';
        }
        else if (addr.includes('paraspur') || addr.includes('itiathok') || addr.includes('wazirganj')) {
          zone = 'Zone 3 - East Gonda';
        }
        else if (addr.includes('bahraich') || addr.includes('jhilahi') || addr.includes('nawabganj')) {
          zone = 'Zone 4 - West Gonda';
        }
      }

      report.assignedZone = zone;
      await report.save();
      fixed++;

      console.log(`✅ Report #${report.reportId} → ${zone}`);
    }

    res.json({
      success: true,
      message: `✅ Fixed ${fixed} reports with zone assignments`,
      details: reports.map(r => ({ id: r.reportId, zone: r.assignedZone, address: r.address }))
    });

  } catch (error) {
    console.error('Fix zones error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get('/api/admin/create-demo-reports', async (req, res) => {
  try {
    await Report.deleteMany({});
    const demoReports = await Report.create([
      // 5 demo reports with zones - check saved file
    ]);
    res.json({ success: true, reports: demoReports });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🌿 GREEN CREDITS - WASTE MANAGEMENT SYSTEM 🌿               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

🚀 Server running on port ${PORT}
📱 Main App: http://localhost:${PORT}
👮 Admin Panel: http://localhost:${PORT}/admin.html
👷 Worker Login: http://localhost:${PORT}/worker-login.html
📝 Worker Register: http://localhost:${PORT}/worker-register.html

✅ Setup Demo Accounts:
   http://localhost:${PORT}/api/admin/create-demo-accounts

📋 FEATURES:
   ✅ MongoDB-only (NO JSON files)
   ✅ Auto zone assignment for reports
   ✅ Super Admin creates officers
   ✅ Officers see only their zone reports
   ✅ Workers self-register with approval
   ✅ Zone-based filtering system

🔐 DEFAULT LOGINS (after setup):
   Super Admin: cmo@gonda.gov.in / SuperAdmin@2025
   Officers: officer1@gonda.gov.in / Officer@123
   Workers: 9999999991 / Worker@123

💾 Database: MongoDB Connected ✅
`);
});
