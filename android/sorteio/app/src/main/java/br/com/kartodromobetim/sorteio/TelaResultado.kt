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
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.ui.graphics.Color
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
    gravadoEm: Long? = null,
    modo: String? = null,
    onGravado: (Long?) -> Unit,
    onSortearDeNovo: () -> Unit,
    onEditarManual: (() -> Unit)? = null,
    onFim: () -> Unit,
) {
    val ctx = LocalContext.current
    val escopo = rememberCoroutineScope()
    var porKart by remember { mutableStateOf(true) }
    var gravando by remember { mutableStateOf(false) }
    var erro by remember { mutableStateOf<String?>(null) }
    var confirmarRefazer by remember { mutableStateOf(false) }
    var confirmarSaida by remember { mutableStateOf(false) }
    val ordenado = if (porKart) resultado.sortedBy { it.kart.toIntOrNull() ?: Int.MAX_VALUE } else resultado.sortedBy { it.piloto.nome.lowercase() }

    fun gravarAgora() {
        if (gravando) return
        gravando = true
        erro = null
        escopo.launch {
            try { onGravado(api.gravar(info.bateria.id, resultado, umAUm, modo)) } catch (e: ErroServidor) { erro = e.message } finally { gravando = false }
        }
    }

    FundoCinematografico(FundoApp.CHECKERED) {
      Column(Modifier.fillMaxSize().padding(horizontal = 24.dp, vertical = 18.dp)) {
        CabecalhoTela(
            "Resultado da escalação",
            "${info.bateria.nome} · ${resultado.size} pilotos · ${modo ?: if (umAUm) "um a um" else "todos de uma vez"}",
            onVoltar = { if (gravado) onFim() else confirmarSaida = true },
        ) {
            BotaoAjuda(
                "Como conferir o resultado",
                "Por kart agrupa a grade para a largada. Por nome facilita chamar cada piloto. No modo fiscal, confira o peso, as peças de 5 kg e 2,5 kg e o peso final antes de gravar na cronometragem.",
            )
        }
        Spacer(Modifier.height(10.dp))
        Acoes {
            Segmento(listOf("Por kart", "Por nome"), if (porKart) 0 else 1, { porKart = it == 0 }, Modifier.width(260.dp))
        }
        Spacer(Modifier.height(6.dp))
        Etapa("04", "GRID DEFINIDO", if (gravado) "Resultado confirmado na cronometragem." else "Confira e grave para concluir o sorteio.")
        Spacer(Modifier.height(10.dp))
        Acoes {
            Selo("${resultado.size} pilotos", fundo = Cor.CartaoElevado, textoCor = Cor.Secundario)
            Selo("${resultado.map { it.kart }.distinct().size} karts", fundo = Cor.CartaoElevado, textoCor = Cor.Secundario)
            Selo(
                if (modo == "fiscal") "FISCAL · LASTRO" else "SORTEIO AUTOMÁTICO",
                fundo = Cor.VerdeClaro,
                textoCor = Cor.VerdeTexto,
            )
        }
        if (gravado) {
            val horario = gravadoEm?.let { SimpleDateFormat("HH:mm", Locale("pt", "BR")).format(Date(it)) }
            Cartao(Modifier.fillMaxWidth(), padding = 16.dp, fundo = Cor.CartaoElevado) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.CheckCircle, null, tint = Cor.Verde, modifier = Modifier.size(28.dp))
                    Spacer(Modifier.width(12.dp))
                    Text(
                        "Gravado na cronometragem${horario?.let { " às $it" } ?: ""}. " +
                            (if (info.bateria.programaIrmas.size > 1) "Vale para ${info.bateria.programaIrmas.joinToString(" e ")}." else "A cronometragem já mostra os karts."),
                        fontSize = 16.sp, color = Cor.Texto, fontWeight = FontWeight.Medium,
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
        }
        if (resultado.any { it.repetiu }) { Aviso("Não havia kart novo para todos: quem está marcado repetiu um kart que já tinha usado."); Spacer(Modifier.height(12.dp)) }
        erro?.let {
            Aviso(it, erro = true, acaoTexto = "Tentar novamente", onAcao = ::gravarAgora)
            Spacer(Modifier.height(12.dp))
        }

        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val colunas = when {
                maxWidth >= 1100.dp -> 3
                maxWidth >= 700.dp -> 2
                else -> 1
            }
            LazyVerticalGrid(GridCells.Fixed(colunas), Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                items(ordenado, key = { it.piloto.indice }) { s ->
                    Cartao(Modifier.fillMaxWidth(), padding = 14.dp, fundo = Cor.CartaoElevado) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            PlacaKart(s.kart, 22.sp, 64.dp, 48.dp)
                            Spacer(Modifier.width(14.dp))
                            Column(Modifier.weight(1f)) {
                                Text(s.piloto.nome, fontSize = 17.sp, lineHeight = 21.sp, fontWeight = FontWeight.SemiBold, maxLines = 3, overflow = TextOverflow.Ellipsis)
                                val extra = listOfNotNull(
                                    s.piloto.pesoKg?.let { "${formatarKg(it)} kg" },
                                    s.planoLastro?.let { "lastro ${it.descricaoPecas()} · final ${formatarKg(it.pesoFinal)} kg" },
                                    if (s.repetiu) "repetiu o kart" else null,
                                )
                                if (extra.isNotEmpty()) Text(extra.joinToString(" · "), fontSize = 13.sp, lineHeight = 18.sp, color = if (s.repetiu) Cor.Amarelo else Cor.Secundario, maxLines = 3, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(16.dp))
        BarraAcao {
            BotaoSecundario("Compartilhar", {
                val texto = buildString {
                    appendLine("Sorteio de karts · ${info.bateria.nome}")
                    ordenado.forEach {
                        val lastro = it.planoLastro?.let { plano -> " · lastro ${plano.descricaoPecas()} · ${formatarKg(plano.pesoFinal)} kg" } ?: ""
                        appendLine("Kart ${it.kart} — ${it.piloto.nome}$lastro")
                    }
                }
                ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, texto), "Compartilhar sorteio"))
            }, icone = Icons.Rounded.Share)
            if (!gravado) {
                if (modo == "fiscal") BotaoSecundario("Editar escalação", onEditarManual ?: {}, icone = Icons.Rounded.Replay, habilitado = !gravando)
                else BotaoSecundario("Sortear de novo", { confirmarRefazer = true }, icone = Icons.Rounded.Replay, habilitado = !gravando)
            }
            if (gravando) CircularProgressIndicator(Modifier.size(32.dp))
            else if (gravado) BotaoPrincipal("Voltar às baterias", onFim)
            else BotaoPrincipal("Gravar na cronometragem", ::gravarAgora, icone = Icons.Rounded.CloudUpload)
        }
      }
    }

    if (confirmarRefazer) AlertDialog(
        onDismissRequest = { confirmarRefazer = false },
        title = { Text("Sortear de novo?") },
        text = { Text("Este resultado ainda não foi gravado e será descartado.") },
        confirmButton = { TextButton(onClick = { confirmarRefazer = false; onSortearDeNovo() }) { Text("Sortear de novo", fontWeight = FontWeight.Bold) } },
        dismissButton = { TextButton(onClick = { confirmarRefazer = false }) { Text("Cancelar") } },
    )

    if (confirmarSaida) AlertDialog(
        onDismissRequest = { confirmarSaida = false },
        title = { Text("Sair sem gravar?") },
        text = { Text("O resultado ainda não foi gravado na cronometragem e será descartado.") },
        confirmButton = {
            TextButton(onClick = { confirmarSaida = false; onFim() }) { Text("Sair", fontWeight = FontWeight.Bold) }
        },
        dismissButton = { TextButton(onClick = { confirmarSaida = false }) { Text("Continuar") } },
    )
}
