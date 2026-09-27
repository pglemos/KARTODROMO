package br.com.kartodromobetim.sorteio

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Passo 3: o palco do sorteio (tela escura para mostrar aos pilotos). */
@Composable
fun TelaSortear(info: InfoSorteio, karts: List<String>, umAUm: Boolean, prefs: Preferencias, sorteador: Sorteador, onTerminar: (List<Sorteado>) -> Unit) {
    val escopo = rememberCoroutineScope()
    val aceitos = remember { mutableStateListOf<Sorteado>() }
    var nomeNoPalco by remember { mutableStateOf("") }
    var numeroNoPalco by remember { mutableStateOf("?") }
    var girando by remember { mutableStateOf(false) }
    var pular by remember { mutableStateOf(false) }
    val pulo = remember { Animatable(1f) }
    val listaEstado = rememberLazyListState()

    /** Roleta: números passando cada vez mais devagar até parar no sorteado. */
    suspend fun roleta(final: String) {
        girando = true
        if (prefs.animacao && !pular) {
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
        escopo.launch { pulo.animateTo(1f, spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow)) }
    }

    // ---------------------------------------------------------------- todos de uma vez
    if (!umAUm) {
        val resultado = remember { sorteador.todos(info.pilotos, karts) }
        LaunchedEffect(Unit) {
            for (s in resultado) {
                nomeNoPalco = s.piloto.nome
                roleta(s.kart)
                aceitos.add(s)
                listaEstado.animateScrollToItem(aceitos.size - 1)
                if (!pular) delay(if (prefs.animacao) 900 else 250)
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
        escopo.launch { if (aceitos.isNotEmpty()) listaEstado.animateScrollToItem(aceitos.size - 1) }
    }

    LaunchedEffect(atual) { nomeNoPalco = atual?.nome ?: ""; numeroNoPalco = "?" }
    // tempo para aceitar sozinho
    LaunchedEffect(proposta) {
        val p = proposta ?: return@LaunchedEffect
        if (!podeRecusar || recusasUsadas >= prefs.recusas) { delay(1200); if (proposta == p) aceitar(); return@LaunchedEffect }
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
                prop == null -> BotaoPrincipal("Sortear kart de ${p.nome.substringBefore(' ')}", {
                    val s = sorteador.umKart(p, livres.toList(), recusados.toSet())
                    escopo.launch { roleta(s.kart); proposta = s }
                }, icone = Icons.Rounded.Casino)
                podeRecusar && recusasUsadas < prefs.recusas -> Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
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
    Row(
        Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF151A22), Cor.Palco))).padding(28.dp),
        horizontalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        // palco
        Column(Modifier.weight(1.4f).fillMaxHeight(), horizontalAlignment = Alignment.CenterHorizontally) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(titulo, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                Text(progresso, color = Color(0xFF9AA3AF), fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.weight(1f))
            Text("PILOTO", color = Color(0xFF9AA3AF), fontSize = 15.sp, fontWeight = FontWeight.Bold, letterSpacing = 3.sp)
            Text(nome, color = Color.White, fontSize = 40.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(28.dp))
            Box(
                Modifier
                    .size(300.dp, 230.dp)
                    .scale(escala)
                    .clip(RoundedCornerShape(36.dp))
                    .background(if (girando || numero == "?") Brush.verticalGradient(listOf(Color(0xFF232A35), Cor.PalcoCartao)) else Brush.verticalGradient(listOf(Cor.VerdeVivo, Cor.Verde)))
                    .border(2.dp, Color(0x33FFFFFF), RoundedCornerShape(36.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("KART", color = Color(0xB3FFFFFF), fontSize = 16.sp, fontWeight = FontWeight.Bold, letterSpacing = 4.sp)
                    Text(numero, color = Color.White, fontSize = 120.sp, fontWeight = FontWeight.Black, lineHeight = 120.sp)
                }
            }
            Spacer(Modifier.weight(1f))
            rodape()
        }
        // lista dos sorteados (e de quem falta, no um a um)
        Column(
            Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(24.dp)).background(Color(0x0FFFFFFF)).border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(24.dp)).padding(20.dp),
        ) {
            Text("Sorteados", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))
            LazyColumn(Modifier.weight(1f), state = listaEstado, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(aceitos, key = { it.piloto.indice }) { s ->
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0x14FFFFFF)).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(s.piloto.nome, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            if (s.repetiu) Text("já tinha usado esse kart", color = Cor.Amarelo, fontSize = 12.sp)
                        }
                        PlacaKart(s.kart)
                    }
                }
            }
            if (faltam.isNotEmpty()) {
                Spacer(Modifier.height(14.dp))
                Text("Faltam ${faltam.size} · toque para chamar outro piloto", color = Color(0xFF9AA3AF), fontSize = 14.sp)
                Spacer(Modifier.height(8.dp))
                LazyColumn(Modifier.height(180.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(faltam, key = { it.indice }) { p ->
                        Text(
                            p.nome, color = Color(0xFFD1D5DB), fontSize = 15.sp, maxLines = 1,
                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable { onEscolherPiloto(p) }.padding(horizontal = 12.dp, vertical = 10.dp),
                        )
                    }
                }
            }
        }
    }
}
