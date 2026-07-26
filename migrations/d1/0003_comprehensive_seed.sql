PRAGMA foreign_keys = ON;

-- 1. CLIENTES SEED DATA
INSERT OR IGNORE INTO clientes (id, nome, email, telefone, cpf, notes) VALUES
('cli-001', 'Fernando Silva Costa', 'fernando.costa@email.com', '(31) 99172-8510', '090.418.286-05', 'Piloto frequente de bateria de aluguel'),
('cli-002', 'Arthur Neves Gomes', 'arthur.gomes@email.com', '(31) 99296-8110', '124.582.903-12', 'Inscrito na Copa Betim 2026'),
('cli-003', 'Rodrigo Oliveira Santos', 'rodrigo.santos@email.com', '(31) 98765-4321', '085.123.987-44', 'Cliente VIP do Kartódromo'),
('cli-004', 'Camila Rodrigues Lima', 'camila.lima@email.com', '(31) 99888-7766', '112.334.556-77', 'Membro da equipe Speed Kart'),
('cli-005', 'Lucas Gabriel Pereira', 'lucas.pereira@email.com', '(31) 99777-6655', '098.765.432-11', 'Reserva frequente nos finais de semana'),
('cli-006', 'Mariana Souza Alves', 'mariana.alves@email.com', '(31) 99666-5544', '045.678.912-33', 'Participante de bateria corporativa'),
('cli-007', 'Gustavo Henrique Martins', 'gustavo.martins@email.com', '(31) 99555-4433', '109.876.543-21', 'Piloto categoria Pró'),
('cli-008', 'Beatriz Ferreira Ramos', 'beatriz.ramos@email.com', '(31) 99444-3322', '076.543.210-98', 'Cliente cadastrado na lanchonete'),
('cli-009', 'Thiago Augusto Barbosa', 'thiago.barbosa@email.com', '(31) 99333-2211', '054.321.098-76', 'Organizador de evento corporativo'),
('cli-010', 'Vanessa Cristina Ribeiro', 'vanessa.ribeiro@email.com', '(31) 99222-1100', '032.109.876-54', 'Cliente cadastrada no recepção');

-- 2. PISTAS SEED DATA
INSERT OR IGNORE INTO pistas (id, nome, descricao, ativa) VALUES
('pista-principal', 'Pista Principal (Traçado A)', 'Circuito oficial homologado 1.200m com 14 curvas', 1),
('pista-junior', 'Pista Infantil / Treino', 'Circuito reduzido de 650m para iniciantes e infanto-juvenil', 1),
('pista-vip', 'Pista Super Kart (Traçado B)', 'Traçado rápido de 1.450m para karts de competição 2t', 1);

-- 3. RESERVAS SEED DATA
INSERT OR IGNORE INTO reservas (id, cliente_id, pista_id, data_inicio, data_fim, qtd_pilotos, valor, status, notes) VALUES
('res-101', 'cli-001', 'pista-principal', datetime('now', '-2 hours'), datetime('now', '-1 hours'), 12, 1440.00, 'concluida', 'Bateria das 10h finalizada com sucesso'),
('res-102', 'cli-002', 'pista-principal', datetime('now', '+1 hours'), datetime('now', '+2 hours'), 15, 1800.00, 'confirmada', 'Bateria corporativa confirmada'),
('res-103', 'cli-003', 'pista-vip', datetime('now', '+4 hours'), datetime('now', '+5 hours'), 10, 1500.00, 'confirmada', 'Treino livre Super Kart'),
('res-104', 'cli-004', 'pista-principal', datetime('now', '+1 day'), datetime('now', '+1 day', '+1 hours'), 8, 960.00, 'pendente', 'Aguardando confirmação de sinal'),
('res-105', 'cli-005', 'pista-junior', datetime('now', '+2 days'), datetime('now', '+2 days', '+1 hours'), 6, 600.00, 'confirmada', 'Bateria infantil de aniversário');

