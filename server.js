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

// ⭐ DEPLOYMENT: Trust proxy for Render
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

// ⭐ DEPLOYMENT: Session with production-ready cookie settings
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
// USER AUTHENTICATION ROUTES
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

    // Create initial credit account with welcome bonus
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

    // Mobile login - return JWT token
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

    // Web login - use session
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
// ADMIN AUTHENTICATION ROUTES
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

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.json({ success: false, error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

app.get('/api/admin/check-session', async (req, res) => {
  try {
    if (req.session.adminId) {
      const admin = await Admin.findById(req.session.adminId).select('-password');
      if (admin) {
        return res.json({
          loggedIn: true,
          admin: {
            id: admin._id,
            name: admin.name,
            role: admin.role,
            email: admin.email,
            department: admin.department,
            assignedZones: admin.assignedZones || []
          }
        });
      }
    }
    res.json({ loggedIn: false });
  } catch (error) {
    res.json({ loggedIn: false });
  }
});

// ============================================
// REPORT SUBMISSION ROUTES
// ============================================

app.post('/api/submit-report', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const { wasteType, description, latitude, longitude, address } = req.body;
    const userId = req.session.userId || req.user.userId;

    if (!req.file) {
      return res.json({ success: false, error: 'Photo is required' });
    }

    const detectedZone = detectZone(address, parseFloat(latitude), parseFloat(longitude));

    const report = new Report({
      userId,
      wasteType,
      description,
      location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address,
        zone: detectedZone
      },
      photo: `/uploads/${req.file.filename}`,
      status: 'pending'
    });

    await report.save();

    // Award credits for submission
    let creditAccount = await Credit.findOne({ userId });
    if (!creditAccount) {
      creditAccount = new Credit({ userId });
    }

    const creditsEarned = CREDIT_ACTIONS.REPORT_SUBMITTED;
    creditAccount.totalCredits += creditsEarned;
    creditAccount.availableCredits += creditsEarned;
    creditAccount.transactions.push({
      type: 'earn',
      amount: creditsEarned,
      reportId: report._id,
      description: 'Report submitted'
    });

    await creditAccount.save();

    // Check for badges
    const user = await User.findById(userId);
    if (user) {
      user.reportCount += 1;
      user.totalCredits = creditAccount.totalCredits;

      for (const badge of BADGE_CRITERIA) {
        if (!user.badges.includes(badge.key)) {
          if (user[badge.field] >= badge.threshold) {
            user.badges.push(badge.key);
          }
        }
      }

      await user.save();
    }

    res.json({
      success: true,
      message: 'Report submitted successfully',
      reportId: report._id,
      creditsEarned,
      zone: detectedZone
    });
  } catch (error) {
    console.error('Report submission error:', error);
    res.json({ success: false, error: 'Failed to submit report' });
  }
});

app.get('/api/my-reports', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId || req.user.userId;
    const reports = await Report.find({ userId })
      .sort({ createdAt: -1 })
      .select('-__v');

    res.json({ success: true, reports });
  } catch (error) {
    console.error('Fetch reports error:', error);
    res.json({ success: false, error: 'Failed to fetch reports' });
  }
});

// ============================================
// ADMIN REPORT MANAGEMENT
// ============================================

