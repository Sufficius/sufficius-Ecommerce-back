import { updateData } from "../interface/user";
import { prisma } from "../config/prisma";

class UserModel {
    protected user = prisma.usuario
    async getByName(nome: string){
        return await this.user.findFirst({
            where: {
                nome
            },
            include: {
                Pedido:true,
                Pagamento:true,
                Reembolso:true
            }
        })
    }

        async getByEmail(email: string){
        return await this.user.findFirst({
            where: {
                email
            },
            include: {
                Pedido:true,
                Pagamento:true,
                Reembolso:true
            }
        })
    }

      async FindByEmail(email: string){
        return await this.user.findFirst({
            where: {
                email
            },
            select: {
                nome: true,
                fotoUrl: true,
                email:true,
                telefone:true
            }
        })
    }


    async FindByName(nome: string){
        return await this.user.findFirst({
            where: {
                nome
            },
            select: {
                nome: true,
                fotoUrl: true,
                email:true,
                telefone:true
            }
        })
    }

    private async getById(id:string){
        return await this.user.findFirst({
            where: {
                id
            },
        })
    }

      async updateEmail({id, email}: updateData ){
        const data = await this.getById(id)
        if (!data) {
            throw new Error("Usuário não encontrado")
        }
        return await this.user.update({
            where:{
                id: data.id
            },
            data:{
            email:email
            }
        })
    }

    async updateNome({id, nome}: updateData ){
        const data = await this.getById(id)
        if (!data) {
            throw new Error("Usuário não encontrado")
        }
        return await this.user.update({
            where:{
                id: data.id
            },
            data:{
            nome:nome
            }
        })
    }
 async upload(nome: string,fotoUrl: string){
        const user = await this.getByName(nome)
        if (!user) {
            throw new Error("user não encontrado")
        }
        return await this.user.update({
            where: {
                id: user.id
            }, data: {
                    fotoUrl: fotoUrl
            },
            select: {
                nome:true,
                fotoUrl:true,
                telefone:true,
                email:true
            }
        })
    }
}

export const userModel = new UserModel();