-- 4. RECEPÇÃO CHECK-INS SEED DATA
INSERT OR IGNORE INTO recepcao_atendimentos (id, cliente_id, nome, tipo, reserva_id, status, notes) VALUES
('atd-201', 'cli-001', 'Fernando Silva Costa', 'Bateria de Aluguel', 'res-101', 'finalizado', 'Termo de responsabilidade assinado. Capacete #12 entregue.'),
('atd-202', 'cli-002', 'Arthur Neves Gomes', 'Bateria Corporativa', 'res-102', 'em_atendimento', 'Aguardando Briefing de segurança na sala 1.'),
('atd-203', 'cli-003', 'Rodrigo Oliveira Santos', 'Super Kart 2T', 'res-103', 'aguardando', 'Chegou ao balcão. Efetuando pagamento.'),
('atd-204', 'cli-004', 'Camila Rodrigues Lima', 'Bateria Amadora', 'res-104', 'aguardando', 'Aguardando chamada de grupo.');

-- 5. LANCHONETE PRODUTOS & ESTOQUE SEED DATA
INSERT OR IGNORE INTO lanchonete_produtos (id, nome, sku, categoria, preco, ativo) VALUES
('prod-001', 'Água Mineral 500ml', 'BEB-AGUA-500', 'Bebidas', 5.00, 1),
('prod-002', 'Refrigerante Lata 350ml', 'BEB-REFRI-350', 'Bebidas', 7.50, 1),
('prod-003', 'Energetico Red Bull 250ml', 'BEB-ENERG-250', 'Bebidas', 14.00, 1),
('prod-004', 'Cerveja Long Neck 330ml', 'BEB-CERV-330', 'Bebidas Alcoólicas', 10.00, 1),
('prod-005', 'Hamburguer Artesanal Kart', 'LAN-BURGER-01', 'Lanches', 28.00, 1),
('prod-006', 'Misto Quente Especial', 'LAN-MISTO-01', 'Lanches', 14.00, 1),
('prod-007', 'Porção de Batata Frita 400g', 'POR-BATATA-400', 'Porções', 25.00, 1),
('prod-008', 'Porção de Pastelzinho (12 un)', 'POR-PASTEL-12', 'Porções', 32.00, 1),
('prod-009', 'Açaí na Tigela 400ml', 'SOB-ACAI-400', 'Sobremesas', 18.00, 1);

INSERT OR IGNORE INTO lanchonete_estoque (id, produto_id, quantidade, min_alerta) VALUES
('est-001', 'prod-001', 120, 20),
('est-002', 'prod-002', 85, 15),
('est-003', 'prod-003', 40, 10),
('est-004', 'prod-004', 60, 15),
('est-005', 'prod-005', 25, 5),
('est-006', 'prod-006', 30, 5),
('est-007', 'prod-007', 18, 5),
('est-008', 'prod-008', 12, 3),
('est-009', 'prod-009', 22, 5);

-- 6. FINANCEIRO CATEGORIAS & LANÇAMENTOS SEED DATA
INSERT OR IGNORE INTO financeiro_categorias (id, nome, tipo) VALUES
('cat-rec-01', 'Baterias de Kart', 'receita'),
('cat-rec-02', 'Lanchonete e Bar', 'receita'),
('cat-rec-03', 'Inscrições em Campeonatos', 'receita'),
('cat-des-01', 'Manutenção de Karts e Peças', 'despesa'),
('cat-des-02', 'Combustível e Lubrificantes', 'despesa'),
('cat-des-03', 'Folha de Pagamento', 'despesa');

INSERT OR IGNORE INTO financeiro_lancamentos (id, descricao, valor, tipo, categoria_id, data, origem, origem_ref, status) VALUES
('lan-301', 'Receita Baterias do Dia', 4500.00, 'receita', 'cat-rec-01', date('now'), 'Pista Principal', 'RES-TOTAL', 'confirmado'),
('lan-302', 'Vendas Lanchonete Balcão', 1280.00, 'receita', 'cat-rec-02', date('now'), 'Lanchonete PDV', 'LANCH-TOTAL', 'confirmado'),
('lan-303', 'Compra de Gasolina Aditivada (200L)', 1160.00, 'despesa', 'cat-des-02', date('now', '-1 day'), 'Posto Shell', 'NF-9842', 'confirmado'),
('lan-304', 'Substituição Pneus D2 Kart 12/15/18', 840.00, 'despesa', 'cat-des-01', date('now', '-2 days'), 'Fornecedor MG Tires', 'NF-1120', 'confirmado'),
('lan-305', 'Inscrições Etapa 2 Copa Kart', 2400.00, 'receita', 'cat-rec-03', date('now', '-3 days'), 'Campeonatos', 'CAMP-02', 'confirmado');

