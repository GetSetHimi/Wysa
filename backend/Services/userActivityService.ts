import { Request, Response, NextFunction } from 'express';
import { UserActivity } from '../Models';
import logger from '../Services/logger';

// Middleware to track user activity
export const trackUserActivity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Only track authenticated users
    if (req.user && req.user.id) {
      const userId = req.user.id;
      const sessionId = req.headers['x-session-id'] as string || null;
      const ipAddress = req.ip || req.connection.remoteAddress || null;
      const userAgent = req.headers['user-agent'] || null;

      // Update or create user activity record
      await UserActivity.upsert({
        userId,
        lastActiveAt: new Date(),
        sessionId,
        ipAddress,
        userAgent,
      });

      logger.debug(`User activity tracked for user ${userId}`);
    }
  } catch (error) {
    // Don't break the request if activity tracking fails
    logger.error('Error tracking user activity:', error);
  }
  
  next();
};

// Service to get active users statistics
export class UserActivityService {
  // Get users active in last X minutes
  static async getActiveUsers(minutes: number = 15): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
      
      const activeUsersCount = await UserActivity.count({
        where: {
          lastActiveAt: {
            [require('sequelize').Op.gte]: cutoffTime,
          },
        },
        distinct: true,
        col: 'userId',
      });

      return activeUsersCount;
    } catch (error) {
      logger.error('Error getting active users count:', error);
      return 0;
    }
  }

  // Get users active in last hour
  static async getActiveUsersLastHour(): Promise<number> {
    return this.getActiveUsers(60);
  }

  // Get users active in last day
  static async getActiveUsersLastDay(): Promise<number> {
    return this.getActiveUsers(24 * 60);
  }

  // Get detailed active users data
  static async getActiveUsersDetails(minutes: number = 15) {
    try {
      const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
      
      const activeUsers = await UserActivity.findAll({
        where: {
          lastActiveAt: {
            [require('sequelize').Op.gte]: cutoffTime,
          },
        },
        order: [['lastActiveAt', 'DESC']],
        limit: 100, // Limit to prevent large responses
      });

      return activeUsers;
    } catch (error) {
      logger.error('Error getting active users details:', error);
      return [];
    }
  }

  // Get user activity statistics
  static async getActivityStats() {
    try {
      const now = new Date();
      const last15Min = new Date(now.getTime() - 15 * 60 * 1000);
      const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
      const lastDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [active15Min, active1Hour, active1Day] = await Promise.all([
        this.getActiveUsers(15),
        this.getActiveUsers(60),
        this.getActiveUsers(24 * 60),
      ]);

      return {
        active15Min,
        active1Hour,
        active1Day,
        timestamp: now.toISOString(),
      };
    } catch (error) {
      logger.error('Error getting activity stats:', error);
      return {
        active15Min: 0,
        active1Hour: 0,
        active1Day: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
