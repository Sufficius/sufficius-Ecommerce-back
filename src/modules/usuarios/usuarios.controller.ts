import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Tipos para as requisições
interface CriarUsuarioBody {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
  tipo?: string;
}

interface LoginBody {
  email: string;
  senha: string;
}

interface AtualizarUsuarioBody {
  nome?: string;
  email?: string;
  telefone?: string;
  senha?: string;
  tipo?: string;
}

interface ListarUsuariosQuery {
  page?: string;
  limit?: string;
  busca?: string;
  tipo?: string;
}

export class UsuariosController {
  // Função de validação
  private validarEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Criar novo usuário
  async criarUsuario(request: FastifyRequest<{ Body: CriarUsuarioBody }>, reply: FastifyReply) {
    try {
      const { nome, email, senha, telefone, tipo = "CLIENTE" } = request.body;
      const {id} = request.params as any;
      console.log('📝 Criando usuário:', { nome, email, tipo });

      // Validação básica
      if (!nome || !email || !senha) {
        return reply.status(400).send({
          success: false,
          error: 'Nome, email e senha são obrigatórios'
        });
      }

      if (!this.validarEmail(email)) {
        return reply.status(400).send({
          success: false,
          error: 'Email inválido'
        });
      }

      if (senha.length < 6) {
        return reply.status(400).send({
          success: false,
          error: 'Senha deve ter pelo menos 6 caracteres'
        });
      }

      if (tipo && !['CLIENTE', 'OPERADOR', 'ADMIN'].includes(tipo)) {
        return reply.status(400).send({
          success: false,
          error: 'Tipo de usuário inválido'
        });
      }

      // Verificar se email já existe
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { email }
      });

      if (usuarioExistente) {
        return reply.status(409).send({
          success: false,
          error: 'Email já cadastrado'
        });
      }

      // Criptografar senha
      const senhaCriptografada = await bcrypt.hash(senha, 10);

      // Criar usuário
      const novoUsuario = await prisma.usuario.create({
        data: {
          nome,
          email,
          senhaHash: senhaCriptografada,
          telefone: telefone || "",
          tipo: "CLIENTE",
          id:id
        },
        select: {
          id: true,
          nome: true,
          email: true,
          telefone: true,
          tipo: true,
          criadoEm: true,
          atualizadoEm: true
        }
      });

