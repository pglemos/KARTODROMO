package br.com.kartodromobetim.sorteio

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.selection.toggleable
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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.focusable
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Passo 2: conferir os pilotos, marcar os karts que vão para a pista e escolher o modo. */
@Composable
fun TelaPreparar(
    api: Api,
    prefs: Preferencias,
    id: String,
    onVoltar: () -> Unit,
    onComecar: (InfoSorteio, List<String>, Boolean) -> Unit,
    onFiscal: (InfoSorteio, List<String>, Frota) -> Unit,
) {
    var info by remember { mutableStateOf<InfoSorteio?>(null) }
    var erro by remember { mutableStateOf<String?>(null) }
    var tentativa by remember { mutableIntStateOf(0) }
    // sem o tipo de kart na agenda, o operador escolhe a frota (nunca mistura light com super sem querer)
    var frota by remember { mutableStateOf<Frota?>(null) }
    var fora by remember { mutableStateOf(prefs.kartsFora) }
    var umAUm by remember { mutableStateOf(prefs.umAUm) }
    var fiscalEscolhe by remember { mutableStateOf(false) }

    LaunchedEffect(id, tentativa) {
        try {
            val i = api.info(id)
            info = i
            frota = Frota.da(i.tipoKart).takeIf { it != Frota.TODOS }
        } catch (e: ErroServidor) { erro = e.message }
    }

    FundoCinematografico(FundoApp.PIT_LANE) {
      Column(Modifier.fillMaxSize().padding(horizontal = 24.dp, vertical = 18.dp)) {
        val cabecalhoInfo = info
        CabecalhoTela(
            cabecalhoInfo?.bateria?.nome ?: "Carregando bateria…",
            cabecalhoInfo?.let { listOf(it.bateria.programaIrmas.joinToString(" + ").ifBlank { Crono.tipo(it.bateria.tipo) }, "${it.pilotos.size} pilotos").joinToString(" · ") },
            onVoltar = onVoltar,
        ) {
            BotaoAjuda(
                "Como preparar a bateria",
                "Light usa karts de 1 a 99 e meta de 90 kg. Super usa karts 100+ e meta de 100 kg. " +
                    "Lastro é acrescentado em peças de 5 kg e 2,5 kg. No modo Fiscal escolhe, você confirma cada piloto e kart.",
            )
        }
        Spacer(Modifier.height(14.dp))
        Etapa("02", "PREPARE O GRID", "Confira os pilotos, escolha a frota e libere os karts.")
        erro?.let { mensagem ->
            Cartao(Modifier.weight(1f).fillMaxWidth(), fundo = Cor.VermelhoClaro, borda = Cor.Vermelho) {
                Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    Aviso(mensagem, erro = true)
                    Spacer(Modifier.height(16.dp))
                    BotaoSecundario("Tentar novamente", {
                        erro = null
                        info = null
                        tentativa++
                    })
                }
            }
            return@Column
        }
        val i = info ?: run {
            Cartao(Modifier.weight(1f).fillMaxWidth(), fundo = Cor.CartaoElevado) {
                Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    CircularProgressIndicator(color = Cor.VerdeVivo, strokeWidth = 3.dp)
                    Spacer(Modifier.height(14.dp))
                    Text("Carregando pilotos e karts…", color = Cor.Secundario, fontSize = 15.sp)
                }
            }
            return@Column
        }

        val f = frota
        val visiveis = i.karts.filter { k -> f == null || (k.toIntOrNull()?.let(f.contem) ?: true) }
        val marcados = visiveis.filter { it !in fora }
        val pilotos = i.pilotos
        val problema = when {
            i.estado != "preparando" -> "Essa bateria já largou: não dá mais para sortear os karts."
            pilotos.isEmpty() -> "Essa bateria não tem pilotos com nome. Puxe os inscritos da recepção na cronometragem."
            f == null -> "Escolha a frota da bateria: Light (karts 1 a 99) ou Super (karts 100+)."
            fiscalEscolhe && f.alvoKg == null -> "Escolha Light ou Super para calcular o lastro do grid."
            visiveis.isEmpty() -> "Nenhum kart da frota ${f.titulo} está disponível nesta bateria. Volte para Light ou revise a manutenção."
            marcados.size < pilotos.size -> "Marque pelo menos ${pilotos.size} karts (tem ${marcados.size})."
            else -> null
        }

        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val largo = maxWidth > 820.dp
            val painelKartsAltura = (maxHeight * 0.58f).coerceIn(340.dp, 520.dp)
            val painelPilotosAltura = (maxHeight * 0.40f).coerceIn(240.dp, 360.dp)
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
                                Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Text("${n + 1}", Modifier.width(30.dp), color = Cor.Secundario, fontSize = 14.sp)
                                    Column(Modifier.weight(1f)) {
                                        Text(p.nome, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Cor.Texto, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                        val extra = listOfNotNull(
                                            p.pesoKg?.let { "${"%.0f".format(it)} kg" },
                                            p.excecoes.takeIf { it.isNotEmpty() }?.let { "já usou kart ${it.sortedBy { k -> k.toIntOrNull() ?: 0 }.joinToString(", ")}" },
                                        )
                                        if (extra.isNotEmpty()) Text(extra.joinToString(" · "), fontSize = 13.sp, color = Cor.Secundario, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                    }
                                    if (p.kartAtual.isNotBlank()) PlacaKart(p.kartAtual, 15.sp, 44.dp, 32.dp, destaque = false)
                                }
                                HorizontalDivider(color = Cor.Borda)
                            }
                        }
                    }
                }
            }
            val painelKarts: @Composable (Modifier) -> Unit = { m ->
                Cartao(m.fillMaxHeight(), padding = 20.dp) {
                    Column {
                        Column {
                            Column {
                                Text("Karts na pista", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                                Text("Toque para tirar do sorteio os karts em manutenção. O tablet lembra.", fontSize = 13.sp, color = Cor.Secundario)
                            }
                            Acoes {
                            TextButton(onClick = { fora = fora - visiveis.toSet(); prefs.kartsFora = fora }) { Text("Marcar todos") }
                            TextButton(onClick = { fora = fora + visiveis; prefs.kartsFora = fora }) { Text("Nenhum") }
                            }
                        }
                        Spacer(Modifier.height(12.dp))
                        Segmento(Frota.entries.map { it.titulo }, f?.ordinal ?: -1, { frota = Frota.entries[it] })
                        Spacer(Modifier.height(14.dp))
                        LazyVerticalGrid(GridCells.Adaptive(66.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            items(visiveis, key = { it }) { k ->
                                val sel = k !in fora
                                var focado by remember(k) { mutableStateOf(false) }
                                Box(
                                    Modifier
                                        .aspectRatio(1.25f)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(if (sel) Cor.Verde else Cor.Fundo)
                                        .border(if (focado) 2.dp else 1.dp, if (focado) Cor.BordaFoco else if (sel) Color.Transparent else Cor.Borda, RoundedCornerShape(12.dp))
                                        .semantics {
                                            contentDescription = "Kart $k, " + if (sel) "disponível para o sorteio" else "em manutenção"
                                            stateDescription = if (sel) "Disponível" else "Fora do sorteio"
                                        }
                                        .onFocusChanged { focado = it.isFocused }
                                        .focusable()
                                        .toggleable(value = sel, role = Role.Checkbox) { fora = if (sel) fora + k else fora - k; prefs.kartsFora = fora },
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(
                                        k, fontSize = 20.sp, fontWeight = FontWeight.Black,
                                        color = if (sel) Color.White else Cor.TextoDesativado,
                                        textDecoration = if (sel) null else TextDecoration.LineThrough,
                                    )
                                }
                            }
                        }
                    }
                }
            }
            if (largo) Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) { painelPilotos(Modifier.weight(0.9f)); painelKarts(Modifier.weight(1.1f)) }
            else Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp)) { painelKarts(Modifier.height(painelKartsAltura)); painelPilotos(Modifier.height(painelPilotosAltura)) }
        }

        Spacer(Modifier.height(16.dp))
        if (problema != null) { Aviso(problema, erro = i.estado != "preparando"); Spacer(Modifier.height(12.dp)) }
        else if (f == Frota.TODOS) { Aviso("Atenção: com Todos, o sorteio mistura karts light e super."); Spacer(Modifier.height(12.dp)) }
        else if (pilotos.any { it.kartAtual.isNotBlank() }) { Aviso("Alguns pilotos já têm kart. O sorteio troca pelos karts sorteados."); Spacer(Modifier.height(12.dp)) }
        BarraAcao {
            Segmento(listOf("Sorteio automático", "Fiscal escolhe"), if (fiscalEscolhe) 1 else 0, { fiscalEscolhe = it == 1 }, Modifier.width(340.dp))
            if (fiscalEscolhe) {
                Selo("${pilotos.size} pilotos · escolha individual · alvo ${f?.alvoKg?.let { "${it.toInt()} kg" } ?: "—"}", fundo = Cor.Cartao, textoCor = Cor.Secundario)
                BotaoPrincipal("Abrir escalação", { onFiscal(i, marcados, f!!) }, icone = Icons.Rounded.Casino, habilitado = problema == null)
            } else {
                Selo("${pilotos.size} pilotos · ${marcados.size} karts marcados", fundo = Cor.Cartao, textoCor = Cor.Secundario)
                BotaoPrincipal("Começar sorteio", { onComecar(i, marcados, umAUm) }, icone = Icons.Rounded.Casino, habilitado = problema == null)
            }
        }
      }
    }
}
