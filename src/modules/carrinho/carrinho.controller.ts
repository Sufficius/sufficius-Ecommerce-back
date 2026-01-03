// src/modules/carrinho/carrinho.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';

export class CarrinhoController {
  async obterCarrinho(request: FastifyRequest, reply: FastifyReply) {
    try {
      const usuario = request.user as any;

      const carrinho = await prisma.carrinho.findUnique({
        where: { usuarioId: usuario.id },
        include: {
          itemcarrinho: {
            include: {
              produto: {
                select: {
                  id: true,
                  nome: true,
                  preco: true,
                  precoDesconto: true,
                  estoque: true,
                  imagemproduto: {
                    where: { principal: true },
                    take: 1
                  }
                }
              },
              carrinho: {
                select: {
                  id: true,
                  itemcarrinho: true,
                  usuario: true,
                  usuarioId: true
                }
              }
            }
          }
        }
      });

      if (!carrinho) {
        // Criar carrinho se não existir
        const novoCarrinho = await prisma.carrinho.create({
          data: {
            id: `cart_${Date.now()}`,
            usuarioId: usuario.id
          },
          include: {
            itemcarrinho: true
          }
        });

        return reply.send({
          success: true,
          data: novoCarrinho,
          totalItens: 0,
          valorTotal: 0
        });
      }

      // Calcular valores
      const totalItens = carrinho.itemcarrinho.reduce((sum, item) => sum + item.quantidade, 0);
      const valorTotal = carrinho.itemcarrinho.reduce((sum, item) => {
        const preco = item.produto?.preco || item.produto.precoDesconto || item.produto.preco;
        return sum + (preco * item.quantidade);
      }, 0);

      reply.send({
        success: true,
        data: carrinho,
        totalItens,
        valorTotal
      });
    } catch (error) {
      console.error('Erro ao obter carrinho:', error);
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
        variacaoId?: string;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const usuario = request.user as any;
      const { produtoId, quantidade, variacaoId } = request.body;

      // Verificar se produto existe
      const produto = await prisma.produto.findUnique({
        where: { id: produtoId }
      });

      if (!produto) {
        return reply.status(400).send({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      // Verificar estoque
      let estoqueDisponivel = produto.estoque;

      if (variacaoId) {
        const variacao = await prisma.produto.findUnique({
          where: { id: variacaoId }
        });

        if (!variacao) {
          return reply.status(400).send({
            success: false,
            message: 'Variação não encontrada'
          });
        }

        estoqueDisponivel = variacao.estoque;
      }

      if (estoqueDisponivel < quantidade) {
        return reply.status(400).send({
          success: false,
          message: `Estoque insuficiente. Disponível: ${estoqueDisponivel}`
        });
      }

      // Buscar ou criar carrinho
      let carrinho = await prisma.carrinho.findUnique({
        where: { usuarioId: usuario.id }
      });

      if (!carrinho) {
        carrinho = await prisma.carrinho.create({
          data: {
            id: `cart_${Date.now()}`,
            usuarioId: usuario.id
          }
        });
      }

      // Verificar se item já existe no carrinho
      const itemExistente = await prisma.itemcarrinho.findFirst({
        where: {
          carrinhoId: carrinho.id,
          produtoId,
          id: variacaoId
        }
      });

      let itemCarrinho;

      if (itemExistente) {
        // Atualizar quantidade
        itemCarrinho = await prisma.itemcarrinho.update({
          where: { id: itemExistente.id },
          data: {
            quantidade: itemExistente.quantidade + quantidade
          },
          include: {
            produto: true,
            carrinho: true
          }
        });
      } else {
        // Criar novo item
        const precoUnitario = produto.precoDesconto || produto.preco;
        itemCarrinho = await prisma.itemcarrinho.create({
          data: {
            id: `item_${Date.now()}`,
            carrinhoId: carrinho.id,
            produtoId,
            quantidade,
            precoNoCarrinho :  precoUnitario,
          },
          include: {
            produto: true,
            carrinho: true
          }
        });
      }

      reply.send({
        success: true,
        message: 'Item adicionado ao carrinho',
        data: itemCarrinho
      });
    } catch (error) {
      console.error('Erro ao adicionar item ao carrinho:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao adicionar item ao carrinho'
      });
    }
  }

  async atualizarItem(
    request: FastifyRequest<{
      Params: { itemId: string };
      Body: { quantidade: number };
    }>,
    reply: FastifyReply
  ) {
    try {
      const usuario = request.user as any;
      const { itemId } = request.params;
      const { quantidade } = request.body;

      // Buscar item
      const item = await prisma.itemcarrinho.findUnique({
        where: { id: itemId },
        include: {
          carrinho: true,
          produto: true,
        }
      });

      if (!item) {
        return reply.status(404).send({
          success: false,
          message: 'Item não encontrado'
        });
      }

      // Verificar se carrinho pertence ao usuário
      if (item.carrinho.usuarioId !== usuario.id) {
        return reply.status(403).send({
          success: false,
          message: 'Você não tem permissão para modificar este item'
        });
      }

      // Verificar estoque
      const estoqueDisponivel = item.produto?.estoque || item.produto.estoque;
      if (estoqueDisponivel < quantidade) {
        return reply.status(400).send({
          success: false,
          message: `Estoque insuficiente. Disponível: ${estoqueDisponivel}`
        });
      }

      // Atualizar item
      const itemAtualizado = await prisma.itemcarrinho.update({
        where: { id: itemId },
        data: { quantidade },
        include: {
          produto: true,
          carrinho: true
        }
      });

      reply.send({
        success: true,
        message: 'Item atualizado',
        data: itemAtualizado
      });
    } catch (error) {
      console.error('Erro ao atualizar item do carrinho:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao atualizar item do carrinho'
      });
    }
  }

  async removerItem(
    request: FastifyRequest<{ Params: { itemId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const usuario = request.user as any;
      const { itemId } = request.params;

      // Buscar item
      const item = await prisma.itemcarrinho.findUnique({
        where: { id: itemId },
        include: {
          carrinho: true
        }
      });

      if (!item) {
        return reply.status(404).send({
          success: false,
          message: 'Item não encontrado'
        });
      }

      // Verificar se carrinho pertence ao usuário
      if (item.carrinho.usuarioId !== usuario.id) {
        return reply.status(403).send({
          success: false,
          message: 'Você não tem permissão para remover este item'
        });
      }

      // Remover item
      await prisma.itemcarrinho.delete({
        where: { id: itemId }
      });

      reply.send({
        success: true,
        message: 'Item removido do carrinho'
      });
    } catch (error) {
      console.error('Erro ao remover item do carrinho:', error);
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
      const carrinho = await prisma.carrinho.findUnique({
        where: { usuarioId: usuario.id }
      });

      if (!carrinho) {
        return reply.send({
          success: true,
          message: 'Carrinho já está vazio'
        });
      }

      // Remover todos os itens
      await prisma.itemcarrinho.deleteMany({
        where: { carrinhoId: carrinho.id }
      });

      reply.send({
        success: true,
        message: 'Carrinho limpo com sucesso'
      });
    } catch (error) {
      console.error('Erro ao limpar carrinho:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao limpar carrinho'
      });
    }
  }
}