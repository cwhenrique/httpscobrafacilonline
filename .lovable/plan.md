
# Adicionar Aluguel de Veículos em Contratos

## Resumo

Adicionar a opção "Aluguel de Veículos" no dropdown de tipo de contrato. Quando selecionada, novos campos específicos do veículo aparecem no formulário para capturar informações como placa, marca, modelo, cor, km inicial e km final.

## Alterações Necessárias

### 1. Adicionar nova opção no Select de tipo de contrato

**Arquivo:** `src/pages/ProductSales.tsx`

**Localização:** Linhas 1893-1901 (Select de tipo de contrato)

Adicionar a opção:
```jsx
<SelectItem value="aluguel_veiculo">Aluguel de Veículo</SelectItem>
```

### 2. Adicionar label na função getContractTypeLabel

**Arquivo:** `src/pages/ProductSales.tsx`

**Localização:** Linhas 1172-1184

Adicionar no objeto labels:
```typescript
aluguel_veiculo: 'Aluguel de Veículo',
```

### 3. Adicionar campos de veículo no formulário

**Arquivo:** `src/pages/ProductSales.tsx`

**Localização:** Após o Select de tipo de contrato (linha 1902), adicionar seção condicional:

```jsx
{contractForm.contract_type === 'aluguel_veiculo' && (
  <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-4">
    <div className="flex items-center gap-2 text-primary">
      <Car className="w-4 h-4" />
      <Label className="font-medium">Dados do Veículo</Label>
    </div>
    
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Placa *</Label>
        <Input placeholder="ABC-1234" value={contractForm.vehicle_plate} 
               onChange={(e) => setContractForm({...contractForm, vehicle_plate: e.target.value.toUpperCase()})} />
      </div>
      <div className="space-y-2">
        <Label>Marca</Label>
        <Input placeholder="Ex: Fiat, Honda..." value={contractForm.vehicle_brand} 
               onChange={(e) => setContractForm({...contractForm, vehicle_brand: e.target.value})} />
      </div>
    </div>
    
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Modelo</Label>
        <Input placeholder="Ex: Uno, Civic..." value={contractForm.vehicle_model} 
               onChange={(e) => setContractForm({...contractForm, vehicle_model: e.target.value})} />
      </div>
      <div className="space-y-2">
        <Label>Cor</Label>
        <Input placeholder="Ex: Preto, Prata..." value={contractForm.vehicle_color} 
               onChange={(e) => setContractForm({...contractForm, vehicle_color: e.target.value})} />
      </div>
    </div>
    
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>KM Inicial</Label>
        <Input type="number" placeholder="0" value={contractForm.vehicle_km_start} 
               onChange={(e) => setContractForm({...contractForm, vehicle_km_start: e.target.value})} />
      </div>
      <div className="space-y-2">
        <Label>KM Final (devolução)</Label>
        <Input type="number" placeholder="0" value={contractForm.vehicle_km_end} 
               onChange={(e) => setContractForm({...contractForm, vehicle_km_end: e.target.value})} />
      </div>
    </div>
    
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Ano</Label>
        <Input type="number" placeholder="2024" value={contractForm.vehicle_year} 
               onChange={(e) => setContractForm({...contractForm, vehicle_year: e.target.value})} />
      </div>
      <div className="space-y-2">
        <Label>Renavam</Label>
        <Input placeholder="00000000000" value={contractForm.vehicle_renavam} 
               onChange={(e) => setContractForm({...contractForm, vehicle_renavam: e.target.value})} />
      </div>
    </div>
  </div>
)}
```

### 4. Atualizar estado inicial do contractForm

**Arquivo:** `src/pages/ProductSales.tsx`

**Localização:** Linhas 331-349 (estado contractForm)

Adicionar novos campos:
```typescript
const [contractForm, setContractForm] = useState<CreateContractData>({
  // ... campos existentes ...
  vehicle_plate: '',
  vehicle_brand: '',
  vehicle_model: '',
  vehicle_color: '',
  vehicle_km_start: '',
  vehicle_km_end: '',
  vehicle_year: '',
  vehicle_renavam: '',
});
```

### 5. Atualizar resetContractForm

**Arquivo:** `src/pages/ProductSales.tsx`

**Localização:** Linhas 398-420

