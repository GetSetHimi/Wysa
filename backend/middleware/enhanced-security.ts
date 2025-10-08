import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';

// Enhanced security middleware for production deployment

// 1. STRICT CORS Configuration
export const strictCorsOptions = {
  origin: (origin: string | undefined, callback: Function) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'https://your-production-domain.com',
      'https://www.your-production-domain.com'
    ].filter(Boolean);
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

// 2. Enhanced Rate Limiting
export const createStrictRateLimit = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: message || 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later.',
        retryAfter: Math.round(windowMs / 1000),
        timestamp: new Date().toISOString()
      });
    }
  });
};

// Production rate limits
export const authRateLimit = createStrictRateLimit(15 * 60 * 1000, 3, 'Too many authentication attempts');
export const apiRateLimit = createStrictRateLimit(15 * 60 * 1000, 50, 'Too many API requests');
export const uploadRateLimit = createStrictRateLimit(60 * 60 * 1000, 5, 'Too many file uploads');
export const strictApiRateLimit = createStrictRateLimit(5 * 60 * 1000, 20, 'Rate limit exceeded');

// 3. Enhanced Security Headers
export const enhancedSecurityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: [
        "'self'", 
        "https://generativelanguage.googleapis.com",
        "https://api.vapi.ai"
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
      blockAllMixedContent: []
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// 4. Request Size Limits
export const requestSizeLimits = {
  json: '10mb',
  urlencoded: '10mb',
  raw: '10mb'
};

// 5. Input Validation Schemas
export const validationSchemas = {
  // Enhanced auth schemas
  login: z.object({
    body: z.object({
      email: z.string().email('Invalid email format').max(255),
      password: z.string().min(8, 'Password must be at least 8 characters')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number')
    })
  }),
  
  signup: z.object({
    body: z.object({
      username: z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username must be less than 50 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'),
      email: z.string().email('Invalid email format').max(255),
      password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
      age: z.number().min(13, 'Must be at least 13 years old').max(120, 'Invalid age')
    })
  }),

  // File upload validation
  fileUpload: z.object({
    file: z.object({
      fieldname: z.string(),
      originalname: z.string().max(255),
      encoding: z.string(),
      mimetype: z.string().regex(/^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/),
      size: z.number().max(15 * 1024 * 1024, 'File size must be less than 15MB')
    })
  }),

  // Profile validation
  profile: z.object({
    body: z.object({
      desiredRole: z.string().min(2).max(100),
      weeklyHours: z.number().min(1).max(168),
      timezone: z.string().optional(),
      preferences: z.object({
        format: z.string().optional(),
        learningType: z.string().optional(),
        notifications: z.boolean().optional()
      }).optional()
    })
  })
};

// 6. File Upload Security
export const fileUploadSecurity = {
  allowedMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  maxFileSize: 15 * 1024 * 1024, // 15MB
  fileFilter: (req: Request, file: Express.Multer.File, cb: Function) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'), false);
    }
  }
};

// 7. SQL Injection Protection
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction) => {
  const dangerousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\b(OR|AND)\s+['"]\s*=\s*['"])/i,
    /(\b(OR|AND)\s+['"]\s*LIKE\s*['"])/i,
    /(\b(OR|AND)\s+['"]\s*IN\s*\([^)]*\))/i,
    /(\b(OR|AND)\s+['"]\s*BETWEEN\s+[^)]+\))/i,
    /(\b(OR|AND)\s+['"]\s*EXISTS\s*\([^)]*\))/i,
    /(\b(OR|AND)\s+['"]\s*NOT\s+EXISTS\s*\([^)]*\))/i,
    /(\b(OR|AND)\s+['"]\s*IS\s+NULL)/i,
    /(\b(OR|AND)\s+['"]\s*IS\s+NOT\s+NULL)/i
  ];

  const checkForInjection = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return dangerousPatterns.some(pattern => pattern.test(obj));
    }
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => checkForInjection(value));
    }
    return false;
  };

  if (checkForInjection(req.body) || checkForInjection(req.query) || checkForInjection(req.params)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid input detected'
    });
  }

  next();
};

// 8. XSS Protection
export const xssProtection = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeInput = (input: any): any => {
    if (typeof input === 'string') {
      return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }
    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = sanitizeInput(value);
      }
      return sanitized;
    }
    return input;
  };

  req.body = sanitizeInput(req.body);
  req.query = sanitizeInput(req.query);
  req.params = sanitizeInput(req.params);

  next();
};

// 9. Request Logging with Security Events
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };

    // Log security events
    if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 429) {
      console.warn('🚨 Security Event:', logData);
    } else {
      console.log('📊 Request:', logData);
    }

    return originalSend.call(this, data);
  };
  
  next();
};

// 10. Health Check with Security
export const secureHealthCheck = (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
};
