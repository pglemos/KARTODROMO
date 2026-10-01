package br.com.kartodromobetim.sorteio

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Test

class ApiTest {
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
