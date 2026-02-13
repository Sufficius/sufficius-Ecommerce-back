// src/modules/carrinho/carrinho.routes.ts
import { FastifyInstance } from 'fastify';
import { CarrinhoController } from './carrinho.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { prisma } from '../../lib/prisma';
import { randomUUID } from 'crypto';
import { MultipartBody } from '@/types/multipart';
import { getFieldsAndFiles } from '../helpers/multipart';
import z, { ZodType } from 'zod';

const carrinhoController = new CarrinhoController();

// Interfaces para as rotas do carrinho
interface ObterCarrinhoRoute {
  Reply: {
    200: {
      success: boolean;
      data: any;
    };
    500: {
      success: boolean;
      message: string;
    };
  };
}

interface AdicionarItemRoute {
  Body: {
    userId: string;
    produtoId: string;
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
    422: {
      success: boolean;
      message: string;
    };
    500: {
      success: boolean;
      message: string;
    };
  };
}

interface AtualizarItemRoute {
  Params: {
    id: string;
    produtoId: string; // Mudado de itemId para produtoId
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
    422: {
      success: boolean;
      message: string;
    };
    500: {
      success: boolean;
      message: string;
    };
  };
}

interface RemoverItemRoute {
  Params: {
    produtoId: string; // Mudado de itemId para produtoId
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
    500: {
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
      data: any;
    };
    500: {
      success: boolean;
      message: string;
    };
  };
}

interface QuantidadeRoute {
  Reply: {
    200: {
      success: boolean;
      quantidade: number;
    };
    500: {
      success: boolean;
      message: string;
    };
  };
}

