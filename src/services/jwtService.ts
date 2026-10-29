import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export class JWTService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
  private static readonly JWT_EXPIRES_IN = process.env.SESSION_TIMEOUT || '24h';

  static generateToken(user: { id: string; email: string; role: string }): string {
    try {
      const payload: JWTPayload = {
        userId: user.id,
        email: user.email,
        role: user.role
      };

      return jwt.sign(payload, this.JWT_SECRET, {
        expiresIn: this.JWT_EXPIRES_IN,
        algorithm: 'HS256'
      });
    } catch (error) {
      logger.error('JWT generation failed', { userId: user.id, error });
      throw new Error('Failed to generate authentication token');
    }
  }

  static verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET, {
        algorithms: ['HS256']
      }) as JWTPayload;

      logger.debug('JWT token verified successfully', { 
        userId: decoded.userId, 
        role: decoded.role 
      });

      return decoded;
    } catch (error) {
      logger.warn('JWT token verification failed', { error: error.message });
      return null;
    }
  }

  static refreshToken(user: { id: string; email: string; role: string }): string {
    try {
      const payload: JWTPayload = {
        userId: user.id,
        email: user.email,
        role: user.role
      };

      return jwt.sign(payload, this.JWT_SECRET, {
        expiresIn: '7d', // Refresh tokens last longer
        algorithm: 'HS256'
      });
    } catch (error) {
      logger.error('JWT refresh token generation failed', { userId: user.id, error });
      throw new Error('Failed to generate refresh token');
    }
  }

  static decodeToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      return decoded;
    } catch (error) {
      logger.warn('JWT token decode failed', { error });
      return null;
    }
  }

  static isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  }

  static getTokenExpiration(token: string): Date | null {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return null;
    }

    return new Date(decoded.exp * 1000);
  }

  static extractTokenFromHeader(authHeader: string | null): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    return authHeader.substring(7);
  }

  static createSecureCookie(token: string): string {
    const isSecure = process.env.NODE_ENV === 'production';
    const httpOnly = true;
    const sameSite = 'strict';

    return `jwt=${token}; Path=/; HttpOnly=${httpOnly}; Secure=${isSecure}; SameSite=${sameSite}; Max-Age=86400`; // 24 hours
  }

  static validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static async hashPassword(password: string): Promise<string> {
    try {
      const saltRounds = 12; // Higher salt rounds for better security
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      logger.error('Password hashing failed', { error });
      throw new Error('Failed to hash password');
    }
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Password verification failed', { error });
      return false;
    }
  }

  static generateApiKey(userId: string): string {
    try {
      const payload = {
        userId,
        type: 'api_key',
        timestamp: Date.now()
      };

      return jwt.sign(payload, this.JWT_SECRET, {
        expiresIn: '30d', // API keys last 30 days
        algorithm: 'HS256'
      });
    } catch (error) {
      logger.error('API key generation failed', { userId, error });
      throw new Error('Failed to generate API key');
    }
  }

  static verifyApiKey(apiKey: string): { valid: boolean; userId?: string } {
    try {
      const decoded = jwt.verify(apiKey, this.JWT_SECRET, {
        algorithms: ['HS256']
      }) as any;

      if (decoded.type !== 'api_key') {
        return { valid: false };
      }

      logger.info('API key verified successfully', { userId: decoded.userId });
      return { valid: true, userId: decoded.userId };
    } catch (error) {
      logger.warn('API key verification failed', { error: error.message });
      return { valid: false };
    }
  }
}