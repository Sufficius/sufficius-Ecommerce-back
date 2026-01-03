// src/modules/pedidos/pedidos.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';

export class PedidosController {
    async meusPedidos(
        request: FastifyRequest<{
            Querystring: {
                page?: string;
                limit?: string;
                status?: string;
            }
        }>,
        reply: FastifyReply
    ) {
        try {
            const usuario = request.user as any;
            const { page = '1', limit = '10', status } = request.query;

            const pagina = parseInt(page);
            const limite = parseInt(limit);
            const skip = (pagina - 1) * limite;

            const where: any = { usuarioId: usuario.id };
            if (status) where.status = status;

            const [pedidos, total] = await Promise.all([
                prisma.pedido.findMany({
                    where,
                    include: {
                        itempedido: {
                            include: {
                                produto: {
                                    select: {
                                        id: true,
                                        nome: true,
                                        imagemproduto: {
                                            where: { principal: true },
                                            take: 1
                                        }
                                    }
                                }
                            }
                        },
                        endereco: true,
                        pagamento: true
                    },
                    orderBy: { criadoEm: 'desc' },
                    skip,
                    take: limite
                }),
                prisma.pedido.count({ where })
            ]);

            reply.send({
                success: true,
                data: pedidos,
                total,
                page: pagina,
                totalPages: Math.ceil(total / limite)
            });
        } catch (error) {
            console.error('Erro ao listar meus pedidos:', error);
            reply.status(500).send({
                success: false,
                message: 'Erro ao listar pedidos'
            });
        }
    }

    async buscarPedidoPorId(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        try {
            const usuario = request.user as any;
            const { id } = request.params;

            const pedido = await prisma.pedido.findUnique({
                where: { id },
                include: {
                    itempedido: {
                        include: {
                            produto: {
                                include: {
                                    imagemproduto: true
                                }
                            },
                            pedido: true
                        }
                    },
                    endereco: true,
                    pagamento: true,
                    usuario: {
                        select: {
                            id: true,
                            nome: true,
                            email: true
                        }
                    }
                }
            });

            if (!pedido) {
                return reply.status(404).send({
                    success: false,
                    message: 'Pedido não encontrado'
                });
            }

            // Verificar se usuário tem permissão (é dono ou admin)
            if (pedido.usuarioId !== usuario.id && usuario.tipo !== 'ADMIN') {
                return reply.status(403).send({
                    success: false,
                    message: 'Você não tem permissão para ver este pedido'
                });
            }

            reply.send({
                success: true,
                data: pedido
            });
        } catch (error) {
            console.error('Erro ao buscar pedido:', error);
            reply.status(500).send({
                success: false,
                message: 'Erro ao buscar pedido'
            });
        }
    }

