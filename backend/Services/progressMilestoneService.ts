import { Planner, User } from '../Models';
import { emailService } from './emailService';
import logger from './logger';

export interface MilestoneData {
  userId: number;
  plannerId: number;
  progress: number;
  milestone: string;
  message: string;
  isInterviewEligible: boolean;
}

export class ProgressMilestoneService {
  private readonly MILESTONES = [
    { progress: 25, name: 'Quarter Complete', message: 'Great start! You\'re 25% through your learning journey.' },
    { progress: 50, name: 'Halfway Point', message: 'Excellent progress! You\'ve completed half of your learning plan.' },
    { progress: 75, name: 'Three Quarters', message: 'Outstanding! You\'re 75% through your learning journey.' },
    { progress: 80, name: 'Interview Unlocked', message: 'Congratulations! You\'ve unlocked the mock interview feature.' },
    { progress: 90, name: 'Almost There', message: 'Fantastic! You\'re 90% complete. Keep up the great work!' },
    { progress: 100, name: 'Complete', message: 'Amazing! You\'ve completed your entire learning journey!' }
  ];

  /**
   * Check and handle progress milestones
   */
  async checkProgressMilestones(userId: number, plannerId: number, newProgress: number): Promise<MilestoneData[]> {
    try {
      const milestones: MilestoneData[] = [];
      
      // Get planner details
      const planner = await Planner.findByPk(plannerId);
      if (!planner) {
        return milestones;
      }

      // Check each milestone
      for (const milestone of this.MILESTONES) {
        if (newProgress >= milestone.progress) {
          // Check if this milestone was already achieved
          const wasAlreadyAchieved = await this.wasMilestoneAlreadyAchieved(
            userId, 
            plannerId, 
            milestone.progress
          );

          if (!wasAlreadyAchieved) {
            const milestoneData: MilestoneData = {
              userId,
              plannerId,
              progress: newProgress,
              milestone: milestone.name,
              message: milestone.message,
              isInterviewEligible: milestone.progress >= 80
            };

            milestones.push(milestoneData);

            // Send milestone notification
            await this.sendMilestoneNotification(milestoneData);

            // Mark milestone as achieved
            await this.markMilestoneAchieved(userId, plannerId, milestone.progress);
          }
        }
      }

      return milestones;
    } catch (error) {
      logger.error('Error checking progress milestones:', error);
      return [];
    }
  }

