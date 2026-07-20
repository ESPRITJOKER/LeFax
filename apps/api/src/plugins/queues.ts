import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { Queue } from "bullmq";

declare module "fastify" {
  interface FastifyInstance {
    queues: {
      inference: Queue;
      contentGeneration: Queue;
      embedding: Queue;
    };
  }
}

const DEFAULT_QUEUE_OPTS = {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 2000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 604800 },
  },
};

async function queuesPlugin(fastify: FastifyInstance) {
  const connOpts = { connection: { url: fastify.config.REDIS_URL } };

  const inference = new Queue("inference", {
    ...DEFAULT_QUEUE_OPTS,
    ...connOpts,
  });

  const contentGeneration = new Queue("content-generation", {
    ...DEFAULT_QUEUE_OPTS,
    ...connOpts,
  });

  const embedding = new Queue("embedding", {
    ...DEFAULT_QUEUE_OPTS,
    ...connOpts,
  });

  fastify.decorate("queues", { inference, contentGeneration, embedding });

  fastify.addHook("onClose", async () => {
    await Promise.all([inference.close(), contentGeneration.close(), embedding.close()]);
  });
}

export default fp(queuesPlugin, { name: "queues", dependencies: ["redis"] });