    async criarPedido(
        request: FastifyRequest<{
            Body: {
                enderecoId: string;
                metodoPagamento: string;
                observacoes?: string;
                cupom?: string;
            }
        }>,
        reply: FastifyReply
    ) {
        try {
            const usuario = request.user as any;
            const { enderecoId, metodoPagamento, observacoes, cupom } = request.body;

            // Buscar carrinho do usuário
            const carrinho = await prisma.carrinho.findUnique({
                where: { usuarioId: usuario.id },
                include: {
                    itemcarrinho: {
                        include: {
                            produto: {
                                select: {
                                    id: true,
                                    nome: true,
                                    preco: true,
                                    precoDesconto: true,
                                    estoque: true
                                }
                            },
                            carrinho: {
                                select: {
                                    id: true,
                                    usuario: true,
                                    itemcarrinho: true,
                                    usuarioId: true
                                }
                            }
                        }
                    }
                }
            });

            if (!carrinho || carrinho.itemcarrinho.length === 0) {
                return reply.status(400).send({
                    success: false,
                    message: 'Carrinho está vazio'
                });
            }

            // Verificar endereço
            const endereco = await prisma.endereco.findFirst({
                where: {
                    id: enderecoId,
                    usuarioId: usuario.id
                }
            });

            if (!endereco) {
                return reply.status(400).send({
                    success: false,
                    message: 'Endereço não encontrado'
                });
            }

            // Verificar estoque e calcular valores
            let subtotal = 0;
            let valorDesconto = 0;

            for (const item of carrinho.itemcarrinho) {
                const estoqueDisponivel = item.produto?.estoque || item.produto.estoque;

                if (estoqueDisponivel < item.quantidade) {
                    return reply.status(400).send({
                        success: false,
                        message: `Produto "${item.produto.nome}" está com estoque insuficiente`
                    });
                }

                const preco = item.produto?.preco || item.produto.precoDesconto || item.produto.preco;
                subtotal += preco * item.quantidade;
            }

            // Cálculos simplificados (em produção, calcular frete e impostos reais)
            const frete = 15.00; // Valor fixo de exemplo
            const imposto = subtotal * 0.12; // 12% de imposto

            // Aplicar cupom se existir
            if (cupom) {
                const cupomValido = await prisma.cupom.findFirst({
                    where: {
                        codigo: cupom,
                        ativo: true,
                        validoAte: { gte: new Date() },
                    }
                });

                if (cupomValido) {
                    if (cupomValido.tipo === 'PERCENTUAL') {
                        valorDesconto = subtotal * (cupomValido.valor / 100);
                    } else {
                        valorDesconto = cupomValido.valor;
                    }

                    // Atualizar contador de uso
                    await prisma.cupom.update({
                        where: { id: cupomValido.id },
                        data: {
                            usado: (cupomValido.usado || 0) + 1
                        }
                    });
                }
            }

            const total = subtotal + frete + imposto - valorDesconto;

            // Gerar número do pedido
            const numeroPedido = `PED${Date.now()}${Math.floor(Math.random() * 1000)}`;

            // Criar pedido
            const pedido = await prisma.$transaction(async (tx) => {
                // Criar pedido
                const novoPedido = await tx.pedido.create({
                    data: {
                        id: `ped_${Date.now()}`,
                        numeroPedido,
                        usuarioId: usuario.id,
                        enderecoId,
                        status: 'PAGAMENTO_PENDENTE',
                        subtotal,
                        frete,
                        imposto,
                        desconto: valorDesconto,
                        total,
                        metodoEnvio: 'CORREIOS',
                        observacoes
                    }
                });

                // Criar itens do pedido
                for (const item of carrinho.itemcarrinho) {
                    const preco = item.produto?.preco || item.produto.precoDesconto || item.produto.preco;

                    await tx.itempedido.create({
                        data: {
                            id: `itemp_${Date.now()}_${Math.random()}`,
                            pedidoId: novoPedido.id,
                            produtoId: item.produtoId,
                            quantidade: item.quantidade,
                            precoUnitario: preco,
                            precoTotal: preco * item.quantidade
                        }
                    });

                    // Atualizar estoque
                    if (item.id) {
                        await tx.produto.update({
                            where: { id: item.id },
                            data: {
                                estoque: { decrement: item.quantidade }
                            }
                        });
                    } else {
                        await tx.produto.update({
                            where: { id: item.produtoId },
                            data: {
                                estoque: { decrement: item.quantidade }
                            }
                        });
                    }
                }

                // Limpar carrinho
                await tx.itemcarrinho.deleteMany({
                    where: { carrinhoId: carrinho.id }
                });

                return novoPedido;
            });

            // Criar pagamento associado
            const pagamento = await prisma.pagamento.create({
                data: {
                    id: `pag_${Date.now()}`,
                    pedidoId: pedido.id,
                    metodoPagamento,
                    gatewayPagamento: 'MERCADOPAGO', // Ajuste conforme seu gateway
                    valor: pedido.total,
                    status: 'PENDENTE'
                }
            });

            reply.status(201).send({
                success: true,
                message: 'Pedido criado com sucesso',
                data: {
                    pedido,
                    pagamento
                },
                pagamentoUrl: `/pagamentos/${pagamento.id}/processar`
            });
        } catch (error) {
            console.error('Erro ao criar pedido:', error);
            reply.status(500).send({
                success: false,
                message: 'Erro ao criar pedido'
            });
        }
    }

