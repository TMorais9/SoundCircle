# SoundCircle

O SoundCircle é uma plataforma para músicos se encontrarem, conversarem e formarem bandas.

A parte de Inteligência Artificial é o **Circle AI**: um chat onde se escreve o que se procura (por exemplo "quero formar uma banda" ou "baterista em Coimbra, 3 anos") e o sistema responde com músicos, bandas para integrar ou propostas de banda completas. A procura é feita por um **algoritmo CSP (Constraint Satisfaction Problem)** implementado de raiz em [`backend/ai/ai.py`](backend/ai/ai.py).

Este guia explica, passo a passo, como pôr o site a correr e onde ver a parte de IA a funcionar. Leva cerca de 10 minutos.

---

## O que é preciso ter instalado

| Programa | Versão | Para quê |
|---|---|---|
| [Node.js](https://nodejs.org) (já traz o `npm`) | 20.19 ou superior (ou 22.12+) | backend e frontend |
| [Python](https://www.python.org/downloads/) | 3.9 ou superior | o algoritmo de IA (só usa a biblioteca padrão, não é preciso `pip install`) |
| [MySQL Server](https://dev.mysql.com/downloads/mysql/) | 8.x | base de dados |
| MySQL Workbench **ou** o comando `mysql` | qualquer | para criar a base de dados (passo 2) |

---

## Passo 1: obter o código

```bash
git clone https://github.com/TMorais9/SoundCircle.git
cd SoundCircle
```

(Ou descarregar o `.zip` do repositório e abrir a pasta `SoundCircle`.)

---

## Passo 2: criar a base de dados

O ficheiro [`backend/db/soundcircle.sql`](backend/db/soundcircle.sql) cria a base de dados `SoundCircle`, as tabelas e 15 perfis de demonstração (músicos e bandas). Não apaga nada que já exista.

**Opção A, pelo terminal:**

```bash
mysql -u root -p < backend/db/soundcircle.sql
```

(Pede a password do MySQL.)

**Opção B, pelo MySQL Workbench:**
1. Ligar ao servidor local.
2. Menu **File → Open SQL Script…** e escolher `backend/db/soundcircle.sql`.
3. Carregar no botão do raio (⚡) para executar.

---

## Passo 3: configurar o backend

Copiar o ficheiro de exemplo das configurações:

```bash
# macOS / Linux
cp backend/.env.example backend/.env

# Windows (Linha de Comandos)
copy backend\.env.example backend\.env
```

Abrir `backend/.env` e trocar `DB_PASSWORD` pela password do MySQL (e `DB_USER`, se não for `root`).

> **Windows:** se o comando `python3` não existir, mudar a linha para `PYTHON_BIN=python`.

---

## Passo 4: arrancar o backend (terminal 1)

```bash
cd backend
npm install
npm run dev
```

Tem de aparecer:

```
Servidor a correr em http://localhost:3000
Ligado à base de dados MySQL.
```

Deixar este terminal aberto.

---

## Passo 5: arrancar o frontend (terminal 2)

Abrir **outro** terminal na pasta `SoundCircle`:

```bash
cd frontend
npm install
npm run dev
```

Aparece o endereço `http://localhost:5173`. Deixar também este terminal aberto.

---

## Passo 6: ver a parte de IA a funcionar

1. Abrir **http://localhost:5173** no browser. Na janela de boas-vindas, carregar em **Saltar tutorial**.
2. Na barra lateral, carregar em **Conta**. Na caixa **Iniciar Sessão**, entrar com a conta de demonstração:
   - Email: `tomasrodrigues@gmail.com`
   - Password: `teste`

   e carregar em **Entrar**.
3. Na barra lateral, abrir **Circle AI** (o último ícone).
4. Escrever as frases abaixo, **uma de cada vez e por esta ordem**, carregando em **Enviar** depois de cada uma. As quatro primeiras são uma conversa: cada mensagem continua a banda anterior.

| Frase | O que mostra do algoritmo | O que deve aparecer |
|---|---|---|
| `Quero formar uma banda` | Vai buscar ao perfil o instrumento (Guitarrista) e o distrito (Lisboa). Monta um CSP com uma variável por lugar da banda, em que o lugar de guitarra é teu. | "Fui buscar ao teu perfil: Guitarrista · Lisboa. Faltam vocalista, baixista e baterista." e 5 bandas **exatas**, todas em Lisboa (ex.: Joana Guimarães, Tu, António Matos, Tomas Rodrigues). |
| `sou de Coimbra` | Continua a mesma banda e muda a restrição de distrito. O lugar sem candidatos é relaxado sozinho. | Ines Pinho (Coimbra) como vocalista e "Para baixista não há ninguém em Coimbra nem perto, por isso escolhi o mais próximo." |
| `já tenho baterista` | O lugar de bateria passa a ter um valor fixo ("ocupado"). | Faltam só vocalista e baixista; a bateria aparece como **Já tens**. |
| `e um pianista` | Acrescenta uma variável ao CSP. | Aparece um pianista (Tiago Morais). |
| `procuro uma banda` | Outro problema CSP: bandas já formadas para integrar. | Queen e Quatro e Meia. |
| `baterista em Coimbra, 3 anos` | Relaxamento de restrições: ninguém cumpre tudo exatamente, por isso passa ao nível "semelhante". | Alberto Caeiro (Castelo Branco, 2 anos), marcado **semelhante**. |
| `procuro vocalista em Lisboa`, com o chip **Pop** selecionado | Restrição de características vinda dos chips por baixo da caixa de texto. | Mariana Leitão e Mariana Amaro, marcadas **exato**. |
| `sou baterista e quero formar uma banda em Braga` | O que se escreve tem prioridade sobre o perfil. Sem ninguém perto de Braga, relaxa até "outra opção". | Tu como baterista e "Para vocalista, guitarrista e baixista não há ninguém em Braga nem perto, por isso escolhi os mais próximos." |

Todas as outras contas de demonstração usam também a password `demo1234` (por exemplo `joana.guimaraes@soundcircle.demo`, `tomas.rodrigues@soundcircle.demo` ou a banda `queen@soundcircle.demo`).

---

## Onde está o código da IA

| Ficheiro | O que tem |
|---|---|
| [`backend/ai/ai.py`](backend/ai/ai.py) | **O algoritmo.** Motor CSP genérico (AC-3, backtracking com MRV, manutenção de consistência de arco e branch & bound), os três modelos (procurar músico, integrar banda, formar banda) e a leitura da frase. Está todo comentado. |
| [`backend/src/controllers/aiController.js`](backend/src/controllers/aiController.js) | Lê os dados da base de dados, chama o `ai.py` e devolve a resposta. |
| [`backend/src/routes/aiRoutes.js`](backend/src/routes/aiRoutes.js) | Rotas `POST /ai/chat` e `POST /ai/match`. |
| [`frontend/src/pages/ai.jsx`](frontend/src/pages/ai.jsx) | Página do Circle AI (só mostra o que o algoritmo devolve). |

Para correr só o algoritmo, sem o site (corre um exemplo interno e mostra o resultado em JSON):

```bash
echo {} | python3 backend/ai/ai.py
```

---

## Problemas comuns

| O que acontece | O que fazer |
|---|---|
| O terminal do backend mostra **"Erro ao ligar à base de dados"** | Confirmar que o MySQL está ligado, que o passo 2 foi feito e que `DB_USER` e `DB_PASSWORD` em `backend/.env` estão certos. Depois parar o backend (Ctrl+C) e voltar a correr `npm run dev`. |
| O Circle AI responde **"Não foi possível gerar sugestões com o motor AI"** | O backend não encontrou o Python. Instalar o Python 3 ou, no Windows, pôr `PYTHON_BIN=python` em `backend/.env` e reiniciar o backend. |
| O login não funciona ou aparece um erro de ligação | O backend tem de estar a correr na porta 3000 (passo 4). |
| A porta 3000 ou 5173 já está ocupada | Mudar `PORT` em `backend/.env` e criar `frontend/.env` com `VITE_API_BASE_URL=http://localhost:<nova porta>`. Se o frontend mudar de porta, atualizar também `CLIENT_URL` em `backend/.env`. |
| Algumas fotos de perfil não aparecem | Essas fotos estão guardadas com o endereço `http://localhost:3000` e aparecem quando o backend está na porta 3000. |
