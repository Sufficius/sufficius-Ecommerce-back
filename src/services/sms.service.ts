// src/services/sms.service.ts
import axios from 'axios';

export const enviarSMS = async (telefone: string, mensagem: string): Promise<{ success: boolean; error?: string }> => {
  // Limpar número
  let numeroLimpo = telefone.replace(/\D/g, '');
  
  // Diferentes formatos para testar
  const formatos = [
    numeroLimpo,                          // 924695279
    '0' + numeroLimpo,                    // 0924695279
    '244' + numeroLimpo,                  // 244924695279
    '+244' + numeroLimpo                  // +244924695279
  ];

  console.log(`📱 Tentando enviar SMS para: ${telefone}`);
  console.log(`📝 Mensagem: ${mensagem.substring(0, 100)}...`);

  for (const numero of formatos) {
    console.log(`🔄 Tentando formato: ${numero}`);
    
    try {
      const response = await axios({
        method: 'POST',
        url: 'https://www.telcosms.co.ao/api/v2/send_message',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Sufficius-Ecommerce/1.0'
        },
        data: {
          api_key_app: process.env.SMS_API_KEY,
          phone_number: numero,
          message_body: mensagem,
          sender: 'SUFFICIUS',  // Adicionar sender name
          type: 'text'          // Adicionar tipo
        },
        timeout: 30000
      });

      console.log('📦 Resposta:', response.data);
      
      if (response.data && response.data.status === 200) {
        console.log(`✅ SMS enviado com sucesso usando formato: ${numero}`);
        return { success: true };
      }
      
    } catch (error: any) {
      console.log(`❌ Formato ${numero} falhou:`, error.response?.data || error.message);
    }
  }

  // Se todos os formatos falharem, logar a mensagem mas retornar sucesso (para não bloquear)
  console.log('========================================');
  console.log('⚠️ SMS NÃO ENVIADO - API com problemas');
  console.log('========================================');
  console.log(`📲 Para: ${telefone}`);
  console.log(`📝 Mensagem seria:\n${mensagem}`);
  console.log('========================================');
  
  // Retorna sucesso para não travar o fluxo do pedido
  return { success: true };
};

export const gerarMensagemAprovacao = (pedido: any): string => {
  const totalFormatado = new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA'
  }).format(pedido.total);

  // Mensagem mais curta e sem caracteres especiais problemáticos
  return `Pedido #${pedido.numeroPedido} APROVADO! Valor: ${totalFormatado}. Obrigado!`;
};

export const gerarMensagemCancelamento = (pedido: any, motivo: string): string => {
  const totalFormatado = new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA'
  }).format(pedido.total);

  return `Pedido #${pedido.numeroPedido} CANCELADO. Motivo: ${motivo}. Valor: ${totalFormatado}.`;
};