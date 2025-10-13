import express, { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Interview, Planner, User } from '../Models';
import { interviewEligibilityService } from '../Services/interviewEligibilityService';
import { vapiWorkflowService } from '../Services/vapiWorkflowService';
import logger from '../Services/logger';

const interviewController = express.Router();

// Get interview eligibility status
interviewController.get('/eligibility', async (req: Request, res: Response) => {
  try {
    const rawUserId = req.user?.id;
    const userId = typeof rawUserId === 'string' ? Number(rawUserId) : rawUserId;

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    const eligibility = await interviewEligibilityService.checkInterviewEligibility(userId);
    
    return res.status(200).json({
      success: true,
      data: eligibility
    });
  } catch (error) {
    logger.error('Failed to check interview eligibility:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal Server Error' 
    });
  }
});

// Get user's interview history
interviewController.get('/history', async (req: Request, res: Response) => {
  try {
    const rawUserId = req.user?.id;
    const userId = typeof rawUserId === 'string' ? Number(rawUserId) : rawUserId;

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    const interviews = await interviewEligibilityService.getUserInterviewHistory(userId);
    
    return res.status(200).json({
      success: true,
      data: interviews
    });
  } catch (error) {
    logger.error('Failed to fetch interview history:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal Server Error' 
    });
  }
});

// Schedule interview manually (if eligible)
interviewController.post('/schedule', async (req: Request, res: Response) => {
  try {
    const { plannerId, scheduledAt } = req.body as {
      plannerId?: number;
      scheduledAt?: string;
    };

    const rawUserId = req.user?.id;
    const userId = typeof rawUserId === 'string' ? Number(rawUserId) : rawUserId;

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    // Check eligibility first
    const eligibility = await interviewEligibilityService.checkInterviewEligibility(userId, plannerId);
    
    if (!eligibility.isEligible) {
      return res.status(403).json({
        success: false,
        message: eligibility.message,
        data: {
          currentProgress: eligibility.currentProgress,
          requiredProgress: eligibility.requiredProgress,
          daysUntilEligible: eligibility.daysUntilEligible
        }
      });
    }

    // Parse scheduled date
    let interviewDate: Date;
    if (scheduledAt) {
      interviewDate = new Date(scheduledAt);
      if (isNaN(interviewDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid scheduled date format'
        });
      }
    } else {
      // Default to 3 days from now
      interviewDate = new Date();
      interviewDate.setDate(interviewDate.getDate() + 3);
    }

    // Ensure interview is at least 24 hours in the future
    const now = new Date();
    const minDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    if (interviewDate < minDate) {
      return res.status(400).json({
        success: false,
        message: 'Interview must be scheduled at least 24 hours in advance'
      });
    }

    // Find active planner
    let planner: Planner | null;
    if (plannerId) {
      planner = await Planner.findByPk(plannerId);
    } else {
      planner = await Planner.findOne({
        where: { userId },
        order: [['createdAt', 'DESC']]
      });
    }

    if (!planner) {
      return res.status(404).json({
        success: false,
        message: 'No active planner found'
      });
    }

    // Create interview
    const interview = await Interview.create({
      userId,
      plannerId: planner.id,
      scheduledAt: interviewDate,
      status: 'pending'
    });

    // Get user details for response
    const user = await User.findByPk(userId);

    return res.status(201).json({
      success: true,
      message: 'Interview scheduled successfully',
      data: {
        interview,
        user: {
          id: user?.id,
          email: user?.email,
          name: (user as any).name
        },
        planner: {
          id: planner.id,
          role: planner.role,
          progressPercent: planner.progressPercent
        }
      }
    });
  } catch (error) {
    logger.error('Failed to schedule interview:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal Server Error' 
    });
  }
});

