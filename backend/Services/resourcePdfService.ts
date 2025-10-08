import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// PDF generation service for learning resources
export class ResourcePdfService {
  private uploadsDir: string;
  private resourcesDir: string;

  constructor() {
    this.uploadsDir = path.resolve(__dirname, '../uploads');
    this.resourcesDir = path.join(this.uploadsDir, 'resources');
    
    // Create directories if they don't exist
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    if (!fs.existsSync(this.resourcesDir)) {
      fs.mkdirSync(this.resourcesDir, { recursive: true });
    }
  }

  /**
   * Generate PDF for learning resource
   * @param title - Title of the resource
   * @param content - Main content (markdown or plain text)
   * @param type - Type of resource (study-guide, practice, reference)
   * @param metadata - Additional metadata
   * @returns Promise<string> - Path to generated PDF file
   */
  async generateResourcePdf(
    title: string, 
    content: string, 
    type: 'study-guide' | 'practice' | 'reference' = 'study-guide',
    metadata?: {
      author?: string;
      difficulty?: 'beginner' | 'intermediate' | 'advanced';
      estimatedTime?: string;
      tags?: string[];
    }
  ): Promise<string> {
    try {
      // Generate PDF filename
      const sanitizedTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-');
      const fileName = `${type}-${sanitizedTitle}-${Date.now()}.pdf`;
      const filePath = path.join(this.resourcesDir, fileName);

      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });
      
      // Pipe to file
      doc.pipe(fs.createWriteStream(filePath));

      // Add content to PDF
      this.addResourceHeader(doc, title, type, metadata);
      this.addResourceContent(doc, content);
      this.addResourceFooter(doc, metadata);

      // Finalize PDF
      doc.end();

