export function validCPF(value) {
  const s = String(value).replace(/\D/g, "");
  if (s.length !== 11 || /^(\d)\1{10}$/.test(s)) return false;
  for (let n = 9; n < 11; n++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(s[i]) * (n + 1 - i);
    const digit = ((sum * 10) % 11) % 10;
    if (digit !== Number(s[n])) return false;
  }
  return true;
}
export function validatePilots(karts, c) {
  const errors = [];
  const names = new Set();
  const total = karts.reduce((n, k) => n + k.length, 0);
  if (total > 50)
    errors.push(
      "A inscrição pode conter no máximo 50 pilotos. Consulte a organização para equipes maiores.",
    );
  karts.forEach((pilots, k) => {
    if (pilots.length < c.minPilots)
      errors.push(
        `Kart ${k + 1}: informe pelo menos ${c.minPilots} piloto(s).`,
      );
    if (c.id === "100-milhas-light" && pilots.length > 3)
      errors.push(`Kart ${k + 1}: o limite é de 3 pilotos.`);
    pilots.forEach((p, i) => {
      const label = `Kart ${k + 1}, piloto ${i + 1}`;
      const name = p.nome.trim().toLocaleLowerCase("pt-BR");
      if (name.length < 3) errors.push(`${label}: informe o nome completo.`);
      if (names.has(name)) errors.push(`${label}: este nome já foi informado.`);
      names.add(name);
      if (
        !Number.isInteger(Number(p.idade)) ||
        Number(p.idade) < c.minAge ||
        Number(p.idade) > 90
      )
        errors.push(`${label}: idade mínima de ${c.minAge} anos.`);
      if (Number(p.altura) <= 1.5 || Number(p.altura) > 2.3)
        errors.push(`${label}: altura acima de 1,50 m.`);
      if (Number(p.peso) <= 50 || Number(p.peso) > 180)
        errors.push(`${label}: peso acima de 50 kg e até 180 kg.`);
    });
  });
  return errors;
}
export function registrationPayload(c, d, karts) {
  const team = c.team;
  return {
    campeonato_id: c.apiId || c.id,
    evento: c.name,
    modalidade: team ? "equipe" : "individual",
    nomeEquipe: team ? d.equipe : undefined,
    nomeChefe: team ? d.nome : undefined,
    fullName: !team ? d.nome : undefined,
    cpf: d.cpf || undefined,
    whatsapp: d.whatsapp,
    email: d.email,
    cidade: d.cidade,
    age: !team ? Number(d.idade) : undefined,
    weight: !team ? Number(d.peso) : undefined,
    quantidadeKarts: team ? karts.length : undefined,
    pilotos: team
      ? karts.flatMap((k) =>
          k.map((p) => ({ nome: p.nome.trim(), peso_kg: Number(p.peso) })),
        )
      : [],
    pagamento: d.pagamento || "A confirmar com a organização",
    observacoes: [
      d.observacoes,
      team
        ? karts
            .flatMap((k, i) =>
              k.map(
                (p) =>
                  `${p.nome}: kart ${i + 1}, ${p.idade} anos, ${p.altura} m, ${p.peso} kg`,
              ),
            )
            .join("; ")
        : "",
    ]
      .filter(Boolean)
      .join(" | "),
    acceptedRules: !!d.regulamento,
    acceptedResponsibility: !!d.responsabilidade,
    acceptedContact: true,
    acceptedImage: !!d.imagem,
  };
}
