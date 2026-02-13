import z from "zod";


export const criarUsuarioSchema = z.object({
    id: z.string().uuid().optional(),
    nome: z.string()
        .min(3, { message: "Nome deve ter ao menos 3 caracteres." })
        .refine((val) => val.trim().length > 0, { message: "Nome não pode ser vazio." }),
    email: z.string()
        .email({ message: "Email inválido." })
        .refine((val) => val.trim().length > 0, { message: "Email não pode ser vazio." }),
    senha: z.string()
        .min(6, { message: "Senha deve ter ao menos 6 caracteres." })
        .refine((val) => val.trim().length > 0, { message: "Senha não pode ser vazia." }),
    telefone: z.string(),
    tipo: z.enum(["CLIENTE", "OPERADOR", "ADMIN"]).optional(),
});