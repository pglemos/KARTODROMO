package br.com.kartodromobetim.sorteio

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object Cor {
    val Verde = Color(0xFF0B7A53)
    val VerdeVivo = Color(0xFF12A36F)
    val VerdeClaro = Color(0xFFE2EFEA)
    val Fundo = Color(0xFFF4F5F7)
    val Cartao = Color.White
    val Texto = Color(0xFF14161A)
    val Secundario = Color(0xFF6B7280)
    val Borda = Color(0xFFE5E7EB)
    val Palco = Color(0xFF0E1116)
    val PalcoCartao = Color(0xFF1A1F27)
    val Amarelo = Color(0xFFF5B301)
    val AmareloClaro = Color(0xFFFFF4D6)
    val Vermelho = Color(0xFFD92D20)
    val VermelhoClaro = Color(0xFFFDECEA)
}

@Composable
fun TemaSorteio(conteudo: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Cor.Verde, onPrimary = Color.White, background = Cor.Fundo, surface = Cor.Cartao,
            onSurface = Cor.Texto, onBackground = Cor.Texto, secondary = Cor.Secundario, error = Cor.Vermelho,
        ),
    ) { Surface(color = Cor.Fundo, content = conteudo) }
}

/** Cartão branco arredondado do design. */
@Composable
fun Cartao(modifier: Modifier = Modifier, padding: Dp = 20.dp, conteudo: @Composable () -> Unit) {
    Box(
        modifier
            .clip(RoundedCornerShape(20.dp))
            .background(Cor.Cartao)
            .border(1.dp, Cor.Borda, RoundedCornerShape(20.dp))
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
            .background(if (destaque) Brush.verticalGradient(listOf(Cor.VerdeVivo, Cor.Verde)) else Brush.verticalGradient(listOf(Cor.Fundo, Cor.Fundo)))
            .border(1.dp, if (destaque) Color(0x33000000) else Cor.Borda, RoundedCornerShape(10.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Text(kart.ifBlank { "—" }, color = if (destaque) Color.White else Cor.Secundario, fontSize = tamanho, fontWeight = FontWeight.Black)
    }
}

@Composable
fun BotaoPrincipal(texto: String, onClick: () -> Unit, modifier: Modifier = Modifier, icone: ImageVector? = null, habilitado: Boolean = true, cor: Color = Cor.Verde) {
    Button(
        onClick = onClick, enabled = habilitado, modifier = modifier.height(56.dp),
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(containerColor = cor, contentColor = Color.White, disabledContainerColor = Cor.Borda, disabledContentColor = Cor.Secundario),
        contentPadding = PaddingValues(horizontal = 24.dp),
    ) {
        if (icone != null) { Icon(icone, null, Modifier.size(22.dp)); Spacer(Modifier.width(10.dp)) }
        Text(texto, fontSize = 17.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun BotaoSecundario(texto: String, onClick: () -> Unit, modifier: Modifier = Modifier, icone: ImageVector? = null, habilitado: Boolean = true, escuro: Boolean = false) {
    OutlinedButton(
        onClick = onClick, enabled = habilitado, modifier = modifier.height(56.dp),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, if (escuro) Color(0x33FFFFFF) else Cor.Borda),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = if (escuro) Color(0x14FFFFFF) else Color.White, contentColor = if (escuro) Color.White else Cor.Texto),
        contentPadding = PaddingValues(horizontal = 20.dp),
    ) {
        if (icone != null) { Icon(icone, null, Modifier.size(20.dp)); Spacer(Modifier.width(8.dp)) }
        Text(texto, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
    }
}

/** Controle segmentado (pílulas) do design. */
@Composable
fun Segmento(opcoes: List<String>, selecionado: Int, onSelecionar: (Int) -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier.clip(RoundedCornerShape(14.dp)).background(Color(0xFFEDEEF1)).padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        opcoes.forEachIndexed { i, texto ->
            val sel = i == selecionado
            Box(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (sel) Color.White else Color.Transparent)
                    .clickable { onSelecionar(i) }
                    .padding(vertical = 12.dp, horizontal = 10.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(texto, fontSize = 15.sp, fontWeight = if (sel) FontWeight.Bold else FontWeight.Medium, color = if (sel) Cor.Texto else Cor.Secundario, textAlign = TextAlign.Center, maxLines = 1)
            }
        }
    }
}

/** Faixa de aviso (amarela) ou erro (vermelha). */
@Composable
fun Aviso(texto: String, erro: Boolean = false, modifier: Modifier = Modifier) {
    Box(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(if (erro) Cor.VermelhoClaro else Cor.AmareloClaro)
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) { Text(texto, color = if (erro) Cor.Vermelho else Color(0xFF7A5200), fontSize = 15.sp, fontWeight = FontWeight.Medium) }
}

@Composable
fun Titulo(texto: String, sub: String? = null) {
    Column {
        Text(texto, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Cor.Texto)
        if (sub != null) Text(sub, fontSize = 14.sp, color = Cor.Secundario)
    }
}
