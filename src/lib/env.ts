/**
 * Environment validation module
 * Validates required environment variables at startup
 * Call validateEnvironment() in your app initialization
 */

export class EnvironmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentValidationError';
  }
}

/**
 * Validates required environment variables at startup
 * @throws EnvironmentValidationError if validation fails
 */
export function validateEnvironment(): void {
  // Skip validation during Next.js build phase
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return;
  }

  const errors: string[] = [];

  // Validate AUTH_SECRET
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    errors.push('AUTH_SECRET is required');
  } else if (authSecret === 'changeme' || authSecret === 'changeme_dev') {
    errors.push('AUTH_SECRET must not use default value');
  } else if (authSecret.length < 32) {
    errors.push('AUTH_SECRET must be at least 32 characters long (use: openssl rand -base64 32)');
  }

  // Validate DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    errors.push('DATABASE_URL is required');
  } else if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    errors.push('DATABASE_URL must be a valid PostgreSQL connection string');
  }

  // Validate NEXTAUTH_URL in production
  if (process.env.NODE_ENV === 'production') {
    const nextAuthUrl = process.env.NEXTAUTH_URL;
    if (!nextAuthUrl) {
      errors.push('NEXTAUTH_URL is required in production');
    } else if (!nextAuthUrl.startsWith('https://')) {
      errors.push('NEXTAUTH_URL must use HTTPS in production');
    }
  }

  if (errors.length > 0) {
    console.error('❌ Environment validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    console.error('\nApplication cannot start with invalid configuration.');
    console.error('Please check your .env file or environment variables.\n');
    throw new EnvironmentValidationError(
      `Environment validation failed: ${errors.join(', ')}`
    );
  }

  console.log('✓ Environment validation passed');
}

