import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { Profile, Resume } from '../Models';

interface ResourceGenerationRequest {
  userId: number;
  role: string;
  weeklyHours: number;
  experienceSummary: string;
  additionalContext: string;
  preferredFormat: 'video' | 'article' | 'mixed';
  learningType: 'project_based' | 'theory_focused' | 'balanced';
}

interface GeneratedResource {
  title: string;
  type: 'video' | 'article' | 'mixed';
  description: string;
  duration: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  url: string;
  tags: string[];
}

interface SkillGapAnalysis {
  missingSkills: string[];
  experienceGaps: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  recommendedLearningPaths: string[];
}

export class ResourceGenerationService {
  private uploadsDir: string;
  private resourcesDir: string;
  private GEMINI_API_KEY: string;

  constructor() {
    this.uploadsDir = path.resolve(__dirname, '../uploads');
    this.resourcesDir = path.join(this.uploadsDir, 'resources');
    this.GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
    
    // Create directories if they don't exist
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    if (!fs.existsSync(this.resourcesDir)) {
      fs.mkdirSync(this.resourcesDir, { recursive: true });
    }
  }

  /**
   * Generate personalized learning resources based on skill gaps
   */
  async generatePersonalizedResources(request: ResourceGenerationRequest): Promise<{
    resources: GeneratedResource[];
    skillGapAnalysis: SkillGapAnalysis;
    pdfPath: string;
  }> {
    try {
      // Get user profile and resume analysis
      const profile = await Profile.findOne({ where: { userId: request.userId } });
      const resume = await Resume.findOne({ 
        where: { userId: request.userId },
        order: [['createdAt', 'DESC']]
      });

      // Analyze skill gaps
      const skillGapAnalysis = await this.analyzeSkillGaps(request, profile, resume);

      // Generate resources based on skill gaps and preferences
      const resources = await this.generateResources(request, skillGapAnalysis);

      // Generate PDF with resources
      const pdfPath = await this.generateResourcePdf(request, resources, skillGapAnalysis);

      return {
        resources,
        skillGapAnalysis,
        pdfPath
      };
    } catch (error) {
      console.error('Error generating personalized resources:', error);
      throw error;
    }
  }

  /**
   * Analyze skill gaps based on resume and profile
   */
  private async analyzeSkillGaps(
    request: ResourceGenerationRequest,
    profile: any,
    resume: any
  ): Promise<SkillGapAnalysis> {
    if (!this.GEMINI_API_KEY) {
      // Fallback analysis without AI
      return {
        missingSkills: ['JavaScript', 'React', 'Node.js', 'Database Design'],
        experienceGaps: [
          {
            title: 'Frontend Development',
            description: 'Need more experience with modern frontend frameworks',
            priority: 'high'
          }
        ],
        recommendedLearningPaths: ['Full-Stack Development', 'Modern JavaScript']
      };
    }

    try {
      const prompt = this.buildSkillGapAnalysisPrompt(request, profile, resume);
      const response = await this.callGeminiAPI(prompt);
      
      return JSON.parse(response);
    } catch (error) {
      console.error('Error analyzing skill gaps:', error);
      // Return fallback analysis
      return {
        missingSkills: ['JavaScript', 'React', 'Node.js'],
        experienceGaps: [
          {
            title: 'Technical Skills',
            description: 'Need to strengthen core technical competencies',
            priority: 'medium'
          }
        ],
        recommendedLearningPaths: ['Technical Skills Development']
      };
    }
  }

  /**
   * Generate learning resources based on skill gaps
   */
  private async generateResources(
    request: ResourceGenerationRequest,
    skillGapAnalysis: SkillGapAnalysis
  ): Promise<GeneratedResource[]> {
    if (!this.GEMINI_API_KEY) {
      // Fallback resources
      return this.getFallbackResources(request);
    }

    try {
      const prompt = this.buildResourceGenerationPrompt(request, skillGapAnalysis);
      const response = await this.callGeminiAPI(prompt);
      
      return JSON.parse(response);
    } catch (error) {
      console.error('Error generating resources:', error);
      return this.getFallbackResources(request);
    }
  }

