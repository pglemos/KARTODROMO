package br.com.kartodromobetim.sorteio

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Assert.assertFalse
import org.junit.Test

class ApiTest {
    @Test
    fun `piloto aprovado depois invalida resultado antigo antes de gravar`() {
        val ana = Piloto(0, "Ana", "10", "", emptySet(), 75.0)
        val bia = Piloto(1, "Bia", "11", "", emptySet(), 80.0)
        val bateria = Bateria("teste", "Teste", "corrida", 0L, 2)
        val resultado = listOf(Sorteado(ana, "1", false))
        fun info(pilotos: List<Piloto>) = InfoSorteio(bateria, "preparando", "light", listOf("1", "2"), pilotos)

        assertFalse(listaDoSorteioMudou(info(listOf(ana)), resultado))
        assertTrue(listaDoSorteioMudou(info(listOf(ana, bia)), resultado))
        assertTrue(listaDoSorteioMudou(info(listOf(ana.copy(nome = "Outra Ana"))), resultado))
        assertTrue(listaDoSorteioMudou(info(listOf(ana.copy(customerId = "12"))), resultado))
        assertTrue(listaDoSorteioMudou(info(listOf(ana)).copy(estado = "em_andamento"), resultado))
    }

    @Test
    fun `endereco invalido gera erro recuperavel em vez de encerrar aplicativo`() = runBlocking {
        for (endereco in listOf("", "servidor", "ftp://localhost", "http://")) {
            try {
                Api { endereco }.testar()
                throw AssertionError("Deveria rejeitar endereco invalido")
            } catch (e: ErroServidor) {
                assertTrue(e.message!!.isNotBlank())
            }
        }
    }
}
