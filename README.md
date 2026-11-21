# Cubo Mágico · Rubik's Cube

| Página | Endereço |
|---|---|
| Método básico | https://smmezp.github.io/rubiks-cube/ |
| CFOP (avançado) | https://smmezp.github.io/rubiks-cube/cfop/ |
| Timer | https://smmezp.github.io/rubiks-cube/timer/ |

Site para aprender a resolver o cubo mágico, com dois modos selecionáveis no topo:

- **Básico (Método de Camadas)** — 7 passos para iniciantes, tema laranja `#ff4d00`.
- **Avançado (CFOP / Método Fridrich)** — Cruz, F2L (41), OLL (57) e PLL (21), tema azul-marinho.

Cada caso tem um diagrama gerado pelo próprio site e um cubo 3D animado que executa o algoritmo movimento a movimento.

## Rodar localmente

Precisa só do Node.js (sem dependências):

```bash
npm start
# ou
node server.js
```

Abra <http://localhost:5173>.

## Publicar no GitHub Pages

Antes de cada `git push`, rode **`npm run build`**. Ele:
- atualiza a versão dos arquivos CSS/JS (ninguém fica com arquivos velhos em cache);
- gera `cfop/index.html` a partir do `index.html` (é o endereço `/cfop/`). **Edite sempre o `index.html`.**

O site é 100% estático (HTML + CSS + JS). Basta enviar a pasta para um repositório e ativar
**Settings → Pages → Deploy from a branch → `main` / root**. O `server.js` só é usado localmente.

## Estrutura

```
index.html        guia (modo básico e avançado) → /
cfop/index.html   GERADO pelo build (mesma página, abre no CFOP) → /cfop/
timer/index.html  timer de speedcubing → /timer/
timer.html        redireciona o endereço antigo para /timer/
build.js          prepara para publicar (npm run build)
css/style.css     estilos e temas
css/library.css   biblioteca: algoritmos aprendidos
css/timer.css     página do timer
js/cube.js        motor do cubo (estado, movimentos, desenhos SVG)
js/cube3d.js      cubo 3D em CSS com animação das camadas
js/data.js        algoritmos F2L / OLL / PLL
js/app.js         interface, passos do método básico e player
js/i18n.js        textos em inglês e português
js/timer.js       lógica do timer
```

## Créditos

Algoritmos baseados nos guias *Método de Camadas* (cinoto.com.br/camadas) e
*Método Fridrich (CFOP) — F2L, OLL e PLL* de Suzane Coelho (youtube.com/suzanecoelho).

## Idioma

O site abre em **inglês** por padrão; o seletor com bandeiras no canto do topo troca para **português**
(a escolha fica salva no navegador). Os textos ficam em `js/i18n.js`.

---

© 2026 Medeiros. All rights reserved. Bandeiras: Twemoji (CC-BY 4.0).
