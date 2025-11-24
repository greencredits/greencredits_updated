import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from './models/Admin.js';

dotenv.config();

async function setupAccounts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
    
    // Clear existing admins
    await Admin.deleteMany({});
    console.log('🗑️  Cleared existing admins');
    
    // Create ONLY Super Admin
    const superAdmin = await Admin.create({
      name: 'Chief Municipal Officer',
      email: 'cmo@gonda.gov.in',
      password: 'SuperAdmin@2025',
      phone: '9876543200',
      role: 'super_admin',
      department: 'Municipal Corporation',
      isActive: true,
      permissions: {
        canApproveWorkers: true,
        canAssignWork: true,
        canViewReports: true,
        canManageOfficers: true
      }
    });
    
    console.log('\n🎉 SETUP COMPLETE!\n');
    console.log('🏛️  SUPER ADMIN LOGIN:');
    console.log('   Email: cmo@gonda.gov.in');
    console.log('   Password: SuperAdmin@2025\n');
    console.log('📋 NEXT STEPS:');
    console.log('   1. Run: npm start');
    console.log('   2. Login at: http://localhost:3000/admin.html');
    console.log('   3. Create Officers from admin panel\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Setup error:', error);
    process.exit(1);
  }
}

setupAccounts();
