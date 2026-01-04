// src/modules/produtos/produtos.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// Configurar upload de arquivos
const uploadDir = path.join(process.cwd(), 'uploads');

// Criar diretório se não existir
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Função auxiliar para salvar arquivo
async function saveFile(file: any, produtoId: string) {
  const filename = `${produtoId}-${randomUUID()}${path.extname(file.filename)}`;
  const filepath = path.join(uploadDir, filename);
  
  await pipeline(file.file, fs.createWriteStream(filepath));
  
  return {
    filename,
    filepath,
    url: `/uploads/${filename}`
  };
}

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
        where.categoria = {
          some: {
            id: categoria
          }
        };
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
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      console.log('📦 Recebendo requisição para criar produto...');
      
      // Verificar se é multipart/form-data
      const isMultipart = request.headers['content-type']?.includes('multipart/form-data');
      
      let dados: any = {};
      let imagemFile: any = null;
      
      if (isMultipart) {
        const parts = request.parts();
        for await (const part of parts) {
          if (part.type === 'file') {
            imagemFile = part;
          } else {
            // Converter strings booleanas para boolean
            if (part.fieldname === 'ativo' || part.fieldname === 'emDestaque') {
              dados[part.fieldname] = part.value === 'true' || part.value === '1';
            } else {
              dados[part.fieldname] = part.value;
            }
          }
        }
      } else {
        dados = request.body as any;
      }
      
      console.log('📄 Dados recebidos:', dados);
      console.log('📁 Imagem recebida:', imagemFile ? 'Sim' : 'Não');

      // Validações obrigatórias
      if (!dados.nome || !dados.sku || !dados.preco || dados.estoque === undefined) {
        return reply.status(400).send({
          success: false,
          message: 'Campos obrigatórios faltando: nome, sku, preco, estoque'
        });
      }

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

      // Verificar se categoria existe (se fornecida)
      if (dados.categoriaId) {
        const categoria = await prisma.categoria.findUnique({
          where: { id: dados.categoriaId }
        });

        if (!categoria) {
          return reply.status(400).send({
            success: false,
            message: 'Categoria não encontrada'
          });
        }
      }

      // Calcular percentual de desconto se não fornecido
      let percentualDesconto = dados.percentualDesconto;
      if (dados.precoDesconto && !percentualDesconto) {
        percentualDesconto = ((parseFloat(dados.preco) - parseFloat(dados.precoDesconto)) / parseFloat(dados.preco)) * 100;
      }

      // Preparar dados para criação
      const produtoData: any = {
        id: `prod_${Date.now()}_${randomUUID().substring(0, 8)}`,
        nome: dados.nome,
        descricao: dados.descricao || null,
        preco: parseFloat(dados.preco),
        precoDesconto: dados.precoDesconto ? parseFloat(dados.precoDesconto) : null,
        percentualDesconto: percentualDesconto ? parseFloat(percentualDesconto.toFixed(2)) : null,
        estoque: parseInt(dados.estoque),
        sku: dados.sku,
        ativo: dados.ativo !== undefined ? dados.ativo : true,
        emDestaque: dados.emDestaque !== undefined ? dados.emDestaque : false
      };

      // Adicionar relação com categoria se fornecida
      if (dados.categoriaId) {
        produtoData.categoria = {
          connect: [{ id: dados.categoriaId }]
        };
      }

      console.log('📊 Dados processados:', produtoData);

      // Criar produto
      const produto = await prisma.produto.create({
        data: produtoData
      });

      // Lidar com upload de imagem
      if (imagemFile) {
        try {
          const savedFile = await saveFile(imagemFile, produto.id);
          
          await prisma.imagemproduto.create({
            data: {
              id: randomUUID(),
              produtoId: produto.id,
              url: savedFile.url,
              textoAlt: dados.nome,
              principal: true
            }
          });
          
          console.log('✅ Imagem salva:', savedFile.url);
        } catch (imageError) {
          console.error('⚠️ Erro ao salvar imagem:', imageError);
          // Não falhar o produto se a imagem falhar
        }
      }

      // Buscar produto criado com relações
      const produtoCriado = await prisma.produto.findUnique({
        where: { id: produto.id },
        include: {
          categoria: true,
          imagemproduto: true
        }
      });

      console.log('✅ Produto criado com sucesso:', produto.id);

      reply.status(201).send({
        success: true,
        message: 'Produto criado com sucesso',
        data: produtoCriado
      });

    } catch (error: any) {
      console.error('❌ Erro ao criar produto:', error);
      
      // Erros específicos do Prisma
      if (error.code === 'P2002') {
        return reply.status(400).send({
          success: false,
          message: 'SKU já está em uso'
        });
      }
      
      reply.status(500).send({
        success: false,
        message: 'Erro interno ao criar produto',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
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