package br.com.kartodromobetim.sorteio

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

data class Bateria(
    val id: String,
    val nome: String,
    val tipo: String,
    val criadaEm: Long,
    val pilotos: Int,
    val programaIrmas: List<String> = emptyList(),
    val agendaId: Long? = null,
    /** pilotos ainda sem kart (0 = sorteio já feito) */
    val semKart: Int = -1,
)

data class BateriaAgenda(val id: Long, val nome: String, val inicio: String, val inscritos: Int, val tipoKart: String?)

data class InfoSorteio(
    val bateria: Bateria,
    val estado: String,
    val tipoKart: String?,
    val karts: List<String>,
    val pilotos: List<Piloto>,
    val revisaoLista: String? = null,
)

class ErroServidor(msg: String) : Exception(msg)

/** Preferências do tablet (endereço do serviço, karts fora do sorteio, modo). */
class Preferencias(ctx: Context) {
    private val p = ctx.getSharedPreferences("sorteio", Context.MODE_PRIVATE)

    /** Últimos dados válidos para que a operação continue legível quando a rede cair. */
    var cacheBaterias: List<Bateria>?
        get() = p.getString("cacheBaterias", null)?.let { texto ->
            runCatching {
                val arr = JSONArray(texto)
                (0 until arr.length()).map { n ->
                    val item = arr.getJSONObject(n)
                    val irmas = item.optJSONArray("programaIrmas")?.let { lista ->
                        (0 until lista.length()).map { lista.getString(it) }
                    }.orEmpty()
                    Bateria(
                        id = item.optString("id"),
                        nome = item.optString("nome"),
                        tipo = item.optString("tipo"),
                        criadaEm = item.optLong("criadaEm"),
                        pilotos = item.optInt("pilotos"),
                        programaIrmas = irmas,
                        agendaId = if (item.isNull("agendaId")) null else item.optLong("agendaId"),
                        semKart = item.optInt("semKart", -1),
                    )
                }
            }.getOrNull()
        }
        set(valor) {
            if (valor == null) {
                p.edit().remove("cacheBaterias").apply()
            } else {
                val arr = JSONArray()
                valor.forEach { bateria ->
                    arr.put(JSONObject().apply {
                        put("id", bateria.id)
                        put("nome", bateria.nome)
                        put("tipo", bateria.tipo)
                        put("criadaEm", bateria.criadaEm)
                        put("pilotos", bateria.pilotos)
                        put("programaIrmas", JSONArray(bateria.programaIrmas))
                        if (bateria.agendaId == null) put("agendaId", JSONObject.NULL) else put("agendaId", bateria.agendaId)
                        put("semKart", bateria.semKart)
                    })
                }
                p.edit().putString("cacheBaterias", arr.toString()).apply()
            }
        }

    var cacheAgenda: List<BateriaAgenda>?
        get() = p.getString("cacheAgenda", null)?.let { texto ->
            runCatching {
                val arr = JSONArray(texto)
                (0 until arr.length()).map { n ->
                    val item = arr.getJSONObject(n)
                    BateriaAgenda(
                        id = item.optLong("id"),
                        nome = item.optString("nome"),
                        inicio = item.optString("inicio"),
                        inscritos = item.optInt("inscritos"),
                        tipoKart = item.optString("tipoKart").takeIf { it.isNotBlank() },
                    )
                }
            }.getOrNull()
        }
        set(valor) {
            if (valor == null) {
                p.edit().remove("cacheAgenda").apply()
            } else {
                val arr = JSONArray()
                valor.forEach { bateria ->
                    arr.put(JSONObject().apply {
                        put("id", bateria.id)
                        put("nome", bateria.nome)
                        put("inicio", bateria.inicio)
                        put("inscritos", bateria.inscritos)
                        if (bateria.tipoKart == null) put("tipoKart", JSONObject.NULL) else put("tipoKart", bateria.tipoKart)
                    })
                }
                p.edit().putString("cacheAgenda", arr.toString()).apply()
            }
        }

    var servidor: String
        get() = p.getString("servidor", null) ?: "http://192.168.20.249:4050"
        set(v) = p.edit().putString("servidor", v.trim().trimEnd('/')).apply()

    var chave: String
        get() = p.getString("chave", "") ?: ""
        set(v) = p.edit().putString("chave", v.trim()).apply()

