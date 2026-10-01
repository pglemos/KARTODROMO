package br.com.kartodromobetim.sorteio

import android.provider.Settings

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Casino
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.FastForward
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Passo 3: o palco do sorteio (tela escura para mostrar aos pilotos). */
@Composable
fun TelaSortear(info: InfoSorteio, karts: List<String>, umAUm: Boolean, prefs: Preferencias, sorteador: Sorteador, onTerminar: (List<Sorteado>) -> Unit) {
    val escopo = rememberCoroutineScope()
    val contexto = LocalContext.current
    val animacaoSistemaAtiva = remember(contexto) {
        val resolver = contexto.contentResolver
        Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f &&
            Settings.Global.getFloat(resolver, Settings.Global.TRANSITION_ANIMATION_SCALE, 1f) > 0f
    }
    val aceitos = remember { mutableStateListOf<Sorteado>() }
    var nomeNoPalco by remember { mutableStateOf("") }
    var numeroNoPalco by remember { mutableStateOf("?") }
    var girando by remember { mutableStateOf(false) }
    var pular by remember { mutableStateOf(false) }
    val pulo = remember { Animatable(1f) }
    val listaEstado = rememberLazyListState()

    suspend fun rolarPara(indice: Int) {
        if (prefs.animacao && animacaoSistemaAtiva) listaEstado.animateScrollToItem(indice)
        else listaEstado.scrollToItem(indice)
    }

    /** Roleta: números passando cada vez mais devagar até parar no sorteado. */
    suspend fun roleta(final: String) {
        girando = true
        if (prefs.animacao && animacaoSistemaAtiva && !pular) {
            var espera = 35L
            while (espera < 190 && !pular) {
                numeroNoPalco = sorteador.qualquer(karts)
                delay(espera)
                espera = (espera * 1.12).toLong() + 2
            }
        }
        numeroNoPalco = final
        girando = false
        pulo.snapTo(1.35f)
        if (prefs.animacao && animacaoSistemaAtiva && !pular) {
            escopo.launch { pulo.animateTo(1f, spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow)) }
        } else pulo.snapTo(1f)
    }

    // ---------------------------------------------------------------- todos de uma vez
    if (!umAUm) {
        val resultado = remember { sorteador.todos(info.pilotos, karts) }
        LaunchedEffect(Unit) {
            for (s in resultado) {
                nomeNoPalco = s.piloto.nome
                roleta(s.kart)
                aceitos.add(s)
                rolarPara(aceitos.size - 1)
                if (!pular) delay(if (prefs.animacao && animacaoSistemaAtiva) 900 else 250)
            }
        }
        Palco(
            titulo = info.bateria.nome,
            progresso = "${aceitos.size} de ${resultado.size} pilotos",
            nome = nomeNoPalco, numero = numeroNoPalco, escala = pulo.value, girando = girando,
            aceitos = aceitos, listaEstado = listaEstado,
            rodape = {
                if (aceitos.size < resultado.size) BotaoSecundario("Pular animação", { pular = true }, icone = Icons.Rounded.FastForward, escuro = true)
                else BotaoPrincipal("Ver resultado", { onTerminar(aceitos.toList()) }, icone = Icons.Rounded.Check)
            },
        )
        return
    }

    // ---------------------------------------------------------------- um a um
    val fila = remember { mutableStateListOf<Piloto>().apply { addAll(info.pilotos.sortedBy { it.nome.lowercase() }) } }
    val livres = remember { mutableStateListOf<String>().apply { addAll(karts) } }
    var atual by remember { mutableStateOf<Piloto?>(fila.firstOrNull()) }
    var proposta by remember { mutableStateOf<Sorteado?>(null) }
    val recusados = remember { mutableStateListOf<String>() }
    var recusasUsadas by remember { mutableIntStateOf(0) }
    var contagem by remember { mutableIntStateOf(0) }
    val podeRecusar = prefs.recusas > 0

    fun aceitar() {
        val p = proposta ?: return
        aceitos.add(p)
        livres.remove(p.kart)
        fila.remove(p.piloto)
        proposta = null
        recusados.clear()
        recusasUsadas = 0
        atual = fila.firstOrNull()
        nomeNoPalco = atual?.nome ?: ""
        numeroNoPalco = "?"
        escopo.launch { if (aceitos.isNotEmpty()) rolarPara(aceitos.size - 1) }
    }

    LaunchedEffect(atual) { nomeNoPalco = atual?.nome ?: ""; numeroNoPalco = "?" }
    // tempo para aceitar sozinho
    LaunchedEffect(proposta) {
        val p = proposta ?: return@LaunchedEffect
        // Sem recusas configuradas, a confirmação continua manual para evitar
        // que o kart seja aceito enquanto o fiscal ainda confere a tela.
        if (!podeRecusar) return@LaunchedEffect
        if (recusasUsadas >= prefs.recusas) { delay(1200); if (proposta == p) aceitar(); return@LaunchedEffect }
        contagem = prefs.segundos
        while (contagem > 0 && proposta == p) { delay(1000); contagem-- }
        if (proposta == p) aceitar()
    }

    Palco(
        titulo = info.bateria.nome,
        progresso = "${aceitos.size} de ${info.pilotos.size} pilotos",
        nome = nomeNoPalco.ifBlank { "Todos sorteados" }, numero = numeroNoPalco, escala = pulo.value, girando = girando,
        aceitos = aceitos, listaEstado = listaEstado,
        faltam = fila.filter { it != atual },
        onEscolherPiloto = { p -> if (proposta == null && !girando) atual = p },
        rodape = {
            val p = atual
            val prop = proposta
            when {
                p == null -> BotaoPrincipal("Ver resultado", { onTerminar(aceitos.toList()) }, icone = Icons.Rounded.Check)
                girando -> BotaoSecundario("Sorteando…", {}, habilitado = false, escuro = true)
                prop == null -> BotaoPrincipal("Sortear kart de ${p.nome}", {
                    val s = sorteador.umKart(p, livres.toList(), recusados.toSet())
                    escopo.launch { roleta(s.kart); proposta = s }
                }, icone = Icons.Rounded.Casino, maxLinhas = 2, altura = 64.dp)
                podeRecusar && recusasUsadas < prefs.recusas -> Acoes {
                    BotaoSecundario("Recusar (${prefs.recusas - recusasUsadas})", {
                        recusados.add(prop.kart); recusasUsadas++; proposta = null; numeroNoPalco = "?"
                    }, icone = Icons.Rounded.Close, escuro = true, habilitado = livres.size > 1)
                    BotaoPrincipal("Aceitar kart ${prop.kart} · $contagem s", { aceitar() }, icone = Icons.Rounded.Check)
                }
                else -> BotaoPrincipal("Kart ${prop.kart} confirmado", { aceitar() }, icone = Icons.Rounded.Check)
            }
        },
    )
}