    async cancelarPedido(
        request: FastifyRequest<{
            Params: { id: string };
            Body: { motivo: string };
        }>,
        reply: FastifyReply
    ) {
        try {
            const usuario = request.user as any;
            const { id } = request.params;
            const { motivo } = request.body;

            // Buscar pedido
            const pedido = await prisma.pedido.findUnique({
                where: { id },
                include: {
                    itempedido: true,
                    pagamento: true
                }
            });

            if (!pedido) {
                return reply.status(404).send({
                    success: false,
                    message: 'Pedido não encontrado'
                });
            }

            // Verificar permissão
            if (pedido.usuarioId !== usuario.id && usuario.tipo !== 'ADMIN') {
                return reply.status(403).send({
                    success: false,
                    message: 'Você não tem permissão para cancelar este pedido'
                });
            }

            // Verificar se pode cancelar
            if (!['PAGAMENTO_PENDENTE', 'AGUARDANDO_PAGAMENTO', 'PROCESSANDO'].includes(pedido.status)) {
                return reply.status(400).send({
                    success: false,
                    message: 'Este pedido não pode ser cancelado no status atual'
                });
            }

            // Atualizar pedido
            const pedidoAtualizado = await prisma.$transaction(async (tx) => {
                const pedidoUpdate = await tx.pedido.update({
                    where: { id },
                    data: {
                        status: 'CANCELADO'
                    }
                });

                // Devolver itens ao estoque
                for (const item of pedido.itempedido) {
                    if (item.id) {
                        await tx.produto.update({
                            where: { id: item.id },
                            data: {
                                estoque: { increment: item.quantidade }
                            }
                        });
                    } else {
                        await tx.produto.update({
                            where: { id: item.produtoId },
                            data: {
                                estoque: { increment: item.quantidade }
                            }
                        });
                    }
                }

                // Cancelar pagamento se existir
                if (pedido.pagamento.length > 0) {
                    await tx.pagamento.updateMany({
                        where: { pedidoId: id },
                        data: {
                            status: 'CANCELADO'
                        }
                    });
                }

                return pedidoUpdate;
            });

            reply.send({
                success: true,
                message: 'Pedido cancelado com sucesso',
                data: pedidoAtualizado
            });
        } catch (error) {
            console.error('Erro ao cancelar pedido:', error);
            reply.status(500).send({
                success: false,
                message: 'Erro ao cancelar pedido'
            });
        }
    }

    // Métodos para administradores

    async listarPedidos(
        request: FastifyRequest<{
            Querystring: {
                page?: string;
                limit?: string;
                status?: string;
                dataInicio?: string;
                dataFim?: string;
            }
        }>,
        reply: FastifyReply
    ) {
        try {
            const { page = '1', limit = '20', status, dataInicio, dataFim } = request.query;

            const pagina = parseInt(page);
            const limite = parseInt(limit);
            const skip = (pagina - 1) * limite;

            const where: any = {};
            if (status) where.status = status;

            if (dataInicio || dataFim) {
                where.criadoEm = {};
                if (dataInicio) where.criadoEm.gte = new Date(dataInicio);
                if (dataFim) where.criadoEm.lte = new Date(dataFim);
            }

            const [pedidos, total] = await Promise.all([
                prisma.pedido.findMany({
                    where,
                    include: {
                        usuario: {
                            select: {
                                id: true,
                                nome: true,
                                email: true
                            }
                        },
                        pagamento: true
                    },
                    orderBy: { criadoEm: 'desc' },
                    skip,
                    take: limite
                }),
                prisma.pedido.count({ where })
            ]);

            reply.send({
                success: true,
                data: pedidos,
                total,
                page: pagina,
                totalPages: Math.ceil(total / limite)
            });
        } catch (error) {
            console.error('Erro ao listar pedidos:', error);
            reply.status(500).send({
                success: false,
                message: 'Erro ao listar pedidos'
            });
        }
    }

