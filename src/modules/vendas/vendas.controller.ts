// src/modules/vendas/vendas.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';

export class VendasController {
  async getVendasHoje(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Data de hoje (início e fim do dia)
      const hoje = new Date();
      const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);
      const fimDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);

      // Buscar pedidos de hoje
      const pedidosHoje = await prisma.pedido.findMany({
        where: {
          criadoEm: {
            gte: inicioDia,
            lte: fimDia
          },
          status: { notIn: ['CANCELADO'] }
        },
        include: {
          usuario: {
            select: {
              nome: true,
              email: true
            }
          },
          itempedido: {
            include: {
              produto: {
                select: {
                  nome: true
                }
              }
            }
          }
        },
        orderBy: { criadoEm: 'desc' }
      });

      // Calcular totais
      const totalVendas = pedidosHoje.reduce((sum, pedido) => sum + (pedido.total || 0), 0);
      const totalItens = pedidosHoje.reduce((sum, pedido) => 
        sum + pedido.itempedido.reduce((itemSum, item) => itemSum + item.quantidade, 0), 0
      );
      const ticketMedio = pedidosHoje.length > 0 ? totalVendas / pedidosHoje.length : 0;

      // Agrupar por status
      const pedidosPorStatus = pedidosHoje.reduce((acc, pedido) => {
        acc[pedido.status] = (acc[pedido.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Produtos mais vendidos hoje
      const produtosMap = new Map<string, { quantidade: number; total: number; nome: string }>();
      
      pedidosHoje.forEach(pedido => {
        pedido.itempedido.forEach(item => {
          if (item.produto) {
            const produtoId = item.produtoId;
            const current = produtosMap.get(produtoId) || { quantidade: 0, total: 0, nome: item.produto.nome };
            produtosMap.set(produtoId, {
              quantidade: current.quantidade + item.quantidade,
              total: current.total + (item.precoTotal || 0),
              nome: item.produto.nome
            });
          }
        });
      });

      const produtosMaisVendidos = Array.from(produtosMap.entries())
        .map(([id, dados]) => ({
          id,
          nome: dados.nome,
          quantidade: dados.quantidade,
          total: dados.total
        }))
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 10);

      // Formatar resposta
      const resposta = {
        periodo: {
          inicio: inicioDia.toISOString(),
          fim: fimDia.toISOString()
        },
        resumo: {
          totalVendas,
          totalPedidos: pedidosHoje.length,
          totalItens,
          ticketMedio: parseFloat(ticketMedio.toFixed(2))
        },
        pedidosPorStatus,
        produtosMaisVendidos,
        pedidos: pedidosHoje.slice(0, 10).map(pedido => ({
          id: pedido.id,
          numeroPedido: pedido.numeroPedido,
          usuario: {
            nome: pedido.usuario?.nome || 'Cliente',
            email: pedido.usuario?.email || ''
          },
          status: pedido.status,
          total: pedido.total,
          criadoEm: pedido.criadoEm.toISOString(),
          itens: pedido.itempedido.reduce((sum, item) => sum + item.quantidade, 0)
        }))
      };

      reply.send({
        success: true,
        data: resposta
      });
    } catch (error) {
      console.error('Erro ao buscar vendas de hoje:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao buscar vendas de hoje'
      });
    }
  }

  async getVendasPorPeriodo(
    request: FastifyRequest<{
      Querystring: {
        inicio?: string;
        fim?: string;
        status?: string;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const { inicio, fim, status } = request.query;

      // Definir período padrão (últimos 30 dias)
      let dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 30);
      
      let dataFim = new Date();

      if (inicio) {
        dataInicio = new Date(inicio);
        dataInicio.setHours(0, 0, 0, 0);
      }

      if (fim) {
        dataFim = new Date(fim);
        dataFim.setHours(23, 59, 59, 999);
      }

      // Construir filtro
      const where: any = {
        criadoEm: {
          gte: dataInicio,
          lte: dataFim
        }
      };

      if (status) {
        where.status = status;
      }

      // Buscar pedidos do período
      const pedidos = await prisma.pedido.findMany({
        where,
        include: {
          usuario: {
            select: {
              nome: true,
              email: true
            }
          },
          itempedido: true,
          pagamento: true
        },
        orderBy: { criadoEm: 'desc' }
      });

      // Calcular totais
      const totalVendas = pedidos.reduce((sum, pedido) => sum + (pedido.total || 0), 0);
      const totalPedidos = pedidos.length;

      // Agrupar por data para gráfico
      const vendasPorDia: Record<string, number> = {};
      
      pedidos.forEach(pedido => {
        const data = pedido.criadoEm.toISOString().split('T')[0];
        vendasPorDia[data] = (vendasPorDia[data] || 0) + (pedido.total || 0);
      });

      // Ordenar datas
      const vendasPorPeriodo = Object.entries(vendasPorDia)
        .map(([data, total]) => ({ data, total }))
        .sort((a, b) => a.data.localeCompare(b.data));

      // Formatar resposta
      const resposta = {
        periodo: {
          inicio: dataInicio.toISOString(),
          fim: dataFim.toISOString()
        },
        totalVendas,
        totalPedidos,
        vendasPorPeriodo,
        pedidos: pedidos.slice(0, 20).map(pedido => ({
          id: pedido.id,
          numeroPedido: pedido.numeroPedido,
          usuario: {
            nome: pedido.usuario?.nome || 'Cliente',
            email: pedido.usuario?.email || ''
          },
          status: pedido.status,
          total: pedido.total,
          criadoEm: pedido.criadoEm.toISOString(),
          itens: pedido.itempedido.reduce((sum, item) => sum + item.quantidade, 0),
          pagamento: pedido.pagamento?.[0]?.status || 'PENDENTE'
        }))
      };

      reply.send({
        success: true,
        data: resposta
      });
    } catch (error) {
      console.error('Erro ao buscar vendas por período:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao buscar vendas por período'
      });
    }
  }

  async getDashboardPublico(request: FastifyRequest, reply: FastifyReply) {
    try {
      const hoje = new Date();
      const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);
      const fimDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);

      // Contar pedidos de hoje (status diferente de cancelado)
      const pedidosHoje = await prisma.pedido.count({
        where: {
          criadoEm: {
            gte: inicioDia,
            lte: fimDia
          },
          status: { not: 'CANCELADO' }
        }
      });

      // Total de vendas de hoje
      const totalHojeResult = await prisma.pedido.aggregate({
        where: {
          criadoEm: {
            gte: inicioDia,
            lte: fimDia
          },
          status: { not: 'CANCELADO' }
        },
        _sum: { total: true }
      });

      // Estatísticas gerais
      const totalPedidos = await prisma.pedido.count({
        where: { status: { not: 'CANCELADO' } }
      });

      const totalVendas = await prisma.pedido.aggregate({
        where: { status: { not: 'CANCELADO' } },
        _sum: { total: true }
      });

      // Produtos mais vendidos (últimos 30 dias)
      const trintaDiasAtras = new Date();
      trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

      const produtosMaisVendidos = await prisma.$queryRaw`
        SELECT 
          p.id,
          p.nome,
          SUM(ip.quantidade) as quantidade_total,
          COUNT(DISTINCT ped.id) as pedidos_total
        FROM produto p
        JOIN itempedido ip ON p.id = ip.produtoId
        JOIN pedido ped ON ip.pedidoId = ped.id
        WHERE ped.criadoEm >= ${trintaDiasAtras}
          AND ped.status != 'CANCELADO'
        GROUP BY p.id, p.nome
        ORDER BY quantidade_total DESC
        LIMIT 5
      `;

      const resposta = {
        hoje: {
          pedidos: pedidosHoje,
          total: totalHojeResult._sum.total || 0
        },
        total: {
          pedidos: totalPedidos,
          vendas: totalVendas._sum.total || 0
        },
        produtosMaisVendidos: produtosMaisVendidos || []
      };

      reply.send({
        success: true,
        data: resposta
      });
    } catch (error) {
      console.error('Erro ao buscar dashboard público:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao buscar dados do dashboard'
      });
    }
  }

  async getEstatisticasAvancadas(request: FastifyRequest, reply: FastifyReply) {
    try {
      const usuario = request.user as any;

      // Verificar se é admin
      if (usuario.tipo !== 'ADMIN') {
        return reply.status(403).send({
          success: false,
          message: 'Acesso restrito a administradores'
        });
      }

      // Últimos 12 meses
      const dozeMesesAtras = new Date();
      dozeMesesAtras.setMonth(dozeMesesAtras.getMonth() - 11);
      dozeMesesAtras.setDate(1);
      dozeMesesAtras.setHours(0, 0, 0, 0);

      // Vendas por mês
      const vendasPorMes = await prisma.$queryRaw`
        SELECT 
          DATE_FORMAT(criadoEm, '%Y-%m') as mes,
          COUNT(*) as total_pedidos,
          SUM(total) as total_vendas,
          AVG(total) as ticket_medio
        FROM pedido
        WHERE criadoEm >= ${dozeMesesAtras}
          AND status != 'CANCELADO'
        GROUP BY DATE_FORMAT(criadoEm, '%Y-%m')
        ORDER BY mes
      `;

      // Métodos de pagamento mais usados
      const metodosPagamento = await prisma.$queryRaw`
        SELECT 
          metodoPagamento,
          COUNT(*) as total,
          SUM(valor) as valor_total
        FROM pagamento
        WHERE status = 'APROVADO'
        GROUP BY metodoPagamento
        ORDER BY total DESC
      `;

      // Clientes com mais compras
      const topClientes = await prisma.$queryRaw`
        SELECT 
          u.id,
          u.nome,
          u.email,
          COUNT(p.id) as total_pedidos,
          SUM(p.total) as total_gasto
        FROM usuario u
        JOIN pedido p ON u.id = p.usuarioId
        WHERE p.status != 'CANCELADO'
        GROUP BY u.id, u.nome, u.email
        ORDER BY total_gasto DESC
        LIMIT 10
      `;

      const resposta = {
        periodo: {
          inicio: dozeMesesAtras.toISOString(),
          fim: new Date().toISOString()
        },
        vendasPorMes: vendasPorMes || [],
        metodosPagamento: metodosPagamento || [],
        topClientes: topClientes || []
      };

      reply.send({
        success: true,
        data: resposta
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas avançadas:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao buscar estatísticas'
      });
    }
  }
}