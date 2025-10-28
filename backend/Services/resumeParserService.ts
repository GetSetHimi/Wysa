import express from 'express';
import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';
import logger from './logger';

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';
const apiKey = process.env.GEMINI_API_KEY;

const generativeAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

type AnalysisScores = {
  atsScore: number;
  overallFitScore: number;
  experienceAlignmentScore: number;
  keywordOptimizationScore: number;
  formatScore: number;
  sectionCompletenessScore: number;
};

type IdentifiedGap = {
  title: string;
  description: string;
  urgency: 'high' | 'medium' | 'low';
  recommendedActions: string[];
};

type SuggestedLearningPath = {
  focusArea: string;
  rationale: string;
  suggestedResources: string[];
};

export type ResumeAnalysisResult = {
  summary: string;
  recruiterPerspective: string;
  hiringManagerPerspective: string;
  scores: AnalysisScores;
  missingCoreSkills: string[];
  missingNiceToHaveSkills: string[];
  experienceGaps: IdentifiedGap[];
  certificationRecommendations: string[];
  atsOptimizationTips: string[];
  learningPaths: SuggestedLearningPath[];
  additionalNotes?: string;
};

export type ResumeAnalysisInput = {
  resumeContent: string;
  mimeType: string;
  desiredRole?: string;
  experienceSummary?: string;
  additionalContext?: string;
};

const FALLBACK_RESPONSE: ResumeAnalysisResult = {
  summary:
    'Resume analysis completed with basic insights.',
  recruiterPerspective:
    'Basic resume evaluation completed. Consider providing more details about your accomplishments and target role for enhanced feedback.',
  hiringManagerPerspective: 'Basic hiring manager perspective generated.',
  scores: {
    atsScore: 0,
    overallFitScore: 0,
    experienceAlignmentScore: 0,
    keywordOptimizationScore: 0,
    formatScore: 0,
    sectionCompletenessScore: 0,
  },
  missingCoreSkills: [],
  missingNiceToHaveSkills: [],
  experienceGaps: [],
  certificationRecommendations: [],
  atsOptimizationTips: [],
  learningPaths: [],
};

function buildPrompt({
  resumeContent,
  mimeType,
  desiredRole,
  experienceSummary,
  additionalContext,
}: ResumeAnalysisInput): string {
  const contextLines = [
    'You are an experienced technical recruiter and ATS (Applicant Tracking System) specialist.',
    'Analyze the resume for ATS compatibility and provide a comprehensive evaluation.',
    'Provide structured JSON output only. All scores must be numbers between 0 and 100.',
    '',
    'ATS SCORING CRITERIA:',
    '1. KEYWORD OPTIMIZATION (25%): How well does the resume use relevant keywords from the job description?',
    '2. FORMAT COMPATIBILITY (20%): Is the resume in ATS-friendly format (no tables, images, headers/footers)?',
    '3. SECTION COMPLETENESS (15%): Does the resume have all standard sections (Contact, Summary, Experience, Education, Skills)?',
    '4. CONTACT INFORMATION (10%): Is contact information clearly visible and complete?',
    '5. READABILITY (10%): Is the resume easy to parse (consistent formatting, clear section headers)?',
    '6. LENGTH OPTIMIZATION (10%): Is the resume appropriate length (1-2 pages for most roles)?',
    '7. FILE FORMAT (10%): Is it in a standard format (PDF, DOC, DOCX) without complex elements?',
    '',
    'OVERALL ATS SCORE = (Keyword Optimization × 0.25) + (Format Compatibility × 0.20) + (Section Completeness × 0.15) + (Contact × 0.10) + (Readability × 0.10) + (Length × 0.10) + (File Format × 0.10)'
  ];

  if (desiredRole) {
    contextLines.push(``);
    contextLines.push(`TARGET ROLE: ${desiredRole}`);
    contextLines.push('Analyze keywords and requirements specific to this role.');
  }

  if (experienceSummary) {
    contextLines.push(`CANDIDATE BACKGROUND: ${experienceSummary}`);
  }

  if (additionalContext) {
    contextLines.push(`ADDITIONAL CONTEXT: ${additionalContext}`);
  }

  contextLines.push(`RESUME FILE TYPE: ${mimeType}`);
  contextLines.push('');
  contextLines.push('Analyze the resume and produce the following JSON schema exactly:');
  contextLines.push(`{
  "summary": "Brief overall assessment of resume quality and ATS compatibility",
  "recruiterPerspective": "How would a recruiter view this resume?",
  "hiringManagerPerspective": "How would a hiring manager evaluate this candidate?",
  "scores": {
    "atsScore": "Overall ATS compatibility score (0-100)",
    "overallFitScore": "How well the candidate fits the target role (0-100)",
    "experienceAlignmentScore": "How well experience aligns with role requirements (0-100)",
    "keywordOptimizationScore": "How well keywords are optimized for ATS (0-100)",
    "formatScore": "ATS-friendly formatting score (0-100)",
    "sectionCompletenessScore": "Resume section completeness (0-100)"
  },
  "missingCoreSkills": ["List of critical skills missing for the target role"],
  "missingNiceToHaveSkills": ["List of nice-to-have skills that would strengthen the application"],
  "experienceGaps": [
    {
      "title": "Specific experience gap",
      "description": "Detailed description of the gap",
      "urgency": "high|medium|low",
      "recommendedActions": ["Specific actions to address this gap"]
    }
  ],
  "certificationRecommendations": ["Recommended certifications to improve candidacy"],
  "atsOptimizationTips": ["Specific tips to improve ATS compatibility"],
  "learningPaths": [
    {
      "focusArea": "Area to develop",
      "rationale": "Why this area is important",
      "suggestedResources": ["Specific learning resources"]
    }
  ],
  "additionalNotes": "Any additional observations or recommendations"
}`);

  contextLines.push('');
  contextLines.push('RESUME CONTENT (analyze thoroughly):');
  contextLines.push('---RESUME_START---');
  contextLines.push(resumeContent);
  contextLines.push('---RESUME_END---');

  return contextLines.join('\n');
}

