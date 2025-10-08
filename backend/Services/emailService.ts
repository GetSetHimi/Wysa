import nodemailer from 'nodemailer';
import path from 'path';
import { DailyPlanPdfService } from './pdfGeneratorService';
import { ResumeAnalysisPdfService } from './resumeAnalysisPdfService';
import { User, Profile, Planner } from '../Models';

// Email configuration interface
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

// Email template data interface
interface DailyPlanEmailData {
  userName: string;
  userEmail: string;
  timezone: string;
  todayTasks: Array<{
    title: string;
    description: string;
    duration_mins: number;
    resource_links: string[];
    status: string;
  }>;
  plannerProgress: number;
  plannerTitle: string;
  pdfPath?: string;
}

interface InterviewEmailData {
  userName: string;
  userEmail: string;
  interviewDate: string;
  interviewTime: string;
  preparationTips: string[];
  pdfPath?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private dailyPlanPdfService: DailyPlanPdfService;
  private resumeAnalysisPdfService: ResumeAnalysisPdfService;

  constructor() {
    // Initialize email transporter
    this.transporter = this.createTransporter();
    this.dailyPlanPdfService = new DailyPlanPdfService();
    this.resumeAnalysisPdfService = new ResumeAnalysisPdfService();
  }

  private createTransporter(): nodemailer.Transporter {
    const config: EmailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    };

