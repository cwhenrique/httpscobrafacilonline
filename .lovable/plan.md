
## Objetivo
Garantir que, ao marcar uma mensalidade/assinatura como **paga**, o sistema **sempre** crie a próxima cobrança (ex.: pagou 10/02 → cria 10/03 como **pendente**) e o botão “Pagar” apareça imediatamente para o próximo mês.

## O que está acontecendo hoje (diagnóstico)
Pelo tráfego de rede, após pagar **02/2026**, existe apenas 1 registro (status `paid`) e **não foi inserido** o registro de **03/2026**.

No código atual (`src/hooks/useMonthlyFees.ts`), a rotina que cria o próximo mês faz:
- Busca “existe próximo mês?”
- Busca dados da assinatura (`monthly_fees`)
- Faz `insert` do próximo pagamento

Porém:
1) **Erros do insert estão sendo ignorados** (o retorno do `insert()` não é checado).  
   Se o `insert` falhar por qualquer motivo (RLS/permissão, dado inválido, etc.), a UI fica “Pago/Quitado” e o próximo mês não aparece, sem mostrar erro.

2) Também falta checagem de erro em outras etapas (ex.: `existingNext`, `fee`), o que pode mascarar problemas.

Resultado: a cadeia recorrente “pagou → gera próximo” quebra silenciosamente.

## Solução (o que vou implementar)
### 1) Tornar a renovação “à prova de falhas” no `markAsPaid`
Arquivo: `src/hooks/useMonthlyFees.ts`

Mudanças:
- Em `existingNext`: capturar e tratar `error` (se houver erro, lançar exceção e interromper).
- Em `fee` (busca de `monthly_fees`): capturar `error` e lançar exceção se falhar.
- No `insert` do próximo pagamento:
  - Trocar o `await supabase.from(...).insert({...})` por:
    - `const { error: insertError } = await supabase.from(...).insert({...});`
    - `if (insertError) throw insertError;`
- Melhorar a mensagem do toast em caso de erro para deixar claro: “Pagamento foi registrado, mas falhou ao gerar o próximo mês” (ou então fazer a operação toda “atômica” do ponto de vista do usuário: se falhar gerar próximo mês, avisar e não mostrar “Próximo mês gerado”).
- Garantir que o `onSuccess` só diga “Próximo mês gerado” quando o insert realmente tiver ocorrido (ou quando o próximo mês já existia).

Observação: Como o sistema já limita `due_day` (1..28), não precisamos de clamp de dias para meses curtos; ainda assim, vou manter a lógica consistente e segura.

### 2) Garantir atualização imediata da UI após pagar
Mesmo com o ajuste do botão já feito em `/product-sales`, é essencial que:
- Após `markAsPaid`, o React Query invalide/refaça a query de pagamentos para que o novo pagamento de 03/2026 apareça imediatamente.

Hoje já existe:
- `queryClient.invalidateQueries({ queryKey: ['monthly-fee-payments'] });`

Vou reforçar a robustez:
- Invalidar também `['monthly-fees']` quando fizer sentido (não é obrigatório, mas ajuda a evitar inconsistência visual).
- Opcional: chamar `refetch`/`invalidateQueries` com o mesmo escopo de `userId` e `feeId` para garantir atualização rápida no /product-sales.

### 3) Correção do dado já afetado (o caso do seu print)
Como já temos o `monthly_fee_id` do caso (pela rede/print), vamos **criar manualmente** o pagamento de 03/2026 (pendente) para não deixar esse cliente “quitado”.

Ação no backend (operação de dados, sem mudança de esquema):
- Inserir um registro em `monthly_fee_payments` com:
  - `monthly_fee_id = 8c4e7f09-3886-4a30-ad63-d3b88023980d`
  - `user_id = f83121f6-8ffe-4945-a35e-aaf389974162`
  - `reference_month = 2026-03-01`
  - `due_date = 2026-03-10`
  - `amount = 50`
  - `status = pending`
  - Com `NOT EXISTS` para evitar duplicar se já existir.

(Quando eu estiver em modo de implementação, faço essa correção diretamente via ferramenta de banco.)

## Como vamos validar (checklist)
1) No /product-sales, pegar uma assinatura com vencimento dia 10.
2) Clicar em “Pagar” (registrar como pago).
3) Confirmar que imediatamente aparece uma nova cobrança pendente para o próximo mês (10/03) e o botão “Pagar” volta a aparecer apontando para essa próxima cobrança.
4) Testar também com usuário funcionário (se vocês usam) para garantir que permissões não bloqueiam o insert.
5) Confirmar que, se houver qualquer falha no insert, aparece um erro claro (e não fica “quitado” silenciosamente).

## Impacto esperado
- Nenhuma assinatura vai ficar “quitada” após pagar um mês; sempre haverá a próxima cobrança aberta (pendente) automaticamente.
- Se o sistema não conseguir criar a próxima cobrança por algum erro, você vai ver o motivo (e a gente consegue agir rapidamente), em vez de falhar em silêncio.