function parseJsonResponse(textResponse: string): ResumeAnalysisResult {
  try {
    const cleaned = textResponse
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/```$/i, '');

    const parsed = JSON.parse(cleaned);

    return {
      ...FALLBACK_RESPONSE,
      ...parsed,
      scores: {
        ...FALLBACK_RESPONSE.scores,
        ...(parsed.scores ?? {}),
      },
      missingCoreSkills: parsed.missingCoreSkills ?? [],
      missingNiceToHaveSkills: parsed.missingNiceToHaveSkills ?? [],
      experienceGaps: parsed.experienceGaps ?? [],
      certificationRecommendations: parsed.certificationRecommendations ?? [],
      atsOptimizationTips: parsed.atsOptimizationTips ?? [],
      learningPaths: parsed.learningPaths ?? [],
      additionalNotes: parsed.additionalNotes ?? undefined,
    } satisfies ResumeAnalysisResult;
  } catch (error) {
    logger.error('Failed to parse Gemini response as JSON:', error);
    return {
      ...FALLBACK_RESPONSE,
      summary: `${FALLBACK_RESPONSE.summary} Raw response: ${textResponse.slice(0, 500)}`,
    };
  }
}

// Fallback ATS scoring system when AI is not available
function analyzeResumeBasic(resumeContent: string, desiredRole?: string): ResumeAnalysisResult {
  const content = resumeContent.toLowerCase();

  // Basic ATS scoring based on content analysis
  let keywordScore = 0;
  let formatScore = 50; // Assume average format if we can't analyze file structure
  let sectionScore = 0;
  let contactScore = 0;
  let readabilityScore = 60; // Assume decent readability

  // Check for common sections
  const sections = ['contact', 'summary', 'objective', 'experience', 'work experience', 'education', 'skills', 'projects'];
  sections.forEach(section => {
    if (content.includes(section)) sectionScore += 10;
  });
  sectionScore = Math.min(sectionScore, 100);

  // Check for contact information patterns
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const phonePattern = /(\+\d{1,3}[- ]?)?\d{3}[- ]?\d{3}[- ]?\d{4}/;
  if (emailPattern.test(content)) contactScore += 50;
  if (phonePattern.test(content)) contactScore += 50;

  // Check for keywords if role is provided
  if (desiredRole) {
    const roleKeywords = desiredRole.toLowerCase().split(' ');
    let keywordMatches = 0;
    roleKeywords.forEach(keyword => {
      if (content.includes(keyword) && keyword.length > 2) keywordMatches++;
    });
    keywordScore = Math.min((keywordMatches / roleKeywords.length) * 100, 100);
  } else {
    keywordScore = 70; // Assume decent keyword usage if no role specified
  }

  // Calculate overall ATS score using weighted formula
  const atsScore = Math.round(
    (keywordScore * 0.25) +
    (formatScore * 0.20) +
    (sectionScore * 0.15) +
    (contactScore * 0.10) +
    (readabilityScore * 0.10) +
    (70 * 0.10) + // Assume decent length
    (80 * 0.10)   // Assume decent file format
  );

  return {
    summary: `Basic ATS analysis completed (AI unavailable). Resume shows ${sectionScore}% section completeness and ${contactScore}% contact information visibility.`,
    recruiterPerspective: 'Resume has basic structure and contact information. Consider adding more specific keywords for better ATS compatibility.',
    hiringManagerPerspective: 'Candidate resume shows standard formatting. Detailed review would benefit from AI-powered analysis.',
    scores: {
      atsScore,
      overallFitScore: desiredRole ? Math.min(atsScore + 10, 100) : 75,
      experienceAlignmentScore: 70,
      keywordOptimizationScore: keywordScore,
      formatScore,
      sectionCompletenessScore: sectionScore,
    },
    missingCoreSkills: desiredRole ? [
      `Detailed ${desiredRole} skills analysis unavailable (AI service temporarily unavailable)`,
      'Please check server logs for details or try again later'
    ] : [
      'AI analysis unavailable - detailed skill assessment cannot be performed',
      'Please ensure Gemini API is properly configured and has available quota'
    ],
    missingNiceToHaveSkills: ['Detailed analysis requires AI'],
    experienceGaps: [],
    certificationRecommendations: ['Consider AI analysis for detailed recommendations'],
    atsOptimizationTips: [
      'Ensure all sections are clearly labeled',
      'Include complete contact information',
      'Use relevant keywords from job descriptions',
      'Keep formatting simple and ATS-friendly'
    ],
    learningPaths: [],
    additionalNotes: 'Basic resume analysis completed.'
  };
}

export async function analyzeResumeWithGemini(
  input: ResumeAnalysisInput
): Promise<ResumeAnalysisResult> {
  if (!generativeAI) {
    logger.warn('Gemini AI not initialized - API key missing. Using basic analysis.');
    return analyzeResumeBasic(input.resumeContent, input.desiredRole);
  }

  const model = generativeAI.getGenerativeModel({ model: DEFAULT_MODEL });
  const prompt = buildPrompt(input);

  try {
    logger.info(`Attempting Gemini analysis with model: ${DEFAULT_MODEL}`);
    const result = await model.generateContent(prompt);
    const text = result.response?.text();

    if (!text) {
      logger.warn('Gemini returned empty response for resume analysis.');
      return analyzeResumeBasic(input.resumeContent, input.desiredRole);
    }

    logger.info('Gemini analysis completed successfully');
    return parseJsonResponse(text);
  } catch (error: any) {
    logger.error('Gemini resume analysis failed:', {
      message: error?.message,
      status: error?.status,
      statusText: error?.statusText,
      errorDetails: error?.toString()
    });
    
    // Check for rate limit errors
    if (error?.message?.includes('429') || error?.message?.includes('RATE_LIMIT_EXCEEDED')) {
      logger.error('⚠️  RATE LIMIT EXCEEDED: Gemini API quota exhausted. Please check your Google Cloud Console quota settings.');
    }
    
    // Check for quota errors
    if (error?.message?.includes('quota_limit_value":"0"')) {
      logger.error('⚠️  QUOTA ERROR: Your Gemini API has 0 quota. Please enable billing or increase quota limits in Google Cloud Console.');
    }
    
    return analyzeResumeBasic(input.resumeContent, input.desiredRole);
  }
}

const resumeParserService = express.Router();


resumeParserService.get('/api/resume/:id', async (req, res) => {
   try{

   }
    catch(error){
        logger.error(error);
        return res.status(500).send('Internal Server Error');
    }
})  


export default resumeParserService;