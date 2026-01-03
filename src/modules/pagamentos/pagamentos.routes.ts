// src/modules/pagamentos/pagamentos.routes.ts
import { FastifyInstance } from 'fastify';
import { PagamentosController } from './pagamentos.controller';
import { authenticate } from '../../middleware/auth.middleware';

const pagamentosController = new PagamentosController();

// Interfaces para as rotas de pagamentos
interface CriarPagamentoRoute {
  Body: {
    pedidoId: string;
    metodoPagamento: string;
    parcelas?: number;
  };
  Reply: {
    200: {
      success: boolean;
      message: string;
      data: any;
      paymentUrl?: string;
      qrCode?: string;
      pixCopyPaste?: string;
    };
    400: {
      success: boolean;
      message: string;
    };
  };
}

interface WebhookPagamentoRoute {
  Body: any;
  Params: {
    gateway: string;
  };
  Headers: {
    [key: string]: string;
  };
  Reply: {
    200: {
      received: boolean;
    };
  };
}

interface VerificarPagamentoRoute {
  Params: {
    pagamentoId: string;
  };
  Reply: {
    200: {
      success: boolean;
      data: any;
      status: string;
    };
    404: {
      success: boolean;
      message: string;
    };
  };
}

interface ListarPagamentosRoute {
  Querystring: {
    page?: string;
    limit?: string;
    status?: string;
    metodo?: string;
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

interface EstornoPagamentoRoute {
  Params: {
    pagamentoId: string;
  };
  Body: {
    motivo?: string;
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

interface MetodosPagamentoRoute {
  Reply: {
    200: {
      success: boolean;
      data: Array<{
        id: string;
        nome: string;
        descricao: string;
        ativo: boolean;
        imagem?: string;
      }>;
    };
  };
}

export default async function pagamentosRoutes(app: FastifyInstance) {
  // Rotas públicas
  
  // Webhook para notificações dos gateways de pagamento
  app.post<WebhookPagamentoRoute>(
    '/webhook/:gateway',
    {
      schema: {
        tags: ['Pagamentos'],
        summary: 'Webhook para notificações de pagamento',
        params: {
          type: 'object',
          properties: {
            gateway: { type: 'string' }
          },
          required: ['gateway']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              received: { type: 'boolean' }
            }
          }
        }
      }
    },
    pagamentosController.webhookPagamento.bind(pagamentosController)
  );

  // Rotas protegidas
  
  // Criar pagamento para pedido
  app.post<CriarPagamentoRoute>(
    '/criar',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Pagamentos'],
        summary: 'Criar pagamento para pedido',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['pedidoId', 'metodoPagamento'],
          properties: {
            pedidoId: { type: 'string' },
            metodoPagamento: { type: 'string' },
            parcelas: { type: 'number', minimum: 1, maximum: 12 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: { type: 'object' },
              paymentUrl: { type: 'string' },
              qrCode: { type: 'string' },
              pixCopyPaste: { type: 'string' }
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
    pagamentosController.criarPagamento.bind(pagamentosController)
  );

  // Verificar status do pagamento
  app.get<VerificarPagamentoRoute>(
    '/:pagamentoId/verificar',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Pagamentos'],
        summary: 'Verificar status do pagamento',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            pagamentoId: { type: 'string' }
          },
          required: ['pagamentoId']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              status: { type: 'string' }
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
    pagamentosController.verificarPagamento.bind(pagamentosController)
  );

  // Listar métodos de pagamento disponíveis
  app.get<MetodosPagamentoRoute>(
    '/metodos',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Pagamentos'],
        summary: 'Listar métodos de pagamento disponíveis',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    nome: { type: 'string' },
                    descricao: { type: 'string' },
                    ativo: { type: 'boolean' },
                    imagem: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    pagamentosController.listarMetodosPagamento.bind(pagamentosController)
  );

  // Rotas para administradores
  
  // Listar todos os pagamentos
  app.get<ListarPagamentosRoute>(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Pagamentos'],
        summary: 'Listar todos os pagamentos',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'string', default: '1' },
            limit: { type: 'string', default: '20' },
            status: { type: 'string' },
            metodo: { type: 'string' }
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
    pagamentosController.listarPagamentos.bind(pagamentosController)
  );

  // Estornar pagamento
  app.post<EstornoPagamentoRoute>(
    '/:pagamentoId/estornar',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Pagamentos'],
        summary: 'Estornar pagamento',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            pagamentoId: { type: 'string' }
          },
          required: ['pagamentoId']
        },
        body: {
          type: 'object',
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
    pagamentosController.estornarPagamento.bind(pagamentosController)
  );
}