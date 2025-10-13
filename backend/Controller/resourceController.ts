import express, { Request, Response } from 'express';
import { resourceGenerationService } from '../Services/resourceGenerationService';
import { Resource } from '../Models';
import logger from '../Services/logger';

const resourceController = express.Router();

interface ResourceGenerationRequest {
  role: string;
  weeklyHours: number;
  experienceSummary: string;
  additionalContext: string;
  preferredFormat: 'video' | 'article' | 'mixed';
  learningType: 'project_based' | 'theory_focused' | 'balanced';
}

interface ManualResourceRequest {
  title: string;
  description: string;
  resourceType: 'video' | 'article' | 'course' | 'book' | 'tool' | 'other';
  url?: string;
  content?: string;
  tags?: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedHours?: number;
  notes?: string;
}

type AuthedResourceRequest = Request<unknown, unknown, ResourceGenerationRequest> & {
  user?: {
    id?: number;
    email?: string;
  };
};

type AuthedManualResourceRequest = Request<unknown, unknown, ManualResourceRequest> & {
  user?: {
    id?: number;
    email?: string;
  };
};

// Generate personalized learning resources
resourceController.post(
  '/generate',
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

      // Save generated resources to database
      const savedResources = [];
      for (const resource of result.resources) {
        try {
          const savedResource = await Resource.create({
            userId,
            title: resource.title,
            description: resource.description,
            resourceType: resource.type === 'mixed' ? 'article' : resource.type as 'video' | 'article' | 'course' | 'book' | 'tool' | 'other',
            url: resource.url,
            content: resource.description, // Use description as content since GeneratedResource doesn't have content
            tags: resource.tags || [],
            difficulty: resource.difficulty as 'beginner' | 'intermediate' | 'advanced',
            estimatedHours: 1, // Default to 1 hour since GeneratedResource doesn't have estimatedHours
            source: 'ai_generated',
            metadata: {
              duration: resource.duration,
              originalGeneration: true
            }
          });
          savedResources.push(savedResource);
        } catch (saveError) {
          logger.error('Failed to save resource:', resource.title, saveError);
        }
      }

      return res.json({
        success: true,
        message: 'Personalized resources generated and saved successfully',
        data: {
          resources: result.resources,
          savedResources: savedResources,
          skillGapAnalysis: result.skillGapAnalysis,
          pdfPath: result.pdfPath,
          downloadUrl: resourceGenerationService.getPdfDownloadPath(result.pdfPath)
        }
      });
    } catch (error) {
      logger.error('Resource generation failed:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to generate personalized resources' 
      });
    }
  }
);

// Get resource generation status (for future use)
resourceController.get(
  '/status/:userId',
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
      logger.error('Failed to get resource status:', error);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
);

// Get all resources for a user
resourceController.get(
  '/user/:userId',
  async (req: Request<{ userId: string }>, res: Response) => {
    try {
      const userId = Number(req.params.userId);
      if (Number.isNaN(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }

      const resources = await Resource.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']]
      });

      return res.json({
        success: true,
        data: resources
      });
    } catch (error) {
      logger.error('Failed to get user resources:', error);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
);

// Add a new resource manually
resourceController.post(
  '/',
  async (req: AuthedManualResourceRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User ID is required' });
      }

      const {
        title,
        description,
        resourceType,
        url,
        content,
        tags,
        difficulty,
        estimatedHours,
        notes
      } = req.body;

      // Validate required fields
      if (!title || !description || !resourceType || !difficulty) {
        return res.status(400).json({ 
          success: false, 
          message: 'Title, description, resource type, and difficulty are required' 
        });
      }

      const resource = await Resource.create({
        userId,
        title,
        description,
        resourceType,
        url,
        content,
        tags: tags || [],
        difficulty,
        estimatedHours: estimatedHours || 1,
        notes,
        source: 'user_added'
      });

      return res.json({
        success: true,
        message: 'Resource added successfully',
        data: resource
      });
    } catch (error) {
      logger.error('Failed to add resource:', error);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
);

// Update a resource
resourceController.put(
  '/:resourceId',
  async (req: Request<{ resourceId: string }>, res: Response) => {
    try {
      const resourceId = Number(req.params.resourceId);
      const userId = req.user?.id;

      if (Number.isNaN(resourceId)) {
        return res.status(400).json({ success: false, message: 'Invalid resource ID' });
      }

      if (!userId) {
        return res.status(401).json({ success: false, message: 'User ID is required' });
      }

      const resource = await Resource.findOne({
        where: { id: resourceId, userId }
      });

      if (!resource) {
        return res.status(404).json({ success: false, message: 'Resource not found' });
      }

      const {
        title,
        description,
        resourceType,
        url,
        content,
        tags,
        difficulty,
        estimatedHours,
        completed,
        rating,
        notes
      } = req.body;

      // Update resource
      await resource.update({
        title: title || resource.title,
        description: description || resource.description,
        resourceType: resourceType || resource.resourceType,
        url: url !== undefined ? url : resource.url,
        content: content !== undefined ? content : resource.content,
        tags: tags || resource.tags,
        difficulty: difficulty || resource.difficulty,
        estimatedHours: estimatedHours || resource.estimatedHours,
        completed: completed !== undefined ? completed : resource.completed,
        rating: rating !== undefined ? rating : resource.rating,
        notes: notes !== undefined ? notes : resource.notes,
        completedAt: completed && !resource.completed ? new Date() : resource.completedAt
      });

      return res.json({
        success: true,
        message: 'Resource updated successfully',
        data: resource
      });
    } catch (error) {
      logger.error('Failed to update resource:', error);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
);

// Delete a resource
resourceController.delete(
  '/:resourceId',
  async (req: Request<{ resourceId: string }>, res: Response) => {
    try {
      const resourceId = Number(req.params.resourceId);
      const userId = req.user?.id;

      if (Number.isNaN(resourceId)) {
        return res.status(400).json({ success: false, message: 'Invalid resource ID' });
      }

      if (!userId) {
        return res.status(401).json({ success: false, message: 'User ID is required' });
      }

      const resource = await Resource.findOne({
        where: { id: resourceId, userId }
      });

      if (!resource) {
        return res.status(404).json({ success: false, message: 'Resource not found' });
      }

      await resource.destroy();

      return res.json({
        success: true,
        message: 'Resource deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete resource:', error);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
);

export default resourceController;
