// src/modules/produtos/produtos.routes.ts
import { FastifyInstance } from 'fastify';
import { ProdutosController } from './produtos.controller';
import { authenticate, isAdmin } from '../../middleware/auth.middleware';

const produtosController = new ProdutosController();

// Interfaces para as rotas
interface ListarProdutosRoute {
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
      data: {
        produtos: Array<{
          id: string;
          nome: string;
          descricao: string;
          preco: number;
          precoDesconto?: number;
          percentualDesconto?: number;
          descontoAte?: string;
          estoque: number;
          sku: string;
          ativo: boolean;
          emDestaque: boolean;
          criadoEm: string;
          categoria: string;
          categoriaId?: string;
          imagem?: string;
          imagemAlt?: string;
          status: string;
        }>;
        paginacao: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        };
        estatisticas: {
          totalProdutos: number;
          totalAtivos: number;
          totalEmPromocao: number;
          baixoEstoque: number;
          totalCategorias: number;
        };
        filtros: {
          busca: string;
          categoria: string;
          status: string;
          ordenar: string;
        };
      };
    };
  };
}

interface BuscarProdutoPorIdRoute {
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

interface CriarProdutoRoute {
  Body: {
    nome: string;
    descricao: string;
    preco: number;
    precoDesconto?: number;
    percentualDesconto?: number;
    descontoAte?: string;
    estoque: number;
    sku: string;
    categoriaId?: string;
    ativo?: boolean;
    emDestaque?: boolean;
    imagens?: Array<{
      url: string;
      alt?: string;
      principal?: boolean;
    }>;
    variacoes?: Array<{
      nome: string;
      preco: number;
      estoque: number;
      sku: string;
    }>;
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

interface AtualizarProdutoRoute {
  Params: { id: string };
  Body: {
    nome?: string;
    descricao?: string;
    preco?: number;
    precoDesconto?: number | null;
    percentualDesconto?: number | null;
    descontoAte?: string | null;
    estoque?: number;
    sku?: string;
    categoriaId?: string | null;
    ativo?: boolean;
    emDestaque?: boolean;
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

interface DeletarProdutoRoute {
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

interface EstatisticasProdutosRoute {
  Reply: {
    200: {
      success: boolean;
      data: {
        totalProdutos: number;
        totalAtivos: number;
        totalInativos: number;
        totalEmPromocao: number;
        baixoEstoque: number;
        semEstoque: number;
        totalVendidos: number;
        produtosMaisVendidos: Array<any>;
        totalCategorias: number;
      };
    };
  };
}

export default async function produtosRoutes(app: FastifyInstance) {
  // Rotas públicas
  
  // Listar produtos (com filtros)
  app.get<ListarProdutosRoute>(
    '/',
    {
      schema: {
        tags: ['Produtos'],
        summary: 'Listar produtos com filtros',
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
              data: {
                type: 'object',
                properties: {
                  produtos: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        nome: { type: 'string' },
                        descricao: { type: 'string' },
                        preco: { type: 'number' },
                        precoDesconto: { type: 'number' },
                        percentualDesconto: { type: 'number' },
                        descontoAte: { type: 'string' },
                        estoque: { type: 'number' },
                        sku: { type: 'string' },
                        ativo: { type: 'boolean' },
                        emDestaque: { type: 'boolean' },
                        criadoEm: { type: 'string' },
                        categoria: { type: 'string' },
                        categoriaId: { type: 'string' },
                        imagem: { type: 'string' },
                        imagemAlt: { type: 'string' },
                        status: { type: 'string' }
                      }
                    }
                  },
                  paginacao: {
                    type: 'object',
                    properties: {
                      total: { type: 'number' },
                      page: { type: 'number' },
                      limit: { type: 'number' },
                      totalPages: { type: 'number' }
                    }
                  },
                  estatisticas: {
                    type: 'object',
                    properties: {
                      totalProdutos: { type: 'number' },
                      totalAtivos: { type: 'number' },
                      totalEmPromocao: { type: 'number' },
                      baixoEstoque: { type: 'number' },
                      totalCategorias: { type: 'number' }
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
        }
      }
    },
    produtosController.listarProdutos.bind(produtosController)
  );

  // Buscar produto por ID
  app.get<BuscarProdutoPorIdRoute>(
    '/:id',
    {
      schema: {
        tags: ['Produtos'],
        summary: 'Buscar produto por ID',
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
    produtosController.buscarProdutoPorId.bind(produtosController)
  );

  // Estatísticas de produtos
  app.get<EstatisticasProdutosRoute>(
    '/estatisticas',
    {
      schema: {
        tags: ['Produtos'],
        summary: 'Obter estatísticas de produtos',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  totalProdutos: { type: 'number' },
                  totalAtivos: { type: 'number' },
                  totalInativos: { type: 'number' },
                  totalEmPromocao: { type: 'number' },
                  baixoEstoque: { type: 'number' },
                  semEstoque: { type: 'number' },
                  totalVendidos: { type: 'number' },
                  produtosMaisVendidos: { type: 'array' },
                  totalCategorias: { type: 'number' }
                }
              }
            }
          }
        }
      }
    },
    produtosController.getEstatisticasProdutos.bind(produtosController)
  );

  // Rotas protegidas (apenas admin)

  // Criar produto
  app.post<CriarProdutoRoute>(
    '/',
    {
      preHandler: [authenticate, isAdmin],
      schema: {
        tags: ['Produtos'],
        summary: 'Criar novo produto (apenas admin)',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['nome', 'descricao', 'preco', 'estoque', 'sku'],
          properties: {
            nome: { type: 'string' },
            descricao: { type: 'string' },
            preco: { type: 'number', minimum: 0 },
            precoDesconto: { type: 'number', minimum: 0 },
            percentualDesconto: { type: 'number', minimum: 0, maximum: 100 },
            descontoAte: { type: 'string', format: 'date-time' },
            estoque: { type: 'integer', minimum: 0 },
            sku: { type: 'string' },
            categoriaId: { type: 'string' },
            ativo: { type: 'boolean' },
            emDestaque: { type: 'boolean' },
            imagens: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  alt: { type: 'string' },
                  principal: { type: 'boolean' }
                }
              }
            },
            variacoes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  nome: { type: 'string' },
                  preco: { type: 'number' },
                  estoque: { type: 'integer' },
                  sku: { type: 'string' }
                }
              }
            }
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
    produtosController.criarProduto.bind(produtosController)
  );

  // Atualizar produto
  app.put<AtualizarProdutoRoute>(
    '/:id',
    {
      preHandler: [authenticate, isAdmin],
      schema: {
        tags: ['Produtos'],
        summary: 'Atualizar produto (apenas admin)',
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
            nome: { type: 'string' },
            descricao: { type: 'string' },
            preco: { type: 'number', minimum: 0 },
            precoDesconto: { type: 'number', minimum: 0 },
            percentualDesconto: { type: 'number', minimum: 0, maximum: 100 },
            descontoAte: { type: 'string', format: 'date-time' },
            estoque: { type: 'integer', minimum: 0 },
            sku: { type: 'string' },
            categoriaId: { type: 'string' },
            ativo: { type: 'boolean' },
            emDestaque: { type: 'boolean' }
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
    produtosController.atualizarProduto.bind(produtosController)
  );

  // Deletar produto
  app.delete<DeletarProdutoRoute>(
    '/:id',
    {
      preHandler: [authenticate, isAdmin],
      schema: {
        tags: ['Produtos'],
        summary: 'Deletar produto (apenas admin)',
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
    produtosController.deletarProduto.bind(produtosController)
  );
}