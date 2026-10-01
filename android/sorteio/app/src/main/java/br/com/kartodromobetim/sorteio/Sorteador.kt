package br.com.kartodromobetim.sorteio

import java.security.SecureRandom
import kotlin.random.Random
import kotlin.random.asKotlinRandom

/** Piloto da bateria; [excecoes] são os karts que ele já usou (o sorteio evita repetir). */
data class Piloto(
    val indice: Int,
    val nome: String,
    val customerId: String?,
    val kartAtual: String,
    val excecoes: Set<String>,
    val pesoKg: Double?,
)

data class Sorteado(val piloto: Piloto, val kart: String, val repetiu: Boolean, val planoLastro: PlanoLastro? = null)

/**
 * Sorteio justo (SecureRandom) de um kart diferente para cada piloto, evitando os karts que o
 * piloto já usou. Se não houver como evitar para todos, repete o mínimo possível.
 */
class Sorteador(private val rnd: Random = SecureRandom().asKotlinRandom()) {

    /** Todos de uma vez: a ordem dos pilotos é embaralhada e cada um recebe um kart. */
    fun todos(pilotos: List<Piloto>, karts: List<String>): List<Sorteado> {
        require(karts.size >= pilotos.size) { "Tem ${pilotos.size} pilotos e só ${karts.size} karts marcados." }
        val ordem = pilotos.shuffled(rnd)
        // várias tentativas totalmente aleatórias respeitando as exceções
        repeat(400) {
            val livres = karts.toMutableList()
            val saida = ArrayList<Sorteado>(ordem.size)
            for (p in ordem) {
                val opcoes = livres.filter { it !in p.excecoes }
                if (opcoes.isEmpty()) return@repeat
                val k = opcoes[rnd.nextInt(opcoes.size)]
                livres.remove(k)
                saida += Sorteado(p, k, false)
            }
            return saida
        }
        // não deu para respeitar todas: começa pelos pilotos com menos opções e repete o mínimo
        val livres = karts.toMutableList()
        val porRestricao = ordem.sortedBy { p -> karts.count { it !in p.excecoes } }
        return porRestricao.map { p ->
            val opcoes = livres.filter { it !in p.excecoes }
            val k = if (opcoes.isNotEmpty()) opcoes[rnd.nextInt(opcoes.size)] else livres[rnd.nextInt(livres.size)]
            livres.remove(k)
            Sorteado(p, k, k in p.excecoes)
        }.let { r -> ordem.map { p -> r.first { it.piloto.indice == p.indice } } }
    }

    /** Um a um: sorteia um kart para [piloto] entre os [livres], sem os que ele já usou ou recusou. */
    fun umKart(piloto: Piloto, livres: List<String>, recusados: Set<String> = emptySet()): Sorteado {
        require(livres.isNotEmpty()) { "Não sobrou kart para sortear." }
        val semRecusa = livres.filter { it !in recusados }.ifEmpty { livres }
        val opcoes = semRecusa.filter { it !in piloto.excecoes }
        val k = if (opcoes.isNotEmpty()) opcoes[rnd.nextInt(opcoes.size)] else semRecusa[rnd.nextInt(semRecusa.size)]
        return Sorteado(piloto, k, k in piloto.excecoes)
    }

    fun embaralhar(pilotos: List<Piloto>) = pilotos.shuffled(rnd)

    /** Número aleatório só para a animação da roleta. */
    fun qualquer(karts: List<String>) = karts[rnd.nextInt(karts.size)]
}

/** Frotas do kartódromo: light usa os karts 1–99 e super os karts 100 em diante. */
enum class Frota(val titulo: String, val contem: (Int) -> Boolean, val alvoKg: Double?) {
    LIGHT("Light · 1 a 99", { it in 1..99 }, 90.0),
    SUPER("Super · 100+", { it >= 100 }, 100.0),
    TODOS("Todos", { true }, null);

    companion object {
        fun da(tipoKart: String?) = when (tipoKart?.lowercase()) {
            "light" -> LIGHT
            "super" -> SUPER
            else -> TODOS
        }
    }
}
