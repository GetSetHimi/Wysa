import express, { Request, Response } from 'express';
import { z } from 'zod';
import { Planner, Profile, Resume } from '../Models';
import { dailyPlanPdfService } from '../Services/pdfGeneratorService';

const plannerController = express.Router();

const planSchema = z.object({
    summary: z.string().optional(),
    days: z
        .array(
            z.object({
                dayIndex: z.number().int().min(0),
                date: z.string().optional(),
                focus: z.string().optional(),
                tasks: z.array(z.object({
                    dayIndex: z.number().int().min(0),
                    title: z.string().min(1),
                    description: z.string().nullable().optional(),
                    durationMins: z.number().int().min(15).max(8 * 60).nullable().optional(),
                    resourceLinks: z.array(z.string().url()).max(3).nullable().optional(),
                })),
            })
        )
        .nonempty(),
});

type NormalizedTask = {
    dayIndex: number;
    title: string;
    description?: string | null;
    durationMins?: number | null;
    resourceLinks?: string[] | null;
};

type PlannerGenerationBody = {
    role?: string;
    startDate?: string;
    durationDays?: number;
    experienceSummary?: string;
    focusAreas?: string[];
    additionalContext?: string;
};

type GeneratedPlan = {
    summary?: string;
    days: Array<{
        dayIndex: number;
        date?: string;
        focus?: string;
        tasks: NormalizedTask[];
    }>;
};

type AuthedPlannerRequest = Request<unknown, unknown, PlannerGenerationBody> & {
    user?: {
        id?: number;
        email?: string;
    };
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_PLANNER_MODEL ?? 'gemini-1.5-flash';

async function callGeminiForPlanner(prompt: string): Promise<GeneratedPlan | null> {
    if (!GEMINI_API_KEY) {
        console.warn('GEMINI_API_KEY is not configured. Falling back to deterministic planner.');
        return null;
    }

    if (typeof fetch !== 'function') {
        console.error('Global fetch is not available in this runtime. Falling back to deterministic planner.');
        return null;
    }

    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `You are an AI career coach generating structured learning planners. Always respond with valid JSON that matches the requested schema. Do not include markdown fences.

System: You are an AI career coach generating structured learning planners. Always respond with valid JSON that matches the requested schema. Do not include markdown fences.

User: ${prompt}`
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.2,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 8192,
                        responseMimeType: "application/json"
                    }
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error('Gemini planner generation failed:', response.status, errorBody);
                continue;
            }

            const data = (await response.json()) as {
                candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            };

            const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            if (!rawContent) {
                console.warn('Gemini returned empty content for planner generation.');
                continue;
            }

            try {
                const parsed = JSON.parse(rawContent) as GeneratedPlan;
                planSchema.parse(parsed);
                console.info(
                    JSON.stringify({
                        event: 'planner.ai.response',
                        attempt,
                        prompt,
                        response: parsed,
                    })
                );
                return parsed;
            } catch (error) {
                console.error('Failed to parse/validate Gemini planner JSON:', error);
            }
        } catch (error) {
            console.error('Gemini request error:', error);
        }
    }

    return null;
}

