import { Logger } from '@nestjs/common';

export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');

const INSECURE_DEFAULT_JWT_SECRET = 'dev-insecure-secret-change-me';

/**
 * A missing/default JWT_SECRET means anyone who has ever read this file (or the public repo) can
 * forge a valid token for any user, including an admin — this string is not a secret once it's
 * committed to source control. Kept as a fallback for local dev convenience (docker-compose's own
 * default matches it, see docker-compose.yml), but refuses to boot with it under NODE_ENV=production
 * rather than silently running an authentication bypass in whatever gets deployed with that flag —
 * failing loudly at startup is much cheaper than discovering this after a real deployment.
 */
export const JWT_SECRET = process.env.JWT_SECRET || INSECURE_DEFAULT_JWT_SECRET;

if (JWT_SECRET === INSECURE_DEFAULT_JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET must be set to a real generated secret in production — refusing to start with the known dev default.',
    );
  }
  new Logger('Bootstrap').warn(
    'JWT_SECRET is not set — using the insecure dev default. Set it in .env before any non-local deployment.',
  );
}
