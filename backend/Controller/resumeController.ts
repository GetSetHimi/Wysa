import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { Resume, ResumeAttributes } from '../Models';
import { analyzeResumeWithGemini } from '../Services/resumeParserService';
import { resumeAnalysisPdfService } from '../Services/resumeAnalysisPdfService';
import logger from '../Services/logger';

const resumeController = express.Router();

const uploadsDir = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

type DestinationCallback = (error: Error | null, destination: string) => void;
type FileNameCallback = (error: Error | null, filename: string) => void;
type UploadedFile = Express.Multer.File;

const storage = multer.diskStorage({
  destination: (_req: Request, _file: UploadedFile, cb: DestinationCallback) => {
    cb(null, uploadsDir);
  },
  filename: (_req: Request, file: UploadedFile, cb: FileNameCallback) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}-${sanitized}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB
  },
});

const toResumeResponse = (resume: Resume): ResumeAttributes & { downloadUrl: string } => {
  const payload = resume.toJSON() as ResumeAttributes;
  return {
    ...payload,
    downloadUrl: `/uploads/${payload.storedFileName}`,
  };
};

resumeController.post(
  '/upload',
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const { file } = req as Request & { file?: UploadedFile };
      const requestUser = (req as Request & { user?: { id?: number | string } }).user;
      const rawUserId = requestUser?.id ?? req.body.userId;
      const userId = typeof rawUserId === 'string' ? Number(rawUserId) : rawUserId;

      if (!file) {
        return res.status(400).json({ success: false, message: 'Resume file is required' });
      }

      if (typeof userId !== 'number' || Number.isNaN(userId)) {
        return res
          .status(400)
          .json({ success: false, message: 'User ID is required in session or request body' });
      }

      const resume = await Resume.create({
        userId,
        originalFileName: file.originalname,
        storedFileName: file.filename,
        mimeType: file.mimetype,
        fileSize: file.size,
      });

      return res.status(201).json({
        success: true,
        message: 'Resume uploaded successfully',
        data: toResumeResponse(resume),
      });
    } catch (error) {
      logger.error('Resume upload failed:', error);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
);

