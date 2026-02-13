// src/modules/vendas/vendas.routes.ts
import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';
import { VendasHojeRoute } from '../../modules/vendas/vendas.routes';
import { authenticate } from '../../middleware/auth.middleware';

// Interface para a rota
interface DashboardPublicoRoute {
  Reply: {
    200: {
      success: boolean;
      data: {
        hoje: {
          pedidos: number;
          total: number;
        };
        total: {
          pedidos: number;
          vendas: number;
        };
        produtosMaisVendidos: Array<any>;
      };
    };
    500: {
      success: boolean;
      message: string;
    };
  };
}

export default async function vendasRoutes(app: FastifyInstance) {
  // Rota pública para dashboard básico - SEM CONTROLLER
  app.get<DashboardPublicoRoute>(
    '/dashboard',
    {
      schema: {
        tags: ['Vendas'],
        summary: 'Dashboard público de vendas',
        description: 'Retorna dados básicos de vendas para display público',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  hoje: {
                    type: 'object',
                    properties: {
                      pedidos: { type: 'number' },
                      total: { type: 'number' }
                    }
                  },
                  total: {
                    type: 'object',
                    properties: {
                      pedidos: { type: 'number' },
                      vendas: { type: 'number' }
                    }
                  },
                  produtosMaisVendidos: {
                    type: 'array',
                    items: { type: 'object' }
                  }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        // 1. Vendas de hoje
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const amanha = new Date(hoje);
        amanha.setDate(amanha.getDate() + 1);

        const pedidosHoje = await prisma.pedido.count({
          where: {
            criadoEm: {
              gte: hoje,
              lt: amanha
            },
            status: { in: ['ENVIADO', 'ENTREGUE'] }
          }
        });

        const totalHoje = await prisma.pedido.aggregate({
          where: {
            criadoEm: {
              gte: hoje,
              lt: amanha
            },
            status: { in: ['ENVIADO', 'ENTREGUE'] }
          },
          _sum: {
            total: true
          }
        });

        // 2. Total de vendas
        const totalPedidos = await prisma.pedido.count({
          where: {
            status: { in: ['ENVIADO', 'ENTREGUE'] }
          }
        });

        const totalVendas = await prisma.pedido.aggregate({
          where: {
            status: { in: ['ENVIADO', 'ENTREGUE'] }
          },
          _sum: {
            total: true
          }
        });

        // 3. Produtos mais vendidos
        const produtosMaisVendidos = await prisma.itempedido.groupBy({
          by: ['produtoId'],
          where: {
            pedido: {
              status: { in: ['ENVIADO', 'ENTREGUE'] }
            }
          },
          _sum: {
            quantidade: true
          },
          _count: {
            produtoId: true
          },
          orderBy: {
            _sum: {
              quantidade: 'desc'
            }
          },
          take: 10
        });

        // Buscar informações dos produtos
        const produtosComInfo = await Promise.all(
          produtosMaisVendidos.map(async (item) => {
            const produto = await prisma.produto.findUnique({
              where: { id: item.produtoId },
              select: {
                id: true,
                nome: true,
                preco: true
              }
            });

            return {
              produtoId: item.produtoId,
              nome: produto?.nome || 'Produto não encontrado',
              preco: produto?.preco || 0,
              quantidadeVendida: item._sum.quantidade || 0,
              vezesVendido: item._count.produtoId || 0,
              totalVendido: (produto?.preco || 0) * (item._sum.quantidade || 0)
            };
          })
        );

        return reply.code(200).send({
          success: true,
          data: {
            hoje: {
              pedidos: pedidosHoje,
              total: totalHoje._sum.total || 0
            },
            total: {
              pedidos: totalPedidos,
              vendas: totalVendas._sum.total || 0
            },
            produtosMaisVendidos: produtosComInfo
          }
        });

      } catch (error: any) {
        console.error('Erro no dashboard:', error);
        return reply.status(500).send({
          success: false,
          message: 'Erro ao buscar dados do dashboard'
        });
      }
    }
  );

  // Você pode adicionar mais rotas aqui...

  // Exemplo: Rota para vendas por período
  app.get<{
    Querystring: { inicio: string; fim: string };
    Reply: {
      200: {
        success: boolean;
        data: {
          periodo: {
            inicio: string;
            fim: string;
          };
          totalPedidos: number;
          totalVendas: number;
          pedidos: Array<any>;
        };
      };
      400: {
        success: boolean;
        message: string;
      };
    };
  }>(
    '/periodo',
    {
      schema: {
        tags: ['Vendas'],
        summary: 'Vendas por período',
        description: 'Retorna vendas dentro de um período específico',
        querystring: {
          type: 'object',
          properties: {
            inicio: { type: 'string', format: 'date' },
            fim: { type: 'string', format: 'date' }
          },
          required: ['inicio', 'fim']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  periodo: {
                    type: 'object',
                    properties: {
                      inicio: { type: 'string' },
                      fim: { type: 'string' }
                    }
                  },
                  totalPedidos: { type: 'number' },
                  totalVendas: { type: 'number' },
                  pedidos: { type: 'array', items: { type: 'object' } }
                }
              }
            }
          },
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
    async (request, reply) => {
      try {
        const { inicio, fim } = request.query;

        const dataInicio = new Date(inicio);
        const dataFim = new Date(fim);
        dataFim.setHours(23, 59, 59, 999);

        if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime())) {
          return reply.status(400).send({
            success: false,
            message: 'Datas inválidas'
          });
        }

        const pedidos = await prisma.pedido.findMany({
          where: {
            criadoEm: {
              gte: dataInicio,
              lte: dataFim
            },
            status: { in: ['ENVIADO', 'ENTREGUE'] }
          },
          include: {
            itempedido: {
              include: {
                produto: {
                  select: {
                    nome: true,
                    preco: true
                  }
                }
              }
            }
          },
          orderBy: {
            criadoEm: 'desc'
          }
        });

        const totalVendas = pedidos.reduce((sum, pedido) => sum + pedido.total, 0);

        return reply.code(200).send({
          success: true,
          data: {
            periodo: {
              inicio: dataInicio.toISOString(),
              fim: dataFim.toISOString()
            },
            totalPedidos: pedidos.length,
            totalVendas,
            pedidos: pedidos.map(pedido => ({
              id: pedido.id,
              total: pedido.total,
              status: pedido.status,
              criadoEm: pedido.criadoEm,
              itens: pedido.itempedido.map(item => ({
                produto: item.produto.nome,
                quantidade: item.quantidade,
                precoUnitario: item.precoUnitario,
                subtotal: item.precoTotal
              }))
            }))
          }
        });

      } catch (error: any) {
        console.error('Erro nas vendas por período:', error);
        return reply.status(400).send({
          success: false,
          message: 'Erro ao buscar vendas por período'
        });
      }
    }
  );
}