function buildPrompt(options: {
    role: string;
    durationDays: number;
    startDateISO: string;
    experienceSummary?: string;
    focusAreas?: string[];
    additionalContext?: string;
    resumeAnalysis?: any;
}): string {
    // Validate required parameters
    if (!options.role || typeof options.role !== 'string' || options.role.trim().length === 0) {
        throw new Error(`Invalid role: ${options.role}`);
    }
    if (!options.durationDays || typeof options.durationDays !== 'number' || options.durationDays <= 0) {
        throw new Error(`Invalid durationDays: ${options.durationDays}`);
    }
    if (!options.startDateISO || typeof options.startDateISO !== 'string' || options.startDateISO.trim().length === 0) {
        throw new Error(`Invalid startDateISO: ${options.startDateISO}`);
    }
    const lines: string[] = [
        `Create a daily learning planner for someone aiming for the role: ${options.role}.`,
        `The planner should cover ${options.durationDays} consecutive days starting on ${options.startDateISO}.`,
        'Respond strictly as JSON matching this schema:',
        '{"summary": string, "days": [{"dayIndex": number, "date": string, "focus": string, "tasks": [{"dayIndex": number, "title": string, "description": string, "durationMins": number, "resourceLinks": string[]}]}]}',
        'Ensure each task has a title, concise description (<160 chars), realistic duration in minutes, and 0-3 resource links.',
        'Limit resource links to reputable sources (YouTube, free courses, docs).',
        'Keep total duration per day under 5 hours.',
    ];

    if (options.experienceSummary) {
        lines.push(`Candidate background: ${options.experienceSummary}`);
    }

    if (options.focusAreas?.length) {
        lines.push(`Focus areas to emphasise: ${options.focusAreas.join(', ')}.`);
    }

    if (options.additionalContext) {
        lines.push(`Additional context: ${options.additionalContext}`);
    }

    // Add resume analysis data for skill gap-based planning
    if (options.resumeAnalysis) {
        const analysis = options.resumeAnalysis;
        lines.push(`\nResume Analysis Data:`);
        lines.push(`ATS Score: ${analysis.scores?.atsScore || 'N/A'}%`);
        lines.push(`Overall Fit Score: ${analysis.scores?.overallFitScore || 'N/A'}%`);
        
        if (analysis.missingCoreSkills?.length > 0) {
            lines.push(`Missing Core Skills: ${analysis.missingCoreSkills.join(', ')}`);
        }
        
        if (analysis.experienceGaps?.length > 0) {
            lines.push(`Experience Gaps:`);
            analysis.experienceGaps.forEach((gap: any) => {
                lines.push(`- ${gap.title}: ${gap.description} (Priority: ${gap.urgency})`);
            });
        }
        
        if (analysis.summary) {
            lines.push(`Resume Summary: ${analysis.summary}`);
        }
        
        lines.push(`\nFocus the learning plan on addressing these skill gaps and experience gaps. Prioritize the missing core skills and high-priority experience gaps.`);
    }

    lines.push('Return valid JSON only.');

    return lines.join('\n');
}

function deterministicFallbackPlan(role: string, durationDays: number, startDateISO: string): GeneratedPlan {
    const days: GeneratedPlan['days'] = [];
    const baseTasks: NormalizedTask[] = [
        {
            dayIndex: 0,
            title: `Research core responsibilities for ${role}`,
            description: 'Read recent job postings and compile the top required skills.',
            durationMins: 90,
            resourceLinks: ['https://www.levels.fyi/jobs'],
        },
        {
            dayIndex: 0,
            title: 'Hands-on exercise',
            description: 'Build a small project segment that reflects a typical daily task.',
            durationMins: 120,
            resourceLinks: ['https://www.frontendmentor.io/challenges'],
        },
        {
            dayIndex: 0,
            title: 'Reflection & notes',
            description: 'Summarize learnings and identify gaps to address next.',
            durationMins: 30,
            resourceLinks: [],
        },
    ];

    for (let i = 0; i < durationDays; i += 1) {
        const date = new Date(startDateISO);
        date.setDate(date.getDate() + i);
        const isoDate = date.toISOString().split('T')[0];

        const tasks = baseTasks.map((task) => ({
            ...task,
            dayIndex: i,
            title: task.title.replace('Hands-on', `Hands-on Day ${i + 1}`),
        }));

        days.push({
            dayIndex: i,
            date: isoDate,
            focus: i === 0 ? 'Kick-off & baseline assessment' : `Skill deep dive - Day ${i + 1}`,
            tasks,
        });
    }

    return {
        summary: `Auto-generated ${durationDays}-day planner for ${role}.`,
        days,
    };
}

