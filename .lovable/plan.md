# Plano: Gastos Iniciais no Formulário de Contrato de Veículo

## ✅ IMPLEMENTADO

Funcionalidade para registrar gastos iniciais (manutenção, seguro, documentação, etc.) diretamente ao criar um novo contrato de aluguel de veículo.

---

## Alterações Realizadas

### 1. Importação de categorias de gastos
- Adicionado import de `EXPENSE_CATEGORIES` e `createExpense` do hook `useContractExpenses`

### 2. Estado para gastos iniciais
- Adicionado `contractInitialExpenses` state no componente

### 3. Funções auxiliares
- `addInitialExpense()` - Adiciona novo gasto à lista
- `updateInitialExpense()` - Atualiza campo de um gasto
- `removeInitialExpense()` - Remove gasto da lista

### 4. Seção visual no formulário
- Nova seção "Gastos Iniciais (opcional)" aparece quando `contract_type === 'aluguel_veiculo'`
- Campos: Categoria (select), Valor, Descrição, botão remover
- Exibe total dos gastos

### 5. Criação de gastos junto com contrato
- `handleCreateContract()` modificado para criar gastos após o contrato ser criado
- Usa `createExpense.mutateAsync()` para cada gasto com valor > 0

### 6. Limpeza de estado
- `resetContractForm()` limpa os gastos iniciais
- `useEffect` limpa gastos quando tipo de contrato muda de veículo para outro

---

## Resultado

No formulário de **Novo Contrato** (quando tipo = **Aluguel de Veículo**):

1. ✅ Após os campos do veículo, aparece seção "Gastos Iniciais (opcional)"
2. ✅ Botão "Adicionar" para incluir novos gastos
3. ✅ Para cada gasto: seletor de categoria, valor, descrição e botão de remover
4. ✅ Total de gastos é exibido
5. ✅ Ao criar o contrato, todos os gastos são salvos automaticamente
