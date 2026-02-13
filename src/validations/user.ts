import z from "zod";

class UserValidation{
    
    getDataForUpdate = z.object({
        email: z.string().email().min(8, "Insira um email válido"),
    })
    getDataForLogin = z.object({
        email: z.string().email().min(8),
        senha: z.string().min(8, "A senha deve ter pelo menos 8 caracteres")
    })
}
export const userValidation = new UserValidation()