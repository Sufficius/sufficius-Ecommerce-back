// scripts/migrate-images-to-supabase.ts
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente do arquivo .env na raiz
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

// Verificar se as variáveis de ambiente existem
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ Erro: SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios!');
  console.log('📌 Verifique seu arquivo .env');
  process.exit(1);
}

console.log('📌 Configuração:');
console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL}`);
console.log(`   SUPABASE_KEY: ${process.env.SUPABASE_SERVICE_KEY ? '✓ configurada' : '✗ não configurada'}\n`);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Função para normalizar nome do arquivo
function normalizeFileName(fileName: string): string {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Função para detectar content type
function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif'
  };
  return types[ext] || 'image/jpeg';
}

// Função para verificar se bucket existe
async function checkBucket(bucketName: string): Promise<boolean> {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error(`❌ Erro ao listar buckets:`, error.message);
      return false;
    }
    
    const bucketExists = buckets?.some(b => b.name === bucketName);
    
    if (!bucketExists) {
      console.log(`⚠️ Bucket "${bucketName}" não encontrado!`);
      console.log(`📌 Crie-o no painel do Supabase > Storage`);
      return false;
    }
    
    console.log(`✅ Bucket "${bucketName}" encontrado`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao verificar bucket:`, error);
    return false;
  }
}

async function migrateProductImages() {
  console.log('\n🚀 Migrando imagens de produtos...');
  
  try {
    // Verificar bucket de produtos
    const bucketOk = await checkBucket('produtos-imagens');
    if (!bucketOk) {
      console.log('⚠️ Continuando mesmo assim, mas upload pode falhar...');
    }
    
    const produtos = await prisma.produto.findMany({
      where: {
        foto: {
          startsWith: '/uploads/'
        }
      }
    });
    
    console.log(`📦 Encontrados ${produtos.length} produtos com imagens locais\n`);
    
    if (produtos.length === 0) {
      console.log('✨ Nenhum produto para migrar!');
      return;
    }
    
    let sucessos = 0;
    let erros = 0;
    
    for (const produto of produtos) {
      try {
        console.log(`🔄 Processando produto: ${produto.nome} (${produto.id})`);
        
        if (!produto.foto) {
          console.log(`⚠️ Produto sem imagem, ignorando...`);
          continue;
        }
        
        // Caminho completo da imagem local
        const localPath = path.join(__dirname, '..', produto.foto);
        console.log(`   Caminho local: ${localPath}`);
        
        // Verificar se arquivo existe
        if (!fs.existsSync(localPath)) {
          console.log(`⚠️ Imagem não encontrada: ${localPath}`);
          erros++;
          continue;
        }
        
        // Ler o arquivo
        const fileBuffer = fs.readFileSync(localPath);
        
        // Preparar nome do arquivo
        const fileName = path.basename(produto.foto);
        const normalizedName = normalizeFileName(fileName);
        const newFileName = `produtos/${produto.id}-${Date.now()}-${normalizedName}`;
        
        console.log(`📤 Upload: ${fileName} -> ${newFileName}`);
        
        // Fazer upload para Supabase
        const { error, data } = await supabase.storage
          .from('produtos-imagens')
          .upload(newFileName, fileBuffer, {
            contentType: getContentType(localPath),
            cacheControl: '3600',
            upsert: true
          });
        
        if (error) {
          console.error(`❌ Erro no upload:`, error);
          erros++;
          continue;
        }
        
        console.log(`✅ Upload concluído:`, data?.path);
        
        // Atualizar o produto no banco
        await prisma.produto.update({
          where: { id: produto.id },
          data: { foto: newFileName }
        });
        
        console.log(`✅ Produto ${produto.nome} atualizado no banco\n`);
        sucessos++;
        
      } catch (error) {
        console.error(`❌ Erro no produto ${produto.id}:`, error);
        erros++;
      }
    }
    
    console.log(`\n📊 Resultado produtos: ${sucessos} sucessos, ${erros} erros`);
    
  } catch (error) {
    console.error('❌ Erro na migração de produtos:', error);
  }
}

async function migrateCategoryImages() {
  console.log('\n🚀 Migrando imagens de categorias...');
  
  try {
    // Verificar bucket de categorias
    const bucketOk = await checkBucket('categorias-imagens');
    if (!bucketOk) {
      console.log('⚠️ Continuando mesmo assim, mas upload pode falhar...');
    }
    
    // Usando 'foto' como você confirmou
    const categorias = await prisma.categoria.findMany({
      where: {
        foto: {
          startsWith: '/uploads/'
        }
      }
    });
    
    console.log(`📦 Encontradas ${categorias.length} categorias com imagens locais\n`);
    
    if (categorias.length === 0) {
      console.log('✨ Nenhuma categoria para migrar!');
      return;
    }
    
    let sucessos = 0;
    let erros = 0;
    
    for (const categoria of categorias) {
      try {
        console.log(`🔄 Processando categoria: ${categoria.nome} (${categoria.id})`);
        
        if (!categoria.foto) {
          console.log(`⚠️ Categoria sem imagem, ignorando...`);
          continue;
        }
        
        const localPath = path.join(__dirname, '..', categoria.foto);
        console.log(`   Caminho local: ${localPath}`);
        
        if (!fs.existsSync(localPath)) {
          console.log(`⚠️ Imagem não encontrada: ${localPath}`);
          erros++;
          continue;
        }
        
        const fileBuffer = fs.readFileSync(localPath);
        
        const fileName = path.basename(categoria.foto);
        const normalizedName = normalizeFileName(fileName);
        const newFileName = `categorias/${categoria.id}-${Date.now()}-${normalizedName}`;
        
        console.log(`📤 Upload: ${fileName} -> ${newFileName}`);
        
        const { error, data } = await supabase.storage
          .from('categorias-imagens')
          .upload(newFileName, fileBuffer, {
            contentType: getContentType(localPath),
            cacheControl: '3600',
            upsert: true
          });
        
        if (error) {
          console.error(`❌ Erro no upload:`, error);
          erros++;
          continue;
        }
        
        console.log(`✅ Upload concluído:`, data?.path);
        
        await prisma.categoria.update({
          where: { id: categoria.id },
          data: { foto: newFileName }
        });
        
        console.log(`✅ Categoria ${categoria.nome} atualizada no banco\n`);
        sucessos++;
        
      } catch (error) {
        console.error(`❌ Erro na categoria ${categoria.id}:`, error);
        erros++;
      }
    }
    
    console.log(`\n📊 Resultado categorias: ${sucessos} sucessos, ${erros} erros`);
    
  } catch (error) {
    console.error('❌ Erro na migração de categorias:', error);
  }
}

// Função principal
async function main() {
  console.log('🎬 INICIANDO MIGRAÇÃO DE IMAGENS PARA SUPABASE\n');
  
  try {
    await migrateProductImages();
    await migrateCategoryImages();
    
    console.log('\n🎉 MIGRAÇÃO CONCLUÍDA!');
    console.log('✅ Verifique no painel do Supabase se as imagens foram carregadas.');
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar migração
main();