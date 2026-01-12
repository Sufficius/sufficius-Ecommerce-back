// src/modules/produtos/produtos.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {v2 as  cloudinary} from "cloudinary";


cloudinary.config({
  cloud_name:process.env.CLOUDINARY_CLOUD_NAME,
  api_key:process.env.CLOUDINARY_API_KEY,
  api_secret:process.env.CLOUDINARY_API_SECRET,
  secure:true,
})

// Função para fazer upload e retornar APENAS public_id
async function uploadToCloudinary(file: any, produtoId: string): Promise<{
  public_id: string;
  secure_url: string;
}> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'sufficius/produtos',
        public_id: `${produtoId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        resource_type: 'auto',
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto:good' }
        ]
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            public_id: result.public_id,
            secure_url: result.secure_url
          });
        } else {
          reject(new Error('Upload sem resultado'));
        }
      }
    );

    file.file.pipe(uploadStream);
  });
}


function buildCloudinaryUrl(publicId: string, options: any = {}): string {
  const defaultOptions = {
    width: 600,
    height: 600,
    crop: 'fill',
    quality: 'auto:good'
  };

   const transformOptions = { ...defaultOptions, ...options };
  const transformations = Object.entries(transformOptions)
    .map(([key, value]) => `${key}_${value}`)
    .join(',');

  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${transformations}/${publicId}`;
}




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

