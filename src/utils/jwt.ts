// src/utils/jwt.ts
import jwt from 'jsonwebtoken';
import { logger } from './logger';

// Interface para payload do token
export interface TokenPayload {
  id?: string;
  email?: string;
  nome?: string;
  tipo?: string;
  [key: string]: any; // Para propriedades adicionais
}

// Interface para token decodificado
export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
}

// Verificar se JWT_SECRET está configurado
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  logger.warn({
    message: '⚠️  JWT_SECRET não configurado no ambiente',
    action: 'Adicione JWT_SECRET no arquivo .env',
    exemplo: 'JWT_SECRET=seu_segredo_super_secreto_aqui_minimo_32_chars'
  });
  
  // Para desenvolvimento, usar um segredo padrão (NÃO usar em produção)
  if (process.env.NODE_ENV === 'development') {
    logger.info('Usando segredo padrão para desenvolvimento');
  }
}

const DEFAULT_OPTIONS: jwt.SignOptions & { 
  issuer: string; 
  audience: string | string[] 
} = {
  expiresIn: '7d',
  issuer: 'sufficius-api',
  audience: ['sufficius-web', 'sufficius-mobile'] // Pode ser array
};
const DEFAULT_REFRESH_OPTIONS: jwt.SignOptions = {
  expiresIn: '30d', // 30 dias
  issuer: 'sufficius-api',
  audience: 'sufficius-app'
};

// Erros personalizados
export class TokenError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'TokenError';
  }
}

// Gera um token JWT
export function generateToken(
  payload: TokenPayload,
  expiresIn: string | number = '7d',
  secret: string = JWT_SECRET || 'segredo_dev_sufficius_altere_em_producao'
): string {
  try {
    if (!secret) {
      throw new TokenError(
        'Segredo JWT não configurado',
        'NO_SECRET'
      );
    }

    const options: jwt.SignOptions = {
      ...DEFAULT_OPTIONS,
      expiresIn: '7d'
    };

    // Adiciona timestamp de criação
    const enhancedPayload = {
      ...payload,
      timestamp: Date.now()
    };

    const token = jwt.sign(enhancedPayload, secret, options);
    
    logger.debug({
      message: 'Token gerado com sucesso',
      usuarioId: payload.id,
      email: payload.email,
      expiraEm: expiresIn,
      tokenPreview: `${token.substring(0, 20)}...`
    });

    return token;

  } catch (error: any) {
    logger.error({
      message: 'Erro ao gerar token',
      error: error.message,
      usuarioId: payload.id
    });
    
    throw new TokenError(
      'Falha ao gerar token de autenticação',
      'GENERATION_FAILED',
      error
    );
  }
}

// Na função verifyToken, use assim:
export function verifyToken(
  token: string,
  secret: string = JWT_SECRET || 'segredo_dev_sufficius_altere_em_producao'
): DecodedToken {
  try {
    if (!token) {
      throw new TokenError('Token não fornecido', 'NO_TOKEN');
    }

    if (!secret) {
      throw new TokenError('Segredo JWT não configurado', 'NO_SECRET');
    }

    // Remove 'Bearer ' se presente
    const cleanToken = token.replace(/^Bearer\s+/i, '');

    // Criar opções de verificação com tipos explícitos
    const verifyOptions: jwt.VerifyOptions = {
      issuer: DEFAULT_OPTIONS.issuer,
      audience: Array.isArray(DEFAULT_OPTIONS.audience) 
        ? DEFAULT_OPTIONS.audience[0] // Usa o primeiro se for array
        : DEFAULT_OPTIONS.audience
    };

    const decoded = jwt.verify(cleanToken, secret, verifyOptions);    // Converter para DecodedToken com validação
    if (typeof decoded === 'string') {
      throw new TokenError('Token inválido: payload é string', 'INVALID_PAYLOAD');
    }

    // Verificar se tem as propriedades mínimas
    const decodedObj = decoded as jwt.JwtPayload;
    
    if (!decodedObj.id || !decodedObj.email || !decodedObj.nome || !decodedObj.tipo) {
      logger.warn({
        message: 'Token não contém propriedades esperadas',
        payload: decodedObj
      });
      
      // Para compatibilidade, tentar extrair do sub se disponível
      const finalPayload: DecodedToken = {
        id: decodedObj.id || decodedObj.sub?.toString() || '',
        email: decodedObj.email || '',
        nome: decodedObj.nome || '',
        tipo: decodedObj.tipo || 'CLIENTE',
        iat: decodedObj.iat || Math.floor(Date.now() / 1000),
        exp: decodedObj.exp || Math.floor(Date.now() / 1000) + 3600
      };

      return finalPayload;
    }

    // Retornar como DecodedToken garantindo as propriedades
    const result: DecodedToken = {
      id: decodedObj.id as string,
      email: decodedObj.email as string,
      nome: decodedObj.nome as string,
      tipo: decodedObj.tipo as string,
      iat: decodedObj.iat || Math.floor(Date.now() / 1000),
      exp: decodedObj.exp || Math.floor(Date.now() / 1000) + 3600,
      ...decodedObj // Inclui outras propriedades se existirem
    };

    logger.debug({
      message: 'Token verificado com sucesso',
      usuarioId: result.id,
      email: result.email,
      expiraEm: new Date(result.exp * 1000).toISOString()
    });

    return result;

  } catch (error: any) {
    let errorCode = 'VERIFICATION_FAILED';
    let errorMessage = 'Token inválido';

    // Identificar tipo específico de erro
    if (error instanceof jwt.TokenExpiredError) {
      errorCode = 'TOKEN_EXPIRED';
      errorMessage = 'Token expirado';
    } else if (error instanceof jwt.JsonWebTokenError) {
      errorCode = 'INVALID_TOKEN';
      errorMessage = 'Token malformado ou inválido';
    }

    logger.warn({
      message: 'Falha na verificação do token',
      errorCode,
      errorMessage: error.message,
      tokenPreview: token ? `${token.substring(0, 20)}...` : 'vazio'
    });

    throw new TokenError(errorMessage, errorCode, error);
  }
}

