// src/modules/carrinho/carrinho.routes.ts
import { FastifyInstance } from 'fastify';
import { CarrinhoController } from './carrinho.controller';
import { authenticate } from '../../middleware/auth.middleware';

const carrinhoController = new CarrinhoController();

// Interfaces para as rotas do carrinho
interface ObterCarrinhoRoute {
  Reply: {
    200: {
      success: boolean;
      data: any;
      totalItens: number;
      valorTotal: number;
    };
  };
}

interface AdicionarItemRoute {
  Body: {
    produtoId: string;
    quantidade: number;
    variacaoId?: string;
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
  };
}

interface AtualizarItemRoute {
  Params: {
    itemId: string;
  };
  Body: {
    quantidade: number;
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

interface RemoverItemRoute {
  Params: {
    itemId: string;
  };
  Reply: {
    200: {
      success: boolean;
      message: string;
    };
    404: {
      success: boolean;
      message: string;
    };
  };
}

interface LimparCarrinhoRoute {
  Reply: {
    200: {
      success: boolean;
      message: string;
    };
  };
}

export default async function carrinhoRoutes(app: FastifyInstance) {
  // Todas as rotas do carrinho requerem autenticação
  
  // Obter carrinho do usuário
  app.get<ObterCarrinhoRoute>(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Carrinho'],
        summary: 'Obter carrinho do usuário',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              totalItens: { type: 'number' },
              valorTotal: { type: 'number' }
            }
          }
        }
      }
    },
    carrinhoController.obterCarrinho.bind(carrinhoController)
  );

  // Adicionar item ao carrinho
  app.post<AdicionarItemRoute>(
    '/adicionar',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Carrinho'],
        summary: 'Adicionar item ao carrinho',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['produtoId', 'quantidade'],
          properties: {
            produtoId: { type: 'string' },
            quantidade: { type: 'number', minimum: 1 },
            variacaoId: { type: 'string' }
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
          }
        }
      }
    },
    carrinhoController.adicionarItem.bind(carrinhoController)
  );

  // Atualizar quantidade do item
  app.put<AtualizarItemRoute>(
    '/item/:itemId',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Carrinho'],
        summary: 'Atualizar quantidade do item no carrinho',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            itemId: { type: 'string' }
          },
          required: ['itemId']
        },
        body: {
          type: 'object',
          required: ['quantidade'],
          properties: {
            quantidade: { type: 'number', minimum: 1 }
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
    carrinhoController.atualizarItem.bind(carrinhoController)
  );

  // Remover item do carrinho
  app.delete<RemoverItemRoute>(
    '/item/:itemId',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Carrinho'],
        summary: 'Remover item do carrinho',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            itemId: { type: 'string' }
          },
          required: ['itemId']
        },
        response: {
          200: {
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
    carrinhoController.removerItem.bind(carrinhoController)
  );

  // Limpar carrinho
  app.delete<LimparCarrinhoRoute>(
    '/limpar',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Carrinho'],
        summary: 'Limpar carrinho',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    carrinhoController.limparCarrinho.bind(carrinhoController)
  );
}