
# Plano: Configurações do Servidor IPTV

## Objetivo

Adicionar funcionalidade para o usuário configurar informações do servidor IPTV:
1. **Nome do servidor** - identificação do provedor IPTV
2. **Link do painel** - URL para acesso ao painel de administração
3. **Custo mensal do servidor** - para calcular lucro por assinatura

Com o custo configurado, o dashboard poderá mostrar métricas de lucro (receita - custo).

---

## Alterações Necessárias

### 1. Banco de Dados - Adicionar campos na tabela `profiles`

Novos campos para armazenar as configurações IPTV do usuário:

```sql
ALTER TABLE profiles
ADD COLUMN iptv_server_name TEXT,
ADD COLUMN iptv_server_url TEXT,
ADD COLUMN iptv_server_cost NUMERIC DEFAULT 0;
```

---

### 2. Hook `useProfile.ts` - Atualizar interface

Adicionar os novos campos na interface Profile:

```typescript
// Adicionar na interface Profile
iptv_server_name: string | null;
iptv_server_url: string | null;
iptv_server_cost: number | null;
```

---

### 3. Novo componente `IPTVServerConfig.tsx`

Criar um componente de configuração do servidor com:

- Campo "Nome do Servidor" (texto)
- Campo "Link do Painel" (URL com botão para abrir)
- Campo "Custo Mensal" (valor numérico em R$)
- Botão Salvar

```tsx
// src/components/iptv/IPTVServerConfig.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Server, ExternalLink, DollarSign } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';

export default function IPTVServerConfig() {
  const { profile, updateProfile } = useProfile();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    iptv_server_name: profile?.iptv_server_name || '',
    iptv_server_url: profile?.iptv_server_url || '',
    iptv_server_cost: profile?.iptv_server_cost || 0,
  });
  
  const handleSave = async () => {
    const { error } = await updateProfile(formData);
    if (error) {
      toast.error('Erro ao salvar configurações');
    } else {
      toast.success('Configurações salvas!');
      setIsOpen(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Server className="w-4 h-4" />
          Servidor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurações do Servidor IPTV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Servidor</Label>
            <Input 
              value={formData.iptv_server_name}
              onChange={(e) => setFormData({...formData, iptv_server_name: e.target.value})}
              placeholder="Ex: IPTVBrasil, MegaTV..."
            />
          </div>
          <div className="space-y-2">
            <Label>Link do Painel</Label>
            <div className="flex gap-2">
              <Input 
                value={formData.iptv_server_url}
                onChange={(e) => setFormData({...formData, iptv_server_url: e.target.value})}
                placeholder="https://painel.servidor.com"
              />
              {formData.iptv_server_url && (
                <Button variant="outline" size="icon" asChild>
                  <a href={formData.iptv_server_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Custo Mensal do Servidor (R$)</Label>
            <Input 
              type="number"
              min="0"
              step="0.01"
              value={formData.iptv_server_cost || ''}
              onChange={(e) => setFormData({...formData, iptv_server_cost: parseFloat(e.target.value) || 0})}
              placeholder="150.00"
            />
            <p className="text-xs text-muted-foreground">
              Usado para calcular seu lucro líquido
            </p>
          </div>
          <Button onClick={handleSave} className="w-full">
            Salvar Configurações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

### 4. Atualizar `IPTVDashboard.tsx` - Mostrar lucro

Adicionar card de lucro no dashboard usando o custo do servidor:

```tsx
// Receber profile como prop
interface IPTVDashboardProps {
  fees: MonthlyFee[];
  payments: MonthlyFeePayment[];
  serverCost?: number;
}

// Calcular lucro
const profit = stats.mrr - (serverCost || 0);
const profitPerSubscription = stats.active > 0 
  ? profit / stats.active 
  : 0;

// Exibir cards de lucro
<Card className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10">
  <CardContent className="p-3">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
        <TrendingUp className="w-4 h-4 text-emerald-500" />
      </div>
      <div>
        <p className="text-sm font-bold text-emerald-500">{formatCurrency(profit)}</p>
        <p className="text-xs text-muted-foreground">Lucro Mensal</p>
      </div>
    </div>
  </CardContent>
</Card>
```

---

### 5. Atualizar `ProductSales.tsx` - Integrar componente

Importar e adicionar o botão de configuração junto ao `IPTVPlanManager`:

```tsx
// Na linha 68, adicionar import
import IPTVServerConfig from '@/components/iptv/IPTVServerConfig';

// Na linha 2586, adicionar botão junto aos outros
<div className="flex gap-2">
  <IPTVServerConfig />  {/* NOVO */}
  <IPTVPlanManager />
  <Button className="gap-2" onClick={() => setIsSubscriptionOpen(true)}>
    <Plus className="w-4 h-4" />
    Nova Assinatura
  </Button>
</div>

// Passar serverCost para o IPTVDashboard
<IPTVDashboard 
  fees={monthlyFees} 
  payments={feePayments}
  serverCost={profile?.iptv_server_cost || 0}  {/* NOVO */}
/>
```

---

## Resumo das Alterações

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Adicionar 3 campos: `iptv_server_name`, `iptv_server_url`, `iptv_server_cost` |
| `src/hooks/useProfile.ts` | Adicionar novos campos na interface |
| `src/components/iptv/IPTVServerConfig.tsx` | Novo componente de configuração |
| `src/components/iptv/IPTVDashboard.tsx` | Exibir lucro mensal e lucro por assinatura |
| `src/pages/ProductSales.tsx` | Integrar botão de config e passar custo ao dashboard |

---

## Resultado Final

**No header da aba IPTV:**
- Botão "Servidor" abre dialog com configurações

**Dialog de Configurações:**
- Nome do servidor (identificação)
- Link do painel (com botão para abrir em nova aba)
- Custo mensal (para cálculo de lucro)

**Dashboard atualizado:**
- Card "Lucro Mensal" = MRR - Custo do Servidor
- Tooltip mostrando lucro médio por assinatura
