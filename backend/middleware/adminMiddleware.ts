import { Request, Response, NextFunction } from 'express';
import { User } from '../Models';
import logger from '../Services/logger';

// Get admin emails from environment variables
const getAdminEmails = (): string[] => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const additionalAdmins = process.env.ADMIN_EMAILS; // Comma-separated list
  
  const emails: string[] = [];
  
  if (adminEmail) {
    emails.push(adminEmail.toLowerCase());
  }
  
  if (additionalAdmins) {
    const additionalList = additionalAdmins.split(',').map(email => email.trim().toLowerCase());
    emails.push(...additionalList);
  }
  
  // Default admin emails if none configured
  if (emails.length === 0) {
    emails.push('admin@wysa.com');
    logger.warn('No admin emails configured in environment variables. Using default admin@wysa.com');
  }
  
  return emails;
};

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // First check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // Get user details from database
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Get admin emails from environment
    const adminEmails = getAdminEmails();
    
    // Check if user email is in admin list
    if (!adminEmails.includes(user.email.toLowerCase())) {
      logger.warn(`Non-admin user ${user.email} attempted to access admin dashboard`);
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    // Add admin flag to request
    req.user.isAdmin = true;
    next();
  } catch (error) {
    logger.error('Admin authentication error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};
