// // src/routes/service.routes.ts
// import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
// import { z } from "zod";
// import { prisma } from "@/config/prisma";
// import { logger } from "@/utils/logger";

// export default async function serviceRoutes(app: FastifyInstance) {
//   const prefix = "/api/services";
  
//   // ============== ROTAS DE SUPORTE AO CLIENTE ==============
  
//   // 1. FAQ - Perguntas Frequentes
//   app.get(`${prefix}/faq`, async () => {
//     const faqs = await prisma.historicoStatusPedido.findMany({
//       where: { ativo: true },
//       orderBy: { ordem: 'asc' }
//     });
//     return { success: true, faqs };
//   });
  
//   // 2. Contato/Formulário de Suporte
//   app.post(`${prefix}/contato`, async (request: FastifyRequest, reply: FastifyReply) => {
//     const schema = z.object({
//       nome: z.string().min(3),
//       email: z.string().email(),
//       telefone: z.string().optional(),
//       assunto: z.string().min(5),
//       mensagem: z.string().min(10),
//       tipo: z.enum(["DUVIDA", "SUGESTAO", "RECLAMACAO", "ELOGIO"]).default("DUVIDA")
//     });
    
//     const data = schema.parse(request.body);
    
//     const contato = await prisma.contato.create({
//       data: {
//         ...data,
//         status: "PENDENTE",
//         ip: request.ip,
//         userAgent: request.headers["user-agent"] || ""
//       }
//     });
    
//     logger.info({ message: "Novo contato recebido", contatoId: contato.id });
    
//     return reply.status(201).send({
//       success: true,
//       message: "Mensagem enviada com sucesso! Entraremos em contato em breve.",
//       protocolo: contato.id
//     });
//   });
  
//   // ============== UTILITÁRIOS DO SISTEMA ==============
  
//   // 3. Upload de Arquivos (Imagens para produtos, etc.)
//   app.post(`${prefix}/upload`, 
//     { preHandler: [authenticate] },
//     async (request: FastifyRequest, reply: FastifyReply) => {
//       const user = (request as any).user;
      
//       // Verificar se é admin ou vendedor
//       if (!["ADMIN", "GERENTE", "VENDEDOR"].includes(user.tipo)) {
//         return reply.status(403).send({
//           success: false,
//           message: "Permissão negada para upload"
//         });
//       }
      
//       // Aqui viria a lógica de upload usando multer ou fastify-multipart
//       return reply.send({
//         success: true,
//         message: "Upload endpoint - implementar lógica de upload"
//       });
//     }
//   );
  
//   // 4. Buscar CEP (integração com API de correios)
//   app.get(`${prefix}/cep/:cep`, async (request: FastifyRequest, reply: FastifyReply) => {
//     const { cep } = request.params as { cep: string };
//     const cepLimpo = cep.replace(/\D/g, '');
    
//     try {
//       // Integração com ViaCEP ou similar
//       const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
//       const data = await response.json();
      
//       if (data.erro) {
//         return reply.status(404).send({
//           success: false,
//           message: "CEP não encontrado"
//         });
//       }
      
//       return reply.send({
//         success: true,
//         endereco: {
//           cep: data.cep,
//           logradouro: data.logradouro,
//           complemento: data.complemento,
//           bairro: data.bairro,
//           cidade: data.localidade,
//           estado: data.uf,
//           ibge: data.ibge
//         }
//       });
      
//     } catch (error) {
//       logger.error({ message: "Erro ao buscar CEP", cep: cepLimpo, error });
//       return reply.status(500).send({
//         success: false,
//         message: "Erro ao consultar CEP"
//       });
//     }
//   });
  
//   // ============== FUNCIONALIDADES DE E-COMMERCE ==============
  
//   // 5. Newsletter/Inscrição
//   app.post(`${prefix}/newsletter`, async (request: FastifyRequest, reply: FastifyReply) => {
//     const schema = z.object({
//       email: z.string().email(),
//       nome: z.string().optional()
//     });
    
//     const { email, nome } = schema.parse(request.body);
    
//     // Verificar se já está inscrito
//     const existente = await prisma.newsletter.findUnique({
//       where: { email }
//     });
    
//     if (existente) {
//       return reply.send({
//         success: true,
//         message: "Você já está inscrito na nossa newsletter!"
//       });
//     }
    
//     await prisma.newsletter.create({
//       data: {
//         email,
//         nome,
//         ip: request.ip,
//         userAgent: request.headers["user-agent"] || ""
//       }
//     });
    
//     logger.info({ message: "Novo inscrito na newsletter", email });
    
//     return reply.status(201).send({
//       success: true,
//       message: "Inscrição realizada com sucesso!"
//     });
//   });
  
//   // 6. Avaliação de Produto
//   app.post(`${prefix}/avaliacao`, 
//     { preHandler: [authenticate] },
//     async (request: FastifyRequest, reply: FastifyReply) => {
//       const user = (request as any).user;
//       const schema = z.object({
//         produtoId: z.string(),
//         nota: z.number().min(1).max(5),
//         comentario: z.string().optional(),
//         anonimo: z.boolean().default(false)
//       });
      
