# 🏎️ Kartodromo de Betim — App

Aplicação web do Kartodromo de Betim, construída com **React + TypeScript + Vite**.

---

## ✅ Pré-requisitos

Antes de começar, garanta que você tem instalado na sua máquina:

- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- [npm](https://www.npmjs.com/) (já vem junto com o Node)

> Para verificar, rode no terminal:
> ```bash
> node -v
> npm -v
> ```

---

## 🚀 Como rodar localmente

### 1. Clone o repositório

```bash
git clone --branch betim-dev https://github.com/SamuelRulli/kartodromo-de-betim-app.git
cd kartodromo-de-betim-app
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com o seguinte conteúdo:

```env
VITE_FORM_MANAGERMENT_USER=kartodromo
VITE_FORM_MANAGERMENT_KEY=bCw2F30Q2pox
VITE_WEBHOOK_URL=
```

> ⚠️ O arquivo `.env` **não está no repositório** (está no `.gitignore`). Peça os valores ao líder técnico se forem diferentes dos acima.

### 4. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Abra o navegador em **http://localhost:5173** e pronto! 🎉

---

## 📜 Scripts disponíveis

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o servidor local com hot-reload |
| `npm run build` | Gera a build de produção na pasta `dist/` |
| `npm run preview` | Visualiza a build de produção localmente |
| `npm run lint` | Roda o ESLint para checar erros no código |

---

## 🗂️ Estrutura do projeto

```
kartodromo-de-betim-app/
├── src/
│   ├── components/   # Componentes React reutilizáveis
│   └── ...
├── public/           # Arquivos estáticos
├── index.html        # Entry point HTML
├── vite.config.ts    # Configuração do Vite
└── .env              # Variáveis de ambiente (não commitado)
```

---

## ❓ Problemas comuns

**Porta 5173 ocupada?**
```bash
# Rode em outra porta
npm run dev -- --port 3000
```

**Erro de dependência?**
```bash
# Apague o node_modules e reinstale
rm -rf node_modules
npm install
```

**Variáveis de ambiente não funcionando?**
- Certifique-se que o arquivo se chama exatamente `.env` (com o ponto na frente)
- Todas as variáveis devem começar com `VITE_` para funcionar no Vite
