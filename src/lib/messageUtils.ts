/**
 * Utilitários para padronização de mensagens WhatsApp
 */

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR');
};

export const getPixKeyTypeLabel = (type: string | null): string => {
  switch (type) {
    case 'cpf': return 'Chave PIX CPF';
    case 'cnpj': return 'Chave PIX CNPJ';
    case 'telefone': return 'Chave PIX Telefone';
    case 'email': return 'Chave PIX Email';
    case 'aleatoria': return 'Chave PIX Aleatória';
    default: return 'Chave PIX';
  }
};

export const getContractTypeLabel = (type: 'loan' | 'product' | 'vehicle' | 'contract'): string => {
  switch (type) {
    case 'loan': return 'Empréstimo';
    case 'product': return 'Venda de Produto';
    case 'vehicle': return 'Venda de Veículo';
    case 'contract': return 'Contrato';
    default: return 'Contrato';
  }
};

export const getContractPrefix = (type: 'loan' | 'product' | 'vehicle' | 'contract'): string => {
  switch (type) {
    case 'loan': return 'EMP';
    case 'product': return 'PRD';
    case 'vehicle': return 'VEI';
    case 'contract': return 'CTR';
    default: return 'DOC';
  }
};

export const getPaymentTypeLabel = (type: string): string => {
  switch (type) {
    case 'single': return 'Pagamento Único';
    case 'installment': return 'Parcelado (Mensal)';
    case 'daily': return 'Diário';
    case 'weekly': return 'Semanal';
    case 'biweekly': return 'Quinzenal';
    default: return type;
  }
};

/**
 * Gera a barra de progresso visual
 */
export const generateProgressBar = (progressPercent: number): string => {
  const filledBlocks = Math.round(progressPercent / 10);
  const emptyBlocks = 10 - filledBlocks;
  return `${'▓'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)} ${progressPercent}%`;
};

/**
 * Calcula a porcentagem de progresso
 */
export const calculateProgress = (paidCount: number, totalInstallments: number, totalPaid?: number, totalContract?: number): number => {
  if (totalContract && totalPaid) {
    return Math.min(100, Math.round((totalPaid / totalContract) * 100));
  }
  if (totalInstallments > 0) {
    return Math.round((paidCount / totalInstallments) * 100);
  }
  return 0;
};

interface InstallmentStatusResult {
  emoji: string;
  status: string;
  daysOverdue?: number;
}

/**
 * Determina o status de uma parcela
 */
export const getInstallmentStatus = (
  installmentNum: number, 
  paidCount: number, 
  dueDateStr: string
): InstallmentStatusResult => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(dueDateStr + 'T12:00:00');
  
  if (installmentNum <= paidCount) {
    return { emoji: '✅', status: 'Paga' };
  }
  
  if (dueDate < today) {
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return { emoji: '❌', status: `Em Atraso (${daysOverdue}d)`, daysOverdue };
  }
  
  return { emoji: '⏳', status: 'Em Aberto' };
};

interface GenerateInstallmentListOptions {
  installmentDates: string[];
  paidCount: number;
  maxOpenToShow?: number; // Máximo de parcelas em aberto a mostrar (para empréstimos diários)
}

/**
 * Gera a lista de status das parcelas de forma inteligente
 * - Para empréstimos com <= 10 parcelas: mostra todas
 * - Para empréstimos com > 10 parcelas: mostra todas pagas + até 5 próximas em aberto
 */
export const generateInstallmentStatusList = (options: GenerateInstallmentListOptions): string => {
  const { installmentDates, paidCount } = options;
  
  if (!installmentDates || installmentDates.length === 0) {
    return '';
  }
  
  let message = `📊 *STATUS DAS PARCELAS:*\n`;
  
  for (let i = 0; i < installmentDates.length; i++) {
    const installmentNum = i + 1;
    const dateStr = installmentDates[i];
    const { emoji, status } = getInstallmentStatus(installmentNum, paidCount, dateStr);
    
    message += `${installmentNum}️⃣ ${emoji} ${formatDate(dateStr)} - ${status}\n`;
  }
  
  return message;
};

/**
 * Gera a seção de PIX padronizada
 */
export const generatePixSection = (pixKey: string | null, pixKeyType: string | null): string => {
  if (!pixKey) return '';
  return `━━━━━━━━━━━━━━━━\n💳 *${getPixKeyTypeLabel(pixKeyType)}:* ${pixKey}\n`;
};

/**
 * Gera a assinatura padronizada
 */
export const generateSignature = (signatureName: string | null | undefined): string => {
  if (!signatureName) return '';
  return `\n━━━━━━━━━━━━━━━━\n_${signatureName}_`;
};

/**
 * Gera seção de opções de pagamento (para empréstimos mensais/semanais)
 * @param totalAmount - Valor total a pagar (parcela + juros + multa + juros por atraso)
 * @param interestAmount - Juros do contrato (tradicional, embutido na parcela)
 * @param principalAmount - Valor principal (sem juros)
 * @param isDaily - Se é empréstimo diário (não mostra opção de pagar só juros)
 * @param penaltyAmount - Multa aplicada (manual)
 * @param overdueInterestAmount - Juros por atraso (calculado por dia)
 */
export const generatePaymentOptions = (
  totalAmount: number,
  interestAmount: number | undefined,
  principalAmount: number | undefined,
  isDaily: boolean | undefined,
  penaltyAmount?: number,
  overdueInterestAmount?: number
): string => {
  if (!interestAmount || interestAmount <= 0 || isDaily || !principalAmount || principalAmount <= 0) {
    return '';
  }
  
  // "Só juros + multa" = juros do contrato + juros por atraso + multa
  const totalInterestAndPenalties = interestAmount + (overdueInterestAmount || 0) + (penaltyAmount || 0);
  
  // Valor da parcela original (principal + juros do contrato)
  const parcelaOriginal = principalAmount + interestAmount;
  
  let message = `💡 *Opções de Pagamento:*\n`;
  message += `✅ Valor total: ${formatCurrency(totalAmount)}\n`;
  message += `⚠️ Só juros + multa: ${formatCurrency(totalInterestAndPenalties)}\n`;
  message += `   (Parcela de ${formatCurrency(parcelaOriginal)} segue para próximo mês)\n\n`;
  
  return message;
};