    async atualizarStatus(
        request: FastifyRequest<{
            Params: { id: string };
            Body: {
                status: string;
                motivoCancelamento?: string;
            }
        }>,
        reply: FastifyReply
    ) {
        try {
            const { id } = request.params;
            const { status, motivoCancelamento } = request.body;

            // Verificar se pedido existe
            const pedido = await prisma.pedido.findUnique({
                where: { id }
            });

            if (!pedido) {
                return reply.status(404).send({
                    success: false,
                    message: 'Pedido não encontrado'
                });
            }

            // Validar transição de status
            const statusValidos = [
                'PAGAMENTO_PENDENTE', 'AGUARDANDO_PAGAMENTO', 'PROCESSANDO',
                'ENVIADO', 'ENTREGUE', 'CANCELADO'
            ];

            if (!statusValidos.includes(status)) {
                return reply.status(400).send({
                    success: false,
                    message: 'Status inválido'
                });
            }

            // Atualizar pedido
            const dadosAtualizacao: any = { status };

            const pedidoAtualizado = await prisma.pedido.update({
                where: { id },
                data: dadosAtualizacao
            });

            // Registrar histórico
            await prisma.historicostatuspedido.create({
                data: {
                    id: `hist_${Date.now()}`,
                    pedidoId: id,
                    status: "PROCESSANDO",
                    alteradoEm: new Date()
                }
            });

            reply.send({
                success: true,
                message: 'Status do pedido atualizado',
                data: pedidoAtualizado
            });
        } catch (error) {
            console.error('Erro ao atualizar status do pedido:', error);
            reply.status(500).send({
                success: false,
                message: 'Erro ao atualizar status do pedido'
            });
        }
    }

    async getEstatisticas(
        request: FastifyRequest<{
            Querystring: {
                dataInicio?: string;
                dataFim?: string;
            }
        }>,
        reply: FastifyReply
    ) {
        try {
            const { dataInicio, dataFim } = request.query;

            const where: any = {};
            if (dataInicio || dataFim) {
                where.criadoEm = {};
                if (dataInicio) where.criadoEm.gte = new Date(dataInicio);
                if (dataFim) where.criadoEm.lte = new Date(dataFim);
            }

            // Total de pedidos
            const totalPedidos = await prisma.pedido.count({ where });

            // Total de vendas (excluindo cancelados)
            const totalVendasResult = await prisma.pedido.aggregate({
                where: {
                    ...where,
                    status: { notIn: ['CANCELADO', 'PAGAMENTO_PENDENTE'] }
                },
                _sum: { total: true }
            });

            // Pedidos por status
            const pedidosPorStatus = await prisma.pedido.groupBy({
                by: ['status'],
                where,
                _count: true
            });

            // Vendas por período (últimos 30 dias)
            const trintaDiasAtras = new Date();
            trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

            const vendasPorPeriodo = await prisma.pedido.groupBy({
                by: ['criadoEm'],
                where: {
                    criadoEm: { gte: trintaDiasAtras },
                    status: { notIn: ['CANCELADO', 'PAGAMENTO_PENDENTE'] }
                },
                _sum: { total: true },
                orderBy: { criadoEm: 'asc' }
            });

            const formattedVendas = vendasPorPeriodo.map(v => ({
                data: v.criadoEm.toISOString().split('T')[0],
                total: v._sum.total || 0
            }));

            reply.send({
                success: true,
                data: {
                    totalPedidos,
                    totalVendas: totalVendasResult._sum.total || 0,
                    pedidosPorStatus: pedidosPorStatus.reduce((acc, item) => {
                        acc[item.status] = item._count;
                        return acc;
                    }, {} as Record<string, number>),
                    vendasPorPeriodo: formattedVendas
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
}