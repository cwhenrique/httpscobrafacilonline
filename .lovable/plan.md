
# Plano: Adicionar Opcao de Cliente Manual no Formulario de Assinatura IPTV

## Visao Geral

Modificar o formulario de assinatura IPTV para permitir que o usuario escolha entre:
1. **Selecionar um cliente existente** da base de dados (comportamento atual)
2. **Cadastrar um novo cliente** diretamente no formulario, inserindo nome, CPF, telefone e outras informacoes

## Estrutura da Solucao

```text
+------------------------------------------+
|  Nova Assinatura IPTV                    |
+------------------------------------------+
|                                          |
|  [x] Cliente existente  [ ] Novo cliente |
|                                          |
|  SE "Cliente existente":                 |
|  +------------------------------------+  |
|  |  Dropdown: Selecione um cliente   |  |
|  +------------------------------------+  |
|                                          |
|  SE "Novo cliente":                      |
|  +------------------------------------+  |
|  |  Nome: __________________________ |  |
|  |  Telefone: ______________________ |  |
|  |  CPF: ___________________________ |  |
|  |  Email: _________________________ |  |
|  +------------------------------------+  |
|                                          |
|  ... resto do formulario ...             |
+------------------------------------------+
```

## Fluxo de Funcionamento

1. Usuario abre o formulario de nova assinatura
2. Escolhe entre "Cliente existente" ou "Novo cliente"
3. Se "Novo cliente":
   - Preenche nome, telefone, CPF e email
   - Ao submeter, o sistema cria o cliente primeiro
   - Depois cria a assinatura vinculada ao novo cliente
4. Se "Cliente existente":
   - Comportamento atual (seleciona do dropdown)

## Alteracoes Necessarias

### 1. Interface CreateMonthlyFeeData (useMonthlyFees.ts)

Adicionar campos opcionais para novo cliente:

| Campo | Tipo | Descricao |
|-------|------|-----------|
| create_new_client | boolean | Se deve criar novo cliente |
| new_client_name | string | Nome do novo cliente |
| new_client_phone | string | Telefone do novo cliente |
| new_client_cpf | string | CPF do novo cliente |
| new_client_email | string | Email do novo cliente |

### 2. Hook useMonthlyFees.ts - createFee mutation

Modificar a mutation para:
1. Verificar se `create_new_client` e true
2. Se sim, criar o cliente primeiro usando a tabela `clients`
3. Usar o ID do cliente criado para criar a assinatura
4. Invalidar a query de clientes apos criar

### 3. Componente IPTVSubscriptionForm.tsx

Adicionar:
- Tabs ou RadioGroup para escolher modo de cliente
- Campos de entrada para dados do novo cliente
- Validacao para garantir que nome seja preenchido
- Auto-gerar username baseado no nome digitado (novo cliente)

## Detalhes Tecnicos

### Campos do Novo Cliente

| Campo | Obrigatorio | Validacao |
|-------|-------------|-----------|
| Nome | Sim | Minimo 2 caracteres |
| Telefone | Nao | Formato telefone brasileiro |
| CPF | Nao | Formato CPF |
| Email | Nao | Formato email |

### Logica de Criacao

```typescript
// No hook createFee
if (data.create_new_client && data.new_client_name) {
  // 1. Criar cliente
  const { data: newClient, error } = await supabase
    .from('clients')
    .insert({
      user_id: userId,
      full_name: data.new_client_name,
      phone: data.new_client_phone || null,
      cpf: data.new_client_cpf || null,
      email: data.new_client_email || null,
      client_type: 'monthly',
      created_by: userId,
    })
    .select()
    .single();
    
  if (error) throw error;
  
  // 2. Usar ID do novo cliente
  data.client_id = newClient.id;
}

// 3. Continuar com criacao da assinatura normalmente
```

### Interface Atualizada

```typescript
export interface CreateMonthlyFeeData {
  client_id: string;
  amount: number;
  // ... campos existentes ...
  
  // Novos campos para cliente inline
  create_new_client?: boolean;
  new_client_name?: string;
  new_client_phone?: string;
  new_client_cpf?: string;
  new_client_email?: string;
}
```

### Componente de Selecao de Modo

```typescript
// Usando RadioGroup para selecionar modo
<RadioGroup 
  value={clientMode} 
  onValueChange={setClientMode}
  className="flex gap-4"
>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="existing" id="existing" />
    <Label htmlFor="existing">Cliente existente</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="new" id="new" />
    <Label htmlFor="new">Novo cliente</Label>
  </div>
</RadioGroup>
```

## Arquivos a Modificar

1. **src/hooks/useMonthlyFees.ts**
   - Adicionar campos na interface CreateMonthlyFeeData
   - Modificar mutation createFee para criar cliente se necessario
   - Invalidar query de clientes apos criar novo

2. **src/components/iptv/IPTVSubscriptionForm.tsx**
   - Adicionar estado para modo de cliente (existing/new)
   - Adicionar campos para dados do novo cliente
   - Atualizar logica de validacao e submit
   - Adaptar auto-geracao de username para novo cliente

## Validacoes

1. Se modo "existing": client_id obrigatorio
2. Se modo "new": new_client_name obrigatorio
3. Manter validacao de amount existente
4. CPF e telefone sao opcionais mas com formatacao correta

## Resultado Esperado

1. Usuario pode criar assinatura rapidamente sem sair do formulario
2. Novo cliente e criado automaticamente com tipo "monthly"
3. Assinatura e vinculada ao cliente recem-criado
4. Lista de clientes e atualizada apos criacao
5. Username de acesso e gerado baseado no nome digitado
