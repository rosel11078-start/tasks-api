import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './setup';

async function bootstrap() {
  try {
    process.loadEnvFile(); // .env for local runs; in production the variables come from the environment
  } catch {
    /* no .env file */
  }
  const app = configureApp(await NestFactory.create(AppModule));
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
