// src/modules/categorias/categorias.routes.ts
import { FastifyInstance } from 'fastify';
import { CategoriasController } from './categorias.controller';
import { authenticate, isAdmin } from '../../middleware/auth.middleware';

const categoriasController = new CategoriasController();

// Interfaces para as rotas
interface ListarCategoriasRoute {
  Reply: {
    200: {
      success: boolean;
      data: any[];
      total: number;
    };
  };
}

interface BuscarCategoriaPorIdRoute {
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

interface BuscarCategoriaPorSlugRoute {
  Params: {
    slug: string;
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

interface ListarCategoriasHierarquiaRoute {
  Reply: {
    200: {
      success: boolean;
      data: any[];
    };
  };
}

interface CriarCategoriaRoute {
  Body: {
    nome: string;
    descricao?: string;
    slug: string;
    paiId?: string;
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

interface AtualizarCategoriaRoute {
  Params: {
    id: string;
  };
  Body: {
    nome?: string;
    descricao?: string;
    slug?: string;
    paiId?: string;
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

interface DeletarCategoriaRoute {
  Params: {
    id: string;
  };
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

export default async function categoriasRoutes(app: FastifyInstance) {
  // Rotas públicas
  
  // Listar categorias
  app.get<ListarCategoriasRoute>(
    '/',
    {
      schema: {
        tags: ['Categorias'],
        summary: 'Listar todas as categorias',
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
    categoriasController.listarCategorias.bind(categoriasController)
  );
  
  // Listar hierarquia de categorias
  app.get<ListarCategoriasHierarquiaRoute>(
    '/hierarquia',
    {
      schema: {
        tags: ['Categorias'],
        summary: 'Listar categorias em formato hierárquico',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array' }
            }
          }
        }
      }
    },
    categoriasController.listarCategoriasHierarquia.bind(categoriasController)
  );
  
  // Buscar categoria por ID
  app.get<BuscarCategoriaPorIdRoute>(
    '/:id',
    {
      schema: {
        tags: ['Categorias'],
        summary: 'Buscar categoria por ID',
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
    categoriasController.buscarCategoriaPorId.bind(categoriasController)
  );
  
  // Buscar categoria por slug
  app.get<BuscarCategoriaPorSlugRoute>(
    '/slug/:slug',
    {
      schema: {
        tags: ['Categorias'],
        summary: 'Buscar categoria por slug',
        params: {
          type: 'object',
          properties: {
            slug: { type: 'string' }
          },
          required: ['slug']
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
    categoriasController.buscarCategoriaPorSlug.bind(categoriasController)
  );

  // Rotas protegidas (apenas admin)
  
  // Criar categoria
  app.post<CriarCategoriaRoute>(
    '/',
    {
      preHandler: [authenticate, isAdmin],
      schema: {
        tags: ['Categorias'],
        summary: 'Criar nova categoria (apenas admin)',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['nome', 'slug'],
          properties: {
            nome: { type: 'string' },
            descricao: { type: 'string' },
            slug: { type: 'string' },
            paiId: { type: 'string' }
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
    categoriasController.criarCategoria.bind(categoriasController)
  );

  // Atualizar categoria
  app.put<AtualizarCategoriaRoute>(
    '/:id',
    {
      preHandler: [authenticate, isAdmin],
      schema: {
        tags: ['Categorias'],
        summary: 'Atualizar categoria (apenas admin)',
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
            slug: { type: 'string' },
            paiId: { type: 'string' }
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
    categoriasController.atualizarCategoria.bind(categoriasController)
  );

  // Deletar categoria
  app.delete<DeletarCategoriaRoute>(
    '/:id',
    {
      preHandler: [authenticate, isAdmin],
      schema: {
        tags: ['Categorias'],
        summary: 'Deletar categoria (apenas admin)',
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
    categoriasController.deletarCategoria.bind(categoriasController)
  );
}