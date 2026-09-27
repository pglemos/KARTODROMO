package br.com.kartodromobetim.sorteio

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.CloudUpload
import androidx.compose.material.icons.rounded.Replay
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Passo 4: conferir e gravar na cronometragem. */
@Composable
fun TelaResultado(
    api: Api,
    info: InfoSorteio,
    resultado: List<Sorteado>,
    umAUm: Boolean,
    gravado: Boolean,
    onGravado: () -> Unit,
    onSortearDeNovo: () -> Unit,
    onFim: () -> Unit,
) {
    val ctx = LocalContext.current
    val escopo = rememberCoroutineScope()
    var porKart by remember { mutableStateOf(true) }
    var gravando by remember { mutableStateOf(false) }
    var erro by remember { mutableStateOf<String?>(null) }
    var confirmarRefazer by remember { mutableStateOf(false) }
    val ordenado = if (porKart) resultado.sortedBy { it.kart.toIntOrNull() ?: Int.MAX_VALUE } else resultado.sortedBy { it.piloto.nome.lowercase() }

    Column(Modifier.fillMaxSize().padding(horizontal = 28.dp, vertical = 20.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Titulo("Resultado do sorteio", "${info.bateria.nome} · ${resultado.size} pilotos · ${if (umAUm) "um a um" else "todos de uma vez"}")
            }
            Segmento(listOf("Por kart", "Por nome"), if (porKart) 0 else 1, { porKart = it == 0 }, Modifier.width(260.dp))
        }
        Spacer(Modifier.height(16.dp))
        if (gravado) {
            Cartao(Modifier.fillMaxWidth(), padding = 16.dp) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.CheckCircle, null, tint = Cor.Verde, modifier = Modifier.size(28.dp))
                    Spacer(Modifier.width(12.dp))
                    Text(
                        "Gravado na cronometragem às ${SimpleDateFormat("HH:mm", Locale("pt", "BR")).format(Date())}. " +
                            (if (info.bateria.programaIrmas.size > 1) "Vale para ${info.bateria.programaIrmas.joinToString(" e ")}." else "A cronometragem já mostra os karts."),
                        fontSize = 16.sp, color = Cor.Texto, fontWeight = FontWeight.Medium,
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
        }
        if (resultado.any { it.repetiu }) { Aviso("Não havia kart novo para todos: quem está marcado repetiu um kart que já tinha usado."); Spacer(Modifier.height(12.dp)) }
        erro?.let { Aviso(it, erro = true); Spacer(Modifier.height(12.dp)) }

        LazyVerticalGrid(GridCells.Adaptive(340.dp), Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(ordenado, key = { it.piloto.indice }) { s ->
                Cartao(Modifier.fillMaxWidth(), padding = 14.dp) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        PlacaKart(s.kart, 22.sp, 64.dp, 48.dp)
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Text(s.piloto.nome, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            val extra = listOfNotNull(s.piloto.pesoKg?.let { "${"%.0f".format(it)} kg" }, if (s.repetiu) "repetiu o kart" else null)
                            if (extra.isNotEmpty()) Text(extra.joinToString(" · "), fontSize = 13.sp, color = if (s.repetiu) Cor.Amarelo else Cor.Secundario)
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            BotaoSecundario("Compartilhar", {
                val texto = buildString {
                    appendLine("Sorteio de karts · ${info.bateria.nome}")
                    ordenado.forEach { appendLine("Kart ${it.kart} — ${it.piloto.nome}") }
                }
                ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, texto), "Compartilhar sorteio"))
            }, icone = Icons.Rounded.Share)
            if (!gravado) BotaoSecundario("Sortear de novo", { confirmarRefazer = true }, icone = Icons.Rounded.Replay)
            Spacer(Modifier.weight(1f))
            if (gravando) CircularProgressIndicator(Modifier.size(32.dp))
            else if (gravado) BotaoPrincipal("Voltar às baterias", onFim)
            else BotaoPrincipal("Gravar na cronometragem", {
                gravando = true
                erro = null
                escopo.launch {
                    try { api.gravar(info.bateria.id, resultado, umAUm); onGravado() } catch (e: ErroServidor) { erro = e.message } finally { gravando = false }
                }
            }, icone = Icons.Rounded.CloudUpload)
        }
    }

    if (confirmarRefazer) AlertDialog(
        onDismissRequest = { confirmarRefazer = false },
        title = { Text("Sortear de novo?") },
        text = { Text("Este resultado ainda não foi gravado e será descartado.") },
        confirmButton = { TextButton(onClick = { confirmarRefazer = false; onSortearDeNovo() }) { Text("Sortear de novo", fontWeight = FontWeight.Bold) } },
        dismissButton = { TextButton(onClick = { confirmarRefazer = false }) { Text("Cancelar") } },
    )
}
