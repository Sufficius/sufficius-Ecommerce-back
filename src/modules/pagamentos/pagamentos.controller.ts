// src/modules/pagamentos/pagamentos.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';

export class PagamentosController {
  async criarPagamento(
    request: FastifyRequest<{
      Body: {
        pedidoId: string;
        metodoPagamento: string;
        parcelas?: number;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const usuario = request.user as any;
      const { pedidoId, metodoPagamento, parcelas = 1 } = request.body;

      // Verificar se pedido existe e pertence ao usuário
      const pedido = await prisma.pedido.findUnique({
        where: { id: pedidoId },
        include: {
          usuario: true
        }
      });

      if (!pedido) {
        return reply.status(400).send({
          success: false,
          message: 'Pedido não encontrado'
        });
      }

      if (pedido.usuarioId !== usuario.id) {
        return reply.status(403).send({
          success: false,
          message: 'Você não tem permissão para pagar este pedido'
        });
      }

      // Verificar se pedido já está pago
      if (pedido.status !== 'PAGAMENTO_PENDENTE') {
        return reply.status(400).send({
          success: false,
          message: 'Pedido não está aguardando pagamento'
        });
      }

      // Verificar se já existe pagamento para este pedido
      const pagamentoExistente = await prisma.pagamento.findFirst({
        where: { pedidoId }
      });

      if (pagamentoExistente) {
        return reply.status(400).send({
          success: false,
          message: 'Já existe um pagamento para este pedido'
        });
      }

      // Determinar gateway baseado no método
      let gatewayPagamento = 'INTERNO';
      switch (metodoPagamento) {
        case 'PIX':
          gatewayPagamento = 'PIX';
          break;
        case 'CARTAO_CREDITO':
        case 'CARTAO_DEBITO':
          gatewayPagamento = 'MERCADOPAGO';
          break;
        case 'BOLETO':
          gatewayPagamento = 'PAGSEGURO';
          break;
      }

      // Criar registro de pagamento
      const pagamento = await prisma.pagamento.create({
        data: {
          id: `pag_${Date.now()}`,
          pedidoId,
          metodoPagamento,
          gatewayPagamento,
          valor: pedido.total,
          status: 'PENDENTE'
        }
      });

      // Simular diferentes tipos de pagamento
      let responseData: any = {
        success: true,
        message: 'Pagamento criado com sucesso',
        data: pagamento
      };

      switch (metodoPagamento) {
        case 'PIX':
          // Gerar dados do PIX (simulado)
          responseData.pixCopyPaste = `00020126580014BR.GOV.BCB.PIX0136${pedidoId}`;
          responseData.qrCode = `data:image/png;base64,simulated_qr_code_${pedidoId}`;
          break;

        case 'CARTAO_CREDITO':
          // URL para checkout de cartão
          responseData.paymentUrl = `/checkout/cartao?pedido=${pedidoId}`;
          break;

        case 'BOLETO':
          // Gerar boleto
          responseData.paymentUrl = `/boleto/gerar?pedido=${pedidoId}`;
          responseData.codigoBarras = '23790.12345 67890.123456 78901.234567 8 87650000012345';
          break;
      }

      // Atualizar status do pedido
      await prisma.pedido.update({
        where: { id: pedidoId },
        data: { status: 'PAGAMENTO_PENDENTE' }
      });

      reply.send(responseData);
    } catch (error) {
      console.error('Erro ao criar pagamento:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao criar pagamento'
      });
    }
  }

