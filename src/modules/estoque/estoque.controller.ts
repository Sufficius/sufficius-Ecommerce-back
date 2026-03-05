// src/modules/estoque/estoque.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getProductImageUrl, FALLBACK_PRODUCT_IMAGE } from '../../utils/cloudinary';

// Interfaces
interface EstoqueInput {
  nome?: string;
  preco?: string | number;
  quantidade?: string | number;
  descricao?: string;
  id_categoria?: string;
  status?: string;
  foto?: string;
  deletarImagem?: string;
}

interface PaginationQuery {
  page?: string;
  limit?: string;
  busca?: string;
  categoria?: string;
  status?: string;
  ordenar?: string;
}

interface SavedFile {
  filename: string;
  filepath: string;
  mimetype: string;
  size: number;
  id?: string;
  cloudinaryUrl?: string;
}

// Configurar diretório de uploads temporários
const getUploadDir = () => {
  if (process.env.RENDER) {
    return '/opt/render/project/src/uploads/estoque';
  }
  return path.join(process.cwd(), 'uploads', 'estoque');
};

const TEMP_UPLOAD_DIR = getUploadDir();

// Criar diretório temporário se não existir
if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
  fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
}

// Função para salvar arquivo temporariamente e enviar para Cloudinary
async function saveAndUploadToCloudinary(file: any, estoqueId: string): Promise<SavedFile> {
  try {
    console.log('💾 Processando imagem para Cloudinary...');

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const originalName = file.filename || 'imagem';
    const extension = path.extname(originalName) || '.jpg';
    const tempFilename = `${estoqueId}-${timestamp}-${randomStr}${extension}`;
    const tempFilepath = path.join(TEMP_UPLOAD_DIR, tempFilename);

    // Salvar arquivo temporariamente
    const writeStream = fs.createWriteStream(tempFilepath);
    await pipeline(file.file, writeStream);

    // Fazer upload para Cloudinary
    const cloudinaryResult = await getUploadDir(); // Ajuste conforme sua implementação

    // Limpar arquivo temporário
    try {
      fs.unlinkSync(tempFilepath);
    } catch (cleanupError) {
      console.warn('⚠️  Não foi possível remover arquivo temporário:', cleanupError);
    }

    return {
      filename: originalName,
      filepath: tempFilepath,
      mimetype: file.mimetype || 'image/jpeg',
      size: Number(cloudinaryResult),
      id: cloudinaryResult.toString(),
      cloudinaryUrl: cloudinaryResult
    };

  } catch (error: any) {
    console.error('❌ Erro ao processar imagem:', error.message);
    throw error;
  }
}

function buildImageUrlFromFoto(foto?: string | null): string | null {
  console.log('🖼️ Construindo URL a partir do campo foto:', foto);
  if (!foto) {
    return FALLBACK_PRODUCT_IMAGE;
  }
  if (foto.startsWith('http')) {
    return foto;
  }

  if (foto.includes('estoque_')) {
    return getProductImageUrl(foto, {
      width: 600,
      height: 600,
      quality: 'auto:good',
      crop: 'fill'
    });
  }

  return FALLBACK_PRODUCT_IMAGE;
}

// Função para deletar imagem do Cloudinary
async function deleteFromCloudinary(id: string): Promise<void> {
  try {
    if (!id || id.startsWith('simulated_')) {
      return;
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'sufficius-commerce';
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.warn('⚠️  Credenciais do Cloudinary não configuradas. Não foi possível deletar imagem.');
      return;
    }

    const timestamp = Math.round(Date.now() / 1000);
    const signature = require('crypto')
      .createHash('sha1')
      .update(`public_id=${id}&timestamp=${timestamp}${apiSecret}`)
      .digest('hex');

    const formData = new FormData();
    formData.append('public_id', id);
    formData.append('timestamp', timestamp.toString());
    formData.append('api_key', apiKey);
    formData.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      console.warn(`⚠️  Falha ao deletar imagem ${id} do Cloudinary`);
    } else {
      console.log(`✅ Imagem ${id} deletada do Cloudinary`);
    }

  } catch (error: any) {
    console.error(`⚠️  Erro ao deletar imagem do Cloudinary:`, error.message);
  }
}