  /**
   * Send milestone notification email
   */
  private async sendMilestoneNotification(milestone: MilestoneData): Promise<boolean> {
    try {
      const user = await User.findByPk(milestone.userId);
      if (!user) {
        return false;
      }

      const emailContent = this.generateMilestoneEmailContent(milestone, user);
      
      const mailOptions = {
        from: `"Wysa AI Career Coach" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: `🎉 ${milestone.milestone} - ${milestone.progress}% Complete!`,
        html: emailContent
      };

      const result = await emailService['transporter']?.sendMail(mailOptions);
      logger.info(`Milestone notification sent for ${milestone.progress}% completion:`, result.messageId);
      
      return true;
    } catch (error) {
      logger.error('Failed to send milestone notification:', error);
      return false;
    }
  }

  /**
   * Generate milestone email content
   */
  private generateMilestoneEmailContent(milestone: MilestoneData, user: User): string {
    const progressBar = this.generateProgressBar(milestone.progress);
    const isInterviewMilestone = milestone.isInterviewEligible;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Progress Milestone</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px;">🎉 ${milestone.milestone}!</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">${milestone.message}</p>
        </div>

        <div style="background: #fff; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
            📊 Your Progress
          </h2>
          
          <div style="margin: 20px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span style="font-weight: bold; color: #333;">Learning Progress</span>
              <span style="font-weight: bold; color: #007bff;">${milestone.progress}%</span>
            </div>
            ${progressBar}
          </div>

          ${isInterviewMilestone ? `
            <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
              <h3 style="margin: 0 0 10px 0; color: #2d5a2d;">🎯 Interview Unlocked!</h3>
              <p style="margin: 0; color: #2d5a2d;">
                Congratulations! You've reached 80% completion and unlocked the mock interview feature. 
                A mock interview has been automatically scheduled for you.
              </p>
            </div>
          ` : ''}

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">💡 Keep Going!</h3>
            <p style="margin: 0; color: #666;">
              ${this.getMotivationalMessage(milestone.progress)}
            </p>
          </div>
        </div>

        <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">
          <p style="margin: 0 0 15px 0; color: #666; font-size: 16px;">Continue your learning journey</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" 
             style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
            🚀 Continue Learning
          </a>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="margin: 0; color: #999; font-size: 14px;">
            This email was sent by Wysa AI Career Coach<br>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="color: #007bff;">Visit our platform</a> | 
            <a href="#" style="color: #007bff;">Unsubscribe</a>
          </p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate progress bar HTML
   */
  private generateProgressBar(progress: number): string {
    const width = Math.min(100, Math.max(0, progress));
    const color = progress >= 80 ? '#28a745' : progress >= 50 ? '#ffc107' : '#007bff';
    
    return `
      <div style="background: #e9ecef; height: 20px; border-radius: 10px; overflow: hidden; position: relative;">
        <div style="background: linear-gradient(90deg, ${color}, ${color}dd); height: 100%; width: ${width}%; transition: width 0.3s ease; border-radius: 10px;"></div>
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: bold; color: #333; font-size: 12px;">
          ${progress}%
        </div>
      </div>
    `;
  }

  /**
   * Get motivational message based on progress
   */
  private getMotivationalMessage(progress: number): string {
    if (progress >= 100) {
      return "You've completed your entire learning journey! Time to apply your new skills in the real world.";
    } else if (progress >= 90) {
      return "You're almost at the finish line! Just a few more tasks to complete your learning journey.";
    } else if (progress >= 75) {
      return "You're in the final stretch! Your dedication is paying off. Keep pushing forward!";
    } else if (progress >= 50) {
      return "You're making excellent progress! You've completed more than half of your learning plan.";
    } else if (progress >= 25) {
      return "Great start! You're building momentum. Consistency is key to success.";
    } else {
      return "Every journey begins with a single step. You're on the right track!";
    }
  }

  /**
   * Check if milestone was already achieved
   */
  private async wasMilestoneAlreadyAchieved(userId: number, plannerId: number, progress: number): Promise<boolean> {
    // This would typically check a milestones table
    // For now, we'll use a simple approach with planner metadata
    try {
      const planner = await Planner.findByPk(plannerId);
      if (!planner || !planner.planJson) {
        return false;
      }

      const milestones = (planner.planJson as any).milestones || [];
      return milestones.includes(progress);
    } catch (error) {
      logger.error('Error checking milestone achievement:', error);
      return false;
    }
  }

  /**
   * Mark milestone as achieved
   */
  private async markMilestoneAchieved(userId: number, plannerId: number, progress: number): Promise<void> {
    try {
      const planner = await Planner.findByPk(plannerId);
      if (!planner) {
        return;
      }

      const planJson = planner.planJson as any || {};
      const milestones = planJson.milestones || [];
      
      if (!milestones.includes(progress)) {
        milestones.push(progress);
        planJson.milestones = milestones;
        planner.planJson = planJson;
        await planner.save();
      }
    } catch (error) {
      logger.error('Error marking milestone as achieved:', error);
    }
  }

  /**
   * Get user's milestone history
   */
  async getUserMilestones(userId: number, plannerId?: number): Promise<MilestoneData[]> {
    try {
      const planners = plannerId 
        ? [await Planner.findByPk(plannerId)]
        : await Planner.findAll({ where: { userId } });

      const milestones: MilestoneData[] = [];

      for (const planner of planners) {
        if (!planner || !planner.planJson) continue;

        const planJson = planner.planJson as any;
        const achievedMilestones = planJson.milestones || [];

        for (const progress of achievedMilestones) {
          const milestone = this.MILESTONES.find(m => m.progress === progress);
          if (milestone) {
            milestones.push({
              userId,
              plannerId: planner.id,
              progress,
              milestone: milestone.name,
              message: milestone.message,
              isInterviewEligible: progress >= 80
            });
          }
        }
      }

      return milestones.sort((a, b) => b.progress - a.progress);
    } catch (error) {
      logger.error('Error fetching user milestones:', error);
      return [];
    }
  }
}

// Export singleton instance
export const progressMilestoneService = new ProgressMilestoneService();