resumeController.post(
  '/parse/:resumeId',
  async (req: Request<{ resumeId: string }>, res: Response) => {
    try {
      const resumeId = Number(req.params.resumeId);
      if (Number.isNaN(resumeId)) {
        return res.status(400).json({ success: false, message: 'Invalid resume ID' });
      }

      const resume = await Resume.findByPk(resumeId);
      if (!resume) {
        return res.status(404).json({ success: false, message: 'Resume not found' });
      }

      const filePath = path.join(uploadsDir, resume.storedFileName);
      let fileBuffer: Buffer;

      try {
        fileBuffer = await fsPromises.readFile(filePath);
      } catch (readError) {
        logger.error('Failed to read resume file for parsing:', readError);
        return res.status(500).json({ success: false, message: 'Unable to read resume file' });
      }

      const isText = resume.mimeType.startsWith('text/');
      const resumeContent = isText
        ? fileBuffer.toString('utf-8')
        : `The resume content is provided as base64 (mimeType: ${resume.mimeType}). Decode before extracting information.\n${fileBuffer.toString(
            'base64'
          )}`;

      const { desiredRole, experienceSummary, experienceYears, additionalContext } = req.body as {
        desiredRole?: string;
        experienceSummary?: string;
        experienceYears?: number | string;
        additionalContext?: string;
      };

      const normalizedExperienceSummary =
        experienceSummary ??
        (experienceYears !== undefined
          ? `The candidate reports approximately ${experienceYears} years of experience.`
          : undefined);

      const numericExperienceYears =
        typeof experienceYears === 'string' ? Number(experienceYears) : experienceYears;

      const sanitizedExperienceYears =
        typeof numericExperienceYears === 'number' && !Number.isNaN(numericExperienceYears)
          ? numericExperienceYears
          : undefined;

      const analysis = await analyzeResumeWithGemini({
        resumeContent,
        mimeType: resume.mimeType,
        desiredRole,
        experienceSummary: normalizedExperienceSummary,
        additionalContext,
      });

      const parsedJson = {
        ...analysis,
        inputContext: {
          desiredRole: desiredRole ?? null,
          experienceSummary: normalizedExperienceSummary ?? null,
          experienceYears: sanitizedExperienceYears ?? null,
          additionalContext: additionalContext ?? null,
        },
        generatedAt: new Date().toISOString(),
      };

      logger.info('Saving parsedJson to database:', JSON.stringify(parsedJson, null, 2));
      await resume.update({ parsedJson });
      await resume.reload();

      logger.info('Resume after update:', JSON.stringify(resume.toJSON(), null, 2));
      logger.info('Resume parsedJson after reload:', resume.parsedJson);

      return res.json({
        success: true,
        message: 'Resume parsed successfully',
        data: {
          parsedJson,
          resume: toResumeResponse(resume),
        },
      });
    } catch (error) {
      logger.error('Resume parsing failed:', error);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
);

resumeController.get(
  '/:resumeId',
  async (req: Request<{ resumeId: string }>, res: Response) => {
    try {
      const resumeId = Number(req.params.resumeId);
      if (Number.isNaN(resumeId)) {
        return res.status(400).json({ success: false, message: 'Invalid resume ID' });
      }

      const resume = await Resume.findByPk(resumeId);
      if (!resume) {
        return res.status(404).json({ success: false, message: 'Resume not found' });
      }

      return res.json({ success: true, data: toResumeResponse(resume) });
    } catch (error) {
      logger.error('Failed to fetch resume:', error);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
);

resumeController.get(
  '/user/:userId',
  async (req: Request<{ userId: string }>, res: Response) => {
    try {
      const userId = Number(req.params.userId);
      if (Number.isNaN(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }

      const resumes = await Resume.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
      });

      logger.info('Found resumes for user:', resumes.length);
      resumes.forEach((resume, index) => {
        logger.info(`Resume ${index + 1}:`, {
          id: resume.id,
          originalFileName: resume.originalFileName,
          hasParsedJson: !!resume.parsedJson,
          parsedJsonType: typeof resume.parsedJson,
          parsedJsonKeys: resume.parsedJson ? Object.keys(resume.parsedJson) : 'N/A'
        });
      });

      return res.json({
        success: true,
        data: resumes.map((resume) => toResumeResponse(resume)),
      });
    } catch (error) {
      logger.error('Failed to fetch resumes for user:', error);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
);

// Generate resume analysis PDF report
resumeController.get(
  '/:resumeId/analysis-pdf',
  async (req: Request<{ resumeId: string }>, res: Response) => {
    try {
      const resumeId = Number(req.params.resumeId);
      const userId = req.user?.id;

      if (Number.isNaN(resumeId)) {
        return res.status(400).json({ success: false, message: 'Invalid resume ID' });
      }

      if (!userId) {
        return res.status(401).json({ success: false, message: 'User ID is required' });
      }

      const resume = await Resume.findByPk(resumeId);
      if (!resume) {
        return res.status(404).json({ success: false, message: 'Resume not found' });
      }

      // Check if user owns this resume
      if (resume.userId !== userId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      // Check if resume has been analyzed
      if (!resume.parsedJson) {
        return res.status(400).json({ 
          success: false, 
          message: 'Resume has not been analyzed yet. Please analyze the resume first.' 
        });
      }

      const fileName = await resumeAnalysisPdfService.generateResumeAnalysisPdf(
        resumeId, 
        resume.parsedJson as any
      );
      const downloadUrl = resumeAnalysisPdfService.getPdfDownloadPath(fileName);

      return res.json({
        success: true,
        message: 'Resume analysis PDF generated successfully',
        data: {
          fileName,
          downloadUrl,
          resumeId
        }
      });
    } catch (error) {
      logger.error('Failed to generate resume analysis PDF:', error);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
);

// Delete a resume
resumeController.delete(
  '/:resumeId',
  async (req: Request<{ resumeId: string }>, res: Response) => {
    try {
      const resumeId = Number(req.params.resumeId);
      const userId = req.user?.id;

      if (Number.isNaN(resumeId)) {
        return res.status(400).json({ success: false, message: 'Invalid resume ID' });
      }

      if (!userId) {
        return res.status(401).json({ success: false, message: 'User ID is required' });
      }

      const resume = await Resume.findOne({
        where: { id: resumeId, userId }
      });

      if (!resume) {
        return res.status(404).json({ success: false, message: 'Resume not found' });
      }

      // Delete the physical file
      try {
        const filePath = path.join(uploadsDir, resume.storedFileName);
        if (fs.existsSync(filePath)) {
          await fsPromises.unlink(filePath);
        }
      } catch (fileError) {
        logger.error('Failed to delete resume file:', fileError);
        // Continue with database deletion even if file deletion fails
      }

      // Delete from database
      await resume.destroy();

      return res.json({
        success: true,
        message: 'Resume deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete resume:', error);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
);

export default resumeController;