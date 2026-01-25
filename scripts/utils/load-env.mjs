import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..', '..');

/**
 * Load environment variables from .env files
 * Priority order (later files override earlier ones):
 * 1. .env
 * 2. .env.local
 * 3. .env.development (if NODE_ENV=development)
 * 4. .env.production (if NODE_ENV=production)
 * 5. .env.development.local (if NODE_ENV=development)
 * 6. .env.production.local (if NODE_ENV=production)
 */
export function loadEnv() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // Load base .env file first
  const envPath = join(rootDir, '.env');
  if (existsSync(envPath)) {
    config({ path: envPath });
  }
  
  // Load environment-specific .env file
  const envSpecificPath = join(rootDir, `.env.${nodeEnv}`);
  if (existsSync(envSpecificPath)) {
    config({ path: envSpecificPath, override: false });
  }
  
  // Load .env.local (highest priority, overrides everything)
  const envLocalPath = join(rootDir, '.env.local');
  if (existsSync(envLocalPath)) {
    config({ path: envLocalPath, override: false });
  }
  
  // Load environment-specific local file (highest priority)
  const envLocalSpecificPath = join(rootDir, `.env.${nodeEnv}.local`);
  if (existsSync(envLocalSpecificPath)) {
    config({ path: envLocalSpecificPath, override: false });
  }
}

// Auto-load if this module is imported
loadEnv();
