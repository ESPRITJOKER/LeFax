import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import WebSocket from "ws";

declare module "fastify" {
  interface FastifyInstance {
    supabase: SupabaseClient;
  }
}

export default fp(async function supabasePlugin(fastify: FastifyInstance) {
  const client = createClient(fastify.config.SUPABASE_URL, fastify.config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
  fastify.decorate("supabase", client);
});
