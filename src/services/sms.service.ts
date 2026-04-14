// src/services/sms.service.ts
import axios from 'axios';

export const enviarSMS = async (telefone: string, mensagem: string): Promise<{ success: boolean; error?: string }> => {
  // Limpar número (apenas dígitos)
  let numeroLimpo = telefone.replace(/\D/g, '');

  // Remover código do país se tiver
  if (numeroLimpo.startsWith('244')) {
    numeroLimpo = numeroLimpo.substring(3);
  }

  // Garantir que o número tem 9 dígitos (Angola)
  if (numeroLimpo.length !== 9) {
    console.error(`❌ Número inválido: ${numeroLimpo} (deve ter 9 dígitos)`);
    return { success: false, error: 'Número de telefone inválido' };
  }

  console.log(`📱 Enviando SMS para: ${numeroLimpo}`);
  console.log(`📝 Mensagem: ${mensagem.substring(0, 100)}...`);
  console.log(`🔑 API Key: ${process.env.SMS_API_KEY?.substring(0, 10)}...`);

  try {
    const url = `https://www.telcosms.co.ao/api/v2/send_message`;
    const params = new URLSearchParams();
    params.append('api_key_app', process.env.SMS_API_KEY || '');
    params.append('phone_number', numeroLimpo);
    params.append('message_body', mensagem);
    params.append('from', 'SUFFICIUS'); // ✅ CORRETO: 'sender' não 'sender_id'

    const response = await axios.get(url, {
      params,
      headers: {
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    console.log('📦 Resposta TelcoSMS:', response.data);

    if (response.data && response.data.status === 200) {
      console.log('✅ SMS enviado com sucesso!');
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

  return `✅ PEDIDO APROVADO, ${pedido.usuario?.nome || 'Cliente'}! Seu pedido #${pedido.numeroPedido} no valor de ${totalFormatado} foi aprovado. Será processado em breve. Obrigado! - Sufficius`;
};

export const gerarMensagemEnviado = (pedido: any): string => {
  const totalFormatado = new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA'
  }).format(pedido.total);

  return `📦 PEDIDO ENVIADO, ${pedido.usuario?.nome || 'Cliente'}! Seu pedido #${pedido.numeroPedido} (${totalFormatado}) foi enviado. Acompanhe o código de rastreio em breve. - Sufficius`;
};

export const gerarMensagemEntregue = (pedido: any): string => {
  const totalFormatado = new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA'
  }).format(pedido.total);

  return `🎉 PEDIDO ENTREGUE, ${pedido.usuario?.nome || 'Cliente'}! Seu pedido #${pedido.numeroPedido} (${totalFormatado}) foi entregue com sucesso. Agradecemos pela compra! - Sufficius`;
};

export const gerarMensagemCancelamento = (pedido: any, motivo: string): string => {
  const totalFormatado = new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA'
  }).format(pedido.total);

  return `❌ PEDIDO CANCELADO, ${pedido.usuario?.nome || 'Cliente'}! Seu pedido #${pedido.numeroPedido} (${totalFormatado}) foi cancelado. Motivo: ${motivo}. Dúvidas? Fale conosco. - Sufficius`;
};

export const gerarMensagemProcessando = (pedido: any): string => {
  const totalFormatado = new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA'
  }).format(pedido.total);

  return `🔄 PEDIDO EM PROCESSAMENTO, ${pedido.usuario?.nome || 'Cliente'}! Seu pedido #${pedido.numeroPedido} (${totalFormatado}) está sendo processado. Em breve será enviado. Obrigado! - Sufficius`;
};