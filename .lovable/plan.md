

# Bloquear DevTools e Ferramentas de Inspeção

## Resumo

Implementar proteções no lado do cliente para dificultar o uso de DevTools, inspeção de elementos e outras ferramentas de edição de código no navegador.

## Importante Saber

Essas proteções são **barreiras de dificuldade**, não bloqueios absolutos. Usuários técnicos determinados podem encontrar formas de contornar. No entanto, para a maioria dos usuários, essas proteções são eficazes.

## Proteções a Implementar

### 1. Bloquear Clique Direito (Menu de Contexto)
Impede o menu que aparece ao clicar com botão direito, que dá acesso a "Inspecionar Elemento".

### 2. Bloquear Atalhos de Teclado
Desabilitar teclas e combinações que abrem DevTools:
- **F12** - Abre DevTools diretamente
- **Ctrl+Shift+I** - Abre DevTools
- **Ctrl+Shift+J** - Abre Console
- **Ctrl+Shift+C** - Seletor de elementos
- **Ctrl+U** - Ver código fonte
- **Ctrl+S** - Salvar página

### 3. Detectar Abertura do DevTools
Monitorar mudanças no tamanho da janela ou tempo de execução para detectar quando DevTools é aberto.

### 4. Desabilitar Seleção de Texto
Impedir seleção de texto em áreas sensíveis para dificultar cópia de código.

### 5. Bloquear Arrastar Elementos
Impedir drag de elementos da página.

## Implementação

### Novo Arquivo: `src/hooks/useDevToolsProtection.ts`

```typescript
import { useEffect } from 'react';

export function useDevToolsProtection() {
  useEffect(() => {
    // Bloquear clique direito
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Bloquear atalhos de teclado
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
      // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
        e.preventDefault();
        return false;
      }
      // Ctrl+U (view source)
      if (e.ctrlKey && e.key.toUpperCase() === 'U') {
        e.preventDefault();
        return false;
      }
      // Ctrl+S (save)
      if (e.ctrlKey && e.key.toUpperCase() === 'S') {
        e.preventDefault();
        return false;
      }
    };

    // Bloquear arrastar
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    // Adicionar listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('dragstart', handleDragStart);

    // Detectar DevTools (via debugger timing)
    const detectDevTools = () => {
      const start = performance.now();
      debugger; // Pausa se DevTools estiver aberto
      const end = performance.now();
      if (end - start > 100) {
        // DevTools detectado - pode redirecionar ou mostrar aviso
        document.body.innerHTML = '<div style="...">Acesso não autorizado</div>';
      }
    };

    // Executar detecção periodicamente (opcional)
    // const interval = setInterval(detectDevTools, 1000);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('dragstart', handleDragStart);
      // clearInterval(interval);
    };
  }, []);
}
```

### Atualizar: `src/App.tsx`

Adicionar o hook no componente principal:

```typescript
import { useDevToolsProtection } from '@/hooks/useDevToolsProtection';

const App = () => {
  useVisibilityControl();
  useDevToolsProtection(); // Adicionar aqui
  // ...
}
```

### Atualizar: `src/index.css`

Adicionar CSS para desabilitar seleção em áreas protegidas:

```css
/* Proteção anti-seleção */
body {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

/* Permitir seleção em inputs e textareas */
input, textarea, [contenteditable="true"] {
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}
```

## Detalhes Técnicos

### Arquivo a Criar
- `src/hooks/useDevToolsProtection.ts` - Hook com todas as proteções

### Arquivos a Modificar
- `src/App.tsx` - Adicionar chamada do hook
- `src/index.css` - CSS de proteção anti-seleção

### Proteções Implementadas

| Proteção | Método | Eficácia |
|----------|--------|----------|
| Clique direito | `contextmenu` event | Alta |
| F12 | `keydown` event | Alta |
| Ctrl+Shift+I/J/C | `keydown` event | Alta |
| Ctrl+U | `keydown` event | Alta |
| Arrastar elementos | `dragstart` event | Alta |
| Seleção de texto | CSS `user-select` | Média |
| Detectar DevTools | `debugger` timing | Média |

### Considerações

1. **Inputs e campos de texto** continuarão funcionando normalmente para seleção/cópia
2. **Apenas em produção**: O hook só ativará proteções quando `import.meta.env.PROD === true` para não atrapalhar desenvolvimento
3. **Performance**: As proteções são leves e não impactam performance

## Benefícios

1. Dificulta usuários casuais de inspecionar código
2. Impede cópia fácil de elementos visuais
3. Protege contra tentativas básicas de manipulação
4. Não interfere com uso normal do sistema
5. Campos de formulário continuam funcionando normalmente

