// src/modules/avaliacoes/avaliacoes.routes.ts
import { FastifyInstance } from 'fastify';
import { AvaliacoesController } from './avaliacoes.controller';
import { authenticate } from '../../middleware/auth.middleware';

const avaliacoesController = new AvaliacoesController();

// Interfaces para as rotas
interface ListarAvaliacoesRoute {
  Querystring: {
    produtoId?: string;
    usuarioId?: string;
    page?: string;
    limit?: string;
  };
  Reply: {
    200: {
      success: boolean;
      data: any[];
      meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        mediaAvaliacoes: number;
      };
    };
  };
}

interface EstatisticasProdutoRoute {
  Params: {
    produtoId: string;
  };
  Reply: {
    200: {
      success: boolean;
      data: {
        totalAvaliacoes: number;
        mediaNota: number;
        notaMinima: number;
        notaMaxima: number;
        contagemPorNota: Array<{ nota: number; quantidade: number }>;
      };
    };
  };
}

interface CriarAvaliacaoRoute {
  Body: {
    produtoId: string;
    nota: number;
    comentario?: string;
  };
  Reply: {
    201: {
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

interface AtualizarAvaliacaoRoute {
  Params: {
    id: string;
  };
  Body: {
    nota?: number;
    comentario?: string;
  };
  Reply: {
    200: {
      success: boolean;
      message: string;
      data: any;
    };
    403: {
      success: boolean;
      message: string;
    };
  };
}

interface DeletarAvaliacaoRoute {
  Params: {
    id: string;
  };
  Reply: {
    200: {
      success: boolean;
      message: string;
    };
  };
}

export default async function avaliacoesRoutes(app: FastifyInstance) {
  // Rotas públicas
  
  // Listar avaliações com filtros
  app.get<ListarAvaliacoesRoute>(
    '/',
    {
      schema: {
        tags: ['Avaliações'],
        summary: 'Listar avaliações',
        querystring: {
          type: 'object',
          properties: {
            produtoId: { type: 'string' },
            usuarioId: { type: 'string' },
            page: { type: 'string', default: '1' },
            limit: { type: 'string', default: '10' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array' },
              meta: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  totalPages: { type: 'number' },
                  mediaAvaliacoes: { type: 'number' }
                }
              }
            }
          }
        }
      }
    },
    avaliacoesController.listarAvaliacoes.bind(avaliacoesController)
  );
  
  // Estatísticas do produto
  app.get<EstatisticasProdutoRoute>(
    '/produto/:produtoId/estatisticas',
    {
      schema: {
        tags: ['Avaliações'],
        summary: 'Obter estatísticas de avaliações de um produto',
        params: {
          type: 'object',
          properties: {
            produtoId: { type: 'string' }
          },
          required: ['produtoId']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  totalAvaliacoes: { type: 'number' },
                  mediaNota: { type: 'number' },
                  notaMinima: { type: 'number' },
                  notaMaxima: { type: 'number' },
                  contagemPorNota: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        nota: { type: 'number' },
                        quantidade: { type: 'number' }
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
    avaliacoesController.getEstatisticasProduto.bind(avaliacoesController)
  );

  // Rotas protegidas
  
  // Criar avaliação
  app.post<CriarAvaliacaoRoute>(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Avaliações'],
        summary: 'Criar nova avaliação',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['produtoId', 'nota'],
          properties: {
            produtoId: { type: 'string' },
            nota: { type: 'number', minimum: 1, maximum: 5 },
            comentario: { type: 'string' }
          }
        },
        response: {
          201: {
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
    avaliacoesController.criarAvaliacao.bind(avaliacoesController)
  );

  // Atualizar avaliação
  app.put<AtualizarAvaliacaoRoute>(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Avaliações'],
        summary: 'Atualizar avaliação',
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
          properties: {
            nota: { type: 'number', minimum: 1, maximum: 5 },
            comentario: { type: 'string' }
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
    avaliacoesController.atualizarAvaliacao.bind(avaliacoesController)
  );

  // Deletar avaliação
  app.delete<DeletarAvaliacaoRoute>(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Avaliações'],
        summary: 'Deletar avaliação',
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
              message: { type: 'string' }
            }
          }
        }
      }
    },
    avaliacoesController.deletarAvaliacao.bind(avaliacoesController)
  );
}