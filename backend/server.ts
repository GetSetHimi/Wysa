import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import authController from './Controller/authController';
import sequelize from './Database';
import './Models'; 
import chatController from './Controller/chatController';
import resumeController from './Controller/resumeController';
import plannerController from './Controller/plannerController';
import profileController from './Controller/profileController';
import notificationController from './Controller/notificationController';
import pdfController from './Controller/pdfController';
import interviewController from './Controller/interviewController';
import { s3Controller } from './Controller/s3Controller';
import resourceController from './Controller/resourceController';
import { requireAuth } from './middleware/authMiddleware';
import { emailScheduler } from './Services/emailScheduler';

// Security and optimization middleware
import { 
  corsOptions, 
  securityHeaders, 
  compressionConfig, 
  requestLogger, 
  errorHandler, 
  notFoundHandler,
  apiRateLimit,
  uploadRateLimit
} from './middleware/security';
import cors from 'cors';
import logger from './Services/logger';

const app = express();

// Security middleware (order matters!)
app.use(securityHeaders);
app.use(cors(corsOptions));
// Explicitly set ACAO for allowed dev origins as a fallback
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;
  const allowed = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    process.env.FRONTEND_URL || 'http://localhost:5173'
  ];
  if (origin && allowed.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Vary', 'Origin');
  next();
});
app.use(compressionConfig);
app.use(requestLogger);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const uploadsDir = path.resolve(__dirname, './uploads');



if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Health check endpoint (public)
app.get('/', (_req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Public routes (no authentication required)
app.use('/api/auth', authController);
app.use('/api/chat', apiRateLimit, chatController);

// Protected routes (authentication required)
app.use('/api', requireAuth);
app.use('/api/profile', apiRateLimit, profileController);
app.use('/api/resume', uploadRateLimit, resumeController);
app.use('/api/planner', apiRateLimit, plannerController);
app.use('/api/notifications', apiRateLimit, notificationController);
app.use('/api/pdf', apiRateLimit, pdfController);
app.use('/api/interview', apiRateLimit, interviewController);
app.use('/api/s3', apiRateLimit, s3Controller);
app.use('/api/resources', apiRateLimit, resourceController);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 8080;

async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    logger.info('✅ Connected to Postgres (Neon) successfully');
    
    await sequelize.sync({ force: false, alter: false });
    logger.info('✅ Database synchronized successfully');
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

app.listen(PORT, () => {
    logger.info(`🚀 Server is running on port ${PORT}`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    initializeDatabase();
    
    // Initialize email scheduler
    logger.info('📧 Starting email scheduler...');
    emailScheduler.start();
    logger.info('✅ Email scheduler started successfully');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});


