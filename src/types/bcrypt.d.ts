// src/types/bcrypt.d.ts
declare module 'bcrypt' {
  export function genSaltSync(rounds?: number): string;
  export function genSalt(rounds?: number, callback?: (err: Error | null, salt: string) => void): Promise<string>;
  
  export function hashSync(data: string, saltOrRounds: string | number): string;
  export function hash(data: string, saltOrRounds: string | number, callback?: (err: Error | null, encrypted: string) => void): Promise<string>;
  
  export function compareSync(data: string, encrypted: string): boolean;
  export function compare(data: string, encrypted: string, callback?: (err: Error | null, same: boolean) => void): Promise<boolean>;
  
  export function getRounds(encrypted: string): number;
}