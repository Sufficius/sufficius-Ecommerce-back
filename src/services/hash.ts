// src/services/hash.ts
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export const hashService = {
    /**
     * Gera um hash de uma senha
     */
    async hashPassword(senha: string): Promise<string> {
        return bcrypt.hash(senha, SALT_ROUNDS);
    },

    /**
     * Compara uma senha com um hash
     */
    async comparePassword(senha: string, hash: string): Promise<boolean> {
        return bcrypt.compare(senha, hash);
    }
};