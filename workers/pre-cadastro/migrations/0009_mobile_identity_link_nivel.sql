-- Vínculo app ↔ cadastro do kartódromo em dois níveis:
--   'cpf'      : só o CPF bateu. Libera histórico, carreira e ranking (dados de corrida).
--   'completo' : CPF + e-mail ou telefone do cadastro. Libera também o perfil pessoal (telefone, endereço, nascimento).
-- Todo vínculo existente foi feito pela regra antiga (CPF + e-mail/telefone): fica 'completo'.
ALTER TABLE mobile_identity_links ADD COLUMN nivel TEXT NOT NULL DEFAULT 'completo';
