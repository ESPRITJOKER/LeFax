import Fastify from "fastify";
import configPlugin from "./plugins/config.js";
import jwtPlugin from "./plugins/jwt.js";
import roleGuardPlugin from "./plugins/role-guard.js";
import securityPlugin from "./plugins/security.js";
import supabasePlugin from "./plugins/supabase.js";
import redisPlugin from "./plugins/redis.js";
import queuesPlugin from "./plugins/queues.js";
import authRoutes from "./modules/auth/routes.js";
import healthRoutes from "./modules/health/routes.js";
import studentsRoutes from "./modules/students/routes.js";
import contentRoutes from "./modules/content/routes.js";
import exercisesRoutes from "./modules/exercises/routes.js";
import examsRoutes from "./modules/exams/routes.js";
import coinsRoutes from "./modules/coins/routes.js";
import papersRoutes from "./modules/papers/routes.js";
import diagnosticRoutes from "./modules/diagnostic/routes.js";
import adminRoutes from "./modules/admin/routes.js";
import teacherRoutes from "./modules/teacher/routes.js";
import qaRoutes from "./modules/qa/routes.js";
import schoolsRoutes from "./modules/schools/routes.js";
import paymentsRoutes from "./modules/payments/routes.js";
import aiRoutes from "./modules/ai/routes.js";
import contentPipelineRoutes from "./modules/content-pipeline/routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      transport: process.env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" },
    },
  });

  await app.register(configPlugin);
  await app.register(securityPlugin);
  await app.register(supabasePlugin);
  await app.register(jwtPlugin);
  await app.register(roleGuardPlugin);

  // Infrastructure plugins (skip gracefully if Redis unavailable in dev)
  try {
    await app.register(redisPlugin);
    await app.register(queuesPlugin);
  } catch (err) {
    app.log.warn({ err }, "Redis/BullMQ unavailable — queue features disabled");
  }

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(studentsRoutes);
  await app.register(contentRoutes);
  await app.register(exercisesRoutes);
  await app.register(examsRoutes);
  await app.register(coinsRoutes);
  await app.register(papersRoutes);
  await app.register(diagnosticRoutes);
  await app.register(adminRoutes);
  await app.register(teacherRoutes);
  await app.register(qaRoutes);
  await app.register(schoolsRoutes);
  await app.register(paymentsRoutes);
  await app.register(aiRoutes);
  await app.register(contentPipelineRoutes);

  return app;
}