// Get specific interview details
interviewController.get('/:id', async (req: Request, res: Response) => {
  try {
    const interviewId = Number(req.params.id);
    const rawUserId = req.user?.id;
    const userId = typeof rawUserId === 'string' ? Number(rawUserId) : rawUserId;

    if (Number.isNaN(interviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid interview ID'
      });
    }

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    const interview = await Interview.findOne({
      where: {
        id: interviewId,
        userId
      },
      include: [{
        model: Planner,
        as: 'planner'
      }]
    });

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: interview
    });
  } catch (error) {
    logger.error('Failed to fetch interview:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal Server Error' 
    });
  }
});

// Reschedule interview
interviewController.put('/:id/reschedule', async (req: Request, res: Response) => {
  try {
    const interviewId = Number(req.params.id);
    const { scheduledAt } = req.body as { scheduledAt: string };
    const rawUserId = req.user?.id;
    const userId = typeof rawUserId === 'string' ? Number(rawUserId) : rawUserId;

    if (Number.isNaN(interviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid interview ID'
      });
    }

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    if (!scheduledAt) {
      return res.status(400).json({
        success: false,
        message: 'New scheduled date is required'
      });
    }

    const newDate = new Date(scheduledAt);
    if (isNaN(newDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    // Check if user can reschedule
    const canReschedule = await interviewEligibilityService.canRescheduleInterview(userId, interviewId);
    if (!canReschedule) {
      return res.status(403).json({
        success: false,
        message: 'Interview cannot be rescheduled (less than 24 hours away or not found)'
      });
    }

    const interview = await Interview.findOne({
      where: {
        id: interviewId,
        userId
      }
    });

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    interview.scheduledAt = newDate;
    await interview.save();

    return res.status(200).json({
      success: true,
      message: 'Interview rescheduled successfully',
      data: interview
    });
  } catch (error) {
    logger.error('Failed to reschedule interview:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal Server Error' 
    });
  }
});

// Cancel interview
interviewController.delete('/:id', async (req: Request, res: Response) => {
  try {
    const interviewId = Number(req.params.id);
    const rawUserId = req.user?.id;
    const userId = typeof rawUserId === 'string' ? Number(rawUserId) : rawUserId;

    if (Number.isNaN(interviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid interview ID'
      });
    }

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    const interview = await Interview.findOne({
      where: {
        id: interviewId,
        userId,
        status: 'pending'
      }
    });

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found or already completed'
      });
    }

    await interview.destroy();

    return res.status(200).json({
      success: true,
      message: 'Interview cancelled successfully'
    });
  } catch (error) {
    logger.error('Failed to cancel interview:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal Server Error' 
    });
  }
});

// Get interview report (after completion)
interviewController.get('/:id/report', async (req: Request, res: Response) => {
  try {
    const interviewId = Number(req.params.id);
    const rawUserId = req.user?.id;
    const userId = typeof rawUserId === 'string' ? Number(rawUserId) : rawUserId;

    if (Number.isNaN(interviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid interview ID'
      });
    }

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    const interview = await Interview.findOne({
      where: {
        id: interviewId,
        userId,
        status: 'completed'
      }
    });

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found or not completed'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: interview.id,
        scheduledAt: interview.scheduledAt,
        completedAt: interview.updatedAt,
        transcript: interview.transcript,
        score: interview.scoreJson,
        recordingUrl: interview.recordingUrl
      }
    });
  } catch (error) {
    logger.error('Failed to fetch interview report:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal Server Error' 
    });
  }
});

