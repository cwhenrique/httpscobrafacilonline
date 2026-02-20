
## ✅ CONCLUÍDO: Parcelas SAC com Valores Individuais Decrescentes

### Correções Aplicadas

Todas as funções `getInstallmentValue` e `getInstallmentBaseValue` em `src/pages/Loans.tsx` foram atualizadas para verificar `interest_mode === 'sac'` e usar `calculateSACInstallmentValue()` para retornar o valor correto de cada parcela individualmente (decrescente).

**Locais corrigidos:**
1. ✅ `getPaidIndicesFromNotes` (~linha 105) - `getInstallmentValue` agora usa SAC per-index
2. ✅ `getPaidInstallmentsCount` (~linha 438) - `getInstallmentValue` agora usa SAC per-index
3. ✅ `getFirstUnpaidInstallmentIndex` (~linha 589) - `getInstallmentValue` agora usa SAC per-index
4. ✅ `handlePaymentSubmit` (~linha 4415) - `getInstallmentValue` agora usa SAC per-index
5. ✅ Dialog de pagamento por parcela (~linha 12497) - `getInstallmentBaseValue` agora usa SAC per-index
6. ✅ `getEffectiveInstallmentValue` (~linha 181) - Agora detecta SAC e calcula valor per-index