    return nodemailer.createTransport(config);
  }

  /**
   * Send daily plan email to user
   */
  async sendDailyPlanEmail(userId: number, plannerId: number, dayIndex: number = 0): Promise<boolean> {
    try {
      // Fetch user and profile data
      const user = await User.findByPk(userId);
      const profile = await Profile.findOne({ where: { userId } });
      const planner = await Planner.findByPk(plannerId);

      if (!user || !profile || !planner) {
        throw new Error('User, profile, or planner not found');
      }

      // Generate PDF for daily plan
      const pdfFileName = await this.dailyPlanPdfService.generateDailyPlanPdf(
        plannerId,
        userId,
        dayIndex
      );

      // Build today's tasks from planner.planJson for email body
      const plan: any = (planner as any).planJson || null;
      let todayTasks: DailyPlanEmailData['todayTasks'] = [];
      if (plan && Array.isArray(plan.days)) {
        const todayDateString = new Date().toISOString().split('T')[0];
        const maxIndex = plan.days.reduce((max: number, d: any) => typeof d.dayIndex === 'number' ? Math.max(max, d.dayIndex) : max, 0);
        const clampedIndex = Math.min(dayIndex, maxIndex);
        let day = plan.days.find((d: any) => d && typeof d.dayIndex === 'number' && d.dayIndex === clampedIndex) ||
                  plan.days.find((d: any) => typeof d.date === 'string' && d.date === todayDateString) ||
                  plan.days[clampedIndex];
        const rawTasks = day && Array.isArray(day.tasks) ? day.tasks : [];
        todayTasks = rawTasks
          .filter((t: any) => t && typeof t.title === 'string' && t.title.trim().length > 0)
          .map((t: any) => ({
            title: String(t.title).trim(),
            description: typeof t.description === 'string' ? t.description : '',
            duration_mins: typeof t.durationMins === 'number' && Number.isFinite(t.durationMins)
              ? Math.max(15, Math.min(8 * 60, Math.round(t.durationMins)))
              : 0,
            resource_links: Array.isArray(t.resourceLinks)
              ? t.resourceLinks.filter((l: any) => typeof l === 'string' && l.trim().length > 0)
              : [],
            status: 'pending',
          }));
      }

      const emailData: DailyPlanEmailData = {
        userName: (user as any).name || 'User',
        userEmail: user.email,
        timezone: profile.timezone || 'UTC',
        todayTasks,
        plannerProgress: (planner as any).progress_percent || 0,
        plannerTitle: planner.role || 'Learning Plan',
        pdfPath: pdfFileName
      };

      // Generate email content
      const emailContent = this.generateDailyPlanEmailContent(emailData);

      // Send email
      const mailOptions = {
        from: `"Wysa AI Career Coach" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: `📚 Your Daily Learning Plan - Day ${dayIndex + 1}`,
        html: emailContent,
        attachments: pdfFileName ? [{
          filename: `daily-plan-day-${dayIndex + 1}.pdf`,
          path: path.join(__dirname, '../uploads', pdfFileName),
          contentType: 'application/pdf'
        }] : []
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Daily plan email sent successfully:', result.messageId);
      
      return true;
    } catch (error) {
      console.error('Failed to send daily plan email:', error);
      return false;
    }
  }

  /**
   * Send interview reminder email
   */
  async sendInterviewReminderEmail(userId: number, interviewId: number): Promise<boolean> {
    try {
      // This would be implemented when interview system is ready
      console.log('Interview reminder email functionality - to be implemented');
      return true;
    } catch (error) {
      console.error('Failed to send interview reminder email:', error);
      return false;
    }
  }

  /**
   * Send resume analysis report email
   */
  async sendResumeAnalysisEmail(userId: number, resumeId: number): Promise<boolean> {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate resume analysis PDF
      // This would need the analysis data from Gemini
      const emailContent = this.generateResumeAnalysisEmailContent((user as any).name || 'User');

      const mailOptions = {
        from: `"Wysa AI Career Coach" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: '📊 Your Resume Analysis Report is Ready!',
        html: emailContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Resume analysis email sent successfully:', result.messageId);
      
      return true;
    } catch (error) {
      console.error('Failed to send resume analysis email:', error);
      return false;
    }
  }

  /**
   * Generate HTML content for daily plan email
   */
  private generateDailyPlanEmailContent(data: DailyPlanEmailData): string {
    const tasksHtml = data.todayTasks.length > 0 ? data.todayTasks.map((task, index) => `
      <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #007bff;">
        <h3 style="margin: 0 0 10px 0; color: #333;">${index + 1}. ${task.title}</h3>
        <p style="margin: 5px 0; color: #666;">${task.description}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
          <span style="background: #e9ecef; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
            ⏱️ ${task.duration_mins} minutes
          </span>
          <span style="background: ${task.status === 'completed' ? '#d4edda' : '#fff3cd'};
                      color: ${task.status === 'completed' ? '#155724' : '#856404'};
                      padding: 4px 8px; border-radius: 4px; font-size: 12px;">
            ${task.status === 'completed' ? '✅ Completed' : '⏳ Pending'}
          </span>
        </div>
        ${task.resource_links.length > 0 ? `
          <div style="margin-top: 10px;">
            <strong>Resources:</strong>
            <ul style="margin: 5px 0; padding-left: 20px;">
              ${task.resource_links.map(link => `<li><a href="${link}" style="color: #007bff;">${link}</a></li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `).join('') : '<p style="text-align: center; color: #666; font-style: italic;">No specific tasks scheduled for today. Focus on your learning goals!</p>';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Daily Learning Plan</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px;">🎯 Your Daily Learning Plan</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Hello ${data.userName}! Ready to level up your skills?</p>
        </div>

        <div style="background: #fff; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
            📋 Today's Tasks
          </h2>
          ${tasksHtml}
        </div>

        <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px 0; color: #2d5a2d;">📈 Your Progress</h3>
          <div style="background: #fff; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0;">
            <div style="background: linear-gradient(90deg, #28a745, #20c997); height: 100%; width: ${data.plannerProgress}%; transition: width 0.3s ease;"></div>
          </div>
          <p style="margin: 5px 0 0 0; font-weight: bold; color: #2d5a2d;">${data.plannerProgress}% Complete</p>
        </div>

        ${data.pdfPath ? `
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
            <h3 style="margin: 0 0 15px 0; color: #333;">📄 Download Your Daily Plan</h3>
            <p style="margin: 0 0 15px 0; color: #666;">Get a detailed PDF version of your daily plan</p>
            <a href="#" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              📥 Download PDF
            </a>
          </div>
        ` : ''}

        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px 0; color: #856404;">💡 Pro Tip</h3>
          <p style="margin: 0; color: #856404;">
            Complete your tasks in order and take breaks between them. Consistency is key to mastering new skills!
          </p>
        </div>

        <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">
          <p style="margin: 0 0 15px 0; color: #666;">Ready to start your learning journey?</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" 
             style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
            🚀 Go to Dashboard
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
   * Generate HTML content for resume analysis email
   */
  private generateResumeAnalysisEmailContent(userName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Resume Analysis Report</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px;">📊 Resume Analysis Complete!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Hello ${userName}! Your personalized analysis is ready.</p>
        </div>

        <div style="background: #fff; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">🎯 What's Next?</h2>
          <p>Your resume has been analyzed and we've identified key areas for improvement. Check your dashboard to see:</p>
          <ul>
            <li>📈 Skills gap analysis</li>
            <li>🎯 Personalized learning recommendations</li>
            <li>📚 Customized study plan</li>
            <li>💼 Industry-specific insights</li>
          </ul>
        </div>

        <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" 
             style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
            📊 View Analysis Report
          </a>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Test email configuration
   */
  async testEmailConfiguration(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('✅ Email configuration is valid');
      return true;
    } catch (error) {
      console.error('❌ Email configuration failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
