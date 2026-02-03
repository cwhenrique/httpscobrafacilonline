

# Plano: Adicionar Campos de Origem do Cheque

## Objetivo

Adicionar dois novos campos ao cadastro de Desconto de Cheque para rastrear a origem da aquisicao do cheque pelo cliente:
1. **Valor pago pelo cheque** - quanto o cliente pagou para adquirir o cheque
2. **Vendedor do cheque** - de quem o cliente comprou o cheque

## Logica de Negocio

Esses campos sao uteis para:
- Saber se o cliente comprou o cheque de terceiros (e por quanto)
- Calcular a margem real do cliente (diferenca entre valor pago e valor nominal)
- Rastrear a origem dos cheques para analise de risco

## Arquivos a Modificar

### 1. Banco de Dados (Migracao)

Adicionar duas novas colunas na tabela `check_discounts`:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `purchase_value` | numeric | Valor que o cliente pagou pelo cheque (pode ser null) |
| `seller_name` | text | Nome de quem vendeu o cheque ao cliente (pode ser null) |

### 2. src/types/checkDiscount.ts

Atualizar as interfaces:

**Interface `CheckDiscount`:**
- Adicionar `purchase_value: number | null`
- Adicionar `seller_name: string | null`

**Interface `CheckDiscountFormData`:**
- Adicionar `purchase_value: number`
- Adicionar `seller_name: string`

### 3. src/hooks/useCheckDiscounts.ts

Atualizar as mutations:

**createMutation:**
- Incluir `purchase_value` e `seller_name` no insert

**updateMutation:**
- Incluir `purchase_value` e `seller_name` no update

### 4. src/pages/CheckDiscounts.tsx

**Estado do formulario (`formData`):**
- Adicionar `purchase_value: 0`
- Adicionar `seller_name: ''`

**Funcao `resetForm`:**
- Incluir os novos campos com valores padrao

**Funcao `handleOpenForm`:**
- Preencher os novos campos ao editar

**Formulario (Dialog):**
- Adicionar nova secao "Origem do Cheque" apos os dados do emitente
- Campo "Valor Pago pelo Cheque" (R$) - opcional
- Campo "Comprado de" (texto) - opcional

**Cards na lista:**
- Exibir "Comprado de: [nome]" quando preenchido
- Exibir "Valor pago: R$ X" quando preenchido

## Visual do Formulario

A nova secao sera adicionada assim:

```text
├─────────────────────────────────────────────────────────────────────────────┤
│ ORIGEM DO CHEQUE (opcional)                                                 │
│ Valor Pago pelo Cheque: R$ [________________]                               │
│ Comprado de: [________________________________________________]             │
├─────────────────────────────────────────────────────────────────────────────┤
```

Os campos serao opcionais, permitindo que o usuario preencha apenas quando relevante (ex: quando o cliente comprou o cheque de terceiros).

## Resultado Esperado

1. Dois novos campos no formulario de cadastro/edicao
2. Informacoes exibidas nos cards quando preenchidas
3. Dados salvos no banco de dados
4. Compatibilidade total com registros existentes (campos nullable)

