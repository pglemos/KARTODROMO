import { useEffect, useState } from "react";
import { api, TERMINAL } from "./model.js";

export function useOrder(id, refresh) {
  const [order, setOrder] = useState(null);
  const [connection, setConnection] = useState("");
  useEffect(() => {
    setOrder(null);
    setConnection("");
    if (!id) return;
    let active = true,
      timer,
      running = false,
      done = false,
      failures = 0;
    const poll = async () => {
      if (!active || running || done) return;
      clearTimeout(timer);
      running = true;
      try {
        const data = await api(`/api/reservas/${id}`);
        if (!active) return;
        if (
          !["novo", "aguardando_pagamento", "pago", ...TERMINAL].includes(
            data.status,
          ) ||
          data.id !== id
        )
          throw new Error("Não foi possível verificar o pedido.");
        setOrder(data);
        setConnection("");
        failures = 0;
        done = TERMINAL.has(data.status);
        if (done) {
          try {
            localStorage.removeItem("kib-reserva");
          } catch {
            /* Optional storage. */
          }
        }
      } catch (error) {
        if (!active) return;
        if (error.status === 404) {
          setOrder({ id, status: "nao_encontrada" });
          done = true;
          try {
            localStorage.removeItem("kib-reserva");
          } catch {
            /* Optional storage. */
          }
        } else {
          failures++;
          setConnection(
            "Não conseguimos atualizar o pedido. Não faça outro pagamento. Vamos tentar novamente.",
          );
        }
      } finally {
        running = false;
        if (active && !done)
          timer = setTimeout(
            poll,
            document.hidden
              ? 10000
              : Math.min(15000, failures ? 2500 * 2 ** failures : 2500),
          );
      }
    };
    const wake = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
    };
  }, [id, refresh]);
  return { order, connection };
}

export function useClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