app.get('/api/admin/reports', requireAdmin, async (req, res) => {
  try {
    const { status, zone, startDate, endDate } = req.query;
    let query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (zone && zone !== 'all') {
      query['location.zone'] = zone;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const reports = await Report.find(query)
      .populate('userId', 'name email')
      .populate('assignedWorker', 'name mobile')
      .sort({ createdAt: -1 });

    res.json({ success: true, reports });
  } catch (error) {
    console.error('Fetch reports error:', error);
    res.json({ success: false, error: 'Failed to fetch reports' });
  }
});

app.put('/api/admin/reports/:id/verify', requireRole('admin', 'superadmin', 'super_admin'), async (req, res) => {
  try {
    const { status, rejectionReason, additionalCredits } = req.body;
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.json({ success: false, error: 'Report not found' });
    }

    if (report.status !== 'pending') {
      return res.json({ success: false, error: 'Report already processed' });
    }

    report.status = status;
    report.verifiedBy = req.session.adminId;
    report.verifiedAt = new Date();

    if (status === 'rejected') {
      report.rejectionReason = rejectionReason;
    }

    if (status === 'verified') {
      // Award verification bonus
      const creditAccount = await Credit.findOne({ userId: report.userId });
      if (creditAccount) {
        const bonusCredits = CREDIT_ACTIONS.REPORT_VERIFIED + (additionalCredits || 0);
        creditAccount.totalCredits += bonusCredits;
        creditAccount.availableCredits += bonusCredits;
        creditAccount.transactions.push({
          type: 'earn',
          amount: bonusCredits,
          reportId: report._id,
          description: 'Report verified'
        });
        await creditAccount.save();

        // Update user stats
        const user = await User.findById(report.userId);
        if (user) {
          user.totalCredits = creditAccount.totalCredits;
          await user.save();
        }
      }
    }

    await report.save();
    res.json({ success: true, message: 'Report updated successfully' });
  } catch (error) {
    console.error('Verify report error:', error);
    res.json({ success: false, error: 'Failed to verify report' });
  }
});

app.put('/api/admin/reports/:id/assign', requireRole('admin', 'superadmin', 'super_admin'), async (req, res) => {
  try {
    const { workerId } = req.body;
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.json({ success: false, error: 'Report not found' });
    }

    report.assignedWorker = workerId;
    report.status = 'assigned';
    await report.save();

    res.json({ success: true, message: 'Worker assigned successfully' });
  } catch (error) {
    console.error('Assign worker error:', error);
    res.json({ success: false, error: 'Failed to assign worker' });
  }
});

// ============================================
// CREDIT SYSTEM ROUTES
// ============================================

app.get('/api/credits/balance', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId || req.user.userId;
    let creditAccount = await Credit.findOne({ userId });

    if (!creditAccount) {
      creditAccount = new Credit({ userId });
      await creditAccount.save();
    }

    res.json({
      success: true,
      totalCredits: creditAccount.totalCredits,
      availableCredits: creditAccount.availableCredits,
      redeemedCredits: creditAccount.redeemedCredits
    });
  } catch (error) {
    console.error('Fetch credits error:', error);
    res.json({ success: false, error: 'Failed to fetch credits' });
  }
});

app.get('/api/credits/history', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId || req.user.userId;
    const creditAccount = await Credit.findOne({ userId })
      .populate('transactions.reportId', 'wasteType location');

    res.json({
      success: true,
      transactions: creditAccount ? creditAccount.transactions : []
    });
  } catch (error) {
    console.error('Fetch history error:', error);
    res.json({ success: false, error: 'Failed to fetch history' });
  }
});

app.post('/api/credits/redeem', requireAuth, async (req, res) => {
  try {
    const { amount, method, details } = req.body;
    const userId = req.session.userId || req.user.userId;

    const creditAccount = await Credit.findOne({ userId });
    if (!creditAccount || creditAccount.availableCredits < amount) {
      return res.json({ success: false, error: 'Insufficient credits' });
    }

    creditAccount.availableCredits -= amount;
    creditAccount.redeemedCredits += amount;
    creditAccount.transactions.push({
      type: 'redeem',
      amount: -amount,
      description: `Redeemed via ${method}`
    });

    await creditAccount.save();

    res.json({ success: true, message: 'Credits redeemed successfully' });
  } catch (error) {
    console.error('Redeem credits error:', error);
    res.json({ success: false, error: 'Failed to redeem credits' });
  }
});

// ============================================
// USER PROFILE & STATS
// ============================================