      return reply.status(201).send({
        success: true,
        message: 'Usuário criado com sucesso',
        data: novoUsuario
      });

    } catch (error) {
      console.error('❌ Erro ao criar usuário:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  // Listar todos os usuários (com paginação)
  async listarUsuarios(request: FastifyRequest<{ Querystring: ListarUsuariosQuery }>, reply: FastifyReply) {
    try {
      const { page = '1', limit = '10', busca, tipo } = request.query;
      
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;

      console.log('📋 Listando usuários:', { page: pageNumber, limit: limitNumber, busca, tipo });

      // Construir condições de busca
      const whereClause: any = {};
      
      if (busca) {
        whereClause.OR = [
          { nome: { contains: busca, mode: 'insensitive' } },
          { email: { contains: busca, mode: 'insensitive' } }
        ];
      }

      if (tipo && tipo !== 'todos') {
        whereClause.tipo = tipo;
      }

      console.log('Where clause:', whereClause);

      // Buscar usuários
      const [usuarios, total] = await Promise.all([
        prisma.usuario.findMany({
          where: whereClause,
          select: {
            id: true,
            nome: true,
            email: true,
            telefone: true,
            tipo: true,
            criadoEm: true,
            atualizadoEm: true
          },
          skip,
          take: limitNumber,
          orderBy: { criadoEm: 'desc' }
        }),
        prisma.usuario.count({ where: whereClause })
      ]);

      console.log(`✅ Encontrados ${usuarios.length} usuários de ${total} total`);

      // Formatar resposta para o frontend
      return reply.send({
        success: true,
        data: usuarios.map(usuario => ({
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          telefone: usuario.telefone,
          tipo: usuario.tipo,
          status: 'ativo', // Adicione lógica real se necessário
          criadoEm: usuario.criadoEm.toISOString(),
          atualizadoEm: usuario.atualizadoEm.toISOString()
        })),
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          totalPages: Math.ceil(total / limitNumber)
        }
      });

    } catch (error) {
      console.error('❌ Erro ao listar usuários:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  // Obter usuário por ID
  async obterUsuarioPorId(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const { id } = request.params;

      console.log('🔍 Buscando usuário ID:', id);

      const usuario = await prisma.usuario.findUnique({
        where: { id: id },
        select: {
          id: true,
          nome: true,
          email: true,
          telefone: true,
          tipo: true,
          criadoEm: true,
          atualizadoEm: true
        }
      });

      if (!usuario) {
        return reply.status(404).send({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      return reply.send({
        success: true,
        data: usuario
      });

    } catch (error) {
      console.error('❌ Erro ao obter usuário:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  // Atualizar usuário
  async atualizarUsuario(
    request: FastifyRequest<{
      Params: { id: string };
      Body: AtualizarUsuarioBody;
    }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params;
      const { nome, email, telefone, senha, tipo } = request.body;

      console.log('✏️ Atualizando usuário ID:', id, { nome, email, tipo });

      // Verificar se usuário existe
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { id: id }
      });

      if (!usuarioExistente) {
        return reply.status(404).send({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      // Preparar dados para atualização
      const dadosAtualizacao: any = {};
      
      if (nome) dadosAtualizacao.nome = nome;
      if (telefone !== undefined) dadosAtualizacao.telefone = telefone;
      
      if (tipo && ['CLIENTE', 'OPERADOR', 'ADMIN'].includes(tipo)) {
        dadosAtualizacao.tipo = tipo;
      }
      
      // Verificar se email já existe (se estiver sendo alterado)
      if (email && email !== usuarioExistente.email) {
        if (!this.validarEmail(email)) {
          return reply.status(400).send({
            success: false,
            error: 'Email inválido'
          });
        }

        const emailExistente = await prisma.usuario.findUnique({
          where: { email }
        });
        
        if (emailExistente) {
          return reply.status(409).send({
            success: false,
            error: 'Email já está em uso por outro usuário'
          });
        }
        dadosAtualizacao.email = email;
      }

      // Se houver senha, criptografar
      if (senha) {
        if (senha.length < 6) {
          return reply.status(400).send({
            success: false,
            error: 'Senha deve ter pelo menos 6 caracteres'
          });
        }
        dadosAtualizacao.senhaHash = await bcrypt.hash(senha, 10);
      }

      // Atualizar usuário
      const usuarioAtualizado = await prisma.usuario.update({
        where: { id: id },
        data: dadosAtualizacao,
        select: {
          id: true,
          nome: true,
          email: true,
          telefone: true,
          tipo: true,
          criadoEm: true,
          atualizadoEm: true
        }
      });

      return reply.send({
        success: true,
        message: 'Usuário atualizado com sucesso',
        data: usuarioAtualizado
      });

    } catch (error) {
      console.error('❌ Erro ao atualizar usuário:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  // Deletar usuário
  async deletarUsuario(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const { id } = request.params;

      console.log('🗑️ Deletando usuário ID:', id);

      // Verificar se usuário existe
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { id: id }
      });

      if (!usuarioExistente) {
        return reply.status(404).send({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      // Não permitir deletar o próprio usuário admin (se necessário)
      // const usuarioLogado = (request as any).usuarioId;
      // if (usuarioLogado === id) {
      //   return reply.status(400).send({
      //     success: false,
      //     error: 'Não é possível deletar seu próprio usuário'
      //   });
      // }

      // Deletar usuário
      await prisma.usuario.delete({
        where: { id: id }
      });

      return reply.send({
        success: true,
        message: 'Usuário deletado com sucesso'
      });

    } catch (error) {
      console.error('❌ Erro ao deletar usuário:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  // Login de usuário
  async login(request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) {
    try {
      const { email, senha } = request.body;

      console.log('🔐 Login para email:', email);

      // Validação
      if (!email || !senha) {
        return reply.status(400).send({
          success: false,
          error: 'Email e senha são obrigatórios'
        });
      }

      if (!this.validarEmail(email)) {
        return reply.status(400).send({
          success: false,
          error: 'Email inválido'
        });
      }

      // Buscar usuário
      const usuario = await prisma.usuario.findUnique({
        where: { email }
      });

      if (!usuario) {
        return reply.status(401).send({
          success: false,
          error: 'Credenciais inválidas'
        });
      }

      // Verificar senha
      const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);

      if (!senhaValida) {
        return reply.status(401).send({
          success: false,
          error: 'Credenciais inválidas'
        });
      }

      // Gerar token JWT
      const token = jwt.sign(
        {
          id: usuario.id,
          email: usuario.email,
          tipo: usuario.tipo
        },
        process.env.JWT_SECRET || 'seu_segredo_jwt',
        { expiresIn: '24h' }
      );

      return reply.send({
        success: true,
        message: 'Login realizado com sucesso',
        data: {
          token,
          usuario: {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            tipo: usuario.tipo
          }
        }
      });

    } catch (error) {
      console.error('❌ Erro ao fazer login:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  // Obter perfil do usuário autenticado
  async obterPerfil(request: FastifyRequest, reply: FastifyReply) {
    try {
      // O ID do usuário vem do hook de autenticação
      const usuarioId = (request as any).usuarioId;

      if (!usuarioId) {
        return reply.status(401).send({
          success: false,
          error: 'Não autorizado'
        });
      }

      console.log('👤 Buscando perfil do usuário ID:', usuarioId);

      const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: {
          id: true,
          nome: true,
          email: true,
          telefone: true,
          tipo: true,
          criadoEm: true,
          atualizadoEm: true
        }
      });

      if (!usuario) {
        return reply.status(404).send({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      return reply.send({
        success: true,
        data: usuario
      });

    } catch (error) {
      console.error('❌ Erro ao obter perfil:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  // Método adicional: Alterar status do usuário
  async alterarStatusUsuario(request: FastifyRequest<{ 
    Params: { id: string };
    Body: { status: string }
  }>, reply: FastifyReply) {
    try {
      const { id } = request.params;
      const { status } = request.body;

      console.log('🔄 Alterando status do usuário ID:', id, 'para:', status);

      // Verificar se status é válido
      if (!['ativo', 'inativo'].includes(status)) {
        return reply.status(400).send({
          success: false,
          error: 'Status inválido. Use "ativo" ou "inativo"'
        });
      }

      // Verificar se usuário existe
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { id: id }
      });

      if (!usuarioExistente) {
        return reply.status(404).send({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      // Adicione um campo 'status' no seu modelo Prisma se necessário
      // Por enquanto, retornamos um placeholder
      return reply.send({
        success: true,
        message: `Status do usuário alterado para ${status}`,
        data: {
          id,
          status
        }
      });

    } catch (error) {
      console.error('❌ Erro ao alterar status:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  // Método adicional: Resetar senha
  async resetarSenha(request: FastifyRequest<{ 
    Params: { id: string }
  }>, reply: FastifyReply) {
    try {
      const { id } = request.params;

      console.log('🔄 Resetando senha do usuário ID:', id);

      // Verificar se usuário existe
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { id: id }
      });

      if (!usuarioExistente) {
        return reply.status(404).send({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      // Gerar senha temporária
      const senhaTemporaria = Math.random().toString(36).slice(-8);
      const senhaCriptografada = await bcrypt.hash(senhaTemporaria, 10);

      // Atualizar senha
      await prisma.usuario.update({
        where: { id: id },
        data: { senhaHash: senhaCriptografada }
      });

      return reply.send({
        success: true,
        message: 'Senha resetada com sucesso',
        data: {
          novaSenha: senhaTemporaria // Em produção, envie por email
        }
      });

    } catch (error) {
      console.error('❌ Erro ao resetar senha:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
}

export default new UsuariosController();