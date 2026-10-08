package br.com.kartodromobetim.sorteio

import android.os.Bundle
import android.graphics.Color as AndroidColor
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
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
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = AndroidColor.rgb(11, 18, 20)
        window.navigationBarColor = AndroidColor.rgb(11, 18, 20)
        if (android.os.Build.VERSION.SDK_INT >= 29) {
            window.isStatusBarContrastEnforced = false
            window.isNavigationBarContrastEnforced = false
        }
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        val prefs = Preferencias(this)
        val api = Api({ prefs.servidor }, { prefs.chave })
        setContent { TemaSorteio { App(api, prefs) } }
    }
}

private sealed interface Tela {
    data object Baterias : Tela
    data class Preparar(val id: String) : Tela
    data class Fiscal(
        val info: InfoSorteio,
        val karts: List<String>,
        val frota: Frota,
        val inicial: List<Sorteado> = emptyList(),
    ) : Tela
    data class Sortear(val info: InfoSorteio, val karts: List<String>, val umAUm: Boolean) : Tela
    data class Resultado(
        val info: InfoSorteio,
        val karts: List<String>,
        val umAUm: Boolean,
        val resultado: List<Sorteado>,
        val gravado: Boolean = false,
        val gravadoEm: Long? = null,
        val modo: String? = null,
        val frota: Frota? = null,
    ) : Tela
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
            is Tela.Fiscal -> tela = Tela.Preparar(t.info.bateria.id)
            is Tela.Resultado -> if (t.gravado) tela = Tela.Baterias else sairDoSorteio = true
            is Tela.Sortear -> sairDoSorteio = true
            Tela.Baterias -> Unit
        }
    }

    when (val t = tela) {
        Tela.Baterias -> TelaBaterias(api, prefs) { tela = Tela.Preparar(it) }
        is Tela.Preparar -> TelaPreparar(
            api, prefs, t.id, onVoltar = { tela = Tela.Baterias },
            onComecar = { info, karts, umAUm -> rodada++; tela = Tela.Sortear(info, karts, umAUm) },
            onFiscal = { info, karts, frota -> tela = Tela.Fiscal(info, karts, frota) },
        )
        is Tela.Fiscal -> TelaFiscal(t.info, t.karts, t.frota, inicial = t.inicial, onVoltar = {
            tela = if (t.inicial.isNotEmpty()) {
                Tela.Resultado(t.info, t.karts, false, t.inicial, modo = "fiscal", frota = t.frota)
            } else {
                Tela.Preparar(t.info.bateria.id)
            }
        }) { resultado ->
            tela = Tela.Resultado(t.info, t.karts, false, resultado, modo = "fiscal", frota = t.frota)
        }
        is Tela.Sortear -> key(rodada) {
            TelaSortear(t.info, t.karts, t.umAUm, prefs, sorteador) { tela = Tela.Resultado(t.info, t.karts, t.umAUm, it) }
        }
        is Tela.Resultado -> TelaResultado(
            api, t.info, t.resultado, t.umAUm, t.gravado, t.gravadoEm,
            modo = t.modo,
            onGravado = { momento -> tela = t.copy(gravado = true, gravadoEm = momento) },
            onSortearDeNovo = { rodada++; tela = Tela.Sortear(t.info, t.karts, t.umAUm) },
            onEditarManual = if (t.modo == "fiscal") ({ tela = Tela.Fiscal(t.info, t.karts, t.frota ?: Frota.da(t.info.tipoKart), t.resultado) }) else null,
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