      return new Promise((resolve, reject) => {
        doc.on('end', () => resolve(fileName));
        doc.on('error', reject);
      });

    } catch (error) {
      console.error('Error generating resource PDF:', error);
      throw error;
    }
  }

  /**
   * Generate practice exercise PDF
   * @param title - Title of the practice
   * @param exercises - Array of exercises
   * @param answers - Optional answers
   * @returns Promise<string> - Path to generated PDF file
   */
  async generatePracticePdf(
    title: string,
    exercises: Array<{
      question: string;
      type: 'multiple-choice' | 'coding' | 'essay' | 'fill-blank';
      options?: string[];
      points?: number;
    }>,
    answers?: Array<{
      questionIndex: number;
      answer: string;
      explanation?: string;
    }>
  ): Promise<string> {
    try {
      const fileName = `practice-${title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-')}-${Date.now()}.pdf`;
      const filePath = path.join(this.resourcesDir, fileName);

      const doc = new PDFDocument({ margin: 50 });
      doc.pipe(fs.createWriteStream(filePath));

      this.addPracticeHeader(doc, title);
      this.addPracticeExercises(doc, exercises);
      if (answers) {
        this.addPracticeAnswers(doc, answers);
      }
      this.addResourceFooter(doc);

      doc.end();

      return new Promise((resolve, reject) => {
        doc.on('end', () => resolve(fileName));
        doc.on('error', reject);
      });

    } catch (error) {
      console.error('Error generating practice PDF:', error);
      throw error;
    }
  }

  /**
   * Add resource header to PDF
   */
  private addResourceHeader(
    doc: any, 
    title: string, 
    type: string, 
    metadata?: any
  ): void {
    // Title
    doc.fontSize(24)
       .fillColor('#2c3e50')
       .text(title, 50, 50);

    // Type badge
    const typeColors = {
      'study-guide': '#3498db',
      'practice': '#e74c3c',
      'reference': '#27ae60'
    };
    
    doc.fontSize(12)
       .fillColor(typeColors[type as keyof typeof typeColors] || '#7f8c8d')
       .text(type.toUpperCase().replace('-', ' '), 50, 90);

    // Metadata
    let yPosition = 120;
    if (metadata?.author) {
      doc.fontSize(10)
         .fillColor('#7f8c8d')
         .text(`Author: ${metadata.author}`, 50, yPosition);
      yPosition += 20;
    }

    if (metadata?.difficulty) {
      doc.text(`Difficulty: ${metadata.difficulty}`, 50, yPosition);
      yPosition += 20;
    }

    if (metadata?.estimatedTime) {
      doc.text(`Estimated Time: ${metadata.estimatedTime}`, 50, yPosition);
      yPosition += 20;
    }

    if (metadata?.tags && metadata.tags.length > 0) {
      doc.text(`Tags: ${metadata.tags.join(', ')}`, 50, yPosition);
      yPosition += 20;
    }

    // Add a line separator
    doc.moveTo(50, yPosition + 10)
       .lineTo(550, yPosition + 10)
       .stroke('#bdc3c7');
  }

  /**
   * Add resource content to PDF
   */
  private addResourceContent(doc: any, content: string): void {
    const yPosition = doc.y + 30;

    // Simple markdown-like parsing
    const lines = content.split('\n');
    let currentY = yPosition;

    lines.forEach(line => {
      if (line.startsWith('# ')) {
        // Main heading
        doc.fontSize(16)
           .fillColor('#2c3e50')
           .text(line.substring(2), 50, currentY);
        currentY += 25;
      } else if (line.startsWith('## ')) {
        // Sub heading
        doc.fontSize(14)
           .fillColor('#34495e')
           .text(line.substring(3), 50, currentY);
        currentY += 20;
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // Bullet point
        doc.fontSize(10)
           .fillColor('#2c3e50')
           .text(`• ${line.substring(2)}`, 70, currentY);
        currentY += 15;
      } else if (line.trim() === '') {
        // Empty line
        currentY += 10;
      } else {
        // Regular text
        doc.fontSize(10)
           .fillColor('#2c3e50')
           .text(line, 50, currentY, { width: 500 });
        currentY += 15;
      }

      // Check if we need a new page
      if (currentY > doc.page.height - 100) {
        doc.addPage();
        currentY = 50;
      }
    });
  }

  /**
   * Add practice header to PDF
   */
  private addPracticeHeader(doc: any, title: string): void {
    doc.fontSize(24)
       .fillColor('#2c3e50')
       .text(title, 50, 50);

    doc.fontSize(16)
       .fillColor('#e74c3c')
       .text('Practice Exercises', 50, 90);

    doc.fontSize(12)
       .fillColor('#7f8c8d')
       .text(`Generated on: ${new Date().toLocaleDateString()}`, 50, 120);
  }

  /**
   * Add practice exercises to PDF
   */
  private addPracticeExercises(doc: any, exercises: any[]): void {
    let yPosition = 160;

    exercises.forEach((exercise, index) => {
      // Question number and text
      doc.fontSize(12)
         .fillColor('#2c3e50')
         .text(`${index + 1}. ${exercise.question}`, 50, yPosition, { width: 500 });
      
      yPosition += 20;

      // Points if specified
      if (exercise.points) {
        doc.fontSize(10)
           .fillColor('#7f8c8d')
           .text(`(${exercise.points} points)`, 50, yPosition);
        yPosition += 15;
      }

      // Multiple choice options
      if (exercise.type === 'multiple-choice' && exercise.options) {
        exercise.options.forEach((option: string, optIndex: number) => {
          doc.fontSize(10)
             .fillColor('#2c3e50')
             .text(`${String.fromCharCode(97 + optIndex)}. ${option}`, 70, yPosition);
          yPosition += 15;
        });
      }

      // Space for answer (for coding/essay questions)
      if (exercise.type === 'coding' || exercise.type === 'essay') {
        doc.fontSize(10)
           .fillColor('#7f8c8d')
           .text('Answer:', 50, yPosition);
        yPosition += 30; // Space for writing
      }

      yPosition += 20; // Space between questions
    });
  }

  /**
   * Add practice answers to PDF
   */
  private addPracticeAnswers(doc: any, answers: any[]): void {
    doc.addPage();
    
    doc.fontSize(18)
       .fillColor('#27ae60')
       .text('Answer Key', 50, 50);

    let yPosition = 90;

    answers.forEach((answer, index) => {
      doc.fontSize(12)
         .fillColor('#2c3e50')
         .text(`${index + 1}. ${answer.answer}`, 50, yPosition);
      
      yPosition += 20;

      if (answer.explanation) {
        doc.fontSize(10)
           .fillColor('#7f8c8d')
           .text(`Explanation: ${answer.explanation}`, 70, yPosition, { width: 450 });
        yPosition += 30;
      }

      yPosition += 10;
    });
  }

  /**
   * Add resource footer to PDF
   */
  private addResourceFooter(doc: any, metadata?: any): void {
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 50;

    doc.fontSize(10)
       .fillColor('#7f8c8d')
       .text('Wysa Learning Resources', 50, footerY)
       .text(`Page ${doc.page.number}`, 500, footerY);
  }

  /**
   * Get PDF file path for download
   */
  getPdfDownloadPath(fileName: string): string {
    return `/uploads/resources/${fileName}`;
  }

  /**
   * List all available resource PDFs
   */
  async listResourcePdfs(): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.resourcesDir);
      return files.filter(file => file.endsWith('.pdf'));
    } catch (error) {
      console.error('Error listing resource PDFs:', error);
      return [];
    }
  }
}

// Export singleton instance
export const resourcePdfService = new ResourcePdfService();