  /**
   * Build prompt for skill gap analysis
   */
  private buildSkillGapAnalysisPrompt(
    request: ResourceGenerationRequest,
    profile: any,
    resume: any
  ): string {
    const lines = [
      `Analyze skill gaps for a candidate targeting the role: ${request.role}`,
      `Weekly learning hours: ${request.weeklyHours}`,
      `Experience summary: ${request.experienceSummary}`,
      `Additional context: ${request.additionalContext}`,
      '',
      'Return JSON with this structure:',
      '{"missingSkills": ["skill1", "skill2"], "experienceGaps": [{"title": "gap title", "description": "gap description", "priority": "high|medium|low"}], "recommendedLearningPaths": ["path1", "path2"]}',
      '',
      'Focus on practical, actionable skill gaps that can be addressed through learning.'
    ];

    if (resume && resume.parsedJson) {
      lines.push('', 'Resume Analysis Data:');
      lines.push(`ATS Score: ${resume.parsedJson.scores?.atsScore || 'N/A'}%`);
      if (resume.parsedJson.missingCoreSkills?.length > 0) {
        lines.push(`Missing Core Skills: ${resume.parsedJson.missingCoreSkills.join(', ')}`);
      }
      if (resume.parsedJson.experienceGaps?.length > 0) {
        lines.push('Experience Gaps:');
        resume.parsedJson.experienceGaps.forEach((gap: any) => {
          lines.push(`- ${gap.title}: ${gap.description} (Priority: ${gap.urgency})`);
        });
      }
    }

    return lines.join('\n');
  }

  /**
   * Build prompt for resource generation
   */
  private buildResourceGenerationPrompt(
    request: ResourceGenerationRequest,
    skillGapAnalysis: SkillGapAnalysis
  ): string {
    const lines = [
      `Generate personalized learning resources for someone targeting: ${request.role}`,
      `Preferred format: ${request.preferredFormat}`,
      `Learning type: ${request.learningType}`,
      `Weekly hours: ${request.weeklyHours}`,
      '',
      'Skill gaps to address:',
      `Missing skills: ${skillGapAnalysis.missingSkills.join(', ')}`,
      '',
      'Return JSON array with this structure:',
      '[{"title": "Resource Title", "type": "video|article|mixed", "description": "Brief description", "duration": "estimated time", "difficulty": "beginner|intermediate|advanced", "url": "resource URL", "tags": ["tag1", "tag2"]}]',
      '',
      'Include a mix of:',
      '- Video tutorials (YouTube, free courses)',
      '- Articles and documentation',
      '- Hands-on projects',
      '- Practice exercises',
      '',
      'Prioritize high-quality, free resources. Include 8-12 resources total.'
    ];

    return lines.join('\n');
  }

