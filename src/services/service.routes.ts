import { prisma } from "../config/prisma";
import { authenticate } from "../middleware/auth.middleware";
import { FastifyInstance } from "fastify";

export default async function servicoRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: authenticate }, async (req) => {
    const { id, nome, preco, sku } = req.body as any;

    return prisma.produto.create({
      data: { id, nome, preco, sku }
    });
  });

  app.get("/", async () => {
    return prisma.produto.findMany({
      include: { categoria: true }
    });
  });
}
