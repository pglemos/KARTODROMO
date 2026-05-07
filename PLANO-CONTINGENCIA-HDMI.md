# Plano de Contingência HDMI

Usar quando a TB50 não renderizar a WebPage com estabilidade.

## Mini PC

- Configurar saída de vídeo para `2048 x 512`, se suportado.
- Conectar HDMI na entrada da TB50.
- Configurar TB50 para entrada HDMI.
- Rodar aplicação localmente ou acessar URL pública.

## Chrome kiosk

Windows:

```bat
start chrome --kiosk --disable-infobars --autoplay-policy=no-user-gesture-required "https://seudominio.com.br/placar-telao?uid=58856059-c4fd-4626-aea7-42aefc048eec"
```

macOS:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --kiosk "https://seudominio.com.br/placar-telao?uid=58856059-c4fd-4626-aea7-42aefc048eec"
```

## Operação

- Desativar sleep/hibernação.
- Deixar energia conectada.
- Testar reconexão de internet.
- Manter URL original LiveTime como plano emergencial.
