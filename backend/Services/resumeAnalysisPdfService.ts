import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { Resume } from '../Models';
import { ResumeAnalysisResult } from './resumeParserService';
import logger from './logger';

// PDF generation service for resume analysis reports
export class ResumeAnalysisPdfService {
  private uploadsDir: string;
  private reportsDir: string;

  constructor() {
    this.uploadsDir = path.resolve(__dirname, '../uploads');
    this.reportsDir = path.join(this.uploadsDir, 'reports');
    
    // Create directories if they don't exist
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Generate comprehensive resume analysis PDF report
   * @param resumeId - ID of the resume
   * @param analysis - Analysis result from Gemini
   * @returns Promise<string> - Path to generated PDF file
   */
  async generateResumeAnalysisPdf(resumeId: number, analysis: ResumeAnalysisResult): Promise<string> {
    try {
      // Fetch resume data
      const resume = await Resume.findByPk(resumeId);
      if (!resume) {
        throw new Error('Resume not found');
      }

      // Generate PDF filename
      const fileName = `resume-analysis-${resumeId}-${Date.now()}.pdf`;
      const filePath = path.join(this.reportsDir, fileName);

      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });
      
      // Pipe to file
      doc.pipe(fs.createWriteStream(filePath));

      // Add content to PDF
      this.addReportHeader(doc, resume);
      this.addExecutiveSummary(doc, analysis);
      this.addScoreAnalysis(doc, analysis);
      this.addSkillsAnalysis(doc, analysis);
      this.addGapAnalysis(doc, analysis);
      this.addRecommendations(doc, analysis);
      this.addLearningPaths(doc, analysis);
      this.addFooter(doc);

      // Finalize PDF
      doc.end();

      return new Promise((resolve, reject) => {
        doc.on('end', () => resolve(fileName));
        doc.on('error', reject);
      });

    } catch (error) {
      logger.error('Error generating resume analysis PDF:', error);
      throw error;
    }
  }

  /**
   * Add report header to PDF
   */
  private addReportHeader(doc: any, resume: Resume): void {
    // Title
    doc.fontSize(24)
       .fillColor('#2c3e50')
       .text('Resume Analysis Report', 50, 50);

    // Resume info
    doc.fontSize(14)
       .fillColor('#7f8c8d')
       .text(`Resume: ${resume.originalFileName}`, 50, 90)
       .text(`Generated on: ${new Date().toLocaleDateString()}`, 50, 110)
       .text(`File Size: ${(resume.fileSize / 1024).toFixed(2)} KB`, 50, 130);

    // Add a line separator
    doc.moveTo(50, 160)
       .lineTo(550, 160)
       .stroke('#bdc3c7');
  }

  /**
   * Add executive summary to PDF
   */
  private addExecutiveSummary(doc: any, analysis: ResumeAnalysisResult): void {
    let yPosition = 190;

    doc.fontSize(18)
       .fillColor('#2c3e50')
       .text('Executive Summary', 50, yPosition);

    yPosition += 30;

    // Summary text
    doc.fontSize(12)
       .fillColor('#2c3e50')
       .text(analysis.summary, 50, yPosition, { width: 500 });

    yPosition += 40;

    // Recruiter perspective
    if (analysis.recruiterPerspective) {
      doc.fontSize(14)
         .fillColor('#3498db')
         .text('Recruiter Perspective:', 50, yPosition);
      
      yPosition += 20;
      
      doc.fontSize(10)
         .fillColor('#2c3e50')
         .text(analysis.recruiterPerspective, 50, yPosition, { width: 500 });
      
      yPosition += 40;
    }

    // Hiring manager perspective
    if (analysis.hiringManagerPerspective) {
      doc.fontSize(14)
         .fillColor('#e74c3c')
         .text('Hiring Manager Perspective:', 50, yPosition);
      
      yPosition += 20;
      
      doc.fontSize(10)
         .fillColor('#2c3e50')
         .text(analysis.hiringManagerPerspective, 50, yPosition, { width: 500 });
    }
  }

  /**
   * Add score analysis to PDF
   */
  private addScoreAnalysis(doc: any, analysis: ResumeAnalysisResult): void {
    doc.addPage();
    
    let yPosition = 50;

    doc.fontSize(18)
       .fillColor('#2c3e50')
       .text('Performance Scores', 50, yPosition);

    yPosition += 40;

    // Score boxes
    const scores = [
      { name: 'ATS Score', value: analysis.scores.atsScore, color: '#3498db' },
      { name: 'Overall Fit', value: analysis.scores.overallFitScore, color: '#27ae60' },
      { name: 'Experience Alignment', value: analysis.scores.experienceAlignmentScore, color: '#e74c3c' }
    ];

    scores.forEach((score, index) => {
      const x = 50 + (index * 150);
      const y = yPosition;

      // Score box
      doc.rect(x, y, 120, 80)
         .fillColor(score.color)
         .fill()
         .stroke();

      // Score value
      doc.fontSize(24)
         .fillColor('white')
         .text(`${score.value}%`, x + 10, y + 20);

      // Score name
      doc.fontSize(10)
         .fillColor('white')
         .text(score.name, x + 10, y + 50);
    });

    yPosition += 120;

    // Score interpretation
    doc.fontSize(12)
       .fillColor('#2c3e50')
       .text('Score Interpretation:', 50, yPosition);

    yPosition += 20;

    const interpretations = [
      'ATS Score: How well your resume passes through Applicant Tracking Systems',
      'Overall Fit: How well your profile matches the target role',
      'Experience Alignment: How relevant your experience is to the role requirements'
    ];

    interpretations.forEach(interpretation => {
      doc.fontSize(10)
         .fillColor('#7f8c8d')
         .text(`• ${interpretation}`, 70, yPosition, { width: 450 });
      yPosition += 15;
    });
  }

  /**
   * Add skills analysis to PDF
   */
  private addSkillsAnalysis(doc: any, analysis: ResumeAnalysisResult): void {
    doc.addPage();
    
    let yPosition = 50;

    doc.fontSize(18)
       .fillColor('#2c3e50')
       .text('Skills Analysis', 50, yPosition);

    yPosition += 40;

    // Missing core skills
    if (analysis.missingCoreSkills.length > 0) {
      doc.fontSize(14)
         .fillColor('#e74c3c')
         .text('Missing Core Skills:', 50, yPosition);
      
      yPosition += 25;

      analysis.missingCoreSkills.forEach(skill => {
        doc.fontSize(10)
           .fillColor('#2c3e50')
           .text(`• ${skill}`, 70, yPosition);
        yPosition += 15;
      });

      yPosition += 20;
    }

    // Missing nice-to-have skills
    if (analysis.missingNiceToHaveSkills.length > 0) {
      doc.fontSize(14)
         .fillColor('#f39c12')
         .text('Missing Nice-to-Have Skills:', 50, yPosition);
      
      yPosition += 25;

      analysis.missingNiceToHaveSkills.forEach(skill => {
        doc.fontSize(10)
           .fillColor('#2c3e50')
           .text(`• ${skill}`, 70, yPosition);
        yPosition += 15;
      });
    }
  }

  /**
   * Add gap analysis to PDF
   */
  private addGapAnalysis(doc: any, analysis: ResumeAnalysisResult): void {
    if (analysis.experienceGaps.length === 0) return;

    doc.addPage();
    
    let yPosition = 50;

    doc.fontSize(18)
       .fillColor('#2c3e50')
       .text('Experience Gaps', 50, yPosition);

    yPosition += 40;

    analysis.experienceGaps.forEach((gap, index) => {
      // Gap title
      doc.fontSize(12)
         .fillColor('#2c3e50')
         .text(`${index + 1}. ${gap.title}`, 50, yPosition);
      
      yPosition += 20;

      // Urgency indicator
      const urgencyColors = {
        'high': '#e74c3c',
        'medium': '#f39c12',
        'low': '#27ae60'
      };
      
      doc.fontSize(10)
         .fillColor(urgencyColors[gap.urgency])
         .text(`Urgency: ${gap.urgency.toUpperCase()}`, 50, yPosition);
      
      yPosition += 15;

      // Description
      doc.fontSize(10)
         .fillColor('#2c3e50')
         .text(gap.description, 50, yPosition, { width: 500 });
      
      yPosition += 30;

      // Recommended actions
      if (gap.recommendedActions.length > 0) {
        doc.fontSize(10)
           .fillColor('#3498db')
           .text('Recommended Actions:', 50, yPosition);
        
        yPosition += 15;

        gap.recommendedActions.forEach(action => {
          doc.text(`• ${action}`, 70, yPosition, { width: 450 });
          yPosition += 15;
        });
      }

      yPosition += 20;
    });
  }

  /**
   * Add recommendations to PDF
   */
  private addRecommendations(doc: any, analysis: ResumeAnalysisResult): void {
    doc.addPage();
    
    let yPosition = 50;

    doc.fontSize(18)
       .fillColor('#2c3e50')
       .text('Recommendations', 50, yPosition);

    yPosition += 40;

    // Certification recommendations
    if (analysis.certificationRecommendations.length > 0) {
      doc.fontSize(14)
         .fillColor('#27ae60')
         .text('Certification Recommendations:', 50, yPosition);
      
      yPosition += 25;

      analysis.certificationRecommendations.forEach(cert => {
        doc.fontSize(10)
           .fillColor('#2c3e50')
           .text(`• ${cert}`, 70, yPosition, { width: 450 });
        yPosition += 15;
      });

      yPosition += 20;
    }

    // ATS optimization tips
    if (analysis.atsOptimizationTips.length > 0) {
      doc.fontSize(14)
         .fillColor('#3498db')
         .text('ATS Optimization Tips:', 50, yPosition);
      
      yPosition += 25;

      analysis.atsOptimizationTips.forEach(tip => {
        doc.fontSize(10)
           .fillColor('#2c3e50')
           .text(`• ${tip}`, 70, yPosition, { width: 450 });
        yPosition += 15;
      });
    }
  }

  /**
   * Add learning paths to PDF
   */
  private addLearningPaths(doc: any, analysis: ResumeAnalysisResult): void {
    if (analysis.learningPaths.length === 0) return;

    doc.addPage();
    
    let yPosition = 50;

    doc.fontSize(18)
       .fillColor('#2c3e50')
       .text('Recommended Learning Paths', 50, yPosition);

    yPosition += 40;

    analysis.learningPaths.forEach((path, index) => {
      // Focus area
      doc.fontSize(12)
         .fillColor('#2c3e50')
         .text(`${index + 1}. ${path.focusArea}`, 50, yPosition);
      
      yPosition += 20;

      // Rationale
      doc.fontSize(10)
         .fillColor('#7f8c8d')
         .text(`Why: ${path.rationale}`, 70, yPosition, { width: 450 });
      
      yPosition += 25;

      // Suggested resources
      if (path.suggestedResources.length > 0) {
        doc.fontSize(10)
           .fillColor('#3498db')
           .text('Resources:', 70, yPosition);
        
        yPosition += 15;

        path.suggestedResources.forEach(resource => {
          doc.text(`• ${resource}`, 90, yPosition, { width: 400 });
          yPosition += 15;
        });
      }

      yPosition += 20;
    });
  }

  /**
   * Add footer to PDF
   */
  private addFooter(doc: any): void {
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 50;

    doc.fontSize(10)
       .fillColor('#7f8c8d')
       .text('Generated by Wysa AI Resume Analyzer', 50, footerY)
       .text(`Page ${doc.page.number}`, 500, footerY);
  }

  /**
   * Get PDF file path for download
   */
  getPdfDownloadPath(fileName: string): string {
    return `/uploads/reports/${fileName}`;
  }
}

// Export singleton instance
export const resumeAnalysisPdfService = new ResumeAnalysisPdfService();
