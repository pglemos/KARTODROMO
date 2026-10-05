# Redesign do site público — 05/10/2026

Objetivo: reconstruir as 24 rotas públicas do Kartódromo Internacional de Betim para desktop e celular, tornando reserva, orçamento e inscrição fáceis de encontrar. Conteúdo em pt-BR, preços e regras das fontes oficiais.

Direção: editorial de automobilismo, asfalto #0b0d0b, superfícies #141714, texto #f4f5ef, acento #b7ee38. Barlow Condensed 800 italic para títulos e Inter 400/500/600/700 para leitura. Divisórias finas, cantos de 4px, fotos reais do circuito. A logo original permanece intacta. Esta nova direção substitui os tokens do site institucional anterior, mantendo independentes admin, cronometragem e telão.

Referências visuais: quatro conceitos em /workspace/generated_images: exec-b87ebed0 (primeiro viewport), exec-7c7e8725 (experiências/pista/rodapé), exec-c5a37479 (campeonatos), exec-44dcf5d6 (clube). A identidade original e fotos reais têm prioridade sobre logotipos e cenas ilustrativas gerados nos conceitos. Cada página segue o mesmo sistema, com composição específica para sua função.

Componentes: cabeçalho sticky, menu mobile com foco controlado, botões e links com ícones Lucide 20px, hero fotográfico, faixas de dados, experiências, calendário filtrável, traçados filtráveis com lightbox, FAQ com busca e categorias, formulário de evento, inscrição de campeonato com pilotos por kart e confirmação, shell lateral do clube e regulamento. Movimento discreto; redução de movimento respeitada.

Infraestrutura: React/Vite isolado em website; Worker com assets e binding LEGACY ao Worker kartodromo. Rotas públicas conhecidas recebem HTML específico para SEO. APIs, admin, telão e demais rotas seguem no serviço existente. Não copiar segredos nem bases de dados. Não simular pontos, classificação ou sucesso de inscrição. Reserva individual usa a plataforma própria existente. Clube conserva status de implantação até integração real.

Validação: build; testes de regras de inscrição/data e delegação do Worker; navegador Chromium via Playwright (nenhum Browser/IAB disponível); 24 rotas em desktop/mobile, overflow, carregamento de imagens, navegação, filtros, FAQ, teclado, formulários e resposta real de validação da API. Testes de gravação apenas simulados localmente para não produzir inscrições reais. Inspeção direta entre screenshots e conceitos, com desvios registrados.

Entrega: publicação verificada em workers.dev, ativação das rotas públicas na Cloudflare depois da validação, reversão para o Worker original disponível. Código em branch dedicada no GitHub.

## Segunda revisão — 05/10/2026

A revisão aprofunda o sistema editorial existente. Mantém logo, fotos, cores, famílias tipográficas, preços oficiais, regulamentos e a separação da operação. A primeira dobra tem fotografia mais presente, título em até 96px, localização e ação clara. A faixa de reserva substitui as métricas genéricas da home. A composição muda entre seletor de experiências, circuito, prova em destaque, agenda, clube, dúvidas e visita.

A página `/reservas` passa a ser uma superfície própria de planejamento: bateria aberta/exclusiva, quantidade de pilotos e estimativa explícita a R$145 por piloto. Valores, vagas e pagamento continuam confirmados pela agenda oficial. No celular, o planejador vem antes da fotografia; o botão de reserva do cabeçalho leva diretamente a essa seção e move o foco para ela.

Interações novas: seletor de experiências com setas/Home/End e semântica de tabs; galerias com ampliação, anterior/próxima, Escape e retorno de foco; navegação entre mapas ampliados; data de prova em arquivo ICS de dia inteiro, sem inventar um horário; guia de visita com Google Maps, horários e contato. A animação de entrada do hero é o movimento principal e respeita movimento reduzido.

As páginas do clube recebem títulos e guias específicos para cada função. Nenhum saldo, corrida, perfil, recompensa ou campanha ativa é inventado. As informações publicadas vêm do regulamento previsto e conservam o estado de implantação.

O CSS da revisão está em `src/refinement.css`, carregado após a base. A versão inicial continua registrada no histórico da branch para comparação e reversão.
