
# Plano: Adicionar Profissao e Dados de Indicacao no Cadastro de Cliente (Emprestimos)

## Visao Geral

Adicionar dois novos campos no formulario de cadastro de clientes (focado em emprestimos):

1. **Profissao**: Campo de texto para informar a ocupacao do cliente
2. **Indicacao**: Checkbox para marcar se foi indicacao, com campos para nome e telefone de quem indicou

## Estrutura Visual da Solucao

```text
+------------------------------------------+
|  Dados Pessoais                          |
+------------------------------------------+
|  Nome: _______________________________   |
|  CPF: ____________  RG: ______________   |
|  Email: _____________  Tel: __________   |
|                                          |
|  Profissão: __________________________   |
|                                          |
|  [x] Cliente veio por indicação          |
|  +------------------------------------+  |
|  | Nome de quem indicou: ___________  |  |
|  | Telefone de quem indicou: ________ |  |
|  +------------------------------------+  |
|                                          |
|  Instagram: _________  Facebook: _____   |
|  Tipo de Cliente: [Empréstimo ▼]         |
|  Observações: ________________________   |
+------------------------------------------+
```

## Etapas de Implementacao

### 1. Migracao de Banco de Dados

Adicionar 3 novas colunas na tabela `clients`:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| profession | text | Profissao/ocupacao do cliente |
| referrer_name | text | Nome de quem indicou |
| referrer_phone | text | Telefone de quem indicou |

```sql
ALTER TABLE clients ADD COLUMN IF NOT EXISTS profession text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS referrer_name text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS referrer_phone text;
```

### 2. Atualizar Interface Client (types/database.ts)

Adicionar os novos campos na interface:

```typescript
export interface Client {
  // ... campos existentes ...
  profession: string | null;
  referrer_name: string | null;
  referrer_phone: string | null;
}
```

### 3. Atualizar Hook useClients.ts

Adicionar os novos campos no metodo `createClient`:

```typescript
const createClient = async (client: {
  // ... campos existentes ...
  profession?: string;
  referrer_name?: string;
  referrer_phone?: string;
}) => {
  // ...
}
```

### 4. Atualizar Formulario em Clients.tsx

**4.1 Atualizar FormData interface e initialFormData**

Adicionar campos:
- `profession: string`
- `referrer_name: string`
- `referrer_phone: string`

**4.2 Adicionar estado para controlar exibicao de indicacao**

```typescript
const [isReferral, setIsReferral] = useState(false);
```

**4.3 Adicionar campos no formulario (Tab Dados Pessoais)**

Apos os campos de redes sociais e antes do Tipo de Cliente:

```typescript
{/* Profissão */}
<div className="space-y-2">
  <Label htmlFor="profession" className="flex items-center gap-2">
    <Briefcase className="w-4 h-4" />
    Profissão
  </Label>
  <Input
    id="profession"
    value={formData.profession}
    onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
    placeholder="Ex: Eletricista, Comerciante, Motorista..."
  />
</div>

{/* Indicação */}
<div className="space-y-3 p-4 border rounded-lg bg-muted/30">
  <div className="flex items-center gap-2">
    <Checkbox
      id="is_referral"
      checked={isReferral}
      onCheckedChange={(checked) => {
        setIsReferral(checked as boolean);
        if (!checked) {
          setFormData({ ...formData, referrer_name: '', referrer_phone: '' });
        }
      }}
    />
    <Label htmlFor="is_referral" className="flex items-center gap-2 cursor-pointer">
      <UserPlus className="w-4 h-4" />
      Cliente veio por indicação
    </Label>
  </div>
  
  {isReferral && (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
      <div className="space-y-2">
        <Label htmlFor="referrer_name">Nome de quem indicou</Label>
        <Input
          id="referrer_name"
          value={formData.referrer_name}
          onChange={(e) => setFormData({ ...formData, referrer_name: e.target.value })}
          placeholder="Nome do indicador"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="referrer_phone">Telefone de quem indicou</Label>
        <Input
          id="referrer_phone"
          value={formData.referrer_phone}
          onChange={(e) => setFormData({ ...formData, referrer_phone: e.target.value })}
          placeholder="(00) 00000-0000"
        />
      </div>
    </div>
  )}
</div>
```

**4.4 Atualizar handleEdit para carregar dados existentes**

```typescript
const handleEdit = (client: Client) => {
  setEditingClient(client);
  setIsReferral(!!client.referrer_name || !!client.referrer_phone);
  setFormData({
    // ... campos existentes ...
    profession: client.profession || '',
    referrer_name: client.referrer_name || '',
    referrer_phone: client.referrer_phone || '',
  });
  // ...
};
```

**4.5 Atualizar resetForm para limpar estado isReferral**

```typescript
const resetForm = () => {
  setIsReferral(false);
  // ... resto do reset ...
};
```

## Arquivos a Modificar

1. **Migracao SQL** - Adicionar colunas na tabela clients
2. **src/types/database.ts** - Adicionar campos na interface Client
3. **src/hooks/useClients.ts** - Aceitar novos campos no createClient
4. **src/pages/Clients.tsx** - Adicionar campos no formulario

## Campos Adicionais

| Campo | Tipo | Obrigatorio | Localizacao |
|-------|------|-------------|-------------|
| profession | string | Nao | Tab Dados Pessoais |
| referrer_name | string | Nao | Tab Dados Pessoais (condicional) |
| referrer_phone | string | Nao | Tab Dados Pessoais (condicional) |

## Icones a Importar

Adicionar na importacao do Clients.tsx:
- `Briefcase` (lucide-react) - para campo profissao
- `UserPlus` (ja importado) - para indicacao

## Resultado Esperado

1. Usuario pode informar a profissao do cliente ao cadastrar
2. Usuario pode marcar se o cliente foi indicado por alguem
3. Se foi indicacao, pode informar nome e telefone de quem indicou
4. Dados sao salvos na tabela clients
5. Ao editar um cliente, os dados de profissao e indicacao sao carregados
6. Campos de indicacao sao ocultados quando checkbox esta desmarcado
