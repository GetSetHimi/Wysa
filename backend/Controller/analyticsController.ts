import express, { Request, Response } from 'express';
import { UserActivityService } from '../Services/userActivityService';
import { AdminSetupService } from '../Services/adminSetupService';
import { requireAuth } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/adminMiddleware';
import logger from '../Services/logger';

const analyticsController = express.Router();

// Get admin info - ADMIN ONLY
analyticsController.get('/admin-info', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminInfo = await AdminSetupService.getAdminInfo();
    
    res.json({
      success: true,
      data: {
        adminInfo,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error getting admin info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get admin info',
    });
  }
});

// Get active users count (last 15 minutes) - ADMIN ONLY
analyticsController.get('/active-users', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const activeUsers = await UserActivityService.getActiveUsers(15);
    
    res.json({
      success: true,
      data: {
        activeUsers,
        timeWindow: '15 minutes',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error getting active users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active users count',
    });
  }
});

// Get active users count for different time windows - ADMIN ONLY
analyticsController.get('/active-users/:minutes', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const minutes = parseInt(req.params.minutes, 10);
    
    if (isNaN(minutes) || minutes < 1 || minutes > 1440) { // Max 24 hours
      return res.status(400).json({
        success: false,
        message: 'Invalid minutes parameter. Must be between 1 and 1440.',
      });
    }

    const activeUsers = await UserActivityService.getActiveUsers(minutes);
    
    res.json({
      success: true,
      data: {
        activeUsers,
        timeWindow: `${minutes} minutes`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error getting active users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active users count',
    });
  }
});

// Get comprehensive activity statistics - ADMIN ONLY
analyticsController.get('/stats', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await UserActivityService.getActivityStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting activity stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get activity statistics',
    });
  }
});

// Get detailed active users data - ADMIN ONLY
analyticsController.get('/active-users-details/:minutes', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const minutes = parseInt(req.params.minutes, 10);
    
    if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
      return res.status(400).json({
        success: false,
        message: 'Invalid minutes parameter. Must be between 1 and 1440.',
      });
    }

    const activeUsersDetails = await UserActivityService.getActiveUsersDetails(minutes);
    
    res.json({
      success: true,
      data: {
        activeUsers: activeUsersDetails,
        timeWindow: `${minutes} minutes`,
        count: activeUsersDetails.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error getting active users details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active users details',
    });
  }
});

// Get hourly activity for the last 24 hours - ADMIN ONLY
analyticsController.get('/hourly-activity', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const hourlyData = [];
    const now = new Date();
    
    // Get data for last 24 hours, hour by hour
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      
      const activeUsers = await UserActivityService.getActiveUsers(60);
      
      hourlyData.push({
        hour: hourStart.getHours(),
        timestamp: hourStart.toISOString(),
        activeUsers,
      });
    }
    
    res.json({
      success: true,
      data: {
        hourlyActivity: hourlyData,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error getting hourly activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get hourly activity data',
    });
  }
});

export default analyticsController;
