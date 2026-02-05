
# Plano: Corrigir Renovação Automática de Assinaturas IPTV

## Problema Identificado

O usuário `comunidade12tv@gmail.com` (Jonas S Brum) tem **27 assinaturas** que foram pagas em janeiro, mas os pagamentos de fevereiro **não foram gerados automaticamente**.

**Causa:** Os pagamentos foram marcados como "paid" sem que a lógica de renovação automática fosse executada. Isso pode ter ocorrido por:
- Pagamentos registrados antes da implementação da auto-renovação
- Bug anterior no sistema
- Pagamentos atualizados diretamente no banco

## Solução em 2 Partes

### Parte 1: Correção Imediata dos Dados
Gerar manualmente os 27 pagamentos de fevereiro para as assinaturas já pagas.

### Parte 2: Verificar Código Existente
O código atual já possui a lógica de renovação em `markAsPaid()` (linhas 437-492 de `useMonthlyFees.ts`), que deveria funcionar corretamente daqui para frente.

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Banco de dados | Inserir 27 registros de pagamento para fevereiro/2026 |

## Alterações Detalhadas

### SQL para Gerar Pagamentos de Fevereiro

```sql
-- Inserir pagamentos de fevereiro para as assinaturas pagas em janeiro
INSERT INTO monthly_fee_payments (user_id, monthly_fee_id, reference_month, amount, due_date, status)
SELECT 
  mf.user_id,
  mf.id as monthly_fee_id,
  '2026-02-01'::date as reference_month,
  mf.amount,
  -- Calcular due_date: dia do mês (due_day) em fevereiro
  MAKE_DATE(2026, 2, LEAST(mf.due_day, 28)) as due_date,
  'pending' as status
FROM monthly_fees mf
JOIN monthly_fee_payments mfp ON mfp.monthly_fee_id = mf.id
WHERE mf.user_id = '45ecb12f-349e-4ffd-bc05-4d922d264feb'
  AND mfp.reference_month = '2026-01-01'
  AND mfp.status = 'paid'
  AND mf.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM monthly_fee_payments mfp2 
    WHERE mfp2.monthly_fee_id = mf.id 
    AND mfp2.reference_month = '2026-02-01'
  );
```

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 27 assinaturas sem cobrança de fevereiro | 27 novas cobranças pendentes para fevereiro |
| Clientes aparecem como "quitados" | Clientes aparecem com cobrança pendente para 10/02/2026 |

## Lógica de Auto-Renovação (Já Implementada)

O código em `useMonthlyFees.ts` (função `markAsPaid`) já possui a lógica correta:

```typescript
// Ao marcar como pago, gera automaticamente o próximo mês
const nextMonth = addMonths(currentRefMonth, 1);
const nextReferenceMonth = format(nextMonth, 'yyyy-MM-01');

// Verifica se já existe
const { data: existingNext } = await supabase
  .from('monthly_fee_payments')
  .select('id')
  .eq('monthly_fee_id', payment.monthly_fee_id)
  .eq('reference_month', nextReferenceMonth)
  .maybeSingle();

if (!existingNext && fee?.is_active) {
  await supabase.from('monthly_fee_payments').insert({...});
}
```

A partir de agora, quando o usuário marcar um pagamento como "pago" pela interface, o próximo mês será gerado automaticamente.

## Seção Técnica

### Lista de Assinaturas a Corrigir (27 clientes)

1. Anderson - R$ 70,00
2. carmim rocha - R$ 70,00
3. Celma - R$ 70,00
4. Cosme - R$ 70,00
5. Diego 100 - R$ 50,00
6. Diego /cs2 - R$ 50,00
7. Douglas - R$ 70,00
8. Eduardo - R$ 70,00
9. Fabio - R$ 70,00
10. Fernando - R$ 50,00
11. leicimar Teixeira - R$ 70,00
12. Leone / Michele - R$ 70,00
13. Luana - R$ 50,00
14. Luiz - R$ 70,00
15. Maria / Diego - R$ 50,00
16. nazare - R$ 70,00
17. Nego - R$ 70,00
18. Nelber - R$ 70,00
19. Norberto - R$ 70,00
20. pastor marcos - R$ 70,00
21. Paulo cesar - R$ 70,00
22. Rafael | Rosangela - R$ 70,00
23. Rosana monte - R$ 70,00
24. Rubes - R$ 50,00
25. thayna - R$ 70,00
26. Thiago - R$ 50,00
27. Tobias - R$ 70,00

### Vencimento
Todas as cobranças de fevereiro serão criadas com vencimento em **10/02/2026** (due_day = 10).