app.get('/api/user/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId || req.user.userId;
    const user = await User.findById(userId).select('-password');
    const creditAccount = await Credit.findOne({ userId });

    const reportStats = await Report.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      total: 0,
      verified: 0,
      pending: 0,
      rejected: 0
    };

    reportStats.forEach(stat => {
      stats[stat._id] = stat.count;
      stats.total += stat.count;
    });

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        badges: user.badges,
        reportCount: user.reportCount,
        totalCredits: user.totalCredits
      },
      credits: creditAccount ? {
        total: creditAccount.totalCredits,
        available: creditAccount.availableCredits,
        redeemed: creditAccount.redeemedCredits
      } : { total: 0, available: 0, redeemed: 0 },
      reportStats: stats
    });
  } catch (error) {
    console.error('Fetch profile error:', error);
    res.json({ success: false, error: 'Failed to fetch profile' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const topUsers = await User.find()
      .select('name totalCredits reportCount badges')
      .sort({ totalCredits: -1 })
      .limit(10);

    res.json({ success: true, leaderboard: topUsers });
  } catch (error) {
    console.error('Fetch leaderboard error:', error);
    res.json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

// ============================================
// WORKER MANAGEMENT ROUTES
// ============================================

app.post('/api/worker/register', async (req, res) => {
  try {
    const { name, mobile, email, password, zone } = req.body;

    const existingWorker = await Worker.findOne({ $or: [{ email }, { mobile }] });
    if (existingWorker) {
      return res.json({ success: false, error: 'Worker already registered' });
    }

    const worker = new Worker({
      name,
      mobile,
      email,
      password,
      assignedZones: [zone]
    });

    await worker.save();
    res.json({ success: true, message: 'Worker registered successfully' });
  } catch (error) {
    console.error('Worker registration error:', error);
    res.json({ success: false, error: 'Failed to register worker' });
  }
});

app.post('/api/worker/login', async (req, res) => {
  try {
    const { mobile, password } = req.body;

    const worker = await Worker.findOne({ mobile, isActive: true });
    if (!worker) {
      return res.json({ success: false, error: 'Invalid credentials' });
    }

    const isMatch = await worker.comparePassword(password);
    if (!isMatch) {
      return res.json({ success: false, error: 'Invalid credentials' });
    }

    req.session.workerId = worker._id;
    req.session.workerName = worker.name;

    res.json({
      success: true,
      worker: {
        id: worker._id,
        name: worker.name,
        mobile: worker.mobile,
        assignedZones: worker.assignedZones
      }
    });
  } catch (error) {
    console.error('Worker login error:', error);
    res.json({ success: false, error: 'Login failed' });
  }
});

app.get('/api/worker/assigned-reports', async (req, res) => {
  try {
    if (!req.session.workerId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const reports = await Report.find({
      assignedWorker: req.session.workerId,
      status: { $in: ['assigned', 'in-progress'] }
    })
    .populate('userId', 'name email')
    .sort({ createdAt: -1 });

    res.json({ success: true, reports });
  } catch (error) {
    console.error('Fetch assigned reports error:', error);
    res.json({ success: false, error: 'Failed to fetch reports' });
  }
});

app.put('/api/worker/reports/:id/update-status', async (req, res) => {
  try {
    if (!req.session.workerId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { status, completionNotes } = req.body;
    const report = await Report.findById(req.params.id);

    if (!report || report.assignedWorker.toString() !== req.session.workerId) {
      return res.json({ success: false, error: 'Report not found or unauthorized' });
    }

    report.status = status;
    if (status === 'completed') {
      report.completedAt = new Date();
      report.completionNotes = completionNotes;
    }

    await report.save();
    res.json({ success: true, message: 'Report status updated' });
  } catch (error) {
    console.error('Update report status error:', error);
    res.json({ success: false, error: 'Failed to update status' });
  }
});

// ============================================
// ADMIN DASHBOARD ANALYTICS
// ============================================

app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
  try {
    const totalReports = await Report.countDocuments();
    const verifiedReports = await Report.countDocuments({ status: 'verified' });
    const pendingReports = await Report.countDocuments({ status: 'pending' });
    const completedReports = await Report.countDocuments({ status: 'completed' });

    const totalUsers = await User.countDocuments();
    const totalWorkers = await Worker.countDocuments({ isActive: true });

    const creditStats = await Credit.aggregate([
      {
        $group: {
          _id: null,
          totalCreditsIssued: { $sum: '$totalCredits' },
          totalCreditsRedeemed: { $sum: '$redeemedCredits' }
        }
      }
    ]);

    const reportsByZone = await Report.aggregate([
      { $group: { _id: '$location.zone', count: { $sum: 1 } } }
    ]);

    const reportsByType = await Report.aggregate([
      { $group: { _id: '$wasteType', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      analytics: {
        reports: {
          total: totalReports,
          verified: verifiedReports,
          pending: pendingReports,
          completed: completedReports
        },
        users: totalUsers,
        workers: totalWorkers,
        credits: creditStats[0] || { totalCreditsIssued: 0, totalCreditsRedeemed: 0 },
        reportsByZone,
        reportsByType
      }
    });
  } catch (error) {
    console.error('Fetch analytics error:', error);
    res.json({ success: false, error: 'Failed to fetch analytics' });
  }
});

// ============================================
// SUPER ADMIN ROUTES
// ============================================

app.get('/api/super-admin/admins', requireSuperAdmin, async (req, res) => {
  try {
    const admins = await Admin.find().select('-password');
    res.json({ success: true, admins });
  } catch (error) {
    console.error('Fetch admins error:', error);
    res.json({ success: false, error: 'Failed to fetch admins' });
  }
});

app.post('/api/super-admin/admins', requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, password, role, department, assignedZones } = req.body;

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.json({ success: false, error: 'Email already exists' });
    }

    const admin = new Admin({
      name,
      email,
      password,
      role: role || 'admin',
      department,
      assignedZones: assignedZones || []
    });

    await admin.save();
    res.json({ success: true, message: 'Admin created successfully' });
  } catch (error) {
    console.error('Create admin error:', error);
    res.json({ success: false, error: 'Failed to create admin' });
  }
});

app.put('/api/super-admin/admins/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, role, department, assignedZones, isActive } = req.body;

    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.json({ success: false, error: 'Admin not found' });
    }

    if (name) admin.name = name;
    if (email) admin.email = email;
    if (role) admin.role = role;
    if (department) admin.department = department;
    if (assignedZones) admin.assignedZones = assignedZones;
    if (typeof isActive !== 'undefined') admin.isActive = isActive;

    await admin.save();
    res.json({ success: true, message: 'Admin updated successfully' });
  } catch (error) {
    console.error('Update admin error:', error);
    res.json({ success: false, error: 'Failed to update admin' });
  }
});

