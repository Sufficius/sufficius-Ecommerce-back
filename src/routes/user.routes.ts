import { authService } from "@/services/auth";
import { userService } from "../services/user";
import { FastifyInstance } from "fastify";

export default function AuthRoutes(fastify: FastifyInstance){
    fastify.post('/login', userService.login);
    fastify.post('/profile', {preHandler: authService.authenticate} , userService.update);
    fastify.post('/upload', {preHandler: authService.authenticate} , userService.upload);

}