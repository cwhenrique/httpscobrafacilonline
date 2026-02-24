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
  dueDateStr: string,
  paidIndices?: number[]
): InstallmentStatusResult => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(dueDateStr + 'T12:00:00');
  
  // Se temos o mapa real de parcelas pagas, usar ele (0-based)
  const isPaid = paidIndices 
    ? paidIndices.includes(installmentNum - 1)
    : installmentNum <= paidCount;
  
  if (isPaid) {
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
  paidIndices?: number[]; // indices (0-based) das parcelas efetivamente pagas
  maxOpenToShow?: number; // Máximo de parcelas em aberto a mostrar (para empréstimos diários)
}

/**
 * Gera a lista de status das parcelas de forma inteligente
 * - Para empréstimos com <= 10 parcelas: mostra todas
 * - Para empréstimos com > 10 parcelas: mostra todas pagas + até 5 próximas em aberto
 */
/**
 * Conta parcelas por status para resumos
 */
const countInstallmentsByStatus = (
  installmentDates: string[],
  paidCount: number,
  paidIndices?: number[]
): { paid: number; overdue: number; open: number } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let paid = 0, overdue = 0, open = 0;

  for (let i = 0; i < installmentDates.length; i++) {
    const isPaid = paidIndices
      ? paidIndices.includes(i)
      : i + 1 <= paidCount;
    if (isPaid) { paid++; continue; }
    const dueDate = new Date(installmentDates[i] + 'T12:00:00');
    if (dueDate < today) { overdue++; } else { open++; }
  }
  return { paid, overdue, open };
};

/**
 * Resumo numérico para contratos com >180 parcelas
 */
const generateNumericSummary = (
  installmentDates: string[],
  paidCount: number,
  paidIndices?: number[]
): string => {
  const { paid, overdue, open } = countInstallmentsByStatus(installmentDates, paidCount, paidIndices);
  let msg = `📊 *STATUS DAS PARCELAS:*\n`;
  msg += `✅ ${paid} paga${paid !== 1 ? 's' : ''} / `;
  if (overdue > 0) msg += `❌ ${overdue} em atraso / `;
  msg += `⏳ ${open} em aberto\n`;
  msg += `📈 Total: ${installmentDates.length} parcelas\n`;
  return msg;
};

/**
 * Resumo inteligente para contratos com 61-180 parcelas:
 * mostra últimas 3 pagas + próximas 5 pendentes + resumo
 */
const generateSmartSummary = (
  installmentDates: string[],
  paidCount: number,
  paidIndices?: number[]
): string => {
  const { paid, overdue, open } = countInstallmentsByStatus(installmentDates, paidCount, paidIndices);
  const total = installmentDates.length;

  // Encontrar os índices das últimas 3 pagas e próximas 5 pendentes
  const paidList: number[] = [];
  const pendingList: number[] = [];

  for (let i = 0; i < total; i++) {
    const isPaid = paidIndices ? paidIndices.includes(i) : i + 1 <= paidCount;
    if (isPaid) {
      paidList.push(i);
    } else if (pendingList.length < 5) {
      pendingList.push(i);
    }
  }

  // Últimas 3 pagas
  const lastPaid = paidList.slice(-3);

  let msg = `📊 *STATUS DAS PARCELAS:*\n`;

  // Indicar parcelas anteriores omitidas
  if (paidList.length > 3) {
    msg += `   _... ${paidList.length - 3} parcela${paidList.length - 3 > 1 ? 's' : ''} paga${paidList.length - 3 > 1 ? 's' : ''} anterior${paidList.length - 3 > 1 ? 'es' : ''}_\n`;
  }

  for (const i of lastPaid) {
    const num = i + 1;
    const { emoji, status } = getInstallmentStatus(num, paidCount, installmentDates[i], paidIndices);
    msg += `${num <= 9 ? `${num}️⃣` : `${num}.`} ${emoji} ${formatDate(installmentDates[i])} - ${status}\n`;
  }

  for (const i of pendingList) {
    const num = i + 1;
    const { emoji, status } = getInstallmentStatus(num, paidCount, installmentDates[i], paidIndices);
    msg += `${num <= 9 ? `${num}️⃣` : `${num}.`} ${emoji} ${formatDate(installmentDates[i])} - ${status}\n`;
  }

  const remaining = total - lastPaid.length - pendingList.length;
  if (remaining > 0) {
    msg += `   _... e mais ${remaining} parcela${remaining > 1 ? 's' : ''}_\n`;
  }

  msg += `\n✅ ${paid} | ❌ ${overdue} | ⏳ ${open} — Total: ${total}\n`;
  return msg;
};

