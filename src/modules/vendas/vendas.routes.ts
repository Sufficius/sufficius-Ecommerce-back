// src/modules/vendas/vendas.routes.ts
import { FastifyInstance } from 'fastify';
import { authenticate, isAdmin } from '../../middleware/auth.middleware';
import { prisma } from '../../lib/prisma';

// CORREÇÃO: Importe do caminho correto
import { VendasController } from '../../modules/vendas/vendas.controller';

const vendasController = new VendasController();

export default async function vendasRoutes(app: FastifyInstance) {
  // Rota para vendas de hoje
  app.get('/hoje',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Vendas'],
        summary: 'Obter vendas do dia atual',
        description: 'Retorna todas as vendas realizadas hoje',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' }
            }
          }
        }
      }
    },
    (request, reply) => vendasController.getVendasHoje(request, reply)
  );

  // Rota para vendas por período
  app.get('/periodo',
    {
      preHandler: [authenticate, isAdmin],
      schema: {
        tags: ['Vendas'],
        summary: 'Obter vendas por período',
        description: 'Retorna vendas dentro de um intervalo de datas',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            inicio: { type: 'string' },
            fim: { type: 'string' }
          }
        },
        response: {
          200: { type: 'object' },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    (request, reply) => vendasController.getVendasPorPeriodo(request as any, reply)
  );

  // Rota para resumo diário
  app.get('/resumo-diario',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Vendas'],
        summary: 'Resumo das vendas do dia',
        description: 'Retorna um resumo rápido das vendas de hoje',
        security: [{ bearerAuth: [] }],
        response: {
          200: { type: 'object' }
        }
      }
    },
    (request, reply) => vendasController.getResumoDiario(request, reply)
  );

  // Rota pública para dashboard
  app.get('/dashboard',
    {
      schema: {
        tags: ['Vendas'],
        summary: 'Dashboard de vendas',
        description: 'Estatísticas gerais de vendas',
        response: {
          200: { type: 'object' }
        }
      }
    },
    async (request, reply) => {
      try {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const amanha = new Date(hoje);
        amanha.setDate(amanha.getDate() + 1);

        const [totalHoje, totalMes] = await Promise.all([
          prisma.pedido.aggregate({
            where: {
              criadoEm: { gte: hoje, lt: amanha },
              status: { notIn: ['CANCELADO', 'PAGAMENTO_PENDENTE'] }
            },
            _sum: { total: true },
            _count: true
          }),
          prisma.pedido.aggregate({
            where: {
              criadoEm: {
                gte: new Date(hoje.getFullYear(), hoje.getMonth(), 1),
                lt: amanha
              },
              status: { notIn: ['CANCELADO', 'PAGAMENTO_PENDENTE'] }
            },
            _sum: { total: true },
            _count: true
          })
        ]);

        reply.send({
          success: true,
          data: {
            hoje: {
              total: Number(totalHoje._sum.total) || 0,
              pedidos: totalHoje._count
            },
            mes: {
              total: Number(totalMes._sum.total) || 0,
              pedidos: totalMes._count
            }
          }
        });
      } catch (error) {
        reply.status(500).send({
          success: false,
          message: 'Erro ao gerar dashboard'
        });
      }
    }
  );
}