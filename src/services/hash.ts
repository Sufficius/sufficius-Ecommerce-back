import bcrypt from "bcrypt";

class Hash {
    async hashPassword(senha: string){
        const saltRounds = 10;
        return await bcrypt.hash(senha, saltRounds);
    }

    async comparePassword(senha: string, hash:string){
        return await bcrypt.compare(senha, hash);
    }
}

export const hash = new Hash();