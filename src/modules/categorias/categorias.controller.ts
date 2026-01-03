// src/modules/categorias/categorias.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';

export class CategoriasController {
  async listarCategorias(request: FastifyRequest, reply: FastifyReply) {
    try {
      const categorias = await prisma.categoria.findMany({
        include: {
          categoria: true,
          other_categoria: true,
          produto: {
            select: {
              id: true,
              nome: true,
              ativo: true
            }
          }
        },
        orderBy: { criadoEm: 'desc' }
      });

      reply.send({
        success: true,
        data: categorias,
        total: categorias.length
      });
    } catch (error) {
      console.error('Erro ao listar categorias:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao listar categorias'
      });
    }
  }

  async buscarCategoriaPorId(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      const categoria = await prisma.categoria.findUnique({
        where: { id },
        include: {
          categoria: true,
          other_categoria: true,
          produto: true
        }
      });

      if (!categoria) {
        return reply.status(404).send({
          success: false,
          message: 'Categoria não encontrada'
        });
      }

      reply.send({
        success: true,
        data: categoria
      });
    } catch (error) {
      console.error('Erro ao buscar categoria:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao buscar categoria'
      });
    }
  }

  async buscarCategoriaPorSlug(
    request: FastifyRequest<{ Params: { slug: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { slug } = request.params;

      const categoria = await prisma.categoria.findUnique({
        where: { slug },
        include: {
          categoria: true,
          other_categoria: true,
          produto: {
            where: { ativo: true },
            select: {
              id: true,
              nome: true,
              preco: true,
              precoDesconto: true,
              imagemproduto: {
                where: { principal: true },
                take: 1
              }
            }
          }
        }
      });

      if (!categoria) {
        return reply.status(404).send({
          success: false,
          message: 'Categoria não encontrada'
        });
      }

      reply.send({
        success: true,
        data: categoria
      });
    } catch (error) {
      console.error('Erro ao buscar categoria por slug:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao buscar categoria'
      });
    }
  }

  async criarCategoria(
    request: FastifyRequest<{
      Body: {
        nome: string;
        descricao?: string;
        slug: string;
        paiId?: string;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const { nome, descricao, slug, paiId } = request.body;

      // Verificar se slug já existe
      const slugExistente = await prisma.categoria.findUnique({
        where: { slug }
      });

      if (slugExistente) {
        return reply.status(400).send({
          success: false,
          message: 'Slug já está em uso'
        });
      }

      // Verificar se categoria pai existe
      if (paiId) {
        const categoriaPai = await prisma.categoria.findUnique({
          where: { id: paiId }
        });

        if (!categoriaPai) {
          return reply.status(400).send({
            success: false,
            message: 'Categoria pai não encontrada'
          });
        }
      }

      const categoria = await prisma.categoria.create({
        data: {
          id: `cat_${Date.now()}`,
          nome,
          descricao,
          slug,
          paiId
        }
      });

      reply.status(201).send({
        success: true,
        message: 'Categoria criada com sucesso',
        data: categoria
      });
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao criar categoria'
      });
    }
  }

  async atualizarCategoria(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        nome?: string;
        descricao?: string;
        slug?: string;
        paiId?: string;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;
      const dados = request.body;

      // Verificar se categoria existe
      const categoriaExistente = await prisma.categoria.findUnique({
        where: { id }
      });

      if (!categoriaExistente) {
        return reply.status(404).send({
          success: false,
          message: 'Categoria não encontrada'
        });
      }

      // Verificar se novo slug já existe (se for alterado)
      if (dados.slug && dados.slug !== categoriaExistente.slug) {
        const slugExistente = await prisma.categoria.findUnique({
          where: { slug: dados.slug }
        });

        if (slugExistente) {
          return reply.status(400).send({
            success: false,
            message: 'Slug já está em uso'
          });
        }
      }

      // Verificar se não está tentando ser pai de si mesmo
      if (dados.paiId === id) {
        return reply.status(400).send({
          success: false,
          message: 'Uma categoria não pode ser pai de si mesma'
        });
      }

      // Verificar se categoria pai existe
      if (dados.paiId) {
        const categoriaPai = await prisma.categoria.findUnique({
          where: { id: dados.paiId }
        });

        if (!categoriaPai) {
          return reply.status(400).send({
            success: false,
            message: 'Categoria pai não encontrada'
          });
        }

        // Verificar loop hierárquico
        const verificarLoop = async (categoriaId: string, paiId: string): Promise<boolean> => {
          const pai = await prisma.categoria.findUnique({
            where: { id: paiId },
            select: { paiId: true }
          });
          
          if (!pai || !pai.paiId) return false;
          if (pai.paiId === categoriaId) return true;
          return verificarLoop(categoriaId, pai.paiId);
        };

        if (await verificarLoop(id, dados.paiId)) {
          return reply.status(400).send({
            success: false,
            message: 'Criação de loop hierárquico não permitida'
          });
        }
      }

      const categoria = await prisma.categoria.update({
        where: { id },
        data: {
          ...dados,
          atualizadoEm: new Date()
        }
      });

      reply.send({
        success: true,
        message: 'Categoria atualizada com sucesso',
        data: categoria
      });
    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao atualizar categoria'
      });
    }
  }

  async deletarCategoria(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      // Verificar se categoria existe
      const categoria = await prisma.categoria.findUnique({
        where: { id },
        include: {
          other_categoria: true,
          produto: true
        }
      });

      if (!categoria) {
        return reply.status(404).send({
          success: false,
          message: 'Categoria não encontrada'
        });
      }

      // Verificar se tem subcategorias
      if (categoria.other_categoria.length > 0) {
        return reply.status(400).send({
          success: false,
          message: 'Não é possível deletar categoria que possui subcategorias'
        });
      }

      // Verificar se tem produtos associados
      if (categoria.produto.length > 0) {
        return reply.status(400).send({
          success: false,
          message: 'Não é possível deletar categoria que possui produtos associados'
        });
      }

      await prisma.categoria.delete({
        where: { id }
      });

      reply.send({
        success: true,
        message: 'Categoria deletada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao deletar categoria:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao deletar categoria'
      });
    }
  }

  async listarCategoriasHierarquia(request: FastifyRequest, reply: FastifyReply) {
    try {
      const categorias = await prisma.categoria.findMany({
        where: { paiId: null },
        include: {
          other_categoria: {
            include: {
              other_categoria: true
            }
          }
        },
        orderBy: { nome: 'asc' }
      });

      reply.send({
        success: true,
        data: categorias
      });
    } catch (error) {
      console.error('Erro ao listar hierarquia de categorias:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao listar categorias'
      });
    }
  }
}