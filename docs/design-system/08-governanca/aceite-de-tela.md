# Aceite de tela

Uma tela nova ou migrada só é dada como pronta depois deste roteiro.

## 1. Fotos fora da tela (não atrapalha o operador)
Apontar o `appsettings` para o **simulador** (`:4153`), nunca para a pista em uso.

```powershell
foreach ($t in '1920x1080','1536x864','1440x900','1366x768','1280x720') {
  $env:KARTODROMO_TESTE = 'telas'; $env:KARTODROMO_AUTOTESTE_TAMANHO = $t
  & .\Kartodromo.Cronometragem.exe --autoteste "C:\temp\aceite\$t"
}
```
Recepção: `Kartodromo.Recepcao.exe --teste-telas`. Totem: fotos `1-identificacao`… em 1366×768 e 1920×1080.
Web: Playwright em 360, 390, 768, 1024, 1280, 1440, 1920.

## 2. Conferir cada foto
- [ ] Nenhum texto, botão, ícone ou campo cortado.
- [ ] Nada sobreposto; rodapé com a ação principal visível.
- [ ] Alinhamento à grade; espaços iguais entre elementos iguais.
- [ ] Igual ao desenho aprovado (`*.dc.html`) — diferenças anotadas e aprovadas.
- [ ] Modo degradado (1366×768 a 125% ≈ 1093×614): rola, nada cortado.

## 3. Teclado
- [ ] Tab percorre na ordem visual; Enter/Esc; atalhos.
- [ ] Foco sempre visível.

## 4. Estados
- [ ] Vazio, carregando, erro (desligar o simulador), sem permissão.

## 5. Automático
- [ ] `npm run tokens:check`, `npm run lint:design` (contagem menor ou igual), testes.
- [ ] `erros.log` sem erro novo depois do roteiro.

## 6. Registro
Fotos "antes/depois" anexadas ao PR; versão e changelog.
