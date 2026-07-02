import dotenv from 'dotenv';
import path from 'path';

// Membaca file .env dari root folder Backend
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  APP_URL: process.env.APP_URL || 'http://localhost:4000',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  
  DATABASE_URL: process.env.DATABASE_URL || '',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  
  JWT: {
    ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'default_access_secret',
    ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret',
    REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'default_cookie_secret',
};