export default async function carrinhoRoutes(app: FastifyInstance) {
  // Obter carrinho do usuário

  app.get('/count-items-on-card/:userId',
    {
      preHandler: [authenticate],
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  usuarioId: { type: 'string' },
                }
              }
            }
          },
          500: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    carrinhoController.countItemsOnCart.bind(carrinhoController)
  );

  app.get<ObterCarrinhoRoute>(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  usuarioId: { type: 'string' },
                  criadoEm: { type: 'string' },
                  atualizadoEm: { type: 'string' },
                  itens: { type: 'array' },
                  totalItens: { type: 'number' },
                  subtotal: { type: 'number' },
                  desconto: { type: 'number' },
                  total: { type: 'number' }
                }
              }
            }
          },
          500: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    carrinhoController.obterCarrinho.bind(carrinhoController)
  );

  const CheckoutFieldsSchema = z.object({
    userId: z.string().nonempty("O campo 'userId' é obrigatório."),
    location: z.string().nonempty("O campo 'location' é obrigatório."),
    phone: z.string().nonempty("O campo 'phone_number' é obrigatório."),
  });

  const FileSchema = z.object({
    comprovativo: z.object({
      type: z.literal("file"),
      fieldname: z.literal("comprovativo"),
      filename: z.string().nonempty(),
      encoding: z.string().nonempty(),
      mimetype: z.string().nonempty(),
      file: z.any(),
      _buf: z.any(),
    }),

  });


  const normalizeFileName = (fileName: string): string => {
    return fileName
      .normalize("NFD") // Normaliza caracteres acentuados
      .replace(/[\u0300-\u036f]/g, "") // Remove marcas de acentuação
      .replace(/[^a-zA-Z0-9._-]/g, "_"); // Substitui caracteres especiais por "_"
  };


  app.post('/checkout', async (request, reply) => {
    const body = request.body as MultipartBody || null;
    const { fields, files } = await getFieldsAndFiles(body);
    const checkoutFields = CheckoutFieldsSchema.parse(fields ?? "");
    const userId = checkoutFields.userId;
    if (!files.comprovativo) {
      return reply.status(400).send({ message: "É necessário passar o comprovativo!" });
    }

    const fileData = FileSchema.parse({ comprovativo: files.comprovativo });
    const originalFileName = fileData.comprovativo.filename;
    const normalizedFileName = normalizeFileName(originalFileName);
    const fileName = `${Date.now()}_${normalizedFileName}`;
    const mimetypeData = fileData.comprovativo.mimetype;
    const fileBuffer = fileData.comprovativo._buf;

    if (!fileBuffer || !(fileBuffer instanceof Buffer)) {
      return reply.status(400).send({ error: "Arquivo inválido ou não é um buffer" });
    }

    const cart = await prisma.carrinho.findFirst({
      where: { usuarioId: userId },
      include: { ItemCarrinho: { include: { produto: true } } }
    });

    if (!cart || cart.ItemCarrinho.length === 0) {
      return reply.code(400).send({ message: "Carrinho vazio ou não encontrado" });
    }

    for (const item of cart.ItemCarrinho) {
      if (item.quantidade > item.produto.quantidade) {
        return reply.code(400).send({
          message: `Quantidade insuficiente para o produto ${item.produto.nome}`
        });
      }
    }

    try {
      // Executa as operações em uma transação
      const orders = await prisma.$transaction(async (tx) => {
        const createdOrders = [];

        // Agrupa os itens do carrinho por business_id do produto
        const ordersMap = new Map<string, Array<typeof cart.ItemCarrinho[0]>>();
        for (const item of cart.ItemCarrinho) {
          const businessId = item.produto.id;
          if (!ordersMap.has(businessId)) {
            ordersMap.set(businessId, []);
          }
          ordersMap.get(businessId)?.push(item);
        }
        for (const [businessId, items] of ordersMap.entries()) {
          const orderItemsData = items.map(item => ({
            product_id: item.produtoId,
            quantity: item.quantidade,
            price_at_time: item.produto.preco,
            product_name: item.produto.nome,
          }));

          const total = items.reduce((acc, item) => acc + (item.quantidade * item.produto.preco), 0);
          const commission = total * 0.05;

          const order = await tx.pagamento.create({
            data: {
              usuarioId: userId,
              pedidoId: businessId,
              valor: total,
              metodo: "DINHEIRO_ENTREGA"
            },
            include: { pedido: true }
          });
          createdOrders.push(order);
        }

        await tx.carrinho.delete({
          where: { id: cart.id }
        });

        return createdOrders;
      });

      reply.send({
        message: "Compra finalizada com sucesso",
        orders
      });
    } catch (error: any) {
      reply.code(500).send({ message: "Erro ao finalizar a compra", error: error.message });
    }
  });

  // Adicionar item ao carrinho
  app.post<AdicionarItemRoute>(
    '/item',
    {
      preHandler: [authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['userId', 'produtoId', 'quantidade'],
          properties: {
            userId: { type: 'string' },
            produtoId: { type: 'string' },
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
          },
          422: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          },
          500: {
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

  // Atualizar quantidade do item usando produtoId
  app.put<AtualizarItemRoute>(
    '/item/:id/:produtoId', // Mudado de :itemId para :produtoId
    {
      preHandler: [authenticate],
      schema: {
        params: {
          type: 'object',
          properties: {
            produtoId: { type: 'string' } // Mudado de itemId para produtoId
          },
          required: ['id','produtoId']
        },
        body: {
          type: 'object',
          required: ['quantidade'],
          properties: {
            quantidade: { type: 'number', minimum: 0 } // Permite 0 para remover
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
          },
          422: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          },
          500: {
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

  // Remover item do carrinho usando produtoId
  app.delete<RemoverItemRoute>(
    '/item/:produtoId', // Mudado de :itemId para :produtoId
    {
      preHandler: [authenticate],
      schema: {
        params: {
          type: 'object',
          properties: {
            produtoId: { type: 'string' } // Mudado de itemId para produtoId
          },
          required: ['produtoId']
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
          },
          500: {
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


  app.delete('/deleteProduct/:id/:produtoId', {
    preHandler: [authenticate],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  },
    carrinhoController.deleteProductInCart.bind(carrinhoController)
  )


  app.delete<LimparCarrinhoRoute>('/deleteAllProducts/:id', {
    preHandler: [authenticate],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    },
  },
    carrinhoController.deleteAllProductsInCart.bind(carrinhoController)
  )
  // Limpar carrinho
  app.delete<LimparCarrinhoRoute>(
    '/limpar',
    {
      preHandler: [authenticate],
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: { type: 'object' }
            }
          },
          500: {
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

  // Obter quantidade total de itens
  app.get<QuantidadeRoute>(
    '/quantidade',
    {
      preHandler: [authenticate],
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              quantidade: { type: 'number' }
            }
          },
          500: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    carrinhoController.obterQuantidade.bind(carrinhoController)
  );

  // Verificar disponibilidade (opcional)
  app.get<{
    Reply: {
      200: {
        success: boolean;
        data: {
          disponiveis: boolean;
          itensComProblema?: Array<{
            produtoId: string;
            produtoNome: string;
            quantidadeSolicitada: number;
            quantidadeDisponivel: number;
          }>;
        };
      };
      500: {
        success: boolean;
        message: string;
      };
    };
  }>(
    '/verificar-disponibilidade',
    {
      preHandler: [authenticate],
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  disponiveis: { type: 'boolean' },
                  itensComProblema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        produtoId: { type: 'string' },
                        produtoNome: { type: 'string' },
                        quantidadeSolicitada: { type: 'number' },
                        quantidadeDisponivel: { type: 'number' }
                      }
                    }
                  }
                }
              }
            }
          },
          500: {
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
        // Implementação simplificada - em produção, verifique cada item
        reply.code(200).send({
          success: true,
          data: {
            disponiveis: true
          }
        });
      } catch (error) {
        console.error('Erro ao verificar disponibilidade:', error);
        reply.status(500).send({
          success: false,
          message: 'Erro ao verificar disponibilidade'
        });
      }
    }
  );

  // Sincronizar carrinho (opcional)
  app.post<{
    Body: {
      itens: Array<{
        produtoId: string;
        quantidade: number;
      }>;
    };
    Reply: {
      200: {
        success: boolean;
        data: any;
      };
      500: {
        success: boolean;
        message: string;
      };
    };
  }>(
    '/sincronizar',
    {
      preHandler: [authenticate],
      schema: {
        body: {
          type: 'object',
          properties: {
            itens: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  produtoId: { type: 'string' },
                  quantidade: { type: 'number', minimum: 1 }
                },
                required: ['produtoId', 'quantidade']
              }
            }
          },
          required: ['itens']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' }
            }
          },
          500: {
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
        const { itens } = request.body;
        const usuario = request.user as any;

        // Buscar ou criar carrinho
        let carrinho = await prisma.carrinho.findFirst({
          where: { usuarioId: usuario.id }
        });

        if (!carrinho) {
          carrinho = await prisma.carrinho.create({
            data: {
              id: randomUUID(),
              usuarioId: usuario.id
            }
          });
        }

        // Limpar carrinho atual
        await prisma.itemCarrinho.deleteMany({
          where: { carrinhoId: carrinho.id }
        });

        // Adicionar novos itens
        for (const item of itens) {
          const produto = await prisma.produto.findUnique({
            where: { id: item.produtoId }
          });

          if (produto && produto.quantidade >= item.quantidade) {
            await prisma.itemCarrinho.create({
              data: {
                id: `item_${Date.now()}_${Math.random()}`,
                carrinhoId: carrinho.id,
                produtoId: item.produtoId,
                quantidade: item.quantidade,
              }
            });
          }
        }

        // Buscar carrinho atualizado
        const carrinhoAtualizado = await prisma.carrinho.findFirst({
          where: { id: carrinho.id },
          include: {
            ItemCarrinho: {
              include: {
                produto: {
                  select: {
                    id: true,
                    nome: true,
                    preco: true,
                    quantidade: true,
                    ImagemProduto: {
                      where: { principal: true },
                      take: 1
                    }
                  }
                }
              }
            }
          }
        });

        // Calcular valores
        const totalItens = carrinhoAtualizado?.ItemCarrinho.reduce((sum, item) => sum + item.quantidade, 0) || 0;
        const valorTotal = carrinhoAtualizado?.ItemCarrinho.reduce((sum, item) => {
          const preco = item.produto?.preco ? item.produto?.preco : 0;
          return sum + (preco * item.quantidade);
        }, 0) || 0;

        // Formatar resposta
        const respostaFormatada = {
          id: carrinhoAtualizado?.id || '',
          usuarioId: carrinhoAtualizado?.usuarioId || '',
          criadoEm: carrinhoAtualizado?.criadoEm || new Date().toISOString(),
          atualizadoEm: carrinhoAtualizado?.atualizadoEm || new Date().toISOString(),
          itens: carrinhoAtualizado?.ItemCarrinho.map(item => ({
            id: item.id,
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            preco: item.produto?.preco ? item.produto?.preco : 0,
            produto: {
              id: item.produto?.id,
              nome: item.produto?.nome,
              preco: item.produto?.preco,
              quantidadeEstoque: item.produto?.quantidade,
              imagem: item.produto?.ImagemProduto?.[0]?.url,
              imagemAlt: item.produto?.ImagemProduto?.[0]?.ordem
            }
          })) || [],
          totalItens,
          subtotal: valorTotal,
          desconto: 0,
          total: valorTotal
        };

        reply.code(200).send({
          success: true,
          data: respostaFormatada
        });
      } catch (error) {
        console.error('Erro ao sincronizar carrinho:', error);
        reply.status(500).send({
          success: false,
          message: 'Erro ao sincronizar carrinho'
        });
      }
    }
  );
}