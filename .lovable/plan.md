

# Plano: Nome/Link do Servidor por Assinatura

## Objetivo

Mover o nome e link do servidor de uma configuração global para ser por assinatura:
- **Cada assinatura** terá seu próprio servidor (nome + link do painel)
- **Custo do servidor** permanece global (por usuário) para cálculo de lucro

---

## Alterações Necessárias

### 1. Banco de Dados - Adicionar campos na tabela `monthly_fees`

```sql
ALTER TABLE monthly_fees
ADD COLUMN iptv_server_name TEXT,
ADD COLUMN iptv_server_url TEXT;
```

---

### 2. Hook `useMonthlyFees.ts` - Atualizar interfaces

Adicionar os campos na interface `MonthlyFee`:

```typescript
export interface MonthlyFee {
  // ... campos existentes
  iptv_server_name: string | null;
  iptv_server_url: string | null;
}
```

E nas interfaces de criação/atualização:

```typescript
export interface CreateMonthlyFeeData {
  // ... campos existentes
  iptv_server_name?: string;
  iptv_server_url?: string;
}

export interface UpdateMonthlyFeeData {
  // ... campos existentes
  iptv_server_name?: string;
  iptv_server_url?: string;
}
```

---

### 3. Atualizar `IPTVSubscriptionForm.tsx` - Adicionar campos no formulário

Adicionar seção no formulário de nova assinatura:

```tsx
{/* Servidor IPTV */}
<div className="p-3 rounded-lg border bg-muted/30 space-y-3">
  <Label className="text-sm font-semibold">📡 Servidor IPTV</Label>
  <div className="grid grid-cols-2 gap-3">
    <div className="space-y-1">
      <Label className="text-xs">Nome do Servidor</Label>
      <Input
        value={formData.iptv_server_name || ''}
        onChange={(e) => setFormData({ ...formData, iptv_server_name: e.target.value })}
        placeholder="Ex: MegaTV, IPTVBrasil..."
        className="h-9"
      />
    </div>
    <div className="space-y-1">
      <Label className="text-xs">Link do Painel</Label>
      <div className="flex gap-1">
        <Input
          value={formData.iptv_server_url || ''}
          onChange={(e) => setFormData({ ...formData, iptv_server_url: e.target.value })}
          placeholder="https://painel.servidor.com"
          className="h-9"
        />
        {formData.iptv_server_url && (
          <Button variant="outline" size="icon" className="h-9 w-9" asChild>
            <a href={formData.iptv_server_url} target="_blank">
              <ExternalLink className="w-3 h-3" />
            </a>
          </Button>
        )}
      </div>
    </div>
  </div>
</div>
```

---

### 4. Atualizar Card de Assinatura em `ProductSales.tsx`

Mostrar o servidor na assinatura e link para abrir o painel:

```tsx
{/* Na área expandida do card */}
{fee.iptv_server_name && (
  <div className="flex items-center gap-2 text-xs">
    <Server className="w-3 h-3 text-muted-foreground" />
    <span>{fee.iptv_server_name}</span>
    {fee.iptv_server_url && (
      <a href={fee.iptv_server_url} target="_blank" className="text-primary hover:underline">
        (abrir painel)
      </a>
    )}
  </div>
)}
```

---

### 5. Manter `IPTVServerConfig.tsx` apenas para Custo

Simplificar o componente para gerenciar apenas o custo do servidor:

```tsx
// Remover campos iptv_server_name e iptv_server_url
// Manter apenas iptv_server_cost na configuração global
```

---

## Resumo das Alterações

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Adicionar `iptv_server_name` e `iptv_server_url` na tabela `monthly_fees` |
| `src/hooks/useMonthlyFees.ts` | Atualizar interfaces MonthlyFee, CreateMonthlyFeeData, UpdateMonthlyFeeData |
| `src/components/iptv/IPTVSubscriptionForm.tsx` | Adicionar campos de servidor no formulário |
| `src/pages/ProductSales.tsx` | Exibir servidor no card e no modal de edição |
| `src/components/iptv/IPTVServerConfig.tsx` | Manter apenas campo de custo (simplificar) |

---

## Resultado Final

**No formulário de Nova Assinatura:**
- Campo "Nome do Servidor" (Ex: MegaTV)
- Campo "Link do Painel" com botão para abrir

**No card de cada assinatura:**
- Nome do servidor visível
- Link para abrir o painel do servidor

**Na configuração global (botão Servidor):**
- Apenas o custo mensal do servidor para cálculo de lucro