    var kartsFora: Set<String>
        get() = p.getStringSet("kartsFora", emptySet())!!.toSet()
        set(v) = p.edit().putStringSet("kartsFora", v).apply()

    var umAUm: Boolean
        get() = p.getBoolean("umAUm", false)
        set(v) = p.edit().putBoolean("umAUm", v).apply()

    /** Quantas vezes o piloto pode recusar o kart no modo um a um (0 = não pode). */
    var recusas: Int
        get() = p.getInt("recusas", 0)
        set(v) = p.edit().putInt("recusas", v.coerceIn(0, 5)).apply()

    /** Segundos para aceitar sozinho quando o piloto pode recusar. */
    var segundos: Int
        get() = p.getInt("segundos", 10)
        set(v) = p.edit().putInt("segundos", v.coerceIn(3, 60)).apply()

    var animacao: Boolean
        get() = p.getBoolean("animacao", true)
        set(v) = p.edit().putBoolean("animacao", v).apply()

    var ultimaSincronizacao: Long?
        get() = p.getLong("ultimaSincronizacao", 0L).takeIf { it > 0L }
        set(v) {
            if (v == null) p.edit().remove("ultimaSincronizacao").apply()
            else p.edit().putLong("ultimaSincronizacao", v).apply()
        }
}

/** Serviço de cronometragem (ORBITS :4050). */
class Api(private val base: () -> String, private val chave: () -> String = { "" }) {

    private suspend fun chamar(metodo: String, caminho: String, corpo: JSONObject? = null): String = withContext(Dispatchers.IO) {
        val endereco = base().trim().trimEnd('/')
        val raiz = try { URL(endereco) } catch (e: Exception) {
            throw ErroServidor("Informe um endereço válido, como http://192.168.20.249:4050.")
        }
        if (raiz.protocol !in listOf("http", "https") || raiz.host.isBlank())
            throw ErroServidor("Use um endereço HTTP ou HTTPS com o nome ou IP do servidor.")
        val url = URL(endereco + caminho)
        val c = url.openConnection() as HttpURLConnection
        try {
            c.requestMethod = metodo
            c.connectTimeout = 6000
            c.readTimeout = 15000
            c.setRequestProperty("Accept", "application/json")
            val k = chave().trim()
            if (k.isNotEmpty()) {
                c.setRequestProperty("x-timing-key", k)
            }
            if (corpo != null) {
                c.doOutput = true
                c.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                c.outputStream.use { it.write(corpo.toString().toByteArray(Charsets.UTF_8)) }
            }
            val codigo = c.responseCode
            val texto = (if (codigo in 200..299) c.inputStream else c.errorStream)?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            if (codigo !in 200..299) {
                val msg = runCatching { JSONObject(texto).optString("error") }.getOrNull()
                throw ErroServidor(if (!msg.isNullOrBlank()) msg else "A cronometragem respondeu com erro $codigo.")
            }
            texto
        } catch (e: IOException) {
            throw ErroServidor("Sem conexão com a cronometragem (${base()}). Confira o Wi-Fi do tablet e se o computador ORBITS está ligado.")
        } finally {
            c.disconnect()
        }
    }

    suspend fun testar(): Boolean = JSONObject(chamar("GET", "/healthz")).optBoolean("ok")

    /** Baterias que ainda não largaram, uma por programa (tomada + corrida contam como uma só). */
    suspend fun baterias(): List<Bateria> {
        val arr = JSONArray(chamar("GET", "/api/sessions"))
        val lista = (0 until arr.length()).map { arr.getJSONObject(it) }.filter { it.optString("state") == "preparando" }
        // provas do mesmo programa (tomada de tempo + corrida) recebem o mesmo sorteio
        val grupos = lista.groupBy { s -> s.optString("programaId").takeIf { !s.isNull("programaId") && it.isNotBlank() } ?: s.optString("id") }
        return grupos.values.map { g ->
            val ordem = g.sortedBy { it.optLong("createdAt") }
            val s = ordem.first()
            Bateria(
                id = s.optString("id"),
                nome = s.optString("name").substringBeforeLast(" · ", s.optString("name")),
                tipo = s.optString("type"),
                criadaEm = s.optLong("createdAt"),
                pilotos = s.optInt("competitors"),
                programaIrmas = if (ordem.size > 1) ordem.map { it.optString("name").substringAfterLast(" · ") } else emptyList(),
                agendaId = if (s.isNull("agendaId")) null else s.optLong("agendaId"),
                semKart = s.optInt("semKart", -1),
            )
        }.sortedByDescending { it.criadaEm }
    }

