import { FastifyInstance } from "fastify";
import AuthRoutes from "./user.routes";

export default function Routes (fastify: FastifyInstance){
    AuthRoutes(fastify);
}