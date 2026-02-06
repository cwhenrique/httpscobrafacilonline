

## Plano: Adicionar Lista de Usuários Trial para o Diego

### Contexto

Atualmente, o usuário "Diego" (identificado pelo login `diego/diego321`) possui acesso restrito na página de Gerenciamento de Usuários:
- Ele pode **apenas criar** usuários do tipo Trial (24 horas)
- Ele **NÃO visualiza** a lista de usuários existentes

O pedido é permitir que ele veja os usuários que estão na versão Trial.

### Solução Proposta

Adicionar uma seção de lista de usuários Trial abaixo do formulário de criação, exibindo apenas os usuários com `subscription_plan === 'trial'` (ou sem plano definido, que também são trial).

### Alterações no Arquivo

**Arquivo:** `src/pages/CreateTrialUser.tsx`

#### 1. Criar estado para controlar a visualização da lista Trial

Adicionar um `useMemo` para filtrar apenas usuários Trial:

```typescript
const trialUsers = useMemo(() => {
  return users.filter(u => u.subscription_plan === 'trial' || !u.subscription_plan);
}, [users]);
```

#### 2. Modificar a seção do Trial Creator (linhas ~1150-1266)

Atualmente, quando `isTrialCreatorOnly === true`, exibe apenas o formulário centralizado. A alteração será:

- Mudar layout de `max-w-md mx-auto` para `grid lg:grid-cols-3 gap-6`
- O formulário ocupará 1 coluna
- A lista de usuários Trial ocupará 2 colunas

#### 3. Adicionar Card da Lista de Usuários Trial

Nova estrutura para Diego:

```tsx
{isTrialCreatorOnly && (
  <div className="grid gap-6 lg:grid-cols-3">
    {/* Formulário de criação - 1 coluna */}
    <Card className="border-primary">
      {/* ... formulário existente ... */}
    </Card>

    {/* Lista de Usuários Trial - 2 colunas */}
    <Card className="border-primary lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-yellow-500" />
            <CardTitle>Usuários Trial ({trialUsers.length})</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loadingUsers}>
            <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {/* Campo de busca */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        {/* Tabela simplificada */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cadastrado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTrialUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.full_name || '-'}</TableCell>
                <TableCell>{user.email || '-'}</TableCell>
                <TableCell>{user.phone || '-'}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-1 rounded ${getStatusInfo(user).className}`}>
                    {getStatusInfo(user).label}
                  </span>
                </TableCell>
                <TableCell>
                  {user.created_at 
                    ? format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })
                    : '-'
                  }
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {/* Paginação se necessário */}
      </CardContent>
    </Card>
  </div>
)}
```

#### 4. Adicionar filtro de busca para a lista Trial

Criar um `useMemo` para filtrar usuários Trial com base na busca:

```typescript
const filteredTrialUsers = useMemo(() => {
  let result = trialUsers;
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    result = result.filter(user => 
      (user.full_name?.toLowerCase().includes(query)) ||
      (user.email?.toLowerCase().includes(query))
    );
  }
  return result;
}, [trialUsers, searchQuery]);
```

### Funcionalidades para Diego

A lista exibida para Diego terá:

| Recurso | Incluído |
|---------|----------|
| Visualizar usuários Trial | Sim |
| Buscar por nome/email | Sim |
| Ver status (Trial ativo/expirado) | Sim |
| Ver data de cadastro | Sim |
| Botão de atualizar lista | Sim |
| Editar plano | **Nao** |
| Ativar/Inativar usuário | **Nao** |
| Copiar senha | **Nao** |
| Exportar CSV | **Nao** |

### Resultado Visual Esperado

Após a implementação, o usuário Diego verá:

```text
+------------------+------------------------------------+
|  Criar Usuário   |     Usuários Trial (42)        [↻] |
|                  |  [🔍 Buscar por nome ou email...] |
|  Nome:________   |                                    |
|  Email:_______   |  Nome  | Email | Tel | Status     |
|  Telefone:____   |  ------|-------|-----|----------- |
|  Senha:_______   |  João  | j@... | 17  | Trial até  |
|                  |  Maria | m@... | 11  | Expirado   |
|  🧪 Trial (24h)  |  ...   |       |     |            |
|                  |                                    |
|  [Criar Usuário] |  1 2 3 ... 10 >                   |
+------------------+------------------------------------+
```

### Segurança

- Diego **não terá** acesso a funcionalidades administrativas (editar plano, resetar senha, ativar/inativar)
- Ele apenas **visualiza** os usuários Trial existentes no sistema
- A lista usa o mesmo `fetchUsers()` que já existe, que busca via edge function

