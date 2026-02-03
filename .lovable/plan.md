
# Plano: Espelhar Todas as Funcionalidades de Empréstimos para Terceiros

## Situacao Atual

A pagina de **Emprestimos de Terceiros** (`ThirdPartyLoans.tsx`) tem apenas **667 linhas** com funcionalidades basicas, enquanto a pagina **Emprestimos** (`Loans.tsx`) tem **14.525 linhas** com diversas funcionalidades avancadas.

## Funcionalidades Faltando em Terceiros

### 1. Abas de Tipos de Emprestimo
| Funcionalidade | Loans.tsx | ThirdPartyLoans.tsx |
|----------------|-----------|---------------------|
| Aba Regular (Parcelado) | Sim | Nao |
| Aba Diario | Sim | Nao |
| Aba Tabela Price | Sim | Nao |
| Aba Historico Pagamentos | Sim | Nao |

### 2. Formularios de Criacao
| Funcionalidade | Loans.tsx | ThirdPartyLoans.tsx |
|----------------|-----------|---------------------|
| Emprestimo parcelado completo | Sim | Parcial |
| Emprestimo diario (com skip feriados/sabados/domingos) | Sim | Nao |
| Tabela Price (calculo PMT) | Sim | Nao |
| Selecao de datas de parcelas manual | Sim | Nao |
| Validacao de inconsistencia (principal > total) | Sim | Nao |

### 3. Cards de Emprestimo
| Funcionalidade | Loans.tsx | ThirdPartyLoans.tsx |
|----------------|-----------|---------------------|
| Visualizacao em Cards | Sim | Sim (basico) |
| Visualizacao em Tabela | Sim | Nao |
| Detalhes de parcelas expandidas | Sim | Nao |
| Indicador parcela vence hoje | Sim | Nao |
| Multas por atraso | Sim | Nao |
| Sub-parcelas de adiantamento | Sim | Nao |

### 4. Acoes nos Emprestimos
| Funcionalidade | Loans.tsx | ThirdPartyLoans.tsx |
|----------------|-----------|---------------------|
| Registrar pagamento simples | Sim | Sim (basico) |
| Pagamento parcial | Sim | Nao |
| Pagamento so juros | Sim | Nao |
| Renegociacao | Sim | Nao |
| Edicao completa | Sim | Nao |
| Adicionar parcelas extras | Sim | Nao |
| Notificacoes WhatsApp | Sim | Nao |
| Gerar recibo PDF contrato | Sim | Nao |
| Gerar recibo PDF pagamento | Sim | Nao |

### 5. Filtros e Busca
| Funcionalidade | Loans.tsx | ThirdPartyLoans.tsx |
|----------------|-----------|---------------------|
| Filtro por status basico | Sim | Sim |
| Filtro por dias em atraso | Sim | Nao |
| Filtro por tipo pagamento | Sim | Nao |
| Filtro por funcionario criador | Sim | Nao |
| Filtro vence hoje | Sim | Nao |

### 6. Hook useThirdPartyLoans.ts
| Funcionalidade | useLoans.ts | useThirdPartyLoans.ts |
|----------------|-------------|----------------------|
| createLoan completo | Sim | Parcial |
| registerPayment com tracking | Sim | Basico |
| updatePaymentDate | Sim | Nao |
| addExtraInstallments | Sim | Nao |
| updateLoan completo | Sim | Parcial |
| deletePayment com reversao | Sim | Basico |

## Estrategia de Implementacao

Como a pagina `Loans.tsx` tem **14.525 linhas**, e preciso replicar TUDO para terceiros, a melhor abordagem e:

### Opcao Escolhida: Parametrizar a Pagina Existente

Em vez de duplicar 14.525 linhas de codigo, criar um **modo terceiro** na pagina existente:

1. Adicionar parametro `isThirdParty` que altera:
   - Hook usado (`useLoans` vs `useThirdPartyLoans`)
   - Cores/visual (verde → teal)
   - Campo obrigatorio de nome do terceiro
   - Titulo e icones

2. Criar componente wrapper `ThirdPartyLoans.tsx` que renderiza `<LoansPage isThirdParty={true} />`

### Arquivos a Modificar

1. **src/pages/Loans.tsx** - Adicionar prop `isThirdParty` e condicoes
2. **src/pages/ThirdPartyLoans.tsx** - Simplificar para wrapper
3. **src/hooks/useThirdPartyLoans.ts** - Expandir para ter todas as funcoes do useLoans
4. **src/components/LoansTableView.tsx** - Adicionar suporte a terceiros

### Detalhes da Implementacao

#### Passo 1: Expandir useThirdPartyLoans.ts
Adicionar as funcoes que faltam:
- `updatePaymentDate` 
- `addExtraInstallments`
- `updateLoan` completo (com todos os campos)
- `deletePayment` com reversao de saldo

#### Passo 2: Modificar Loans.tsx
Adicionar logica condicional:

```typescript
interface LoansPageProps {
  isThirdParty?: boolean;
}

export default function Loans({ isThirdParty = false }: LoansPageProps) {
  // Usar hook correto
  const loansHook = isThirdParty ? useThirdPartyLoans() : useLoans();
  
  // Cores condicionais
  const primaryColor = isThirdParty ? 'teal' : 'primary';
  
  // Campos extras para terceiros
  const [thirdPartyName, setThirdPartyName] = useState('');
  
  // ... resto do codigo com condicoes
}
```

#### Passo 3: Atualizar ThirdPartyLoans.tsx

```typescript
import Loans from './Loans';

export default function ThirdPartyLoans() {
  return <Loans isThirdParty={true} />;
}
```

#### Passo 4: Adicionar Badge de Terceiro nos Cards

Em todos os cards, quando `isThirdParty`:
```typescript
{isThirdParty && (
  <Badge className="bg-teal-500/30 text-teal-700 border-teal-400">
    <Building2 className="w-3 h-3 mr-1" />
    {loan.third_party_name || 'Terceiro'}
  </Badge>
)}
```

## Escopo da Implementacao

### O que sera implementado:
1. Todas as 4 abas (Regular, Diario, Tabela Price, Historico)
2. Todos os formularios de criacao com campo terceiro
3. Todos os tipos de pagamento (parcial, so juros, etc)
4. Todas as acoes (renegociar, editar, excluir, etc)
5. Visualizacao em cards E tabela
6. Todos os filtros
7. Geracao de recibos PDF
8. Notificacoes WhatsApp
9. Visual diferenciado (cor teal)

### Arquivos a Modificar:
1. `src/pages/Loans.tsx` - Adicionar modo terceiro (~200 linhas de condicoes)
2. `src/pages/ThirdPartyLoans.tsx` - Simplificar para wrapper (~10 linhas)
3. `src/hooks/useThirdPartyLoans.ts` - Expandir funcoes (~400 linhas adicionais)
4. `src/components/LoansTableView.tsx` - Badge terceiro (~20 linhas)
5. `src/components/PriceTableDialog.tsx` - Campo terceiro (~30 linhas)
6. Varios componentes auxiliares para suporte a terceiros

## Resultado Esperado

Apos implementacao:
- Pagina de Terceiros tera TODAS as funcionalidades de Emprestimos
- Visual diferenciado com cor teal
- Campo obrigatorio "Nome do Terceiro" em todas as criacoes
- Badge identificando o terceiro em cada card/linha
- Relatorios continuam separados
- Dashboard principal NAO inclui terceiros
