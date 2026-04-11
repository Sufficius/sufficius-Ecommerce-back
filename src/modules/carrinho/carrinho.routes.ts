// src/modules/carrinho/carrinho.routes.ts
import { FastifyInstance } from 'fastify';
import { CarrinhoController } from './carrinho.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { prisma } from '../../lib/prisma';
import { randomUUID } from 'crypto';
import { MultipartBody } from '../types/multipart';
import { getFieldsAndFiles } from '../helpers/multipart';
import z from 'zod';
import { supabase } from '../../lib/supabase';

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
    produtoId: string;
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
    produtoId: string;
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
              totalItens: { type: 'number' },
            }
          },
          400: {
            type: 'object',
            properties: {
              totalItens: { type: 'number' },
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

  // Schemas de validação
  const CheckoutFieldsSchema = z.object({
    userId: z.string().min(1, "O campo 'userId' é obrigatório."),
    location: z.string().min(1, "O campo 'location' é obrigatório."),
    phone: z.string().min(1, "O campo 'phone' é obrigatório."),
  });

  // Schema mais flexível para o arquivo - CORRIGIDO
  const FileSchema = z.object({
    paymentProof: z.object({
      filename: z.string().optional().default('arquivo.pdf'),
      mimetype: z.string().optional().default('application/octet-stream'),
      _buf: z.any().refine(val => val !== undefined && val !== null, {
        message: "Buffer do arquivo é obrigatório"
      }),
      fieldname: z.string().optional(),
      encoding: z.string().optional(),
      type: z.string().optional(),
    }).passthrough() // Permite propriedades extras
  });

  const normalizeFileName = (fileName: string): string => {
    if (!fileName) return `file_${Date.now()}`;

    return fileName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
  };

  // ROTA DE CHECKOUT CORRIGIDA
  app.post('/checkout', async (request, reply) => {
    try {
      console.log("📦 Iniciando checkout...");
    
      const user = request.user as any;
      if (!user) {
        console.log("❌ Usuário não autenticado");
        return reply.status(401).send({
          success: false,
          message: "Usuário não autenticado"
        });
      }

      console.log("✅ Usuário autenticado:", user.id);

      // // 2. AGORA processar o multipart
      // const contentType = request.headers['content-type'] || '';
      // const isMultipart = contentType.includes('multipart/form-data');
      // console.log("Content: ", contentType);

      const parts = request.parts();
      // let dados = request.body as any;
      let userId = '';
      let location = '';
      let phone = '';
      let paymentProofBuffer: Buffer | null = null;
      let paymentProofFilename = '';
      let paymentProofMimetype = '';


      console.log('📊 Dados recebidos do formulário:', { userId, location, phone, paymentProofFilename });

      for await (const part of parts) {
        console.log(`🔍 Processando part: tipo=${part.type}, fieldname=${part.fieldname}`);

        if (part.type === 'field') {
          if (part.fieldname === 'userId') userId = part.value as string;
          if (part.fieldname === 'location') location = part.value as string;
          if (part.fieldname === 'phone') phone = part.value as string;
          console.log(`📝 Campo: ${part.fieldname} = ${part.value}`);
        } else if (part.type === 'file') {
          console.log(`📎 Arquivo recebido: ${part.filename}, tipo: ${part.mimetype}`);
          paymentProofFilename = part.filename;
          paymentProofMimetype = part.mimetype;
          paymentProofBuffer = await part.toBuffer();
        }
      }

      if (!userId) {
        console.log("❌ userId ausente");
        return reply.status(400).send({
          success: false,
          message: "ID do usuário é obrigatório"
        });
      }

      if (!location) {
        console.log("❌ location ausente");
        return reply.status(400).send({
          success: false,
          message: "Localização é obrigatória"
        });
      }

      if (!phone) {
        console.log("❌ phone ausente");
        return reply.status(400).send({
          success: false,
          message: "Telefone é obrigatório"
        });
      }

      if (!paymentProofBuffer) {
        console.log("❌ Comprovativo ausente");
        return reply.status(400).send({
          success: false,
          message: "Comprovativo de pagamento é obrigatório"
        });
      }

       console.log(`✅ Dados validados: userId=${userId}, location=${location}, phone=${phone}`);

      // if (!userId || !location || !phone || !paymentProofFile) {
      //   return reply.status(400).send({
      //     success: false,
      //     message: "Campos obrigatórios não preenchidos"
      //   });
      // }

      // Validar tipo do arquivo
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
      if (!validTypes.includes(paymentProofMimetype)) {
         console.log(`❌ Tipo inválido: ${paymentProofMimetype}`);
        return reply.status(400).send({
          success: false,
          message: "Tipo de arquivo não suportado. Use JPEG, PNG, WebP ou PDF"
        });
      }

      // Validar tamanho (10MB)
      if (paymentProofBuffer.length > 10 * 1024 * 1024) {
        console.log(`❌ Arquivo muito grande: ${paymentProofBuffer.length} bytes`);
        return reply.status(400).send({
          success: false,
          message: "Arquivo muito grande. Máximo 10MB"
        });
      }

         console.log("📦 Verificando carrinho...");
      const cartCount = await prisma.itemCarrinho.count({
        where: {
          carrinho: {
            usuarioId: userId
          }
        }
      });
      console.log(`📊 Itens no carrinho: ${cartCount}`);

      if (cartCount === 0) {
        console.log("❌ Carrinho vazio");
        return reply.status(400).send({
          success: false,
          message: "Carrinho vazio"
        });
      }

      const cart = await prisma.carrinho.findFirst({
        where: { usuarioId: userId },
        include: {
          ItemCarrinho: {
            include: {
              produto: true,
            }
          }
        }
      });

      if (!cart || cart.ItemCarrinho.length === 0) {
        console.log("❌ Carrinho não encontrado ou vazio");
        return reply.status(400).send({
          success: false,
          message: "Carrinho vazio"
        });
      }
       console.log(`✅ Carrinho encontrado com ${cart.ItemCarrinho.length} itens`);

      for (const item of cart.ItemCarrinho) {
        if (item.quantidade > item.produto.quantidade) {
          console.log(`❌ Estoque insuficiente para ${item.produto.nome}`);
          return reply.status(400).send({
            success: false,
            message: `Quantidade insuficiente para o produto ${item.produto.nome}`,
          });
        }
      }

      const endereco = await prisma.endereco.findFirst({
        where: { usuarioId: userId },
        select: { id: true }
      });

      if (!endereco) {
         console.log("❌ Endereço não encontrado");
        return reply.status(400).send({
          success: false,
          message: "Endereço do usuário não encontrado"
        });
      }

      const total = cart.ItemCarrinho.reduce((sum, item) =>
        sum + (item.quantidade * item.produto.preco), 0
      );

      const fileExtension = paymentProofFilename.split('.').pop();
      const fileName = `comprovativos/${Date.now()}_${userId.substring(0, 8)}.${fileExtension}`;

      console.log("📤 Fazendo upload para:", fileName);

      // TENTAR UPLOAD COM VERIFICAÇÃO
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('sufficius-files')
        .upload(fileName, paymentProofBuffer, {
          contentType: paymentProofMimetype,
          cacheControl: '3600',
          upsert: false
        });


      if (uploadError) {
        console.log("❌ Erro no upload: ", uploadError);
        return reply.status(500).send({
          success: false,
          message: `Erro ao fazer upload do comprovativo: ${uploadError.message}`,
        });
      }

      console.log("✅ Upload realizado com sucesso:", uploadData);

      const pedido = await prisma.pedido.create({
        data: {
          id: randomUUID(),
          numeroPedido: `${Math.floor(Math.random() * 10000)}${Date.now()}`,
          usuarioId: userId,
          enderecoId: endereco.id,
          status: "PAGAMENTO_PENDENTE",
          frete: 0,
          desconto: 0,
          total: total,
          metodoEnvio: "PADRAO",
          metodoPagamento: "TRANSFERENCIA_BANCARIA",
          statusPagamento: "PENDENTE",
          observacoes: `Local: ${location}, Telefone: ${phone}`,
        }
      });

      console.log('✅ Pedido criado com sucesso:', pedido.numeroPedido);

      // Criar itens do pedido
      await prisma.itemPedido.createMany({
        data: cart.ItemCarrinho.map(item => ({
          id: randomUUID(),
          pedidoId: pedido.id,
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          precoUnitario: item.produto.preco,
          precoTotal: item.quantidade * item.produto.preco
        }))
      });


      await prisma.pagamento.create({
        data: {
          id: randomUUID(),
          usuarioId: userId,
          pedidoId: pedido.id,
          valor: total,
          metodo: "TRANSFERENCIA_BANCARIA",
          status: "PENDENTE",
          comprovativoUrl: fileName
        }
      });

      for (const item of cart.ItemCarrinho) {
        await prisma.produto.update({
          where: { id: item.produtoId },
          data: { quantidade: { decrement: item.quantidade } }
        });
      }

      await prisma.carrinho.delete({
        where: { id: cart.id }
      });


      console.log(`✅ Pedido ${pedido.numeroPedido} processado com sucesso`);

      return reply.status(200).send({
        success: true,
        message: "Compra finalizada com sucesso",
        data: {
          pedidoId: pedido.numeroPedido,
          total: total,
          status: "CONCLUIDO"
        }
      });
    } catch (error) {
      console.error('❌ Erro no checkout:', error);
      return reply.status(500).send({
        success: false,
        message: "Erro interno ao processar checkout",
        error: error instanceof Error ? error.message : String(error)
      });
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
    '/item/:id/:produtoId',
    {
      preHandler: [authenticate],
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            produtoId: { type: 'string' }
          },
          required: ['id', 'produtoId']
        },
        body: {
          type: 'object',
          required: ['quantidade'],
          properties: {
            quantidade: { type: 'number', minimum: 0 }
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
    '/item/:produtoId',
    {
      preHandler: [authenticate],
      schema: {
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
  );

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
  );

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