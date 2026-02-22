

# Ativar Lista de Parcelas para Todos os Usuarios Existentes

## Problema
A alteracao anterior mudou o valor padrao de `includeInstallmentsList` para `true`, porem todos os usuarios existentes ja possuem `includeInstallmentsList: false` salvo explicitamente no banco de dados. Como o sistema faz merge (`{ ...DEFAULT, ...savedConfig }`), o valor salvo `false` sobrescreve o novo padrao `true`.

## Solucao

Duas acoes necessarias:

### 1. Atualizar dados existentes no banco (migration SQL)
Executar um UPDATE em todos os perfis que possuem `billing_message_config` com `includeInstallmentsList: false`, trocando para `true`:

```sql
UPDATE profiles
SET billing_message_config = jsonb_set(
  billing_message_config::jsonb,
  '{includeInstallmentsList}',
  'true'::jsonb
)
WHERE billing_message_config IS NOT NULL
  AND (billing_message_config::jsonb->>'includeInstallmentsList') = 'false';
```

### 2. Garantir que novos perfis usem o padrao correto
A alteracao anterior no `DEFAULT_BILLING_MESSAGE_CONFIG` ja cobre novos usuarios. Nenhuma mudanca adicional de codigo necessaria.

## Resumo
- 1 migration SQL para atualizar perfis existentes
- Nenhuma alteracao de codigo
- Efeito imediato: todos os usuarios passarao a ver a lista de parcelas na proxima mensagem de cobranca
- Usuarios que nao quiserem podem desativar manualmente nas configuracoes
