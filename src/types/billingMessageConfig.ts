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
};

export const BILLING_MESSAGE_FIELD_LABELS: Record<keyof Omit<BillingMessageConfig, 'customClosingMessage'>, { label: string; description: string }> = {
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
