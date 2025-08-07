import { z } from 'zod';

// Event validation schemas
export const createEventSchema = z.object({
  eventName: z.string()
    .min(3, 'Event name must be at least 3 characters')
    .max(100, 'Event name must not exceed 100 characters')
    .regex(/^[a-zA-Z0-9\s\-\.]+$/, 'Event name contains invalid characters'),
  
  sportType: z.string()
    .min(1, 'Sport type is required')
    .refine(val => ['soccer', 'basketball', 'football', 'baseball', 'tennis', 'volleyball', 'other'].includes(val), 
      'Invalid sport type'),
  
  dateTime: z.string()
    .min(1, 'Start date and time is required')
    .refine(val => {
      const date = new Date(val);
      return date > new Date();
    }, 'Event start time must be in the future'),
  
  expectedDuration: z.string()
    .min(1, 'Duration is required')
    .transform(val => parseInt(val))
    .refine(val => val >= 10 && val <= 600, 'Duration must be between 10 and 600 minutes'),
  
  description: z.string()
    .max(500, 'Description must not exceed 500 characters')
    .optional(),
  
  thumbnail: z.any()
    .optional(),
  
  youtubeKey: z.string()
    .optional()
    .refine(val => !val || val.length >= 10, 'YouTube key must be at least 10 characters if provided'),
  
  twitchKey: z.string()
    .optional()
    .refine(val => !val || val.length >= 10, 'Twitch key must be at least 10 characters if provided')
});

// Event code validation
export const eventCodeSchema = z.string()
  .length(6, 'Event code must be exactly 6 characters')
  .regex(/^[A-Z0-9]+$/, 'Event code must contain only uppercase letters and numbers');

// Camera registration validation
export const cameraRegistrationSchema = z.object({
  eventCode: eventCodeSchema,
  deviceLabel: z.string()
    .min(3, 'Device label must be at least 3 characters')
    .max(50, 'Device label must not exceed 50 characters')
    .regex(/^[a-zA-Z0-9\s\-]+$/, 'Device label contains invalid characters')
});

// Sanitization utilities
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters
    .substring(0, 1000); // Limit length
};

export const sanitizeEventCode = (code: string): string => {
  return code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 6);
};

// Rate limiting utilities
export const createRateLimiter = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, number[]>();
  
  return (identifier: string): boolean => {
    const now = Date.now();
    const userRequests = requests.get(identifier) || [];
    
    // Filter out old requests
    const recentRequests = userRequests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
      return false; // Rate limit exceeded
    }
    
    recentRequests.push(now);
    requests.set(identifier, recentRequests);
    
    // Cleanup old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      for (const [key, times] of requests.entries()) {
        if (times.length === 0 || now - times[times.length - 1] > windowMs * 2) {
          requests.delete(key);
        }
      }
    }
    
    return true;
  };
};

// Security headers and CSP
export const securityHeaders = {
  'Content-Security-Policy': 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; " +
    "media-src 'self' blob: https:; " +
    "connect-src 'self' wss: https:; " +
    "font-src 'self'; " +
    "frame-src 'none';",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block'
};

export type CreateEventData = z.infer<typeof createEventSchema>;
export type CameraRegistrationData = z.infer<typeof cameraRegistrationSchema>;