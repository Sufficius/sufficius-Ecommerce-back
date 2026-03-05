import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ Erro: SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios!');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function migrateProductImages() {
  console.log('��� Migrando imagens de produtos...');
  
  const produtos = await prisma.produto.findMany({
    where: {
      foto: {
        startsWith: '/uploads/'
      }
    }
  });
  
  console.log(`��� Encontrados ${produtos.length} produtos com imagens locais`);
  
  for (const produto of produtos) {
    try {
      const localPath = path.join(__dirname, '..', produto.foto ?? `${produto.id}.jpg`);
      
      if (!fs.existsSync(localPath)) {
        console.log(`⚠️ Imagem não encontrada: ${localPath}`);
        continue;
      }
      
      const fileBuffer = fs.readFileSync(localPath);
      const fileName = path.basename(produto.foto ?? `${produto.id}.jpg`);
      const newFileName = `produtos/${produto.id}-${Date.now()}-${fileName}`;
      
      console.log(` Upload: ${fileName} -> ${newFileName}`);
      
      const { error } = await supabase.storage
        .from('produtos-imagens')
        .upload(newFileName, fileBuffer, {
          contentType: 'image/jpeg',
          upsert: true
        });
      
      if (error) throw error;
      
      await prisma.produto.update({
        where: { id: produto.id },
        data: { foto: newFileName }
      });
      
      console.log(`✅ Produto ${produto.nome} migrado`);
      
    } catch (error) {
      console.error(`❌ Erro no produto ${produto.id}:`, error);
    }
  }
}

async function migrateCategoryImages() {
  console.log('\n 🐛 Migrando imagens de categorias...');
  
  const categorias = await prisma.categoria.findMany({
    where: {
      foto: {
        startsWith: '/uploads/'
      }
    }
  });
  
  console.log(`✔✔ Encontradas ${categorias.length} categorias com imagens locais`);
  
  for (const categoria of categorias) {
    try {
      if (!categoria.foto) continue;
      
      const localPath = path.join(__dirname, '..', categoria.foto);
      
      if (!fs.existsSync(localPath)) {
        console.log(`⚠️ Imagem não encontrada: ${localPath}`);
        continue;
      }
      
      const fileBuffer = fs.readFileSync(localPath);
      const fileName = path.basename(categoria.foto);
      const newFileName = `categorias/${categoria.id}-${Date.now()}-${fileName}`;
      
      console.log(`🍀 Upload: ${fileName} -> ${newFileName}`);
      
      const { error } = await supabase.storage
        .from('categorias-imagens')
        .upload(newFileName, fileBuffer, {
          contentType: 'image/jpeg',
          upsert: true
        });
      
      if (error) throw error;
      
      await prisma.categoria.update({
        where: { id: categoria.id },
        data: { foto: newFileName }
      });
      
      console.log(`✅ Categoria ${categoria.nome} migrada`);
      
    } catch (error) {
      console.error(`❌ Erro na categoria ${categoria.id}:`, error);
    }
  }
}

async function main() {
  console.log('🍀🍀🍀 Iniciando migração para Supabase...\n');
  
  await migrateProductImages();
  await migrateCategoryImages();
  
  console.log('\n✅ Migração concluída!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
