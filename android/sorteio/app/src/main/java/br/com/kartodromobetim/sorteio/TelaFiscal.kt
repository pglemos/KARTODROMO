package br.com.kartodromobetim.sorteio

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.selection.selectable
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Scale
import androidx.compose.material.icons.rounded.SportsMotorsports
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.snapshots.SnapshotStateMap
import androidx.compose.runtime.setValue
import androidx.activity.compose.BackHandler
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.Role
import java.util.Locale
import org.json.JSONObject

private data class RascunhoFiscal(val atribuicoes: Map<Int, String>, val pesos: Map<Int, Double>)

private fun carregarRascunhoFiscal(contexto: Context, chave: String): RascunhoFiscal? = runCatching {
    val json = contexto.getSharedPreferences("sorteio", Context.MODE_PRIVATE).getString(chave, null) ?: return null
    val atribuicoes = mutableMapOf<Int, String>()
    val atribuicoesJson = JSONObject(json).optJSONObject("atribuicoes")
    if (atribuicoesJson != null) atribuicoesJson.keys().forEach { indice -> atribuicoes[indice.toIntOrNull() ?: return@forEach] = atribuicoesJson.optString(indice) }
    val pesos = mutableMapOf<Int, Double>()
    val pesosJson = JSONObject(json).optJSONObject("pesos")
    if (pesosJson != null) pesosJson.keys().forEach { indice -> pesosJson.optDouble(indice).takeIf { !it.isNaN() }?.let { pesos[indice.toIntOrNull() ?: return@forEach] = it } }
    if (atribuicoes.isEmpty() && pesos.isEmpty()) null else RascunhoFiscal(atribuicoes, pesos)
}.getOrNull()

private fun salvarRascunhoFiscal(contexto: Context, chave: String, atribuicoes: Map<Int, String>, pesos: Map<Int, Double>) {
    val atribuicoesJson = JSONObject().apply { atribuicoes.forEach { (indice, kart) -> put(indice.toString(), kart) } }
    val pesosJson = JSONObject().apply { pesos.forEach { (indice, peso) -> put(indice.toString(), peso) } }
    contexto.getSharedPreferences("sorteio", Context.MODE_PRIVATE).edit()
        .putString(chave, JSONObject().put("atribuicoes", atribuicoesJson).put("pesos", pesosJson).toString()).apply()
}

private fun apagarRascunhoFiscal(contexto: Context, chave: String) {
    contexto.getSharedPreferences("sorteio", Context.MODE_PRIVATE).edit().remove(chave).apply()
}

private val atribuicoesSaver = Saver<SnapshotStateMap<Int, String>, List<String>>(
    save = { mapa -> mapa.flatMap { listOf(it.key.toString(), it.value) } },
    restore = { valores ->
        mutableStateMapOf<Int, String>().apply {
            valores.chunked(2).forEach { par -> if (par.size == 2) put(par[0].toIntOrNull() ?: return@forEach, par[1]) }
        }
    },
)

private val pesosSaver = Saver<SnapshotStateMap<Int, Double>, List<String>>(
    save = { mapa -> mapa.flatMap { listOf(it.key.toString(), it.value.toString()) } },
    restore = { valores ->
        mutableStateMapOf<Int, Double>().apply {
            valores.chunked(2).forEach { par ->
                val indice = par.getOrNull(0)?.toIntOrNull()
                val peso = par.getOrNull(1)?.toDoubleOrNull()
                if (indice != null && peso != null) put(indice, peso)
            }
        }
    },
)

