// src/utils/hash.ts
import bcrypt from "bcryptjs";

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, 8);

// Nome mais claro: comparePassword ou verifyPassword
export const verifyPassword = (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);

// Ou mantenha comparePassword se preferir
export const comparePassword = verifyPassword;