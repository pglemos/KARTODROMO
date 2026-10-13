package br.com.kartodromobetim.sorteio

import br.com.kartodromobetim.sorteio.design.Tokens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.Image
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.Typography
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.HelpOutline
import androidx.compose.material.icons.rounded.MenuBook
import androidx.compose.material3.TextButton
import androidx.compose.ui.text.TextStyle
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRowScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

/**
 * Cores do tablet = tema ESCURO oficial (tokens/kib.tokens.json → design/Tokens.kt). Fase 7 do design system (09/10/2026):
 * o verde próprio (#087F5B) virou o neon da marca; texto sobre o verde é escuro (Cor.SobreVerde), como no site e no totem.
 */
object Cor {
    val Verde = Tokens.Escuro.CorAcaoPrincipal
    val VerdeVivo = Tokens.Escuro.CorAcaoPrincipal
    val VerdePressionado = Tokens.Escuro.CorAcaoPrincipalPressionado
    val SobreVerde = Tokens.Escuro.CorAcaoSobrePrincipal
    val VerdeClaro = Tokens.Escuro.CorEstadoSucessoFundo
    val VerdeSuave = Tokens.Escuro.CorSelecaoFundo
    val Fundo = Tokens.Escuro.CorFundoApp
    val Cartao = Tokens.Escuro.CorSuperficiePadrao
    val CartaoElevado = Tokens.Escuro.CorSuperficieCampo
    val Texto = Tokens.Escuro.CorTextoPrincipal
    val Secundario = Tokens.Escuro.CorTextoSecundario
    val Borda = Tokens.Escuro.CorBordaSutil
    val BordaForte = Tokens.Escuro.CorBordaForte
    val BordaFoco = Tokens.Escuro.CorBordaFoco
    val VerdeTexto = Tokens.Escuro.CorEstadoSucessoTexto
    val VerdeTextoSuave = Tokens.Escuro.CorEstadoSucessoTexto
    val VerdeSelecao = Tokens.Escuro.CorSelecaoFundo
    val VerdeBorda = Tokens.Escuro.CorAcaoPrincipal
    val TextoDesativado = Tokens.Escuro.CorTextoTerciario
    val Palco = Tokens.Escuro.CorSuperficieLateral
    val PalcoCartao = Tokens.Escuro.CorSuperficiePadrao
    val Amarelo = Tokens.Escuro.CorEstadoAvisoTexto
    val AmareloClaro = Tokens.Escuro.CorEstadoAvisoFundo
    val Vermelho = Tokens.Escuro.CorEstadoPerigoTexto
    val VermelhoClaro = Tokens.Escuro.CorEstadoPerigoFundo
    val Vidro = Tokens.Escuro.CorSuperficiePadrao.copy(alpha = 0.8f)
    val VidroLeve = Tokens.Escuro.CorSuperficiePadrao.copy(alpha = 0.5f)
    val IconeSurface = Tokens.Escuro.CorSuperficieCampo.copy(alpha = 0.6f)
}

enum class FundoApp { PIT_LANE, LIVE_TRACK, CHECKERED }

@Composable
fun TemaSorteio(conteudo: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Cor.Verde, onPrimary = Cor.SobreVerde, background = Cor.Fundo, surface = Cor.Cartao,
            onSurface = Cor.Texto, onBackground = Cor.Texto, secondary = Cor.Secundario, error = Cor.Vermelho,
            primaryContainer = Cor.VerdeClaro, onPrimaryContainer = Cor.VerdeTexto,
            surfaceVariant = Cor.CartaoElevado, onSurfaceVariant = Cor.Secundario, outline = Cor.Borda,
        ),
        typography = Typography(
            bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 24.sp),
            bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 21.sp),
            labelLarge = TextStyle(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold),
        ),
    ) {
        Surface(color = Cor.Fundo) {
            Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.systemBars)) { conteudo() }
        }
    }
}