export const generateInstallmentStatusList = (options: GenerateInstallmentListOptions): string => {
  const { installmentDates, paidCount, paidIndices } = options;
  
  if (!installmentDates || installmentDates.length === 0) {
    return '';
  }
  
  const totalCount = installmentDates.length;
  
  // Para contratos com mais de 180 parcelas: apenas resumo numérico
  if (totalCount > 180) {
    return generateNumericSummary(installmentDates, paidCount, paidIndices);
  }
  
  // Para contratos com 61-180 parcelas: resumo inteligente
  if (totalCount > 60) {
    return generateSmartSummary(installmentDates, paidCount, paidIndices);
  }
  
  // Para contratos com até 60 parcelas: mostra todas
  let message = `📊 *STATUS DAS PARCELAS:*\n`;
  
  for (let i = 0; i < totalCount; i++) {
    const installmentNum = i + 1;
    const dateStr = installmentDates[i];
    const { emoji, status } = getInstallmentStatus(installmentNum, paidCount, dateStr, paidIndices);
    
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
  const hasContractInterest = interestAmount && interestAmount > 0;
  const hasOverdueInterest = (overdueInterestAmount || 0) > 0;
  const hasPenalty = (penaltyAmount || 0) > 0;
  const hasExtras = hasOverdueInterest || hasPenalty;

  // Se não tem juros de contrato NEM encargos extras, não mostra nada
  if (!hasContractInterest && !hasExtras) return '';
  if (!principalAmount || principalAmount <= 0) return '';

  const contractInterest = interestAmount || 0;
  
  // Total de encargos (juros contrato + juros atraso + multa)
  const totalEncargos = contractInterest + (overdueInterestAmount || 0) + (penaltyAmount || 0);
  
  // Valor da parcela original (principal + juros do contrato)
  const parcelaOriginal = principalAmount + contractInterest;
  
  let message = `💡 *Opções de Pagamento:*\n`;
  message += `✅ Valor total: ${formatCurrency(totalAmount)}\n`;
  
  if (hasContractInterest) {
    // Tem juros de contrato
    if (hasOverdueInterest && hasPenalty) {
      message += `⚠️ Juros + Multa: ${formatCurrency(totalEncargos)}\n`;
    } else {
      message += `⚠️ Só juros: ${formatCurrency(totalEncargos)}\n`;
    }
    message += `   (Parcela de ${formatCurrency(parcelaOriginal)} segue para próximo mês)\n\n`;
  } else {
    // Sem juros de contrato, mas tem encargos extras (multa e/ou juros por atraso)
    const extrasTotal = (overdueInterestAmount || 0) + (penaltyAmount || 0);
    if (hasOverdueInterest && hasPenalty) {
      message += `⚠️ Só encargos (Juros + Multa): ${formatCurrency(extrasTotal)}\n`;
    } else if (hasPenalty) {
      message += `⚠️ Só multa: ${formatCurrency(extrasTotal)}\n`;
    } else {
      message += `⚠️ Só juros por atraso: ${formatCurrency(extrasTotal)}\n`;
    }
    message += `   (Parcela de ${formatCurrency(parcelaOriginal)} segue para próximo mês)\n\n`;
  }
  
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
  // Juros do contrato (diferença entre total e principal)
  contractInterestAmount?: number;
  // Dados para lista de parcelas
  installmentDates?: string[];
  paidCount?: number;
  paidIndices?: number[];
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

  // Juros do contrato (diferença entre total e principal)
  let contractInterestLine = '';
  if (data.contractInterestAmount && data.contractInterestAmount > 0) {
    contractInterestLine = `💰 *Juros do Contrato:* ${formatCurrency(data.contractInterestAmount)}\n`;
  }

  // Barra de progresso
  const progressBar = data.progressPercent !== undefined
    ? `📈 *Progresso:* ${generateProgressBar(data.progressPercent)}`
    : '';

  // Lista de parcelas pagas/abertas
  const parcelasStatus = data.installmentDates && data.installmentDates.length > 0
    ? generateInstallmentStatusList({
        installmentDates: data.installmentDates,
        paidCount: data.paidCount || 0,
        paidIndices: data.paidIndices,
      })
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

  const templateHadParcelas = template.includes('{PARCELAS_STATUS}');

  let result = template
    .replace(/\{CLIENTE\}/g, data.clientName)
    .replace(/\{VALOR\}/g, formatCurrency(data.amount))
    .replace(/\{PARCELA\}/g, parcela)
    .replace(/\{DATA\}/g, formatDate(data.dueDate))
    .replace(/\{DIAS_ATRASO\}/g, String(data.daysOverdue || 0))
    .replace(/\{DIAS_PARA_VENCER\}/g, String(data.daysUntilDue || 0))
    .replace(/\{JUROS_CONTRATO\}/g, contractInterestLine)
    .replace(/\{MULTA\}/g, multaLine)
    .replace(/\{JUROS\}/g, jurosLine)
    .replace(/\{JUROS_MULTA\}/g, jurosMultaLine)
    .replace(/\{TOTAL\}/g, totalLine)
    .replace(/\{PROGRESSO\}/g, progressBar)
    .replace(/\{PARCELAS_STATUS\}/g, parcelasStatus)
    .replace(/\{PIX\}/g, pixSection)
    .replace(/\{ASSINATURA\}/g, signature)
    .replace(/\{FECHAMENTO\}/g, closingMessage)
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Auto-insert parcelas for old templates that don't have {PARCELAS_STATUS}
  if (!templateHadParcelas && parcelasStatus) {
    const progressIndex = result.lastIndexOf('Progresso:');
    if (progressIndex !== -1) {
      const nextNewline = result.indexOf('\n', progressIndex);
      if (nextNewline !== -1) {
        result = result.slice(0, nextNewline + 1) + '\n' + parcelasStatus + result.slice(nextNewline + 1);
      }
    } else {
      const pixIndex = result.indexOf('━━━━━━━━━━━━━━━━\n');
      if (pixIndex !== -1) {
        result = result.slice(0, pixIndex) + parcelasStatus + '\n' + result.slice(pixIndex);
      } else {
        result += '\n\n' + parcelasStatus;
      }
    }
  }

  return result;
};
