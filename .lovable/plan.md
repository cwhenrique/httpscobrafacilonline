
# Plano: Bloquear Funcionalidade "Desconto de Cheque"

## Objetivo

Bloquear completamente a funcionalidade de Desconto de Cheque para todos os usuarios e exibir uma tela de bloqueio com a mensagem informando que e necessario comprar por R$ 19,90.

## Abordagem

Ao inves de remover a rota ou esconder o menu, vamos manter tudo visivel mas exibir uma tela de bloqueio quando o usuario acessar a pagina. Isso funciona como uma "preview" que incentiva a compra.

## Modificacao Necessaria

### Arquivo: src/pages/CheckDiscounts.tsx

Adicionar uma verificacao no inicio do componente que retorna uma tela de bloqueio ao inves do conteudo normal.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                            🔒 Funcionalidade Premium                        │
│                                                                             │
│                              DESCONTO DE CHEQUE                             │
│                                                                             │
│     Gerencie cheques pre-datados com controle total de risco,               │
│     vencimento e recebimento.                                               │
│                                                                             │
│     ✓ Calculo automatico de desconto                                       │
│     ✓ Controle de status (carteira, compensado, devolvido)                 │
│     ✓ Cobranca automatica via WhatsApp                                     │
│     ✓ Ranking de risco por cliente                                         │
│     ✓ Relatorios completos                                                 │
│                                                                             │
│     ┌─────────────────────────────────────────────────────────────┐        │
│     │                    POR APENAS                               │        │
│     │                    R$ 19,90                                 │        │
│     │                    pagamento unico                          │        │
│     └─────────────────────────────────────────────────────────────┘        │
│                                                                             │
│                   [ Comprar Agora via WhatsApp ]                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Visual da Tela de Bloqueio

A tela tera:
- Icone de cadeado grande
- Titulo "Funcionalidade Premium"
- Nome da funcionalidade
- Lista de beneficios
- Preco destacado (R$ 19,90)
- Botao verde do WhatsApp para contato de compra

## Codigo a Implementar

No componente `CheckDiscounts`, logo apos os hooks e antes do return principal, adicionar:

```tsx
// Feature is locked for all users
const isFeatureLocked = true;

if (isFeatureLocked) {
  return (
    <DashboardLayout>
      <div className="min-h-[80vh] flex items-center justify-center">
        <Card className="max-w-lg w-full text-center p-8">
          {/* Lock icon */}
          <Lock className="w-16 h-16 mx-auto text-amber-500 mb-4" />
          
          {/* Title */}
          <h1 className="text-2xl font-bold mb-2">Funcionalidade Premium</h1>
          <h2 className="text-xl text-primary mb-6">Desconto de Cheque</h2>
          
          {/* Description */}
          <p className="text-muted-foreground mb-6">
            Gerencie cheques pre-datados com controle total de risco, 
            vencimento e recebimento.
          </p>
          
          {/* Benefits list */}
          <ul className="text-left space-y-2 mb-8">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="text-green-500" />
              Calculo automatico de desconto
            </li>
            {/* ... more benefits */}
          </ul>
          
          {/* Price */}
          <div className="bg-primary/10 rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground">Por apenas</p>
            <p className="text-4xl font-bold text-primary">R$ 19,90</p>
            <p className="text-sm text-muted-foreground">pagamento unico</p>
          </div>
          
          {/* WhatsApp button */}
          <Button className="w-full bg-green-500 hover:bg-green-600">
            <Phone className="mr-2" />
            Comprar Agora via WhatsApp
          </Button>
        </Card>
      </div>
    </DashboardLayout>
  );
}
```

## Resultado Esperado

1. Menu "Desconto de Cheque" continua visivel no sidebar
2. Ao clicar, usuario ve tela de bloqueio elegante
3. Tela mostra beneficios da funcionalidade
4. Preco R$ 19,90 em destaque
5. Botao WhatsApp para facilitar compra
6. Codigo fica pronto para desbloquear no futuro (basta mudar `isFeatureLocked` para `false` ou adicionar logica de verificacao)
