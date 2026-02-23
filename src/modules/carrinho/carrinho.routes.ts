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
      // VERIFICAÇÃO 1: Body existe?
      if (!request.body) {
        console.log('❌ Body não recebido');
        return reply.status(400).send({ 
          success: false,
          message: "Nenhum dado recebido" 
        });
      }

      console.log('📦 Body recebido:', request.body);
      console.log('📋 Content-Type:', request.headers['content-type']);

      const body = request.body as MultipartBody;

      // VERIFICAÇÃO 2: Processar multipart com segurança
      let fields = {};
      let files = {};

      try {
        const resultado = await getFieldsAndFiles(body);
        fields = resultado.fields || {};
        files = resultado.files || {};
        
        console.log('✅ Campos extraídos:', fields);
        console.log('✅ Arquivos extraídos:', Object.keys(files));
        
        // Log detalhado do arquivo
        if ((files as any).paymentProof) {
          console.log('📎 Detalhes do paymentProof:', {
            filename: (files as any).paymentProof.filename,
            mimetype: (files as any).paymentProof.mimetype,
            temBuffer: !!((files as any).paymentProof._buf),
            tamanho: (files as any).paymentProof.tamanho || 'desconhecido'
          });
        }
        
      } catch (multipartError) {
        console.error('❌ Erro ao processar multipart:', multipartError);
        return reply.status(400).send({
          success: false,
          message: "Erro ao processar dados do formulário",
          error: multipartError instanceof Error ? multipartError.message : String(multipartError)
        });
      }

      // VERIFICAÇÃO 3: Campos obrigatórios existem?
      if (!fields || Object.keys(fields).length === 0) {
        return reply.status(400).send({ 
          success: false,
          message: "Nenhum campo recebido no formulário" 
        });
      }

      // VERIFICAÇÃO 4: Validar campos com Zod
      let checkoutFields;
      try {
        checkoutFields = CheckoutFieldsSchema.parse(fields);
        console.log('✅ Validação dos campos passou:', checkoutFields);
      } catch (validationError) {
        console.error('❌ Erro de validação dos campos:', validationError);
        if (validationError instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            message: "Erro de validação nos campos",
            errors: validationError.errors
          });
        }
        throw validationError;
      }

      const userId = checkoutFields.userId;

      // VERIFICAÇÃO 5: Arquivo paymentProof existe? (CORRIGIDO: paymentProof)
      const paymentProofFile = (files as any).paymentProof;
      if (!paymentProofFile) {
        return reply.status(400).send({ 
          success: false,
          message: "É necessário enviar o comprovativo! (campo 'paymentProof')" 
        });
      }

      // VERIFICAÇÃO 6: Validar estrutura do arquivo com Zod (CORRIGIDO)
      let fileData;
      try {
        fileData = FileSchema.parse({ paymentProof: paymentProofFile });
        console.log('✅ Validação do arquivo passou');
      } catch (validationError) {
        console.error('❌ Erro de validação do arquivo:', validationError);
        if (validationError instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            message: "Arquivo inválido",
            errors: validationError.errors
          });
        }
        throw validationError;
      }

      const originalFileName = fileData.paymentProof.filename || 'arquivo';
      const normalizedFileName = normalizeFileName(originalFileName);
      const fileName = `${Date.now()}_${normalizedFileName}`;
      const mimetypeData = fileData.paymentProof.mimetype || 'application/octet-stream';
      const fileBuffer = fileData.paymentProof._buf;

      // VERIFICAÇÃO 7: Buffer do arquivo existe?
      if (!fileBuffer) {
        return reply.status(400).send({ 
          success: false,
          message: "Arquivo inválido - buffer não encontrado" 
        });
      }

      if (!(fileBuffer instanceof Buffer)) {
        return reply.status(400).send({ 
          success: false,
          message: "Arquivo inválido - não é um buffer válido" 
        });
      }

      // VERIFICAÇÃO 8: Upload para Supabase
      console.log('📤 Fazendo upload para Supabase...');
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('sufficius-files')
        .upload(`comprovativos/${fileName}`, fileBuffer, {
          contentType: mimetypeData,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error("❌ Erro ao enviar para Supabase:", uploadError);
        return reply.status(500).send({ 
          success: false,
          error: uploadError.message 
        });
      }

      console.log('✅ Upload realizado com sucesso:', uploadData);

      // VERIFICAÇÃO 9: Buscar carrinho do usuário
      const cart = await prisma.carrinho.findFirst({
        where: { usuarioId: userId },
        include: { 
          ItemCarrinho: { 
            include: { 
              produto: true 
            } 
          } 
        }
      });

      if (!cart) {
        return reply.status(400).send({ 
          success: false,
          message: "Carrinho não encontrado" 
        });
      }

      if (cart.ItemCarrinho.length === 0) {
        return reply.status(400).send({ 
          success: false,
          message: "Carrinho vazio" 
        });
      }

      // VERIFICAÇÃO 10: Verificar estoque
      for (const item of cart.ItemCarrinho) {
        if (item.quantidade > item.produto.quantidade) {
          return reply.status(400).send({
            success: false,
            message: `Quantidade insuficiente para o produto ${item.produto.nome}`,
            produto: item.produto.nome,
            disponivel: item.produto.quantidade,
            solicitado: item.quantidade
          });
        }
      }

      // VERIFICAÇÃO 11: Processar transação
      try {
        const orders = await prisma.$transaction(async (tx) => {
          const createdOrders = [];

          // Agrupa os itens do carrinho
          for (const item of cart.ItemCarrinho) {
            const total = item.quantidade * item.produto.preco;

            const order = await tx.pagamento.create({
              data: {
                id: randomUUID(),
                usuarioId: userId,
                pedidoId: item.produtoId,
                valor: total,
                metodo: "DINHEIRO_ENTREGA",
                status: "PENDENTE",
                comprovativoUrl: uploadData?.path || fileName
              },
              include: { pedido: true }
            });
            createdOrders.push(order);

            // Atualizar estoque
            await tx.produto.update({
              where: { id: item.produtoId },
              data: {
                quantidade: {
                  decrement: item.quantidade
                }
              }
            });
          }

          // Limpar carrinho
          await tx.carrinho.delete({
            where: { id: cart.id }
          });

          return createdOrders;
        });

        console.log('✅ Checkout finalizado com sucesso');
        return reply.status(200).send({
          success: true,
          message: "Compra finalizada com sucesso",
          data: {
            orders,
            comprovativo: uploadData?.path
          }
        });

      } catch (transactionError) {
        console.error('❌ Erro na transação:', transactionError);
        return reply.status(500).send({
          success: false,
          message: "Erro ao processar pagamento",
          error: transactionError instanceof Error ? transactionError.message : String(transactionError)
        });
      }

    } catch (error) {
      console.error('❌ Erro no checkout:', error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          message: "Erro de validação",
          errors: error.errors
        });
      }

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