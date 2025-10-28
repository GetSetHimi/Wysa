#!/usr/bin/env node

/**
 * Database Setup Script for User Activity Tracking
 * Run this script to create the user_activities table
 */

import 'dotenv/config';
import sequelize from './Database';
import { UserActivity } from './Models';

async function setupDatabase() {
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');

    console.log('🔄 Creating user_activities table...');
    await UserActivity.sync({ force: false });
    console.log('✅ User activities table created/verified');

    console.log('🎉 Database setup completed successfully!');
    console.log('\n📊 You can now track active users with the following endpoints:');
    console.log('   GET /api/analytics/active-users - Active users (15 min)');
    console.log('   GET /api/analytics/active-users/:minutes - Active users for custom time');
    console.log('   GET /api/analytics/stats - Comprehensive stats');
    console.log('   GET /api/analytics/active-users-details/:minutes - Detailed user data');
    console.log('   GET /api/analytics/hourly-activity - Hourly activity for 24h');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the setup
setupDatabase();