function normaliseGeneratedPlan(plan: GeneratedPlan, durationDays: number): {
    planJson: GeneratedPlan;
    tasks: NormalizedTask[];
} {
    const safeDays = Array.isArray(plan.days) ? plan.days : [];
    const tasks: NormalizedTask[] = [];

    safeDays.forEach((day) => {
            const fallbackDayIndex = safeDays.indexOf(day);
            const dayIndex = Number.isFinite(day.dayIndex)
                ? Math.max(0, Math.floor(day.dayIndex))
                : Math.max(0, fallbackDayIndex);
        const dayTasks = Array.isArray(day.tasks) ? day.tasks : [];
        dayTasks.forEach((task) => {
            if (!task || typeof task.title !== 'string' || !task.title.trim()) {
                return;
            }

            const cleanLinks = Array.isArray(task.resourceLinks)
                ? task.resourceLinks.filter((link) => typeof link === 'string' && link.trim().length > 0)
                : [];

                        const rawDurationValue = (task as { durationMins?: unknown }).durationMins;
                        let numericDuration: number | undefined;

                        if (typeof rawDurationValue === 'number' && Number.isFinite(rawDurationValue)) {
                            numericDuration = rawDurationValue;
                        } else if (typeof rawDurationValue === 'string') {
                            const parsed = Number.parseInt(rawDurationValue, 10);
                            if (Number.isFinite(parsed)) {
                                numericDuration = parsed;
                            }
                        }

            tasks.push({
                dayIndex,
                title: task.title.trim(),
                description: task.description?.trim() ?? null,
                            durationMins:
                                typeof numericDuration === 'number'
                                    ? Math.max(15, Math.min(8 * 60, Math.round(numericDuration)))
                                    : null,
                resourceLinks: cleanLinks.length ? cleanLinks : null,
            });
        });
    });

    if (!tasks.length) {
            const fallback = deterministicFallbackPlan('Generalist Professional', durationDays, new Date().toISOString());
            return {
                planJson: plan,
                tasks: fallback.days.flatMap((day) => day.tasks),
            };
    }

    return { planJson: plan, tasks };
}

function resolveDurationDays(raw?: number): number {
    if (!raw || Number.isNaN(raw) || raw < 1) {
        return 7;
    }
    return Math.min(56, Math.floor(raw));
}