/** Fundo único do app: fotografia escura, véu de leitura e uma linha de verde para guiar o olhar. */
@Composable
fun FundoCinematografico(
    tipo: FundoApp = FundoApp.PIT_LANE,
    modifier: Modifier = Modifier,
    conteudo: @Composable androidx.compose.foundation.layout.BoxScope.() -> Unit,
) {
    val imagem = when (tipo) {
        FundoApp.PIT_LANE -> R.drawable.bg_pit_lane
        FundoApp.LIVE_TRACK -> R.drawable.bg_live_track
        FundoApp.CHECKERED -> R.drawable.bg_checkered_result
    }
    Box(modifier.fillMaxSize().background(Cor.Fundo)) {
        Image(
            painter = painterResource(imagem),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.matchParentSize().alpha(if (tipo == FundoApp.LIVE_TRACK) 0.58f else 0.42f),
        )
        Box(
            Modifier.matchParentSize().background(
                Brush.horizontalGradient(
                    listOf(Cor.Fundo.copy(alpha = 0.98f), Cor.Fundo.copy(alpha = 0.83f), Cor.Fundo.copy(alpha = 0.56f)),
                ),
            ),
        )
        Box(
            Modifier.matchParentSize().background(
                Brush.verticalGradient(
                    listOf(Cor.Fundo.copy(alpha = 0.34f), Color.Transparent, Cor.Fundo.copy(alpha = 0.76f)),
                ),
            ),
        )
        Box(Modifier.matchParentSize().background(Brush.radialGradient(listOf(Color(0x3300E676), Color.Transparent), radius = 980f)))
        conteudo()
    }
}

