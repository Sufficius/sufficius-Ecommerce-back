// src/modules/produtos/produtos.routes.ts
import { FastifyInstance } from 'fastify';
import { ProdutosController } from './produtos.controller';
import { authenticate, isAdmin } from '../../middleware/auth.middleware';
import path from 'path';
import fs from 'fs';
const produtosController = new ProdutosController();

// Interfaces para as rotas

interface ListarProdutoRoute {
  Reply: {
    200: {
      success: boolean;
      data: any[];
      total: number;
    };
  };
}
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
          quantidade: number;
          criadoEm: string;
          id_categoria?: string;
          imagem?: string;
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

// REMOVA a interface CriarProdutoRoute pois vamos usar multipart

interface AtualizarProdutoRoute {
  Params: { id: string };
  nome?: string;
  descricao?: string;
  preco?: number;
  estoque?: number;
  id_categoria?: string | null;
  ativo?: boolean;
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

// Adicione esta interface
interface ProdutosMaisVendidosRoute {
  Querystring: {
    limit?: string;
    periodo?: string;
  };
  Reply: {
    200: {
      success: boolean;
      data: Array<{
        id: string;
        nome: string;
        imagem?: string;
        quantidade: number;
        total: number;
        precoUnitario: number;
        categoria?: string;
      }>;
    };
  };
}


export default async function produtosRoutes(app: FastifyInstance) {
  // Rotas públicas
  // Dentro da função produtosRoutes, adicione esta rota (pode ser pública):
  app.get<ProdutosMaisVendidosRoute>(
    '/mais-vendidos',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'string', default: '5' },
            periodo: {
              type: 'string',
              enum: ['hoje', '7dias', '30dias', 'todos'],
              default: 'todos'
            }
          }
        },
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
                    imagem: { type: 'string', nullable: true },
                    quantidade: { type: 'number' },
                    total: { type: 'number' },
                    precoUnitario: { type: 'number' },
                    categoria: { type: 'string', nullable: true }
                  }
                }
              }
            }
          }
        }
      }
    },
    produtosController.getProdutosMaisVendidos.bind(produtosController)
  );

  app.get<ListarProdutoRoute>(
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
    produtosController.getProdutos.bind(produtosController)
  )
  // Listar produtos (com filtros)
  app.get<ListarProdutosRoute>(
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
                        quantidade: { type: 'number' },
                        criadoEm: { type: 'string' },
                        categoria: { type: 'string' },
                        id_categoria: { type: 'string' },
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

  // Adicione em produtos.routes.ts (antes do export default)
  app.get('/test-uploads', async (request, reply) => {
    const uploadDir = process.env.RENDER
      ? '/opt/render/project/src/uploads'
      : path.join(process.cwd(), 'uploads');

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

  // Buscar produto por ID
  app.get<BuscarProdutoPorIdRoute>(
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
    produtosController.buscarProdutoPorId.bind(produtosController)
  );

  // Estatísticas de produtos
  app.get<EstatisticasProdutosRoute>(
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
    produtosController.getEstatisticasProdutos.bind(produtosController)
  );

  // Rotas protegidas (apenas admin)

  // Criar produto - ROTA MODIFICADA PARA MULTIPART (sem schema.body)
  app.post(
    '/',
    {
      schema: {
        tags: ['Produtos'],
        summary: 'Criar novo produto (apenas admin)',
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'], // Importante!
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