plannerController.post(
    '/api/planner/generate',
    async (req: AuthedPlannerRequest, res: Response) => {
        try {
            console.log('Planner generation request received:', req.body);
            const userId = req.user?.id;
            if (!userId) {
                console.error('User ID not found in request');
                return res.status(401).json({ success: false, message: 'User ID is required' });
            }

            const {
                role: roleFromBody,
                startDate,
                durationDays: rawDuration,
                experienceSummary,
                focusAreas,
                additionalContext,
            } = req.body ?? {};

            console.log('Request params:', { roleFromBody, startDate, rawDuration, experienceSummary, focusAreas, additionalContext });

            let profile = null;
            try {
                profile = await Profile.findOne({ where: { userId } });
                console.log('Profile found:', profile ? 'Yes' : 'No');
            } catch (error) {
                console.error('Failed to fetch profile for planner generation:', error);
                return res.status(500).json({ success: false, message: 'Failed to fetch user profile' });
            }

            const role = roleFromBody ?? profile?.desiredRole ?? 'Software Engineer';
            console.log('Using role:', role, 'roleFromBody:', roleFromBody, 'profile.desiredRole:', profile?.desiredRole);

            // Validate role
            if (!role || typeof role !== 'string' || role.trim().length === 0) {
                console.error('Invalid role provided:', role);
                return res.status(400).json({ success: false, message: 'Valid role is required' });
            }

            const preferenceSummary =
                profile?.preferences && typeof profile.preferences === 'object' && 'summary' in profile.preferences
                    ? String((profile.preferences as Record<string, unknown>).summary)
                    : undefined;

            const startDateObj = startDate ? new Date(startDate) : new Date();
            if (Number.isNaN(startDateObj.getTime())) {
                console.error('Invalid start date provided:', startDate);
                return res.status(400).json({ success: false, message: 'Invalid start date' });
            }
            const startDateISO = startDateObj.toISOString().split('T')[0];

            const durationDays = resolveDurationDays(rawDuration ?? (profile?.weeklyHours ? Math.ceil(profile.weeklyHours / 2) : 7));
            console.log('Calculated duration days:', durationDays, 'rawDuration:', rawDuration, 'profile.weeklyHours:', profile?.weeklyHours);

            // Validate durationDays
            if (!durationDays || durationDays <= 0 || durationDays > 56) {
                console.error('Invalid duration days calculated:', durationDays);
                return res.status(400).json({ success: false, message: 'Invalid duration days calculated' });
            }

            // Validate all required parameters before building prompt
            if (!role || !startDateISO || !durationDays) {
                const missingParams = [];
                if (!role) missingParams.push('role');
                if (!startDateISO) missingParams.push('startDateISO');
                if (!durationDays) missingParams.push('durationDays');
                console.error('Missing required parameters for prompt building:', missingParams);
                return res.status(400).json({
                    success: false,
                    message: `Missing required parameters: ${missingParams.join(', ')}`
                });
            }

            // Fetch latest resume analysis for skill gap-based planning
            let resumeAnalysis = null;
            try {
                const latestResume = await Resume.findOne({
                    where: { userId },
                    order: [['createdAt', 'DESC']]
                });
                console.log('Latest resume found:', latestResume ? 'Yes' : 'No');

                if (latestResume && latestResume.parsedJson) {
                    resumeAnalysis = latestResume.parsedJson;
                    console.log('Resume analysis found');
                } else {
                    console.log('No resume analysis available');
                }
            } catch (resumeError) {
                console.error('Error fetching resume analysis:', resumeError);
            }

            let prompt;
            try {
                const promptOptions = {
                    role,
                    durationDays,
                    startDateISO,
                    experienceSummary: experienceSummary ?? preferenceSummary,
                    focusAreas,
                    additionalContext,
                    resumeAnalysis,
                };
                console.log('Building prompt with options:', JSON.stringify(promptOptions, null, 2));
                prompt = buildPrompt(promptOptions);
                console.log('Prompt built successfully');
                console.log('Generated prompt length:', prompt.length);
            } catch (promptError) {
                console.error('Error building prompt:', promptError);
                console.error('Prompt options that caused the error:', {
                    role,
                    durationDays,
                    startDateISO,
                    experienceSummary: experienceSummary ?? preferenceSummary,
                    focusAreas,
                    additionalContext,
                    resumeAnalysis: resumeAnalysis ? 'Present' : 'Not present'
                });
                return res.status(500).json({
                    success: false,
                    message: `Failed to build prompt for AI planner: ${promptError instanceof Error ? promptError.message : 'Unknown error'}`
                });
            }

            let aiPlan;
            try {
                aiPlan = (await callGeminiForPlanner(prompt)) ?? deterministicFallbackPlan(role, durationDays, startDateISO);
                console.log('AI plan generated successfully');
            } catch (aiError) {
                console.error('Error generating AI plan:', aiError);
                return res.status(500).json({ success: false, message: 'Failed to generate learning plan' });
            }

            let normalized;
            try {
                normalized = normaliseGeneratedPlan(aiPlan, durationDays);
                console.log('Plan normalized successfully');
            } catch (normalizeError) {
                console.error('Error normalizing plan:', normalizeError);
                return res.status(500).json({ success: false, message: 'Failed to normalize learning plan' });
            }

            const endDate = new Date(startDateObj);
            endDate.setDate(endDate.getDate() + (durationDays - 1));

            let planner;
            try {
                planner = await Planner.create({
                    userId,
                    role,
                    startDate: startDateObj,
                    endDate,
                    planJson: normalized.planJson,
                    progressPercent: 0,
                });
                console.log('Planner created successfully');
            } catch (plannerError) {
                console.error('Error creating planner:', plannerError);
                return res.status(500).json({ success: false, message: 'Failed to create learning plan' });
            }

            return res.status(201).json({
                success: true,
                message: 'Planner generated successfully',
                data: {
                    planner,
                    tasks: normalized.tasks,
                },
            });
        } catch (error) {
            console.error('Planner generation failed:', error);
            return res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }
);

plannerController.get(
    '/api/planner/:plannerId',
    async (req: Request<{ plannerId: string }>, res: Response) => {
        try {
            const plannerId = Number(req.params.plannerId);
            if (Number.isNaN(plannerId)) {
                return res.status(400).json({ success: false, message: 'Invalid planner ID' });
            }

            const planner = await Planner.findByPk(plannerId);
            if (!planner) {
                return res.status(404).json({ success: false, message: 'Planner not found' });
            }

            return res.json({ success: true, data: { planner, tasks: [] } });
        } catch (error) {
            console.error('Failed to fetch planner:', error);
            return res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }
);

plannerController.get(
    '/api/planner/user/:userId',
    async (req: Request<{ userId: string }>, res: Response) => {
        try {
            const userId = Number(req.params.userId);
            if (Number.isNaN(userId)) {
                return res.status(400).json({ success: false, message: 'Invalid user ID' });
            }

            const planners = await Planner.findAll({
                where: { userId },
                order: [['createdAt', 'DESC']],
            });

            return res.json({ success: true, data: planners });
        } catch (error) {
            console.error('Failed to fetch planners for user:', error);
            return res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }
);

plannerController.put(
    '/api/planner/:plannerId',
    async (
        req: Request<{ plannerId: string }, unknown, { progressPercent?: number }>,
        res: Response
    ) => {
        try {
            const plannerId = Number(req.params.plannerId);
            if (Number.isNaN(plannerId)) {
                return res.status(400).json({ success: false, message: 'Invalid planner ID' });
            }

            const { progressPercent } = req.body ?? {};
            if (typeof progressPercent !== 'number' || Number.isNaN(progressPercent)) {
                return res
                    .status(400)
                    .json({ success: false, message: 'progressPercent must be a valid number' });
            }

            const clamped = Math.max(0, Math.min(100, progressPercent));

            const planner = await Planner.findByPk(plannerId);
            if (!planner) {
                return res.status(404).json({ success: false, message: 'Planner not found' });
            }

            planner.progressPercent = clamped;
            await planner.save();

            return res.json({ success: true, message: 'Planner progress updated', data: planner });
        } catch (error) {
            console.error('Failed to update planner progress:', error);
            return res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }
);

// Generate daily plan PDF
plannerController.get(
    '/api/planner/:plannerId/daily-pdf',
    async (req: Request<{ plannerId: string }>, res: Response) => {
        try {
            const plannerId = Number(req.params.plannerId);
            const dayIndex = Number(req.query.dayIndex) || 0;
            const userId = req.user?.id;

            if (Number.isNaN(plannerId)) {
                return res.status(400).json({ success: false, message: 'Invalid planner ID' });
            }

            if (!userId) {
                return res.status(401).json({ success: false, message: 'User ID is required' });
            }

            const planner = await Planner.findByPk(plannerId);
            if (!planner) {
                return res.status(404).json({ success: false, message: 'Planner not found' });
            }

            // Check if user owns this planner
            if (planner.userId !== userId) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }

            const fileName = await dailyPlanPdfService.generateDailyPlanPdf(plannerId, userId, dayIndex);
            const downloadUrl = dailyPlanPdfService.getPdfDownloadPath(fileName);

            return res.json({
                success: true,
                message: 'Daily plan PDF generated successfully',
                data: {
                    fileName,
                    downloadUrl,
                    plannerId,
                    dayIndex
                }
            });
        } catch (error) {
            console.error('Failed to generate daily plan PDF:', error);
            return res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }
);

export default plannerController;