/** Escalação manual: o fiscal escolhe kart e confere o lastro de cada piloto. */
@Composable
fun TelaFiscal(
    info: InfoSorteio,
    karts: List<String>,
    frota: Frota,
    inicial: List<Sorteado> = emptyList(),
    onVoltar: () -> Unit,
    onConcluir: (List<Sorteado>) -> Unit,
) {
    val contexto = LocalContext.current
    val rascunhoChave = "fiscalDraft:${info.bateria.id}:${frota.name}"
    val rascunho = remember(info.bateria.id, frota, inicial) {
        if (inicial.isEmpty()) carregarRascunhoFiscal(contexto, rascunhoChave) else null
    }
    val inicialPorIndice = remember(info.bateria.id, inicial) { inicial.associateBy { it.piloto.indice } }
    val atribuicoesIniciais = remember(info.bateria.id, inicial) {
        if (inicialPorIndice.isNotEmpty()) inicialPorIndice.mapValues { it.value.kart } else rascunho?.atribuicoes.orEmpty()
    }
    val pesosIniciais = remember(info.bateria.id, inicial) {
        info.pilotos.associate { piloto ->
            piloto.indice to (inicialPorIndice[piloto.indice]?.piloto?.pesoKg ?: rascunho?.pesos?.get(piloto.indice) ?: piloto.pesoKg)
        }
    }
    val rascunhoTemMudancas = rascunho?.let { salvo ->
        salvo.atribuicoes.any { (indice, kart) -> info.pilotos.firstOrNull { it.indice == indice }?.kartAtual != kart } ||
            info.pilotos.any { piloto -> salvo.pesos[piloto.indice] != null && salvo.pesos[piloto.indice] != piloto.pesoKg }
    } == true
    val estadoChave = remember(info.bateria.id, inicial) { "${info.bateria.id}:${inicial.joinToString { "${it.piloto.indice}-${it.kart}-${it.piloto.pesoKg}" }}" }
    val assigned = rememberSaveable(estadoChave, saver = atribuicoesSaver) { mutableStateMapOf<Int, String>().apply { putAll(atribuicoesIniciais) } }
    val pesos = rememberSaveable(estadoChave, saver = pesosSaver) {
        mutableStateMapOf<Int, Double>().apply {
            pesosIniciais.forEach { (indice, peso) -> peso?.let { put(indice, it) } }
        }
    }
    var selecionado by remember { mutableIntStateOf(info.pilotos.firstOrNull()?.indice ?: -1) }
    var editarPeso by remember { mutableStateOf<Int?>(null) }
    var confirmarSaida by remember { mutableStateOf(false) }
    val meta = frota.alvoKg ?: 0.0
    val prontos = info.pilotos.count { assigned[it.indice] != null && calcularLastro(pesos[it.indice], frota) != null }
    val podeConcluir = prontos == info.pilotos.size
    val temAlteracoes = assigned.toMap() != atribuicoesIniciais || info.pilotos.any { pesos[it.indice] != pesosIniciais[it.indice] }

    LaunchedEffect(assigned.toMap(), pesos.toMap(), inicial.isEmpty()) {
        if (inicial.isEmpty()) {
            val temRascunho = assigned.any { (indice, kart) -> info.pilotos.firstOrNull { it.indice == indice }?.kartAtual != kart } ||
                info.pilotos.any { pesos[it.indice] != it.pesoKg }
            if (temRascunho) salvarRascunhoFiscal(contexto, rascunhoChave, assigned.toMap(), pesos.toMap())
            else apagarRascunhoFiscal(contexto, rascunhoChave)
        }
    }

    fun voltarComSeguranca() {
        if (temAlteracoes) confirmarSaida = true else onVoltar()
    }

    BackHandler { voltarComSeguranca() }

    FundoCinematografico(FundoApp.PIT_LANE) {
      Column(Modifier.fillMaxSize().padding(horizontal = 24.dp, vertical = 18.dp)) {
        CabecalhoTela(
            info.bateria.nome,
            "ESCALAÇÃO DO FISCAL · ${frota.titulo.uppercase(Locale("pt", "BR"))}",
            onVoltar = ::voltarComSeguranca,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (rascunhoTemMudancas) Selo("RASCUNHO RESTAURADO", fundo = Cor.AmareloClaro, textoCor = Cor.Amarelo)
                Selo("META ${formatarKg(meta)} kg", icone = Icons.Rounded.Scale)
                BotaoAjuda(
                    "Como funciona o lastro",
                    "O peso final nunca fica abaixo da meta. O app completa o déficit usando o maior número possível de peças de 5 kg e, quando necessário, uma peça de 2,5 kg.",
                )
            }
        }
        Spacer(Modifier.height(14.dp))
        Etapa("F", "ESCALAÇÃO FISCAL", "Selecione um piloto, toque no kart e confira as peças de lastro.")

        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val largo = maxWidth > 820.dp
            val painelPilotosAltura = (maxHeight * 0.56f).coerceIn(360.dp, 560.dp)
            val painelKartsAltura = (maxHeight * 0.42f).coerceIn(280.dp, 430.dp)
            val pilotosPainel: @Composable (Modifier) -> Unit = { modifier ->
                Cartao(modifier.fillMaxHeight(), padding = 0.dp) {
                    Column {
                        Row(Modifier.fillMaxWidth().padding(20.dp, 18.dp, 20.dp, 12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("Pilotos e lastro", fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Cor.Texto)
                                Text("$prontos de ${info.pilotos.size} prontos para a pista", fontSize = 13.sp, color = Cor.Secundario)
                            }
                            Selo("$prontos/${info.pilotos.size}", textoCor = if (prontos == info.pilotos.size) Cor.VerdeTexto else Cor.Secundario)
                        }
                        LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp), contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp)) {
                            items(info.pilotos, key = { it.indice }) { piloto ->
                                PilotoFiscal(
                                    piloto = piloto.copy(pesoKg = pesos[piloto.indice]),
                                    plano = calcularLastro(pesos[piloto.indice], frota),
                                    kart = assigned[piloto.indice],
                                    selecionado = selecionado == piloto.indice,
                                    onSelecionar = { selecionado = piloto.indice },
                                    onEditarPeso = { editarPeso = piloto.indice },
                                )
                            }
                        }
                    }
                }
            }
            val kartsPainel: @Composable (Modifier) -> Unit = { modifier ->
                Cartao(modifier.fillMaxHeight(), padding = 20.dp) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("Karts disponíveis", fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Cor.Texto)
                                Text(
                                    if (selecionado >= 0) "Escolha o kart para ${info.pilotos.firstOrNull { it.indice == selecionado }?.nome ?: "o piloto"}"
                                    else "Selecione um piloto primeiro",
                                    fontSize = 13.sp, color = Cor.Secundario, maxLines = 2, overflow = TextOverflow.Ellipsis,
                                )
                            }
                            Icon(Icons.Rounded.SportsMotorsports, null, tint = Cor.VerdeTexto, modifier = Modifier.size(28.dp))
                        }
                        Spacer(Modifier.height(10.dp))
                        Acoes {
                            Selo("Livre", fundo = Cor.VerdeClaro, textoCor = Cor.VerdeTexto)
                            Selo("Escolhido", fundo = Cor.Verde, textoCor = Color.White)
                            Selo("Ocupado", fundo = Cor.CartaoElevado, textoCor = Cor.Secundario)
                            TextButton(
                                onClick = {
                                    val ocupados = assigned.values.toSet()
                                    val livres = karts.filterNot { it in ocupados }
                                    info.pilotos.filter { assigned[it.indice] == null }.zip(livres).forEach { (piloto, kart) -> assigned[piloto.indice] = kart }
                                },
                                enabled = info.pilotos.any { assigned[it.indice] == null } && karts.any { it !in assigned.values },
                            ) { Text("Preencher restantes") }
                        }
                        Spacer(Modifier.height(16.dp))
                        LazyVerticalGrid(
                            GridCells.Adaptive(72.dp), Modifier.fillMaxWidth().weight(1f),
                            horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            items(karts, key = { it }) { kart ->
                                val dono = assigned.entries.firstOrNull { it.value == kart }?.key
                                val nomeDono = dono?.let { indice -> info.pilotos.firstOrNull { it.indice == indice }?.nome }
                                val ativo = dono == null || dono == selecionado
                                val escolhido = dono == selecionado
                                var focado by remember(kart) { mutableStateOf(false) }
                                Box(
                                    Modifier
                                        .aspectRatio(1.08f)
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(if (escolhido) Cor.Verde else if (ativo) Cor.VerdeClaro else Cor.CartaoElevado)
                                        .border(if (focado) 2.dp else 1.dp, if (focado || escolhido) Cor.BordaFoco else Cor.Borda, RoundedCornerShape(14.dp))
                                        .semantics {
                                            contentDescription = "Kart $kart, " + when {
                                                escolhido -> "escolhido para ${info.pilotos.firstOrNull { it.indice == selecionado }?.nome ?: "o piloto"}"
                                                dono != null -> "ocupado por ${nomeDono ?: "piloto ${dono + 1}"}"
                                                else -> "livre"
                                            }
                                            stateDescription = if (escolhido) "Selecionado" else if (dono != null) "Ocupado" else "Disponível"
                                        }
                                        .onFocusChanged { focado = it.isFocused }
                                        .focusable()
                                        .selectable(selected = escolhido, enabled = ativo && selecionado >= 0, role = Role.RadioButton) {
                                            if (escolhido) assigned.remove(selecionado) else assigned[selecionado] = kart
                                        },
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(kart, color = if (ativo) Cor.Texto else Cor.Secundario, fontSize = 22.sp, fontWeight = FontWeight.Black)
                                        when {
                                            escolhido -> Row(verticalAlignment = Alignment.CenterVertically) {
                                                Icon(Icons.Rounded.Check, null, tint = Color.White, modifier = Modifier.size(12.dp))
                                                Text("escolhido", color = Color.White, fontSize = 12.sp)
                                            }
                                            dono != null -> Text(
                                                nomeDono?.substringAfterLast(' ')?.takeIf { it.isNotBlank() } ?: "piloto ${dono + 1}",
                                                color = Cor.Secundario,
                                                fontSize = 11.sp,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis,
                                            )
                                            else -> Text("livre", color = Cor.VerdeTexto, fontSize = 12.sp)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if (largo) Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                pilotosPainel(Modifier.weight(1.2f))
                kartsPainel(Modifier.weight(0.9f))
            } else Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                pilotosPainel(Modifier.height(painelPilotosAltura))
                kartsPainel(Modifier.height(painelKartsAltura))
            }
        }

        Spacer(Modifier.height(12.dp))
        if (!podeConcluir) Aviso(
            when {
                info.pilotos.any { pesos[it.indice] == null } -> "Informe o peso de cada piloto para calcular o lastro."
                else -> "Selecione um kart para cada piloto."
            },
        )
        Spacer(Modifier.height(10.dp))
        BarraAcao {
            Selo("${assigned.size}/${info.pilotos.size} karts · peças 5 kg + 2,5 kg", fundo = Cor.Cartao, textoCor = Cor.Secundario)
            BotaoPrincipal("Conferir escalação", {
                val resultado = info.pilotos.map { p ->
                    val atualizado = p.copy(pesoKg = pesos[p.indice])
                    Sorteado(atualizado, assigned[p.indice]!!, false, calcularLastro(pesos[p.indice], frota))
                }
        apagarRascunhoFiscal(contexto, rascunhoChave)
        onConcluir(resultado)
            }, habilitado = podeConcluir, icone = Icons.Rounded.Scale)
        }
      }
    }

    editarPeso?.let { indice ->
        DialogoPeso(
            piloto = info.pilotos.first { it.indice == indice },
            inicial = pesos[indice],
            onCancelar = { editarPeso = null },
            onSalvar = { peso -> if (peso == null) pesos.remove(indice) else pesos[indice] = peso; editarPeso = null },
        )
    }

    if (confirmarSaida) AlertDialog(
        onDismissRequest = { confirmarSaida = false },
        title = { Text("Descartar escalação?") },
        text = { Text("Há pilotos ou pesos conferidos nesta bateria. Se sair agora, essa escalação será perdida.") },
        confirmButton = {
            TextButton(onClick = { confirmarSaida = false; apagarRascunhoFiscal(contexto, rascunhoChave); onVoltar() }) { Text("Sair", fontWeight = FontWeight.Bold) }
        },
        dismissButton = { TextButton(onClick = { confirmarSaida = false }) { Text("Continuar") } },
    )
}

