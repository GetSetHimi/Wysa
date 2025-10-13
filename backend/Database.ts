import 'dotenv/config';
import { Sequelize } from 'sequelize';
import logger from './Services/logger';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  logger.warn('⚠️ DATABASE_URL not set. Please add it to your .env file.');
}

// Use Sequelize with Postgres (Neon) via connection string; require SSL for Neon
const sequelize = new Sequelize(DATABASE_URL || '', {
  dialect: 'postgres',
  logging: console.log,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
});

// Test connection once at import time
async function authenticateConnection() {
  try {
    await sequelize.authenticate();
    logger.info('✅ Connected to Postgres (Neon) successfully');
  } catch (error) {
    logger.error('❌ Postgres connection failed:', error);
  }
}


export default sequelize;