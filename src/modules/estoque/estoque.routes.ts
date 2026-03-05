// src/modules/estoque/estoque.routes.ts
import { FastifyInstance } from 'fastify';
import { EstoqueController } from './estoque.controller';
import { authenticate, isAdmin } from '../../middleware/auth.middleware';
import path from 'path';
import fs from 'fs';

const estoqueController = new EstoqueController();

// Interfaces para as rotas
interface ListarEstoqueRoute {
  Reply: {
    200: {
      success: boolean;
      data: any[];
      total: number;
    };
  };
}

interface ListarEstoqueQuery {
  Querystring: {
    page?: string;
    limit?: string;
    busca?: string;
    categoria?: string;
    status?: string;
    ordenar?: string;
  };
  Reply: {
    200: {
      success: boolean;
      data: any[];
      paginacao: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
      filtros: {
        busca: string;
        categoria: string;
        status: string;
        ordenar: string;
      };
    };
  };
}

interface BuscarEstoquePorIdRoute {
  Params: { id: string };
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

interface AtualizarEstoqueRoute {
  Params: { id: string };
  Body: {
    nome?: string;
    descricao?: string;
    preco?: number;
    quantidade?: number;
    id_categoria?: string | null;
    status?: string;
    deletarImagem?: string;
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

interface DeletarEstoqueRoute {
  Params: { id: string };
  Reply: {
    200: {
      success: boolean;
      message: string;
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

interface EstatisticasEstoqueRoute {
  Reply: {
    200: {
      success: boolean;
      data: {
        totalItens: number;
        totalAtivos: number;
        totalInativos: number;
        baixoEstoque: number;
        semEstoque: number;
        valorTotalEstoque: number;
        itensBaixoEstoque: Array<any>;
        resumo: {
          itensPorStatus: {
            ativos: number;
            inativos: number;
            baixoEstoque: number;
            semEstoque: number;
          };
          porcentagemAtivos: number;
          valorMedioPorItem: number;
        };
      };
    };
  };
}

interface DeletarMultiplosRoute {
  Body: { ids: string[] };
  Reply: {
    200: {
      success: boolean;
      message: string;
      data: {
        deletados: number;
        imagensCloudinaryDeletadas: number;
        itensNaoEncontrados: string[];
      };
    };
    400: {
      success: boolean;
      message: string;
    };
  };
}

export default async function estoqueRoutes(app: FastifyInstance) {
  
  // Rota de teste para uploads
  app.get('/test-uploads', async (request, reply) => {
    const uploadDir = process.env.RENDER
      ? '/opt/render/project/src/uploads/estoque'
      : path.join(process.cwd(), 'uploads', 'estoque');

    const exists = fs.existsSync(uploadDir);
    const files = exists ? fs.readdirSync(uploadDir) : [];

    return {
      success: true,
      uploadDir,
      exists,
      fileCount: files.length,
      files: files.slice(0, 10)
    };
  });

  // Rotas públicas

  // Listar todos os itens (versão simples)
  app.get<ListarEstoqueRoute>(
    '/get',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array' },
              total: { type: 'number' }
            }
          }
        }
      }
    },
    estoqueController.getEstoque.bind(estoqueController)
  );

  // Listar itens com filtros
  app.get<ListarEstoqueQuery>(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'string', default: '1' },
            limit: { type: 'string', default: '10' },
            busca: { type: 'string' },
            categoria: { type: 'string' },
            status: { type: 'string' },
            ordenar: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array' },
              paginacao: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  total: { type: 'number' },
                  totalPages: { type: 'number' }
                }
              },
              filtros: {
                type: 'object',
                properties: {
                  busca: { type: 'string' },
                  categoria: { type: 'string' },
                  status: { type: 'string' },
                  ordenar: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    estoqueController.listarEstoque.bind(estoqueController)
  );

  // Buscar item por ID
  app.get<BuscarEstoquePorIdRoute>(
    '/:id',
    {
      schema: {
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
    estoqueController.buscarEstoquePorId.bind(estoqueController)
  );

  // Estatísticas do estoque
  app.get<EstatisticasEstoqueRoute>(
    '/estatisticas',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
              }
            }
          }
        }
      }
    },
    estoqueController.getEstatisticasEstoque.bind(estoqueController)
  );

  // Rotas protegidas (apenas admin)

  // Criar item de estoque
  app.post(
    '/',
    {
      preHandler: [authenticate, isAdmin],
      schema: {
        tags: ['Estoque'],
        summary: 'Criar novo item de estoque (apenas admin)',
        security: [{ bearerAuth: [] }],
        consumes: ['application/json'],
        body: {
          type: 'object',
          required: ['nome', 'preco', 'quantidade', 'id_categoria'],
          properties: {
            nome: { type: 'string' },
            descricao: { type: 'string' },
            preco: { type: 'number' },
            quantidade: { type: 'number' },
            id_categoria: { type: 'string' },
            status: { type: 'string', enum: ['ATIVO', 'INATIVO'] }
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
    estoqueController.criarEstoque.bind(estoqueController)
  );

  // Atualizar item de estoque
  app.put<AtualizarEstoqueRoute>(
    '/:id',
    {
      preHandler: [authenticate, isAdmin],
      schema: {
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
            nome: { type: 'string' },
            descricao: { type: 'string' },
            preco: { type: 'number' },
            quantidade: { type: 'number' },
            id_categoria: { type: 'string' },
            status: { type: 'string', enum: ['ATIVO', 'INATIVO'] },
            deletarImagem: { type: 'string' }
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
    estoqueController.atualizarEstoque.bind(estoqueController)
  );

  // Deletar item de estoque
  app.delete<DeletarEstoqueRoute>(
    '/:id',
    {
      preHandler: [authenticate, isAdmin],
      schema: {
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
    estoqueController.deletarEstoque.bind(estoqueController)
  );

  // Deletar múltiplos itens
  app.delete<DeletarMultiplosRoute>(
    '/',
    {
      preHandler: [authenticate, isAdmin],
      schema: {
        body: {
          type: 'object',
          required: ['ids'],
          properties: {
            ids: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  deletados: { type: 'number' },
                  imagensCloudinaryDeletadas: { type: 'number' },
                  itensNaoEncontrados: {
                    type: 'array',
                    items: { type: 'string' }
                  }
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
    estoqueController.deletarMultiplosItens.bind(estoqueController)
  );
}