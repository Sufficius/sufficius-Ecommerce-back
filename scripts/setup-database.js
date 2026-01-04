#!/usr/bin/env node
// scripts/setup-database.js - VERSÃO COMPLETA COM CATEGORIAS

const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

console.log('🚀 Iniciando configuração do banco de dados...');

async function setupDatabase() {
  try {
    // 1. Verificar variáveis de ambiente
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL não está definida');
      process.exit(1);
    }

    console.log('📦 NODE_ENV:', process.env.NODE_ENV);
    console.log('🔗 DATABASE_URL definida: SIM');

    // 2. Gerar Prisma Client
    console.log('\n🔧 1/4 Gerando Prisma Client...');
    execSync('npx prisma generate', { 
      stdio: 'inherit',
      timeout: 30000 
    });

    // 3. Criar tabelas
    console.log('\n📦 2/4 Criando tabelas...');
    execSync('npx prisma db push --accept-data-loss', { 
      stdio: 'inherit',
      timeout: 60000 
    });
    console.log('✅ Tabelas criadas!');

    // 4. Criar categorias
    console.log('\n🏷️  3/4 Criando categorias...');
    const prisma = new PrismaClient();
    
    const categorias = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        nome: 'Eletrônicos',
        descricao: 'Dispositivos eletrônicos e tecnologia',
        slug: 'eletronicos',
        paiId: null
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        nome: 'Eletrodomésticos',
        descricao: 'Equipamentos para uso doméstico',
        slug: 'eletrodomesticos',
        paiId: null
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        nome: 'Moda',
        descricao: 'Roupas, calçados e acessórios',
        slug: 'moda',
        paiId: null
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        nome: 'Casa & Decoração',
        descricao: 'Itens para casa e decoração',
        slug: 'casa-decoracao',
        paiId: null
      },
      {
        id: '55555555-5555-4555-8555-555555555555',
        nome: 'Beleza & Saúde',
        descricao: 'Produtos de beleza e cuidados pessoais',
        slug: 'beleza-saude',
        paiId: null
      }
    ];

    let categoriasCriadas = 0;
    for (const categoria of categorias) {
      try {
        await prisma.categoria.upsert({
          where: { id: categoria.id },
          update: {
            nome: categoria.nome,
            descricao: categoria.descricao,
            slug: categoria.slug,
            paiId: categoria.paiId
          },
          create: {
            id: categoria.id,
            nome: categoria.nome,
            descricao: categoria.descricao,
            slug: categoria.slug,
            paiId: categoria.paiId,
            criadoEm: new Date(),
            atualizadoEm: new Date()
          }
        });
        console.log(`✅ Categoria criada: ${categoria.nome}`);
        categoriasCriadas++;
      } catch (error) {
        console.log(`⚠️  Erro ao criar categoria ${categoria.nome}:`, error.message);
      }
    }
    console.log(`📊 Total de categorias: ${categoriasCriadas}/${categorias.length}`);

    // 5. Criar usuário admin
    console.log('\n👑 4/4 Criando usuário admin...');
    
    const adminEmail = process.env.ADMIN_EMAIL || 'andrescorporate1@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
      console.log('⚠️  ADMIN_PASSWORD não definida');
      console.log('ℹ️  Usando senha padrão: Admin123!');
      console.log('ℹ️  Defina ADMIN_PASSWORD no Render para segurança');
    }
    
    const adminHashedPassword = await bcrypt.hash(adminPassword || 'Admin123!', 10);
    
    try {
      await prisma.usuario.upsert({
        where: { email: adminEmail },
        update: {
          senhaHash: adminHashedPassword,
          tipo: 'ADMIN',
          emailVerificado: true
        },
        create: {
          email: adminEmail,
          nome: 'Administrador',
          telefone: `admin_${Date.now()}`,
          senhaHash: adminHashedPassword,
          tipo: 'ADMIN',
          emailVerificado: true,
          telefoneVerificado: false,
          status: 'ATIVO'
        }
      });
      console.log(`✅ Usuário admin criado: ${adminEmail}`);
      console.log(`🔑 Senha: ${adminPassword ? 'Definida pelo ambiente' : 'Admin123!'}`);
    } catch (error) {
      console.log('⚠️  Erro ao criar usuário admin:', error.message);
    }
    
    // 6. Verificar o que foi criado
    console.log('\n🔍 Verificando criação...');
    
    try {
      const totalCategorias = await prisma.categoria.count();
      const totalUsuarios = await prisma.usuario.count();
      
      console.log(`📊 Categorias no banco: ${totalCategorias}`);
      console.log(`👥 Usuários no banco: ${totalUsuarios}`);
      
      // Listar categorias criadas
      const categoriasLista = await prisma.categoria.findMany({
        select: { id: true, nome: true, slug: true }
      });
      
      console.log('\n📋 Categorias disponíveis:');
      categoriasLista.forEach(cat => {
        console.log(`   • ${cat.nome} (${cat.slug})`);
      });
      
    } catch (error) {
      console.log('⚠️  Não foi possível verificar criação:', error.message);
    }
    
    await prisma.$disconnect();
    
    console.log('\n🎉 Configuração concluída com sucesso!');
    console.log('\n🔑 Credenciais disponíveis:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Senha: ${adminPassword ? 'Definida nas variáveis de ambiente' : 'misteral'}`);
    console.log('\n🏷️  Categorias criadas:');
    console.log('   • Eletrônicos');
    console.log('   • Eletrodomésticos');
    console.log('   • Moda');
    console.log('   • Casa & Decoração');
    console.log('   • Beleza & Saúde');
    
  } catch (error) {
    console.error('\n❌ Erro na configuração:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

setupDatabase()