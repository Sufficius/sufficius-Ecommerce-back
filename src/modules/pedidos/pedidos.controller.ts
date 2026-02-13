// src/modules/pedidos/pedidos.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';
import { randomUUID } from 'crypto';

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
                        ItemPedido: {
                            include: {
                                produto: {
                                    select: {
                                        id: true,
                                        nome: true,
                                        ImagemProduto: {
                                            where: { principal: true },
                                            take: 1
                                        }
                                    }
                                }
                            }
                        },
                        endereco: true,
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
                    ItemPedido: {
                        include: {
                            produto: {
                                include: {
                                    ImagemProduto: true
                                }
                            },
                            pedido: true
                        }
                    },
                    endereco: true,
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
                metodoPagamento?: string;
                observacoes?: string;
                cupom?: string;
            }
        }>,
        reply: FastifyReply
    ) {
        try {
            const usuario = request.user as any;
            const { enderecoId, metodoPagamento = "DINHEIRO_ENTREGA", observacoes, cupom } = request.body;


            if (!enderecoId) {
                return reply.status(400).send({
                    success: false,
                    message: 'Endereço é obrigatório'
                });
            }

            console.log(`📝 Criando pedido para usuário: ${usuario.id}`);
            console.log(`🏠 Endereço selecionado: ${enderecoId}`);
            console.log(`💳 Método de pagamento: ${metodoPagamento}`);


            // Buscar carrinho do usuário
            const carrinho = await prisma.carrinho.findUnique({
                where: { usuarioId: usuario.id },
                include: {
                    ItemCarrinho: {
                        include: {
                            produto: {
                                select: {
                                    id: true,
                                    nome: true,
                                    preco: true,
                                    quantidade: true,
                                }
                            }
                        }
                    }
                }
            });

            if (!carrinho) {
                return reply.status(400).send({
                    success: false,
                    message: 'Carrinho não encontrado'
                });
            }


            if (!carrinho || carrinho.ItemCarrinho.length === 0) {
                return reply.status(400).send({
                    success: false,
                    message: 'Carrinho está vazio'
                });
            }

            console.log(`🛒 Itens no carrinho: ${carrinho.ItemCarrinho.length}`);

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

            console.log(`📍 Endereço validado: ${endereco.rua}, ${endereco.numero}`);

            // Verificar estoque e calcular valores
            let subtotal = 0;
            const itensSemEstoque: string[] = [];

            for (const item of carrinho.ItemCarrinho) {
                const estoqueDisponivel = item.produto.quantidade;

                console.log(`📦 Verificando produto: ${item.produto.nome}`);
                console.log(`   Quantidade solicitada: ${item.quantidade}`);
                console.log(`   Estoque disponível: ${estoqueDisponivel}`);

                if (estoqueDisponivel < item.quantidade) {
                    itensSemEstoque.push(`${item.produto.nome} (disponível: ${estoqueDisponivel}, solicitado: ${item.quantidade})`);
                    continue;
                    // return reply.status(400).send({
                    //     success: false,
                    //     message: `Produto "${item.produto.nome}" está com estoque insuficiente`
                    // });
                }

                const preco = item.produto?.preco;
                const itemTotal = preco * item.quantidade;
                subtotal += itemTotal;

                console.log(`   Preço: ${preco}, Subtotal item: ${itemTotal}`);
            }

            if (itensSemEstoque.length > 0) {
                return reply.status(400).send({
                    success: false,
                    message: 'Alguns produtos estão com estoque insuficiente',
                    details: itensSemEstoque
                });
            }

            // Cálculos simplificados (em produção, calcular frete e impostos reais)
            const frete = 0; // Valor fixo de exemplo
            const imposto = subtotal * 0.12; // 12% de imposto
            const valorDesconto = 0;
            const total = subtotal + frete + imposto - valorDesconto;

            console.log(`💰 Cálculos finais:`);
            console.log(`   Subtotal: ${subtotal}`);
            console.log(`   Frete: ${frete}`);
            console.log(`   Imposto: ${imposto}`);
            console.log(`   Desconto: ${valorDesconto}`);
            console.log(`   Total: ${total}`);
            // Gerar número do pedido
            const numeroPedido = randomUUID();

            // Criar pedido
            const pedido = await prisma.pedido.create({
                data: {
                    id: randomUUID(),
                    numeroPedido,
                    usuarioId: usuario.id,
                    enderecoId: enderecoId,
                    status: 'PAGAMENTO_PENDENTE',
                    subtotal,
                    frete,
                    metodoPagamento: "DINHEIRO_ENTREGA",
                    desconto: valorDesconto,
                    total,
                    metodoEnvio: 'CORREIOS',
                    observacoes,
                    statusPagamento: "PENDENTE"
                }
            });

            console.log(`✅ Pedido criado: ${pedido.id}`);

            // Criar itens do pedido
            for (const item of carrinho.ItemCarrinho) {
                const preco = item.produto.preco;

                console.log(`➕ Criando item de pedido para produto: ${item.produto.nome}`);
                console.log(`   Quantidade: ${item.quantidade}, Preço: ${preco}`);

                await prisma.itemPedido.create({
                    data: {
                        id: randomUUID(),
                        pedidoId: pedido.id,
                        produtoId: item.produtoId,
                        quantidade: item.quantidade,
                        precoUnitario: preco,
                        precoTotal: preco * item.quantidade
                    }
                });

                await prisma.produto.update({
                    where: { id: item.produtoId },
                    data: {
                        quantidade: { decrement: item.quantidade }
                    }
                });
                console.log(`📉 Estoque atualizado para produto ${item.produto.nome}`);
                // console.log("ID DO ITEM: ", item.id);
            }

            // Limpar carrinho
            await prisma.itemCarrinho.deleteMany({
                where: { carrinhoId: carrinho.id }
            });

            console.log(`🧹 Carrinho limpo: ${carrinho.id}`);

            reply.status(201).send({
                success: true,
                message: 'Pedido criado com sucesso',
                data: {
                    pedidoId: pedido.id,
                    numeroPedido: pedido.numeroPedido,
                    status: pedido.status,
                    total: pedido.total,
                    criadoEm: pedido.criadoEm
                },
                pagamentoUrl: `/pagamentos/${pedido.id}/processar`
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
                    ItemPedido: true,
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
            const pedidoAtualizado = await prisma.pedido.update({
                where: { id },
                data: {
                    status: 'CANCELADO'
                }
            });

            // Devolver itens ao estoque
            for (const item of pedido.ItemPedido) {
                if (item.id) {
                    await prisma.produto.update({
                        where: { id: item.id },
                        data: {
                            quantidade: { increment: item.quantidade }
                        }
                    });
                } else {
                    await prisma.produto.update({
                        where: { id: item.produtoId },
                        data: {
                            quantidade: { increment: item.quantidade }
                        }
                    });
                }
            }

            // Cancelar pagamento se existir
            if (pedido.metodoPagamento.length > 0) {
                await prisma.pedido.updateMany({
                    where: { usuarioId: id },
                    data: {
                        status: 'CANCELADO'
                    }
                });
            }

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
                busca?: string;
            }
        }>,
        reply: FastifyReply
    ) {
        const usuario = request.user as any
        try {
            const { page = '1', limit = '20', status, dataInicio, dataFim, busca } = request.query;

            const pagina = parseInt(page);
            const limite = parseInt(limit);
            const skip = (pagina - 1) * limite;

            const where: any = {};
            if (status && status !== 'todos') {
                where.status = status;
            }

            if (dataInicio || dataFim) {
                where.criadoEm = {};
                if (dataInicio) where.criadoEm.gte = new Date(dataInicio);
                if (dataFim) {
                    const dataFimObj = new Date(dataFim);
                    where.criadoEm.lte = dataFimObj;
                }
            }

            if (busca) {
                where.OR = [
                    { numeroPedido: { contains: busca, mode: 'insensitive' } },
                    {
                        usuario: {
                            nome: { contains: busca, mode: 'insensitive' }
                        }
                    },
                    {
                        usuario: {
                            email: { contains: busca, mode: 'insensitive' }
                        }
                    }
                ];
            }
            const [pedidos, total] = await Promise.all([
                prisma.pedido.findMany({
                    where: where,
                    select: {
                        id: true,
                        numeroPedido: true,
                        status: true,
                        total: true,
                        atualizadoEm: true,
                        criadoEm: true,
                        usuario: {
                            select: {
                                id: true,
                                nome: true,
                                email: true
                            }
                        },
                        ItemPedido: {
                            include: {
                                produto: {
                                    select: {
                                        id: true,
                                        nome: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: { criadoEm: 'desc' },
                    skip,
                    take: limite
                }),
                prisma.pedido.count({ where })
            ]);


            reply.send({
                success: true,
                data: pedidos.map(p => ({
                    id: p.id,
                    atualizadoEm: p.atualizadoEm.toISOString(),
                    numeroPedido: p.numeroPedido || p.id,
                    status: p.status,
                    total: p.total || 0,
                    criadoEm: p.criadoEm.toISOString(),
                    usuario: {
                        nome: p.usuario?.nome || 'Cliente',
                        email: p.usuario?.email || ''
                    },
                    pagamento: [{
                        status: p.status === 'PAGAMENTO_PENDENTE' ? 'PENDENTE' : 'CONCLUIDO'
                    }],
                    itempedido: (p.ItemPedido || []).map(item => ({
                        id: item.id,
                        quantidade: item.quantidade || 0,
                        precoUnitario: item.precoUnitario || 0,
                        precoTotal: item.precoTotal || 0,
                        produto: item.produto || { nome: 'Produto' }
                    }))
                })),
                total,
                page: pagina,
                totalPages: Math.ceil(total / limite)
            });
        } catch (error) {
            console.error('❌ Erro ao listar pedidos:', error);
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
            await prisma.historicoPedido.create({
                data: {
                    id: randomUUID(),
                    pedidoId: id,
                    status: "PROCESSANDO",
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