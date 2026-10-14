# Verificação do redesenho — 14/10/2026

## Entrega implementada

Direção “Interface nativa essencial” aplicada no React Native/Expo real. Todas as superfícies usam a identidade original e o tema compartilhado: início, agenda, reservas, confirmação de participantes/cupom, Pix/cartão, resultados/histórico, GPS/treinos, login, cadastro, recuperação, redefinição e verificação de e-mail. Ícone e splash derivados da marca.

## Evidência automatizada

- **46 testes, 7 suítes, zero falhas.** Regressões observadas falhando antes da correção: identidade da home, continuidade agenda/login/reserva e primeiro início do GPS com geometria de teste válida.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0, sem avisos.
- `npm run export`: bundles iOS e Android exportados.
- Contraste AA verificado nos pares semânticos dos dois temas; bytes da logo e fotografia comparados com os originais.
- Isolamento de sessão, reservas, Pix e histórico entre contas preservado pela suíte existente.
- `git diff --check`: conferido antes do commit.

## Evidência nativa

APK debug compilado por CNG/Gradle, instalado e executado no AVD Kartodromo_QA_API36, `emulator-5580`. Nenhum arquivo nativo gerado editado manualmente. Navegação operada por adb, com coordenadas obtidas da árvore de UI.

A API de QA é efêmera, restrita a 127.0.0.1, e contém exclusivamente dados “TESTE CODEX”. Os valores em screenshots de agenda, cupom, resultados e pagamento são fixtures, não oferta, disponibilidade ou cobrança reais. Nenhuma reserva, conta ou pagamento gravado na produção. O QR não foi inventado; a fixture Pix não tem imagem e seu payload diz SEM VALOR PARA PAGAMENTO.

| Área | Evidência em screenshots/ | Resultado |
| --- | --- | --- |
| Home e destinos | 01, 16, 17, 19, 20, 26, 40 | Marca, foto e ações; claro/escuro; acesso por rolagem em tela pequena |
| Agenda | 02, 31, 34, 35, 39 | Disponível/esgotado, vazio, erro, atualização por gesto e nova tentativa |
| Login e continuidade | 06, 07, 08 | Teclado, credenciais fictícias e retorno ao horário 101 escolhido |
| Reserva/cupom | 08, 09, 42 | Participantes, nascimento com formatação de oito dígitos, cupom e total calculado pela API local |
| Pix, cartão e status | 10–14 | Cópia do Pix, ação de cartão, atendimento e confirmação |
| Reservas | 05, 15, 18, 32, 37 | Visitante, lista, vazio e saída da conta |
| Resultados/histórico | 04, 21, 33, 36 | 30 posições, rolagem até o histórico, vazio e vínculo pendente |
| GPS | 03, 22 | Sem medição aprovada; controles bloqueados e histórico local vazio |
| Cadastro | 24, 25 | Formulário, política e ações alcançáveis com fonte ampliada |
| Conta | 23, 27–30 | Login pequeno, recuperação, link inválido e e-mail verificado por fixture |
| Voltar | 38, 41 | Back nativo por tecla e gesto de borda |

Primeira rodada em 411 dp; rodada final em **393×852 dp** e **320×720 dp**, com fonte **1,0 e 1,3**, temas claro e escuro. Foram encontrados e corrigidos: altura intrínseca da foto, callbacks de estilo perdidos no Link, nomes das abas truncados, inset superior duplicado nas telas com header e mensagem de vazio simultânea à falha de atualização e data que exigia barras ausentes do teclado numérico. A regressão da data foi observada falhando antes da formatação automática. Capturas 26, 39 e 40 são conferências após correção. A engrenagem “Tools” pertence ao build de desenvolvimento Expo; não é componente do produto.

Buffer de crash Android consultado: vazio.

## Builds e distribuição

