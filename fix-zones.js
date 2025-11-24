// fix-zones.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Report from './models/Report.js';

dotenv.config();

async function fixZones() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
    
    const reports = await Report.find({
      $or: [
        { assignedZone: { $exists: false } },
        { assignedZone: null },
        { assignedZone: '' }
      ]
    });
    
    console.log(`\n🔧 Fixing ${reports.length} reports...\n`);
    
    let fixed = 0;
    
    for (const report of reports) {
      let zone = 'Zone 5 - Central Gonda';
      
      if (report.address) {
        const addr = report.address.toLowerCase();
        
        if (addr.includes('station') || addr.includes('railway') || addr.includes('civil lines') || addr.includes('nehru')) {
          zone = 'Zone 1 - North Gonda';
        }
        else if (addr.includes('colonelganj') || addr.includes('mankapur') || addr.includes('katra') || addr.includes('kotwali')) {
          zone = 'Zone 2 - South Gonda';
        }
        else if (addr.includes('paraspur') || addr.includes('itiathok') || addr.includes('wazirganj') || addr.includes('tarabganj')) {
          zone = 'Zone 3 - East Gonda';
        }
        else if (addr.includes('bahraich') || addr.includes('jhilahi') || addr.includes('nawabganj')) {
          zone = 'Zone 4 - West Gonda';
        }
      }
      
      report.assignedZone = zone;
      await report.save();
      fixed++;
      
      console.log(`✅ Report #${report.reportId} → ${zone} (${report.address?.substring(0, 40)}...)`);
    }
    
    console.log(`\n🎉 SUCCESS! Fixed ${fixed} reports\n`);
    
    // Verify
    const allReports = await Report.find({});
    const withZone = allReports.filter(r => r.assignedZone).length;
    const withoutZone = allReports.filter(r => !r.assignedZone).length;
    
    console.log('📊 VERIFICATION:');
    console.log(`✅ Reports WITH zone: ${withZone}`);
    console.log(`❌ Reports WITHOUT zone: ${withoutZone}\n`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixZones();
