package br.com.kartodromobetim.sorteio

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Casino
import androidx.compose.material.icons.rounded.AccessTime
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.automirrored.rounded.EventNote
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val hora = SimpleDateFormat("HH:mm", Locale("pt", "BR"))

@Composable
fun TelaBaterias(api: Api, prefs: Preferencias, onSortear: (String) -> Unit) {
    val escopo = rememberCoroutineScope()
    var baterias by remember { mutableStateOf(prefs.cacheBaterias) }
    var agenda by remember { mutableStateOf(prefs.cacheAgenda) }
    var erro by remember { mutableStateOf<String?>(null) }
    var erroAgenda by remember { mutableStateOf<String?>(null) }
    var carregando by remember { mutableStateOf(false) }
    var preparando by remember { mutableStateOf<Long?>(null) }
    var config by remember { mutableStateOf(false) }
    var recarregar by remember { mutableIntStateOf(0) }
    var aba by remember { mutableIntStateOf(0) }
    var ultimaAtualizacao by remember { mutableStateOf(prefs.ultimaSincronizacao) }

    LaunchedEffect(recarregar) {
        carregando = true
        erro = null
        try {
            baterias = api.baterias()
            prefs.cacheBaterias = baterias
            ultimaAtualizacao = System.currentTimeMillis()
            prefs.ultimaSincronizacao = ultimaAtualizacao
        } catch (e: ErroServidor) { erro = e.message }
        erroAgenda = null
        try {
            agenda = api.agendaDeHoje()
            prefs.cacheAgenda = agenda
            ultimaAtualizacao = System.currentTimeMillis()
            prefs.ultimaSincronizacao = ultimaAtualizacao
        } catch (e: ErroServidor) { erroAgenda = e.message }
        carregando = false
    }

    FundoCinematografico(FundoApp.PIT_LANE) {
      Column(Modifier.fillMaxSize().padding(horizontal = 24.dp, vertical = 18.dp)) {
        Cartao(Modifier.fillMaxWidth(), padding = 14.dp, fundo = Cor.CartaoElevado) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(
                    painterResource(R.drawable.logo_kartodromo),
                    contentDescription = "Kartódromo Internacional de Betim",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.width(172.dp).height(58.dp),
                )
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text("Sorteio de karts", fontSize = 25.sp, lineHeight = 30.sp, fontWeight = FontWeight.Bold, color = Cor.Texto)
                    Text("RACE CONTROL  /  ESCALAÇÃO E LASTRO", fontSize = 12.sp, color = Cor.Secundario, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp)
                }
                if (carregando) CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 3.dp, color = Cor.VerdeVivo)
                AcaoCircular("Atualizar", Icons.Rounded.Refresh, onClick = { recarregar++ }, destaque = carregando)
                BotaoAjuda(
                    "Como usar o sorteio",
                    "A cronometragem fornece as baterias e os pilotos. Frota Light usa karts de 1 a 99 e meta de 90 kg; Super usa karts 100+ e meta de 100 kg. O fiscal pode escolher cada kart e o app calcula o lastro com peças de 5 kg e 2,5 kg.",
                )
                AcaoCircular("Configurações", Icons.Rounded.Settings, onClick = { config = true })
            }
        }
        Spacer(Modifier.height(18.dp))
        Acoes {
            Selo(
                when {
                    carregando -> "Atualizando fila"
                    baterias == null -> "Fila indisponível"
                    erro != null -> "Fila desatualizada"
                    else -> "${baterias?.size ?: 0} na fila"
                },
                icone = Icons.Rounded.Casino,
                fundo = when {
                    carregando -> Cor.CartaoElevado
                    erro != null -> Cor.VermelhoClaro
                    else -> Cor.VerdeClaro
                },
                textoCor = when {
                    carregando -> Cor.Secundario
                    erro != null -> Cor.Vermelho
                    else -> Cor.VerdeTexto
                },
            )
            Selo(
                when {
                    carregando -> "Atualizando agenda"
                    agenda == null -> "Agenda indisponível"
                    erroAgenda != null -> "Agenda desatualizada"
                    else -> "${agenda?.count { it.inscritos > 0 } ?: 0} na agenda"
                },
                fundo = when {
                    carregando -> Cor.CartaoElevado
                    erroAgenda != null || agenda == null -> Cor.VermelhoClaro
                    else -> Cor.CartaoElevado
                },
                textoCor = when {
                    carregando -> Cor.Secundario
                    erroAgenda != null || agenda == null -> Cor.Vermelho
                    else -> Cor.Secundario
                },
                icone = Icons.AutoMirrored.Rounded.EventNote,
            )
            Selo(
                when {
                    carregando -> "Sincronizando…"
                    erro != null || erroAgenda != null -> ultimaAtualizacao?.let { "Offline · dados de ${hora.format(Date(it))}" } ?: "Offline"
                    ultimaAtualizacao == null -> "Sem sincronização"
                    else -> "Atualizado às ${hora.format(Date(ultimaAtualizacao!!))}"
                },
                fundo = if (erro != null || erroAgenda != null) Cor.AmareloClaro else Cor.CartaoElevado,
                textoCor = if (erro != null || erroAgenda != null) Cor.Amarelo else Cor.Secundario,
                icone = Icons.Rounded.AccessTime,
            )
        }
        Spacer(Modifier.height(14.dp))
        Etapa("01", "ESCOLHA A BATERIA", "Prepare o grid. O próximo kart começa aqui.")
        erro?.let {
            Aviso(it, erro = true, acaoTexto = "Tentar novamente", onAcao = { recarregar++ })
            Spacer(Modifier.height(16.dp))
        }

        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val largo = maxWidth > 820.dp
            val prontas: @Composable (Modifier) -> Unit = { m ->
                Coluna(m, "Prontas para sortear", "Baterias criadas na cronometragem que ainda não largaram") {
                    val lista = baterias.orEmpty()
                    if (baterias != null && lista.isEmpty()) Vazio("Nenhuma bateria esperando sorteio.\nPrepare uma da agenda ao lado ou crie na cronometragem.")
                    LazyColumn(Modifier.fillMaxWidth().weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(lista, key = { it.id }) { b ->
                            CartaoBateria(
                                titulo = b.nome,
                                detalhe = listOf(
                                    b.programaIrmas.joinToString(" + ").ifBlank { Crono.tipo(b.tipo) },
                                    "${b.pilotos} pilotos",
                                    "criada às ${hora.format(Date(b.criadaEm))}",
                                ).joinToString(" · ") + if (b.semKart == 0 && b.pilotos > 0) "  ✓ karts já sorteados" else "",
                                acao = if (b.semKart == 0 && b.pilotos > 0) "Sortear de novo" else "Sortear",
                                principal = true,
                                habilitado = erro == null && !carregando,
                            ) { onSortear(b.id) }
                        }
                    }
                }
            }
            val daAgenda: @Composable (Modifier) -> Unit = { m ->
                Coluna(m, "Agenda de hoje", "Baterias da recepção com inscritos") {
                    erroAgenda?.let {
                        Aviso(it, erro = true, acaoTexto = "Tentar novamente", onAcao = { recarregar++ })
                    }
                    val prontasNomes = baterias.orEmpty().map { it.nome.trim().lowercase() }.toSet()
                    val prontasIds = baterias.orEmpty().mapNotNull { it.agendaId }.toSet()
                    val lista = agenda.orEmpty().filter { it.inscritos > 0 }.sortedBy { it.inicio }
                    if (agenda != null && lista.isEmpty()) Vazio("Nenhuma bateria com inscritos hoje.")
                    LazyColumn(Modifier.fillMaxWidth().weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(lista, key = { it.id }) { a ->
                            val jaPronta = a.id in prontasIds || a.nome.trim().lowercase() in prontasNomes
                            CartaoBateria(
                                titulo = a.nome,
                                detalhe = listOfNotNull(
                                    a.inicio.substringAfter('T').take(5),
                                    "${a.inscritos} inscritos",
                                    a.tipoKart?.let { "kart ${it.lowercase()}" },
                                ).joinToString(" · "),
                                acao = if (jaPronta) "Já está pronta" else "Preparar e sortear",
                                principal = false,
                                habilitado = erroAgenda == null && !jaPronta && preparando == null && !carregando,
                                ocupado = preparando == a.id,
                            ) {
                                preparando = a.id
                                escopo.launch {
                                    try { onSortear(api.preparar(a)) } catch (e: ErroServidor) { erroAgenda = e.message } finally { preparando = null }
                                }
                            }
                        }
                    }
                }
            }
            if (largo) Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) { prontas(Modifier.weight(1.1f)); daAgenda(Modifier.weight(1f)) }
            else Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Segmento(listOf("Prontas para sortear", "Agenda de hoje"), aba, { aba = it })
                if (aba == 0) prontas(Modifier.weight(1f)) else daAgenda(Modifier.weight(1f))
            }
        }
      }
    }

    if (config) DialogoConfig(prefs) { config = false; recarregar++ }
}

