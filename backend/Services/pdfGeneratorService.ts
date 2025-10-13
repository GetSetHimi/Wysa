import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { Planner, User } from '../Models';
import logger from './logger';

// PDF generation service for daily plans
interface TaskData {
  title: string;
  description?: string | null;
  durationMins?: number | null;
  resourceLinks?: string[] | null;
  status?: string;
}

export class DailyPlanPdfService {
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.resolve(__dirname, '../uploads');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Generate PDF for daily plan
   * @param plannerId - ID of the planner
   * @param userId - ID of the user
   * @param dayIndex - Which day of the plan (0-based)
   * @returns Promise<string> - Path to generated PDF file
   */
  async generateDailyPlanPdf(plannerId: number, userId: number, dayIndex: number = 0): Promise<string> {
    try {
      // Fetch planner and user data
      const planner = await Planner.findByPk(plannerId);
      const user = await User.findByPk(userId);
      
      if (!planner || !user) {
        throw new Error('Planner or user not found');
      }

      // Generate PDF filename
      const fileName = `daily-plan-${plannerId}-day-${dayIndex + 1}-${Date.now()}.pdf`;
      const filePath = path.join(this.uploadsDir, fileName);

      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });

      // Pipe to file
      doc.pipe(fs.createWriteStream(filePath));

      // Build today's tasks from planner.planJson
      const plan: any = (planner as any).planJson || null;
      let tasks: TaskData[] = [];
      if (plan && Array.isArray(plan.days)) {
        const todayDateString = new Date().toISOString().split('T')[0];
        const maxIndex = plan.days.reduce((max: number, d: any) => typeof d.dayIndex === 'number' ? Math.max(max, d.dayIndex) : max, 0);
        const clampedIndex = Math.min(dayIndex, maxIndex);
        let day = plan.days.find((d: any) => d && typeof d.dayIndex === 'number' && d.dayIndex === clampedIndex) ||
                  plan.days.find((d: any) => typeof d.date === 'string' && d.date === todayDateString) ||
                  plan.days[clampedIndex];

        const rawTasks = day && Array.isArray(day.tasks) ? day.tasks : [];
        tasks = rawTasks.map((t: any) => ({
          title: typeof t.title === 'string' ? t.title : 'Task',
          description: typeof t.description === 'string' ? t.description : null,
          durationMins: typeof t.durationMins === 'number' && Number.isFinite(t.durationMins)
            ? Math.max(15, Math.min(8 * 60, Math.round(t.durationMins)))
            : null,
          resourceLinks: Array.isArray(t.resourceLinks) ? t.resourceLinks.filter((l: any) => typeof l === 'string' && l.trim().length > 0) : null,
          status: 'pending',
        }));
      }

      // Add content to PDF
      this.addHeader(doc, user, planner, dayIndex);
      this.addTasksSection(doc, tasks);
      this.addProgressSection(doc, planner);
      this.addFooter(doc);

      // Finalize PDF
      doc.end();

      return new Promise((resolve, reject) => {
        doc.on('end', () => resolve(fileName));
        doc.on('error', reject);
      });

    } catch (error) {
      logger.error('Error generating daily plan PDF:', error);
      throw error;
    }
  }

  /**
   * Add header section to PDF
   */
  private addHeader(doc: any, user: User, planner: Planner, dayIndex: number): void {
    // Title
    doc.fontSize(24)
       .fillColor('#2c3e50')
       .text('Daily Learning Plan', 50, 50);

    // User info
    doc.fontSize(16)
       .fillColor('#34495e')
       .text(`Hello ${user.username}!`, 50, 90);

    // Plan info
    doc.fontSize(14)
       .fillColor('#7f8c8d')
       .text(`Role: ${planner.role}`, 50, 120)
       .text(`Day ${dayIndex + 1} of your learning journey`, 50, 140)
       .text(`Generated on: ${new Date().toLocaleDateString()}`, 50, 160);

    // Add a line separator
    doc.moveTo(50, 190)
       .lineTo(550, 190)
       .stroke('#bdc3c7');
  }

  /**
   * Add tasks section to PDF
   */
  private addTasksSection(doc: any, tasks: TaskData[]): void {
    let yPosition = 220;

    doc.fontSize(18)
       .fillColor('#2c3e50')
       .text('Today\'s Tasks', 50, yPosition);

    yPosition += 30;

    if (tasks.length === 0) {
      doc.fontSize(12)
         .fillColor('#7f8c8d')
         .text('No tasks scheduled for today. Enjoy your rest day!', 50, yPosition);
      return;
    }

    tasks.forEach((task, index) => {
      // Task title
      doc.fontSize(14)
         .fillColor('#2c3e50')
         .text(`${index + 1}. ${task.title}`, 70, yPosition);

      yPosition += 25;

      // Task description
      if (task.description) {
        doc.fontSize(10)
           .fillColor('#7f8c8d')
           .text(task.description, 90, yPosition, { width: 450 });
        yPosition += 20;
      }

      // Duration and status
      const duration = task.durationMins ? `${task.durationMins} minutes` : 'No time estimate';
      const status = task.status === 'completed' ? '✅ Completed' : '⏳ Pending';
      
      doc.fontSize(10)
         .fillColor('#3498db')
         .text(`Duration: ${duration}`, 90, yPosition)
         .text(`Status: ${status}`, 250, yPosition);

      yPosition += 20;

      // Resource links
      if (task.resourceLinks && Array.isArray(task.resourceLinks) && task.resourceLinks.length > 0) {
        doc.fontSize(10)
           .fillColor('#27ae60')
           .text('Resources:', 90, yPosition);
        
        yPosition += 15;
        
        task.resourceLinks.forEach((link: unknown) => {
          if (typeof link === 'string') {
            doc.text(`• ${link}`, 110, yPosition, { width: 400 });
            yPosition += 15;
          }
        });
      }

      yPosition += 20; // Space between tasks
    });
  }

  /**
   * Add progress section to PDF
   */
  private addProgressSection(doc: any, planner: Planner): void {
    const yPosition = doc.y + 20;

    doc.fontSize(16)
       .fillColor('#2c3e50')
       .text('Overall Progress', 50, yPosition);

    // Progress bar background
    const barY = yPosition + 30;
    doc.rect(50, barY, 400, 20)
       .fillColor('#ecf0f1')
       .fill();

    // Progress bar fill
    const progressWidth = (planner.progressPercent || 0) * 4; // 400px max width
    doc.rect(50, barY, progressWidth, 20)
       .fillColor('#3498db')
       .fill();

    // Progress percentage text
    doc.fontSize(12)
       .fillColor('#2c3e50')
       .text(`${planner.progressPercent || 0}% Complete`, 460, barY + 5);
  }

  /**
   * Add footer to PDF
   */
  private addFooter(doc: any): void {
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 50;

    doc.fontSize(10)
       .fillColor('#7f8c8d')
       .text('Generated by Wysa Learning Platform', 50, footerY)
       .text(`Page ${doc.page.number}`, 500, footerY);
  }

  /**
   * Get PDF file path for download
   */
  getPdfDownloadPath(fileName: string): string {
    return `/uploads/${fileName}`;
  }
}

// Export singleton instance
export const dailyPlanPdfService = new DailyPlanPdfService();
