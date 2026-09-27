package br.com.kartodromobetim.sorteio

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Casino
import androidx.compose.material.icons.automirrored.rounded.EventNote
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val hora = SimpleDateFormat("HH:mm", Locale("pt", "BR"))

@Composable
fun TelaBaterias(api: Api, prefs: Preferencias, onSortear: (String) -> Unit) {
    val escopo = rememberCoroutineScope()
    var baterias by remember { mutableStateOf<List<Bateria>?>(null) }
    var agenda by remember { mutableStateOf<List<BateriaAgenda>?>(null) }
    var erro by remember { mutableStateOf<String?>(null) }
    var erroAgenda by remember { mutableStateOf<String?>(null) }
    var carregando by remember { mutableStateOf(false) }
    var preparando by remember { mutableStateOf<Long?>(null) }
    var config by remember { mutableStateOf(false) }
    var recarregar by remember { mutableIntStateOf(0) }

    LaunchedEffect(recarregar) {
        carregando = true
        erro = null
        try { baterias = api.baterias() } catch (e: ErroServidor) { erro = e.message; baterias = null }
        erroAgenda = null
        try { agenda = api.agendaDeHoje() } catch (e: ErroServidor) { erroAgenda = e.message; agenda = null }
        carregando = false
    }

    Column(Modifier.fillMaxSize().padding(horizontal = 28.dp, vertical = 20.dp)) {
        // topo
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(52.dp).clip(RoundedCornerShape(14.dp)).background(Brush.linearGradient(listOf(Cor.VerdeVivo, Cor.Verde))),
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.Rounded.Casino, null, tint = Color.White, modifier = Modifier.size(30.dp)) }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text("Sorteio de Karts", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = Cor.Texto)
                Text("Kartódromo Internacional de Betim · escolha a bateria para sortear os karts", fontSize = 14.sp, color = Cor.Secundario)
            }
            if (carregando) CircularProgressIndicator(Modifier.size(28.dp), strokeWidth = 3.dp)
            IconButton(onClick = { recarregar++ }) { Icon(Icons.Rounded.Refresh, "Atualizar", tint = Cor.Texto) }
            IconButton(onClick = { config = true }) { Icon(Icons.Rounded.Settings, "Configurações", tint = Cor.Texto) }
        }
        Spacer(Modifier.height(20.dp))
        erro?.let { Aviso(it, erro = true); Spacer(Modifier.height(16.dp)) }

        BoxWithConstraints(Modifier.fillMaxSize()) {
            val largo = maxWidth > 820.dp
            val prontas: @Composable (Modifier) -> Unit = { m ->
                Coluna(m, "Prontas para sortear", "Baterias criadas na cronometragem que ainda não largaram") {
                    val lista = baterias.orEmpty()
                    if (baterias != null && lista.isEmpty()) Vazio("Nenhuma bateria esperando sorteio.\nPrepare uma da agenda ao lado ou crie na cronometragem.")
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
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
                            ) { onSortear(b.id) }
                        }
                    }
                }
            }
            val daAgenda: @Composable (Modifier) -> Unit = { m ->
                Coluna(m, "Agenda de hoje", "Baterias da recepção com inscritos") {
                    erroAgenda?.let { Aviso(it) }
                    val prontasNomes = baterias.orEmpty().map { it.nome.trim().lowercase() }.toSet()
                    val prontasIds = baterias.orEmpty().mapNotNull { it.agendaId }.toSet()
                    val lista = agenda.orEmpty().filter { it.inscritos > 0 }.sortedBy { it.inicio }
                    if (agenda != null && lista.isEmpty()) Vazio("Nenhuma bateria com inscritos hoje.")
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
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
                                habilitado = !jaPronta && preparando == null,
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
            else Column(verticalArrangement = Arrangement.spacedBy(20.dp)) { prontas(Modifier.weight(1f)); daAgenda(Modifier.weight(1f)) }
        }
    }

    if (config) DialogoConfig(api, prefs) { config = false; recarregar++ }
}

@Composable
private fun Coluna(modifier: Modifier, titulo: String, sub: String, conteudo: @Composable () -> Unit) {
    Column(modifier.fillMaxSize()) {
        Titulo(titulo, sub)
        Spacer(Modifier.height(14.dp))
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { conteudo() }
    }
}

@Composable
private fun Vazio(texto: String) {
    Cartao(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.AutoMirrored.Rounded.EventNote, null, tint = Cor.Secundario)
            Spacer(Modifier.width(12.dp))
            Text(texto, color = Cor.Secundario, fontSize = 15.sp)
        }
    }
}

@Composable
private fun CartaoBateria(titulo: String, detalhe: String, acao: String, principal: Boolean, habilitado: Boolean = true, ocupado: Boolean = false, onClick: () -> Unit) {
    Cartao(Modifier.fillMaxWidth(), padding = 18.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(titulo, fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Cor.Texto)
                Spacer(Modifier.height(2.dp))
                Text(detalhe, fontSize = 14.sp, color = Cor.Secundario)
            }
            Spacer(Modifier.width(12.dp))
            if (ocupado) CircularProgressIndicator(Modifier.size(28.dp), strokeWidth = 3.dp)
            else if (principal) BotaoPrincipal(acao, onClick, icone = Icons.Rounded.Casino, habilitado = habilitado)
            else BotaoSecundario(acao, onClick, habilitado = habilitado)
        }
    }
}

@Composable
private fun DialogoConfig(api: Api, prefs: Preferencias, onFechar: () -> Unit) {
    val escopo = rememberCoroutineScope()
    var servidor by remember { mutableStateOf(prefs.servidor) }
    var recusas by remember { mutableIntStateOf(prefs.recusas) }
    var segundos by remember { mutableIntStateOf(prefs.segundos) }
    var animacao by remember { mutableStateOf(prefs.animacao) }
    var teste by remember { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = onFechar,
        title = { Text("Configurações do sorteio", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                OutlinedTextField(
                    servidor, { servidor = it; teste = null }, label = { Text("Endereço da cronometragem") },
                    singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri), modifier = Modifier.fillMaxWidth(),
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = {
                        teste = "Testando…"
                        val anterior = prefs.servidor
                        prefs.servidor = servidor
                        escopo.launch {
                            teste = try { if (api.testar()) "Conectado à cronometragem." else "A cronometragem respondeu, mas não está pronta." } catch (e: ErroServidor) { e.message }
                            if (teste != "Conectado à cronometragem.") prefs.servidor = anterior
                        }
                    }) { Text("Testar conexão") }
                    teste?.let { Text(it, fontSize = 14.sp, color = if (it.startsWith("Conectado")) Cor.Verde else Cor.Secundario) }
                }
                Contador("Recusas por piloto no modo um a um", recusas, 0..5, { recusas = it }, if (recusas == 0) "o piloto não pode recusar" else null)
                if (recusas > 0) Contador("Segundos para aceitar sozinho", segundos, 3..60, { segundos = it })
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Animação da roleta", Modifier.weight(1f), fontSize = 15.sp)
                    Switch(animacao, { animacao = it })
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                prefs.servidor = servidor; prefs.recusas = recusas; prefs.segundos = segundos; prefs.animacao = animacao
                onFechar()
            }) { Text("Salvar", fontWeight = FontWeight.Bold) }
        },
        dismissButton = { TextButton(onClick = onFechar) { Text("Cancelar") } },
    )
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