app.delete('/api/super-admin/admins/:id', requireSuperAdmin, async (req, res) => {
  try {
    await Admin.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Admin deleted successfully' });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.json({ success: false, error: 'Failed to delete admin' });
  }
});

app.get('/api/super-admin/workers', requireSuperAdmin, async (req, res) => {
  try {
    const workers = await Worker.find().select('-password');
    res.json({ success: true, workers });
  } catch (error) {
    console.error('Fetch workers error:', error);
    res.json({ success: false, error: 'Failed to fetch workers' });
  }
});

app.put('/api/super-admin/workers/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { name, mobile, email, assignedZones, isActive } = req.body;

    const worker = await Worker.findById(req.params.id);
    if (!worker) {
      return res.json({ success: false, error: 'Worker not found' });
    }

    if (name) worker.name = name;
    if (mobile) worker.mobile = mobile;
    if (email) worker.email = email;
    if (assignedZones) worker.assignedZones = assignedZones;
    if (typeof isActive !== 'undefined') worker.isActive = isActive;

    await worker.save();
    res.json({ success: true, message: 'Worker updated successfully' });
  } catch (error) {
    console.error('Update worker error:', error);
    res.json({ success: false, error: 'Failed to update worker' });
  }
});

// ============================================
// ZONE INFORMATION
// ============================================

app.get('/api/zones', (req, res) => {
  res.json({ success: true, zones: ZONE_CONFIG });
});

// ============================================
// HEALTH CHECK & ERROR HANDLING
// ============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