//       const data = schema.parse(request.body);
      
//       // Verificar se usuário comprou o produto
//       const compraVerificada = await prisma.itemPedido.findFirst({
//         where: {
//           pedido: {
//             usuarioId: user.id,
//             status: "ENTREGUE"
//           },
//           produtoId: data.produtoId
//         }
//       });
      
//       const avaliacao = await prisma.avaliacao.create({
//         data: {
//           usuarioId: user.id,
//           produtoId: data.produtoId,
//           nota: data.nota,
//           comentario: data.comentario,
//           anonimo: data.anonimo,
//           compraVerificada: !!compraVerificada
//         },
//         include: {
//           usuario: {
//             select: {
//               id: true,
//               nome: true,
//               foto: true
//             }
//           }
//         }
//       });
      
//       logger.info({ 
//         message: "Nova avaliação de produto", 
//         avaliacaoId: avaliacao.id,
//         produtoId: data.produtoId 
//       });
      
//       return reply.status(201).send({
//         success: true,
//         message: "Avaliação enviada com sucesso!",
//         avaliacao
//       });
//     }
//   );
  
//   // ============== SISTEMA DE NOTIFICAÇÕES ==============
  
//   // 7. Listar notificações do usuário
//   app.get(`${prefix}/notificacoes`, 
//     { preHandler: [authenticate] },
//     async (request: FastifyRequest, reply: FastifyReply) => {
//       const user = (request as any).user;
//       const { lidas } = request.query as { lidas?: string };
      
//       const where: any = { usuarioId: user.id };
//       if (lidas === 'false') where.lida = false;
      
//       const notificacoes = await prisma.notificacao.findMany({
//         where,
//         orderBy: { criadoEm: 'desc' },
//         take: 50
//       });
      
//       // Marcar como lidas se solicitado
//       if (lidas === 'true') {
//         await prisma.notificacao.updateMany({
//           where: { usuarioId: user.id, lida: false },
//           data: { lida: true, lidaEm: new Date() }
//         });
//       }
      
//       return reply.send({
//         success: true,
//         notificacoes,
//         totalNaoLidas: await prisma.notificacao.count({
//           where: { usuarioId: user.id, lida: false }
//         })
//       });
//     }
//   );
  
//   // ============== UTILITÁRIOS ADMIN ==============
  
//   // 8. Dashboard de métricas (apenas admin)
//   app.get(`${prefix}/dashboard/metricas`, 
//     { preHandler: [authenticate] },
//     async (request: FastifyRequest, reply: FastifyReply) => {
//       const user = (request as any).user;
      
//       if (user.tipo !== "ADMIN") {
//         return reply.status(403).send({
//           success: false,
//           message: "Acesso restrito a administradores"
//         });
//       }
      
//       // Métricas básicas do sistema
//       const [
//         totalUsuarios,
//         totalPedidos,
//         totalProdutos,
//         pedidosHoje,
//         vendasHoje,
//         produtosMaisVendidos
//       ] = await Promise.all([
//         prisma.usuario.count(),
//         prisma.pedido.count(),
//         prisma.produto.count({ where: { ativo: true } }),
//         prisma.pedido.count({
//           where: {
//             criadoEm: {
//               gte: new Date(new Date().setHours(0, 0, 0, 0))
//             }
//           }
//         }),
//         prisma.pedido.aggregate({
//           where: {
//             criadoEm: {
//               gte: new Date(new Date().setHours(0, 0, 0, 0))
//             },
//             status: { notIn: ["CANCELADO", "PAGAMENTO_PENDENTE"] }
//           },
//           _sum: { total: true }
//         }),
//         prisma.itemPedido.groupBy({
//           by: ['produtoId'],
//           _sum: { quantidade: true },
//           orderBy: { _sum: { quantidade: 'desc' } },
//           take: 10
//         })
//       ]);
      
//       return reply.send({
//         success: true,
//         metricas: {
//           usuarios: totalUsuarios,
//           pedidos: totalPedidos,
//           produtos: totalProdutos,
//           pedidosHoje,
//           vendasHoje: vendasHoje._sum.total || 0,
//           produtosMaisVendidos: await Promise.all(
//             produtosMaisVendidos.map(async (item) => {
//               const produto = await prisma.produto.findUnique({
//                 where: { id: item.produtoId },
//                 select: { nome: true, preco: true }
//               });
//               return {
//                 produtoId: item.produtoId,
//                 nome: produto?.nome || "Desconhecido",
//                 quantidade: item._sum.quantidade || 0
//               };
//             })
//           )
//         }
//       });
//     }
//   );
  
//   // 9. Health Check do sistema
//   app.get(`${prefix}/health`, async () => {
//     const health = {
//       status: "healthy",
//       timestamp: new Date().toISOString(),
//       uptime: process.uptime(),
//       database: "connected", // Adicionar verificação real do banco
//       memory: process.memoryUsage(),
//       version: process.env.npm_package_version || "1.0.0"
//     };
    
//     return { success: true, health };
//   });
  
//   logger.info(`Service routes registradas em ${prefix}`);
// }