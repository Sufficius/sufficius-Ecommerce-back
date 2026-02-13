import { FastifyInstance } from "fastify";

export async function Logout(fastify: FastifyInstance) {
  fastify.post("/auth/logout", async (request, reply) => {
    // console.log("Token", request.cookies);
    // try {
    //   // Captura o token do cookie
    //   const token = request.cookies["access_token"];
    //   if (!token) {
    //     return reply.status(401).send({ message: "Usuário não autenticado" });
    //   }

    //   // Remove o cookie do cliente
    //   reply
    //     .clearCookie("access_token", { path: "/" })
    //     .clearCookie("kwenda-role", { path: "/" })
    //     .send({ message: "Logout realizado com sucesso" });
    // } catch (error) {
    //   console.error("Erro no logout:", error);
    //   return reply.status(500).send({ message: "Erro interno no servidor" });
    // }
  });
}
