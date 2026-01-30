

# Plano: Atualização Automática do Calendário de Cobranças

## ✅ IMPLEMENTADO

### Alterações Realizadas

**1. src/hooks/useLoans.ts**
- `staleTime`: 5 minutos → 30 segundos
- `refetchInterval`: Adicionado polling automático de 60 segundos

**2. src/pages/CalendarView.tsx**
- Adicionado `useEffect` que força `fetchLoans()` ao montar o componente

### Resultado

- O calendário atualiza automaticamente a cada 60 segundos
- Dados sempre frescos ao navegar para a página
- Sem necessidade de botão manual