/** Botão de ícone circular usado no cabeçalho, com área de toque ampla e leitura de estado. */
@Composable
fun AcaoCircular(
    descricao: String,
    icone: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    destaque: Boolean = false,
) {
    IconButton(
        onClick = onClick,
        modifier = modifier
            .size(52.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(if (destaque) Cor.Verde.copy(alpha = 0.35f) else Cor.IconeSurface)
            .border(1.dp, if (destaque) Cor.BordaFoco else Cor.Borda, RoundedCornerShape(18.dp)),
    ) { Icon(icone, descricao, tint = if (destaque) Cor.VerdeTexto else Cor.Texto, modifier = Modifier.size(24.dp)) }
}

/** Cartão de superfície única; estados selecionados alteram a borda e o fundo sem criar outro padrão. */
@Composable
fun Cartao(
    modifier: Modifier = Modifier,
    padding: Dp = 20.dp,
    fundo: Color = Cor.Cartao,
    borda: Color = Cor.Borda,
    espessuraBorda: Dp = 1.dp,
    conteudo: @Composable () -> Unit,
) {
    Box(
        modifier
            .clip(RoundedCornerShape(16.dp))
            .background(fundo)
            .border(espessuraBorda, borda, RoundedCornerShape(16.dp))
            .padding(padding),
    ) { conteudo() }
}

/** Número do kart em "tecla", como na cronometragem. */
@Composable
fun PlacaKart(kart: String, tamanho: TextUnit = 18.sp, largura: Dp = 56.dp, altura: Dp = 40.dp, destaque: Boolean = true) {
    Box(
        Modifier
            .size(largura, altura)
            .clip(RoundedCornerShape(10.dp))
            .background(if (destaque) Brush.verticalGradient(listOf(Cor.Verde, Cor.VerdePressionado)) else Brush.verticalGradient(listOf(Cor.Fundo, Cor.Fundo)))
            .border(1.dp, if (destaque) Color(0x33000000) else Cor.Borda, RoundedCornerShape(10.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Text(kart.ifBlank { "—" }, color = if (destaque) Cor.SobreVerde else Cor.Secundario, fontSize = tamanho, fontWeight = FontWeight.Black)
    }
}

@Composable
fun BotaoPrincipal(
    texto: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icone: ImageVector? = null,
    habilitado: Boolean = true,
    cor: Color = Cor.Verde,
    maxLinhas: Int = 1,
    altura: Dp = 52.dp,
) {
    Button(
        onClick = onClick, enabled = habilitado, modifier = modifier.height(altura),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = if (habilitado) cor else Cor.CartaoElevado, contentColor = if (cor == Cor.Verde) Cor.SobreVerde else Color.White, disabledContainerColor = Cor.CartaoElevado, disabledContentColor = Cor.Secundario),
        contentPadding = PaddingValues(horizontal = 20.dp),
    ) {
        if (icone != null) { Icon(icone, null, Modifier.size(20.dp)); Spacer(Modifier.width(8.dp)) }
        Text(texto, fontSize = 16.sp, lineHeight = 20.sp, fontWeight = FontWeight.Bold, maxLines = maxLinhas, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
    }
}

@Composable
fun BotaoSecundario(texto: String, onClick: () -> Unit, modifier: Modifier = Modifier, icone: ImageVector? = null, habilitado: Boolean = true, escuro: Boolean = false) {
    OutlinedButton(
        onClick = onClick, enabled = habilitado, modifier = modifier.height(52.dp),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, if (escuro) Color(0x33FFFFFF) else Cor.Borda),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = if (escuro) Color(0x14FFFFFF) else Cor.Cartao, contentColor = if (escuro) Color.White else Cor.Texto),
        contentPadding = PaddingValues(horizontal = 20.dp),
    ) {
        if (icone != null) { Icon(icone, null, Modifier.size(20.dp)); Spacer(Modifier.width(8.dp)) }
        Text(texto, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** Controle segmentado (pílulas) do design. */
@Composable
fun Segmento(opcoes: List<String>, selecionado: Int, onSelecionar: (Int) -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier.clip(RoundedCornerShape(14.dp)).background(Cor.Fundo).padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        opcoes.forEachIndexed { i, texto ->
            val sel = i == selecionado
            Box(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (sel) Cor.VerdeClaro else Color.Transparent)
                    .semantics {
                        contentDescription = texto
                        stateDescription = if (sel) "Selecionado" else "Não selecionado"
                    }
                    .selectable(selected = sel, onClick = { onSelecionar(i) }, role = Role.Tab)
                    .padding(vertical = 10.dp, horizontal = 10.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(texto, fontSize = 15.sp, fontWeight = if (sel) FontWeight.Bold else FontWeight.Medium, color = if (sel) Cor.Texto else Cor.Secundario, textAlign = TextAlign.Center, maxLines = 1)
            }
        }
    }
}

/** Faixa de aviso (amarela) ou erro (vermelha). */
@Composable
fun Aviso(
    texto: String,
    erro: Boolean = false,
    modifier: Modifier = Modifier,
    acaoTexto: String? = null,
    onAcao: (() -> Unit)? = null,
) {
    Row(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(if (erro) Cor.VermelhoClaro else Cor.AmareloClaro)
            .semantics { liveRegion = LiveRegionMode.Polite }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(if (erro) Icons.Rounded.ErrorOutline else Icons.Rounded.Info, null, tint = if (erro) Cor.Vermelho else Cor.Amarelo, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(10.dp))
        Text(texto, Modifier.weight(1f), color = if (erro) Cor.Vermelho else Cor.Amarelo, fontSize = 14.sp, fontWeight = FontWeight.Medium)
        if (!acaoTexto.isNullOrBlank() && onAcao != null) {
            TextButton(onClick = onAcao) { Text(acaoTexto, fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
fun Titulo(texto: String, sub: String? = null) {
    Row(verticalAlignment = Alignment.Top) {
        Box(
            Modifier.width(4.dp).height(30.dp).clip(RoundedCornerShape(999.dp)).background(Cor.VerdeVivo),
        )
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(texto, fontSize = 24.sp, lineHeight = 29.sp, fontWeight = FontWeight.Bold, color = Cor.Texto, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (sub != null) Text(sub, fontSize = 14.sp, lineHeight = 20.sp, color = Cor.Secundario, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}


/** Actions wrap instead of overflowing when the device is narrow or text is enlarged. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun Acoes(conteudo: @Composable () -> Unit) {
    FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)) { conteudo() }
}

@Composable
fun Etapa(numero: String, titulo: String, detalhe: String) {
    Row(Modifier.fillMaxWidth().padding(bottom = 18.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(38.dp).clip(RoundedCornerShape(10.dp)).background(Cor.VerdeClaro), contentAlignment = Alignment.Center) {
            Text(numero, color = Cor.VerdeTextoSuave, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(titulo, color = Cor.Texto, fontSize = 14.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            Text(detalhe, color = Cor.Secundario, fontSize = 12.sp)
        }
    }
}

/** Cabeçalho de todas as telas internas: voltar, contexto e uma ação opcional. */
@Composable
fun CabecalhoTela(titulo: String, subtitulo: String? = null, onVoltar: () -> Unit, trailing: @Composable () -> Unit = {}) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        androidx.compose.material3.IconButton(
            onClick = onVoltar,
            modifier = Modifier.size(52.dp).clip(RoundedCornerShape(18.dp)).background(Cor.IconeSurface)
                .border(1.dp, Cor.Borda, RoundedCornerShape(18.dp)),
        ) {
            Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Voltar", tint = Cor.Texto)
        }
        Spacer(Modifier.width(4.dp))
        Column(Modifier.weight(1f)) {
            Text(titulo, fontSize = 24.sp, lineHeight = 29.sp, fontWeight = FontWeight.Bold, color = Cor.Texto, maxLines = 1, overflow = TextOverflow.Ellipsis)
            subtitulo?.let { Text(it, fontSize = 13.sp, color = Cor.Secundario, maxLines = 1, overflow = TextOverflow.Ellipsis) }
        }
        trailing()
    }
}

/** Ajuda contextual curta para os termos de operação usados no tablet. */
@Composable
fun BotaoAjuda(titulo: String, texto: String) {
    var aberto by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    AcaoCircular("Ajuda", Icons.Rounded.HelpOutline, onClick = { aberto = true })
    if (aberto) Dialog(
        onDismissRequest = { aberto = false },
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Cartao(
            Modifier.widthIn(max = 720.dp).fillMaxWidth().padding(20.dp),
            padding = 24.dp,
            fundo = Cor.PalcoCartao,
            borda = Cor.Borda,
            espessuraBorda = 1.dp,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier.size(64.dp).clip(RoundedCornerShape(22.dp)).background(Cor.VerdeClaro),
                        contentAlignment = Alignment.Center,
                    ) { Icon(Icons.Rounded.MenuBook, null, tint = Cor.VerdeTexto, modifier = Modifier.size(32.dp)) }
                    Spacer(Modifier.width(16.dp))
                    Text(titulo, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Cor.Texto, modifier = Modifier.weight(1f))
                }
                Text(texto, color = Cor.Secundario, fontSize = 16.sp, lineHeight = 24.sp)
                Spacer(Modifier.height(1.dp).fillMaxWidth().background(Cor.Borda))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    BotaoPrincipal("Entendi", { aberto = false }, modifier = Modifier.width(150.dp), icone = Icons.Rounded.Check)
                }
            }
        }
    }
}

/** Selo curto para estado, meta ou contagem; todos os contextos usam o mesmo tratamento. */
@Composable
fun Selo(texto: String, modifier: Modifier = Modifier, fundo: Color = Cor.VerdeClaro, textoCor: Color = Cor.VerdeTexto, icone: ImageVector? = null) {
    Row(
        modifier.clip(RoundedCornerShape(999.dp)).background(fundo).padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        icone?.let { Icon(it, null, tint = textoCor, modifier = Modifier.size(17.dp)); Spacer(Modifier.width(6.dp)) }
        Text(texto, color = textoCor, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** Rodapé fixo de decisão; separa a ação primária do conteúdo rolável. */
@Composable
fun BarraAcao(conteudo: @Composable () -> Unit) {
    Cartao(Modifier.fillMaxWidth(), padding = 12.dp, fundo = Cor.CartaoElevado) { Acoes { conteudo() } }
}
