package br.com.kartodromobetim.sorteio

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.font.FontWeight

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // o tablet fica aceso durante o sorteio
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val prefs = Preferencias(this)
        val api = Api { prefs.servidor }
        setContent { TemaSorteio { App(api, prefs) } }
    }
}

private sealed interface Tela {
    data object Baterias : Tela
    data class Preparar(val id: String) : Tela
    data class Sortear(val info: InfoSorteio, val karts: List<String>, val umAUm: Boolean) : Tela
    data class Resultado(val info: InfoSorteio, val karts: List<String>, val umAUm: Boolean, val resultado: List<Sorteado>, val gravado: Boolean = false) : Tela
}

@Composable
private fun App(api: Api, prefs: Preferencias) {
    val sorteador = remember { Sorteador() }
    var tela by remember { mutableStateOf<Tela>(Tela.Baterias) }
    var rodada by remember { mutableIntStateOf(0) }
    var sairDoSorteio by remember { mutableStateOf(false) }

    BackHandler(enabled = tela != Tela.Baterias) {
        when (val t = tela) {
            is Tela.Preparar -> tela = Tela.Baterias
            is Tela.Resultado -> if (t.gravado) tela = Tela.Baterias else sairDoSorteio = true
            is Tela.Sortear -> sairDoSorteio = true
            Tela.Baterias -> Unit
        }
    }

    when (val t = tela) {
        Tela.Baterias -> TelaBaterias(api, prefs) { tela = Tela.Preparar(it) }
        is Tela.Preparar -> TelaPreparar(api, prefs, t.id, onVoltar = { tela = Tela.Baterias }) { info, karts, umAUm ->
            rodada++
            tela = Tela.Sortear(info, karts, umAUm)
        }
        is Tela.Sortear -> key(rodada) {
            TelaSortear(t.info, t.karts, t.umAUm, prefs, sorteador) { tela = Tela.Resultado(t.info, t.karts, t.umAUm, it) }
        }
        is Tela.Resultado -> TelaResultado(
            api, t.info, t.resultado, t.umAUm, t.gravado,
            onGravado = { tela = t.copy(gravado = true) },
            onSortearDeNovo = { rodada++; tela = Tela.Sortear(t.info, t.karts, t.umAUm) },
            onFim = { tela = Tela.Baterias },
        )
    }

    if (sairDoSorteio) AlertDialog(
        onDismissRequest = { sairDoSorteio = false },
        title = { Text("Sair do sorteio?") },
        text = { Text("O resultado ainda não foi gravado na cronometragem e será descartado.") },
        confirmButton = {
            TextButton(onClick = {
                sairDoSorteio = false
                tela = when (val x = tela) { is Tela.Sortear -> Tela.Preparar(x.info.bateria.id); is Tela.Resultado -> Tela.Preparar(x.info.bateria.id); else -> Tela.Baterias }
            }) { Text("Sair", fontWeight = FontWeight.Bold) }
        },
        dismissButton = { TextButton(onClick = { sairDoSorteio = false }) { Text("Continuar") } },
    )
}
