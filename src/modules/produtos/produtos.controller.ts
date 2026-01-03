// src/modules/produtos/produtos.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';

export class ProdutosController {
  async listarProdutos(
    request: FastifyRequest<{
      Querystring: {
        page?: string;
        limit?: string;
        busca?: string;
        categoria?: string;
        status?: string;
        ordenar?: string;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const {
        page = '1',
        limit = '10',
        busca = '',
        categoria = '',
        status = '',
        ordenar = 'criadoEm_desc'
      } = request.query;

      const pagina = parseInt(page);
      const limite = parseInt(limit);
      const skip = (pagina - 1) * limite;

      // Construir filtro
      const where: any = {};

      if (busca) {
        where.OR = [
          { nome: { contains: busca, mode: 'insensitive' } },
          { descricao: { contains: busca, mode: 'insensitive' } },
          { sku: { contains: busca, mode: 'insensitive' } }
        ];
      }

      if (categoria) {
        where.categoriaId = categoria;
      }

      if (status) {
        if (status === 'ativo') where.ativo = true;
        if (status === 'inativo') where.ativo = false;
        if (status === 'baixo_estoque') where.estoque = { lte: 10, gt: 0 };
        if (status === 'sem_estoque') where.estoque = 0;
      }

      // Construir ordenação
      let orderBy: any = {};
      if (ordenar === 'nome_asc') orderBy = { nome: 'asc' };
      else if (ordenar === 'nome_desc') orderBy = { nome: 'desc' };
      else if (ordenar === 'preco_asc') orderBy = { preco: 'asc' };
      else if (ordenar === 'preco_desc') orderBy = { preco: 'desc' };
      else if (ordenar === 'criadoEm_asc') orderBy = { criadoEm: 'asc' };
      else orderBy = { criadoEm: 'desc' };

      // Buscar produtos com contagem total
      const [produtos, total] = await Promise.all([
        prisma.produto.findMany({
          where,
          include: {
            categoria: {
              select: {
                id: true,
                nome: true,
                slug: true
              }
            },
            imagemproduto: {
              where: { principal: true },
              take: 1
            }
          },
          orderBy,
          skip,
          take: limite
        }),
        prisma.produto.count({ where })
      ]);

      // Buscar estatísticas básicas
      const totalProdutos = await prisma.produto.count();
      const totalAtivos = await prisma.produto.count({ where: { ativo: true } });
      const totalEmPromocao = await prisma.produto.count({ where: { precoDesconto: { not: null } } });
      const baixoEstoque = await prisma.produto.count({ where: { estoque: { lte: 10, gt: 0 } } });
      const totalCategorias = await prisma.categoria.count();

      // Formatar resposta
      const produtosFormatados = produtos.map(produto => ({
        id: produto.id,
        nome: produto.nome,
        descricao: produto.descricao || '',
        preco: produto.preco,
        precoDesconto: produto.precoDesconto,
        percentualDesconto: produto.percentualDesconto,
        descontoAte: produto.descontoAte ? produto.descontoAte.toISOString() : null,
        estoque: produto.estoque,
        sku: produto.sku,
        ativo: produto.ativo,
        emDestaque: produto.emDestaque,
        criadoEm: produto.criadoEm.toISOString(),
        categoria: produto.categoria[0]?.nome || 'Sem categoria',
        categoriaId: produto.categoria[0]?.id || null,
        imagem: produto.imagemproduto[0]?.url || null,
        imagemAlt: produto.imagemproduto[0]?.textoAlt || produto.nome,
        status: this.determinarStatus(produto.ativo, produto.estoque)
      }));

      reply.send({
        success: true,
        data: {
          produtos: produtosFormatados,
          paginacao: {
            total,
            page: pagina,
            limit: limite,
            totalPages: Math.ceil(total / limite)
          },
          estatisticas: {
            totalProdutos,
            totalAtivos,
            totalEmPromocao,
            baixoEstoque,
            totalCategorias
          },
          filtros: {
            busca,
            categoria,
            status,
            ordenar
          }
        }
      });
    } catch (error) {
      console.error('Erro ao listar produtos:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao listar produtos'
      });
    }
  }

