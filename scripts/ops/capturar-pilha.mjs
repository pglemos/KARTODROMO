// Captura a pilha de um servidor travado (event loop preso) pelo inspetor do Node, que roda em outra thread.
// Uso: node scripts/ops/capturar-pilha.mjs [porta]  -> imprime as primeiras chamadas em execucao. O watchdog chama antes de reiniciar.
const porta = process.argv[2] || '9229';
const limite = setTimeout(() => { console.log('timeout: inspetor nao respondeu em 15 s'); process.exit(2); }, 15_000);
try {
  const alvos = await (await fetch(`http://127.0.0.1:${porta}/json/list`, { signal: AbortSignal.timeout(5000) })).json();
  const ws = new WebSocket(alvos[0].webSocketDebuggerUrl);
  let id = 0;
  const enviar = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }));
  ws.onopen = () => { enviar('Debugger.enable'); enviar('Debugger.pause'); };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method !== 'Debugger.paused') return;
    console.log(`pilha capturada em ${new Date().toISOString()} (motivo: ${m.params.reason})`);
    for (const f of m.params.callFrames.slice(0, 25)) console.log(`  ${f.functionName || '(anon)'}  ${f.url.split('/').slice(-3).join('/')}:${f.location.lineNumber + 1}:${f.location.columnNumber}`);
    clearTimeout(limite); process.exit(0);
  };
  ws.onerror = (e) => { console.log('erro no inspetor: ' + (e.message ?? e)); process.exit(3); };
} catch (e) { console.log('falha ao conectar no inspetor: ' + e.message); process.exit(4); }
