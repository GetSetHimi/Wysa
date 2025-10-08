import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

// Generic validation middleware
export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: (error as any).errors.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      }
      next(error);
    }
  };
};

// Common validation schemas
export const authSchemas = {
  login: z.object({
    body: z.object({
      email: z.string().email('Invalid email format'),
      password: z.string().min(6, 'Password must be at least 6 characters')
    })
  }),
  
  signup: z.object({
    body: z.object({
      username: z.string().min(3, 'Username must be at least 3 characters'),
      email: z.string().email('Invalid email format'),
      password: z.string().min(6, 'Password must be at least 6 characters')
    })
  })
};

export const profileSchemas = {
  create: z.object({
    body: z.object({
      desiredRole: z.string().min(1, 'Desired role is required'),
      weeklyHours: z.number().min(1).max(40, 'Weekly hours must be between 1 and 40'),
      timezone: z.string().optional(),
      preferences: z.object({
        format: z.enum(['video', 'article', 'mixed']).optional(),
        learningType: z.enum(['project_based', 'theory_focused', 'balanced']).optional(),
        notifications: z.boolean().optional()
      }).optional()
    })
  })
};

export const resumeSchemas = {
  upload: z.object({
    body: z.object({
      userId: z.number().optional()
    })
  }),
  
  parse: z.object({
    params: z.object({
      resumeId: z.string().regex(/^\d+$/, 'Invalid resume ID')
    }),
    body: z.object({
      desiredRole: z.string().optional(),
      experienceSummary: z.string().optional(),
      experienceYears: z.union([z.string(), z.number()]).optional(),
      additionalContext: z.string().optional()
    })
  })
};

export const plannerSchemas = {
  generate: z.object({
    body: z.object({
      role: z.string().optional(),
      startDate: z.string().optional(),
      durationDays: z.number().min(1).max(56).optional(),
      experienceSummary: z.string().optional(),
      focusAreas: z.array(z.string()).optional(),
      additionalContext: z.string().optional()
    })
  })
};

export const taskSchemas = {
  create: z.object({
    body: z.object({
      plannerId: z.number(),
      dayIndex: z.number().min(0).optional(),
      title: z.string().min(1, 'Title is required'),
      description: z.string().optional(),
      durationMins: z.number().min(15).max(480).optional(),
      resourceLinks: z.array(z.string().url()).optional()
    })
  }),
  
  complete: z.object({
    params: z.object({
      id: z.string().regex(/^\d+$/, 'Invalid task ID')
    })
  })
};

export const interviewSchemas = {
  schedule: z.object({
    body: z.object({
      plannerId: z.number().optional(),
      scheduledAt: z.string().optional(),
      phoneNumber: z.string().min(10, 'Valid phone number required')
    })
  }),
  
  start: z.object({
    params: z.object({
      id: z.string().regex(/^\d+$/, 'Invalid interview ID')
    }),
    body: z.object({
      phoneNumber: z.string().min(10, 'Valid phone number required')
    })
  })
};
