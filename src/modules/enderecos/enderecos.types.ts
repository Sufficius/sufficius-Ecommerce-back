// src/modules/enderecos/enderecos.types.ts

// Interfaces para os dados
export interface EnderecoData {
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  pais?: string;
  padrao?: boolean;
}

export interface EnderecoUpdateData {
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  pais?: string;
  padrao?: boolean;
}

// Interfaces para as rotas
export interface ListarEnderecosRoute {
  Reply: {
    200: { success: boolean; data: any[]; total: number };
  };
}

export interface CriarEnderecoRoute {
  Body: EnderecoData;
  Reply: {
    201: { success: boolean; message: string; data: any };
  };
}

export interface AtualizarEnderecoRoute {
  Params: { id: string };
  Body: EnderecoUpdateData;
  Reply: {
    200: { success: boolean; message: string; data: any };
  };
}

export interface EnderecoPadraoRoute {
  Params: { id: string };
  Reply: {
    200: { success: boolean; message: string; data: any };
  };
}

export interface DeletarEnderecoRoute {
  Params: { id: string };
  Reply: {
    200: { success: boolean; message: string };
  };
}