@Composable
private fun Coluna(modifier: Modifier, titulo: String, sub: String, conteudo: @Composable ColumnScope.() -> Unit) {
    Column(modifier.fillMaxSize()) {
        Titulo(titulo, sub)
        Spacer(Modifier.height(14.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) { conteudo() }
        Spacer(Modifier.height(10.dp))
        Text(
            if (titulo == "Prontas para sortear") "Dados da cronometragem · toque em Sortear para preparar o grid." else "Agenda da recepção · baterias com inscritos aparecem aqui.",
            color = Cor.Secundario,
            fontSize = 12.sp,
            maxLines = 2,
        )
    }
}

@Composable
private fun Vazio(texto: String) {
    Cartao(Modifier.fillMaxWidth(), fundo = Cor.CartaoElevado) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.AutoMirrored.Rounded.EventNote, null, tint = Cor.Secundario)
            Spacer(Modifier.width(12.dp))
            Text(texto, color = Cor.Secundario, fontSize = 15.sp)
        }
    }
}

@Composable
private fun CartaoBateria(titulo: String, detalhe: String, acao: String, principal: Boolean, habilitado: Boolean = true, ocupado: Boolean = false, onClick: () -> Unit) {
    Cartao(Modifier.fillMaxWidth(), padding = 16.dp) {
        BoxWithConstraints {
            // Nos tablets de race control mantemos a ação abaixo dos dados,
            // como na folha de operação: o operador lê o contexto e só então toca no CTA.
            val horizontal = maxWidth >= 1500.dp
            val conteudo: @Composable () -> Unit = {
                Selo(
                    if (principal) "CRONOMETRAGEM" else "AGENDA DO DIA",
                    fundo = if (principal) Cor.VerdeClaro else Cor.CartaoElevado,
                    textoCor = if (principal) Cor.VerdeTexto else Cor.Secundario,
                )
                Spacer(Modifier.height(8.dp))
                Text(titulo, fontSize = 20.sp, lineHeight = 24.sp, fontWeight = FontWeight.Bold, color = Cor.Texto, maxLines = 2, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                Text(detalhe, fontSize = 14.sp, lineHeight = 20.sp, color = Cor.Secundario, maxLines = 2, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
            }
            if (horizontal) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) { conteudo() }
                    Spacer(Modifier.width(18.dp))
                    if (ocupado) CircularProgressIndicator(Modifier.size(28.dp), strokeWidth = 3.dp, color = Cor.VerdeVivo)
                    else if (principal) BotaoPrincipal(acao, onClick, Modifier.width(220.dp), icone = Icons.Rounded.Casino, habilitado = habilitado)
                    else BotaoSecundario(acao, onClick, Modifier.width(220.dp), habilitado = habilitado)
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    conteudo()
                    if (ocupado) CircularProgressIndicator(Modifier.size(28.dp), strokeWidth = 3.dp, color = Cor.VerdeVivo)
                    else if (principal) BotaoPrincipal(acao, onClick, Modifier.fillMaxWidth(), icone = Icons.Rounded.Casino, habilitado = habilitado)
                    else BotaoSecundario(acao, onClick, Modifier.fillMaxWidth(), habilitado = habilitado)
                }
            }
        }
    }
}

