import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// CORS configuration
export const corsOptions = {
  origin: [
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    process.env.FRONTEND_URL || 'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  optionsSuccessStatus: 200
};

// Rate limiting configuration
export const createRateLimit = (windowMs: number, max: number, message?: string) => {
  // Skip rate limiting entirely in development for easier testing
  if (process.env.NODE_ENV === 'development') {
    return (req: Request, res: Response, next: NextFunction) => {
      next();
    };
  }

  return rateLimit({
    windowMs,
    max,
    message: message || 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later.',
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });
};

// Different rate limits for different endpoints
// Much more lenient limits for development
const isDev = process.env.NODE_ENV === 'development';
export const authRateLimit = createRateLimit(15 * 60 * 1000, isDev ? 100 : 5, 'Too many authentication attempts, please try again later.');
export const apiRateLimit = createRateLimit(15 * 60 * 1000, isDev ? 2000 : 100, 'Too many API requests, please try again later.');
export const uploadRateLimit = createRateLimit(60 * 60 * 1000, isDev ? 200 : 10, 'Too many file uploads, please try again later.');

// Security headers configuration - less restrictive for development
export const securityHeaders = helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://generativelanguage.googleapis.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  } : false, // Disable CSP in development
  crossOriginEmbedderPolicy: false,
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false // Disable HSTS in development
});

// Compression configuration
export const compressionConfig = compression({
  level: 6,
  threshold: 1024,
  filter: (req: Request, res: Response) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
});

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    return originalSend.call(this, data);
  };
  
  next();
};

// Error handling middleware
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: isDevelopment ? err.errors : undefined
    });
  }
  
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Database validation error',
      errors: isDevelopment ? err.errors : undefined
    });
  }
  
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: 'Resource already exists'
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }
  
  // Default error response
  res.status(err.status || 500).json({
    success: false,
    message: isDevelopment ? err.message : 'Internal server error',
    ...(isDevelopment && { stack: err.stack })
  });
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
};
