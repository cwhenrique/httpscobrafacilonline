

## Detalhar tipo de pagamento no log de atividades do funcionário

### Problema
O trigger `trigger_log_employee_payment_registered` registra todos os pagamentos como "Registrou pagamento de R$ X" sem distinguir se é pagamento normal, só juros, juros parcial, amortização, etc.

### Solução
Atualizar o trigger para analisar o campo `notes` do pagamento e incluir o tipo na descrição do log.

### Alterações

#### 1. Migration SQL — Atualizar trigger `trigger_log_employee_payment_registered`
Analisar `NEW.notes` para identificar tags como `[INTEREST_ONLY_PAYMENT]`, `[PARTIAL_INTEREST_PAYMENT]`, `[AMORTIZATION]`, `Parcela X de Y`, `[HISTORICAL_INTEREST]` e gerar descrições específicas:
- `[INTEREST_ONLY_PAYMENT]` → "Registrou pagamento de **juros** de R$ X de cliente"
- `[PARTIAL_INTEREST_PAYMENT]` → "Registrou pagamento de **juros parcial** de R$ X de cliente"
- `[AMORTIZATION]` → "Registrou **amortização** de R$ X de cliente"
- `Parcela N de M` → "Registrou pagamento da **parcela N/M** de R$ X de cliente"
- `[HISTORICAL_INTEREST]` → "Registrou **juros histórico** de R$ X de cliente"
- Default → "Registrou pagamento de R$ X de cliente"

Também salvar o tipo no campo `metadata` (jsonb) para uso no frontend.

#### 2. `src/components/EmployeeActivityLog.tsx` — Exibir tipo de pagamento
Adicionar sub-tipos visuais para `payment_registered`: mostrar badge diferenciada (ex: "Só Juros" em roxo, "Amortização" em azul) baseado no `metadata.payment_type` ou na descrição.