  async webhookPagamento(
    request: FastifyRequest<{
      Params: { gateway: string };
      Body: any;
      Headers: { [key: string]: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { gateway } = request.params;
      const notification = request.body as any;

      console.log(`Webhook recebido do gateway: ${gateway}`, notification);

      // Processar notificação baseada no gateway
      let pagamentoId: string | null = null;
      let status: string = 'PENDENTE';

      if (gateway === 'mercadopago') {
        // Exemplo para Mercado Pago
        const { type, data } = notification;

        if (type === 'payment') {
          const paymentId = data.id;
          
          // Em produção, você buscaria o pagamento pelo gatewayId
          pagamentoId = paymentId;
          status = 'APROVADO'; // Simulado
        }
      } else if (gateway === 'pagseguro') {
        // Exemplo para PagSeguro
        const { notificationCode, notificationType } = notification;

        if (notificationType === 'transaction') {
          // Em produção, você buscaria detalhes da transação
          pagamentoId = notificationCode;
          status = 'APROVADO'; // Simulado
        }
      }

      if (pagamentoId) {
        // Buscar pagamento pelo ID externo (gatewayId)
        const pagamento = await prisma.pagamento.findFirst({
          where: {
            gatewayId: pagamentoId
          },
          include: {
            pedido: true
          }
        });

        if (pagamento) {
          // Atualizar status do pagamento
          const pagamentoAtualizado = await prisma.pagamento.update({
            where: { id: pagamento.id },
            data: {
              status: status as any,
              processadoEm: new Date()
            }
          });

          // Atualizar status do pedido se pagamento aprovado
          if (status === 'APROVADO') {
            await prisma.pedido.update({
              where: { id: pagamento.pedidoId },
              data: { status: 'PROCESSANDO' }
            });
          }
        }
      }

      reply.send({ received: true });
    } catch (error) {
      console.error('Erro ao processar webhook:', error);
      reply.status(500).send({ received: false });
    }
  }

  async verificarPagamento(
    request: FastifyRequest<{ Params: { pagamentoId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const usuario = request.user as any;
      const { pagamentoId } = request.params;

      // Buscar pagamento
      const pagamento = await prisma.pagamento.findUnique({
        where: { id: pagamentoId },
        include: {
          pedido: {
            include: {
              usuario: true
            }
          }
        }
      });

      if (!pagamento) {
        return reply.status(404).send({
          success: false,
          message: 'Pagamento não encontrado'
        });
      }

      // Verificar permissão
      if (pagamento.pedido.usuarioId !== usuario.id && usuario.tipo !== 'ADMIN') {
        return reply.status(403).send({
          success: false,
          message: 'Você não tem permissão para ver este pagamento'
        });
      }

      // Aqui você verificaria o status real no gateway de pagamento
      // Este é um exemplo simulado

      reply.send({
        success: true,
        data: pagamento,
        status: pagamento.status
      });
    } catch (error) {
      console.error('Erro ao verificar pagamento:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao verificar pagamento'
      });
    }
  }

  async listarMetodosPagamento(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Lista de métodos de pagamento disponíveis
      const metodos = [
        {
          id: 'PIX',
          nome: 'PIX',
          descricao: 'Pagamento instantâneo via PIX',
          ativo: true,
          imagem: '/icons/pix.png'
        },
        {
          id: 'CARTAO_CREDITO',
          nome: 'Cartão de Crédito',
          descricao: 'Pague com cartão de crédito em até 12x',
          ativo: true,
          imagem: '/icons/credit-card.png'
        },
        {
          id: 'BOLETO',
          nome: 'Boleto Bancário',
          descricao: 'Pague com boleto bancário',
          ativo: true,
          imagem: '/icons/boleto.png'
        },
        {
          id: 'CARTAO_DEBITO',
          nome: 'Cartão de Débito',
          descricao: 'Pague com cartão de débito',
          ativo: true,
          imagem: '/icons/debit-card.png'
        }
      ];

      reply.send({
        success: true,
        data: metodos
      });
    } catch (error) {
      console.error('Erro ao listar métodos de pagamento:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao listar métodos de pagamento'
      });
    }
  }

  async listarPagamentos(
    request: FastifyRequest<{
      Querystring: {
        page?: string;
        limit?: string;
        status?: string;
        metodo?: string;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const { page = '1', limit = '20', status, metodo } = request.query;

      const pagina = parseInt(page);
      const limite = parseInt(limit);
      const skip = (pagina - 1) * limite;

      const where: any = {};
      if (status) where.status = status;
      if (metodo) where.metodoPagamento = metodo;

      const [pagamentos, total] = await Promise.all([
        prisma.pagamento.findMany({
          where,
          include: {
            pedido: {
              include: {
                usuario: {
                  select: {
                    id: true,
                    nome: true,
                    email: true
                  }
                }
              }
            }
          },
          orderBy: { criadoEm: 'desc' },
          skip,
          take: limite
        }),
        prisma.pagamento.count({ where })
      ]);

      reply.send({
        success: true,
        data: pagamentos,
        total,
        page: pagina,
        totalPages: Math.ceil(total / limite)
      });
    } catch (error) {
      console.error('Erro ao listar pagamentos:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao listar pagamentos'
      });
    }
  }

  async estornarPagamento(
    request: FastifyRequest<{
      Params: { pagamentoId: string };
      Body: { motivo?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { pagamentoId } = request.params;
      const { motivo } = request.body;

      // Buscar pagamento
      const pagamento = await prisma.pagamento.findUnique({
        where: { id: pagamentoId },
        include: {
          pedido: true
        }
      });

      if (!pagamento) {
        return reply.status(404).send({
          success: false,
          message: 'Pagamento não encontrado'
        });
      }

      // Verificar se pode estornar
      if (pagamento.status !== 'CONCLUIDO') {
        return reply.status(400).send({
          success: false,
          message: 'Somente pagamentos aprovados podem ser estornados'
        });
      }

      // Atualizar pagamento
      const pagamentoAtualizado = await prisma.pagamento.update({
        where: { id: pagamentoId },
        data: {
          status: 'REEMBOLSADO',
          metadata: motivo ? JSON.stringify({ motivoEstorno: motivo }) : undefined
        }
      });

      // Atualizar pedido
      await prisma.pedido.update({
        where: { id: pagamento.pedidoId },
        data: { status: 'CANCELADO' }
      });

      reply.send({
        success: true,
        message: 'Pagamento estornado com sucesso',
        data: pagamentoAtualizado
      });
    } catch (error) {
      console.error('Erro ao estornar pagamento:', error);
      reply.status(500).send({
        success: false,
        message: 'Erro ao estornar pagamento'
      });
    }
  }
}