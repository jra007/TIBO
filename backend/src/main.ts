import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const DEFAULT_DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174'];

/**
 * Explicit allowlist, never a wildcard — `origin: true` (reflecting whatever Origin header the
 * browser sends) combined with `credentials: true` lets any website make credentialed requests
 * to this API. Reads a comma-separated `ALLOWED_ORIGINS` for a real deployment (see README's
 * reverse-proxy section — set it to the same domain as `VITE_API_BASE_URL`); with nothing
 * configured, falls back to the known local dev origins (Vite's own port and docker-compose's
 * mapped one) rather than accepting everything.
 */
function resolveAllowedOrigins(): string[] {
  const configured = process.env.ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configured?.length ? configured : DEFAULT_DEV_ORIGINS;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = resolveAllowedOrigins();
  app.enableCors({ origin: allowedOrigins, credentials: true });
  new Logger('Bootstrap').log(
    `CORS allowed origins: ${allowedOrigins.join(', ')}`,
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
