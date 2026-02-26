

## Status Online e Último Acesso dos Funcionários

### O que será feito

Adicionar rastreamento de quando cada funcionário fez login pela última vez e se está online agora, visível na aba "Gerenciar" da página de Funcionários.

### Alterações

#### 1. Migration SQL — Adicionar colunas na tabela `employees`
- `last_seen_at` (timestamptz) — atualizado a cada ação do funcionário ou periodicamente
- `last_login_at` (timestamptz) — atualizado no login

Criar uma função `update_employee_last_seen` (Security Definer) que atualiza `last_seen_at` para o funcionário autenticado. Será chamada pelo frontend periodicamente.

Criar um trigger no `employee_activity_log` que atualiza `last_seen_at` automaticamente a cada atividade registrada.

#### 2. `src/hooks/useEmployeeContext.tsx` — Ping de presença
Adicionar um `setInterval` de 2 minutos que chama `update_employee_last_seen` via RPC quando o usuário é funcionário. Isso mantém o `last_seen_at` atualizado enquanto o app está aberto.

Atualizar `last_login_at` no carregamento inicial do contexto (uma vez por sessão).

#### 3. `src/components/EmployeeManagement.tsx` — Exibir status
No card de cada funcionário, mostrar:
- **Indicador verde** "Online" se `last_seen_at` < 3 minutos atrás
- **Indicador amarelo** "Visto recentemente" se `last_seen_at` < 30 minutos
- **Indicador cinza** "Offline" com texto "Último acesso: há X min/horas/dias"
- Data/hora do último login

#### 4. Buscar `last_seen_at` e `last_login_at` no fetch de funcionários
Adicionar essas colunas na query `select` existente em `fetchEmployees()`.

### Detalhes técnicos

- O ping RPC é leve (um UPDATE simples por employee_user_id)
- O trigger no `employee_activity_log` garante que qualquer ação também atualize o `last_seen_at`, mesmo sem o ping
- Considerar funcionário "online" se `last_seen_at` foi nos últimos 3 minutos