Adicionar reset dos novos campos:
```typescript
vehicle_plate: '',
vehicle_brand: '',
vehicle_model: '',
vehicle_color: '',
vehicle_km_start: '',
vehicle_km_end: '',
vehicle_year: '',
vehicle_renavam: '',
```

### 6. Salvar dados do veículo nas observações

Como a tabela `contracts` não possui colunas específicas para veículos, os dados serão armazenados no campo `notes` em formato estruturado:

**Arquivo:** `src/pages/ProductSales.tsx`

**Localização:** Função `handleCreateContract`

Modificar para incluir dados do veículo nas observações:
```typescript
const vehicleNotes = contractForm.contract_type === 'aluguel_veiculo' 
  ? `[VEÍCULO] Placa: ${contractForm.vehicle_plate} | Marca: ${contractForm.vehicle_brand} | Modelo: ${contractForm.vehicle_model} | Cor: ${contractForm.vehicle_color} | Ano: ${contractForm.vehicle_year} | KM Inicial: ${contractForm.vehicle_km_start} | KM Final: ${contractForm.vehicle_km_end} | Renavam: ${contractForm.vehicle_renavam}\n\n`
  : '';

const fullNotes = vehicleNotes + (contractForm.notes || '');
```

### 7. Exibir informações do veículo no card do contrato

**Arquivo:** `src/pages/ProductSales.tsx`

**Localização:** No card de contrato (linhas 2039-2064)

Adicionar exibição de placa quando for aluguel de veículo:
```jsx
{contract.contract_type === 'aluguel_veiculo' && contract.notes?.includes('[VEÍCULO]') && (
  <div className="flex items-center gap-1 text-xs text-muted-foreground">
    <Car className="w-3 h-3" />
    {contract.notes.match(/Placa: ([^\|]+)/)?.[1]?.trim()}
  </div>
)}
```

### 8. Atualizar interfaces de tipo

**Arquivo:** `src/hooks/useContracts.ts`

Adicionar campos opcionais ao `CreateContractData`:
```typescript
export interface CreateContractData {
  // ... campos existentes ...
  vehicle_plate?: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  vehicle_km_start?: string;
  vehicle_km_end?: string;
  vehicle_year?: string;
  vehicle_renavam?: string;
}
```

## Seção Técnica

### Campos do Veículo a Adicionar

| Campo | Tipo | Descrição |
|-------|------|-----------|
| vehicle_plate | string | Placa do veículo (obrigatório para aluguel de veículo) |
| vehicle_brand | string | Marca (Fiat, Honda, Toyota...) |
| vehicle_model | string | Modelo (Uno, Civic, Corolla...) |
| vehicle_color | string | Cor do veículo |
| vehicle_km_start | string | Quilometragem inicial |
| vehicle_km_end | string | Quilometragem na devolução |
| vehicle_year | string | Ano do veículo |
| vehicle_renavam | string | Código Renavam |

### Layout Visual do Formulário

```text
+------------------------------------------+
| Tipo de contrato                         |
| [Aluguel de Veículo ▼]                   |
+------------------------------------------+
| 🚗 Dados do Veículo                      |
| ---------------------------------------- |
| Placa *        | Marca                   |
| [ABC-1234]     | [Fiat]                  |
| ---------------------------------------- |
| Modelo         | Cor                     |
| [Uno]          | [Prata]                 |
| ---------------------------------------- |
| KM Inicial     | KM Final (devolução)    |
| [45000]        | [0]                     |
| ---------------------------------------- |
| Ano            | Renavam                 |
| [2020]         | [00000000000]           |
+------------------------------------------+
```

### Layout do Card com Veículo

```text
+------------------------------------------+
| [👤] João Silva                          |
|      Aluguel de Veículo                  |
|      🚗 ABC-1234                         |   <-- Placa do veículo
+------------------------------------------+
```

## Benefícios

1. Novo tipo de contrato para locadoras de veículos
2. Campos específicos aparecem apenas quando necessário (formulário dinâmico)
3. Informações do veículo salvas de forma estruturada para referência futura
4. Placa visível diretamente no card para identificação rápida
5. Sem necessidade de alterações no banco de dados (usa campo notes existente)

## Importações Necessárias

Adicionar o ícone `Car` do lucide-react (se ainda não estiver importado):
```typescript
import { Car } from 'lucide-react';
```