@Composable
private fun DialogoConfig(prefs: Preferencias, onFechar: () -> Unit) {
    val escopo = rememberCoroutineScope()
    var servidor by remember { mutableStateOf(prefs.servidor) }
    var umAUm by remember { mutableStateOf(prefs.umAUm) }
    var recusas by remember { mutableIntStateOf(prefs.recusas) }
    var segundos by remember { mutableIntStateOf(prefs.segundos) }
    var animacao by remember { mutableStateOf(prefs.animacao) }
    var teste by remember { mutableStateOf<String?>(null) }
    var testando by remember { mutableStateOf(false) }
    var endpointTestado by remember { mutableStateOf(true) }
    Dialog(onDismissRequest = onFechar, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Cartao(
            Modifier.widthIn(max = 760.dp).fillMaxWidth().heightIn(max = 760.dp).padding(20.dp),
            padding = 24.dp,
            fundo = Cor.PalcoCartao,
            borda = Cor.Borda,
        ) {
            Column(Modifier.fillMaxWidth().heightIn(max = 710.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier.size(56.dp).clip(RoundedCornerShape(18.dp)).background(Cor.VerdeClaro),
                        contentAlignment = Alignment.Center,
                    ) { Icon(Icons.Rounded.Settings, null, tint = Cor.VerdeTexto, modifier = Modifier.size(28.dp)) }
                    Spacer(Modifier.width(14.dp))
                    Text("Configurações do sorteio", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Cor.Texto, modifier = Modifier.weight(1f))
                    IconButton(onClick = onFechar) { Icon(Icons.Rounded.Close, "Fechar", tint = Cor.Texto) }
                }
                Spacer(Modifier.height(18.dp))
                Column(
                    Modifier.weight(1f).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    OutlinedTextField(
                        servidor, {
                            servidor = it
                            teste = null
                            endpointTestado = it.trim().trimEnd('/') == prefs.servidor.trim().trimEnd('/')
                        }, label = { Text("Endereço da cronometragem") },
                        singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri), modifier = Modifier.fillMaxWidth(),
                    )
                    Text("O endereço testado fica salvo neste tablet e é usado nas próximas baterias.", fontSize = 13.sp, color = Cor.Secundario)
                    if (!endpointTestado) Text("Teste a conexão antes de salvar um novo endereço.", fontSize = 13.sp, color = Cor.Amarelo)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        TextButton(enabled = !testando, onClick = {
                            teste = "Testando…"
                            testando = true
                            val candidato = servidor.trim().trimEnd('/')
                            escopo.launch {
                                teste = try {
                                    if (Api { candidato }.testar()) {
                                        endpointTestado = true
                                        "Conectado à cronometragem."
                                    } else {
                                        endpointTestado = false
                                        "A cronometragem respondeu, mas não está pronta."
                                    }
                                } catch (e: ErroServidor) {
                                    endpointTestado = false
                                    e.message
                                }
                                testando = false
                            }
                        }) { Text("Testar conexão") }
                        teste?.let { Text(it, fontSize = 14.sp, color = if (it.startsWith("Conectado")) Cor.VerdeTexto else Cor.Secundario) }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("Modo um a um", fontSize = 15.sp)
                            Text("Confirma cada kart antes de chamar o próximo piloto.", fontSize = 13.sp, color = Cor.Secundario)
                        }
                        Switch(umAUm, { umAUm = it })
                    }
                    Contador("Recusas por piloto no modo um a um", recusas, 0..5, { recusas = it }, if (recusas == 0) "sem recusas: a confirmação é manual" else null)
                    if (recusas > 0) Contador("Segundos para aceitar sozinho", segundos, 3..60, { segundos = it })
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Animação da roleta", Modifier.weight(1f), fontSize = 15.sp)
                        Switch(animacao, { animacao = it })
                    }
                }
                Spacer(Modifier.height(18.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    BotaoSecundario("Cancelar", onFechar, modifier = Modifier.width(140.dp))
                    Spacer(Modifier.width(12.dp))
                    BotaoPrincipal(
                        "Salvar",
                        {
                            prefs.servidor = servidor; prefs.umAUm = umAUm; prefs.recusas = recusas; prefs.segundos = segundos; prefs.animacao = animacao
                            onFechar()
                        },
                        modifier = Modifier.width(140.dp),
                        icone = Icons.Rounded.Check,
                        habilitado = endpointTestado && !testando,
                    )
                }
            }
        }
    }
}

@Composable
private fun Contador(rotulo: String, valor: Int, faixa: IntRange, onMudar: (Int) -> Unit, dica: String? = null) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(rotulo, fontSize = 15.sp)
            if (dica != null) Text(dica, fontSize = 13.sp, color = Cor.Secundario)
        }
        TextButton(onClick = { if (valor > faixa.first) onMudar(valor - 1) }) { Text("−", fontSize = 22.sp) }
        Text("$valor", fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(36.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        TextButton(onClick = { if (valor < faixa.last) onMudar(valor + 1) }) { Text("+", fontSize = 22.sp) }
    }
}

object Crono {
    fun tipo(t: String) = when (t) { "classificacao" -> "Tomada de tempo"; "corrida" -> "Corrida"; "treino" -> "Treino"; else -> t }
}
