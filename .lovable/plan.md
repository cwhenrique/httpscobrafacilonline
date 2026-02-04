

# Diagnóstico: Inconsistência no Empréstimo Brisa Keviene

## Problema Encontrado

O empréstimo mostra:
- **Restante a receber (remaining_balance):** R$ 150,00
- **Parcelas em aberto (6 parcelas × R$ 35):** R$ 210,00
- **Diferença:** R$ 60,00

## Causa Raiz

Analisei os dados e identifiquei **dois problemas sobrepostos**:

### 1. Multa não contabilizada no remaining_balance
- Há uma multa de R$ 20,00 aplicada (`[DAILY_PENALTY:10:20.00]`)
- Esta multa deveria aumentar o total a receber para R$ 720,00
- O remaining_balance atual não inclui esse valor

### 2. Taxas de renovação descontadas incorretamente
- Algumas parcelas foram pagas com valor extra (R$ 55 ao invés de R$ 35)
- Esses R$ 20 extras por parcela são taxas de renovação
- Porém foram contabilizados como abatimento do saldo, reduzindo incorretamente o remaining_balance

## Correção Necessária

O remaining_balance correto deveria ser calculado assim:
```text
Total original:      R$ 700,00
+ Multa aplicada:    R$  20,00
= Total a receber:   R$ 720,00
- Total pago:        R$ 550,00
= Restante correto:  R$ 170,00
```

Porém, considerando que **6 parcelas** ainda estão em aberto (índices 14-19), o cálculo deveria mostrar:
```text
6 parcelas × R$ 35 = R$ 210,00 em aberto
+ Multa ainda não paga (R$ 20 - já incluso nos R$ 550?)
```

## Plano de Correção

### Opção 1: Correção Manual Pontual
Atualizar o remaining_balance deste empréstimo específico para o valor correto.

### Opção 2: Correção Sistêmica
Revisar a lógica de pagamento para garantir que:
1. Multas (`DAILY_PENALTY`) sejam incluídas no total a receber
2. Taxas de renovação não reduzam o remaining_balance das parcelas base

## Correção Imediata Sugerida

Executar um UPDATE para corrigir o remaining_balance deste empréstimo:

```sql
UPDATE loans 
SET remaining_balance = 210.00,
    updated_at = NOW()
WHERE id = '3973df2e-fb4c-4b04-8609-e4516f623092';
```

O valor R$ 210,00 corresponde às 6 parcelas ainda não pagas (índices 14-19).

## Seção Técnica

A investigação revelou que o trigger `recalculate_loan_total_paid` pode não estar considerando corretamente:
- Tags `[DAILY_PENALTY]` para incluir multas no saldo
- A distinção entre pagamento de parcela base vs taxa de renovação

Os arquivos envolvidos seriam:
- `src/pages/Loans.tsx` - lógica de registro de pagamento
- Trigger PostgreSQL `recalculate_loan_total_paid` - recálculo automático do saldo

Deseja que eu corrija o remaining_balance deste empréstimo e/ou investigue a causa sistêmica para evitar reincidência?

