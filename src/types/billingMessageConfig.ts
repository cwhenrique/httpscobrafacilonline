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

// Templates prontos (presets) por tipo de mensagem
export interface PresetTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
}

export const PRESET_TEMPLATES_OVERDUE: PresetTemplate[] = [
  {
    id: 'overdue_default',
    name: '📋 Padrão do Sistema',
    description: 'Template completo com multa, juros, progresso e PIX',
    template: DEFAULT_TEMPLATE_OVERDUE,
  },
  {
    id: 'overdue_interest_only',
    name: '💰 Apenas Juros',
    description: 'Foco em pagar só os juros para manter o contrato em dia',
    template: `Olá *{CLIENTE}*!
━━━━━━━━━━━━━━━━

⏰ *Dias em atraso:* {DIAS_ATRASO}
{JUROS}{JUROS_MULTA}

💡 *Pague apenas os juros* para evitar o acúmulo e manter seu contrato em dia!

{PIX}

Qualquer dúvida, estou à disposição.

{FECHAMENTO}
{ASSINATURA}`,
  },
  {
    id: 'overdue_short',
    name: '⚡ Cobrança Direta',
    description: 'Mensagem curta e objetiva',
    template: `*{CLIENTE}*, sua parcela está em atraso.

📊 *{PARCELA}*
💵 *Valor:* {VALOR}
⏰ *Atraso:* {DIAS_ATRASO} dias
{TOTAL}

{PIX}

{ASSINATURA}`,
  },
  {
    id: 'overdue_friendly',
    name: '🤝 Tom Amigável',
    description: 'Linguagem mais suave e empática',
    template: `Olá *{CLIENTE}*, tudo bem?

Notamos que a *{PARCELA}* no valor de *{VALOR}* ainda está em aberto desde {DATA}.

{JUROS}{JUROS_MULTA}{TOTAL}

Se preferir, você pode pagar apenas os juros para manter tudo em dia! 😊

{PIX}

Caso já tenha pago, desconsidere esta mensagem.

{FECHAMENTO}
{ASSINATURA}`,
  },
  {
    id: 'overdue_final',
    name: '🚨 Última Cobrança',
    description: 'Tom sério, indicando urgência',
    template: `⚠️ *AVISO IMPORTANTE - {CLIENTE}*
━━━━━━━━━━━━━━━━

Esta é uma *última tentativa de contato* sobre a parcela em atraso.

📊 *{PARCELA}*
💵 *Valor:* {VALOR}
⏰ *Dias em atraso:* {DIAS_ATRASO}
{JUROS}{MULTA}{TOTAL}

Por favor, regularize sua situação o mais breve possível para evitar maiores complicações.

{PIX}

{ASSINATURA}`,
  },
];

export const PRESET_TEMPLATES_DUE_TODAY: PresetTemplate[] = [
  {
    id: 'due_today_default',
    name: '📋 Padrão do Sistema',
    description: 'Template completo de vencimento hoje',
    template: DEFAULT_TEMPLATE_DUE_TODAY,
  },
  {
    id: 'due_today_interest_only',
    name: '💰 Apenas Juros',
    description: 'Oferece opção de pagar só os juros no dia do vencimento',
    template: `Olá *{CLIENTE}*!
━━━━━━━━━━━━━━━━

📅 *Parcela vence hoje!*

{JUROS}

💡 *Pague apenas os juros* para evitar multa e manter o contrato em dia!

{PIX}

{FECHAMENTO}
{ASSINATURA}`,
  },
  {
    id: 'due_today_quick',
    name: '⚡ Lembrete Rápido',
    description: 'Mensagem curta e direta',
    template: `*{CLIENTE}*, lembrete: sua *{PARCELA}* de *{VALOR}* vence hoje!

{PIX}

Evite juros pagando em dia! 🙂

{ASSINATURA}`,
  },
  {
    id: 'due_today_formal',
    name: '📝 Tom Formal',
    description: 'Linguagem corporativa e profissional',
    template: `Prezado(a) *{CLIENTE}*,

Informamos que a *{PARCELA}*, no valor de *{VALOR}*, tem vencimento na data de hoje ({DATA}).

Solicitamos a gentileza do pagamento para evitar a incidência de encargos.

{PIX}

{FECHAMENTO}
{ASSINATURA}`,
  },
];

export const PRESET_TEMPLATES_EARLY: PresetTemplate[] = [
  {
    id: 'early_default',
    name: '📋 Padrão do Sistema',
    description: 'Template completo de lembrete antecipado',
    template: DEFAULT_TEMPLATE_EARLY,
  },
  {
    id: 'early_interest_only',
    name: '💰 Apenas Juros',
    description: 'Lembrete antecipado com opção de pagar só os juros',
    template: `Olá *{CLIENTE}*! 👋
━━━━━━━━━━━━━━━━

📋 *Lembrete de pagamento*

📅 *Vencimento:* {DATA} (em {DIAS_PARA_VENCER} dias)
{JUROS}

💡 *Pague apenas os juros* antes do vencimento para manter tudo em dia!

{PIX}

{FECHAMENTO}
{ASSINATURA}`,
  },
  {
    id: 'early_gentle',
    name: '🤝 Lembrete Gentil',
    description: 'Tom leve e amigável',
    template: `Oi *{CLIENTE}*, tudo bem? 😊

Só passando pra lembrar que a *{PARCELA}* de *{VALOR}* vence em *{DIAS_PARA_VENCER} dias* ({DATA}).

{PIX}

Qualquer coisa, é só chamar!

{ASSINATURA}`,
  },
  {
    id: 'early_minimal',
    name: '📌 Minimalista',
    description: 'Apenas dados essenciais',
    template: `*{CLIENTE}* - Lembrete:

📊 {PARCELA}
💵 {VALOR}
📅 Vence: {DATA}

{PIX}

{ASSINATURA}`,
  },
];
