// src/modules/vendas/vendas.routes.ts
import { FastifyInstance } from 'fastify';
import { VendasController } from './vendas.controller';
import { authenticate, isAdmin } from '../../middleware/auth.middleware';

const vendasController = new VendasController();

// Interfaces para as rotas
interface VendasHojeRoute {
  Reply: {
    200: {
      success: boolean;
      data: {
        periodo: {
          inicio: string;
          fim: string;
        };
        resumo: {
          totalVendas: number;
          totalPedidos: number;
          totalItens: number;
          ticketMedio: number;
        };
        pedidosPorStatus: Record<string, number>;
        produtosMaisVendidos: Array<{
          id: string;
          nome: string;
          quantidade: number;
          total: number;
        }>;
        pedidos: Array<{
          id: string;
          numeroPedido: string;
          usuario: {
            nome: string;
            email: string;
          };
          status: string;
          total: number;
          criadoEm: string;
          itens: number;
        }>;
      };
    };
  };
}

interface VendasPorPeriodoRoute {
  Querystring: {
    inicio?: string;
    fim?: string;
    status?: string;
  };
  Reply: {
    200: {
      success: boolean;
      data: {
        periodo: {
          inicio: string;
          fim: string;
        };
        totalVendas: number;
        totalPedidos: number;
        vendasPorPeriodo: Array<{
          data: string;
          total: number;
        }>;
        pedidos: Array<any>;
      };
    };
  };
}

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
  };
}

export default async function vendasRoutes(app: FastifyInstance) {
  // Rota pública para dashboard básico
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
    vendasController.getDashboardPublico.bind(vendasController)
  );

  // Rotas protegidas (requer autenticação)
  
  // Vendas de hoje
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
    vendasController.getVendasHoje.bind(vendasController)
  );

  // Vendas por período
  app.get<VendasPorPeriodoRoute>(
    '/periodo',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Vendas'],
        summary: 'Vendas por período',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            inicio: { type: 'string', format: 'date' },
            fim: { type: 'string', format: 'date' },
            status: { type: 'string' }
          }
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
                  totalVendas: { type: 'number' },
                  totalPedidos: { type: 'number' },
                  vendasPorPeriodo: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        data: { type: 'string' },
                        total: { type: 'number' }
                      }
                    }
                  },
                  pedidos: { type: 'array' }
                }
              }
            }
          }
        }
      }
    },
    vendasController.getVendasPorPeriodo.bind(vendasController)
  );

  // Estatísticas avançadas (apenas admin)
  app.get(
    '/estatisticas-avancadas',
    {
      preHandler: [authenticate, isAdmin],
      schema: {
        tags: ['Vendas'],
        summary: 'Estatísticas avançadas de vendas (apenas admin)',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' }
            }
          },
          403: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    vendasController.getEstatisticasAvancadas.bind(vendasController)
  );
}