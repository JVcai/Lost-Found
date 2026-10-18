import "reflect-metadata";
import {
  Module,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ZodError } from "zod";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { Api } from "./controller";
import { Service, log } from "./service";
@Catch()
class Errors implements ExceptionFilter {
  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (e instanceof ZodError)
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: e.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    if (e instanceof HttpException)
      return res.status(e.getStatus()).json(e.getResponse());
    log.error(
      { type: e instanceof Error ? e.name : "Unknown" },
      "Unhandled request error",
    );
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Something went wrong. Please try again",
    });
  }
}
@Module({ controllers: [Api], providers: [Service] })
class App {}
async function main() {
  const app = await NestFactory.create(App);
  const s = app.get(Service);
  app.use(helmet());
  app.enableCors({
    origin: s.config.CORS_ORIGINS.split(",").map((v) => v.trim()),
  });
  app.use(
    "/auth",
    rateLimit({
      windowMs: 60000,
      limit: 10,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: "RATE_LIMITED",
        message: "Too many requests. Please try again in a minute.",
      },
    }),
  );
  app.use(
    rateLimit({
      windowMs: 60000,
      limit: 180,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: "RATE_LIMITED",
        message: "Too many requests. Please try again in a minute.",
      },
    }),
  );
  app.useGlobalFilters(new Errors());
  let working = false;
  const interval = setInterval(async () => {
    if (working) return;
    working = true;
    try {
      await s.work();
      await s.workPush();
    } catch {
      log.error("Worker tick failed");
    } finally {
      working = false;
    }
  }, 2000);
  interval.unref();
  app.enableShutdownHooks();
  await app.listen(s.config.PORT, "0.0.0.0");
}
main().catch(() => {
  log.fatal("Startup failed: check environment configuration");
  process.exit(1);
});
