// src/services/sms.service.ts
import axios from 'axios';

export const enviarSMS = async (telefone: string, mensagem: string): Promise<{ success: boolean; error?: string }> => {
  // Limpar número (apenas dígitos)
  let numeroLimpo = telefone.replace(/\D/g, '');
  
  // Remover código do país se tiver
  if (numeroLimpo.startsWith('244')) {
    numeroLimpo = numeroLimpo.substring(3);
  }

  console.log(`📱 Enviando SMS para: ${numeroLimpo}`);
  console.log(`📝 Mensagem: ${mensagem.substring(0, 100)}...`);

  try {
    const url = `https://www.telcosms.co.ao/api/v2/send_message`;
    const params = new URLSearchParams();
    params.append('api_key_app', process.env.SMS_API_KEY || '');
    params.append('phone_number', numeroLimpo);
    params.append('message_body', mensagem);
      params.append('sender', 'SUFFICIUS');

    const response = await axios.get(url, { 
      params,
      headers: {
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    console.log('📦 Resposta TelcoSMS:', response.data);
    
    if (response.data && response.data.status === 200) {
      console.log(' SMS enviado com sucesso!');
      return { success: true };
    } else {
      console.log('❌ Falha no envio:', response.data);
      return { success: false, error: response.data?.message || 'Erro desconhecido' };
    }
    
  } catch (error: any) {
    console.error('❌ Erro ao enviar SMS:', error.response?.data || error.message);
    return { 
      success: false, 
      error: error.response?.data?.message || error.message 
    };
  }
};

// ============================================
// MENSAGENS PARA CADA STATUS
// ============================================

export const gerarMensagemAprovacao = (pedido: any): string => {
  const totalFormatado = new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA'
  }).format(pedido.total);

  return `PEDIDO APROVADO!

Olá ${pedido.usuario?.nome || 'Cliente'}! Seu pedido #${pedido.numeroPedido} foi APROVADO no valor de ${totalFormatado}.

Seu pedido será processado em breve. Obrigado pela preferência!`;
};

export const gerarMensagemEnviado = (pedido: any): string => {
  const totalFormatado = new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA'
  }).format(pedido.total);

  return `PEDIDO ENVIADO!

Olá ${pedido.usuario?.nome || 'Cliente'}! Seu pedido #${pedido.numeroPedido} foi ENVIADO.

Valor: ${totalFormatado}
Acompanhe o código de rastreio em breve.

Obrigado pela preferência!`;
};

export const gerarMensagemEntregue = (pedido: any): string => {
  const totalFormatado = new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA'
  }).format(pedido.total);

  return `PEDIDO ENTREGUE!

Olá ${pedido.usuario?.nome || 'Cliente'}! Seu pedido #${pedido.numeroPedido} foi ENTREGUE com sucesso.

Valor: ${totalFormatado}
Agradecemos pela sua compra! Volte sempre.`;
};

export const gerarMensagemCancelamento = (pedido: any, motivo: string): string => {
  const totalFormatado = new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA'
  }).format(pedido.total);

  return `PEDIDO CANCELADO

Olá ${pedido.usuario?.nome || 'Cliente'}! Seu pedido #${pedido.numeroPedido} foi CANCELADO.

Motivo: ${motivo}
Valor: ${totalFormatado}

Em caso de dúvidas, entre em contato conosco.`;
};

export const gerarMensagemProcessando = (pedido: any): string => {
  const totalFormatado = new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA'
  }).format(pedido.total);

  return `PEDIDO EM PROCESSAMENTO

Olá ${pedido.usuario?.nome || 'Cliente'}! Seu pedido #${pedido.numeroPedido} está sendo PROCESSADO.

Valor: ${totalFormatado}
Em breve seu pedido será enviado. Obrigado!`;
};