Candidatos v5 e v7 cancelados para incluir as últimas correções. O pacote v6 falhou na preparação do arquivo, antes de produzir binário; o filtro foi corrigido e a cópia real do empacotador EAS passou por asserts de inclusão de fontes/config/assets e exclusão de node_modules, Android/iOS gerados, dist e outros produtos do repositório. Candidatos finais v8 concluídos na Expo, com pacote de 2,4 MB em vez dos 372 MB do repositório inteiro. Links e hashes em `android-v8.json`. APK assinado verificado, `zipalign -c -P 16 4` exit 0, pacote br.com.kartodromobetim.app, versão 1.0.0 (8), target SDK36. Certificado igual ao APK v4; AAB validado por JarFile/jarsigner. Capturas 47–49 da versão EAS instalada no emulador, com marca original, temas claro/escuro e GPS corretamente bloqueado. Os servidores locais de QA e Metro foram encerrados.

## Limites da comprovação

- O emulador comprova renderização e interação Android. Não comprova comportamento de aparelho físico, TalkBack/VoiceOver, taxa de quadros, duração de bateria ou GPS em pista.
- Exportação iOS não comprova execução no iPhone. Xcode instalado 26.2, incompatível com a exigência atual do SDK; Apple Developer ainda tem a pendência de pagamento descrita no status de distribuição.
- Envio de e-mail real, cobrança, QR bancário, liquidação, reserva em operação e resultados vindos da rede do kartódromo continuam sujeitos às integrações pendentes. A homologação continua fechada para reservas reais.
- Nenhuma publicação pública nas lojas foi realizada pelo redesenho.

## Conferência do release local

`assembleRelease` com `NODE_ENV=production` e API da homologação: exit 0. APK local instalado no emulador, sem menu/engrenagem de desenvolvimento, capturas 43–46. A homologação respondeu na agenda: “A reserva online ainda não está aberta.” A tela exibiu essa condição corretamente. Este APK usa a chave de debug local e serve somente como prova técnica; o instalador final da avaliação usa a assinatura remota da Expo.

## Revisão de código

CodeRabbit CLI 0.7.6, autenticado, revisão de alterações preparada incluindo os novos arquivos: **29 arquivos revisados, 0 problemas reportados**. Resultado estruturado em `code-review.json`. Revisão adicional do diff e rastreabilidade para a matriz acima, pelo fluxo local de QA do AIOX. A revisão automatizada não substitui os limites físicos e operacionais indicados.

## CI do PR

As primeiras execuções dos workflows Mobile app e Cloudflare Worker falharam na instalação/conferência do lockfile da raiz: peer `esbuild@0.28.2` do Vitest ausente. Regeneração em diretório sem node_modules, usando Node 22.23.3 / npm 10.9.9, conforme a CI. Manifesto e versões já existentes comparados e preservados. Execuções da CI disponíveis no PR #15.

Lockfile corrigido: `npm ci --ignore-scripts` com Node 22.23.3/npm 10.9.9 em diretório limpo instalou 846 pacotes (exit 0). CodeRabbit exclui lockfiles e retornou exatamente `No files to review` nessa revisão adicional; a alteração não foi apresentada como revisão de código automatizada aprovada.

AAB: `bundletool 1.18.3 validate` exit 0. APK e AAB: 48 bibliotecas de 64 bits por arquivo, todos os segmentos PT_LOAD com alinhamento de pelo menos 16 KB. Configuração original do emulador restaurada ao terminar, mantendo o APK EAS v8 instalado.

A CI Mobile app passou no commit `bd0700d`: testes raiz/API, tipos raiz, 46 testes móveis, tipos/lint móveis, Expo Doctor e exportação dos dois sistemas. O check separado do site passou pela instalação e pelos tipos, mas encontrou `_ordem` não usado na remoção do campo interno de histórico de karts. Correção limitada ao descarte explícito do campo, preservando o resultado; testes específicos executados antes e depois.

Correção de lint: lint raiz completo exit 0; 18 testes de ranking/equalização passaram. O descarte explícito de `_ordem` mantém o histórico sem esse campo interno.
