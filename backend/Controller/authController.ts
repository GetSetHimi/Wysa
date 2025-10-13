import express, { Request, Response } from 'express';
import { createRateLimit } from '../middleware/security';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { User } from '../Models';
import axios from 'axios';
import crypto from 'crypto';
import { emailService } from '../Services/emailService';

const authController = express.Router();

// Looser limits in dev to avoid spurious 429s
const isDev = (process.env.NODE_ENV || 'development') === 'development';
const loginLimiter = createRateLimit(isDev ? 60 * 1000 : 15 * 60 * 1000, isDev ? 30 : 5, 'Too many login attempts, please try again later.');
const signupLimiter = createRateLimit(isDev ? 60 * 1000 : 15 * 60 * 1000, isDev ? 30 : 5, 'Too many signup attempts, please try again later.');
const forgotPasswordLimiter = createRateLimit(15 * 60 * 1000, 3, 'Too many forgot password attempts, please try again later.');
const resetPasswordLimiter = createRateLimit(15 * 60 * 1000, 5, 'Too many password reset attempts, please try again later.');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

const signJwt = (user: User) =>
  jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

authController.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password)
      return res.status(400).json({
        success: false,
        message: 'Please enter your email and password',
      });

    const user = await User.findOne({ where: { email } });
    if (!user)
      return res.status(401).json({
        success: false,
        message: 'User not found. Please register.',
      });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return res.status(401).json({
        success: false,
        message: 'Invalid password',
      });

    const token = signJwt(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send('Internal Server Error');
  }
});

const handleRegistration = async (req: Request, res: Response) => {
  try {
    const { username, age, email, password } = req.body as {
      username?: string;
      age?: number;
      email?: string;
      password?: string;
    };

    if (!username || !email || !password)
      return res
        .status(400)
        .json({ success: false, message: 'Please enter username, email and password' });

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const created = await User.create({ username, age: age ?? 18, email, password: hash });

    const token = signJwt(created);

    // Send welcome email
    await emailService.sendWelcomeEmail(email, username);

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: { id: created.id, username: created.username, email },
      token,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

authController.post('/signup', signupLimiter, handleRegistration);
authController.post('/register', signupLimiter, handleRegistration);

authController.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: 'No token' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { email: string };

    const user = await User.findOne({ where: { email: decoded.email } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.status(200).json({
      success: true,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid/Expired token' });
  }
});

// PUT /api/users/:id
authController.put('/users/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { username, age, email, password } = req.body as {
      username?: string;
      age?: number;
      email?: string;
      password?: string;
    };

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (username) user.username = username;
    if (age) user.age = age;
    if (email) user.email = email;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      user.password = hash;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Forgot Password endpoint
authController.post('/forgot-password', forgotPasswordLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store reset token in user record (you might want to create a separate table for this)
    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    // Send password reset email
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    
    const emailSent = await emailService.sendPasswordResetEmail(user.email, resetLink, user.username);
    
    if (!emailSent && isDev) {
      console.log('Password reset link (email service not configured):', resetLink);
    }

    return res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    });
  }
});

// Reset Password endpoint
authController.post('/reset-password', resetPasswordLimiter, async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    const user = await User.findOne({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          [require('sequelize').Op.gt]: new Date(), // Token not expired
        },
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update user password and clear reset token
    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    });
  }
});

// Email test endpoint (for development/testing)
authController.get('/test-email', async (req: Request, res: Response) => {
  try {
    const { email } = req.query as { email?: string };
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email parameter is required',
      });
    }

    const isConnected = await emailService.testConnection();
    if (!isConnected) {
      return res.status(500).json({
        success: false,
        message: 'Email service not configured or connection failed',
      });
    }

    // Send test email
    const testLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
    const emailSent = await emailService.sendPasswordResetEmail(email, testLink, 'Test User');
    
    if (emailSent) {
      return res.status(200).json({
        success: true,
        message: 'Test email sent successfully',
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to send test email',
      });
    }
  } catch (error) {
    console.error('Email test error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    });
  }
});

export default authController;

// OAuth: Google ID token verification (no extra deps)
authController.post('/oauth/google', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body as { idToken?: string };
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'idToken is required' });
    }

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
    const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    const { data } = await axios.get(tokenInfoUrl, { timeout: 10000 });

    const aud = data.aud as string | undefined;
    const email = data.email as string | undefined;
    const emailVerified = String(data.email_verified || data.emailVerified || 'false') === 'true';
    const name = (data.name as string | undefined) || (data.given_name as string | undefined) || undefined;
    const sub = (data.sub as string | undefined) || '';

    if (!aud || !email) {
      return res.status(400).json({ success: false, message: 'Invalid Google token' });
    }
    if (GOOGLE_CLIENT_ID && aud !== GOOGLE_CLIENT_ID) {
      return res.status(401).json({ success: false, message: 'Google token audience mismatch' });
    }
    if (!emailVerified) {
      return res.status(401).json({ success: false, message: 'Email not verified with Google' });
    }

    let user = await User.findOne({ where: { email } });
    if (!user) {
      const randomPassword = `${sub || 'google'}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      const hash = await bcrypt.hash(randomPassword, 10);
      const username = name?.trim() || email.split('@')[0];
      user = await User.create({ username, age: 18, email, password: hash });
    }

    const token = signJwt(user);
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('Google OAuth failed:', error);
    return res.status(500).json({ success: false, message: 'Google OAuth failed' });
  }
});

// OAuth: LinkedIn Authorization Code exchange
authController.post('/oauth/linkedin', async (req: Request, res: Response) => {
  try {
    const { code, redirectUri } = req.body as { code?: string; redirectUri?: string };
    if (!code || !redirectUri) {
      return res.status(400).json({ success: false, message: 'code and redirectUri are required' });
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID || '';
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
    if (!clientId || !clientSecret) {
      return res.status(500).json({ success: false, message: 'LinkedIn credentials not configured' });
    }

    // Exchange code for access token
    const tokenResp = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
    );

    const accessToken = tokenResp.data.access_token as string | undefined;
    if (!accessToken) {
      return res.status(401).json({ success: false, message: 'Failed to obtain LinkedIn access token' });
    }

    // Fetch user info
    // Email
    const emailResp = await axios.get(
      'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))',
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 }
    );
    const email = emailResp.data?.elements?.[0]?.['handle~']?.emailAddress as string | undefined;

    // Profile
    const profileResp = await axios.get('https://api.linkedin.com/v2/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    });
    const localizedFirst = profileResp.data?.localizedFirstName as string | undefined;
    const localizedLast = profileResp.data?.localizedLastName as string | undefined;
    const name = [localizedFirst, localizedLast].filter(Boolean).join(' ').trim();

    if (!email) {
      return res.status(400).json({ success: false, message: 'Unable to retrieve LinkedIn email' });
    }

    let user = await User.findOne({ where: { email } });
    if (!user) {
      const randomPassword = `linkedin:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      const hash = await bcrypt.hash(randomPassword, 10);
      const username = name || email.split('@')[0];
      user = await User.create({ username, age: 18, email, password: hash });
    }

    const token = signJwt(user);
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('LinkedIn OAuth failed:', error);
    return res.status(500).json({ success: false, message: 'LinkedIn OAuth failed' });
  }
});