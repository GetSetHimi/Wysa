import express, { Request, Response } from 'express';
import { Profile as profileModel } from '../Models';
import { isValidTimeZone } from '../utils/timezone';

type AuthedRequest<B = unknown> = Request & {
  user?: {
    id?: number;
    email?: string;
  };
  body: B;
};

const profileController = express.Router();


profileController.post('/api/profile', async (req: AuthedRequest<{
  desiredRole?: string;
  weeklyHours?: number;
  timezone?: string;
  preferences?: Record<string, unknown>;
  name?: string;
  phone?: string;
  currentRole?: string;
  experienceYears?: number;
  skills?: string[];
}>, res: Response) => {
  try {
    const { user } = req as AuthedRequest;
    const { desiredRole, weeklyHours, timezone, preferences, name, phone, currentRole, experienceYears, skills } = req.body as {
      desiredRole?: string;
      weeklyHours?: number;
      timezone?: string;
      preferences?: Record<string, unknown>;
      name?: string;
      phone?: string;
      currentRole?: string;
      experienceYears?: number;
      skills?: string[];
    };

    if (!desiredRole || typeof desiredRole !== 'string') {
      return res.status(400).json({ success: false, message: 'desiredRole is required' });
    }

    if (!weeklyHours || typeof weeklyHours !== 'number') {
      return res.status(400).json({ success: false, message: 'weeklyHours is required' });
    }

    if (!timezone || !isValidTimeZone(timezone)) {
      return res.status(400).json({ success: false, message: 'timezone must be a valid IANA string' });
    }

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ success: false, message: 'preferences is required' });
    }

    const userId = user?.id ?? null;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User ID is required' });
    }

    const created = await profileModel.create({
      userId,
      desiredRole,
      weeklyHours,
      timezone,
      preferences,
      name: name ?? null,
      phone: phone ?? null,
      currentRole: currentRole ?? null,
      experienceYears: typeof experienceYears === 'number' ? experienceYears : null,
      skills: Array.isArray(skills) ? skills : null,
    });

    return res.status(201).json({ success: true, message: 'Profile created successfully', profile: created });
  } catch (error) {
    console.error('Failed to create profile:', error);
    return res.status(500).send('Internal Server Error');
  }
});

profileController.put('/api/profile', async (req: AuthedRequest, res: Response) => {
  try {
    const { user } = req as AuthedRequest;
    const userId = user?.id ?? null;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User ID is required' });
    }

    const profile = await profileModel.findOne({ where: { userId } });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    const updates = req.body as Partial<{
      desiredRole: string;
      weeklyHours: number;
      timezone: string;
      preferences: Record<string, unknown>;
      name: string;
      phone: string;
      currentRole: string;
      experienceYears: number;
      skills: string[];
    }>;

    if (updates.timezone && !isValidTimeZone(updates.timezone)) {
      return res.status(400).json({ success: false, message: 'timezone must be a valid IANA string' });
    }

    await profile.update(updates);

    return res.status(200).json({ success: true, message: 'Profile updated successfully', profile });
  } catch (error) {
    console.error('Failed to update profile:', error);
    return res.status(500).send('Internal Server Error');
  }
});

profileController.get('/api/profile', async (req: AuthedRequest, res: Response) => {
  try {
    const { user } = req as AuthedRequest;
    const userId = user?.id ?? null;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User ID is required' });
    }

    const profile = await profileModel.findOne({ where: { userId } });
    // Return null instead of 404 for missing profiles
    return res.status(200).json({ success: true, profile: profile || null });
  } catch (error) {
    console.error('Failed to fetch profile:', error);
    return res.status(500).send('Internal Server Error');
  }
});

profileController.delete('/api/profile', async (req: AuthedRequest, res: Response) => {
  try {
    const { user } = req as AuthedRequest;
    const userId = user?.id ?? null;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User ID is required' });
    }

    const profile = await profileModel.findOne({ where: { userId } });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    await profile.destroy();

    return res.status(200).json({ success: true, message: 'Profile deleted successfully' });
  } catch (error) {
    console.error('Failed to delete profile:', error);
    return res.status(500).send('Internal Server Error');
  }
});



export default profileController;