import * as cron from 'node-cron';
import { emailService } from './emailService';
import { User, Profile, Planner } from '../Models';
import { Op } from 'sequelize';
import logger from './logger';

export class EmailScheduler {
  private isRunning: boolean = false;
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.initializeScheduler();
  }

  /**
   * Initialize all scheduled email jobs
   */
  private initializeScheduler(): void {
    logger.info('🕐 Initializing email scheduler...');
    
    // Schedule daily plan emails for all users
    this.scheduleDailyPlanEmails();
    
    // Schedule interview reminders (to be implemented)
    this.scheduleInterviewReminders();
    
    logger.info('✅ Email scheduler initialized successfully');
  }

  /**
   * Schedule daily plan emails for all users
   * Runs every day at 8:00 AM in each user's timezone
   */
  private scheduleDailyPlanEmails(): void {
    // This will run every hour to check for users in different timezones
    const job = cron.schedule('0 * * * *', async () => {
      if (this.isRunning) return;
      
      this.isRunning = true;
      logger.info('📧 Starting daily plan email job...');
      
      try {
        await this.sendDailyEmailsToUsers();
      } catch (error) {
        logger.error('❌ Error in daily plan email job:', error);
      } finally {
        this.isRunning = false;
      }
    }, {
      timezone: 'UTC'
    });

    this.jobs.set('daily-plan-emails', job);
    logger.info('📅 Daily plan emails scheduled (every hour)');
  }

  /**
   * Schedule interview reminder emails
   * Runs every 30 minutes to check for upcoming interviews
   */
  private scheduleInterviewReminders(): void {
    const job = cron.schedule('*/30 * * * *', async () => {
      logger.info('📞 Checking for interview reminders...');
      // TODO: Implement when interview system is ready
    }, {
      timezone: 'UTC'
    });

    this.jobs.set('interview-reminders', job);
    logger.info('📅 Interview reminders scheduled (every 30 minutes)');
  }

  /**
   * Send daily emails to users based on their timezone
   */
  private async sendDailyEmailsToUsers(): Promise<void> {
    try {
      // Get current UTC hour
      const currentHour = new Date().getUTCHours();
      
      // Find users whose local time is 8:00 AM (considering their timezone)
      const users = await User.findAll({
        include: [{
          model: Profile,
          as: 'Profile',
          where: {
            timezone: {
              [Op.ne]: null
            }
          }
        }]
      });

      for (const user of users) {
        try {
          const profile = (user as any).Profile;
          if (!profile || !profile.timezone) continue;

          // Calculate if it's 8 AM in user's timezone
          const userLocalHour = this.getLocalHourForTimezone(profile.timezone);
          
          if (userLocalHour === 8) {
            await this.sendDailyEmailToUser(user.id);
          }
        } catch (error) {
          logger.error(`❌ Failed to process user ${user.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('❌ Error in sendDailyEmailsToUsers:', error);
    }
  }

  /**
   * Send daily email to a specific user
   */
  private async sendDailyEmailToUser(userId: number): Promise<void> {
    try {
      // Find user's active planner
      const planner = await Planner.findOne({
        where: {
          userId,
          startDate: { [Op.lte]: new Date() },
          endDate: { [Op.gte]: new Date() }
        },
        order: [['createdAt', 'DESC']]
      });

      if (!planner) {
        logger.info(`⚠️ No active planner found for user ${userId}`);
        return;
      }

      // Calculate which day of the plan it is
      const dayIndex = this.calculateDayIndex(planner.startDate, planner.endDate);
      
      // Send daily plan email
      const success = await emailService.sendDailyPlanEmail(userId, planner.id, dayIndex);
      
      if (success) {
        logger.info(`✅ Daily plan email sent to user ${userId} (Day ${dayIndex + 1})`);
      } else {
        logger.info(`❌ Failed to send daily plan email to user ${userId}`);
      }
    } catch (error) {
      logger.error(`❌ Error sending daily email to user ${userId}:`, error);
    }
  }

  /**
   * Calculate local hour for a given timezone
   */
  private getLocalHourForTimezone(timezone: string): number {
    try {
      const now = new Date();
      const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      return localTime.getHours();
    } catch (error) {
      logger.error(`❌ Invalid timezone: ${timezone}`);
      return 0;
    }
  }

  /**
   * Calculate which day of the plan it is
   */
  private calculateDayIndex(startDate: Date, endDate: Date): number {
    const today = new Date();
    const start = new Date(startDate);
    const diffTime = today.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  /**
   * Manually trigger daily email for a specific user
   */
  async triggerDailyEmailForUser(userId: number): Promise<boolean> {
    try {
      await this.sendDailyEmailToUser(userId);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to trigger daily email for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Manually trigger daily emails for all users
   */
  async triggerDailyEmailsForAllUsers(): Promise<void> {
    logger.info('📧 Manually triggering daily emails for all users...');
    await this.sendDailyEmailsToUsers();
  }

  /**
   * Start all scheduled jobs
   */
  start(): void {
    this.jobs.forEach((job, name) => {
      job.start();
      logger.info(`▶️ Started job: ${name}`);
    });
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`⏹️ Stopped job: ${name}`);
    });
  }

  /**
   * Destroy all scheduled jobs
   */
  destroy(): void {
    this.jobs.forEach((job, name) => {
      job.destroy();
      logger.info(`🗑️ Destroyed job: ${name}`);
    });
    this.jobs.clear();
  }

  /**
   * Get status of all jobs
   */
  getStatus(): { [key: string]: boolean } {
    const status: { [key: string]: boolean } = {};
    this.jobs.forEach((job, name) => {
      status[name] = true; // Assume running if job exists
    });
    return status;
  }
}

// Export singleton instance
export const emailScheduler = new EmailScheduler();
