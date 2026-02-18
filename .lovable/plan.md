
# Correção: Glitch Visual no Dashboard (Xiaomi/Android)

## Diagnóstico

O usuário lenonaristoffer@gmail.com reportou uma tela com padrão de "estática" ao abrir o app em um Xiaomi. O glitch cobre a maior parte da tela do dashboard, deixando apenas alguns elementos visíveis nos cantos.

**Causa raiz: SVG `feTurbulence` filter no `src/index.css`**

```css
.noise-overlay {
  background-image: url("data:image/svg+xml,...feTurbulence type='fractalNoise'...");
  opacity: 0.02;
}
```

O filtro `feTurbulence` do SVG (fractal noise) é conhecido por causar artefatos graves de renderização GPU em dispositivos Android, especialmente:
- Xiaomi com MIUI
- Chrome/WebView em versões mais antigas
- GPUs mobile ARM com drivers desatualizados

O resultado visual é exatamente o padrão de "estática de televisão" visível na imagem enviada.

**Causa secundária: `backdrop-filter: blur()`**

O `backdrop-blur` é usado em vários pontos da aplicação. Em alguns dispositivos Android, quando combinado com elementos fixos e compositing de camadas, pode causar artefatos visuais adicionais.

## Solução

### 1. Remover o SVG `feTurbulence` da classe `.noise-overlay`

A classe `.noise-overlay` define um `background-image` com SVG inline contendo `feTurbulence`. Como essa classe não está sendo usada em nenhum componente TSX (confirmado pela busca no código), ela pode ser removida completamente do CSS sem impacto visual em nenhuma tela.

**Arquivo:** `src/index.css`

Remover o bloco:
```css
.noise-overlay {
  background-image: url("data:image/svg+xml,...feTurbulence...");
  opacity: 0.02;
}
```

### 2. Adicionar `will-change: auto` e desabilitar `backdrop-filter` em mobile via media query

Para evitar problemas de composição GPU em dispositivos móveis fracos, adicionar uma media query que desabilita `backdrop-filter` em telas menores:

```css
@media (max-width: 768px) {
  .glass {
    background: hsl(var(--card) / 0.95);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  
  .glass-premium {
    background: hsl(var(--card) / 0.98);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
```

Isso substitui o efeito visual de vidro fosco por uma cor opaca sólida em mobile, eliminando a necessidade de composição de camadas pelo GPU.

### 3. Remover `gradient-mesh` e `gradient-hero` se não utilizados

Essas classes usam múltiplos `radial-gradient` aninhados que podem sobrecarregar o motor de renderização. Como não são usadas em nenhum componente TSX, também serão removidas.

## Impacto

- O usuário do Xiaomi terá o app funcionando normalmente sem o glitch de "estática"
- Nenhum elemento visual mudará para usuários em outros dispositivos (desktop, iOS) pois a classe `.noise-overlay` não está sendo usada em nenhum componente
- A remoção do `backdrop-blur` no mobile melhora a performance geral em dispositivos móveis mais fracos

## Arquivo modificado

| Arquivo | Mudança |
|---|---|
| `src/index.css` | Remover `.noise-overlay` com SVG `feTurbulence`; Adicionar media query para desabilitar `backdrop-filter` em mobile; Remover `.gradient-mesh` e `.gradient-hero` não utilizados |
