import express, { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Notification, NotificationCreationAttributes, Planner, User } from '../Models';
import { emailService } from '../Services/emailService';
import { emailScheduler } from '../Services/emailScheduler';
import logger from '../Services/logger';

const notificationController = express.Router();

notificationController.get('/', async (req: Request, res) => {
    try {
        const rawUserId = req.body.userId ?? req.user?.id;
        const userId = typeof rawUserId === 'string' ? Number(rawUserId) : rawUserId;
        if (!userId || Number.isNaN(userId)) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }
        const notifications = await Notification.findAll({ where: { userId } });
        return res.status(200).json({ success: true, notifications });
    } catch (error) {
        logger.error(error);
        return res.status(500).send('Internal Server Error');
    }
});

notificationController.post('/', async (req: Request, res) => {
    try {
        const { message, read, type } = req.body as NotificationCreationAttributes;
        const rawUserId = req.body.userId ?? req.user?.id;
        const userId = typeof rawUserId === 'string' ? Number(rawUserId) : rawUserId;

        if (!userId || Number.isNaN(userId) || !message || !type) {
            return res.status(400).json({ success: false, message: 'User ID, message, and type are required' });
        }

        const newNotification = await Notification.create({
            userId,
            message,
            type,
            read: read ?? false,
        });

        return res.status(201).json({ success: true, notification: newNotification });
    } catch (error) {
        logger.error(error);
        return res.status(500).send('Internal Server Error');
    }
});

// Send daily plan email to specific user
notificationController.post('/sendDailyPlan', async (req: Request, res: Response) => {
    try {
        const { userId, plannerId, dayIndex } = req.body as {
            userId?: number;
            plannerId?: number;
            dayIndex?: number;
        };

        // Get user ID from auth or request body
        const rawUserId = req.user?.id ?? userId;
        const finalUserId = typeof rawUserId === 'string' ? Number(rawUserId) : rawUserId;

        if (!finalUserId || Number.isNaN(finalUserId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'User ID is required' 
            });
        }

        // Find user's active planner if not provided
        let activePlannerId = plannerId;
        if (!activePlannerId) {
            const planner = await Planner.findOne({
                where: {
                    userId: finalUserId,
                    startDate: { [Op.lte]: new Date() },
                    endDate: { [Op.gte]: new Date() }
                },
                order: [['createdAt', 'DESC']]
            });

            if (!planner) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'No active planner found for user' 
                });
            }

            activePlannerId = planner.id;
        }

        // Send daily plan email
        const success = await emailService.sendDailyPlanEmail(
            finalUserId, 
            activePlannerId, 
            dayIndex || 0
        );

        if (success) {
            // Create notification record
            await Notification.create({
                userId: finalUserId,
                message: 'Daily plan email sent successfully',
                type: 'daily_plan',
                read: false,
                payload: {
                    plannerId: activePlannerId,
                    dayIndex: dayIndex || 0,
                    sentAt: new Date()
                }
            });

            return res.status(200).json({ 
                success: true, 
                message: 'Daily plan email sent successfully' 
            });
        } else {
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to send daily plan email' 
            });
        }
    } catch (error) {
        logger.error('Failed to send daily plan email:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal Server Error' 
        });
    }
});

// Get today's tasks for dashboard
notificationController.get('/today', async (req: Request, res: Response) => {
    try {
        const rawUserId = req.user?.id;
        const userId = typeof rawUserId === 'string' ? Number(rawUserId) : rawUserId;

        if (!userId || Number.isNaN(userId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'User ID is required' 
            });
        }

        // Find user's active planner
        const today = new Date();
        const todayDateString = today.toISOString().split('T')[0];

        const planner = await Planner.findOne({
            where: {
                userId,
                startDate: { [Op.lte]: today },
                endDate: { [Op.gte]: today }
            },
            order: [['createdAt', 'DESC']]
        });

        if (!planner) {
            // Return empty result instead of 404 for better UX
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        // Calculate which day of the plan it is
        const start = new Date(planner.startDate);
        const diffTime = today.getTime() - start.getTime();
        let dayIndex = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

        // Extract today's tasks from stored planJson
        const plan: any = (planner as any).planJson || null;
        let tasks: Array<{ title: string; description?: string | null; durationMins?: number | null; resourceLinks?: string[] | null; status?: string }> = [];

        if (plan && Array.isArray(plan.days) && plan.days.length > 0) {
            // Clamp to available plan range
            const maxIndex = plan.days.reduce((max: number, d: any) => typeof d.dayIndex === 'number' ? Math.max(max, d.dayIndex) : max, 0);
            dayIndex = Math.min(dayIndex, maxIndex);

            // Prefer exact dayIndex match
            let day = plan.days.find((d: any) => d && typeof d.dayIndex === 'number' && d.dayIndex === dayIndex);

            // Fallback: match by date string if available
            if (!day) {
                day = plan.days.find((d: any) => typeof d.date === 'string' && d.date === todayDateString);
            }

            // Fallback: use array index if structured that way
            if (!day && plan.days[dayIndex]) {
                day = plan.days[dayIndex];
            }

            const rawTasks = day && Array.isArray(day.tasks) ? day.tasks : [];
            tasks = rawTasks
                .filter((t: any) => t && typeof t.title === 'string' && t.title.trim().length > 0)
                .map((t: any) => ({
                    title: String(t.title).trim(),
                    description: typeof t.description === 'string' ? t.description : null,
                    durationMins: typeof t.durationMins === 'number' && Number.isFinite(t.durationMins)
                        ? Math.max(15, Math.min(8 * 60, Math.round(t.durationMins)))
                        : null,
                    resourceLinks: Array.isArray(t.resourceLinks)
                        ? t.resourceLinks.filter((l: any) => typeof l === 'string' && l.trim().length > 0)
                        : null,
                    status: 'pending',
                }));
        }

        return res.status(200).json({
            success: true,
            data: {
                planner: {
                    id: planner.id,
                    role: planner.role,
                    progressPercent: planner.progressPercent,
                    startDate: planner.startDate,
                    endDate: planner.endDate
                },
                dayIndex,
                tasks
            }
        });
    } catch (error) {
        logger.error('Failed to fetch today\'s tasks:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal Server Error' 
        });
    }
});

// Test email configuration
notificationController.get('/test-email', async (req: Request, res: Response) => {
    try {
        const isValid = await emailService.testEmailConfiguration();
        
        if (isValid) {
            return res.status(200).json({ 
                success: true, 
                message: 'Email configuration is valid' 
            });
        } else {
            return res.status(500).json({ 
                success: false, 
                message: 'Email configuration is invalid' 
            });
        }
    } catch (error) {
        logger.error('Email configuration test failed:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Email configuration test failed' 
        });
    }
});

// Trigger daily emails for all users (admin endpoint)
notificationController.post('/trigger-all', async (req: Request, res: Response) => {
    try {
        await emailScheduler.triggerDailyEmailsForAllUsers();
        
        return res.status(200).json({ 
            success: true, 
            message: 'Daily emails triggered for all users' 
        });
    } catch (error) {
        logger.error('Failed to trigger daily emails:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to trigger daily emails' 
        });
    }
});

// Get scheduler status
notificationController.get('/scheduler-status', async (req: Request, res: Response) => {
    try {
        const status = emailScheduler.getStatus();
        
        return res.status(200).json({ 
            success: true, 
            data: { status } 
        });
    } catch (error) {
        logger.error('Failed to get scheduler status:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to get scheduler status' 
        });
    }
});

export default notificationController;