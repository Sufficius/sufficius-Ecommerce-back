import { FastifyInstance } from "fastify";
import { ItemCarrinhoController } from "./itemcarrinho.controller";
import { authenticate } from "../../middleware/auth.middleware";

const itemcarrinhoController = new ItemCarrinhoController();

interface ObterItemCarrinhoRoute {
    Reply: {
        200: {
            success: boolean;
            data: {
                id: string;
                usuarioId: string;
                criadoEm: string;
                atualizadoEm: string;
                itens: Array<{
                    id: string;
                    produtoId: string;
                    quantidade: number;
                    preco: number;
                    subtotal: number;
                    produto: {
                        id: string;
                        nome: string;
                        preco: number;
                        precoDesconto: number | null;
                        quantidade: number;
                        imagem: string | null;
                        imagemAlt: string | null;
                    }
                }>;
                 totalItens: number;
                subtotal: number;
                desconto: number;
                total: number;
            };
        };
        500: {
            success: boolean;
            message: string;
        };
    };
}

export default async function itemcarrinhoRoutes(app: FastifyInstance) {

    app.get<ObterItemCarrinhoRoute>(
        '/',
        {
            preHandler: [authenticate],
            schema: {
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            data: {
                                type: 'object',
                                id: { type: 'string' },
                                usuarioId: { type: 'string' },
                                criadoEm: { type: 'string' },
                                atualizadoEm: { type: 'string' },
                                itens: { type: 'array' },
                                totalItens: { type: 'number' },
                                subtotal: { type: 'number' },
                                desconto: { type: 'number' },
                                total: { type: 'number' }
                            }
                        }
                    },
                    500: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            message: { type: 'string' }
                        }
                    }
                }
            }
        },
        itemcarrinhoController.obterItemCarrinho.bind(itemcarrinhoController)
    );
}