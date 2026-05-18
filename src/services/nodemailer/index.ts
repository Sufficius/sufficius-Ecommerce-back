import { prisma } from '../../lib/prisma';
import * as nodemailer from 'nodemailer';
import webpush from 'web-push';

interface NotificationOptions {
  userId: string;
  title: string;
  message: string;
  type: 'PEDIDO_STATUS' | 'PAGAMENTO' | 'PROMOCAO' | 'SISTEMA';
  data?: Record<string, any>;
}

class NotificationService {
  private emailTransporter: any;
  private isEmailConfigured: boolean = false;
  private isPushConfigured: boolean = false;

  constructor() {
    this.setupEmail();
    this.setupPushNotifications();
  }

  // Configurar Email
  private setupEmail() {
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
      this.isEmailConfigured = true;
      console.log('📧 Serviço de email configurado');
    } else {
      console.log('⚠️ Serviço de email não configurado - variáveis de ambiente ausentes');
    }
  }

  // Configurar Web Push
  private setupPushNotifications() {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(
        'mailto:suporte@sufficius.com',
        vapidPublicKey,
        vapidPrivateKey
      );
      this.isPushConfigured = true;
      console.log('🔔 Serviço de push notification configurado');
    } else {
      console.log('⚠️ Serviço de push notification não configurado - chaves VAPID ausentes');
    }
  }

  // Enviar notificação por email
  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.isEmailConfigured) {
      console.log('❌ Email não configurado');
      return false;
    }

    try {
      await this.emailTransporter.sendMail({
        from: `"Sufficius" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
      });
      console.log(`✅ Email enviado para: ${to}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar email:', error);
      return false;
    }
  }

  // Enviar push notification
  async sendPushNotification(userId: string, title: string, body: string): Promise<boolean> {
    if (!this.isPushConfigured) {
      console.log('❌ Push notification não configurado');
      return false;
    }

    try {
      // Buscar todas as subscriptions do usuário
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId }
      });

      if (subscriptions.length === 0) {
        console.log(`⚠️ Nenhuma push subscription encontrada para o usuário ${userId}`);
        return false;
      }

      const payload = JSON.stringify({
        title,
        body,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        data: {
          url: '/pedidos'
        }
      });

      // Enviar para todas as subscriptions do usuário
      const sendPromises = subscriptions.map(subscription => {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        };

        return webpush.sendNotification(pushSubscription, payload);
      });

      await Promise.all(sendPromises);
      console.log(`✅ Push notification enviada para ${subscriptions.length} dispositivos`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar push notification:', error);
      return false;
    }
  }

  // Template de email para status do pedido
  private getPedidoStatusEmail(pedido: any, status: string): string {
    const statusMessages: Record<string, string> = {
      'PAGAMENTO_PENDENTE': 'Aguardando confirmação de pagamento',
      'AGUARDANDO_CONFIRMACAO': 'Pagamento em análise',
      'APROVADO': 'Pagamento aprovado! Seu pedido será processado em breve.',
      'PROCESSANDO': 'Seu pedido está sendo preparado',
      'CONFIRMADO': 'Pedido confirmado e em separação',
      'ENVIADO': 'Seu pedido foi enviado!',
      'ENTREGUE': 'Pedido entregue com sucesso!',
      'CANCELADO': 'Pedido cancelado',
    };

    const statusColor: Record<string, string> = {
      'APROVADO': '#4CAF50',
      'PROCESSANDO': '#2196F3',
      'ENVIADO': '#FF9800',
      'ENTREGUE': '#4CAF50',
      'CANCELADO': '#F44336',
      'PAGAMENTO_PENDENTE': '#FF9800',
    };

    const color = statusColor[status] || '#2196F3';
    const statusMessage = statusMessages[status] || 'Status atualizado';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${color}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .pedido-info { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .status-badge { display: inline-block; background: ${color}; color: white; padding: 5px 15px; border-radius: 20px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .btn { display: inline-block; background: ${color}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Sufficius</h1>
            <p>Atualização do seu pedido</p>
          </div>
          <div class="content">
            <p>Olá, <strong>${pedido.usuario?.nome || 'Cliente'}</strong>!</p>
            <p>${statusMessage}</p>
            
            <div class="pedido-info">
              <p><strong>Pedido:</strong> #${pedido.numeroPedido}</p>
              <p><strong>Status:</strong> <span class="status-badge">${status}</span></p>
              <p><strong>Total:</strong> ${pedido.total.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })}</p>
              <p><strong>Data:</strong> ${new Date(pedido.atualizadoEm).toLocaleString('pt-AO')}</p>
            </div>

            ${pedido.metodoPagamento === 'TRANSFERENCIA_BANCARIA' ? `
            <div style="background: #FFF3E0; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>📸 Comprovativo enviado com sucesso!</strong></p>
              <p>Nossa equipe está verificando o pagamento. Isso pode levar até 24 horas úteis.</p>
            </div>
            ` : ''}

            <a href="${process.env.FRONTEND_URL}/pedidos/${pedido.id}" class="btn">
              Acompanhar Pedido
            </a>
          </div>
          <div class="footer">
            <p>Este é um email automático. Por favor, não responda.</p>
            <p>© 2026 Sufficius. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Enviar notificação completa (todos os canais)
  async sendNotification(options: NotificationOptions): Promise<{
    sms: boolean;
    email: boolean;
    push: boolean;
  }> {
    const results = {
      sms: false,
      email: false,
      push: false,
    };

    try {
      // Buscar dados do usuário
      const usuario = await prisma.usuario.findUnique({
        where: { id: options.userId },
        select: { email: true, telefone: true, nome: true }
      });

      if (!usuario) {
        console.log('❌ Usuário não encontrado para notificação');
        return results;
      }

      // 1. Tentar Push Notification (mais rápido e barato)
      results.push = await this.sendPushNotification(
        options.userId,
        options.title,
        options.message
      );

      // 2. Tentar Email
      if (usuario.email && options.type === 'PEDIDO_STATUS') {
        const emailHtml = this.getPedidoStatusEmail(options.data, options.data?.status);
        results.email = await this.sendEmail(
          usuario.email,
          `Atualização do Pedido #${options.data?.numeroPedido}`,
          emailHtml
        );
      }

      // 3. SMS como último recurso (custa dinheiro)
      // O SMS já é enviado pelo serviço existente

      console.log('📊 Resultados das notificações:', results);
      return results;
    } catch (error) {
      console.error('❌ Erro ao enviar notificações:', error);
      return results;
    }
  }
}

export const notificationService = new NotificationService();

export async function sendResetCodeEmail(to: string, code: string) {
  try {
    
    console.log('\n' + '📧'.repeat(20));
    console.log('📧 EMAIL DE RECUPERAÇÃO DE SENHA 📧');
    console.log('📧'.repeat(20));
    console.log(`📩 Para: ${to}`);
    console.log(`🔑 Código: ${code}`);
    console.log(`🕐 Gerado em: ${new Date().toLocaleString()}`);
    console.log(`⏰ Válido por: 1 hora`);
    
    // Verificar se o nodemailer está carregado
    console.log(`🔧 Nodemailer disponível: ${!!nodemailer.createTransport}`);
    console.log(`🔧 SMTP configurado: ${!!process.env.SMTP_HOST}`);


      // Se tiver variáveis de ambiente configuradas, tenta enviar
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      console.log('🚀 Tentando enviar email real via SMTP...');
      
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

 // Testar conexão SMTP
      console.log('🔍 Verificando conexão SMTP...');
      await transporter.verify();
      console.log('✅ Conexão SMTP verificada com sucesso');
      const mailOptions = {
        from: `"Sufficius Suporte" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject: "🔐 Código de Recuperação de Senha - Sufficius",
        text: `Olá,\n\nSeu código de recuperação de senha é: ${code}\n\nEste código é válido por 1 hora.\n\nSe você não solicitou esta recuperação, ignore este email.\n\nAtenciosamente,\nEquipe Sufficius`,
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
            
            <p class="message">Olá <strong></strong>,</p>
            
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

        console.log('📤 Enviando email...');
      const info = await transporter.sendMail(mailOptions);
   
      console.log('✅ Email REAL enviado com sucesso!');
      console.log(`📨 Message ID: ${info.messageId}`);
      console.log(`👁️  Preview: https://mail.google.com/mail/u/0/#inbox`);
      
      return info;
    } else {
      console.log('⚠️  SMTP não configurado completamente.');
      console.log(`🔍 SMTP_HOST: ${process.env.SMTP_HOST ? '✅' : '❌'}`);
      console.log(`🔍 SMTP_USER: ${process.env.SMTP_USER ? '✅ (primeiros 3: ' + process.env.SMTP_USER.substring(0, 3) + '...)' : '❌'}`);
      console.log(`🔍 SMTP_PASS: ${process.env.SMTP_PASS ? '✅ (primeiros 3: ' + process.env.SMTP_PASS.substring(0, 3) + '...)' : '❌'}`);
      
      console.log('📧📧📧📧📧📧📧📧📧📧📧📧📧📧📧📧📧📧📧📧');
    }

    return { messageId: 'dev-mode', accepted: [to] };
} catch (error: any) {
    console.error('❌ Erro no envio de email:');
    console.error(`   Mensagem: ${error.message}`);
    console.error(`   Código: ${error.code}`);
    console.error(`   Comando: ${error.command}`);
    
    if (error.code === 'EAUTH') {
      console.error('🔐 Erro de autenticação SMTP. Verifique:');
      console.error('   1. Email e senha corretos');
      console.error('   2. Verificação em 2 etapas ativada');
      console.error('   3. Senha de app gerada corretamente');
      console.error('   4. Acesso a apps menos seguros (se não usar app password)');
    }
    
    // Mesmo com erro, mostra o código no console
    console.log(`\n⚠️  MAS O CÓDIGO É: ${code} (use no reset password)`);
    
    // Não lança erro para não quebrar o fluxo
    return { messageId: 'error-fallback', accepted: [to] };
  }
}