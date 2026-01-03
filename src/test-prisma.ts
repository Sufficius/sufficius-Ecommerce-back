// src/test-simple.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function simpleTest() {
  try {
    console.log('🧪 Teste simples do Prisma Client')
    
    const agora = new Date()
    
    // Apenas criar um usuário
    const user = await prisma.usuario.create({
      data: {
        id: 'simple-test-1',
        email: 'simple@test.com',
        telefone: '11988887777',
        nome: 'Teste Simples',
        senhaHash: 'hash123',
        atualizadoEm: agora,
      }
    })
    
    console.log('✅ Usuário criado com ID:', user.id)
    
    // Contar usuários
    const count = await prisma.usuario.count()
    console.log('📊 Total de usuários:', count)
    
  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

simpleTest()