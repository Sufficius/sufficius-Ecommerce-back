// src/model/user.ts
import { prisma } from '@/lib/prisma';
import { Usuario } from '@prisma/client';

export const userModel = {
    /**
     * Busca usuário por ID
     */
    async getById(id: string): Promise<Usuario | null> {
        if (!id) return null;
        
        return prisma.usuario.findUnique({
            where: { id }
        });
    },

    /**
     * Busca usuário por email
     */
    async getByEmail(email: string): Promise<Usuario | null> {
        if (!email) return null;
        
        return prisma.usuario.findUnique({
            where: { email }
        });
    },

    /**
     * Busca usuário por nome
     */
    async getByName(nome: string): Promise<Usuario | null> {
        if (!nome) return null;
        
        return prisma.usuario.findFirst({
            where: { nome }
        });
    },

    /**
     * Cria um novo usuário
     */
    async create(data: Partial<Usuario>): Promise<Usuario> {
        return prisma.usuario.create({
            data: {
                nome: data.nome!,
                email: data.email!,
                senhaHash: data.senhaHash!,
                tipo: data.tipo || 'CLIENTE'
            }
        });
    },

    /**
     * Atualiza um usuário
     */
    async update(id: string, data: Partial<Usuario>): Promise<Usuario | null> {
        return prisma.usuario.update({
            where: { id },
            data
        }).catch(() => null);
    },

    /**
     * Remove um usuário
     */
    async delete(id: string): Promise<boolean> {
        return prisma.usuario.delete({
            where: { id }
        }).then(() => true).catch(() => false);
    }
};