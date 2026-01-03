// src/modules/pedidos/pedidos.routes.ts
import { FastifyInstance } from 'fastify';
import { PedidosController } from './pedidos.controller';
import { authenticate, isAdmin } from '../../middleware/auth.middleware';

const pedidosController = new PedidosController();

// Interfaces para as rotas de pedidos
interface ListarPedidosRoute {
  Querystring: {
    page?: string;
    limit?: string;
    status?: string;
    dataInicio?: string;
    dataFim?: string;
  };
  Reply: {
    200: {
      success: boolean;
      data: any[];
      total: number;
      page: number;
      totalPages: number;
    };
  };
}

interface BuscarPedidoPorIdRoute {
  Params: {
    id: string;
  };
  Reply: {
    200: {
      success: boolean;
      data: any;
    };
    404: {
      success: boolean;
      message: string;
    };
  };
}

interface MeusPedidosRoute {
  Querystring: {
    page?: string;
    limit?: string;
    status?: string;
  };
  Reply: {
    200: {
      success: boolean;
      data: any[];
      total: number;
      page: number;
      totalPages: number;
    };
  };
}

interface CriarPedidoRoute {
  Body: {
    enderecoId: string;
    metodoPagamento: string;
    observacoes?: string;
    cupom?: string;
  };
  Reply: {
    201: {
      success: boolean;
      message: string;
      data: any;
      pagamentoUrl?: string;
    };
    400: {
      success: boolean;
      message: string;
    };
  };
}

interface AtualizarStatusRoute {
  Params: {
    id: string;
  };
  Body: {
    status: string;
    motivoCancelamento?: string;
  };
  Reply: {
    200: {
      success: boolean;
      message: string;
      data: any;
    };
    400: {
      success: boolean;
      message: string;
    };
    404: {
      success: boolean;
      message: string;
    };
  };
}

interface CancelarPedidoRoute {
  Params: {
    id: string;
  };
  Body: {
    motivo: string;
  };
  Reply: {
    200: {
      success: boolean;
      message: string;
      data: any;
    };
    400: {
      success: boolean;
      message: string;
    };
    404: {
      success: boolean;
      message: string;
    };
  };
}

interface EstatisticasPedidosRoute {
  Querystring: {
    dataInicio?: string;
    dataFim?: string;
  };
  Reply: {
    200: {
      success: boolean;
      data: {
        totalPedidos: number;
        totalVendas: number;
        pedidosPorStatus: Record<string, number>;
        vendasPorPeriodo: Array<{ data: string; total: number }>;
      };
    };
  };
}

export default async function pedidosRoutes(app: FastifyInstance) {
  // Rotas protegidas para usuários
  
  // Meus pedidos
  app.get<MeusPedidosRoute>(
    '/meus-pedidos',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Pedidos'],
        summary: 'Listar meus pedidos',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'string', default: '1' },
            limit: { type: 'string', default: '10' },
            status: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array' },
              total: { type: 'number' },
              page: { type: 'number' },
              totalPages: { type: 'number' }
            }
          }
        }
      }
    },
    pedidosController.meusPedidos.bind(pedidosController)
  );

  // Buscar pedido por ID
  app.get<BuscarPedidoPorIdRoute>(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Pedidos'],
        summary: 'Buscar pedido por ID',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' }
            }
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    pedidosController.buscarPedidoPorId.bind(pedidosController)
  );

  // Criar pedido a partir do carrinho
  app.post<CriarPedidoRoute>(
    '/criar',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Pedidos'],
        summary: 'Criar novo pedido a partir do carrinho',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['enderecoId', 'metodoPagamento'],
          properties: {
            enderecoId: { type: 'string' },
            metodoPagamento: { type: 'string' },
            observacoes: { type: 'string' },
            cupom: { type: 'string' }
          }
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: { type: 'object' },
              pagamentoUrl: { type: 'string' }
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
    pedidosController.criarPedido.bind(pedidosController)
  );

  // Cancelar pedido (usuário)
  app.post<CancelarPedidoRoute>(
    '/:id/cancelar',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Pedidos'],
        summary: 'Cancelar pedido',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        },
        body: {
          type: 'object',
          required: ['motivo'],
          properties: {
            motivo: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: { type: 'object' }
            }
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    pedidosController.cancelarPedido.bind(pedidosController)
  );

  // Rotas apenas para administradores
  
  // Listar todos os pedidos (admin)
  app.get<ListarPedidosRoute>(
    '/',
    {
      preHandler: [authenticate, isAdmin],
      schema: {
        tags: ['Pedidos'],
        summary: 'Listar todos os pedidos (apenas admin)',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'string', default: '1' },
            limit: { type: 'string', default: '20' },
            status: { type: 'string' },
            dataInicio: { type: 'string' },
            dataFim: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array' },
              total: { type: 'number' },
              page: { type: 'number' },
              totalPages: { type: 'number' }
            }
          }
        }
      }
    },
    pedidosController.listarPedidos.bind(pedidosController)
  );

  // Atualizar status do pedido (admin)
  app.put<AtualizarStatusRoute>(
    '/:id/status',
    {
      preHandler: [authenticate, isAdmin],
      schema: {
        tags: ['Pedidos'],
        summary: 'Atualizar status do pedido (apenas admin)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string' },
            motivoCancelamento: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: { type: 'object' }
            }
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    pedidosController.atualizarStatus.bind(pedidosController)
  );

  // Estatísticas de pedidos (admin)
  app.get<EstatisticasPedidosRoute>(
    '/estatisticas',
    {
      preHandler: [authenticate, isAdmin],
      schema: {
        tags: ['Pedidos'],
        summary: 'Obter estatísticas de pedidos (apenas admin)',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            dataInicio: { type: 'string' },
            dataFim: { type: 'string' }
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
                  totalPedidos: { type: 'number' },
                  totalVendas: { type: 'number' },
                  pedidosPorStatus: { type: 'object' },
                  vendasPorPeriodo: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        data: { type: 'string' },
                        total: { type: 'number' }
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
    pedidosController.getEstatisticas.bind(pedidosController)
  );
}