import { userValidation } from "../validations/user";
import { FastifyReply, FastifyRequest } from "fastify";
import { authService } from "./auth";
import { hash } from "./hash";
import { userModel } from "../model/user";
import { error } from "node:console";
import { uploadService } from "./uploads/upload";

class UserService {
    async update(req: FastifyRequest, reply: FastifyReply){
        try{
            const {email} = userValidation.getDataForUpdate.parse(req.body)
            const {id} = await authService.verifyUser(req)
            const update = await userModel.updateEmail({ id, email })
            reply.code(200).send({ message: "Dados actualizados com sucesso", data: update })
        } catch (error: any) {
            reply.code(400).send(error.message)
        }
    }

    async login(req: FastifyRequest, reply: FastifyReply){
        try{
            const userData = userValidation.getDataForLogin.parse(req.body)
            const {email, senha} = userData
            const senhaHash = await hash.hashPassword(senha);

            const user = await userModel.getByEmail(email)
            if(!user){
                reply.code(404).send({message: "Usuário não encontrado"});
                return;
            }
               const isValidPassword = await hash.comparePassword(
                senha,
                senhaHash
            );
  if (!isValidPassword) {
                reply.code(401).send({ message: "Senha inválida" });
                return;
            }
            await authService.login(req, user)
            const User = await userModel.FindByEmail(email);
            reply.code(200).send({"message" : "Logado com sucesso", User })
        }
        catch(error: any){
            reply.send(error.message)
        }
    }

    async upload(req: FastifyRequest, reply: FastifyReply){
        try{
            const data = await req.file();

            if(!data){
                return reply.status(400).send({error: 'Nenhum arquivo enviado!'});
            }
            const user = await authService.verifyUser(req)
            const photo = await userModel.getByName(user.nome)

            if(photo){
                if(photo.fotoUrl != null){
                    await uploadService.deleteImage(photo.fotoUrl as string);
                }
            }
            const filePath = await uploadService.saveFile(data);
            const create = await userModel.upload(user.nome, filePath)
            reply.code(201).send({ message: 'Upload realizado com sucesso!', data: create });
        }
         catch(error: any){
            reply.code(400).send({error: error.message})
         }
    }

}

export const userService = new UserService()