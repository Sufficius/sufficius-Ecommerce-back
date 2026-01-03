// src/modules/vendas/vendas.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';

export class VendasController {
  async getVendasHoje(request: FastifyRequest, reply: FastifyReply) {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      const pedidosHoje = await prisma.pedido.findMany({
        where: {
          criadoEm: { gte: hoje, lt: amanha },
          status: { notIn: ['CANCELADO', 'PAGAMENTO_PENDENTE'] }
        },
        include: {
          usuario: { select: { id: true, nome: true, email: true } },
          itempedido: {
            include: {
              produto: { select: { id: true, nome: true, preco: true } }
            }
          },
          pagamento: { select: { status: true, metodoPagamento: true, valor: true } }
        },
        orderBy: { criadoEm: 'desc' }
      });

      const totalVendas = pedidosHoje.reduce((sum, pedido) => sum + Number(pedido.total), 0);
      const totalPedidos = pedidosHoje.length;
      const totalItens = pedidosHoje.reduce((sum, pedido) => 
        sum + pedido.itempedido.reduce((itemSum, item) => itemSum + item.quantidade, 0), 0
      );

      const pedidosPorStatus = pedidosHoje.reduce((acc, pedido) => {
        acc[pedido.status] = (acc[pedido.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      reply.send({
        success: true,
        data: {
          periodo: { inicio: hoje, fim: amanha },
          resumo: {
            totalVendas,
            totalPedidos,
            totalItens,
            ticketMedio: totalPedidos > 0 ? totalVendas / totalPedidos : 0
          },
          pedidosPorStatus,
          pedidos: pedidosHoje.map(pedido => ({
            id: pedido.id,
            numeroPedido: pedido.numeroPedido,
            usuario: pedido.usuario,
            status: pedido.status,
            total: pedido.total,
            criadoEm: pedido.criadoEm,
            itens: pedido.itempedido.length
          }))
        }
      });
    } catch (error) {
      console.error('Erro:', error);
      reply.status(500).send({ success: false, message: 'Erro ao buscar vendas' });
    }
  }

  async getVendasPorPeriodo(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const { inicio, fim } = query;
      
      const dataInicio = inicio ? new Date(inicio) : new Date();
      dataInicio.setHours(0, 0, 0, 0);
      
      const dataFim = fim ? new Date(fim) : new Date();
      dataFim.setHours(23, 59, 59, 999);

      if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime())) {
        return reply.status(400).send({ success: false, message: 'Datas inválidas' });
      }

      const pedidos = await prisma.pedido.findMany({
        where: {
          criadoEm: { gte: dataInicio, lte: dataFim },
          status: { notIn: ['CANCELADO', 'PAGAMENTO_PENDENTE'] }
        },
        include: {
          usuario: { select: { id: true, nome: true, email: true } }
        },
        orderBy: { criadoEm: 'desc' }
      });

      const totalVendas = pedidos.reduce((sum, pedido) => sum + Number(pedido.total), 0);

      reply.send({
        success: true,
        data: {
          periodo: { inicio: dataInicio, fim: dataFim },
          totalVendas,
          totalPedidos: pedidos.length,
          pedidos: pedidos.map(pedido => ({
            id: pedido.id,
            numeroPedido: pedido.numeroPedido,
            usuario: pedido.usuario.nome,
            status: pedido.status,
            total: pedido.total,
            criadoEm: pedido.criadoEm
          }))
        }
      });
    } catch (error) {
      console.error('Erro:', error);
      reply.status(500).send({ success: false, message: 'Erro ao buscar vendas' });
    }
  }

  async getResumoDiario(request: FastifyRequest, reply: FastifyReply) {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      const totalHoje = await prisma.pedido.aggregate({
        where: {
          criadoEm: { gte: hoje, lt: amanha },
          status: { notIn: ['CANCELADO', 'PAGAMENTO_PENDENTE'] }
        },
        _sum: { total: true },
        _count: true
      });

      const vendasHoje = Number(totalHoje._sum.total) || 0;

      reply.send({
        success: true,
        data: {
          data: hoje,
          resumo: {
            totalVendas: vendasHoje,
            totalPedidos: totalHoje._count
          }
        }
      });
    } catch (error) {
      console.error('Erro:', error);
      reply.status(500).send({ success: false, message: 'Erro ao buscar resumo' });
    }
  }
}