  async buscarProdutoPorId(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      const produto = await prisma.produto.findUnique({
        where: { id },
        include: {
          categoria: true,
          imagemproduto: true,
        }
      });

      if (!produto) {
        return reply.status(404).send({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      reply.send({
        success: true,
        data: produto
      });
    } catch (error) {
      console.error('Erro ao buscar produto:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao buscar produto'
      });
    }
  }

  async criarProduto(
    request: FastifyRequest<{
      Body: {
        nome: string;
        descricao: string;
        preco: number;
        precoDesconto?: number;
        percentualDesconto?: number;
        descontoAte?: string;
        estoque: number;
        sku: string;
        categoriaId?: string;
        ativo?: boolean;
        emDestaque?: boolean;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const dados = request.body;

      // Verificar se SKU já existe
      const skuExistente = await prisma.produto.findUnique({
        where: { sku: dados.sku }
      });

      if (skuExistente) {
        return reply.status(400).send({
          success: false,
          message: 'SKU já está em uso'
        });
      }

      // Calcular percentual de desconto se não fornecido
      let percentualDesconto = dados.percentualDesconto;
      if (dados.precoDesconto && !percentualDesconto) {
        percentualDesconto = ((dados.preco - dados.precoDesconto) / dados.preco) * 100;
      }

      // Criar produto
      const produto = await prisma.produto.create({
        data: {
          id: `prod_${Date.now()}`,
          nome: dados.nome,
          descricao: dados.descricao,
          preco: dados.preco,
          precoDesconto: dados.precoDesconto,
          percentualDesconto: percentualDesconto ? parseFloat(percentualDesconto.toFixed(2)) : null,
          descontoAte: dados.descontoAte ? new Date(dados.descontoAte) : null,
          estoque: dados.estoque,
          sku: dados.sku,
          ativo: dados.ativo ?? true,
          emDestaque: dados.emDestaque ?? false
        }
      });

      reply.status(201).send({
        success: true,
        message: 'Produto criado com sucesso',
        data: produto
      });
    } catch (error) {
      console.error('Erro ao criar produto:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao criar produto'
      });
    }
  }

  async atualizarProduto(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        nome?: string;
        descricao?: string;
        preco?: number;
        precoDesconto?: number | null;
        percentualDesconto?: number | null;
        descontoAte?: string | null;
        estoque?: number;
        sku?: string;
        categoriaId?: string | null;
        ativo?: boolean;
        emDestaque?: boolean;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;
      const dados = request.body;

      // Verificar se produto existe
      const produtoExistente = await prisma.produto.findUnique({
        where: { id }
      });

      if (!produtoExistente) {
        return reply.status(404).send({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      // Verificar se novo SKU já existe (se for alterado)
      if (dados.sku && dados.sku !== produtoExistente.sku) {
        const skuExistente = await prisma.produto.findUnique({
          where: { sku: dados.sku }
        });

        if (skuExistente) {
          return reply.status(400).send({
            success: false,
            message: 'SKU já está em uso'
          });
        }
      }

      // Calcular percentual de desconto se alterado
      let percentualDesconto = dados.percentualDesconto;
      if (dados.precoDesconto !== undefined && !percentualDesconto && dados.precoDesconto !== null) {
        const precoBase = dados.preco || produtoExistente.preco;
        percentualDesconto = ((precoBase - dados.precoDesconto) / precoBase) * 100;
      }

      const produtoAtualizado = await prisma.produto.update({
        where: { id },
        data: {
          ...dados,
          percentualDesconto: percentualDesconto ? parseFloat(percentualDesconto.toFixed(2)) : null,
          descontoAte: dados.descontoAte ? new Date(dados.descontoAte) : null,
          atualizadoEm: new Date()
        }
      });

      reply.send({
        success: true,
        message: 'Produto atualizado com sucesso',
        data: produtoAtualizado
      });
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao atualizar produto'
      });
    }
  }

  async deletarProduto(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      // Verificar se produto existe
      const produto = await prisma.produto.findUnique({
        where: { id }
      });

      if (!produto) {
        return reply.status(404).send({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      await prisma.produto.delete({
        where: { id }
      });

      reply.send({
        success: true,
        message: 'Produto deletado com sucesso'
      });
    } catch (error) {
      console.error('Erro ao deletar produto:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao deletar produto'
      });
    }
  }

  async getEstatisticasProdutos(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Buscar todas as estatísticas em paralelo
      const [
        totalProdutos,
        totalAtivos,
        totalInativos,
        totalEmPromocao,
        baixoEstoque,
        semEstoque,
        totalCategorias
      ] = await Promise.all([
        prisma.produto.count(),
        prisma.produto.count({ where: { ativo: true } }),
        prisma.produto.count({ where: { ativo: false } }),
        prisma.produto.count({ where: { precoDesconto: { not: null } } }),
        prisma.produto.count({ where: { estoque: { lte: 10, gt: 0 } } }),
        prisma.produto.count({ where: { estoque: 0 } }),
        prisma.categoria.count()
      ]);

      reply.send({
        success: true,
        data: {
          totalProdutos,
          totalAtivos,
          totalInativos,
          totalEmPromocao,
          baixoEstoque,
          semEstoque,
          totalVendidos: 0, // Para simplificar por enquanto
          produtosMaisVendidos: [], // Para simplificar por enquanto
          totalCategorias
        }
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao buscar estatísticas'
      });
    }
  }

  private determinarStatus(ativo: boolean, estoque: number): string {
    if (!ativo) return 'inativo';
    if (estoque === 0) return 'sem_estoque';
    if (estoque <= 10) return 'baixo_estoque';
    return 'ativo';
  }
}