-- 7. CAMPEONATOS, ETAPAS, PILOTOS, CLASSIFICAÇÃO, CORRIDAS & RESULTADOS
INSERT OR IGNORE INTO campeonatos (id, nome, slug, temporada, status) VALUES
('camp-001', 'Copa Kart Betim 2026', 'copa-betim-2026', '2026', 'ativo'),
('camp-002', 'Campeonato Mineiro de Kart 2026', 'mineiro-kart-2026', '2026', 'ativo'),
('camp-003', 'Endurance 6 Horas de Betim', 'endurance-6h-2026', '2026', 'rascunho');

INSERT OR IGNORE INTO etapas (id, campeonato_id, nome, data, round, status) VALUES
('etapa-101', 'camp-001', 'Etapa 1 - Abertura da Temporada', date('now', '-14 days'), 1, 'realizada'),
('etapa-102', 'camp-001', 'Etapa 2 - Grande Prêmio Betim', date('now', '+7 days'), 2, 'agendada'),
('etapa-103', 'camp-001', 'Etapa 3 - Night Race Super Kart', date('now', '+28 days'), 3, 'agendada');

INSERT OR IGNORE INTO pilotos (id, nome, numero, equipe, cliente_id) VALUES
('pil-001', 'Fernando Silva Costa', '77', 'Apex Racing', 'cli-001'),
('pil-002', 'Arthur Neves Gomes', '10', 'Speed Betim Team', 'cli-002'),
('pil-003', 'Rodrigo Oliveira Santos', '33', 'Red Kart Club', 'cli-003'),
('pil-004', 'Camila Rodrigues Lima', '05', 'Girl Power Racing', 'cli-004'),
('pil-005', 'Lucas Gabriel Pereira', '88', 'Fast & Furious', 'cli-005');

INSERT OR IGNORE INTO classificacao (id, campeonato_id, piloto_id, pontos, posicao) VALUES
('cla-001', 'camp-001', 'pil-001', 25.0, 1),
('cla-002', 'camp-001', 'pil-002', 20.0, 2),
('cla-003', 'camp-001', 'pil-003', 16.0, 3),
('cla-004', 'camp-001', 'pil-004', 13.0, 4),
('cla-005', 'camp-001', 'pil-005', 11.0, 5);

INSERT OR IGNORE INTO sessoes (id, campeonato_id, etapa_id, nome, tipo, data, status, fonte) VALUES
('sess-501', 'camp-001', 'etapa-101', 'Bateria Final - Etapa 1', 'corrida', date('now', '-14 days'), 'encerrada', 'LapTime SQL');

INSERT OR IGNORE INTO voltas (id, sessao_id, piloto_id, piloto_nome, kart, numero, tempo_ms, setor1_ms, setor2_ms, setor3_ms, posicao, melhor, valida) VALUES
('vlt-001', 'sess-501', 'pil-001', 'Fernando Silva Costa', 'Kart #12', 12, 54320, 18100, 18200, 18020, 1, 1, 1),
('vlt-002', 'sess-501', 'pil-002', 'Arthur Neves Gomes', 'Kart #08', 12, 54580, 18210, 18290, 18080, 2, 0, 1),
('vlt-003', 'sess-501', 'pil-003', 'Rodrigo Oliveira Santos', 'Kart #04', 12, 54890, 18300, 18390, 18200, 3, 0, 1);

INSERT OR IGNORE INTO corridas (id, etapa_id, campeonato_id, titulo, data, status, source) VALUES
('cor-601', 'etapa-101', 'camp-001', 'Corrida Oficial Etapa 1', date('now', '-14 days'), 'publicada', 'LapTime SQL');

INSERT OR IGNORE INTO resultados (id, corrida_id, piloto_id, piloto_nome, posicao, melhor_volta, voltas, pontos, gap) VALUES
('res-701', 'cor-601', 'pil-001', 'Fernando Silva Costa', 1, '54.320s', 18, 25.0, 'Leader'),
('res-702', 'cor-601', 'pil-002', 'Arthur Neves Gomes', 2, '54.580s', 18, 20.0, '+2.410s'),
('res-703', 'cor-601', 'pil-003', 'Rodrigo Oliveira Santos', 3, '54.890s', 18, 16.0, '+5.890s');
