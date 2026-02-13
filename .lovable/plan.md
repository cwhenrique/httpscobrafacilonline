
# Recebimentos Separados por Funcionario

## Objetivo
Quando o dono da conta tem funcionarios ativos, a area de **Recebimentos** deve exibir os valores que o funcionario registrou separados dos valores registrados pelo proprio dono, permitindo controle de quem recebeu o que no dia.

## Problema Atual
A tabela `loan_payments` nao possui um campo `created_by`, entao nao e possivel saber quem registrou cada pagamento. Todos os pagamentos aparecem juntos sem distincao.

## Plano de Implementacao

### 1. Adicionar coluna `created_by` na tabela `loan_payments`
- Nova coluna `created_by UUID NOT NULL DEFAULT auth.uid()`
- Pagamentos existentes terao `created_by = user_id` (preenchimento retroativo)
- Isso permite rastrear qual usuario (dono ou funcionario) registrou o pagamento

### 2. Atualizar o hook `useLoans.ts` - Inserir `created_by`
- Na funcao `addPayment`, incluir `created_by: user?.id` (o ID real do usuario logado, nao o `effectiveUserId`)
- `user_id` continua sendo o `effectiveUserId` (dono) para RLS
- `created_by` sera o `auth.uid()` real (funcionario ou dono)

### 3. Modificar o componente `PaymentsHistoryTab`
- Buscar dados dos funcionarios ativos do dono
- Agrupar pagamentos por `created_by`:
  - **Secao "Meus Recebimentos"**: pagamentos onde `created_by = user.id` (dono)
  - **Secao por funcionario**: pagamentos onde `created_by = employee_user_id`, com nome do funcionario
- Cada secao tera seus proprios cards de resumo (Total Recebido, Juros, Principal, Qtd)
- Cards de resumo geral no topo continuam mostrando o total consolidado

### 4. Layout Visual
```text
+-----------------------------------------------+
| Resumo Total (consolidado)                     |
| Total Recebido | Juros | Principal | Qtd       |
+-----------------------------------------------+

+-----------------------------------------------+
| Meus Recebimentos (Dono)           R$ X.XXX   |
| [tabela de pagamentos do dono]                 |
+-----------------------------------------------+

+-----------------------------------------------+
| Funcionario: "Secretaria"          R$ X.XXX   |
| [tabela de pagamentos do funcionario]          |
+-----------------------------------------------+
```

- Se o usuario nao tem funcionarios ativos, o layout permanece como esta hoje (sem separacao)
- Cada secao e colapsavel para facilitar navegacao

### Detalhes Tecnicos

**Migracao SQL:**
```sql
ALTER TABLE loan_payments ADD COLUMN created_by UUID DEFAULT auth.uid();
UPDATE loan_payments SET created_by = user_id WHERE created_by IS NULL;
ALTER TABLE loan_payments ALTER COLUMN created_by SET NOT NULL;
```

**Query de pagamentos (atualizada):**
- Incluir `created_by` no SELECT
- JOIN com `employees` para obter nome do funcionario registrador

**Logica de agrupamento:**
- Buscar funcionarios ativos do dono: `SELECT employee_user_id, name FROM employees WHERE owner_id = user.id AND is_active = true`
- Agrupar pagamentos: `payments.filter(p => p.created_by === userId)` para o dono, e filtrar por cada `employee_user_id` para funcionarios

**Condicao de exibicao:**
- Separacao so aparece quando `isOwner === true` e existem funcionarios ativos
- Funcionarios veem apenas seus proprios recebimentos (sem separacao)
