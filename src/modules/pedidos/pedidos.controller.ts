// src/modules/pedidos/pedidos.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';
import { randomUUID } from 'crypto';
import { enviarSMS, gerarMensagemAprovacao, gerarMensagemCancelamento, gerarMensagemEntregue, gerarMensagemEnviado, gerarMensagemProcessando } from '../../services/sms.service';
import { notificationService } from '../../services/nodemailer';

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

            console.log("🔍 Buscando pedido - ID:", id);

            const pedido = await prisma.pedido.findUnique({
                where: { id },
                include: {
                    ItemPedido: {
                        include: {
                            produto: {
                                include: {
                                    ImagemProduto: true
                                }
                            }
                        }
                    },
                    endereco: true,
                    usuario: {
                        select: {
                            id: true,
                            nome: true,
                            email: true,
                            telefone: true
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

            if (pedido.usuarioId !== usuario.id && usuario.tipo !== 'ADMIN') {
                return reply.status(403).send({
                    success: false,
                    message: 'Você não tem permissão para ver este pedido'
                });
            }

            const dataToSend = {
                id: pedido.id,
                numeroPedido: pedido.numeroPedido,
                status: pedido.status,
                total: Number(pedido.total),
                frete: Number(pedido.frete),
                desconto: Number(pedido.desconto),
                observacoes: pedido.observacoes,
                criadoEm: pedido.criadoEm instanceof Date ? pedido.criadoEm.toISOString() : String(pedido.criadoEm),
                atualizadoEm: pedido.atualizadoEm instanceof Date ? pedido.atualizadoEm.toISOString() : String(pedido.atualizadoEm),
                usuarioId: pedido.usuarioId,
                enderecoId: pedido.enderecoId,
                statusPagamento: pedido.statusPagamento,
                metodoPagamento: pedido.metodoPagamento,
                metodoEnvio: pedido.metodoEnvio,
                usuario: pedido.usuario ? {
                    id: pedido.usuario.id,
                    nome: pedido.usuario.nome,
                    email: pedido.usuario.email,
                    telefone: pedido.usuario.telefone
                } : null,
                endereco: pedido.endereco ? {
                    id: pedido.endereco.id,
                    rua: pedido.endereco.rua,
                    numero: pedido.endereco.numero,
                    bairro: pedido.endereco.bairro,
                    cidade: pedido.endereco.cidade,
                    estado: (pedido.endereco as any).provincia || '',
                    cep: (pedido.endereco as any).cep || '',
                    pais: 'Angola'
                } : null,
                ItemPedido: pedido.ItemPedido.map(item => ({
                    id: item.id,
                    quantidade: item.quantidade,
                    precoUnitario: Number(item.precoUnitario),
                    precoTotal: Number(item.precoTotal),
                    produto: {
                        id: item.produto.id,
                        nome: item.produto.nome,
                        preco: Number(item.produto.preco),
                        foto: item.produto.foto,
                        sku: (item.produto as any).sku || null,
                        ImagemProduto: item.produto.ImagemProduto?.map(img => ({
                            url: img.url,
                            principal: img.principal
                        })) || []
                    }
                }))
            };

            console.log("✅ Dados preparados, enviando resposta...");

            return reply.status(200)
                .header('Content-Type', 'application/json')
                .send(JSON.stringify({
                    success: true,
                    data: dataToSend
                }));

        } catch (error) {
            console.error('❌ Erro ao buscar pedido:', error);
            return reply.status(500)
                .header('Content-Type', 'application/json')
                .send(JSON.stringify({
                    success: false,
                    message: 'Erro ao buscar pedido',
                    error: error instanceof Error ? error.message : String(error)
                }));
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

            if (!carrinho || carrinho.ItemCarrinho.length === 0) {
                return reply.status(400).send({
                    success: false,
                    message: 'Carrinho está vazio'
                });
            }

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

            const itensSemEstoque: string[] = [];

            for (const item of carrinho.ItemCarrinho) {
                const estoqueDisponivel = item.produto.quantidade;

                if (estoqueDisponivel < item.quantidade) {
                    itensSemEstoque.push(`${item.produto.nome} (disponível: ${estoqueDisponivel}, solicitado: ${item.quantidade})`);
                }
            }

            if (itensSemEstoque.length > 0) {
                return reply.status(400).send({
                    success: false,
                    message: 'Alguns produtos estão com estoque insuficiente',
                    details: itensSemEstoque
                });
            }

            const frete = 0;
            const valorDesconto = 0;
            const total = carrinho.ItemCarrinho.reduce((sum, item) => sum + (item.produto.preco * item.quantidade), 0) + frete - valorDesconto;

            const numeroPedido = randomUUID().substring(0, 8).toUpperCase();

            const pedido = await prisma.pedido.create({
                data: {
                    id: randomUUID(),
                    numeroPedido,
                    usuarioId: usuario.id,
                    enderecoId: enderecoId,
                    status: 'PAGAMENTO_PENDENTE',
                    frete,
                    metodoPagamento: "DINHEIRO_ENTREGA",
                    desconto: valorDesconto,
                    total,
                    metodoEnvio: 'CORREIOS',
                    observacoes,
                    statusPagamento: "PENDENTE"
                }
            });

            for (const item of carrinho.ItemCarrinho) {
                const preco = item.produto.preco;

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
            }

            await prisma.itemCarrinho.deleteMany({
                where: { carrinhoId: carrinho.id }
            });

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

            const pedido = await prisma.pedido.findUnique({
                where: { id },
                include: {
                    ItemPedido: true,
                    usuario: {
                        select: {
                            id: true,
                            nome: true,
                            email: true,
                            telefone: true
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

            if (pedido.usuarioId !== usuario.id && usuario.tipo !== 'ADMIN') {
                return reply.status(403).send({
                    success: false,
                    message: 'Você não tem permissão para cancelar este pedido'
                });
            }

            if (!['PAGAMENTO_PENDENTE', 'AGUARDANDO_PAGAMENTO', 'PROCESSANDO'].includes(pedido.status)) {
                return reply.status(400).send({
                    success: false,
                    message: 'Este pedido não pode ser cancelado no status atual'
                });
            }

            const pedidoAtualizado = await prisma.pedido.update({
                where: { id },
                data: {
                    status: 'CANCELADO',
                    observacoes: motivo
                }
            });

            for (const item of pedido.ItemPedido) {
                await prisma.produto.update({
                    where: { id: item.produtoId },
                    data: {
                        quantidade: { increment: item.quantidade }
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
                    { usuario: { nome: { contains: busca, mode: 'insensitive' } } },
                    { usuario: { email: { contains: busca, mode: 'insensitive' } } }
                ];
            }

            const [pedidos, total] = await Promise.all([
                prisma.pedido.findMany({
                    where,
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
        const { status, motivoCancelamento } = request.body as any;

        console.log("📝 Atualizando status:", { id, status, motivoCancelamento });

        // Verificar se pedido existe
        const pedido = await prisma.pedido.findUnique({
            where: { id },
            include: {
                usuario: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                        telefone: true
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

        console.log("✅ Pedido encontrado:", pedido.id, "Status atual:", pedido.status);

        // Validar transição de status
        const statusValidos = [
            'PAGAMENTO_PENDENTE',
            'AGUARDANDO_CONFIRMACAO',
            'AGUARDANDO_PAGAMENTO',
            'PROCESSANDO',
            'ENVIADO',
            'ENTREGUE',
            'CANCELADO',
            'APROVADO'
        ];

        if (!statusValidos.includes(status)) {
            return reply.status(400).send({
                success: false,
                message: `Status inválido: ${status}`
            });
        }

        // Atualizar pedido
        const pedidoAtualizado = await prisma.pedido.update({
            where: { id },
            data: {
                status,
                ...(status === 'CANCELADO' && motivoCancelamento && { observacoes: motivoCancelamento })
            },
            include: {
                usuario: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                        telefone: true
                    }
                }
            }
        });

        // 🆕 SISTEMA DE NOTIFICAÇÕES UNIFICADO
        let mensagem = '';
        let titulo = '';

        // Definir mensagem baseada no status
        switch (status) {
            case 'APROVADO':
                titulo = 'Pedido Aprovado';
                mensagem = gerarMensagemAprovacao(pedido);
                break;
            case 'PROCESSANDO':
                titulo = 'Pedido em Processamento';
                mensagem = gerarMensagemProcessando(pedido);
                break;
            case 'ENVIADO':
                titulo = 'Pedido Enviado';
                mensagem = gerarMensagemEnviado(pedido);
                break;
            case 'ENTREGUE':
                titulo = 'Pedido Entregue';
                mensagem = gerarMensagemEntregue(pedido);
                break;
            case 'CANCELADO':
                titulo = 'Pedido Cancelado';
                mensagem = gerarMensagemCancelamento(pedido, motivoCancelamento);
                break;
            default:
                titulo = 'Status Atualizado';
                mensagem = `Seu pedido #${pedido.numeroPedido} foi atualizado para: ${status}`;
        }

        // 🎯 Tentar enviar notificações (Email + Push + SMS)
        let emailEnviado = false;
        let pushEnviado = false;
        let smsEnviado = false;

        if (pedido.usuario?.id && mensagem) {
            try {
                // 1️⃣ PRIMEIRO: Tentar Email (mais confiável e detalhado)
                console.log('📧 Tentando enviar email...');
                const notificationResults = await notificationService.sendNotification({
                    userId: pedido.usuario.id,
                    title: titulo,
                    message: mensagem,
                    type: 'PEDIDO_STATUS',
                    data: pedidoAtualizado
                });
                
                emailEnviado = notificationResults.email;
                pushEnviado = notificationResults.push;
                
                console.log('📊 Resultados Email/Push:', { email: emailEnviado, push: pushEnviado });

                // 2️⃣ SEGUNDO: Tentar SMS (apenas se email OU push NÃO foram enviados)
                if (!emailEnviado && !pushEnviado && pedido.usuario?.telefone) {
                    console.log(`📱 Email/Push falharam, tentando SMS para ${pedido.usuario.telefone}...`);
                    const resultadoSMS = await enviarSMS(pedido.usuario.telefone, mensagem);

                    if (resultadoSMS.success) {
                        console.log("✅ SMS enviado com sucesso!");
                        smsEnviado = true;
                    } else {
                        console.error("❌ SMS também falhou:", resultadoSMS.error);
                    }
                } else if (pedido.usuario?.telefone) {
                    // Email ou Push funcionou, mas também enviar SMS se quiser (opcional)
                    console.log('✅ Email/Push enviado, SMS não necessário (economizando créditos)');
                }
            } catch (notifError) {
                console.error('❌ Erro no sistema de notificações:', notifError);
            }
        }

        // Registrar histórico
        try {
            const historico = await prisma.historicoPedido.create({
                data: {
                    id: randomUUID(),
                    pedidoId: id,
                    status: status,
                    observacao: motivoCancelamento || null
                }
            });
            console.log("✅ Histórico registrado:", historico.id);
        } catch (historyError: any) {
            console.error("❌ Erro ao criar histórico:", {
                message: historyError.message,
                code: historyError.code,
                meta: historyError.meta
            });
            // Não falha a operação principal
        }

        console.log("✅ Status atualizado com sucesso:", pedidoAtualizado.status);
        console.log('📊 Resumo notificações:', { 
            email: emailEnviado ? '✅' : '❌', 
            push: pushEnviado ? '✅' : '❌', 
            sms: smsEnviado ? '✅' : '❌' 
        });

        // Resposta final
        return reply.send({
            success: true,
            message: 'Status do pedido atualizado com sucesso',
            data: pedidoAtualizado,
            notificacoes: {
                email: emailEnviado,
                push: pushEnviado,
                sms: smsEnviado
            }
        });

    } catch (error) {
        console.error('❌ Erro ao atualizar status:', error);
        return reply.status(500).send({
            success: false,
            message: 'Erro ao atualizar status do pedido',
            error: error instanceof Error ? error.message : String(error)
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

            const totalPedidos = await prisma.pedido.count({ where });

            const totalVendasResult = await prisma.pedido.aggregate({
                where: {
                    ...where,
                    status: { notIn: ['CANCELADO', 'PAGAMENTO_PENDENTE'] }
                },
                _sum: { total: true }
            });

            const pedidosPorStatus = await prisma.pedido.groupBy({
                by: ['status'],
                where,
                _count: true
            });

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