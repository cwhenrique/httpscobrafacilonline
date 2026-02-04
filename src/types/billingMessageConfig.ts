/**
 * Configuration interface for customizable billing messages
 */
export interface BillingMessageConfig {
  includeClientName: boolean;
  includeInstallmentNumber: boolean;
  includeAmount: boolean;
  includeDueDate: boolean;
  includeDaysOverdue: boolean;
  includePenalty: boolean;
  includeProgressBar: boolean;
  includeInstallmentsList: boolean;
  includePaymentOptions: boolean;
  includePixKey: boolean;
  includeSignature: boolean;
  customClosingMessage: string;
  // Templates editáveis por tipo de cobrança
  customTemplateOverdue?: string;
  customTemplateDueToday?: string;
  customTemplateEarly?: string;
  useCustomTemplates?: boolean;
}

export const DEFAULT_BILLING_MESSAGE_CONFIG: BillingMessageConfig = {
  includeClientName: true,
  includeInstallmentNumber: true,
  includeAmount: true,
  includeDueDate: true,
  includeDaysOverdue: true,
  includePenalty: true,
  includeProgressBar: true,
  includeInstallmentsList: false,
  includePaymentOptions: true,
  includePixKey: true,
  includeSignature: true,
  customClosingMessage: '',
  customTemplateOverdue: undefined,
  customTemplateDueToday: undefined,
  customTemplateEarly: undefined,
  useCustomTemplates: false,
};

export const BILLING_MESSAGE_FIELD_LABELS: Record<keyof Omit<BillingMessageConfig, 'customClosingMessage' | 'customTemplateOverdue' | 'customTemplateDueToday' | 'customTemplateEarly' | 'useCustomTemplates'>, { label: string; description: string }> = {
  includeClientName: {
    label: 'Nome do Cliente',
    description: 'Saudação com nome personalizado',
  },
  includeInstallmentNumber: {
    label: 'Número da Parcela',
    description: 'Ex: "Parcela 3/12"',
  },
  includeAmount: {
    label: 'Valor da Parcela',
    description: 'Valor monetário a pagar',
  },
  includeDueDate: {
    label: 'Data de Vencimento',
    description: 'Data formatada do vencimento',
  },
  includeDaysOverdue: {
    label: 'Dias em Atraso',
    description: 'Quantidade de dias em atraso (só em cobranças)',
  },
  includePenalty: {
    label: 'Multa/Juros por Atraso',
    description: 'Valores adicionais aplicados',
  },
  includeProgressBar: {
    label: 'Barra de Progresso',
    description: 'Visual do progresso de pagamento',
  },
  includeInstallmentsList: {
    label: 'Lista de Todas as Parcelas',
    description: 'Status de cada parcela (pode ficar longo)',
  },
  includePaymentOptions: {
    label: 'Opções de Pagamento',
    description: 'Sugestão de pagar só juros, etc',
  },
  includePixKey: {
    label: 'Chave PIX',
    description: 'Dados para pagamento via PIX',
  },
  includeSignature: {
    label: 'Assinatura',
    description: 'Nome da empresa/cobrador',
  },
};

// Templates padrão para cada tipo de mensagem
export const DEFAULT_TEMPLATE_OVERDUE = `⚠️ *Atenção {CLIENTE}*
━━━━━━━━━━━━━━━━

🚨 *PARCELA EM ATRASO*

💵 *Valor:* {VALOR}
📊 *{PARCELA}*
📅 *Vencimento:* {DATA}
⏰ *Dias em Atraso:* {DIAS_ATRASO}
{MULTA}{JUROS}{TOTAL}

{PROGRESSO}

{PIX}

{FECHAMENTO}
{ASSINATURA}`;

export const DEFAULT_TEMPLATE_DUE_TODAY = `Olá *{CLIENTE}*!
━━━━━━━━━━━━━━━━

📅 *VENCIMENTO HOJE*

💵 *Valor:* {VALOR}
📊 *{PARCELA}*
📅 *Vencimento:* Hoje ({DATA})

{PROGRESSO}

{PIX}

Evite juros e multas pagando em dia!

{FECHAMENTO}
{ASSINATURA}`;

export const DEFAULT_TEMPLATE_EARLY = `Olá *{CLIENTE}*!
━━━━━━━━━━━━━━━━

📋 *LEMBRETE DE PAGAMENTO*

💵 *Valor:* {VALOR}
📊 *{PARCELA}*
📅 *Vencimento:* {DATA} (em {DIAS_PARA_VENCER} dias)

{PROGRESSO}

{PIX}

{FECHAMENTO}
{ASSINATURA}`;

// Variáveis disponíveis para os templates
export const TEMPLATE_VARIABLES = [
  { variable: '{CLIENTE}', description: 'Nome do cliente' },
  { variable: '{VALOR}', description: 'Valor da parcela' },
  { variable: '{PARCELA}', description: 'Ex: "Parcela 3/12"' },
  { variable: '{DATA}', description: 'Data de vencimento' },
  { variable: '{DIAS_ATRASO}', description: 'Dias em atraso' },
  { variable: '{DIAS_PARA_VENCER}', description: 'Dias até o vencimento' },
  { variable: '{MULTA}', description: 'Linha da multa (se houver só multa)' },
  { variable: '{JUROS}', description: 'Linha dos juros (se houver só juros)' },
  { variable: '{JUROS_MULTA}', description: 'Juros + Multa consolidados (quando ambos existem)' },
  { variable: '{TOTAL}', description: 'Linha do total a pagar' },
  { variable: '{PROGRESSO}', description: 'Barra de progresso visual' },
  { variable: '{PIX}', description: 'Seção completa do PIX' },
  { variable: '{ASSINATURA}', description: 'Assinatura da empresa' },
  { variable: '{FECHAMENTO}', description: 'Mensagem de fechamento' },
];
