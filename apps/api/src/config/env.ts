import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),

  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173,https://le-fax-web.vercel.app")
    .transform((v) => v.split(",").map((s) => s.trim())),

  SMS_PROVIDER: z.enum(["console", "africastalking"]).default("console"),
  AFRICASTALKING_USERNAME: z.string().optional(),
  AFRICASTALKING_API_KEY: z.string().optional(),
  AFRICASTALKING_SENDER_ID: z.string().optional(),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // CinetPay
  CINETPAY_API_KEY: z.string().default(""),
  CINETPAY_SECRET_KEY: z.string().default(""),
  CINETPAY_MERCHANT_ID: z.string().default(""),
  CINETPAY_WEBHOOK_SECRET: z.string().default(""),

  // LLM providers
  LLM_PROVIDER: z.enum(["mistral", "openai", "anthropic"]).default("mistral"),
  MISTRAL_API_KEY: z.string().default(""),
  MISTRAL_BASE_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_BASE_URL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().default(""),
  ANTHROPIC_BASE_URL: z.string().optional(),

  // Embedding service
  EMBEDDING_SERVICE_URL: z.string().default("http://localhost:8080"),

  // Guardrails
  RAG_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.5),
  RAG_TOP_K: z.coerce.number().int().positive().default(5),
  TUTOR_DAILY_LIMIT: z.coerce.number().int().positive().default(50),
  CONFIDENCE_FLAG_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}