@Composable
private fun Palco(
    titulo: String,
    progresso: String,
    nome: String,
    numero: String,
    escala: Float,
    girando: Boolean,
    aceitos: List<Sorteado>,
    listaEstado: androidx.compose.foundation.lazy.LazyListState,
    faltam: List<Piloto> = emptyList(),
    onEscolherPiloto: (Piloto) -> Unit = {},
    rodape: @Composable () -> Unit,
) {

    FundoCinematografico(FundoApp.LIVE_TRACK) {
      BoxWithConstraints(Modifier.fillMaxSize().padding(24.dp)) {
        val compacto = maxWidth < 760.dp
        val baixo = maxHeight < 620.dp
        val principalAltura = (maxHeight * 0.56f).coerceIn(360.dp, 560.dp)
        val listaAltura = (maxHeight * 0.42f).coerceIn(280.dp, 420.dp)
        val principal: @Composable (Modifier) -> Unit = { m ->
            Column(m, horizontalAlignment = Alignment.CenterHorizontally) {
                Etapa("03", "SORTEIO AO VIVO", titulo)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    BotaoAjuda(
                        "Como conduzir o sorteio",
                        "Toque em Sortear para revelar o kart. No modo um a um, confirme ou recuse conforme as regras configuradas. O grid confirmado aparece ao lado; use Ver resultado quando todos estiverem prontos.",
                    )
                }
                Selo(progresso, fundo = Cor.VerdeClaro, textoCor = Cor.VerdeTexto)
                Spacer(Modifier.weight(1f))
                Text(if (girando) "SORTEANDO PARA" else "PILOTO", color = Cor.Secundario, fontSize = 11.sp, letterSpacing = 3.sp)
                Text(nome, color = Cor.Texto, fontSize = if (compacto || baixo) 24.sp else 34.sp, fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(16.dp))
                Box(Modifier.size(if (compacto) 230.dp else 360.dp, if (baixo || compacto) 164.dp else 270.dp)
                    .scale(escala).shadow(if (numero == "?") 12.dp else 28.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x6600E676), spotColor = Color(0x9900E676))
                    .clip(RoundedCornerShape(24.dp))
                    .background(
                        if (girando || numero == "?") Brush.verticalGradient(listOf(Color(0xB31D292D), Color(0xCC101619)))
                        else Brush.linearGradient(listOf(Cor.VerdeVivo, Cor.Verde)),
                    )
                    .border(1.dp, if (girando || numero == "?") Cor.Borda else Cor.VerdeBorda, RoundedCornerShape(24.dp)), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("SEU KART", color = Color(0xCCFFFFFF), fontSize = 11.sp, letterSpacing = 3.sp)
                        Text(numero, color = Color.White, fontSize = if (baixo || compacto) 92.sp else 142.sp,
                            fontWeight = FontWeight.Black, lineHeight = if (baixo || compacto) 98.sp else 148.sp)
                    }
                }
                Spacer(Modifier.weight(1f))
                BarraAcao { rodape() }
            }
        }
        val lista: @Composable (Modifier) -> Unit = { m ->
            Cartao(m, padding = 16.dp) {
                Column {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text("Grid da bateria", color = Cor.Texto, fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        Text(aceitos.size.toString(), color = Color(0xFF7CE5BE), fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.height(12.dp))
                    if (aceitos.isEmpty()) Text("Os pilotos aparecem aqui após a confirmação.", color = Cor.Secundario, fontSize = 13.sp)
                    LazyColumn(Modifier.weight(1f), state = listaEstado, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(aceitos, key = { it.piloto.indice }) { s ->
                            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Cor.Fundo).padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(s.piloto.nome, color = Cor.Texto, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                    if (s.repetiu) Text("Repetiu o kart anterior", color = Cor.Amarelo, fontSize = 12.sp)
                                }
                                PlacaKart(s.kart)
                            }
                        }
                    }
                    if (faltam.isNotEmpty()) {
                        Spacer(Modifier.height(12.dp))
                        Text("A SEGUIR · toque para chamar", color = Cor.Secundario, fontSize = 11.sp, letterSpacing = 1.sp)
                        LazyColumn(Modifier.weight(0.7f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            items(faltam, key = { it.indice }) { p ->
                                var focado by remember(p.indice) { mutableStateOf(false) }
                                Text(
                                    p.nome,
                                    color = Cor.Texto,
                                    fontSize = 14.sp,
                                    maxLines = 2,
                                    modifier = Modifier.fillMaxWidth()
                                        .clip(RoundedCornerShape(8.dp))
                                        .border(if (focado) 2.dp else 1.dp, if (focado) Cor.BordaFoco else Color.Transparent, RoundedCornerShape(8.dp))
                                        .semantics { contentDescription = "Chamar piloto ${p.nome}" }
                                        .onFocusChanged { focado = it.isFocused }
                                        .focusable()
                                        .clickable { onEscolherPiloto(p) }
                                        .padding(vertical = 12.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
        if (compacto) Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            principal(Modifier.height(principalAltura).fillMaxWidth())
            lista(Modifier.height(listaAltura).fillMaxWidth())
        } else Row(horizontalArrangement = Arrangement.spacedBy(28.dp)) {
            principal(Modifier.weight(1.5f).fillMaxHeight())
            lista(Modifier.weight(1f).fillMaxHeight())
        }
      }
    }
}
