// src/modules/enderecos/enderecos.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';

interface CriarEnderecoBody {
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  pais?: string;
  padrao?: boolean;
}

interface AtualizarEnderecoBody {
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  pais?: string;
  padrao?: boolean;
}

interface UpdateAddressRoute {
  Params: {
    id: string;
  };
  Body: {
    street: string;
    city: string;
    zipCode: string;
  };
  Reply: {
    200: { success: boolean };
    400: { error: string };
  };
}

export class EnderecosController {
  async listarEnderecosUsuario(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const usuario = (request.user as any);

      const enderecos = await prisma.endereco.findMany({
        where: { usuarioId: usuario.id },
        orderBy: [
          { padrao: 'desc' },
          { criadoEm: 'desc' }
        ]
      });

      reply.send({
        success: true,
        data: enderecos,
        total: enderecos.length
      });
    } catch (error) {
      console.error('Erro ao listar endereços:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao listar endereços'
      });
    }
  }

  async criarEndereco(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const usuario = (request.user as any);
      const body = request.body as CriarEnderecoBody;
      
      const { rua, numero, complemento, bairro, cidade, estado, cep, pais, padrao } = body;

      // Validação básica
      if (!rua || !numero || !bairro || !cidade || !estado || !cep) {
        return reply.status(400).send({
          success: false,
          message: 'Campos obrigatórios não fornecidos'
        });
      }

      // Se for definir como padrão, remover padrão dos outros endereços
      if (padrao) {
        await prisma.endereco.updateMany({
          where: { 
            usuarioId: usuario.id,
            padrao: true
          },
          data: { padrao: false }
        });
      }

      const endereco = await prisma.endereco.create({
        data: {
          id: `end_${Date.now()}`,
          usuarioId: usuario.id,
          rua,
          numero,
          complemento,
          bairro,
          cidade,
          estado,
          cep,
          pais: pais || 'Brasil',
          padrao: padrao || false
        }
      });

      reply.status(201).send({
        success: true,
        message: 'Endereço criado com sucesso',
        data: endereco
      });
    } catch (error) {
      console.error('Erro ao criar endereço:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao criar endereço'
      });
    }
  }

  async atualizarEndereco(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const usuario = (request.user as any);
      const { id } = request.params;
      const body = request.body as AtualizarEnderecoBody;

      // Verificar se endereço existe e pertence ao usuário
      const endereco = await prisma.endereco.findFirst({
        where: { 
          id,
          usuarioId: usuario.id
        }
      });

      if (!endereco) {
        return reply.status(404).send({
          success: false,
          message: 'Endereço não encontrado'
        });
      }

      // Se for definir como padrão, remover padrão dos outros endereços
      if (body.padrao) {
        await prisma.endereco.updateMany({
          where: { 
            usuarioId: usuario.id,
            padrao: true,
            id: { not: id }
          },
          data: { padrao: false }
        });
      }

      const enderecoAtualizado = await prisma.endereco.update({
        where: { id },
        data: {
          ...body,
          atualizadoEm: new Date()
        }
      });

      reply.send({
        success: true,
        message: 'Endereço atualizado com sucesso',
        data: enderecoAtualizado
      });
    } catch (error) {
      console.error('Erro ao atualizar endereço:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao atualizar endereço'
      });
    }
  }

  async definirEnderecoPadrao(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const usuario = (request.user as any);
      const { id } = request.params;

      // Verificar se endereço existe e pertence ao usuário
      const endereco = await prisma.endereco.findFirst({
        where: { 
          id,
          usuarioId: usuario.id
        }
      });

      if (!endereco) {
        return reply.status(404).send({
          success: false,
          message: 'Endereço não encontrado'
        });
      }

      // Remover padrão dos outros endereços
      await prisma.endereco.updateMany({
        where: { 
          usuarioId: usuario.id,
          padrao: true,
          id: { not: id }
        },
        data: { padrao: false }
      });

      // Definir este como padrão
      const enderecoAtualizado = await prisma.endereco.update({
        where: { id },
        data: { 
          padrao: true,
          atualizadoEm: new Date()
        }
      });

      reply.send({
        success: true,
        message: 'Endereço definido como padrão',
        data: enderecoAtualizado
      });
    } catch (error) {
      console.error('Erro ao definir endereço padrão:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao definir endereço padrão'
      });
    }
  }

  async deletarEndereco(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const usuario = (request.user as any);
      const { id } = request.params;

      // Verificar se endereço existe e pertence ao usuário
      const endereco = await prisma.endereco.findFirst({
        where: { 
          id,
          usuarioId: usuario.id
        },
        include: {
          pedido: {
            take: 1
          }
        }
      });

      if (!endereco) {
        return reply.status(404).send({
          success: false,
          message: 'Endereço não encontrado'
        });
      }

      // Verificar se há pedidos associados
      if (endereco.pedido.length > 0) {
        return reply.status(400).send({
          success: false,
          message: 'Não é possível deletar endereço com pedidos associados'
        });
      }

      await prisma.endereco.delete({
        where: { id }
      });

      // Se era o endereço padrão, definir outro como padrão
      if (endereco.padrao) {
        const outroEndereco = await prisma.endereco.findFirst({
          where: { 
            usuarioId: usuario.id,
            id: { not: id }
          }
        });

        if (outroEndereco) {
          await prisma.endereco.update({
            where: { id: outroEndereco.id },
            data: { padrao: true }
          });
        }
      }

      reply.send({
        success: true,
        message: 'Endereço deletado com sucesso'
      });
    } catch (error) {
      console.error('Erro ao deletar endereço:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao deletar endereço'
      });
    }
  }
}