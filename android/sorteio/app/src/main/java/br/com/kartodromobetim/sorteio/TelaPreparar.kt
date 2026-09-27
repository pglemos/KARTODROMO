package br.com.kartodromobetim.sorteio

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Casino
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Passo 2: conferir os pilotos, marcar os karts que vão para a pista e escolher o modo. */
@Composable
fun TelaPreparar(api: Api, prefs: Preferencias, id: String, onVoltar: () -> Unit, onComecar: (InfoSorteio, List<String>, Boolean) -> Unit) {
    var info by remember { mutableStateOf<InfoSorteio?>(null) }
    var erro by remember { mutableStateOf<String?>(null) }
    // sem o tipo de kart na agenda, o operador escolhe a frota (nunca mistura light com super sem querer)
    var frota by remember { mutableStateOf<Frota?>(null) }
    var fora by remember { mutableStateOf(prefs.kartsFora) }
    var umAUm by remember { mutableStateOf(prefs.umAUm) }

    LaunchedEffect(id) {
        try {
            val i = api.info(id)
            info = i
            frota = Frota.da(i.tipoKart).takeIf { it != Frota.TODOS }
        } catch (e: ErroServidor) { erro = e.message }
    }

    Column(Modifier.fillMaxSize().padding(horizontal = 28.dp, vertical = 20.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onVoltar) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Voltar", tint = Cor.Texto) }
            Spacer(Modifier.width(6.dp))
            val i = info
            Titulo(
                i?.bateria?.nome ?: "Carregando…",
                i?.let { listOf(it.bateria.programaIrmas.joinToString(" + ").ifBlank { Crono.tipo(it.bateria.tipo) }, "${it.pilotos.size} pilotos").joinToString(" · ") },
            )
        }
        Spacer(Modifier.height(16.dp))
        erro?.let { Aviso(it, erro = true); return@Column }
        val i = info ?: run { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }; return@Column }

        val f = frota
        val visiveis = i.karts.filter { k -> f == null || (k.toIntOrNull()?.let(f.contem) ?: true) }
        val marcados = visiveis.filter { it !in fora }
        val pilotos = i.pilotos
        val problema = when {
            i.estado != "preparando" -> "Essa bateria já largou: não dá mais para sortear os karts."
            pilotos.isEmpty() -> "Essa bateria não tem pilotos com nome. Puxe os inscritos da recepção na cronometragem."
            f == null -> "Escolha a frota da bateria: Light (karts 1 a 99) ou Super (karts 100+)."
            marcados.size < pilotos.size -> "Marque pelo menos ${pilotos.size} karts (tem ${marcados.size})."
            else -> null
        }

        BoxWithConstraints(Modifier.weight(1f)) {
            val largo = maxWidth > 820.dp
            val painelPilotos: @Composable (Modifier) -> Unit = { m ->
                Cartao(m.fillMaxHeight(), padding = 0.dp) {
                    Column {
                        Row(Modifier.padding(20.dp, 18.dp, 20.dp, 12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text("Pilotos", fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                            Text("${pilotos.size}", fontSize = 16.sp, color = Cor.Secundario, fontWeight = FontWeight.SemiBold)
                        }
                        HorizontalDivider(color = Cor.Borda)
                        LazyColumn {
                            itemsIndexed(pilotos, key = { _, p -> p.indice }) { n, p ->
                                Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Text("${n + 1}", Modifier.width(30.dp), color = Cor.Secundario, fontSize = 14.sp)
                                    Column(Modifier.weight(1f)) {
                                        Text(p.nome, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Cor.Texto, maxLines = 1)
                                        val extra = listOfNotNull(
                                            p.pesoKg?.let { "${"%.0f".format(it)} kg" },
                                            p.excecoes.takeIf { it.isNotEmpty() }?.let { "já usou kart ${it.sortedBy { k -> k.toIntOrNull() ?: 0 }.joinToString(", ")}" },
                                        )
                                        if (extra.isNotEmpty()) Text(extra.joinToString(" · "), fontSize = 13.sp, color = Cor.Secundario, maxLines = 1)
                                    }
                                    if (p.kartAtual.isNotBlank()) PlacaKart(p.kartAtual, 15.sp, 44.dp, 32.dp, destaque = false)
                                }
                                HorizontalDivider(color = Color(0xFFF0F1F3))
                            }
                        }
                    }
                }
            }
            val painelKarts: @Composable (Modifier) -> Unit = { m ->
                Cartao(m.fillMaxHeight(), padding = 20.dp) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("Karts na pista", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                                Text("Toque para tirar do sorteio os karts em manutenção. O tablet lembra.", fontSize = 13.sp, color = Cor.Secundario)
                            }
                            TextButton(onClick = { fora = fora - visiveis.toSet(); prefs.kartsFora = fora }) { Text("Marcar todos") }
                            TextButton(onClick = { fora = fora + visiveis; prefs.kartsFora = fora }) { Text("Nenhum") }
                        }
                        Spacer(Modifier.height(12.dp))
                        Segmento(Frota.entries.map { it.titulo }, f?.ordinal ?: -1, { frota = Frota.entries[it] })
                        Spacer(Modifier.height(14.dp))
                        LazyVerticalGrid(GridCells.Adaptive(66.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            items(visiveis, key = { it }) { k ->
                                val sel = k !in fora
                                Box(
                                    Modifier
                                        .aspectRatio(1.25f)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(if (sel) Cor.Verde else Cor.Fundo)
                                        .border(1.dp, if (sel) Color(0x22000000) else Cor.Borda, RoundedCornerShape(12.dp))
                                        .clickable { fora = if (sel) fora + k else fora - k; prefs.kartsFora = fora },
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(
                                        k, fontSize = 20.sp, fontWeight = FontWeight.Black,
                                        color = if (sel) Color.White else Color(0xFFB0B5BD),
                                        textDecoration = if (sel) null else TextDecoration.LineThrough,
                                    )
                                }
                            }
                        }
                    }
                }
            }
            if (largo) Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) { painelPilotos(Modifier.weight(0.9f)); painelKarts(Modifier.weight(1.1f)) }
            else Column(verticalArrangement = Arrangement.spacedBy(16.dp)) { painelPilotos(Modifier.weight(1f)); painelKarts(Modifier.weight(1.2f)) }
        }

        Spacer(Modifier.height(16.dp))
        if (problema != null) { Aviso(problema, erro = i.estado != "preparando"); Spacer(Modifier.height(12.dp)) }
        else if (f == Frota.TODOS) { Aviso("Atenção: com Todos, o sorteio mistura karts light e super."); Spacer(Modifier.height(12.dp)) }
        else if (pilotos.any { it.kartAtual.isNotBlank() }) { Aviso("Alguns pilotos já têm kart. O sorteio troca pelos karts sorteados."); Spacer(Modifier.height(12.dp)) }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Segmento(listOf("Todos de uma vez", "Um a um"), if (umAUm) 1 else 0, { umAUm = it == 1; prefs.umAUm = umAUm }, Modifier.width(380.dp))
            Spacer(Modifier.width(16.dp))
            Text("${pilotos.size} pilotos · ${marcados.size} karts marcados", Modifier.weight(1f), fontSize = 15.sp, color = Cor.Secundario)
            BotaoPrincipal("Começar sorteio", { onComecar(i, marcados, umAUm) }, icone = Icons.Rounded.Casino, habilitado = problema == null)
        }
    }
}
