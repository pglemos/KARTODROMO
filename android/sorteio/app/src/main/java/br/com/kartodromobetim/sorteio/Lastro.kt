package br.com.kartodromobetim.sorteio

import kotlin.math.ceil

/** Plano de lastro para um piloto e a meta da frota escolhida pelo fiscal. */
data class PlanoLastro(
    val pesoPiloto: Double,
    val metaKg: Double,
    val lastroKg: Double,
    val pesoFinal: Double,
    val pecas5Kg: Int,
    val pecas2_5Kg: Int,
)

/**
 * Completa o peso sempre para cima, em passos de 2,5 kg, para nunca deixar o kart abaixo da
 * meta. A combinação usa primeiro peças de 5 kg para reduzir a quantidade de peças.
 */
fun calcularLastro(pesoPiloto: Double?, frota: Frota): PlanoLastro? {
    val peso = pesoPiloto ?: return null
    val meta = frota.alvoKg ?: return null
    val deficit = (meta - peso).coerceAtLeast(0.0)
    val lastro = ceil((deficit / 2.5) - 0.0000001) * 2.5
    val unidades = (lastro / 2.5).toInt()
    val pecas5 = unidades / 2
    val pecas2_5 = unidades % 2
    return PlanoLastro(peso, meta, lastro, peso + lastro, pecas5, pecas2_5)
}

fun PlanoLastro.descricaoPecas(): String = when {
    lastroKg <= 0.0 -> "Sem lastro"
    pecas5Kg > 0 && pecas2_5Kg > 0 -> "${pecas5Kg}× 5 kg + ${pecas2_5Kg}× 2,5 kg"
    pecas5Kg > 0 -> "${pecas5Kg}× 5 kg"
    else -> "${pecas2_5Kg}× 2,5 kg"
}
