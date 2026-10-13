# Tablet do sorteio de karts (Android, Kotlin/Compose)

Código: `android/sorteio/`. Build do APK em `C:\AndroidDev`. Rotas do servidor: `/sorteio`.

## Tokens
Gerados: `.../sorteio/design/Tokens.kt` (objetos `Tokens.Claro`/`Tokens.Escuro`) e `res/values/cores_tokens.xml`
(`kib_claro_*`, `kib_escuro_*`). **Ainda não usados**: o app segue com `Tema.kt` (`#087F5B`) e `themes.xml`, que divergem
entre si.

## Fase 7 (exige aprovação do dono)
O tablet é público → tema **escuro** (neon `#00E676`). Trocar `Tema.kt` para ler `Tokens.Escuro` e alinhar
`themes.xml` com `@color/kib_escuro_*`. Até lá, nada muda.

## Regras
Alvos ≥ 48 dp (`componente.tablet.alvo-toque`); textos ≥ 14 sp; funciona em retrato e paisagem; sem teclado na tela
quando não há campo de texto; botões de ação grandes no rodapé.
