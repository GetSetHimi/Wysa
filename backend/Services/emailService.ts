import nodemailer from 'nodemailer'
import logger from './logger'

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null
  private isConfigured = false

  constructor() {
    this.initializeTransporter()
  }

  private initializeTransporter() {
    try {
      const emailConfig: EmailConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || ''
        }
      }

      // Check if email is configured
      if (!emailConfig.auth.user || !emailConfig.auth.pass) {
        logger.warn('Email service not configured. SMTP_USER and SMTP_PASS environment variables are required.')
        return
      }

      this.transporter = nodemailer.createTransport(emailConfig)
      this.isConfigured = true
      logger.info('Email service initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize email service:', error)
    }
  }

  async sendPasswordResetEmail(email: string, resetLink: string, username: string): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      logger.warn('Email service not configured. Password reset link:', resetLink)
      return false
    }

    try {
      const mailOptions = {
        from: `"AI Career Coach" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Password Reset - AI Career Coach',
        html: this.generatePasswordResetTemplate(username, resetLink)
      }

      const result = await this.transporter.sendMail(mailOptions)
      logger.info('Password reset email sent successfully:', result.messageId)
      return true
    } catch (error) {
      logger.error('Failed to send password reset email:', error)
      return false
    }
  }

  async sendWelcomeEmail(email: string, username: string): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      logger.warn('Email service not configured. Welcome email not sent.')
      return false
    }

    try {
      const mailOptions = {
        from: `"AI Career Coach" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Welcome to AI Career Coach!',
        html: this.generateWelcomeTemplate(username)
      }

      const result = await this.transporter.sendMail(mailOptions)
      logger.info('Welcome email sent successfully:', result.messageId)
      return true
    } catch (error) {
      logger.error('Failed to send welcome email:', error)
      return false
    }
  }

  private generatePasswordResetTemplate(username: string, resetLink: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9fafb;
          }
          .container {
            background: white;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
          }
          .title {
            font-size: 20px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 20px;
          }
          .content {
            margin-bottom: 30px;
          }
          .button {
            display: inline-block;
            background-color: #2563eb;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            margin: 20px 0;
          }
          .button:hover {
            background-color: #1d4ed8;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 14px;
            color: #6b7280;
          }
          .warning {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 12px;
            margin: 20px 0;
            font-size: 14px;
            color: #92400e;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">AI Career Coach</div>
          </div>
          
          <h1 class="title">Password Reset Request</h1>
          
          <div class="content">
            <p>Hello ${username},</p>
            
            <p>We received a request to reset your password for your AI Career Coach account. If you made this request, click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </div>
            
            <div class="warning">
              <strong>Important:</strong> This link will expire in 15 minutes for security reasons. If you don't reset your password within this time, you'll need to request a new reset link.
            </div>
            
            <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            
            <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #6b7280; font-size: 14px;">${resetLink}</p>
          </div>
          
          <div class="footer">
            <p>This email was sent from AI Career Coach. If you have any questions, please contact our support team.</p>
            <p>© ${new Date().getFullYear()} AI Career Coach. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  private generateWelcomeTemplate(username: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to AI Career Coach</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9fafb;
          }
          .container {
            background: white;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
          }
          .title {
            font-size: 20px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 20px;
          }
          .content {
            margin-bottom: 30px;
          }
          .button {
            display: inline-block;
            background-color: #2563eb;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            margin: 20px 0;
          }
          .button:hover {
            background-color: #1d4ed8;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 14px;
            color: #6b7280;
          }
          .feature {
            margin: 15px 0;
            padding: 15px;
            background-color: #f8fafc;
            border-radius: 6px;
            border-left: 4px solid #2563eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">AI Career Coach</div>
          </div>
          
          <h1 class="title">Welcome to AI Career Coach!</h1>
          
          <div class="content">
            <p>Hello ${username},</p>
            
            <p>Welcome to AI Career Coach! We're excited to have you on board and help you advance your career with our AI-powered tools.</p>
            
            <p>Here's what you can do with your new account:</p>
            
            <div class="feature">
              <strong>📊 Dashboard</strong> - Track your career progress and insights
            </div>
            
            <div class="feature">
              <strong>📄 Resume Analysis</strong> - Upload your resume for AI-powered analysis and improvement suggestions
            </div>
            
            <div class="feature">
              <strong>📅 Learning Planner</strong> - Create personalized learning plans based on your career goals
            </div>
            
            <div class="feature">
              <strong>🎯 Interview Prep</strong> - Practice with AI-powered mock interviews
            </div>
            
            <div class="feature">
              <strong>📚 Resources</strong> - Access curated learning materials and study guides
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" class="button">Get Started</a>
            </div>
            
            <p>If you have any questions or need help getting started, don't hesitate to reach out to our support team.</p>
          </div>
          
          <div class="footer">
            <p>Thank you for choosing AI Career Coach!</p>
            <p>© ${new Date().getFullYear()} AI Career Coach. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  async sendDailyPlanEmail(userId: number, plannerId: number, dayIndex: number): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      logger.warn('Email service not configured. Daily plan email not sent.')
      return false
    }

    try {
      // Import User model dynamically to avoid circular dependencies
      const { User } = require('../Models')
      
      // Fetch user data
      const user = await User.findByPk(userId)
      if (!user) {
        logger.error('User not found for daily plan email:', userId)
        return false
      }

      const planData = {
        focus: `Day ${dayIndex + 1} of your learning plan`,
        duration: '2-3 hours',
        goals: 'Complete today\'s learning objectives'
      }

      const mailOptions = {
        from: `"AI Career Coach" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: 'Your Daily Learning Plan - AI Career Coach',
        html: this.generateDailyPlanTemplate(user.username, planData)
      }

      const result = await this.transporter.sendMail(mailOptions)
      logger.info('Daily plan email sent successfully:', result.messageId)
      return true
    } catch (error) {
      logger.error('Failed to send daily plan email:', error)
      return false
    }
  }

  async testEmailConfiguration(): Promise<boolean> {
    return this.testConnection()
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      return false
    }

    try {
      await this.transporter.verify()
      logger.info('Email service connection verified successfully')
      return true
    } catch (error) {
      logger.error('Email service connection failed:', error)
      return false
    }
  }

  private generateDailyPlanTemplate(username: string, planData: any): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Daily Learning Plan</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9fafb;
          }
          .container {
            background: white;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
          }
          .title {
            font-size: 20px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 20px;
          }
          .content {
            margin-bottom: 30px;
          }
          .plan-item {
            background-color: #f8fafc;
            border-radius: 6px;
            padding: 15px;
            margin: 10px 0;
            border-left: 4px solid #2563eb;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 14px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">AI Career Coach</div>
          </div>
          
          <h1 class="title">Your Daily Learning Plan</h1>
          
          <div class="content">
            <p>Hello ${username},</p>
            
            <p>Here's your personalized learning plan for today:</p>
            
            <div class="plan-item">
              <strong>📚 Today's Focus:</strong> ${planData.focus || 'Continue your learning journey'}
            </div>
            
            <div class="plan-item">
              <strong>⏰ Estimated Time:</strong> ${planData.duration || '2-3 hours'}
            </div>
            
            <div class="plan-item">
              <strong>🎯 Goals:</strong> ${planData.goals || 'Complete today\'s learning objectives'}
            </div>
            
            <p>Keep up the great work! Your consistent learning will help you achieve your career goals.</p>
          </div>
          
          <div class="footer">
            <p>This email was sent from AI Career Coach. Keep learning and growing!</p>
            <p>© ${new Date().getFullYear()} AI Career Coach. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }
}

export const emailService = new EmailService()
export default emailService