@Composable
private fun PilotoFiscal(
    piloto: Piloto,
    plano: PlanoLastro?,
    kart: String?,
    selecionado: Boolean,
    onSelecionar: () -> Unit,
    onEditarPeso: () -> Unit,
) {
    var focado by remember(piloto.indice) { mutableStateOf(false) }
    Cartao(
        Modifier.fillMaxWidth().onFocusChanged { focado = it.isFocused }.semantics {
            contentDescription = "Piloto ${piloto.nome}, " + (if (selecionado) "selecionado" else "não selecionado") + ". " +
                (kart?.let { "kart $it" } ?: "kart pendente")
            stateDescription = if (selecionado) "Selecionado" else "Não selecionado"
        }.selectable(selected = selecionado, onClick = onSelecionar, role = Role.RadioButton),
        padding = 14.dp,
        fundo = if (selecionado) Cor.VerdeSelecao else Cor.Cartao,
        borda = if (focado || selecionado) Cor.BordaFoco else Cor.Borda,
        espessuraBorda = if (focado || selecionado) 2.dp else 1.dp,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(38.dp).clip(RoundedCornerShape(11.dp)).background(if (selecionado) Cor.Verde else Cor.VerdeClaro), contentAlignment = Alignment.Center) {
                Text((piloto.indice + 1).toString(), color = if (selecionado) Color.White else Cor.VerdeTextoSuave, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(piloto.nome, color = Cor.Texto, fontSize = 16.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(if (piloto.pesoKg == null) "Peso pendente" else "${formatarKg(piloto.pesoKg)} kg", color = if (piloto.pesoKg == null) Cor.Amarelo else Cor.Secundario, fontSize = 13.sp)
                    TextButton(onClick = onEditarPeso) {
                        Icon(Icons.Rounded.Edit, "Editar peso", Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Editar", fontSize = 12.sp)
                    }
                }
                Text(
                    when {
                        plano == null -> "Informe o peso para calcular o lastro"
                        plano.lastroKg <= 0.0 -> "Sem lastro · ${formatarKg(plano.pesoFinal)} kg final"
                        else -> "Lastro ${plano.descricaoPecas()} · ${formatarKg(plano.pesoFinal)} kg final"
                    },
                    color = if (plano == null) Cor.Amarelo else Cor.VerdeTextoSuave, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                )
            }
            if (kart != null) PlacaKart(kart, 18.sp, 58.dp, 44.dp)
            else Selo("Escolher kart", fundo = Cor.CartaoElevado, textoCor = Cor.Secundario)
        }
    }
}

