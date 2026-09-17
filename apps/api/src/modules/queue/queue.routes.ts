import { FastifyInstance } from 'fastify';
import { queueManager } from '../../concurrency/queue.js';
import { admission } from '../../concurrency/admission.js';

export async function queueRoutes(fastify: FastifyInstance) {
  // Global queue health & telemetry
  fastify.get('/status', async (request, reply) => {
    const queueLength = await queueManager.getQueueLength();
    const limits = admission.getLimits();
    const jainsIndex = queueManager.calculateJainsFairnessIndex();

    return reply.send({
      success: true,
      data: {
        queueLength,
        softLimit: limits.softLimit,
        hardLimit: limits.hardLimit,
        maxQueueBuffer: limits.maxQueueBuffer,
        jainsFairnessIndex: jainsIndex,
        isOverloaded: queueLength >= limits.hardLimit,
      },
    });
  });

  // Client polling for individual ticket
  fastify.get('/position', async (request, reply) => {
    const { ticketId } = request.query as { ticketId?: string };
    if (!ticketId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_TICKET_ID', message: 'ticketId query parameter is required' },
      });
    }

    const ticket = await queueManager.getTicketStatus(ticketId);
    return reply.send({ success: true, data: ticket });
  });

  // Worker drain trigger (also run periodically in background)
  fastify.post('/drain', async (request, reply) => {
    const { batchSize = 10 } = (request.body as any) || {};
    const processed = await queueManager.processQueueBatch(batchSize);
    return reply.send({ success: true, data: { processed } });
  });
}
