package br.com.kartodromobetim.sorteio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

class SorteadorTest {
    private fun piloto(i: Int, vararg usados: String) = Piloto(i, "Piloto $i", null, "", usados.toSet(), null)

    @Test
    fun `cada piloto recebe um kart diferente e nunca um que ja usou quando da`() {
        repeat(300) { semente ->
            val s = Sorteador(Random(semente))
            val pilotos = (0 until 12).map { piloto(it, "${it + 1}", "${it + 2}") }
            val karts = (1..14).map { "$it" }
            val r = s.todos(pilotos, karts)
            assertEquals(12, r.size)
            assertEquals(12, r.map { it.kart }.toSet().size)
            assertEquals(pilotos.map { it.indice }.toSet(), r.map { it.piloto.indice }.toSet())
            r.forEach { assertFalse("piloto ${it.piloto.indice} repetiu o kart ${it.kart}", it.kart in it.piloto.excecoes) }
        }
    }

    @Test
    fun `quando nao da para evitar repete o minimo e marca quem repetiu`() {
        val s = Sorteador(Random(7))
        val pilotos = listOf(piloto(0, "1", "2"), piloto(1, "1", "2"))
        val r = s.todos(pilotos, listOf("1", "2"))
        assertEquals(setOf("1", "2"), r.map { it.kart }.toSet())
        assertTrue(r.all { it.repetiu })
    }

    @Test(expected = IllegalArgumentException::class)
    fun `menos karts que pilotos nao sorteia`() {
        Sorteador(Random(1)).todos(listOf(piloto(0), piloto(1)), listOf("5"))
    }

    @Test
    fun `um a um evita kart recusado e ja usado`() {
        repeat(200) { semente ->
            val k = Sorteador(Random(semente)).umKart(piloto(0, "3"), listOf("1", "2", "3"), setOf("1"))
            assertEquals("2", k.kart)
        }
    }

    @Test
    fun `frotas light e super`() {
        assertEquals(Frota.LIGHT, Frota.da("light"))
        assertEquals(Frota.SUPER, Frota.da("SUPER"))
        assertEquals(Frota.TODOS, Frota.da(null))
        assertTrue(Frota.LIGHT.contem(83) && !Frota.LIGHT.contem(101))
        assertTrue(Frota.SUPER.contem(150) && !Frota.SUPER.contem(8))
    }
}
