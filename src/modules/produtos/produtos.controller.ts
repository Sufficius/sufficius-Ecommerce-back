// src/modules/produtos/produtos.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';
import { pipeline } from 'stream/promises';
import fs, { stat } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getProductImageUrl, FALLBACK_PRODUCT_IMAGE } from '../../utils/cloudinary';
import { uploadService } from '@/services/uploads/upload';
import uploadRoutes from '../upload/upload';
import { supabase } from '../../lib/supabase';

// Interfaces
interface ProdutoInput {
  nome?: string;
  preco?: string | number;
  quantidade?: string | number;
  descricao?: string;
  id_categoria?: string;
  status?: string;
  foto?: string;
  deletarImagem?: string;
}

interface ProdutosMaisVendidosQuery {
  limit?: string;
  periodo?: string;
  categoria?: string;
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
  id?: string;           // ← NOVO: public_id do Cloudinary
  cloudinaryUrl?: string;      // ← NOVO: URL do Cloudinary
}

// Configurar diretório de uploads temporários (para processamento antes do Cloudinary)
const getUploadDir = () => {
  if (process.env.RENDER) {
    return '/opt/render/project/src/uploads';
  }
  return path.join(process.cwd(), 'uploads', '');
};

const TEMP_UPLOAD_DIR = getUploadDir();

// Criar diretório temporário se não existir
if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
  fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
}

