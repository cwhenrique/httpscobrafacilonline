/**
 * Utilitários para padronização de mensagens WhatsApp
 */

import { BillingMessageConfig, DEFAULT_BILLING_MESSAGE_CONFIG } from '@/types/billingMessageConfig';

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
export const generatePixSection = (
  pixKey: string | null, 
  pixKeyType: string | null,
  pixPreMessage?: string | null
): string => {
  if (!pixKey) return '';
  let section = `━━━━━━━━━━━━━━━━\n`;
  
  // Adiciona pré-mensagem se configurada
  if (pixPreMessage && pixPreMessage.trim()) {
    section += `📢 ${pixPreMessage.trim()}\n\n`;
  }
  
  section += `💳 *${getPixKeyTypeLabel(pixKeyType)}:* ${pixKey}\n`;
  return section;
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
  
  const hasOverdueInterest = (overdueInterestAmount || 0) > 0;
  const hasPenalty = (penaltyAmount || 0) > 0;
  
  // Total de encargos (juros contrato + juros atraso + multa)
  const totalEncargos = interestAmount + (overdueInterestAmount || 0) + (penaltyAmount || 0);
  
  // Valor da parcela original (principal + juros do contrato)
  const parcelaOriginal = principalAmount + interestAmount;
  
  let message = `💡 *Opções de Pagamento:*\n`;
  message += `✅ Valor total: ${formatCurrency(totalAmount)}\n`;
  
  if (hasOverdueInterest && hasPenalty) {
    // Quando tem AMBOS: opção é pagar juros + multa (não só juros)
    message += `⚠️ Juros + Multa: ${formatCurrency(totalEncargos)}\n`;
  } else {
    // Quando tem só juros (ou nenhum encargo extra)
    message += `⚠️ Só juros: ${formatCurrency(totalEncargos)}\n`;
  }
  
  message += `   (Parcela de ${formatCurrency(parcelaOriginal)} segue para próximo mês)\n\n`;
  
  return message;
};

/**
 * Get config with defaults for any missing fields
 */
export const getBillingConfig = (config: Partial<BillingMessageConfig> | null | undefined): BillingMessageConfig => {
  if (!config) return DEFAULT_BILLING_MESSAGE_CONFIG;
  return { ...DEFAULT_BILLING_MESSAGE_CONFIG, ...config };
};

/**
 * Check if a field should be included based on config
 */
export const shouldIncludeField = (
  config: BillingMessageConfig | null | undefined,
  field: keyof BillingMessageConfig
): boolean => {
  const safeConfig = getBillingConfig(config);
  return safeConfig[field] as boolean;
};

export interface TemplateData {
  clientName: string;
  amount: number;
  installmentNumber?: number;
  totalInstallments?: number;
  dueDate: string;
  daysOverdue?: number;
  daysUntilDue?: number;
  penaltyAmount?: number;
  overdueInterestAmount?: number;
  totalAmount?: number;
  progressPercent?: number;
  pixKey?: string | null;
  pixKeyType?: string | null;
  pixPreMessage?: string | null;
  signatureName?: string | null;
  closingMessage?: string;
}

/**
 * Substitui variáveis do template pelos dados reais
 */
export const replaceTemplateVariables = (
  template: string,
  data: TemplateData
): string => {
  const parcela = data.installmentNumber && data.totalInstallments
    ? `Parcela ${data.installmentNumber}/${data.totalInstallments}`
    : 'Pagamento';

  // Linhas condicionais para multa, juros e total - consolidados quando ambos existem
  const hasJuros = data.overdueInterestAmount && data.overdueInterestAmount > 0;
  const hasMulta = data.penaltyAmount && data.penaltyAmount > 0;
  
  let multaLine = '';
  let jurosLine = '';
  let jurosMultaLine = '';
  
  if (hasJuros && hasMulta) {
    // Consolidar em uma linha só
    const totalEncargos = (data.overdueInterestAmount || 0) + (data.penaltyAmount || 0);
    jurosMultaLine = `💰 *Juros + Multa:* +${formatCurrency(totalEncargos)}\n`;
  } else {
    if (hasMulta) {
      multaLine = `⚠️ *Multa Aplicada:* +${formatCurrency(data.penaltyAmount!)}\n`;
    }
    if (hasJuros) {
      jurosLine = `📈 *Juros por Atraso:* +${formatCurrency(data.overdueInterestAmount!)}\n`;
    }
  }

  let totalLine = '';
  if (data.totalAmount && data.totalAmount !== data.amount) {
    totalLine = `💵 *TOTAL A PAGAR:* ${formatCurrency(data.totalAmount)}\n`;
  }

  // Barra de progresso
  const progressBar = data.progressPercent !== undefined
    ? `📈 *Progresso:* ${generateProgressBar(data.progressPercent)}`
    : '';

  // PIX
  const pixSection = generatePixSection(
    data.pixKey || null,
    data.pixKeyType || null,
    data.pixPreMessage || null
  );

  // Assinatura
  const signature = generateSignature(data.signatureName);

  // Mensagem de fechamento
  const closingMessage = data.closingMessage || '';

  return template
    .replace(/\{CLIENTE\}/g, data.clientName)
    .replace(/\{VALOR\}/g, formatCurrency(data.amount))
    .replace(/\{PARCELA\}/g, parcela)
    .replace(/\{DATA\}/g, formatDate(data.dueDate))
    .replace(/\{DIAS_ATRASO\}/g, String(data.daysOverdue || 0))
    .replace(/\{DIAS_PARA_VENCER\}/g, String(data.daysUntilDue || 0))
    .replace(/\{MULTA\}/g, multaLine)
    .replace(/\{JUROS\}/g, jurosLine)
    .replace(/\{JUROS_MULTA\}/g, jurosMultaLine)
    .replace(/\{TOTAL\}/g, totalLine)
    .replace(/\{PROGRESSO\}/g, progressBar)
    .replace(/\{PIX\}/g, pixSection)
    .replace(/\{ASSINATURA\}/g, signature)
    .replace(/\{FECHAMENTO\}/g, closingMessage)
    // Remove linhas vazias duplicadas
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
