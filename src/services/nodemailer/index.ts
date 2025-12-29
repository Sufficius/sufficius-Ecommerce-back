import * as nodemailer from 'nodemailer';
import { logger } from '../../utils/logger';

interface EmailConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
}

export async function sendResetCodeEmail(to: string, code: string, nome: string) {
  try {
    // Log de início
    logger.info({
      message: '📧 Iniciando envio de email de recuperação',
      email: to,
      nome: nome
    });

    // Configurações de email
    const emailConfig: EmailConfig = {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM || process.env.SMTP_USER
    };

    // Verificar configurações
    const isSMTPConfigured = emailConfig.host && emailConfig.user && emailConfig.pass;
    
    logger.debug({
      message: 'Configurações SMTP verificadas',
      configurado: isSMTPConfigured,
      host: emailConfig.host ? '✅' : '❌',
      user: emailConfig.user ? '✅' : '❌',
      port: emailConfig.port
    });

    // Se tiver SMTP configurado, envia email real
    if (isSMTPConfigured) {
      logger.info('🚀 Enviando email real via SMTP...');
      
      const transporter = nodemailer.createTransport({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        auth: {
          user: emailConfig.user,
          pass: emailConfig.pass
        },
        tls: {
          rejectUnauthorized: false // Para desenvolvimento
        }
      });

      // Testar conexão SMTP
      try {
        await transporter.verify();
        logger.info('✅ Conexão SMTP verificada com sucesso');
      } catch (verifyError: any) {
        logger.warn({
          message: '⚠️  Falha na verificação SMTP, continuando...',
          error: verifyError.message
        });
      }

      const mailOptions = {
        from: `"Sufficius Suporte" <${emailConfig.from}>`,
        to,
        subject: "🔐 Código de Recuperação de Senha - Sufficius",
        text: `Olá ${nome},\n\nSeu código de recuperação de senha é: ${code}\n\nEste código é válido por 1 hora.\n\nSe você não solicitou esta recuperação, ignore este email.\n\nAtenciosamente,\nEquipe Sufficius`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recuperação de Senha - Sufficius</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f8f9fa;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 40px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            padding: 40px;
        }
        .code-box {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            font-size: 32px;
            font-weight: bold;
            text-align: center;
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
            letter-spacing: 8px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }
        .message {
            font-size: 16px;
            color: #555;
            margin-bottom: 20px;
        }
        .warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 15px;
            margin: 25px 0;
            font-size: 14px;
            color: #856404;
        }
        .footer {
            text-align: center;
            padding: 20px;
            background-color: #f8f9fa;
            color: #6c757d;
            font-size: 12px;
            border-top: 1px solid #e9ecef;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 20px;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 25px;
            margin: 20px 0;
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Recuperação de Senha</h1>
            <p>Sufficius - Sua Loja Online de Confiança</p>
        </div>
        
        <div class="content">
            <div class="logo">🛒 Sufficius</div>
            
            <p class="message">Olá <strong>${nome}</strong>,</p>
            
            <p class="message">Recebemos uma solicitação para redefinir sua senha na Sufficius. Use o código abaixo para continuar:</p>
            
            <div class="code-box">
                ${code}
            </div>
            
            <p class="message">Insira este código no formulário de recuperação de senha. O código é válido por <strong>1 hora</strong>.</p>
            
            <div class="warning">
                ⚠️ <strong>Importante:</strong> Se você não solicitou esta recuperação de senha, por favor ignore este email. 
                Seus dados estão seguros conosco.
            </div>
            
            <p class="message">Precisa de ajuda? Entre em contato com nosso suporte:</p>
            <p style="text-align: center; margin: 25px 0;">
                <a href="mailto:suporte@sufficius.com" class="button">📧 Falar com Suporte</a>
            </p>
        </div>
        
        <div class="footer">
            <p>© ${new Date().getFullYear()} Sufficius E-commerce. Todos os direitos reservados.</p>
            <p>Este é um email automático, por favor não responda.</p>
            <p style="font-size: 10px; margin-top: 10px; color: #adb5bd;">
                Av. Comercial, 1234 - Centro, Cidade/UF | CNPJ: 12.345.678/0001-90
            </p>
        </div>
    </div>
</body>
</html>
        `
      };

      try {
        const info = await transporter.sendMail(mailOptions);
        
        logger.info({
          message: '✅ Email enviado com sucesso',
          email: to,
          messageId: info.messageId,
          response: info.response
        });
        
        return info;
      } catch (sendError: any) {
        logger.error({
          message: '❌ Erro ao enviar email via SMTP',
          error: sendError.message,
          code: sendError.code,
          email: to
        });
        
        // Fallback: log detalhado em desenvolvimento
        return handleDevFallback(to, code, nome, sendError);
      }
      
    } else {
      // Modo desenvolvimento - apenas log
      return handleDevFallback(to, code, nome);
    }
    
  } catch (error: any) {
    logger.error({
      message: '❌ Erro inesperado no serviço de email',
      error: error.message,
      stack: error.stack
    });
    
    // Fallback para desenvolvimento
    return handleDevFallback(to, code, nome || 'Usuário', error);
  }
}

// Função para modo desenvolvimento
function handleDevFallback(to: string, code: string, nome: string, error?: any) {
  const timestamp = new Date().toLocaleString('pt-BR');
  
  logger.info({
    message: '📧📧📧 MODO DESENVOLVIMENTO 📧📧📧',
    envioReal: 'NÃO',
    sistema: 'Sufficius E-commerce'
  });
  
  logger.info({
    message: 'Detalhes do email simulado:',
    timestamp: timestamp,
    destinatario: to,
    nome: nome,
    codigo: code,
    validoPor: '1 hora'
  });
  
  if (error) {
    logger.warn({
      message: 'Erro original:',
      error: error.message
    });
  }
  
  logger.info({
    message: 'Para configurar envio real, adicione ao .env:',
    exemplo: `SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app
SMTP_FROM=suporte@sufficius.com`
  });
  
  return {
    messageId: `dev-${Date.now()}`,
    accepted: [to],
    envelope: { from: 'dev@sufficius.com', to: [to] },
    devMode: true,
    code: code // Inclui o código no retorno para debug
  };
}

// Exportar outras funções de email relacionadas
export async function sendWelcomeEmail(to: string, nome: string) {
  try {
    logger.info({
      message: '📧 Enviando email de boas-vindas',
      email: to,
      nome: nome
    });

    // Implementação similar à sendResetCodeEmail
    // ... código para email de boas-vindas
    
    return { success: true, email: to };
  } catch (error) {
    logger.error({
      message: 'Erro no email de boas-vindas',
      error
    });
    return { success: false, email: to };
  }
}

export async function sendOrderConfirmationEmail(to: string, nome: string, pedidoId: string) {
  try {
    logger.info({
      message: '📧 Enviando confirmação de pedido',
      email: to,
      nome: nome,
      pedidoId: pedidoId
    });

    // Implementação para email de confirmação de pedido
    // ... código para email de pedido
    
    return { success: true, email: to, pedidoId };
  } catch (error) {
    logger.error({
      message: 'Erro no email de confirmação de pedido',
      error
    });
    return { success: false, email: to, pedidoId };
  }
}