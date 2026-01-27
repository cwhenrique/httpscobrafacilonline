

# Melhorias para a Seção de Contratos

## Análise da Situação Atual

A seção de Contratos atualmente possui funcionalidades básicas, mas está menos desenvolvida comparada aos Empréstimos e Produtos. Identificamos várias oportunidades de melhoria:

### O que já existe:
- Criação de contratos com cliente, tipo, valor, parcelas e primeiro vencimento
- Frequência mensal (única opção disponível atualmente no formulário)
- Botões de cobrança WhatsApp (recém implementados)
- Edição básica (apenas nome do cliente e observações)
- Listagem de parcelas com pagamento

### O que está faltando (comparando com Empréstimos e Produtos):

| Funcionalidade | Empréstimos | Produtos | Contratos |
|----------------|-------------|----------|-----------|
| Semanal/Quinzenal | ✅ | ✅ | ❌ |
| Data do contrato | ✅ | ✅ | ❌ |
| Seletor de clientes | ✅ | ✅ | ❌ |
| Histórico de contratos | ✅ | ✅ | ❌ |
| Edição completa | ✅ | ✅ | ❌ |
| Resumo visual do contrato | ✅ | ✅ | ❌ |
| Indicadores de status | ✅ | ✅ | Parcial |

## Plano de Implementação

### 1. Adicionar Frequência Semanal e Quinzenal

**Arquivo:** `src/pages/ProductSales.tsx`

**Mudanças no formulário de criação (linhas ~1634-1668):**

Adicionar campo Select para frequência após o campo "Tipo de contrato":

```text
Nova estrutura do formulário:
- Tipo de contrato (existente)
- [NOVO] Frequência de pagamento (mensal/quinzenal/semanal)
- Valor mensal (renomear para "Valor da parcela")
- Nº de parcelas
- Primeiro vencimento
- [NOVO] Data do contrato (quando o acordo foi feito)
```

**Opções de frequência:**
- `monthly` - Mensal (a cada 30 dias)
- `biweekly` - Quinzenal (a cada 15 dias)
- `weekly` - Semanal (a cada 7 dias)

**Nota:** O hook `useContracts.ts` já suporta essas frequências (linhas 81-93), então só precisamos atualizar a UI.

### 2. Adicionar ClientSelector ao Formulário

**Arquivo:** `src/pages/ProductSales.tsx`

Adicionar o componente `ClientSelector` no início do formulário (igual ao que existe em Produtos):

```text
- [NOVO] Seletor de cliente cadastrado (preenche dados automaticamente)
- Cliente / Inquilino
- Telefone / E-mail
- CPF / RG
- Endereço
```

Isso permite reutilizar dados de clientes já cadastrados no sistema.

### 3. Adicionar Data do Contrato

**Arquivo:** `src/pages/ProductSales.tsx`

Adicionar campo "Data do Contrato" separado do "Primeiro Vencimento":

- **Data do Contrato:** Quando o acordo foi assinado/fechado
- **Primeiro Vencimento:** Quando a primeira parcela vence

Isso já existe em Empréstimos e Produtos e é importante para documentação.

### 4. Opção de Contrato Histórico

**Arquivo:** `src/pages/ProductSales.tsx`

Adicionar checkbox para marcar contratos antigos (igual ao que existe em Produtos):

```text
[checkbox] É um contrato antigo que está registrando na plataforma?
    - Mostrar lista de parcelas com opção de marcar como já pagas
    - Selecionar quais parcelas já foram pagas antes de cadastrar
```

Isso evita notificações de atraso para contratos que já tinham parcelas pagas.

### 5. Expandir Modal de Edição

**Arquivo:** `src/pages/ProductSales.tsx` (linhas ~2607-2623)

Atualmente o modal de edição só permite alterar nome e observações. Expandir para incluir:

- Nome do cliente
- Telefone / E-mail / CPF / RG / Endereço
- Tipo de contrato
- Valor da parcela
- Observações
- [NOVO] Lista de parcelas com opção de:
  - Alterar data de vencimento individual
  - Alterar valor individual
  - Marcar/desmarcar como paga

### 6. Filtros de Status

**Arquivo:** `src/pages/ProductSales.tsx`

Adicionar botões de filtro por status na listagem (igual ao que existe em Produtos):

