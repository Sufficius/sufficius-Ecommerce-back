import { randomUUID } from "crypto";
import { prisma } from "../../lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export class ItemCarrinhoController {
    async obterItemCarrinho(request: FastifyRequest, reply: FastifyReply) {
        try {
            const usuario = request.user as any;
            console.log('👤 Usuário autenticado ID:', usuario.id);
            console.log('👤 Email do usuário:', usuario.email);
            
            // 1. Primeiro buscar o carrinho SEM include (apenas para debug)
            const carrinhoSimples = await prisma.carrinho.findUnique({
                where: {
                    usuarioId: usuario.id
                }
            });
            
          
            
            // 2. Buscar TODOS os itens de carrinho no sistema para debug
            const todosItensNoSistema = await prisma.itemCarrinho.findMany({
                include: {
                    produto: {
                        select: {
                            id: true,
                            nome: true
                        }
                    },
                    carrinho: {
                        select: {
                            usuarioId: true,
                            usuario: {
                                select: {
                                    email: true
                                }
                            }
                        }
                    }
                }
            });
            
            console.log('📊 TODOS os itens de carrinho no sistema:');
            todosItensNoSistema.forEach(item => {
                console.log(`  - Item: ${item.id}, Produto: ${item.produto?.nome || 'N/A'}`);
                console.log(`    Carrinho: ${item.carrinhoId}, Usuário: ${item.carrinho.usuarioId} (${item.carrinho.usuario?.email})`);
            });
            
            // 3. Buscar itens específicos do carrinho do usuário atual
            if (carrinhoSimples) {
                const itensDoMeuCarrinho = await prisma.itemCarrinho.findMany({
                    where: {
                        carrinhoId: carrinhoSimples.id
                    },
                    include: {
                        produto: {
                            include: {
                                ImagemProduto: {
                                    where: { principal: true },
                                    take: 1
                                }
                            }
                        }
                    }
                });
                
                console.log(`🛒 Itens no MEU carrinho (${carrinhoSimples.id}):`, itensDoMeuCarrinho.length);
                itensDoMeuCarrinho.forEach(item => {
                    console.log(`  - ${item.id}: ${item.produto?.nome || 'Produto sem nome'} (Qtd: ${item.quantidade})`);
                });
            }
            
            // Se não houver carrinho, criar um novo
            if (!carrinhoSimples) {
                console.log('🛒 Criando novo carrinho para usuário');
                const novoCarrinho = await prisma.carrinho.create({
                    data: {
                        id: randomUUID(),
                        usuarioId: usuario.id
                    }
                });
                
                const respostaFormatada = {
                    id: novoCarrinho.id,
                    usuarioId: novoCarrinho.usuarioId,
                    criadoEm: novoCarrinho.criadoEm,
                    atualizadoEm: novoCarrinho.atualizadoEm,
                    itens: [],
                    totalItens: 0,
                    subtotal: 0,
                    desconto: 0,
                    total: 0
                };

                return reply.code(200).send({
                    success: true,
                    data: respostaFormatada
                });
            }
            
            // 4. Agora buscar o carrinho COMPLETO com include
            const carrinhoCompleto = await prisma.carrinho.findUnique({
                where: {
                    usuarioId: usuario.id
                },
                include: {
                    ItemCarrinho: {
                        include: {
                            produto: {
                                include: {
                                    ImagemProduto: {
                                        where: { principal: true },
                                        take: 1
                                    }
                                }
                            }
                        }
                    }
                }
            });
            
            console.log('🔍 Carrinho completo carregado:');
            console.log('- Total de itens:', carrinhoCompleto?.ItemCarrinho?.length || 0);
            
            // Se não há itens, retornar carrinho vazio
            if (!carrinhoCompleto?.ItemCarrinho || carrinhoCompleto.ItemCarrinho.length === 0) {
                console.log('📭 Carrinho está vazio');
                
                const respostaFormatada = {
                    id: carrinhoCompleto?.id,
                    usuarioId: carrinhoCompleto?.usuarioId,
                    criadoEm: carrinhoCompleto?.criadoEm,
                    atualizadoEm: carrinhoCompleto?.atualizadoEm,
                    itens: [],
                    totalItens: 0,
                    subtotal: 0,
                    desconto: 0,
                    total: 0
                };

                return reply.code(200).send({
                    success: true,
                    data: respostaFormatada
                });
            }
            
            // Calcular totais
            const totalItens = carrinhoCompleto.ItemCarrinho.reduce((sum, item) => sum + (item.quantidade || 0), 0);
            const subtotal = carrinhoCompleto.ItemCarrinho.reduce((sum, item) => {
                const preco = item.produto.preco ||  item.produto?.preco || 0;
                const quantidade = item.quantidade || 0;
                return sum + (preco * quantidade);
            }, 0);

            console.log('💰 Totais calculados:', { totalItens, subtotal });

            // Formatar os itens do carrinho
            const itensFormatados = carrinhoCompleto.ItemCarrinho.map(item => {
                const preco = item.produto.preco  || item.produto?.preco || 0;
                const quantidade = item.quantidade || 0;
                const subtotalItem = preco * quantidade;
                
                return {
                    id: item.id,
                    carrinhoId: item.carrinhoId,
                    produtoId: item.produtoId,
                    quantidade: quantidade,
                    preco: preco,
                    subtotal: subtotalItem,
                    produto: {
                        id: item.produto?.id || item.produtoId,
                        nome: item.produto?.nome || 'Produto não encontrado',
                        preco: item.produto?.preco || 0,
                        precoDesconto: item.produto?.preco,
                        quantidade: item.produto?.quantidade || 0,
                        imagem: item.produto?.ImagemProduto?.[0]?.url || null,
                        imagemAlt: item.produto?.ImagemProduto?.[0]?.url || null,
                    }
                };
            });

            const respostaFormatada = {
                id: carrinhoCompleto.id,
                usuarioId: carrinhoCompleto.usuarioId,
                criadoEm: carrinhoCompleto.criadoEm,
                atualizadoEm: carrinhoCompleto.atualizadoEm,
                itens: itensFormatados,
                totalItens,
                subtotal,
                desconto: 0,
                total: subtotal
            };

            return reply.code(200).send({
                success: true,
                data: respostaFormatada
            });

        } catch (error) {
            console.error('❌ Erro ao obter item do carrinho:', error);
            return reply.code(500).send({
                success: false,
                message: 'Erro ao obter item do carrinho'
            });
        }
    }
}