// Função auxiliar para deletar arquivos físicos
async function deleteProductFiles(produtoId: string) {
  try {
    // Buscar todas as imagens do produto
    const imagens = await prisma.imagemproduto.findMany({
      where: { produtoId }
    });

    // Deletar arquivos físicos
    for (const imagem of imagens) {
      const filepath = path.join(uploadDir, path.basename(imagem.url));
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        console.log(`🗑️  Arquivo deletado: ${filepath}`);
      }
    }

    return imagens.length;
  } catch (error) {
    console.error('⚠️  Erro ao deletar arquivos físicos:', error);
    return 0;
  }
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

         // Formatar resposta com URLs construídas dinamicamente
      const produtosFormatados = produtos.map(produto => {
        const imagemPrincipal = produto.imagemproduto[0];
        
        return {
          id: produto.id,
          nome: produto.nome,
          descricao: produto.descricao || '',
          preco: produto.preco,
          precoDesconto: produto.precoDesconto,
          percentualDesconto: produto.percentualDesconto,
          descontoAte: produto.descontoAte?.toISOString() || null,
          estoque: produto.estoque,
          sku: produto.sku,
          ativo: produto.ativo,
          emDestaque: produto.emDestaque,
          criadoEm: produto.criadoEm.toISOString(),
          categoria: produto.categoria[0]?.nome || 'Sem categoria',
          categoriaId: produto.categoria[0]?.id || null,
          // URL construída dinamicamente
          imagem: imagemPrincipal 
            ? buildCloudinaryUrl(imagemPrincipal.id, { width: 400, height: 400 })
            : null,
          imagemAlt: imagemPrincipal?.textoAlt || produto.nome,
          status: this.determinarStatus(produto.ativo, produto.estoque)
        };
      });

      // Buscar estatísticas básicas
      const totalProdutos = await prisma.produto.count();
      const totalAtivos = await prisma.produto.count({ where: { ativo: true } });
      const totalEmPromocao = await prisma.produto.count({ where: { precoDesconto: { not: null } } });
      const baixoEstoque = await prisma.produto.count({ where: { estoque: { lte: 10, gt: 0 } } });
      const totalCategorias = await prisma.categoria.count();


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
      console.log('📋 Content-Type:', request.headers['content-type']);

      // Verificar se é multipart/form-data
      const isMultipart = request.headers['content-type']?.includes('multipart/form-data');
      console.log('🔍 É multipart?', isMultipart);

      console.log('🔄 Iniciando processamento multipart...');

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
        console.log('⚠️  Não é multipart, tentando como JSON');
        dados = request.body as any;
        console.log('📄 Dados JSON:', dados);
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

      const produtoId = `prod_${Date.now()}_${randomUUID().substring(0, 8)}`;

         // Calcular percentual de desconto se não fornecido
      let percentualDesconto = dados.percentualDesconto;
      if (dados.precoDesconto && !percentualDesconto) {
        percentualDesconto = ((parseFloat(dados.preco) - parseFloat(dados.precoDesconto)) / parseFloat(dados.preco)) * 100;
      }

      // Preparar dados para criação
      const produto = await  prisma.produto.create({
        data:{
          id: produtoId,
          nome: dados.nome,
          descricao: dados.descricao || null,
          preco: parseFloat(dados.preco),
          precoDesconto: dados.precoDesconto ? parseFloat(dados.precoDesconto) : null,
          percentualDesconto: percentualDesconto ? parseFloat(percentualDesconto.toFixed(2)) : null,
          estoque: parseInt(dados.estoque),
          sku: dados.sku,
          ativo: dados.ativo !== undefined ? dados.ativo : true,
          emDestaque: dados.emDestaque !== undefined ? dados.emDestaque : false,

          // Conectar categoria se fornecida
          ...(dados.categoriaId && {
            categoria: {
              connect: [{ id: dados.categoriaId }]
            }
          })
        }
      });

      // Lidar com upload de imagem
      if (imagemFile) {
        try {
          const cloudinaryResult = await uploadToCloudinary(imagemFile, produto.id);

          await prisma.imagemproduto.create({
            data: {
              id: produto.id,
              produtoId: produto.id,
              publicId: cloudinaryResult.public_id,
              textoAlt: dados.nome,
              url: cloudinaryResult.secure_url,
              principal: true
            }
          });
          console.log('✅ Imagem salva, public_id:', cloudinaryResult.public_id);

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

      // Format response
      const response = {
        id: produtoCriado?.id,
        nome: produtoCriado?.nome,
        descricao: produtoCriado?.descricao,
        preco: produtoCriado?.preco,
        precoDesconto: produtoCriado?.precoDesconto,
        estoque: produtoCriado?.estoque,
        sku: produtoCriado?.sku,
        ativo: produtoCriado?.ativo,
        emDestaque: produtoCriado?.emDestaque,
        categoria: produtoCriado?.categoria[0]?.nome || null,
        // Construir URL para resposta
        imagem: produtoCriado?.imagemproduto[0] 
          ? buildCloudinaryUrl(produtoCriado?.imagemproduto[0].publicId)
          : null
      };

      console.log('✅ Produto criado com sucesso:', produto.id);

      reply.status(201).send({
        success: true,
        message: 'Produto criado com sucesso',
        data: response
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
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      console.log('🔄 Recebendo requisição para atualizar produto...');
      console.log('📋 Headers:', request.headers);
      console.log('🔗 Params:', request.params);

      const { id } = request.params;

      // Verificar se produto existe
      const produtoExistente = await prisma.produto.findUnique({
        where: { id },
        include: {
          categoria: true,
          imagemproduto: true
        }
      });

      if (!produtoExistente) {
        console.log(`❌ Produto ${id} não encontrado`);
        return reply.status(404).send({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      console.log(`✅ Produto encontrado: ${produtoExistente.nome}`);

      // Verificar se é multipart/form-data
      const contentType = request.headers['content-type'] || '';
      const isMultipart = request.headers['content-type']?.includes('multipart/form-data');

      console.log('🔍 Content-Type:', contentType);
      console.log('🔍 É multipart?', isMultipart);

      if (!isMultipart) {
        console.log('⚠️  Content-Type não é multipart/form-data');
        console.log('⚠️  Headers recebidos:', request.headers);
      }


      let dados: any = {};
      let imagemFile: any = null;
      let deletarImagem = false;

      

      if (isMultipart) {
        console.log('🔄 Processando dados multipart...');
        const parts = request.parts();
        for await (const part of parts) {
          console.log(`📝 Parte recebida - Campo: ${part.fieldname}, Tipo: ${part.type}`);

          if (part.type === 'file') {
            imagemFile = part;
            console.log('📁 Arquivo recebido:', {
              filename: part.filename,
              mimetype: part.mimetype,
              fieldname: part.fieldname
            });
          } else {
            console.log(`📝 Campo ${part.fieldname}: ${part.value}`);

            // Converter valores para tipos apropriados
            if (part.fieldname === 'ativo' || part.fieldname === 'emDestaque') {
              dados[part.fieldname] = part.value === 'true' || part.value === '1';
            } else if (part.fieldname === 'preco' || part.fieldname === 'precoDesconto' ||
              part.fieldname === 'percentualDesconto' || part.fieldname === 'estoque') {
              dados[part.fieldname] = part.value ? part.value : null;
            } else if (part.fieldname === 'deletarImagem') {
              deletarImagem = part.value === 'true';
              console.log('🗑️  Deletar imagem:', deletarImagem);
            } else {
              dados[part.fieldname] = part.value;
            }
          }
        }
      } else {
        console.log('❌ ERRO: Dados não são multipart/form-data');
        console.log('📄 Tentando ler como JSON...');
        dados = request.body as any;
        console.log('📄 Dados JSON:', dados);
      }

      console.log('📊 Dados processados:', dados);
      console.log('🖼️  Nova imagem?', imagemFile ? 'Sim' : 'Não');
      console.log('🗑️  Deletar imagem?', deletarImagem);

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

      // Calcular percentual de desconto se alterado
      let percentualDesconto = dados.percentualDesconto ? parseFloat(dados.percentualDesconto) : dados.percentualDesconto;

      if (dados.precoDesconto !== undefined && !percentualDesconto && dados.precoDesconto !== null) {
        const precoBase = dados.preco ? parseFloat(dados.preco) : produtoExistente.preco;
        const precoDescontoNum = parseFloat(dados.precoDesconto);
        percentualDesconto = precoBase > 0 ?
          ((precoBase - precoDescontoNum) / precoBase) * 100 : 0;
      }

      // Preparar dados para atualização
      const updateData: any = {
        nome: dados.nome || produtoExistente.nome,
        descricao: dados.descricao !== undefined ? dados.descricao : produtoExistente.descricao,
        preco: dados.preco !== undefined ? parseFloat(dados.preco) : produtoExistente.preco,
        estoque: dados.estoque !== undefined ? parseInt(dados.estoque) : produtoExistente.estoque,
        sku: dados.sku || produtoExistente.sku,
        ativo: dados.ativo !== undefined ? dados.ativo : produtoExistente.ativo,
        emDestaque: dados.emDestaque !== undefined ? dados.emDestaque : produtoExistente.emDestaque,
        atualizadoEm: new Date()
      };

      // Tratar precoDesconto
      if (dados.precoDesconto !== undefined) {
        updateData.precoDesconto = dados.precoDesconto ?
          parseFloat(dados.precoDesconto) :
          null;
      } else {
        updateData.precoDesconto = produtoExistente.precoDesconto;
      }

      // CORREÇÃO: Tratar percentualDesconto corretamente
      if (percentualDesconto !== undefined) {
        if (percentualDesconto !== null && !isNaN(percentualDesconto)) {
          // Garantir que seja número antes de usar toFixed
          updateData.percentualDesconto = parseFloat(percentualDesconto.toFixed(2));
        } else {
          updateData.percentualDesconto = null;
        }
      } else {
        updateData.percentualDesconto = produtoExistente.percentualDesconto;
      }


      // Adicionar data de término do desconto se fornecida
      if (dados.descontoAte) {
        updateData.descontoAte = new Date(dados.descontoAte);
      }

      console.log('📦 Dados para atualização:', updateData);

      // Atualizar produto
      const produtoAtualizado = await prisma.produto.update({
        where: { id },
        data: updateData
      });

      // Atualizar relação com categoria se fornecida
      if (dados.categoriaId !== undefined) {
        if (dados.categoriaId) {
          await prisma.produto.update({
            where: { id },
            data: {
              categoria: {
                set: [{ id: dados.categoriaId }]
              }
            }
          });
        } else {
          // Remover todas as categorias
          await prisma.produto.update({
            where: { id },
            data: {
              categoria: {
                set: []
              }
            }
          });
        }
      }

      // Gerenciar imagens
      if (deletarImagem) {
        // Deletar imagens do banco de dados
        await prisma.imagemproduto.deleteMany({
          where: { produtoId: id }
        });

        // Deletar arquivos físicos
        await deleteProductFiles(id);

        console.log('🗑️  Imagens deletadas');
      }

      if (imagemFile) {
        try {
          // Deletar imagem atual (se existir) antes de adicionar nova
          await prisma.imagemproduto.deleteMany({
            where: { produtoId: id }
          });

          // Deletar arquivos físicos antigos
          await deleteProductFiles(id);

          // Salvar nova imagem
          const savedFile = await saveFile(imagemFile, id);
          const timestamp = Date.now();
          const imageUrlWithTimestamp = `${savedFile.url}?v=${timestamp}`;

          await prisma.imagemproduto.create({
            data: {
              id: randomUUID(),
              produtoId: id,
              publicId:id,
              url: imageUrlWithTimestamp,
              textoAlt: dados.nome || produtoExistente.nome,
              principal: true
            }
          });

          console.log('✅ Nova imagem salva:', savedFile.url);
        } catch (imageError) {
          console.error('⚠️ Erro ao salvar imagem:', imageError);
          // Não falhar a atualização se a imagem falhar
        }
      }

      // Buscar produto atualizado com relações
      const produtoFinal = await prisma.produto.findUnique({
        where: { id },
        include: {
          categoria: true,
          imagemproduto: true
        }
      });

      console.log('✅ Produto atualizado com sucesso:', id);

      reply.send({
        success: true,
        message: 'Produto atualizado com sucesso',
        data: produtoFinal
      });

    } catch (error: any) {
      console.error('❌ Erro ao atualizar produto:', error);
      console.error('🔍 Stack trace:', error.stack);

      // Erros específicos do Prisma
      if (error.code === 'P2002') {
        return reply.status(400).send({
          success: false,
          message: 'SKU já está em uso'
        });
      }

      reply.status(500).send({
        success: false,
        message: 'Erro interno ao atualizar produto',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async deletarProduto(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      console.log('🗑️  Recebendo requisição para deletar produto...');
      const { id } = request.params;

      console.log(`🔍 Buscando produto ID: ${id}`);

      // Verificar se produto existe
      const produto = await prisma.produto.findUnique({
        where: { id },
        include: {
          imagemproduto: true
        }
      });

      if (!produto) {
        console.log(`❌ Produto ${id} não encontrado`);
        return reply.status(404).send({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      console.log(`✅ Produto encontrado: ${produto.nome}`);

      // Verificar se produto tem vendas associadas (opcional, para segurança)
      // Esta verificação depende da sua estrutura de dados

      // Primeiro deletar imagens associadas
      console.log('🔄 Deletando imagens do produto...');

      // Deletar arquivos físicos das imagens
      const arquivosDeletados = await deleteProductFiles(id);
      console.log(`🗑️  ${arquivosDeletados} arquivo(s) físico(s) deletado(s)`);

      // Deletar registros de imagens no banco de dados
      await prisma.imagemproduto.deleteMany({
        where: { produtoId: id }
      });
      console.log('✅ Registros de imagens deletados do banco');

      // Remover relações com categorias (se houver)
      console.log('🔄 Removendo relações com categorias...');
      await prisma.produto.update({
        where: { id },
        data: {
          categoria: {
            set: []
          }
        }
      });
      console.log('✅ Relações com categorias removidas');

      // Deletar o produto
      console.log('🔄 Deletando produto do banco de dados...');
      await prisma.produto.delete({
        where: { id }
      });

      console.log(`✅ Produto ${id} deletado com sucesso`);

      reply.send({
        success: true,
        message: 'Produto deletado com sucesso',
        data: {
          produtoId: id,
          nome: produto.nome,
          arquivosDeletados
        }
      });

    } catch (error: any) {
      console.error('❌ Erro ao deletar produto:', error);

      // Erros específicos do Prisma
      if (error.code === 'P2025') {
        return reply.status(404).send({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      // Verificar se é erro de chave estrangeira (produto em uso)
      if (error.code === 'P2003') {
        return reply.status(400).send({
          success: false,
          message: 'Não é possível deletar o produto pois ele está sendo utilizado em outras partes do sistema'
        });
      }

      reply.status(500).send({
        success: false,
        message: 'Erro interno ao deletar produto',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

      // Buscar produtos mais vendidos (se você tiver essa informação)
      const produtosMaisVendidos = await prisma.produto.findMany({
        where: { ativo: true },
        orderBy: {
          // Aqui você precisaria ordenar por um campo de vendas
          // Por enquanto, usamos data de criação como placeholder
          criadoEm: 'desc'
        },
        take: 5,
        select: {
          id: true,
          nome: true,
          preco: true,
          estoque: true,
          imagemproduto: {
            where: { principal: true },
            take: 1,
            select: { url: true }
          }
        }
      });

      // Calcular total vendido (placeholder - você precisa implementar conforme sua lógica de vendas)
      const totalVendidos = 0;

      reply.send({
        success: true,
        data: {
          totalProdutos,
          totalAtivos,
          totalInativos,
          totalEmPromocao,
          baixoEstoque,
          semEstoque,
          totalVendidos,
          produtosMaisVendidos: produtosMaisVendidos.map(produto => ({
            id: produto.id,
            nome: produto.nome,
            preco: produto.preco,
            estoque: produto.estoque,
            imagem: produto.imagemproduto[0]?.url || null
          })),
          totalCategorias,
          resumo: {
            produtosPorStatus: {
              ativos: totalAtivos,
              inativos: totalInativos,
              emPromocao: totalEmPromocao,
              baixoEstoque: baixoEstoque,
              semEstoque: semEstoque
            },
            porcentagemAtivos: totalProdutos > 0 ? Math.round((totalAtivos / totalProdutos) * 100) : 0,
            porcentagemPromocao: totalProdutos > 0 ? Math.round((totalEmPromocao / totalProdutos) * 100) : 0
          }
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

  // Método para deletar múltiplos produtos (opcional)
  async deletarMultiplosProdutos(
    request: FastifyRequest<{ Body: { ids: string[] } }>,
    reply: FastifyReply
  ) {
    try {
      console.log('🗑️  Recebendo requisição para deletar múltiplos produtos...');
      const { ids } = request.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'Nenhum ID fornecido'
        });
      }

      console.log(`🔍 Tentando deletar ${ids.length} produto(s)...`);

      // Verificar quais produtos existem
      const produtos = await prisma.produto.findMany({
        where: { id: { in: ids } },
        include: { imagemproduto: true }
      });

      const produtosEncontrados = produtos.map(p => p.id);
      const produtosNaoEncontrados = ids.filter(id => !produtosEncontrados.includes(id));

      // Deletar arquivos físicos e registros de imagens
      let totalArquivosDeletados = 0;
      for (const produto of produtos) {
        const arquivosDeletados = await deleteProductFiles(produto.id);
        totalArquivosDeletados += arquivosDeletados;

        await prisma.imagemproduto.deleteMany({
          where: { produtoId: produto.id }
        });
      }

      // Remover relações com categorias
      await prisma.produto.updateMany({
        where: { id: { in: produtosEncontrados } },
        data: {
          estoque: {
            set: 0
          }
        }
      });

      // Deletar os produtos
      const result = await prisma.produto.deleteMany({
        where: { id: { in: produtosEncontrados } }
      });

      console.log(`✅ ${result.count} produto(s) deletado(s) com sucesso`);

      const response: any = {
        success: true,
        message: `${result.count} produto(s) deletado(s) com sucesso`,
        data: {
          deletados: result.count,
          arquivosDeletados: totalArquivosDeletados,
          produtosNaoEncontrados
        }
      };

      if (produtosNaoEncontrados.length > 0) {
        response.warning = `Alguns produtos não foram encontrados: ${produtosNaoEncontrados.join(', ')}`;
      }

      reply.send(response);

    } catch (error: any) {
      console.error('❌ Erro ao deletar múltiplos produtos:', error);

      reply.status(500).send({
        success: false,
        message: 'Erro interno ao deletar produtos',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
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