@Composable
private fun DialogoPeso(
    piloto: Piloto,
    inicial: Double?,
    onCancelar: () -> Unit,
    onSalvar: (Double?) -> Unit,
) {
    var texto by remember(piloto.indice, inicial) { mutableStateOf(inicial?.let(::formatarKg) ?: "") }
    var erro by remember(piloto.indice, inicial) { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Peso de ${piloto.nome}", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Informe o peso conferido pelo fiscal. A meta será completada com peças de 5 kg e 2,5 kg.", color = Cor.Secundario, fontSize = 14.sp)
                OutlinedTextField(
                    value = texto,
                    onValueChange = { texto = it; erro = null },
                    label = { Text("Peso em kg") },
                    suffix = { Text("kg") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    isError = erro != null,
                )
                erro?.let { Text(it, color = Cor.Vermelho, fontSize = 13.sp) }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val valor = texto.replace(',', '.').trim().toDoubleOrNull()
                if (valor == null || valor !in 20.0..250.0) erro = "Digite um peso entre 20 e 250 kg."
                else onSalvar(valor)
            }) { Text("Salvar", fontWeight = FontWeight.Bold) }
        },
        dismissButton = { TextButton(onClick = onCancelar) { Text("Cancelar") } },
    )
}

fun formatarKg(valor: Double): String = if (valor % 1.0 == 0.0) "${valor.toInt()}" else String.format(Locale("pt", "BR"), "%.1f", valor)
