package br.com.kartodromobetim.sorteio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LastroTest {
    @Test
    fun `light de 80 kg precisa de dois lastros de 5 kg`() {
        val plano = calcularLastro(80.0, Frota.LIGHT)!!

        assertEquals(90.0, plano.pesoFinal, 0.001)
        assertEquals(10.0, plano.lastroKg, 0.001)
        assertEquals(2, plano.pecas5Kg)
        assertEquals(0, plano.pecas2_5Kg)
    }

    @Test
    fun `super de 95 kg usa uma peca de 5 kg`() {
        val plano = calcularLastro(95.0, Frota.SUPER)!!

        assertEquals(100.0, plano.pesoFinal, 0.001)
        assertEquals(1, plano.pecas5Kg)
        assertEquals(0, plano.pecas2_5Kg)
    }

    @Test
    fun `deficit quebrado arredonda para cima em passos de 2 e meio`() {
        val plano = calcularLastro(84.0, Frota.LIGHT)!!

        assertEquals(7.5, plano.lastroKg, 0.001)
        assertEquals(1, plano.pecas5Kg)
        assertEquals(1, plano.pecas2_5Kg)
        assertTrue(plano.pesoFinal >= Frota.LIGHT.alvoKg!!)
    }

    @Test
    fun `peso ausente fica pendente para o fiscal informar`() {
        assertEquals(null, calcularLastro(null, Frota.LIGHT))
    }
}