export async function vendasHoje(app: FastifyInstance) {
  app.get<VendasHojeRoute>(
    '/hoje',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Vendas'],
        summary: 'Vendas de hoje',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  periodo: {
                    type: 'object',
                    properties: {
                      inicio: { type: 'string' },
                      fim: { type: 'string' }
                    }
                  },
                  resumo: {
                    type: 'object',
                    properties: {
                      totalVendas: { type: 'number' },
                      totalPedidos: { type: 'number' },
                      totalItens: { type: 'number' },
                      ticketMedio: { type: 'number' }
                    }
                  },
                  pedidosPorStatus: { type: 'object' },
                  produtosMaisVendidos: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        nome: { type: 'string' },
                        quantidade: { type: 'number' },
                        total: { type: 'number' }
                      }
                    }
                  },
                  pedidos: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        numeroPedido: { type: 'string' },
                        usuario: {
                          type: 'object',
                          properties: {
                            nome: { type: 'string' },
                            email: { type: 'string' }
                          }
                        },
                        status: { type: 'string' },
                        total: { type: 'number' },
                        criadoEm: { type: 'string' },
                        itens: { type: 'number' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      // 2. Buscar pedidos de hoje
      const pedidos = await prisma.pedido.findMany({
        where: {
          criadoEm: {
            gte: hoje,
            lt: amanha
          }
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
                  nome: true,
                  preco: true
                }
              }
            }
          }
        },
        orderBy: {
          criadoEm: 'desc'
        }
      });

      // 3. Calcular resumo
      const totalVendas = pedidos
        .filter(p => p.status === 'ENVIADO' || p.status === 'ENTREGUE')
        .reduce((sum, pedido) => sum + pedido.total, 0);

      const totalPedidos = pedidos.length;

      const totalItens = pedidos.reduce((sum, pedido) => {
        return sum + pedido.itempedido.reduce((itemSum, item) => itemSum + item.quantidade, 0);
      }, 0);

      const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0;

      // 4. Agrupar pedidos por status
      const pedidosPorStatus = pedidos.reduce((acc, pedido) => {
        const status = pedido.status;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // 5. Produtos mais vendidos hoje
      const todosItensHoje = pedidos.flatMap(pedido => pedido.itempedido);

      const produtosVendidosMap = todosItensHoje.reduce((acc, item) => {
        const produtoId = item.produtoId;
        if (!acc[produtoId]) {
          acc[produtoId] = {
            id: produtoId,
            nome: item.produto?.nome || 'Produto não encontrado',
            quantidade: 0,
            total: 0
          };
        }
        acc[produtoId].quantidade += item.quantidade;
        acc[produtoId].total += item.precoTotal;
        return acc;
      }, {} as Record<string, any>);

      const produtosMaisVendidos = Object.values(produtosVendidosMap)
        .sort((a: any, b: any) => b.quantidade - a.quantidade)
        .slice(0, 10);

      // 6. Formatar pedidos para resposta
      const pedidosFormatados = pedidos.map(pedido => ({
        id: pedido.id,
        numeroPedido: pedido.numeroPedido,
        usuario: {
          nome: pedido.usuario?.nome || 'Cliente não identificado',
          email: pedido.usuario?.email || ''
        },
        status: pedido.status,
        total: pedido.total,
        criadoEm: pedido.criadoEm.toISOString(),
        itens: pedido.itempedido.length
      }));

      return reply.code(200).send({
        success: true,
        data: {
          periodo: {
            inicio: hoje.toISOString(),
            fim: amanha.toISOString()
          },
          resumo: {
            totalVendas,
            totalPedidos,
            totalItens,
            ticketMedio: parseFloat(ticketMedio.toFixed(2))
          },
          pedidosPorStatus,
          produtosMaisVendidos,
          pedidos: pedidosFormatados
        }
      });
    }
  );
}