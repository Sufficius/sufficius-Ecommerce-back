export interface createData{
    nome:string, 
    email: string, 
    telefone?: string,
    senha:string
}
export interface updateData{
    id: string,
    nome?:string,
    email:string,
}