// Start VAPI interview call
interviewController.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const interviewId = Number(req.params.id);
    const { phoneNumber } = req.body as { phoneNumber: string };
    const rawUserId = req.user?.id;
    const userId = typeof rawUserId === 'string' ? Number(rawUserId) : rawUserId;

    if (Number.isNaN(interviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid interview ID'
      });
    }

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    const interview = await Interview.findOne({
      where: {
        id: interviewId,
        userId,
        status: 'pending'
      },
      include: [{
        model: Planner,
        as: 'planner'
      }]
    });

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found or not pending'
      });
    }

    // Get user details
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get learning modules from planner
    const planner = await Planner.findByPk(interview.plannerId!);
    const learningModules = (planner?.planJson as any)?.modules || [];
    
    if (!interview.plannerId) {
      return res.status(400).json({
        success: false,
        message: 'Interview planner ID is missing'
      });
    }
    
    // Create VAPI workflow
    const workflowConfig = {
      userId,
      plannerId: interview.plannerId,
      role: planner?.role || 'Software Engineer',
      learningModules,
      userEmail: user.email,
      userName: (user as any).name || 'User',
      scheduledAt: interview.scheduledAt
    };

    const assistantId = await vapiWorkflowService.createInterviewWorkflow(workflowConfig);
    
    // Start VAPI call
    const callId = await vapiWorkflowService.startInterviewCall(assistantId, phoneNumber);

    // Update interview with VAPI details
    (interview as any).status = 'in_progress';
    await interview.save();

    return res.status(200).json({
      success: true,
      message: 'Interview call started successfully',
      data: {
        callId,
        assistantId,
        phoneNumber,
        estimatedDuration: '45 minutes'
      }
    });
  } catch (error) {
    logger.error('Failed to start interview call:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal Server Error' 
    });
  }
});

// Get VAPI call status
interviewController.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const interviewId = Number(req.params.id);
    const rawUserId = req.user?.id;
    const userId = typeof rawUserId === 'string' ? Number(rawUserId) : rawUserId;

    if (Number.isNaN(interviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid interview ID'
      });
    }

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    const interview = await Interview.findOne({
      where: {
        id: interviewId,
        userId
      }
    });

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // If interview has VAPI call ID, get status from VAPI
    if (interview.recordingUrl) {
      try {
        const callStatus = await vapiWorkflowService.getCallStatus(interview.recordingUrl);
        return res.status(200).json({
          success: true,
          data: {
            interview,
            callStatus
          }
        });
      } catch (error) {
        logger.error('Failed to get VAPI call status:', error);
        return res.status(200).json({
          success: true,
          data: {
            interview,
            callStatus: null
          }
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        interview,
        callStatus: null
      }
    });
  } catch (error) {
    logger.error('Failed to get interview status:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal Server Error' 
    });
  }
});

// Webhook endpoint for VAPI callbacks (when interview is completed)
interviewController.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { 
      callId, 
      transcript, 
      functionCalls, 
      recordingUrl, 
      status,
      endedReason,
      duration,
      cost
    } = req.body;

    logger.info('VAPI webhook received:', { callId, status, endedReason, duration });

    if (!callId) {
      return res.status(400).json({
        success: false,
        message: 'Call ID is required'
      });
    }

    // Find interview by call ID (stored in recordingUrl field)
    const interview = await Interview.findOne({
      where: {
        recordingUrl: callId
      }
    });

    if (!interview) {
      logger.info('Interview not found for call ID:', callId);
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // Process interview results
    let evaluationResult = null;
    if (transcript && functionCalls) {
      try {
        evaluationResult = await vapiWorkflowService.processInterviewResults(transcript, { functionCalls });
      } catch (error) {
        logger.error('Error processing interview results:', error);
      }
    }

    // Update interview with results
    (interview as any).status = status === 'ended' ? 'completed' : 'in_progress';
    interview.transcript = transcript;
    interview.scoreJson = evaluationResult as any;
    interview.recordingUrl = recordingUrl;
    await interview.save();

    logger.info(`✅ Interview ${interview.id} completed with transcript and evaluation`);

    return res.status(200).json({
      success: true,
      message: 'Interview results updated',
      data: {
        interviewId: interview.id,
        status: interview.status,
        hasTranscript: !!transcript,
        hasEvaluation: !!evaluationResult
      }
    });
  } catch (error) {
    logger.error('Failed to process interview webhook:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal Server Error' 
    });
  }
});

export default interviewController;