// Gera um token de refresh
export function generateRefreshToken(
  payload: TokenPayload,
  secret: string = JWT_SECRET || 'segredo_dev_sufficius_altere_em_producao'
): string {
  try {
    const refreshToken = jwt.sign(
      { 
        ...payload, 
        isRefreshToken: true,
        timestamp: Date.now()
      },
      secret,
      DEFAULT_REFRESH_OPTIONS
    );

    logger.debug({
      message: 'Refresh token gerado',
      usuarioId: payload.id
    });

    return refreshToken;

  } catch (error: any) {
    logger.error({
      message: 'Erro ao gerar refresh token',
      error: error.message
    });
    
    throw new TokenError(
      'Falha ao gerar refresh token',
      'REFRESH_GENERATION_FAILED',
      error
    );
  }
}

// Verifica um token de refresh
export function verifyRefreshToken(
  token: string,
  secret: string = JWT_SECRET || 'segredo_dev_sufficius_altere_em_producao'
): DecodedToken {
  try {
    const decoded = verifyToken(token, secret);
    
    // Verifica se é um refresh token
    if (!(decoded as any).isRefreshToken) {
      throw new TokenError('Token não é um refresh token', 'NOT_REFRESH_TOKEN');
    }

    return decoded;

  } catch (error) {
    if (error instanceof TokenError) {
      throw error;
    }
    
    throw new TokenError(
      'Refresh token inválido',
      'INVALID_REFRESH_TOKEN',
      error
    );
  }
}

// Renova um token usando refresh token
export function refreshAccessToken(
  refreshToken: string,
  secret: string = JWT_SECRET || 'segredo_dev_sufficius_altere_em_producao'
): { accessToken: string; refreshToken: string } {
  try {
    // Verifica o refresh token
    const decoded = verifyRefreshToken(refreshToken, secret);
    
    // Gera novo access token
    const accessToken = generateToken(
      {
        id: decoded.id,
        email: decoded.email,
        nome: decoded.nome,
        tipo: decoded.tipo
      },
      '15m', // Access tokens mais curtos
      secret
    );

    // Gera novo refresh token (opcional - rotacionar)
    const newRefreshToken = generateRefreshToken(
      {
        id: decoded.id,
        email: decoded.email,
        nome: decoded.nome,
        tipo: decoded.tipo
      },
      secret
    );

    logger.info({
      message: 'Tokens renovados com sucesso',
      usuarioId: decoded.id
    });

    return {
      accessToken,
      refreshToken: newRefreshToken
    };

  } catch (error: any) {
    logger.error({
      message: 'Erro ao renovar tokens',
      error: error.message
    });
    
    throw error;
  }
}

// Decodifica token sem verificar (apenas para visualização)
export function decodeToken(token: string): DecodedToken | null {
  try {
    const cleanToken = token.replace(/^Bearer\s+/i, '');
    const decoded = jwt.decode(cleanToken) as DecodedToken;
    
    return decoded;

  } catch (error) {
    logger.debug({
      message: 'Falha ao decodificar token',
      error: (error as Error).message
    });
    
    return null;
  }
}

// Utilitário para extrair token do header
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

// Verifica se token está prestes a expirar (útil para refresh proativo)
export function isTokenAboutToExpire(token: string, thresholdMinutes: number = 5): boolean {
  try {
    const decoded = decodeToken(token);
    
    if (!decoded || !decoded.exp) {
      return true;
    }

    const expirationTime = decoded.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const thresholdMs = thresholdMinutes * 60 * 1000;

    return (expirationTime - currentTime) < thresholdMs;

  } catch (error) {
    return true;
  }
}

// Exporta o JWT para uso direto se necessário
export { jwt };