// Função para deletar arquivos temporários
async function deleteTempFiles(estoqueId: string): Promise<number> {
  try {
    const files = fs.readdirSync(TEMP_UPLOAD_DIR);
    const estoqueFiles = files.filter(file => file.includes(estoqueId));

    let deletedCount = 0;

    for (const file of estoqueFiles) {
      try {
        const filepath = path.join(TEMP_UPLOAD_DIR, file);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
          deletedCount++;
          console.log(`🗑️  Arquivo temporário deletado: ${file}`);
        }
      } catch (error) {
        console.error(`⚠️ Erro ao deletar arquivo temporário ${file}:`, error);
      }
    }

    return deletedCount;
  } catch (error) {
    console.error('⚠️ Erro ao deletar arquivos temporários:', error);
    return 0;
  }
}

// Função para validar dados do estoque
function validateEstoqueData(data: any): {
  isValid: boolean;
  errors: string[];
  validated: {
    nome?: string;
    preco?: number;
    quantidade?: number;
    descricao?: string;
    id_categoria?: string;
    status?: 'ATIVO' | 'INATIVO';
    foto?: string;
  }
} {
  const errors: string[] = [];
  const validated: any = {};

  const { nome, preco, quantidade, id_categoria, descricao, status } = data as any;

  // Validar nome
  if (!nome || String(nome).trim().length === 0) {
    errors.push('Nome do item de estoque é obrigatório');
  } else {
    validated.nome = String(nome).trim();
  }

  // Validar preço
  if (preco === undefined || preco === '') {
    errors.push('Preço do item é obrigatório');
  } else {
    if (isNaN(preco) || preco < 0) {
      errors.push('Preço inválido');
    } else {
      validated.preco = parseFloat(preco);
    }
  }

  // Validar quantidade
  if (quantidade === undefined || quantidade === '') {
    errors.push('Quantidade é obrigatória');
  } else {
    if (isNaN(quantidade) || quantidade < 0) {
      errors.push('Quantidade inválida');
    } else {
      validated.quantidade = parseInt(quantidade);
    }
  }

  // Validar categoria
  if (!id_categoria || String(id_categoria).trim().length === 0) {
    errors.push('Categoria é obrigatória');
  } else {
    validated.id_categoria = String(id_categoria).trim();
  }

  // Descrição (opcional)
  if (descricao) {
    validated.descricao = String(descricao).trim();
  }

  // Status
  validated.status = (status === 'ATIVO' || status === 'INATIVO')
    ? status
    : 'ATIVO';

  return {
    isValid: errors.length === 0,
    errors,
    validated
  };
}

export class EstoqueController {

