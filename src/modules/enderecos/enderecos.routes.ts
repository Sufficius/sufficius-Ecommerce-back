// src/modules/enderecos/enderecos.routes.ts
import { FastifyInstance } from 'fastify';
import { EnderecosController } from './enderecos.controller';
import { authenticate } from '../../middleware/auth.middleware';

const enderecosController = new EnderecosController();

// Interfaces para cada rota
interface ListarEnderecosRoute {
  Reply: {
    200: { success: boolean; data: any[]; total: number };
  };
}

interface CriarEnderecoRoute {
  Body: {
    rua: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
    pais?: string;
    padrao?: boolean;
  };
  Reply: {
    201: { success: boolean; message: string; data: any };
  };
}

interface AtualizarEnderecoRoute {
  Params: { id: string };
  Body: {
    rua?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
    pais?: string;
    padrao?: boolean;
  };
  Reply: {
    200: { success: boolean; message: string; data: any };
  };
}

interface EnderecoPadraoRoute {
  Params: { id: string };
  Reply: {
    200: { success: boolean; message: string; data: any };
  };
}

interface DeletarEnderecoRoute {
  Params: { id: string };
  Reply: {
    200: { success: boolean; message: string };
  };
}

export default async function enderecosRoutes(app: FastifyInstance) {
  // Listar endereços do usuário
  app.get<ListarEnderecosRoute>('/', // ✅ Adicione o tipo genérico
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Endereços'],
        summary: 'Listar endereços do usuário',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array' },
              total: { type: 'number' }
            }
          }
        }
      }
    },
    enderecosController.listarEnderecosUsuario.bind(enderecosController)
  );

  // Criar endereço
  app.post<CriarEnderecoRoute>('/', // ✅ Adicione o tipo genérico
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Endereços'],
        summary: 'Criar novo endereço',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['rua', 'numero', 'bairro', 'cidade', 'estado', 'cep'],
          properties: {
            rua: { type: 'string' },
            numero: { type: 'string' },
            complemento: { type: 'string' },
            bairro: { type: 'string' },
            cidade: { type: 'string' },
            estado: { type: 'string' },
            cep: { type: 'string' },
            pais: { type: 'string', default: 'Brasil' },
            padrao: { type: 'boolean', default: false }
          }
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: { type: 'object' }
            }
          }
        }
      }
    },
    enderecosController.criarEndereco.bind(enderecosController)
  );

  // Atualizar endereço
  app.put<AtualizarEnderecoRoute>('/:id', // ✅ Adicione o tipo genérico
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Endereços'],
        summary: 'Atualizar endereço',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          properties: {
            rua: { type: 'string' },
            numero: { type: 'string' },
            complemento: { type: 'string' },
            bairro: { type: 'string' },
            cidade: { type: 'string' },
            estado: { type: 'string' },
            cep: { type: 'string' },
            pais: { type: 'string' },
            padrao: { type: 'boolean' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: { type: 'object' }
            }
          }
        }
      }
    },
    enderecosController.atualizarEndereco.bind(enderecosController)
  );

  // Definir endereço como padrão
  app.patch<EnderecoPadraoRoute>('/:id/padrao', // ✅ Adicione o tipo genérico
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Endereços'],
        summary: 'Definir endereço como padrão',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: { type: 'object' }
            }
          }
        }
      }
    },
    enderecosController.definirEnderecoPadrao.bind(enderecosController)
  );

  // Deletar endereço
  app.delete<DeletarEnderecoRoute>('/:id', // ✅ Adicione o tipo genérico
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Endereços'],
        summary: 'Deletar endereço',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    enderecosController.deletarEndereco.bind(enderecosController)
  );
}