  /**
   * Call Gemini API
   */
  private async callGeminiAPI(prompt: string): Promise<string> {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096,
          responseMimeType: "application/json"
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json() as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * Get fallback resources when AI is not available
   */
  private getFallbackResources(request: ResourceGenerationRequest): GeneratedResource[] {
    const baseResources: GeneratedResource[] = [
      {
        title: `Complete ${request.role} Tutorial`,
        type: request.preferredFormat === 'video' ? 'video' : 'mixed',
        description: `Comprehensive tutorial covering all aspects of ${request.role}`,
        duration: '10-15 hours',
        difficulty: 'beginner',
        url: 'https://www.youtube.com/watch?v=example',
        tags: ['tutorial', 'beginner', request.role.toLowerCase()]
      },
      {
        title: 'Hands-on Project',
        type: 'mixed',
        description: 'Build a real-world project to practice skills',
        duration: '20-30 hours',
        difficulty: 'intermediate',
        url: 'https://github.com/example/project',
        tags: ['project', 'hands-on', 'practice']
      },
      {
        title: 'Best Practices Guide',
        type: 'article',
        description: 'Learn industry best practices and standards',
        duration: '2-3 hours',
        difficulty: 'intermediate',
        url: 'https://example.com/best-practices',
        tags: ['best-practices', 'standards', 'industry']
      }
    ];

    return baseResources;
  }

  /**
   * Generate PDF with resources
   */
  private async generateResourcePdf(
    request: ResourceGenerationRequest,
    resources: GeneratedResource[],
    skillGapAnalysis: SkillGapAnalysis
  ): Promise<string> {
    const fileName = `learning-resources-${request.userId}-${Date.now()}.pdf`;
    const filePath = path.join(this.resourcesDir, fileName);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(fs.createWriteStream(filePath));

    // Add content
    this.addResourceHeader(doc, request);
    this.addSkillGapAnalysis(doc, skillGapAnalysis);
    this.addResourcesList(doc, resources);
    this.addFooter(doc);

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(fileName));
      doc.on('error', reject);
    });
  }

  /**
   * Add header to PDF
   */
  private addResourceHeader(doc: any, request: ResourceGenerationRequest): void {
    doc.fontSize(24)
       .fillColor('#2c3e50')
       .text('Personalized Learning Resources', 50, 50);

    doc.fontSize(14)
       .fillColor('#7f8c8d')
       .text(`Target Role: ${request.role}`, 50, 90)
       .text(`Weekly Hours: ${request.weeklyHours}`, 50, 110)
       .text(`Preferred Format: ${request.preferredFormat}`, 50, 130)
       .text(`Learning Type: ${request.learningType}`, 50, 150)
       .text(`Generated: ${new Date().toLocaleDateString()}`, 50, 170);

    doc.moveTo(50, 200)
       .lineTo(550, 200)
       .stroke('#bdc3c7');
  }

  /**
   * Add skill gap analysis to PDF
   */
  private addSkillGapAnalysis(doc: any, skillGapAnalysis: SkillGapAnalysis): void {
    let yPosition = 230;

    doc.fontSize(18)
       .fillColor('#2c3e50')
       .text('Skill Gap Analysis', 50, yPosition);

    yPosition += 40;

    // Missing skills
    if (skillGapAnalysis.missingSkills.length > 0) {
      doc.fontSize(14)
         .fillColor('#e74c3c')
         .text('Missing Skills:', 50, yPosition);
      
      yPosition += 25;

      skillGapAnalysis.missingSkills.forEach(skill => {
        doc.fontSize(10)
           .fillColor('#2c3e50')
           .text(`• ${skill}`, 70, yPosition);
        yPosition += 15;
      });

      yPosition += 20;
    }

    // Experience gaps
    if (skillGapAnalysis.experienceGaps.length > 0) {
      doc.fontSize(14)
         .fillColor('#f39c12')
         .text('Experience Gaps:', 50, yPosition);
      
      yPosition += 25;

      skillGapAnalysis.experienceGaps.forEach(gap => {
        doc.fontSize(10)
           .fillColor('#2c3e50')
           .text(`• ${gap.title}: ${gap.description} (Priority: ${gap.priority})`, 70, yPosition);
        yPosition += 15;
      });
    }
  }

  /**
   * Add resources list to PDF
   */
  private addResourcesList(doc: any, resources: GeneratedResource[]): void {
    doc.addPage();
    
    let yPosition = 50;

    doc.fontSize(18)
       .fillColor('#2c3e50')
       .text('Recommended Learning Resources', 50, yPosition);

    yPosition += 40;

    resources.forEach((resource, index) => {
      // Resource title
      doc.fontSize(12)
         .fillColor('#2c3e50')
         .text(`${index + 1}. ${resource.title}`, 50, yPosition);
      
      yPosition += 20;

      // Resource details
      doc.fontSize(10)
         .fillColor('#7f8c8d')
         .text(`Type: ${resource.type} | Duration: ${resource.duration} | Difficulty: ${resource.difficulty}`, 70, yPosition);
      
      yPosition += 15;

      // Description
      doc.fontSize(10)
         .fillColor('#2c3e50')
         .text(resource.description, 70, yPosition, { width: 450 });
      
      yPosition += 20;

      // URL
      doc.fontSize(9)
         .fillColor('#3498db')
         .text(`Link: ${resource.url}`, 70, yPosition);
      
      yPosition += 20;

      // Tags
      if (resource.tags.length > 0) {
        doc.fontSize(9)
           .fillColor('#95a5a6')
           .text(`Tags: ${resource.tags.join(', ')}`, 70, yPosition);
        yPosition += 15;
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
       .text('Generated by Wysa AI Career Coach', 50, footerY)
       .text(`Page ${doc.page.number}`, 500, footerY);
  }

  /**
   * Get PDF download path
   */
  getPdfDownloadPath(fileName: string): string {
    return `/uploads/resources/${fileName}`;
  }
}

// Export singleton instance
export const resourceGenerationService = new ResourceGenerationService();
