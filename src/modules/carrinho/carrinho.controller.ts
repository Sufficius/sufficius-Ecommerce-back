// src/modules/carrinho/carrinho.controller.ts
import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';
import { randomUUID } from 'crypto';

export class CarrinhoController {
  async obterCarrinho(request: FastifyRequest, reply: FastifyReply) {
    try {
      const usuario = request.user as any;

      // Buscar carrinho
      const carrinho = await prisma.carrinho.findFirst({
        where: { usuarioId: usuario.id },
        include: {
          ItemCarrinho: {
            include: {
              produto: {
                select: {
                  id: true,
                  nome: true,
                  preco: true,
                  foto: true,
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


      // Se não existir carrinho, criar um vazio
      if (!carrinho) {

        const novoCarrinho = await prisma.carrinho.create({
          data: {
            id: randomUUID(),
            usuarioId: usuario.id
          },
          include: {
            ItemCarrinho: {
              include: {
                produto: {
                  select: {
                    id: true,
                    nome: true,
                    preco: true,
                    quantidade: true,
                    foto: true,
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
        const totalItens = novoCarrinho.ItemCarrinho.reduce((sum, item) => sum + item.quantidade, 0);
        const valorTotal = novoCarrinho.ItemCarrinho.reduce((sum, item) => {
          const preco = item.produto.preco ? item.produto?.preco : 0;
          return sum + (preco * item.quantidade);
        }, 0);

        // Formatar resposta
        const respostaFormatada = {
          id: novoCarrinho.id,
          usuarioId: novoCarrinho.usuarioId,
          criadoEm: novoCarrinho.criadoEm,
          atualizadoEm: novoCarrinho.atualizadoEm,
          itens: novoCarrinho.ItemCarrinho.map(item => ({
            id: item.id,
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            preco: item.produto?.preco ? item.produto?.preco : 0,
            produto: {
              id: item.produto?.id,
              nome: item.produto?.nome,
              preco: item.produto?.preco,
              foto: item.produto?.foto,
              quantidadeEstoque: item.produto?.quantidade,
              imagem: item.produto?.ImagemProduto?.[0]?.url,
              imagemAlt: item.produto?.ImagemProduto?.[0]?.ordem
            }
          })),
          totalItens,
          desconto: 0,
          total: valorTotal
        };


        return reply.send({
          success: true,
          data: respostaFormatada
        });
      }

      // Calcular valores
      const totalItens = carrinho.ItemCarrinho.reduce((sum, item) => sum + item.quantidade, 0);
      const valorTotal = carrinho.ItemCarrinho.reduce((sum, item) => {
        const preco = item.produto?.preco ? item.produto?.preco : 0;
        return sum + (preco * item.quantidade);
      }, 0);

      // Formatar resposta
      const respostaFormatada = {
        id: carrinho.id,
        usuarioId: carrinho.usuarioId,
        criadoEm: carrinho.criadoEm,
        atualizadoEm: carrinho.atualizadoEm,
        itens: carrinho.ItemCarrinho.map(item => ({
          id: item.id,
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          preco: item.produto?.preco ? item.produto?.preco : 0,
          produto: {
            id: item.produto?.id,
            nome: item.produto?.nome,
            preco: item.produto?.preco,
            quantidadeEstoque: item.produto?.quantidade,
            foto: item.produto?.foto,
            imagem: item.produto?.ImagemProduto?.[0]?.url,
            imagemAlt: item.produto?.ImagemProduto?.[0]?.ordem
          }
        })),
        totalItens,
        desconto: 0,
        total: valorTotal
      };

      return reply.send({
        success: true,
        data: respostaFormatada
      });
    } catch (error) {
      console.error('❌ Erro ao obter carrinho:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao obter carrinho'
      });
    }
  }

  async adicionarItem(
    request: FastifyRequest<{
      Body: {
        produtoId: string;
        quantidade: number;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const usuario = request.user as any;
      const { produtoId, quantidade } = request.body;


      // Validações
      if (!produtoId) {
        return reply.status(400).send({
          success: false,
          message: 'ID do produto é obrigatório'
        });
      }

      if (!quantidade || quantidade < 1) {
        return reply.status(400).send({
          success: false,
          message: 'Quantidade deve ser maior que zero'
        });
      }

      // Buscar produto
      const produto = await prisma.produto.findUnique({
        where: { id: produtoId },
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
      });

      if (!produto) {
        return reply.status(404).send({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      // Verificar estoque
      if (produto.quantidade < quantidade) {
        return reply.status(422).send({
          success: false,
          message: `Estoque insuficiente. Disponível: ${produto.quantidade}`
        });
      }

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

      // Verificar se item já existe no carrinho
      const itemExistente = await prisma.itemCarrinho.findFirst({
        where: {
          carrinhoId: carrinho.id,
          produtoId: produtoId
        }
      });

      let itemAtualizado;

      if (itemExistente) {
        // Atualizar quantidade
        itemAtualizado = await prisma.itemCarrinho.update({
          where: { id: itemExistente.id },
          data: {
            quantidade: itemExistente.quantidade + quantidade
          }
        });
      } else {
        // Adicionar novo item
        itemAtualizado = await prisma.itemCarrinho.create({
          data: {
            id: randomUUID(),
            carrinhoId: carrinho.id,
            produtoId: produtoId,
            quantidade,
          }
        });
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



      if (!carrinhoAtualizado) {
        throw new Error('Carrinho não encontrado após adicionar item');
      }

      // Calcular valores
      const totalItens = carrinhoAtualizado.ItemCarrinho.reduce((sum, item) => sum + item.quantidade, 0);
      const valorTotal = carrinhoAtualizado.ItemCarrinho.reduce((sum, item) => {
        const preco = item.produto?.preco ? item.produto?.preco : 0;
        return sum + (preco * item.quantidade);
      }, 0);

      // Formatar resposta
      const respostaFormatada = {
        id: carrinhoAtualizado.id,
        usuarioId: carrinhoAtualizado.usuarioId,
        criadoEm: carrinhoAtualizado.criadoEm,
        atualizadoEm: carrinhoAtualizado.atualizadoEm,
        itens: carrinhoAtualizado.ItemCarrinho.map(item => {
          const produto = item.produto || {};
          const imagem = produto.ImagemProduto?.[0] || {};

          return {
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
          }
        }),
        totalItens,
        desconto: 0,
        total: valorTotal
      }

      return reply.send({
        success: true,
        message: 'Item adicionado ao carrinho',
        data: respostaFormatada
      });
    } catch (error) {
      console.error('❌ Erro ao adicionar item ao carrinho:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao adicionar item ao carrinho'
      });
    }
  }

  async atualizarItem(
    request: FastifyRequest<{
      Params: { id: string, produtoId: string };
      Body: { quantidade: number };
    }>,
    reply: FastifyReply
  ) {
    try {
      const usuario = request.user as any;
      const { id, produtoId } = request.params;
      const { quantidade } = request.body;

      if (!id) {
        return reply.status(400).send({
          success: false,
          message: 'ID do carrinho é obrigatório'
        });
      }

      if (!produtoId) {
        return reply.status(400).send({
          success: false,
          message: 'ID do produto é obrigatório'
        });
      }

      if (quantidade < 0) {
        return reply.status(400).send({
          success: false,
          message: 'Quantidade não pode ser negativa'
        });
      }

      // Buscar carrinho
      const carrinho = await prisma.carrinho.findFirst({
        where: {
          id: id,
        }
      });


      if (!carrinho) {
        return reply.status(404).send({
          success: false,
          message: 'Carrinho não encontrado'
        });
      }

      // Buscar item
      const item = await prisma.itemCarrinho.findFirst({
        where: {
          carrinhoId: carrinho.id,
        },
        include: {
          produto: {
            select: {
              id: true,
              nome: true,
              preco: true,
              quantidade: true
            }
          }
        }
      });


      if (!item) {
        return reply.status(404).send({
          success: false,
          message: 'Item não encontrado no carrinho'
        });
      }

      // Se quantidade for 0, remove o item
      if (quantidade === 0) {
        await prisma.itemCarrinho.delete({
          where: { id: item.id }
        });

      } else {
        // Verificar estoque
        if (item.quantidade < quantidade) {
          return reply.status(422).send({
            success: false,
            message: `Estoque insuficiente. Disponível: ${item.produto.quantidade}`
          });
        }

        // Atualizar quantidade
        await prisma.itemCarrinho.update({
          where: { id: item.id },
          data: { quantidade }
        });

      }

      // Buscar carrinho atualizado
      const carrinhoAtualizado = await prisma.carrinho.findFirst({
        where: { id: id },
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

      if (!carrinhoAtualizado) {
        throw new Error('Carrinho não encontrado após atualizar item');
      }

      // Calcular valores
      const totalItens = carrinhoAtualizado.ItemCarrinho.reduce((sum, item) => sum + item.quantidade, 0);
      const valorTotal = carrinhoAtualizado.ItemCarrinho.reduce((sum, item) => {
        const preco = item.produto?.preco ? item.produto?.preco : 0;
        return sum + (preco * item.quantidade);
      }, 0);

      // Formatar resposta
      const respostaFormatada = {
        id: carrinhoAtualizado.id,
        usuarioId: carrinhoAtualizado.usuarioId,
        criadoEm: carrinhoAtualizado.criadoEm,
        atualizadoEm: carrinhoAtualizado.atualizadoEm,
        itens: carrinhoAtualizado.ItemCarrinho.map(item => ({
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
        })),
        totalItens,
        desconto: 0,
        total: valorTotal
      };

      const mensagem = quantidade === 0 ? 'Item removido do carrinho' : 'Item atualizado no carrinho';

      return reply.send({
        success: true,
        message: mensagem,
        data: respostaFormatada
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar item no carrinho:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao atualizar item no carrinho'
      });
    }
  }

  async countItemsOnCart(request: FastifyRequest, reply: FastifyReply) {
    try {

      const usuario = request.user as any;

      const cart = await prisma.carrinho.findFirst({
        where: { usuarioId: usuario.id },
        include: { ItemCarrinho: true }
      });

      if (!cart) {
        return reply.code(200).send({
          totalItens: 0,
        });
      }

      const itemCount = cart.ItemCarrinho.reduce((sum, item) => sum + item.quantidade, 0);

      reply.send({
        totalItens: itemCount,
      });
    }
    catch (error) {
      console.error('❌ Erro ao contar itens no carrinho:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao contar itens no carrinho'
      });
    }
  }

  async removerItem(
    request: FastifyRequest<{ Params: { produtoId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const usuario = request.user as any;
      const { produtoId } = request.params;

      if (!produtoId) {
        return reply.status(400).send({
          success: false,
          message: 'ID do produto é obrigatório'
        });
      }

      // Buscar carrinho
      const carrinho = await prisma.carrinho.findFirst({
        where: { usuarioId: usuario.id }
      });

      if (!carrinho) {
        return reply.status(404).send({
          success: false,
          message: 'Carrinho não encontrado'
        });
      }

      // Buscar item
      const item = await prisma.itemCarrinho.findFirst({
        where: {
          carrinhoId: carrinho.id,
          produtoId
        }
      });

      if (!item) {
        return reply.status(404).send({
          success: false,
          message: 'Item não encontrado no carrinho'
        });
      }

      // Remover item
      await prisma.itemCarrinho.delete({
        where: { id: item.id }
      });

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

      if (!carrinhoAtualizado) {
        throw new Error('Carrinho não encontrado após remover item');
      }

      // Calcular valores
      const totalItens = carrinhoAtualizado.ItemCarrinho.reduce((sum, item) => sum + item.quantidade, 0);
      const valorTotal = carrinhoAtualizado.ItemCarrinho.reduce((sum, item) => {
        const preco = item.produto?.preco ? item.produto?.preco : 0;
        return sum + (preco * item.quantidade);
      }, 0);

      // Formatar resposta
      const respostaFormatada = {
        id: carrinhoAtualizado.id,
        usuarioId: carrinhoAtualizado.usuarioId,
        criadoEm: carrinhoAtualizado.criadoEm,
        atualizadoEm: carrinhoAtualizado.atualizadoEm,
        itens: carrinhoAtualizado.ItemCarrinho.map(item => ({
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
        })),
        totalItens,
        desconto: 0,
        total: valorTotal
      };

      return reply.send({
        success: true,
        message: 'Item removido do carrinho',
        data: respostaFormatada
      });
    } catch (error) {
      console.error('❌ Erro ao remover item do carrinho:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao remover item do carrinho'
      });
    }
  }

  async limparCarrinho(request: FastifyRequest, reply: FastifyReply) {
    try {
      const usuario = request.user as any;

      // Buscar carrinho
      const carrinho = await prisma.carrinho.findFirst({
        where: { usuarioId: usuario.id }
      });

      if (!carrinho) {
        return reply.send({
          success: true,
          message: 'Carrinho já está vazio'
        });
      }

      // Remover todos os itens
      await prisma.itemCarrinho.deleteMany({
        where: { carrinhoId: carrinho.id }
      });


      // Retornar carrinho vazio
      const respostaFormatada = {
        id: carrinho.id,
        usuarioId: carrinho.usuarioId,
        criadoEm: carrinho.criadoEm,
        atualizadoEm: new Date().toISOString(),
        itens: [],
        totalItens: 0,
        desconto: 0,
        total: 0
      };

      return reply.send({
        success: true,
        message: 'Carrinho limpo com sucesso',
        data: respostaFormatada
      });
    } catch (error) {
      console.error('❌ Erro ao limpar carrinho:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao limpar carrinho'
      });
    }
  }

  async deleteProductInCart(request: FastifyRequest, reply: FastifyReply) {
    const { id, produtoId } = request.params as any;

    try {
      const cart = await prisma.carrinho.findUnique({
        where: {
          id: id,
        },
      });

      if (!cart) {
        return reply.code(404).send({ message: "Carrinho não encontrado" });
      }
      const cartItem = await prisma.itemCarrinho.findFirst({
        where: {
          // id: id,
          produtoId: produtoId,
        },
      });

      if (!cartItem) {
        return reply.code(404).send({ message: "Produto não encontrado no carrinho" });
      }

      // Remover o item do carrinho
      await prisma.itemCarrinho.delete({
        where: {
          id: cartItem.id,
        },
      });
      return reply.code(200).send({ message: "Produto removido do carrinho com sucesso" });
    }
    catch (error) {
      return reply.code(500).send({ message: "Erro ao remover o produto do carrinho", error });
    }
  }

  async deleteAllProductsInCart(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as any;
    try {
      // Verificar se o carrinho existe
      const cart = await prisma.carrinho.findUnique({
        where: {
          id: id,
        },
      });

      if (!cart) {
        return reply.code(404).send({ message: "Carrinho não encontrado" });
      }

      // Deletar todos os itens do carrinho
      await prisma.itemCarrinho.deleteMany({
        where: {
          id: id,
        },
      });

      return reply.code(200).send({ message: "Todos os produtos foram removidos do carrinho com sucesso" });
    } catch (error) {
      return reply.code(500).send({ message: "Erro ao remover os produtos do carrinho", error });
    }
  }


  async obterQuantidade(request: FastifyRequest, reply: FastifyReply) {
    try {
      const usuario = request.user as any;

      // Buscar carrinho
      const carrinho = await prisma.carrinho.findFirst({
        where: { usuarioId: usuario.id },
        include: {
          ItemCarrinho: true
        }
      });

      const quantidadeTotal = carrinho?.ItemCarrinho.reduce((sum, item) => sum + item.quantidade, 0) || 0;

      return reply.send({
        success: true,
        quantidade: quantidadeTotal
      });
    } catch (error) {
      console.error('❌ Erro ao obter quantidade do carrinho:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao obter quantidade do carrinho'
      });
    }
  }
}