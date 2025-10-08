import { Planner, Interview, User } from '../Models';
import { emailService } from './emailService';

export interface InterviewEligibilityResult {
  isEligible: boolean;
  currentProgress: number;
  requiredProgress: number;
  daysUntilEligible?: number;
  message: string;
}

export interface InterviewScheduleData {
  userId: number;
  plannerId: number;
  scheduledAt: Date;
  role: string;
  userEmail: string;
  userName: string;
}

export class InterviewEligibilityService {
  private readonly REQUIRED_PROGRESS = 80; // 80% completion required
  private readonly INTERVIEW_SCHEDULE_DAYS_AHEAD = 3; // Schedule interview 3 days ahead

  /**
   * Check if user is eligible for interview based on progress
   */
  async checkInterviewEligibility(userId: number, plannerId?: number): Promise<InterviewEligibilityResult> {
    try {
      // Find user's active planner
      let planner: Planner | null;
      
      if (plannerId) {
        planner = await Planner.findByPk(plannerId);
      } else {
        planner = await Planner.findOne({
          where: { userId },
          order: [['createdAt', 'DESC']]
        });
      }

      if (!planner) {
        return {
          isEligible: false,
          currentProgress: 0,
          requiredProgress: this.REQUIRED_PROGRESS,
          message: 'No active planner found'
        };
      }

      // Use planner progress directly (since we're removing task system)
      const currentProgress = planner.progressPercent || 0;
      const isEligible = currentProgress >= this.REQUIRED_PROGRESS;

      // Check if user already has a scheduled interview
      const existingInterview = await Interview.findOne({
        where: {
          userId,
          plannerId: planner.id,
          status: 'pending'
        }
      });

      if (existingInterview) {
        return {
          isEligible: false,
          currentProgress,
          requiredProgress: this.REQUIRED_PROGRESS,
          message: 'Interview already scheduled'
        };
      }

      // Calculate days until eligible based on planner progress
      let daysUntilEligible: number | undefined;
      if (!isEligible) {
        const progressNeeded = this.REQUIRED_PROGRESS - currentProgress;
        const progressPerDay = currentProgress / Math.max(1, this.getDaysSinceStart(planner.startDate));
        const estimatedDays = Math.ceil(progressNeeded / Math.max(1, progressPerDay));
        daysUntilEligible = Math.max(0, estimatedDays);
      }

      return {
        isEligible,
        currentProgress,
        requiredProgress: this.REQUIRED_PROGRESS,
        daysUntilEligible,
        message: isEligible
          ? 'Congratulations! You are eligible for a mock interview.'
          : `Complete ${this.REQUIRED_PROGRESS - currentProgress}% more to unlock interview`
      };

    } catch (error) {
      console.error('Error checking interview eligibility:', error);
      return {
        isEligible: false,
        currentProgress: 0,
        requiredProgress: this.REQUIRED_PROGRESS,
        message: 'Error checking eligibility'
      };
    }
  }
  async handleProgressMilestone(userId: number, plannerId: number, newProgress: number): Promise<boolean> {
    try {
      // Check if user just reached 80% completion
      if (newProgress >= this.REQUIRED_PROGRESS) {
        const eligibility = await this.checkInterviewEligibility(userId, plannerId);
        
        if (eligibility.isEligible) {
          console.log(`🎉 User ${userId} reached 80% completion! Scheduling interview...`);
          
          // Get user and planner details
          const user = await User.findByPk(userId);
          const planner = await Planner.findByPk(plannerId);
          
          if (!user || !planner) {
            console.error('User or planner not found for interview scheduling');
            return false;
          }

          // Schedule interview for 3 days from now
          const scheduledAt = new Date();
          scheduledAt.setDate(scheduledAt.getDate() + this.INTERVIEW_SCHEDULE_DAYS_AHEAD);

          // Create interview record
          const interview = await Interview.create({
            userId,
            plannerId,
            scheduledAt,
            status: 'pending'
          });

          // Send interview unlock notification email
          await this.sendInterviewUnlockEmail(userId, interview.id, {
            userName: (user as any).name || 'User',
            userEmail: user.email,
            role: planner.role,
            scheduledAt,
            progress: newProgress
          });

          console.log(`✅ Interview scheduled for user ${userId} on ${scheduledAt.toISOString()}`);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error handling progress milestone:', error);
      return false;
    }
  }

  /**
   * Send interview unlock notification email
   */
  private async sendInterviewUnlockEmail(
    userId: number, 
    interviewId: number, 
    data: {
      userName: string;
      userEmail: string;
      role: string;
      scheduledAt: Date;
      progress: number;
    }
  ): Promise<boolean> {
    try {
      const emailContent = this.generateInterviewUnlockEmailContent(data);
      
      const mailOptions = {
        from: `"Wysa AI Career Coach" <${process.env.SMTP_USER}>`,
        to: data.userEmail,
        subject: `🎉 Congratulations! You've Unlocked Mock Interview`,
        html: emailContent
      };

      const result = await emailService['transporter'].sendMail(mailOptions);
      console.log('Interview unlock email sent successfully:', result.messageId);
      
      return true;
    } catch (error) {
      console.error('Failed to send interview unlock email:', error);
      return false;
    }
  }

  /**
   * Generate interview unlock email content
   */
  private generateInterviewUnlockEmailContent(data: {
    userName: string;
    role: string;
    scheduledAt: Date;
    progress: number;
  }): string {
    const interviewDate = data.scheduledAt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const interviewTime = data.scheduledAt.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Interview Unlocked!</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px;">🎉 Congratulations!</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">You've completed ${data.progress}% of your learning journey!</p>
        </div>

        <div style="background: #fff; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0; border-bottom: 2px solid #28a745; padding-bottom: 10px;">
            🎯 Mock Interview Unlocked!
          </h2>
          
          <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #2d5a2d;">📅 Interview Details</h3>
            <p style="margin: 5px 0; font-size: 16px;"><strong>Role:</strong> ${data.role}</p>
            <p style="margin: 5px 0; font-size: 16px;"><strong>Date:</strong> ${interviewDate}</p>
            <p style="margin: 5px 0; font-size: 16px;"><strong>Time:</strong> ${interviewTime}</p>
          </div>

          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #856404;">💡 What to Expect</h3>
            <ul style="margin: 0; color: #856404; padding-left: 20px;">
              <li>AI-powered voice interview with realistic questions</li>
              <li>Role-specific technical and behavioral questions</li>
              <li>Real-time feedback and scoring</li>
              <li>Detailed performance report with improvement suggestions</li>
            </ul>
          </div>

          <div style="background: #d1ecf1; padding: 20px; border-radius: 8px; border-left: 4px solid #17a2b8; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #0c5460;">📚 Preparation Tips</h3>
            <ul style="margin: 0; color: #0c5460; padding-left: 20px;">
              <li>Review your completed learning materials</li>
              <li>Practice explaining your projects and experience</li>
              <li>Prepare examples of problem-solving scenarios</li>
              <li>Ensure you have a quiet environment for the call</li>
            </ul>
          </div>
        </div>

        <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">
          <p style="margin: 0 0 15px 0; color: #666; font-size: 16px;">Ready to showcase your skills?</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/interview" 
             style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
            🚀 View Interview Details
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
   * Get days since planner start date
   */
  private getDaysSinceStart(startDate: Date): number {
    const now = new Date();
    const diffTime = now.getTime() - startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get user's interview history
   */
  async getUserInterviewHistory(userId: number): Promise<Interview[]> {
    try {
      return await Interview.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']]
      });
    } catch (error) {
      console.error('Error fetching interview history:', error);
      return [];
    }
  }

  /**
   * Check if user can reschedule interview
   */
  async canRescheduleInterview(userId: number, interviewId: number): Promise<boolean> {
    try {
      const interview = await Interview.findByPk(interviewId);
      
      if (!interview || interview.userId !== userId) {
        return false;
      }

      // Can reschedule if interview is more than 24 hours away
      const now = new Date();
      const interviewTime = new Date(interview.scheduledAt);
      const hoursUntilInterview = (interviewTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      return hoursUntilInterview > 24;
    } catch (error) {
      console.error('Error checking reschedule eligibility:', error);
      return false;
    }
  }
}

// Export singleton instance
export const interviewEligibilityService = new InterviewEligibilityService();
