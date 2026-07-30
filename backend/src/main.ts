import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Dev-only: reflects any origin so the frontend (5173/5174 depending on how it's run) can call
  // the API directly. Tighten this to an explicit allowlist once a deployment target is chosen.
  app.enableCors({ origin: true, credentials: true });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
