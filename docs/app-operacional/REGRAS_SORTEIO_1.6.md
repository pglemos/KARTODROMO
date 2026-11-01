# Regras do SorteioKarts 1.6 (extraídas do APK com dexdump)

## Lastro — função `X1.b.o(peso, frota)`
```text
falta   = max(0, meta - peso)
unidades = ceil(falta / 2,5 - 0,0000001)
lastro  = unidades × 2,5
pecas5  = unidades div 2
pecas2,5 = unidades mod 2
final   = peso + lastro
```
Sem peso ou sem meta, não há plano. **O cálculo está só no aparelho**: o servidor guarda apenas `pesoLastro`, e `sorteio.html` da produção não contém lastro. Ou seja, a F2 leva essa fórmula ao servidor.

## Frotas (`s1.w`)
Light · 1 a 99, meta 90. Super · 100+, meta 100. Todos, sem meta. **Fixas no APK**, não parametrizadas.

## Exemplos (calculados pela fórmula, para teste de equivalência)
| Frota | Peso | Lastro | 5 kg | 2,5 kg | Final |
|---|:--:|:--:|:--:|:--:|:--:|
| Light | 60 | 30 | 6 | 0 | 90 |
| Light | 72,5 | 17,5 | 3 | 1 | 90 |
| Light | 89 | 2,5 | 0 | 1 | 91,5 |
| Light | 90 | 0 | 0 | 0 | 90 |
| Light | 95 | 0 | 0 | 0 | 95 |
| Super | 80 | 20 | 4 | 0 | 100 |
| Super | 100 | 0 | 0 | 0 | 100 |
| Super | 110 | 0 | 0 | 0 | 110 |

## Fluxo visto nos textos do APK
Agenda da recepção + baterias da cronometragem; atualizar pilotos; escolher frota; marcar karts fora do sorteio; peso de 20 a 250 kg; modos todos e um a um, com recusas por piloto e aceite; modo fiscal; agrupar por kart ou nome; rascunho de escala (abrir, editar, conferir, descartar); gravar; compartilhar; telas de ajuda.

## Escritas e travas
Escreve `POST /api/agenda/:id/preparar` e `POST /api/sessions/:id/sorteio`. Endereço do servidor é configurável na tela. Trava de simultaneidade só a do servidor (`ListaMudouError`).

## Limitação
O aplicativo é ofuscado e foi lido por dexdump, sem jadx. Fórmula e constantes foram lidas em bytecode. Algoritmo exato do sorteio aleatório e do modo um a um **NÃO VERIFICADO**: exige leitura na F2.
