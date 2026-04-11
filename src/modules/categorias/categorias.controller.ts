// src/modules/categorias/categorias.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';

export class CategoriasController {
  async listarCategorias(request: FastifyRequest, reply: FastifyReply) {
    try {
      const categorias = await prisma.categoria.findMany({
        include: {
          // Ajuste conforme suas relações reais
          // categoria: true, // Remova se não existir
          // other_categoria: true, // Remova se não existir
          Produto: {
            select: {
              id: true,
              nome: true,
              foto: true,
              // ativo: true // Comente se não existir
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
          // categoria: true, // Remova se não existir
          // other_categoria: true, // Remova se não existir
          Produto: true
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

      // Se slug não for um campo no seu schema, remova esta função
      // ou substitua por busca por outro campo (nome, por exemplo)
      const categoria = await prisma.categoria.findFirst({
        where: {
          // slug: slug // Substitua por campo correto
          nome: slug // Exemplo alternativo
        },
        include: {
          // categoria: true,
          // other_categoria: true,
          Produto: {
            // where: { ativo: true }, // Remova se ativo não existir
            select: {
              id: true,
              nome: true,
              preco: true,
              ImagemProduto: {
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
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const { nome, descricao } = request.body;

      const categoria = await prisma.categoria.create({
        data: {
          // id: `cat_${Date.now()}`, // Remova se usar UUID automático
          nome,
          descricao,
          // slug, // Apenas se o campo existir
          // paiId // Apenas se o campo existir
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
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;
      const { dados } = request.body as any;
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


      // Verificar loop hierárquico (se paiId existir)
      const verificarLoop = async (categoriaId: string): Promise<boolean> => {
        const pai = await prisma.categoria.findUnique({
          where: { id },
        });

        if (!pai || !(pai as any).paiId) return false;
        if ((pai as any).paiId === categoriaId) return true;
        return verificarLoop(categoriaId);
      };

      if (await verificarLoop(id)) {
        return reply.status(400).send({
          success: false,
          message: 'Criação de loop hierárquico não permitida'
        });
      }

      const categoria = await prisma.categoria.update({
        where: { id },
        data: {
          ...dados,
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
          // other_categoria: true, // Remova se não existir
          Produto: true
        }
      });

      if (!categoria) {
        return reply.status(404).send({
          success: false,
          message: 'Categoria não encontrada'
        });
      }

      // Verificar se tem subcategorias (se other_categoria existir)
      // if (categoria.other_categoria.length > 0) {
      //   return reply.status(400).send({
      //     success: false,
      //     message: 'Não é possível deletar categoria que possui subcategorias'
      //   });
      // }

      // Verificar se tem produtos associados
      if (categoria.Produto.length > 0) {
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
        where: { /* paiId: null */ }, // Ajuste conforme campo real
        include: {
          // other_categoria: { // Remova se não existir
          //   include: {
          //     other_categoria: true
          //   }
          // }
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