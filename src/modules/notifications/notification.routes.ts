// src/modules/notifications/notification.routes.ts
import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/auth.middleware';

export default async function notificationRoutes(app: FastifyInstance) {
  
  // Salvar subscription
  app.post('/subscribe', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['endpoint', 'keys'],
        properties: {
          endpoint: { type: 'string' },
          keys: {
            type: 'object',
            required: ['p256dh', 'auth'],
            properties: {
              p256dh: { type: 'string' },
              auth: { type: 'string' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { endpoint, keys } = request.body as any;
      const user = request.user as any;

      // Verificar se já existe
      const existing = await prisma.pushSubscription.findUnique({
        where: { endpoint }
      });

      if (existing) {
        return reply.send({ success: true, message: 'Subscription já existe' });
      }

      await prisma.pushSubscription.create({
        data: {
          userId: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: request.headers['user-agent']
        }
      });

      return reply.send({ success: true, message: 'Inscrito com sucesso' });
    } catch (error) {
      console.error('Erro ao salvar subscription:', error);
      return reply.status(500).send({ 
        success: false, 
        message: 'Erro ao salvar subscription' 
      });
    }
  });

  // Remover subscription
  app.delete('/unsubscribe', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['endpoint'],
        properties: {
          endpoint: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { endpoint } = request.body as any;
      
      await prisma.pushSubscription.deleteMany({
        where: { endpoint }
      });

      return reply.send({ success: true, message: 'Inscrição removida' });
    } catch (error) {
      console.error('Erro ao remover subscription:', error);
      return reply.status(500).send({ 
        success: false, 
        message: 'Erro ao remover subscription' 
      });
    }
  });

  // Rota pública para pegar a VAPID public key
  app.get('/vapid-public-key', async (request, reply) => {
    return reply.send({ 
      publicKey: process.env.VAPID_PUBLIC_KEY 
    });
  });
}