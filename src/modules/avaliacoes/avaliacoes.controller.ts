// src/modules/avaliacoes/avaliacoes.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';

export class AvaliacoesController {
  async listarAvaliacoes(
    request: FastifyRequest<{
      Querystring: {
        produtoId?: string;
        usuarioId?: string;
        page?: string;
        limit?: string;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const { produtoId, usuarioId, page = '1', limit = '10' } = request.query;
      
      const pagina = parseInt(page);
      const limite = parseInt(limit);
      const skip = (pagina - 1) * limite;

      const where: any = {};
      
      if (produtoId) where.produtoId = produtoId;
      if (usuarioId) where.usuarioId = usuarioId;

      const [avaliacoes, total] = await Promise.all([
        prisma.avaliacao.findMany({
          where,
          include: {
            produto: {
              select: {
                id: true,
                nome: true,
                imagemproduto: {
                  where: { principal: true },
                  take: 1
                }
              }
            },
            usuario: {
              select: {
                id: true,
                nome: true,
                foto: true
              }
            }
          },
          orderBy: { criadoEm: 'desc' },
          skip,
          take: limite
        }),
        prisma.avaliacao.count({ where })
      ]);

      // Calcular média das avaliações se filtrando por produto
      let mediaAvaliacoes = 0;
      if (produtoId) {
        const agregado = await prisma.avaliacao.aggregate({
          where: { produtoId },
          _avg: { nota: true },
          _count: true
        });
        mediaAvaliacoes = agregado._avg.nota || 0;
      }

      reply.send({
        success: true,
        data: avaliacoes,
        meta: {
          total,
          page: pagina,
          limit: limite,
          totalPages: Math.ceil(total / limite),
          mediaAvaliacoes: parseFloat(mediaAvaliacoes.toFixed(1))
        }
      });
    } catch (error) {
      console.error('Erro ao listar avaliações:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao listar avaliações'
      });
    }
  }

  async criarAvaliacao(
    request: FastifyRequest<{
      Body: {
        produtoId: string;
        nota: number;
        comentario?: string;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const usuario = request.user as any;
      const { produtoId, nota, comentario } = request.body;

      // Verificar se usuário já avaliou este produto
      const avaliacaoExistente = await prisma.avaliacao.findUnique({
        where: {
          usuarioId_produtoId: {
            usuarioId: usuario.id,
            produtoId
          }
        }
      });

      if (avaliacaoExistente) {
        return reply.status(400).send({
          success: false,
          message: 'Você já avaliou este produto'
        });
      }

      // Verificar se produto existe
      const produto = await prisma.produto.findUnique({
        where: { id: produtoId }
      });

      if (!produto) {
        return reply.status(404).send({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      // Verificar se nota está entre 1-5
      if (nota < 1 || nota > 5) {
        return reply.status(400).send({
          success: false,
          message: 'Nota deve estar entre 1 e 5'
        });
      }

      const avaliacao = await prisma.avaliacao.create({
        data: {
          id: `ava_${Date.now()}`,
          usuarioId: usuario.id,
          produtoId,
          nota,
          comentario,
          compraVerificada: false // Em produção, verificar se usuário comprou o produto
        },
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              foto: true
            }
          }
        }
      });

      // Atualizar média do produto
      await this.atualizarMediaProduto(produtoId);

      reply.status(201).send({
        success: true,
        message: 'Avaliação criada com sucesso',
        data: avaliacao
      });
    } catch (error) {
      console.error('Erro ao criar avaliação:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao criar avaliação'
      });
    }
  }

  async atualizarAvaliacao(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        nota?: number;
        comentario?: string;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const usuario = request.user as any;
      const { id } = request.params;
      const dados = request.body;

      // Buscar avaliação
      const avaliacao = await prisma.avaliacao.findUnique({
        where: { id },
        include: {
          produto: true
        }
      });

      if (!avaliacao) {
        return reply.status(404).send({
          success: false,
          message: 'Avaliação não encontrada'
        });
      }

      // Verificar se usuário é dono da avaliação ou admin
      if (avaliacao.usuarioId !== usuario.id && usuario.tipo !== 'ADMIN') {
        return reply.status(403).send({
          success: false,
          message: 'Você não tem permissão para atualizar esta avaliação'
        });
      }

      // Verificar se nota está entre 1-5
      if (dados.nota && (dados.nota < 1 || dados.nota > 5)) {
        return reply.status(400).send({
          success: false,
          message: 'Nota deve estar entre 1 e 5'
        });
      }

      const avaliacaoAtualizada = await prisma.avaliacao.update({
        where: { id },
        data: {
          ...dados,
          atualizadoEm: new Date()
        },
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              foto: true
            }
          }
        }
      });

      // Atualizar média do produto
      await this.atualizarMediaProduto(avaliacao.produtoId);

      reply.send({
        success: true,
        message: 'Avaliação atualizada com sucesso',
        data: avaliacaoAtualizada
      });
    } catch (error) {
      console.error('Erro ao atualizar avaliação:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao atualizar avaliação'
      });
    }
  }

  async deletarAvaliacao(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const usuario = request.user as any;
      const { id } = request.params;

      // Buscar avaliação
      const avaliacao = await prisma.avaliacao.findUnique({
        where: { id },
        include: {
          produto: true
        }
      });

      if (!avaliacao) {
        return reply.status(404).send({
          success: false,
          message: 'Avaliação não encontrada'
        });
      }

      // Verificar se usuário é dono da avaliação ou admin
      if (avaliacao.usuarioId !== usuario.id && usuario.tipo !== 'ADMIN') {
        return reply.status(403).send({
          success: false,
          message: 'Você não tem permissão para deletar esta avaliação'
        });
      }

      await prisma.avaliacao.delete({
        where: { id }
      });

      // Atualizar média do produto
      await this.atualizarMediaProduto(avaliacao.produtoId);

      reply.send({
        success: true,
        message: 'Avaliação deletada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao deletar avaliação:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao deletar avaliação'
      });
    }
  }

  async getEstatisticasProduto(
    request: FastifyRequest<{ Params: { produtoId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { produtoId } = request.params;

      const estatisticas = await prisma.avaliacao.aggregate({
        where: { produtoId },
        _count: true,
        _avg: { nota: true },
        _min: { nota: true },
        _max: { nota: true }
      });

      // Contar por nota
      const contagemPorNota = await Promise.all(
        [1, 2, 3, 4, 5].map(async (nota) => ({
          nota,
          quantidade: await prisma.avaliacao.count({
            where: { produtoId, nota }
          })
        }))
      );

      reply.send({
        success: true,
        data: {
          totalAvaliacoes: estatisticas._count,
          mediaNota: estatisticas._avg.nota || 0,
          notaMinima: estatisticas._min.nota || 0,
          notaMaxima: estatisticas._max.nota || 0,
          contagemPorNota
        }
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao buscar estatísticas do produto'
      });
    }
  }

  private async atualizarMediaProduto(produtoId: string) {
    try {
      const estatisticas = await prisma.avaliacao.aggregate({
        where: { produtoId },
        _avg: { nota: true },
        _count: true
      });

      const media = estatisticas._avg.nota || 0;
      const totalAvaliacoes = estatisticas._count;

      await prisma.produto.update({
        where: { id: produtoId },
        data: {
          // Aqui você pode adicionar campos para armazenar média se quiser
        }
      });
    } catch (error) {
      console.error('Erro ao atualizar média do produto:', error);
    }
  }
}