    suspend fun agendaDeHoje(): List<BateriaAgenda> {
        val arr = JSONArray(chamar("GET", "/api/agenda"))
        return (0 until arr.length()).map { arr.getJSONObject(it) }.map {
            BateriaAgenda(it.optLong("id"), it.optString("nome"), it.optString("inicio"), it.optInt("inscritos"), it.optString("tipoKart").ifBlank { null })
        }
    }

    /** Cria na cronometragem as provas da bateria da agenda (com os inscritos) e devolve a primeira. */
    suspend fun preparar(ag: BateriaAgenda): String {
        val arr = JSONArray(chamar("POST", "/api/agenda/${ag.id}/preparar", JSONObject().put("nome", ag.nome)))
        if (arr.length() == 0) throw ErroServidor("A cronometragem não criou a bateria.")
        return (0 until arr.length()).map { arr.getJSONObject(it) }.minBy { it.optLong("createdAt") }.optString("id")
    }

    suspend fun info(id: String): InfoSorteio {
        val o = JSONObject(chamar("GET", "/api/sessions/$id/sorteio"))
        val s = o.getJSONObject("sessao")
        val prog = o.optJSONArray("programa") ?: JSONArray()
        val karts = o.getJSONArray("karts").let { a -> (0 until a.length()).map { a.getString(it) } }
        val pil = o.getJSONArray("pilotos").let { a -> (0 until a.length()).map { a.getJSONObject(it) } }.map { p ->
            val exc = p.optJSONArray("excecoes") ?: JSONArray()
            Piloto(
                indice = p.getInt("indice"),
                nome = p.optString("nome"),
                customerId = if (p.isNull("customerId")) null else p.optString("customerId"),
                kartAtual = p.optString("kartAtual"),
                excecoes = (0 until exc.length()).map { exc.getString(it) }.toSet(),
                pesoKg = if (p.isNull("pesoKg")) null else p.optDouble("pesoKg"),
            )
        }
        val nome = s.optString("name")
        // a própria prova + as outras do mesmo programa (ex.: TOMADA DE TEMPO + CORRIDA)
        val provas = if (prog.length() == 0) emptyList() else listOf(nome.substringAfterLast(" · ", "")) +
            (0 until prog.length()).map { prog.getJSONObject(it).optString("name").substringAfterLast(" · ") }
        val revisaoLista = o.optString("revisaoLista").takeIf { it.isNotBlank() }
        return InfoSorteio(
            bateria = Bateria(s.optString("id"), nome.substringBeforeLast(" · ", nome), s.optString("type"), s.optLong("createdAt"), pil.size, provas.filter { it.isNotBlank() }),
            estado = s.optString("state"),
            tipoKart = if (o.isNull("tipoKart")) null else o.optString("tipoKart"),
            karts = karts,
            pilotos = pil,
            revisaoLista = revisaoLista,
        )
    }

    suspend fun gravar(id: String, resultado: List<Sorteado>, umAUm: Boolean, modo: String? = null, revisaoLista: String? = null): Long? {
        val atr = JSONArray()
        resultado.forEach {
            val atribuicao = JSONObject().put("indice", it.piloto.indice).put("kart", it.kart)
            it.planoLastro?.let { plano -> atribuicao.put("lastroKg", plano.lastroKg).put("pecas5Kg", plano.pecas5Kg).put("pecas2_5Kg", plano.pecas2_5Kg) }
            atr.put(atribuicao)
        }
        val corpo = JSONObject().put("atribuicoes", atr).put("modo", modo ?: if (umAUm) "um-a-um" else "todos")
        if (!revisaoLista.isNullOrBlank()) corpo.put("revisaoLista", revisaoLista)
        val resposta = JSONObject(chamar("POST", "/api/sessions/$id/sorteio", corpo))
        return resposta.optLong("gravadoEm").takeIf { it > 0 }
    }
}
