import express, { Request, Response } from 'express';
import { resourceGenerationService } from '../Services/resourceGenerationService';

const resourceController = express.Router();

interface ResourceGenerationRequest {
  role: string;
  weeklyHours: number;
  experienceSummary: string;
  additionalContext: string;
  preferredFormat: 'video' | 'article' | 'mixed';
  learningType: 'project_based' | 'theory_focused' | 'balanced';
}

type AuthedResourceRequest = Request<unknown, unknown, ResourceGenerationRequest> & {
  user?: {
    id?: number;
    email?: string;
  };
};

// Generate personalized learning resources
resourceController.post(
  '/api/resources/generate',
  async (req: AuthedResourceRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User ID is required' });
      }

      const {
        role,
        weeklyHours,
        experienceSummary,
        additionalContext,
        preferredFormat,
        learningType
      } = req.body;

      // Validate required fields
      if (!role || !weeklyHours) {
        return res.status(400).json({ 
          success: false, 
          message: 'Role and weekly hours are required' 
        });
      }

      // Validate weekly hours
      if (typeof weeklyHours !== 'number' || weeklyHours < 1 || weeklyHours > 40) {
        return res.status(400).json({ 
          success: false, 
          message: 'Weekly hours must be between 1 and 40' 
        });
      }

      // Validate format
      if (preferredFormat && !['video', 'article', 'mixed'].includes(preferredFormat)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Preferred format must be video, article, or mixed' 
        });
      }

      // Validate learning type
      if (learningType && !['project_based', 'theory_focused', 'balanced'].includes(learningType)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Learning type must be project_based, theory_focused, or balanced' 
        });
      }

      const result = await resourceGenerationService.generatePersonalizedResources({
        userId,
        role,
        weeklyHours,
        experienceSummary: experienceSummary || '',
        additionalContext: additionalContext || '',
        preferredFormat: preferredFormat || 'mixed',
        learningType: learningType || 'balanced'
      });

      return res.json({
        success: true,
        message: 'Personalized resources generated successfully',
        data: {
          resources: result.resources,
          skillGapAnalysis: result.skillGapAnalysis,
          pdfPath: result.pdfPath,
          downloadUrl: resourceGenerationService.getPdfDownloadPath(result.pdfPath)
        }
      });
    } catch (error) {
      console.error('Resource generation failed:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to generate personalized resources' 
      });
    }
  }
);

// Get resource generation status (for future use)
resourceController.get(
  '/api/resources/status/:userId',
  async (req: Request<{ userId: string }>, res: Response) => {
    try {
      const userId = Number(req.params.userId);
      if (Number.isNaN(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }

      // This could be expanded to track generation status
      return res.json({
        success: true,
        data: {
          userId,
          status: 'ready',
          lastGenerated: null
        }
      });
    } catch (error) {
      console.error('Failed to get resource status:', error);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
);

export default resourceController;