```text
[Todos (X)] [Pendentes (X)] [Em dia (X)] [Atrasados (X)] [Quitados (X)]
```

### 7. Dashboard de Contratos

**Arquivo:** `src/pages/ProductSales.tsx`

Adicionar cards de resumo no topo da aba Contratos (igual aos que existem em Produtos):

```text
+------------------+------------------+------------------+------------------+
| 📋 Total         | 💰 A Receber     | ⚠️ Em Atraso     | ✅ Recebido      |
| X contratos      | R$ XXX,XX        | R$ XXX,XX        | R$ XXX,XX        |
+------------------+------------------+------------------+------------------+
```

### 8. Melhorar Visualização do Card

**Arquivo:** `src/pages/ProductSales.tsx`

Adicionar informações visuais ao card do contrato:

- Exibir frequência do contrato (Mensal/Quinzenal/Semanal)
- Exibir data do contrato quando disponível
- Adicionar ícone de alerta para contratos atrasados (já existe parcialmente)
- Mostrar progresso visual (barra ou porcentagem de parcelas pagas)

## Detalhes Técnicos

### Modificações no Estado do Formulário

```typescript
// Estado atual do contractForm
const [contractForm, setContractForm] = useState<CreateContractData>({
  client_name: '',
  client_phone: '',
  // ... outros campos
  frequency: 'monthly',  // Já existe, só não aparece na UI
  // ...
});

// Adicionar novos campos:
const [selectedContractClientId, setSelectedContractClientId] = useState<string | null>(null);
const [contractDate, setContractDate] = useState<string>('');
const [isContractHistorical, setIsContractHistorical] = useState(false);
```

### Novo Layout do Formulário de Criação

```text
+------------------------------------------+
| Novo Contrato                            |
+------------------------------------------+
| 👤 Usar cliente cadastrado               |
| [Seletor de cliente...]                  |
| Selecione para preencher automaticamente |
+------------------------------------------+
| Cliente / Inquilino *  | Telefone        |
| [_______________]      | [___________]   |
+------------------------------------------+
| CPF              | RG                    |
| [___________]    | [___________]         |
+------------------------------------------+
| E-mail           | Endereço              |
| [___________]    | [___________________] |
+------------------------------------------+
| Tipo de contrato                         |
| [Aluguel de Casa ▼]                      |
+------------------------------------------+
| Frequência de Pagamento *                |
| [Mensal ▼]  (Quinzenal/Semanal)          |
+------------------------------------------+
| Valor da Parcela *  | Nº de Parcelas     |
| [___________]       | [___________]      |
+------------------------------------------+
| Data do Contrato    | Primeiro Vencimento|
| [dd/mm/aaaa]        | [dd/mm/aaaa]       |
+------------------------------------------+
| [ ] É contrato antigo? (Marcar já pagas) |
+------------------------------------------+
| Observações                              |
| [_____________________________________]  |
+------------------------------------------+
| [Cadastrar Contrato]                     |
+------------------------------------------+
```

### Arquivos a Modificar

1. **src/pages/ProductSales.tsx**
   - Formulário de criação de contratos (~linhas 1599-1678)
   - Modal de edição de contratos (~linhas 2607-2623)
   - Dashboard/Stats de contratos (novo)
   - Filtros de status (novo)
   - Cards de contrato (~linhas 1689-1830)

2. **src/hooks/useContracts.ts**
   - Adicionar campo `contract_date` ao `CreateContractData` (já existe no banco)
   - Atualizar `UpdateContractData` para incluir mais campos

### Prioridade de Implementação

1. **Alta Prioridade:**
   - Adicionar frequência semanal/quinzenal ao formulário
   - Adicionar Data do Contrato
   - Expandir modal de edição

2. **Média Prioridade:**
   - Adicionar ClientSelector
   - Opção de contrato histórico
   - Filtros de status

3. **Baixa Prioridade:**
   - Dashboard de resumo
   - Melhorias visuais nos cards

## Benefícios

1. **Consistência:** Mesma experiência que em Empréstimos e Produtos
2. **Flexibilidade:** Suporte a contratos semanais/quinzenais para diferentes tipos de negócio
3. **Produtividade:** ClientSelector evita digitação repetida
4. **Precisão:** Data do contrato vs primeiro vencimento para documentação
5. **Controle:** Edição completa sem precisar recriar contratos