// Função para salvar arquivo temporariamente e enviar para Cloudinary
async function saveAndUploadToCloudinary(file: any, produtoId: string): Promise<SavedFile> {
  try {
    console.log('💾 Processando imagem para Cloudinary...');

    // Gerar nome único para o arquivo temporário
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const originalName = file.filename || 'imagem';
    const extension = path.extname(originalName) || '.jpg';
    const tempFilename = `${produtoId}-${timestamp}-${randomStr}${extension}`;
    const tempFilepath = path.join(TEMP_UPLOAD_DIR, tempFilename);

    // Salvar arquivo temporariamente
    const writeStream = fs.createWriteStream(tempFilepath);
    await pipeline(file.file, writeStream);

    // Fazer upload para Cloudinary
    const cloudinaryResult = await getUploadDir();

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

  if (foto.includes('produto_')) {
    return getProductImageUrl(foto, {
      width: 600,
      height: 600,
      quality: 'auto:good',
      crop: 'fill'
    });
  }

  return FALLBACK_PRODUCT_IMAGE;
}

function buildImageUrl(id?: string, cloudinaryUrl?: string): string | null {
  console.log('🖼️ Construindo URL com:', {
    id,
    cloudinaryUrl,
    hasid: !!id,
    hasCloudinaryUrl: !!cloudinaryUrl,
    cloudinaryUrlContainsCloudinary: cloudinaryUrl?.includes('cloudinary.com')
  });

  // DEBUG: Mostrar valores exatos
  if (id) {
    console.log('🔍 id value:', `"${id}"`, 'length:', id.length);
  }
  if (cloudinaryUrl) {
    console.log('🔍 cloudinaryUrl value:', `"${cloudinaryUrl}"`, 'length:', cloudinaryUrl.length);
  }

  // Prioridade 1: Se já tiver uma URL completa do Cloudinary, use-a
  if (cloudinaryUrl && cloudinaryUrl.includes('cloudinary.com')) {
    console.log('✅ Usando URL completa do Cloudinary:', cloudinaryUrl);

    // VERIFICAÇÃO EXTRA: A URL já está completa?
    if (cloudinaryUrl.startsWith('http')) {
      return cloudinaryUrl; // Já é URL completa
    } else {
      // Se não começa com http, adicionar o domínio
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'sufficius-commerce';
      return `https://res.cloudinary.com/${cloudName}/image/upload/${cloudinaryUrl}`;
    }
  }

  // Prioridade 2: Se tiver id, gerar URL otimizada
  if (id && id.trim() !== "") {
    console.log('🔧 Gerando URL do Cloudinary para id:', id);

    // Verificar se o id já é uma URL
    if (id.includes('cloudinary.com')) {
      console.warn('⚠️  id parece ser uma URL, não um id:', id);
      return id; // Retornar como está
    }

    const generatedUrl = getProductImageUrl(id, {
      width: 600,
      height: 600,
      quality: 'auto:good',
      crop: 'fill'
    });

    console.log('✅ URL gerada do Cloudinary:', generatedUrl);
    return generatedUrl;
  }

  // Prioridade 3: Fallback
  console.log('⚠️  Sem id ou URL válida, usando fallback');
  return FALLBACK_PRODUCT_IMAGE;
}


// Função para deletar imagem do Cloudinary
async function deleteFromCloudinary(id: string): Promise<void> {
  try {
    if (!id || id.startsWith('simulated_')) {
      return; // Não tentar deletar ids simulados
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'sufficius-commerce';
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.warn('⚠️  Credenciais do Cloudinary não configuradas. Não foi possível deletar imagem.');
      return;
    }

    // Implementar deleção usando fetch API
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

    // Você precisaria implementar a deleção usando a API do Cloudinary
    // Esta é uma implementação básica
    console.log(`🗑️  Marcando imagem para deleção do Cloudinary: ${id}`);
    // Nota: Para deletar realmente, você precisa usar a SDK do Cloudinary
    // ou fazer uma requisição DELETE para a API

  } catch (error: any) {
    console.error(`⚠️  Erro ao marcar imagem para deleção do Cloudinary:`, error.message);
  }
}

// Função para deletar arquivos temporários
async function deleteTempFiles(produtoId: string): Promise<number> {
  try {
    const files = fs.readdirSync(TEMP_UPLOAD_DIR);
    const produtoFiles = files.filter(file => file.includes(produtoId));

    let deletedCount = 0;

    for (const file of produtoFiles) {
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

// Função para validar dados do produto
function validateProdutoData(data: any): {
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
    errors.push('Nome do produto é obrigatório');
  } else {
    validated.nome = String(nome).trim();
  }

  // Validar preço
  if (preco === undefined || preco === '') {
    errors.push('Preço do produto é obrigatório');
  } else {
    if (isNaN(preco) || preco < 0) {
      errors.push('Preço inválido');
    } else {
      validated.preco = preco;
    }
  }

  // Validar quantidade
  if (quantidade === undefined || quantidade === '') {
    errors.push('Quantidade do produto é obrigatória');
  } else {
    if (isNaN(quantidade) || quantidade < 0) {
      errors.push('Quantidade inválida');
    } else {
      validated.quantidade = quantidade;
    }
  }

  // Validar categoria
  if (!id_categoria || String(id_categoria).trim().length === 0) {
    errors.push('Categoria do produto é obrigatória');
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

export class ProdutosController {

  async getProdutos(request: FastifyRequest, reply: FastifyReply) {
    try {

      const produto = await prisma.produto.findMany({
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
        data: produto,
        total: produto.length
      });
    } catch (error) {
      console.error('❌ Erro ao listar produtos:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao listar produtos'
      });
    }
  }

  // Listar produtos com filtros
  async listarProdutos(
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
        'criadoEm_asc': { criadoEm: 'asc' },
        'criadoEm_desc': { criadoEm: 'desc' }
      };

      const orderBy = orderMap[ordenar] || { criadoEm: 'desc' };

      const [produtos, total] = await Promise.all([
        prisma.produto.findMany({
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
                produto: true,
                principal: true,
                produtoId: true
              }
            }
          },
          skip,
          take: limite,
          orderBy: { criadoEm: 'desc' },
        }),
        prisma.produto.count({ where: where })
      ]);

      reply.send({
        success: true,
        data: produtos.map(p => ({
          id: p.id,
          nome: p.nome,
          preco: p.preco,
          quantidade: p.quantidade,
          status: p.status,
          atualizadoEm: p.atualizadoEm.toISOString(),
          criadoEm: p.criadoEm.toISOString(),
          Categoria: p.Categoria,
          ImagemProduto: p.ImagemProduto,
          fotot: p.foto,
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
      console.error('❌ Erro ao listar produtos:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao listar produtos'
      });
    }
  }

  // Buscar produto por ID
  async buscarProdutoPorId(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      const produto = await prisma.produto.findUnique({
        where: { id },
        include: {
          Categoria: true,
          ImagemProduto: true,
        }
      });


      if (!produto) {
        return reply.status(404).send({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      // Construir URLs do Cloudinary para as imagens
      const produtoComImagens = {
        ...produto,
        imagemproduto: buildImageUrlFromFoto(produto.foto),
        cloudinaryId: produto.foto
      };

      reply.send({
        success: true,
        data: produtoComImagens
      });
    } catch (error) {
      console.error('Erro ao buscar produto:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao buscar produto'
      });
    }
  }


  // Criar produto
  async criarProduto(request: FastifyRequest, reply: FastifyReply) {
    try {
      console.log('📦 Criando novo produto...');
      const { nome, preco, quantidade, id_categoria, descricao, status } = request.body as any;
      // 1. PRIMEIRO verificar autenticação MANUALMENTE
      try {
        await request.jwtVerify();
        const user = request.user as any;

        if (user.tipo !== 'ADMIN') {
          return reply.status(403).send({
            success: false,
            message: 'Acesso negado. Apenas administradores podem criar produtos.'
          });
        }
      } catch (err) {
        return reply.status(401).send({
          success: false,
          message: 'Não autorizado. Token inválido ou expirado.'
        });
      }

      // 2. AGORA processar o multipart
      const contentType = request.headers['content-type'] || '';
      const isMultipart = contentType.includes('multipart/form-data');
      console.log("Content: ", contentType);

      let fotoUrl: string | null = null;
      let dados = request.body as any;

      console.log('🔄 Processando dados multipart...');

      // Log dos dados recebidos
      console.log('📊 Dados recebidos do formulário:', { nome, preco, quantidade });


      if(isMultipart){
        try{
          const data = await request.file();

          if(data){
               console.log('📸 Processando upload de imagem para Supabase...');

                const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
          if (!validTypes.includes(data.mimetype)) {
            return reply.status(400).send({
              success: false,
              message: "Tipo de arquivo não suportado. Use JPEG, PNG ou WebP"
            });
          }
            // Validar tamanho (10MB)
          if (data.file.bytesRead > 10 * 1024 * 1024) {
            return reply.status(400).send({
              success: false,
              message: "Arquivo muito grande. Máximo 10MB"
            });
          }
          const buffer = await data.toBuffer();
          
          // Gerar nome único para o arquivo
          const fileExtension = data.filename.split('.').pop();
          const fileName = `produtos/${randomUUID()}.${fileExtension}`;
          const bucket = process.env.SUPABASE_BUCKET_PRODUTOS || 'produtos-imagens';

            // Upload para Supabase
          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(fileName, buffer, {
              contentType: data.mimetype,
              cacheControl: '3600',
              upsert: false
            });

             if (uploadError) {
            console.error('❌ Erro no upload para Supabase:', uploadError);
            return reply.status(500).send({
              success: false,
              message: 'Erro ao fazer upload da imagem',
              error: uploadError.message
            });
          }

             const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(fileName);

          fotoUrl = publicUrl;
          
          console.log('✅ Upload realizado para Supabase:', fotoUrl);

           // Atualizar dados com os campos do formulário
          const fields = data.fields || {};
          dados = {
            nome: fields.nome || dados.nome,
            preco: fields.preco || dados.preco,
            quantidade: fields.quantidade || dados.quantidade,
            id_categoria: fields.id_categoria || dados.id_categoria,
            descricao: fields.descricao || dados.descricao,
            status: fields.status || dados.status || "ATIVO"
          };
          }
        }
        catch (uploadError) {
        console.error('❌ Erro ao processar arquivo:', uploadError);
        // Continua sem imagem se houver erro
      }
      }

      console.log('📊 Dados recebidos:', dados);

    
    if (!dados) {
      return reply.status(400).send({
        success: false,
        message: 'Campos obrigatórios: nome, preco, quantidade, id_categoria'
      });
    }

      // 4. Validar dados
      const validation = validateProdutoData(dados);
      console.log("Tem Validação: ", validation);
      if (!validation.isValid) {
        return reply.status(400).send({
          success: false,
          message: 'Dados inválidos',
          errors: validation.errors
        });
      }

      // 5. Verificar se categoria existe
      const categoriaExistente = await prisma.categoria.findUnique({
        where: { id: id_categoria }
      });

      if (!categoriaExistente) {
        return reply.status(400).send({
          success: false,
          message: 'Categoria não encontrada'
        });
      }

      // 6. Gerar IDs
      const produtoId = randomUUID();

      console.log('💾 Criando produto no banco de dados...');

      // 7. Criar produto no banco
      const produto = await prisma.produto.create({
        data: {
          id: produtoId,
          nome: nome,
          descricao: descricao || null,
          preco: parseFloat(preco),
          quantidade: parseInt(quantidade),
          foto: dados.foto,
          status: "ATIVO",
          id_categoria: id_categoria,
        }
      });
      console.log(`✅ Produto criado no banco: ${produto.id}`);

      // 9. Buscar produto criado com relações
      const produtoCriado = await prisma.produto.findUnique({
        where: { id: produto.id },
        include: {
          Categoria: {
            select: {
              id: true,
              nome: true
            }
          },
        }
      });

      // 10. Construir resposta com URL do Cloudinary
      const response = {
        id: produtoCriado?.id,
        nome: produtoCriado?.nome,
        descricao: produtoCriado?.descricao,
        preco: produtoCriado?.preco,
        quantidade: produtoCriado?.quantidade,
        status: produtoCriado?.status,
        foto: produtoCriado?.foto,
        categoria: produtoCriado?.Categoria?.nome || null,
        categoriaId: produtoCriado?.Categoria?.id || null,
        fotoUrl: produtoCriado?.foto,
        criadoEm: produtoCriado?.criadoEm?.toISOString()
      };


      return reply.status(201).send({
        success: true,
        message: 'Produto criado com sucesso',
        data: response
      });

    } catch (error: any) {
      console.error('❌ ERRO CRÍTICO ao criar produto:', error);
      console.error('Stack trace:', error.stack);

      if (error.code === 'P2003') {
        return reply.status(400).send({
          success: false,
          message: 'Categoria não existe'
        });
      }

      // Erro genérico
      return reply.status(500).send({
        success: false,
        message: 'Erro interno ao criar produto',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Contate o administrador'
      });
    }
  }

  // Atualizar produto
  async atualizarProduto(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      // Verificar se produto existe
      const produtoExistente = await prisma.produto.findUnique({
        where: { id },
      });

      if (!produtoExistente) {
        return reply.status(404).send({
          success: false,
          message: 'Produto não encontrado'
        });
      }


      let dados: any = {};
      let imagemFile: any = null;
      let deletarImagem = false;

      dados = request.body as ProdutoInput;

      // Preparar dados para atualização
      const updateData: any = {
        nome: dados.nome || produtoExistente.nome,
        descricao: dados.descricao !== undefined ? dados.descricao : produtoExistente.descricao,
        preco: dados.preco !== undefined ? parseFloat(String(dados.preco)) : produtoExistente.preco,
        quantidade: dados.quantidade !== undefined ? parseInt(String(dados.quantidade)) : produtoExistente.quantidade,
        status: dados.status || produtoExistente.status,
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

      if (dados.foto !== undefined) {
      // Se veio null ou string vazia, remover imagem
      if (dados.foto === null || dados.foto === '') {
        if (produtoExistente.foto) {
          // Deletar imagem antiga do Supabase
          const oldFileName = produtoExistente.foto.split('/').pop();
          if (oldFileName) {
            await supabase.storage
              .from('produtos-imagens')
              .remove([`uploads/${oldFileName}`]);
          }
        }
        updateData.foto = null;
      } 

       else if (dados.foto !== produtoExistente.foto) {
        // Deletar imagem antiga se existir
        if (produtoExistente.foto) {
          const oldFileName = produtoExistente.foto.split('/').pop();
          if (oldFileName) {
            await supabase.storage
              .from('produtos-imagens')
              .remove([`uploads/${oldFileName}`]);
          }
        }
        updateData.foto = dados.foto;
      }
    }

    const produtoAtualizado = await prisma.produto.update({
      where: { id },
      data: updateData,
      include: {
        Categoria: true
      }
    });

       console.log('✅ Produto atualizado:', {
      id: produtoAtualizado.id,
      nome: produtoAtualizado.nome,
      foto: produtoAtualizado.foto
    });

     reply.send({
      success: true,
      message: 'Produto atualizado com sucesso',
      data: produtoAtualizado
    });
    } catch (error: any) {
      console.error('❌ Erro ao atualizar produto:', error);

      if (error.code === 'P2003') {
        return reply.status(400).send({
          success: false,
          message: 'Categoria não existe'
        });
      }

      reply.status(500).send({
        success: false,
        message: 'Erro interno ao atualizar produto'
      });
    }
  }

  // Deletar produto
  async deletarProduto(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;

      // Verificar se produto existe
      const produto = await prisma.produto.findUnique({
        where: { id },
        include: {
          ImagemProduto: true
        }
      });

      if (!produto) {
        return reply.status(404).send({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      if (produto.foto) {
        await deleteFromCloudinary(produto.foto);
      }


      // Deletar imagens do Cloudinary
      const imagens = await prisma.imagemProduto.findMany({
        where: { produtoId: id }
      });

      for (const imagem of imagens) {
        if (imagem.id) {
          await deleteFromCloudinary(imagem.id);
        }
      }

      // Deletar arquivos temporários
      const arquivosTempDeletados = await deleteTempFiles(id);

      // Deletar registros de imagens no banco
      await prisma.imagemProduto.deleteMany({
        where: { produtoId: id }
      });

      // Verificar dependências
      const [temItensCarrinho, temItensPedido] = await Promise.all([
        prisma.itemCarrinho.findFirst({ where: { produtoId: id } }),
        prisma.itemPedido.findFirst({ where: { produtoId: id } }),
        // prisma.avaliacao.findFirst({ where: { produtoId: id } })
      ]);

      if (temItensCarrinho || temItensPedido) {
        // Marcar como INACTIVO
        await prisma.produto.update({
          where: { id },
          data: {
            status: 'INATIVO',
            foto: null
          }
        });

        return reply.send({
          success: true,
          message: 'Produto marcado como inativo (não pode ser deletado pois está em uso)',
          data: {
            produtoId: id,
            nome: produto.nome,
          }
        });
      }

      // Deletar produto
      await prisma.produto.delete({
        where: { id }
      });

      reply.send({
        success: true,
        message: 'Produto deletado com sucesso',
        data: {
          produtoId: id,
          nome: produto.nome,
        }
      });

    } catch (error: any) {
      console.error('❌ Erro ao deletar produto:', error);

      if (error.code === 'P2025') {
        return reply.status(404).send({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      reply.status(500).send({
        success: false,
        message: 'Erro interno ao deletar produto',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Estatísticas de produtos
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
      ] = await Promise.all([
        prisma.produto.count(),
        prisma.produto.count({ where: { status: 'ATIVO' } }),
        prisma.produto.count({ where: { status: 'INATIVO' } }),
        prisma.produto.count({ where: { quantidade: { lte: 10, gt: 0 } } }),
        prisma.produto.count({ where: { quantidade: 0 } }),
        prisma.categoria.count()
      ]);

      // Buscar produtos mais vendidos
      const produtosMaisVendidos = await prisma.produto.findMany({
        where: { status: 'ATIVO' },
        include: {
          ImagemProduto: {
            where: { principal: true },
            take: 1
          },
          ItemPedido: {
            select: {
              quantidade: true
            }
          }
        },
        take: 5
      });

      // Calcular total vendido
      const produtosComVendas = produtosMaisVendidos.map(produto => {
        const totalVendido = produto.ItemPedido.reduce((sum, item) => sum + item.quantidade, 0);
        return {
          ...produto,
          totalVendido
        };
      }).sort((a, b) => b.totalVendido - a.totalVendido);

      // Calcular valor total em estoque
      const produtosComEstoque = await prisma.produto.findMany({
        where: { status: 'ATIVO' },
        select: {
          preco: true,
          quantidade: true
        }
      });

      const valorTotalEstoque = produtosComEstoque.reduce((total, produto) => {
        return total + (produto.preco * produto.quantidade);
      }, 0);

      // Preparar resposta com URLs do Cloudinary
      const produtosComImagens = produtosComVendas.map(produto => ({
        id: produto.id,
        nome: produto.nome,
        preco: produto.preco,
        quantidade: produto.quantidade,
        totalVendido: produto.totalVendido,
        imagem: buildImageUrlFromFoto(produto.foto)
      }));

      reply.send({
        success: true,
        data: {
          totalProdutos,
          totalAtivos,
          totalInativos,
          totalEmPromocao,
          baixoEstoque,
          semEstoque,
          valorTotalEstoque,
          produtosMaisVendidos: produtosComImagens,
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

  // Deletar múltiplos produtos
  async deletarMultiplosProdutos(
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

      // Verificar quais produtos existem
      const produtos = await prisma.produto.findMany({
        where: { id: { in: ids } },
        include: { ImagemProduto: true }
      });

      const produtosEncontrados = produtos.map(p => p.id);
      const produtosNaoEncontrados = ids.filter(id => !produtosEncontrados.includes(id));

      // Deletar imagens do Cloudinary
      let totalCloudinaryDeletadas = 0;
      for (const produto of produtos) {
        for (const imagem of produto.ImagemProduto) {
          if (imagem.id) {
            await deleteFromCloudinary(imagem.id);
            totalCloudinaryDeletadas++;
          }
        }

        // Deletar arquivos temporários
        await deleteTempFiles(produto.id);

        // Deletar registros do banco
        await prisma.imagemProduto.deleteMany({
          where: { produtoId: produto.id }
        });
      }

      // Verificar produtos que não podem ser deletados
      const produtosParaMarcarInativo: string[] = [];
      const produtosParaDeletar: string[] = [];

      for (const produtoId of produtosEncontrados) {
        const [temItensCarrinho, temItensPedido] = await Promise.all([
          prisma.itemCarrinho.findFirst({ where: { produtoId } }),
          prisma.itemPedido.findFirst({ where: { produtoId } }),
          // prisma.avaliacao.findFirst({ where: { produtoId } })
        ]);

        if (temItensCarrinho || temItensPedido) {
          produtosParaMarcarInativo.push(produtoId);
        } else {
          produtosParaDeletar.push(produtoId);
        }
      }

      // Marcar produtos em uso como INACTIVO
      if (produtosParaMarcarInativo.length > 0) {
        await prisma.produto.updateMany({
          where: { id: { in: produtosParaMarcarInativo } },
          data: {
            status: 'INATIVO',
            quantidade: 0
          }
        });
      }

      // Deletar produtos que não estão em uso
      let deletadosCount = 0;
      if (produtosParaDeletar.length > 0) {
        const result = await prisma.produto.deleteMany({
          where: { id: { in: produtosParaDeletar } }
        });
        deletadosCount = result.count;
      }

      const totalProcessados = deletadosCount + produtosParaMarcarInativo.length;

      const response: any = {
        success: true,
        message: `${totalProcessados} produto(s) processado(s)`,
        data: {
          deletados: deletadosCount,
          marcadosInativos: produtosParaMarcarInativo.length,
          imagensCloudinaryDeletadas: totalCloudinaryDeletadas,
          produtosNaoEncontrados
        }
      };

      if (produtosNaoEncontrados.length > 0) {
        response.warning = `Alguns produtos não foram encontrados: ${produtosNaoEncontrados.join(', ')}`;
      }

      if (produtosParaMarcarInativo.length > 0) {
        response.notice = `${produtosParaMarcarInativo.length} produto(s) foram marcados como inativos (estão em uso)`;
      }

      reply.send(response);

    } catch (error: any) {
      console.error('❌ Erro ao deletar múltiplos produtos:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro interno ao deletar produtos'
      });
    }
  }

  // Adicione este método após o getEstatisticasProdutos
  async getProdutosMaisVendidos(request: FastifyRequest, reply: FastifyReply) {
    try {
      const {
        limit = '5',
        periodo = 'todos',
        categoria = ''
      } = request.query as ProdutosMaisVendidosQuery;

      const limitNum = parseInt(limit, 10);

      console.log('📊 Buscando produtos mais vendidos:', { limit: limitNum, periodo, categoria });

      let dateFilter: any = {};
      const hoje = new Date();

      switch (periodo) {
        case 'hoje':
          const inicioHoje = new Date(hoje);
          inicioHoje.setHours(0, 0, 0, 0);
          dateFilter = { gte: inicioHoje };
          break;
        case '7dias':
          const seteDiasAtras = new Date(hoje)
          seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
          dateFilter = { gte: seteDiasAtras };
          break;
        case '30dias':
          const trintaDiasAtras = new Date(hoje);
          trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
          dateFilter = { gte: trintaDiasAtras }
          break;
        case 'mes':
          const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
          dateFilter = { gte: inicioMes };
          break;
      }

      const itensPedidoAgregados = await prisma.itemPedido.groupBy({
        by: ['produtoId'],
        _sum: {
          quantidade: true,
          precoTotal: true
        },
        where: {
          produto: {
            status: "ATIVO",
            ...(categoria ? { id_categoria: categoria } : {})
          },
          pedido: {
            status: { in: ['ENTREGUE', 'CONFIRMADO', 'ENVIADO'] },
            ...(periodo !== 'todos' ? { criadoEm: dateFilter } : {})
          }
        },
        orderBy: {
          _sum: {
            quantidade: 'desc'
          }
        },
        take: limitNum
      });

      console.log(`📊 Produtos vendidos encontrados: ${itensPedidoAgregados.length}`);

      // 5. Se não encontrou produtos vendidos, buscar produtos ativos
      if (itensPedidoAgregados.length === 0) {
        console.log('ℹ️ Nenhum item de pedido encontrado, retornando produtos ativos');

        const produtosAtivos = await prisma.produto.findMany({
          where: {
            status: 'ATIVO',
            ...(categoria ? { id_categoria: categoria } : {})
          },
          include: {
            ImagemProduto: {
              where: { principal: true },
              take: 1
            },
            Categoria: true
          },
          orderBy: { criadoEm: 'desc' },
          take: limitNum
        });

        const produtosFormatados = produtosAtivos.map(produto => ({
          id: produto.id,
          nome: produto.nome,
          imagem: buildImageUrlFromFoto(produto.foto),
          quantidade: 0,
          total: 0,
          precoUnitario: produto.preco,
          categoria: produto.Categoria?.nome || 'Sem categoria'
        }));

        return reply.send({
          success: true,
          data: produtosFormatados
        });
      }

      // 6. Buscar detalhes dos produtos
      const produtoIds = itensPedidoAgregados.map(pv => pv.produtoId);

      const produtos = await prisma.produto.findMany({
        where: {
          id: { in: produtoIds },
          status: 'ATIVO',
        },
        include: {
          ImagemProduto: {
            where: { principal: true },
            take: 1
          },
          Categoria: true
        }
      });

      // 7. Criar mapa para acesso rápido
      const produtosMap = new Map();
      produtos.forEach(produto => {
        produtosMap.set(produto.id, produto);
      });

      // 8. Montar resposta final
      const produtosMaisVendidos = itensPedidoAgregados
        .map(pv => {
          const produto = produtosMap.get(pv.produtoId);
          if (!produto) return null;

          const quantidade = pv._sum.quantidade || 0;
          const total = pv._sum.precoTotal || 0;

          return {
            id: produto.id,
            nome: produto.nome,
            imagem: buildImageUrlFromFoto(produto.foto),
            quantidade,
            total,
            precoUnitario: produto.preco,
            categoria: produto.categoria?.nome || 'Sem categoria'
          };
        })
        .filter(Boolean);

      console.log(`✅ Produtos formatados: ${produtosMaisVendidos.length}`);

      return reply.send({
        success: true,
        data: produtosMaisVendidos
      });

    } catch (error: any) {
      console.error('❌ Erro ao buscar produtos mais vendidos:', error);
      console.error('Stack trace:', error.stack);

      // Tentar retornar produtos ativos como último recurso
      try {
        console.log('🔄 Tentando fallback: produtos ativos');

        const produtosAtivos = await prisma.produto.findMany({
          where: { status: 'ATIVO' },
          include: {
            ImagemProduto: {
              where: { 
                principal: true },
              take: 1
            }
          },
          take: 5,
          orderBy: { criadoEm: 'desc' }
        });

        const produtosFormatados = produtosAtivos.map(produto => ({
          id: produto.id,
          nome: produto.nome,
          imagem: produto.foto || buildImageUrlFromFoto(produto.foto),
          quantidade: 0,
          total: 0,
          precoUnitario: produto.preco,
          categoria: 'Sem categoria'
        }));

        return reply.send({
          success: true,
          data: produtosFormatados
        });
      } catch (fallbackError) {
        console.error('❌ Fallback também falhou:', fallbackError);
        return reply.status(500).send({
          success: false,
          message: 'Erro interno ao buscar produtos mais vendidos'
        });
      }
    }
  }
}