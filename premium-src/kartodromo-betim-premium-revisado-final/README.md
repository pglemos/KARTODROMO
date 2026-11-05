# Kartódromo Internacional de Betim — projeto premium revisado

Site estático completo com **10 páginas**, identidade editorial de automobilismo e navegação integrada. O projeto funciona diretamente no navegador, sem build, servidor ou instalação de dependências.

## Como abrir

1. Extraia todo o conteúdo do ZIP mantendo a estrutura de pastas.
2. Abra `index.html` no Chrome, Edge, Safari ou Firefox.
3. Não mova isoladamente os arquivos HTML, pois imagens, vídeo, PDFs, CSS e JavaScript usam caminhos relativos.

## Páginas incluídas

1. `index.html` — home, grupos e aniversários
2. `pista.html` — pista e traçados interativos
3. `kart-locacao.html` — kart de locação
4. `campeonatos.html` — visão geral dos campeonatos
5. `eventos.html` — eventos sociais e corporativos
6. `duvidas.html` — FAQ pesquisável por categorias
7. `kac.html` — KAC Iniciantes
8. `kac-super.html` — KAC Super Kart
9. `200-milhas.html` — prova de endurance 200 Milhas
10. `500-milhas.html` — prova de endurance 500 Milhas

## Recursos implementados

- Vídeo cinematográfico em tela cheia com poster de fallback.
- Navegação desktop e menu mobile acessível.
- Transições entre páginas, scroll reveal e parallax.
- Contadores e telemetria animados com conteúdo de fallback sem JavaScript.
- Mapa de pista interativo com estados acessíveis.
- FAQ com filtros e acordeões.
- Modais e formulários que montam a solicitação para o WhatsApp.
- Regulamentos em PDF integrados às páginas dos campeonatos.
- Layout responsivo, foco visível, redução de movimento e ligação de salto.
- Paleta preta, branca e verde da marca.

## Tipografia

O CSS prioriza as famílias **Brake Disc** e **Pace Racing Car Modern** quando elas já estão instaladas no computador do visitante. Os arquivos binários dessas fontes não acompanham o projeto. Na ausência delas, o site utiliza fallbacks esportivos licenciados pelo navegador e ajustes de inclinação, compactação e espaçamento para preservar a linguagem visual.

## Validação local

Com Python 3 instalado, execute na pasta do projeto:

```bash
python3 qa_check.py
```

O script usa somente a biblioteca padrão do Python e verifica as dez páginas, links internos, ativos locais, IDs, formulários, acessibilidade estrutural e assinaturas básicas dos arquivos de mídia.

Consulte `QA.md` para o relatório completo da auditoria e dos testes renderizados.
