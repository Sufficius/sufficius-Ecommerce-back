import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import * as Joi from 'joi';

// Schema para validação de criação/atualização de usuário
const usuarioSchema = Joi.object({
  nome: Joi.string().min(3).max(100).required(),
  email: Joi.string().email().required(),
  senha: Joi.string().min(6).required(),
  telefone: Joi.string().pattern(/^[0-9]{10,11}$/).optional(),
  role: Joi.string().valid('USER', 'ADMIN').optional()
});

// Schema para validação de login
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  senha: Joi.string().required()
});

// Schema para validação de atualização de usuário (todos os campos são opcionais)
const atualizarUsuarioSchema = Joi.object({
  nome: Joi.string().min(3).max(100).optional(),
  email: Joi.string().email().optional(),
  senha: Joi.string().min(6).optional(),
  telefone: Joi.string().pattern(/^[0-9]{10,11}$/).optional(),
  role: Joi.string().valid('USER', 'ADMIN').optional()
});

export const validarDadosUsuario = (
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
) => {
  const { error } = usuarioSchema.validate(request.body);
  
  if (error) {
    return reply.status(400).send({
      erro: error.details[0].message
    });
  }
  
  done();
};

export const validarLogin = (
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
) => {
  const { error } = loginSchema.validate(request.body);
  
  if (error) {
    return reply.status(400).send({
      erro: error.details[0].message
    });
  }
  
  done();
};

export const validarAtualizacaoUsuario = (
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
) => {
  const { error } = atualizarUsuarioSchema.validate(request.body);
  
  if (error) {
    return reply.status(400).send({
      erro: error.details[0].message
    });
  }
  
  done();
};

// Validação simplificada sem Joi (alternativa)
export const validarDadosUsuarioSimples = (
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
) => {
  const body = request.body as any;
  
  if (!body.nome || !body.email || !body.senha) {
    return reply.status(400).send({
      erro: 'Nome, email e senha são obrigatórios'
    });
  }

  if (body.nome.length < 3) {
    return reply.status(400).send({
      erro: 'Nome deve ter pelo menos 3 caracteres'
    });
  }

  if (body.senha.length < 6) {
    return reply.status(400).send({
      erro: 'Senha deve ter pelo menos 6 caracteres'
    });
  }

  if (body.role && !['USER', 'ADMIN'].includes(body.role)) {
    return reply.status(400).send({
      erro: 'Role deve ser USER ou ADMIN'
    });
  }

  done();
};