

# Plano: Corrigir Erro de Criação de Contrato (is_historical)

## Problema Identificado

O erro **"Could not find the 'is_historical' column of 'contracts' in the schema cache"** ocorre porque o código está tentando inserir campos que **não existem na tabela `contracts`** do banco de dados:

- `is_historical` - campo usado internamente para marcar contratos históricos
- `historical_paid_installments` - array de parcelas já pagas em contratos históricos
- `send_creation_notification` - flag para enviar notificação
- Campos de veículo (vehicle_*) - não são colunas da tabela contracts

**Colunas que existem na tabela `contracts`:**
`id`, `user_id`, `client_name`, `contract_type`, `total_amount`, `amount_to_receive`, `frequency`, `installments`, `first_payment_date`, `payment_method`, `notes`, `status`, `created_at`, `updated_at`, `bill_type`, `client_phone`, `client_cpf`, `client_rg`, `client_email`, `client_address`, `contract_date`

## Causa Raiz

No arquivo `src/hooks/useContracts.ts`, linha 151-154:

```typescript
const { data: contract, error: contractError } = await supabase
  .from('contracts')
  .insert({
    user_id: effectiveUserId,
    ...contractData,  // <-- Isto inclui TODOS os campos, inclusive os que não existem na tabela!
  })
```

O spread `...contractData` está enviando todos os campos do formulário, incluindo campos que são usados apenas internamente (como `is_historical`, `historical_paid_installments`, `send_creation_notification`) e que não são colunas da tabela.

## Solução

Filtrar os campos antes de enviar ao banco, usando **destructuring** para separar os campos internos dos campos válidos da tabela:

**Arquivo**: `src/hooks/useContracts.ts`
**Linhas**: ~145-158

```typescript
const createContract = useMutation({
  mutationFn: async (contractData: CreateContractData) => {
    if (!effectiveUserId) throw new Error('User not authenticated');

    // Separar campos internos dos campos da tabela
    const {
      is_historical,
      historical_paid_installments,
      send_creation_notification,
      vehicle_plate,
      vehicle_brand,
      vehicle_model,
      vehicle_color,
      vehicle_km_start,
      vehicle_km_end,
      vehicle_year,
      vehicle_renavam,
      ...tableFields  // <-- Apenas os campos válidos da tabela
    } = contractData;

    // Create the contract usando apenas campos válidos
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .insert({
        user_id: effectiveUserId,
        ...tableFields,  // <-- Agora só vai os campos corretos
      })
      .select()
      .single();

    // ... resto do código continua igual ...
  },
  // ...
});
```

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Criar contrato normal | Erro is_historical | Funciona |
| Criar contrato histórico | Erro is_historical | Funciona (parcelas marcadas como pagas) |
| Formulário de aluguel | Erro | Funciona |

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useContracts.ts` | Filtrar campos antes do insert (~linhas 145-158) |

## Estimativa

- **Complexidade**: Baixa
- **Linhas alteradas**: ~20
- **Risco**: Mínimo (corrige bug sem afetar funcionalidade)
- **Testes recomendados**: 
  - Criar contrato de aluguel
  - Criar contrato normal
  - Criar contrato histórico com parcelas já pagas

