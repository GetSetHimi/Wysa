import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import winston from 'winston';

type JwtPayload = {
  id: number;
  email: string;
  iat: number;
  exp: number;
};

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authorization header missing' });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return res.status(401).json({ success: false, message: 'Token not provided' });
    }

    // Use same fallback as authController to avoid 500s in dev
    const secret = process.env.JWT_SECRET || 'your_jwt_secret_key';
    const decoded = jwt.verify(token, secret) as JwtPayload;

    req.user = { id: decoded.id, email: decoded.email };
    return next();
  } catch (err) {
    winston.warn('JWT verification failed', err);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}