  // Listar todos os itens de estoque (versão simples)
  async getEstoque(request: FastifyRequest, reply: FastifyReply) {
    try {
      const estoque = await prisma.estoque.findMany({
        select: {
          id: true,
          nome: true,
          preco: true,
          quantidade: true,
          status: true,
          atualizadoEm: true,
          criadoEm: true,
          Categoria: {
            select: {
              id: true,
              nome: true
            }
          },
          foto: true,
        },
        orderBy: { criadoEm: 'desc' },
      });

      reply.send({
        success: true,
        data: estoque,
        total: estoque.length
      });
    } catch (error) {
      console.error('❌ Erro ao listar estoque:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao listar estoque'
      });
    }
  }

  // Listar itens de estoque com filtros
  async listarEstoque(
    request: FastifyRequest<{ Querystring: PaginationQuery }>,
    reply: FastifyReply
  ) {
    try {
      const { page = '1', limit = '10', busca = '',
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
          { descricao: { contains: busca, mode: 'insensitive' } }
        ];
      }

      if (categoria) {
        where.id_categoria = categoria;
      }

      if (status) {
        if (status === 'ATIVO') where.status = 'ATIVO';
        else if (status === 'INATIVO') where.status = 'INATIVO';
        else if (status === 'baixo_estoque') where.quantidade = { lte: 10, gt: 0 };
        else if (status === 'sem_estoque') where.quantidade = 0;
      }

      // Construir ordenação
      const orderMap: Record<string, any> = {
        'nome_asc': { nome: 'asc' },
        'nome_desc': { nome: 'desc' },
        'preco_asc': { preco: 'asc' },
        'preco_desc': { preco: 'desc' },
        'quantidade_asc': { quantidade: 'asc' },
        'quantidade_desc': { quantidade: 'desc' },
        'criadoEm_asc': { criadoEm: 'asc' },
        'criadoEm_desc': { criadoEm: 'desc' }
      };

      const orderBy = orderMap[ordenar] || { criadoEm: 'desc' };

      const [estoque, total] = await Promise.all([
        prisma.estoque.findMany({
          where: where,
          select: {
            id: true,
            nome: true,
            preco: true,
            quantidade: true,
            status: true,
            atualizadoEm: true,
            foto: true,
            criadoEm: true,
            Categoria: {
              select: {
                id: true,
                nome: true
              }
            },
            ImagemProduto: {
              select: {
                id: true,
                url: true,
                principal: true,
              }
            }
          },
          skip,
          take: limite,
          orderBy,
        }),
        prisma.estoque.count({ where: where })
      ]);

      reply.send({
        success: true,
        data: estoque.map(item => ({
          id: item.id,
          nome: item.nome,
          preco: item.preco,
          quantidade: item.quantidade,
          status: item.status,
          atualizadoEm: item.atualizadoEm.toISOString(),
          criadoEm: item.criadoEm.toISOString(),
          Categoria: item.Categoria,
          ImagemProduto: item.ImagemProduto,
          foto: item.foto,
          imagemUrl: buildImageUrlFromFoto(item.foto)
        })),
        paginacao: {
          page: pagina,
          limit: limite,
          total,
          totalPages: Math.ceil(total / limite)
        },
        filtros: {
          busca,
          categoria,
          status,
          ordenar
        }
      });
    } catch (error) {
      console.error('❌ Erro ao listar estoque:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao listar estoque'
      });
    }
  }

  // Buscar item de estoque por ID
  async buscarEstoquePorId(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      const item = await prisma.estoque.findUnique({
        where: { id },
        include: {
          Categoria: true,
          ImagemProduto: true,
        }
      });

      if (!item) {
        return reply.status(404).send({
          success: false,
          message: 'Item de estoque não encontrado'
        });
      }

      // Construir URLs do Cloudinary para as imagens
      const itemComImagens = {
        ...item,
        imagemUrl: buildImageUrlFromFoto(item.foto),
        cloudinaryId: item.foto
      };

      reply.send({
        success: true,
        data: itemComImagens
      });
    } catch (error) {
      console.error('Erro ao buscar item de estoque:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao buscar item de estoque'
      });
    }
  }

  // Criar item de estoque
  async criarEstoque(request: FastifyRequest, reply: FastifyReply) {
    try {
      console.log('📦 Criando novo item de estoque...');
      
      // Verificar autenticação
      try {
        await request.jwtVerify();
        const user = request.user as any;

        if (user.tipo !== 'ADMIN') {
          return reply.status(403).send({
            success: false,
            message: 'Acesso negado. Apenas administradores podem criar itens de estoque.'
          });
        }
      } catch (err) {
        return reply.status(401).send({
          success: false,
          message: 'Não autorizado. Token inválido ou expirado.'
        });
      }

      const dados = request.body as any;

      console.log('🔄 Processando dados...');
      console.log('📊 Dados recebidos:', { 
        nome: dados.nome, 
        preco: dados.preco, 
        quantidade: dados.quantidade 
      });

      // Validar dados
      const validation = validateEstoqueData(dados);
      if (!validation.isValid) {
        return reply.status(400).send({
          success: false,
          message: 'Dados inválidos',
          errors: validation.errors
        });
      }

      // Verificar se categoria existe
      const categoriaExistente = await prisma.categoria.findUnique({
        where: { id: dados.id_categoria }
      });

      if (!categoriaExistente) {
        return reply.status(400).send({
          success: false,
          message: 'Categoria não encontrada'
        });
      }

      // Gerar ID
      const estoqueId = randomUUID();

      console.log('💾 Criando item de estoque no banco de dados...');

      // Criar item no banco
      const item = await prisma.estoque.create({
        data: {
          id: estoqueId,
          nome: dados.nome!,
          descricao: dados.descricao,
          preco: parseFloat(dados.preco!),
          quantidade: parseInt(dados.quantidade!),
          foto: null,
          status: "ATIVO",
          id_categoria: dados.id_categoria!,
        }
      });
      console.log(`✅ Item criado no banco: ${item.id}`);

      // Buscar item criado com relações
      const itemCriado = await prisma.estoque.findUnique({
        where: { id: item.id },
        include: {
          Categoria: {
            select: {
              id: true,
              nome: true
            }
          }
        }
      });

      const response = {
        id: itemCriado?.id,
        nome: itemCriado?.nome,
        descricao: itemCriado?.descricao,
        preco: itemCriado?.preco,
        quantidade: itemCriado?.quantidade,
        status: itemCriado?.status,
        foto: itemCriado?.foto,
        categoria: itemCriado?.Categoria?.nome || null,
        categoriaId: itemCriado?.Categoria?.id || null,
        imagemUrl: buildImageUrlFromFoto(itemCriado?.foto),
        criadoEm: itemCriado?.criadoEm?.toISOString()
      };

      return reply.status(201).send({
        success: true,
        message: 'Item de estoque criado com sucesso',
        data: response
      });

    } catch (error: any) {
      console.error('❌ ERRO CRÍTICO ao criar item de estoque:', error);
      console.error('Stack trace:', error.stack);

      if (error.code === 'P2003') {
        return reply.status(400).send({
          success: false,
          message: 'Categoria não existe'
        });
      }

      return reply.status(500).send({
        success: false,
        message: 'Erro interno ao criar item de estoque',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Contate o administrador'
      });
    }
  }

  // Atualizar item de estoque
  async atualizarEstoque(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      // Verificar se item existe
      const itemExistente = await prisma.estoque.findUnique({
        where: { id },
      });

      if (!itemExistente) {
        return reply.status(404).send({
          success: false,
          message: 'Item de estoque não encontrado'
        });
      }

      const dados = request.body as EstoqueInput;

      // Preparar dados para atualização
      const updateData: any = {
        nome: dados.nome || itemExistente.nome,
        descricao: dados.descricao !== undefined ? dados.descricao : itemExistente.descricao,
        preco: dados.preco !== undefined ? parseFloat(String(dados.preco)) : itemExistente.preco,
        quantidade: dados.quantidade !== undefined ? parseInt(String(dados.quantidade)) : itemExistente.quantidade,
        status: dados.status || itemExistente.status,
        atualizadoEm: new Date()
      };

      // Atualizar categoria se fornecida
      if (dados.id_categoria !== undefined) {
        if (dados.id_categoria) {
          const categoria = await prisma.categoria.findUnique({
            where: { id: dados.id_categoria }
          });

          if (!categoria) {
            return reply.status(400).send({
              success: false,
              message: 'Categoria não encontrada'
            });
          }

          updateData.id_categoria = dados.id_categoria;
        } else {
          updateData.id_categoria = null;
        }
      }

      // Atualizar item
      await prisma.estoque.update({
        where: { id },
        data: updateData
      });

      // Gerenciar imagem
      if (dados.deletarImagem === 'true' && itemExistente.foto) {
        await deleteFromCloudinary(itemExistente.foto);
        updateData.foto = null;
      }

      const itemAtualizado = await prisma.estoque.update({
        where: { id },
        data: updateData,
        include: {
          Categoria: true
        }
      });

      // Construir URL da imagem
      const itemFormatado = {
        ...itemAtualizado,
        imagemUrl: buildImageUrlFromFoto(itemAtualizado.foto)
      };

      reply.send({
        success: true,
        message: 'Item de estoque atualizado com sucesso',
        data: itemFormatado
      });

    } catch (error: any) {
      console.error('❌ Erro ao atualizar item de estoque:', error);

      if (error.code === 'P2003') {
        return reply.status(400).send({
          success: false,
          message: 'Categoria não existe'
        });
      }

      reply.status(500).send({
        success: false,
        message: 'Erro interno ao atualizar item de estoque'
      });
    }
  }

  // Deletar item de estoque
  async deletarEstoque(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      // Verificar se item existe
      const item = await prisma.estoque.findUnique({
        where: { id },
        include: {
          ImagemProduto: true
        }
      });

      if (!item) {
        return reply.status(404).send({
          success: false,
          message: 'Item de estoque não encontrado'
        });
      }

      // Deletar imagem do Cloudinary se existir
      if (item.foto) {
        await deleteFromCloudinary(item.foto);
      }

      // Deletar imagens associadas do Cloudinary
      for (const imagem of item.ImagemProduto) {
        if (imagem.id) {
          await deleteFromCloudinary(imagem.id);
        }
      }

      // Deletar arquivos temporários
      await deleteTempFiles(id);

      // Deletar registros de imagens no banco
      await prisma.imagemProduto.deleteMany({
        where: { produtoId: id }
      });

      // Deletar item
      await prisma.estoque.delete({
        where: { id }
      });

      reply.send({
        success: true,
        message: 'Item de estoque deletado com sucesso',
        data: {
          itemId: id,
          nome: item.nome,
        }
      });

    } catch (error: any) {
      console.error('❌ Erro ao deletar item de estoque:', error);

      if (error.code === 'P2025') {
        return reply.status(404).send({
          success: false,
          message: 'Item de estoque não encontrado'
        });
      }

      reply.status(500).send({
        success: false,
        message: 'Erro interno ao deletar item de estoque',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Estatísticas do estoque
  async getEstatisticasEstoque(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Buscar todas as estatísticas em paralelo
      const [
        totalItens,
        totalAtivos,
        totalInativos,
        baixoEstoque,
        semEstoque,
        valorTotalEstoque
      ] = await Promise.all([
        prisma.estoque.count(),
        prisma.estoque.count({ where: { status: 'ATIVO' } }),
        prisma.estoque.count({ where: { status: 'INATIVO' } }),
        prisma.estoque.count({ where: { quantidade: { lte: 10, gt: 0 } } }),
        prisma.estoque.count({ where: { quantidade: 0 } }),
        prisma.estoque.aggregate({
          where: { status: 'ATIVO' },
          _sum: {
            preco: true,
            quantidade: true
          }
        })
      ]);

      // Calcular valor total em estoque (preço * quantidade)
      const itensComValor = await prisma.estoque.findMany({
        where: { status: 'ATIVO' },
        select: {
          preco: true,
          quantidade: true
        }
      });

      const valorTotal = itensComValor.reduce((total, item) => {
        return total + (item.preco * item.quantidade);
      }, 0);

      // Buscar itens com baixo estoque
      const itensBaixoEstoque = await prisma.estoque.findMany({
        where: { 
          quantidade: { lte: 10, gt: 0 },
          status: 'ATIVO'
        },
        select: {
          id: true,
          nome: true,
          quantidade: true,
          preco: true,
          foto: true
        },
        orderBy: { quantidade: 'asc' },
        take: 10
      });

      reply.send({
        success: true,
        data: {
          totalItens,
          totalAtivos,
          totalInativos,
          baixoEstoque,
          semEstoque,
          valorTotalEstoque: valorTotal,
          itensBaixoEstoque: itensBaixoEstoque.map(item => ({
            ...item,
            imagemUrl: buildImageUrlFromFoto(item.foto)
          })),
          resumo: {
            itensPorStatus: {
              ativos: totalAtivos,
              inativos: totalInativos,
              baixoEstoque,
              semEstoque
            },
            porcentagemAtivos: totalItens > 0 ? Math.round((totalAtivos / totalItens) * 100) : 0,
            valorMedioPorItem: totalAtivos > 0 ? valorTotal / totalAtivos : 0
          }
        }
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas do estoque:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao buscar estatísticas'
      });
    }
  }

  // Deletar múltiplos itens de estoque
  async deletarMultiplosItens(
    request: FastifyRequest<{ Body: { ids: string[] } }>,
    reply: FastifyReply
  ) {
    try {
      const { ids } = request.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'Nenhum ID fornecido'
        });
      }

      // Verificar quais itens existem
      const itens = await prisma.estoque.findMany({
        where: { id: { in: ids } },
        include: { ImagemProduto: true }
      });

      const itensEncontrados = itens.map(item => item.id);
      const itensNaoEncontrados = ids.filter(id => !itensEncontrados.includes(id));

      // Deletar imagens do Cloudinary
      let totalCloudinaryDeletadas = 0;
      for (const item of itens) {
        if (item.foto) {
          await deleteFromCloudinary(item.foto);
          totalCloudinaryDeletadas++;
        }
        
        for (const imagem of item.ImagemProduto) {
          if (imagem.id) {
            await deleteFromCloudinary(imagem.id);
            totalCloudinaryDeletadas++;
          }
        }

        // Deletar arquivos temporários
        await deleteTempFiles(item.id);

        // Deletar registros do banco
        await prisma.imagemProduto.deleteMany({
          where: { produtoId: item.id }
        });
      }

      // Deletar itens
      const result = await prisma.estoque.deleteMany({
        where: { id: { in: itensEncontrados } }
      });

      const response: any = {
        success: true,
        message: `${result.count} item(ns) deletado(s) com sucesso`,
        data: {
          deletados: result.count,
          imagensCloudinaryDeletadas: totalCloudinaryDeletadas,
          itensNaoEncontrados
        }
      };

      if (itensNaoEncontrados.length > 0) {
        response.warning = `Alguns itens não foram encontrados: ${itensNaoEncontrados.join(', ')}`;
      }

      reply.send(response);

    } catch (error: any) {
      console.error('❌ Erro ao deletar múltiplos itens:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro interno ao deletar itens'
      });
    }
  }
}