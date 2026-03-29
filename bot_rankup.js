const express = require("express");
const noblox = require("noblox.js");

const app = express();
app.use(express.json());

// ============================================
// CONFIGURAÇÕES — edite aqui
// ============================================
const CONFIG = {
  cookie: "_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_CAEaAhADIhsKBGR1aWQSEzg3MDczMjM0Njk1NDk3MTkxMzUoAw.EgCW7zntZ7i-4f0ffffsMyMqEIMUbMyELEwKU7iuhOwl39nOCSeu2BOjlQCl69gEbn9_IHp0qDvSLN594x-3NYPeCX4xdjEU8b7jq1WMnVH-eTARY4zgZW81Su-fRbr5JNCHnWelv2LvV-7BDvC_Mrf_dgBz4VhxPQ6goHC_NJyxAu6FLvwn5VzWx3G8HASmAB4WQjKj0tqmDbQbIev5Ah6yX8VN9KgN-e9VfVgBqYvq0RcHvKTP3w58IkqPa31jRDjEbSodad5bLmC4z7zi_PTFD_szicDjHcEA95XISwep9lXMgk21Kk5WZCsaZpSjckuJlJaisZFqYEdTcxOEOb2ZKRlHxtBCyLr7vaIGYHfHNml9FQ_aH9j2-yWXZwtsIROXuVvCrYVl0ULJ6Uo8N7ACZGrc1LznvcKEkqY2OnQxkwa9sR1W4V1uzF0JMgq9RYf3oj7SU5R8Wvr4DHiqSXiEokU3shpDjQjj4UUZimjrA3nMXQVc1vn97Lbl7doVs91cGfhlLlAwVdO7l7kK_xNygO6T9vCSjNNwOum7QOn3YPp3NpUGj8DcKjVq4akvPLtNGGjaTw9av9Tr9BD2yjjgnu76-H-2EWheBMsYMDn9RM0eQjd9YmSoBiRdQCr8RE1ei2hXWf0C11E2rjoKmvlU6BKFZ4B72h4uJ8VjYhRK4zb0F5TcZZaRINH-AyiUdf_053jXHTgitz1Ks-HnPii2E6SpdnfZEET7ARahE2JX1H3VIei43IRCIepW0DYHBEW-Ch-u7E5FSWMZvxRSSyqTUUjBBbB-v0HzgWbG_GCJBoig",  // .ROBLOSECURITY da conta bot
  groupId: 343683389,          // ID do seu grupo
  rankUpAmount: 2,             // Quantos ranks subir
  targetRankId: null,          // null = sobe ranks | número = rank fixo
  porta: process.env.PORT || 3000,
};
// ============================================

let botLogado = false;

// Login com retry automático
async function iniciarBot(tentativa = 1) {
  console.log(`🔄 Tentativa de login ${tentativa}...`);
  try {
    // Remove o prefixo de aviso se existir
    let cookie = CONFIG.cookie.trim();
    if (!cookie.startsWith("_|WARNING")) {
      cookie = "_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_" + cookie;
    }

    await noblox.setCookie(cookie);
    const info = await noblox.getCurrentUser();
    console.log(`✅ Bot logado como: ${info.UserName} (ID: ${info.UserID})`);
    botLogado = true;
  } catch (err) {
    console.error(`❌ Erro ao logar (tentativa ${tentativa}):`, err.message);
    if (tentativa < 5) {
      console.log(`⏳ Tentando novamente em 10 segundos...`);
      setTimeout(() => iniciarBot(tentativa + 1), 10000);
    } else {
      console.error("❌ Falha após 5 tentativas. Bot rodando sem login.");
      // Não encerra o processo — mantém o servidor HTTP no ar
    }
  }
}

// Pega o rank atual
async function getRankAtual(userId) {
  try {
    return await noblox.getRankInGroup(CONFIG.groupId, userId);
  } catch (err) {
    console.error(`Erro ao buscar rank de ${userId}:`, err.message);
    return null;
  }
}

// Pega os roles do grupo
async function getRoles() {
  try {
    return await noblox.getRoles(CONFIG.groupId);
  } catch (err) {
    console.error("Erro ao buscar roles:", err.message);
    return [];
  }
}

// Dá rank up
async function darRankUp(userId, username) {
  try {
    const rankAtual = await getRankAtual(userId);
    if (rankAtual === null) throw new Error("Não foi possível obter o rank atual");
    if (rankAtual === 0) throw new Error(`${username} não está no grupo`);

    const roles = await getRoles();
    roles.sort((a, b) => a.rank - b.rank);

    const indexAtual = roles.findIndex((r) => r.rank === rankAtual);
    if (indexAtual === -1) throw new Error("Rank atual não encontrado");

    let novoIndex;
    if (CONFIG.targetRankId) {
      novoIndex = roles.findIndex((r) => r.id === CONFIG.targetRankId);
      if (novoIndex === -1) throw new Error("Rank alvo não encontrado");
    } else {
      novoIndex = Math.min(indexAtual + CONFIG.rankUpAmount, roles.length - 1);
    }

    if (novoIndex === indexAtual) {
      return { sucesso: false, motivo: "Usuário já está no rank máximo" };
    }

    const novoRole = roles[novoIndex];
    await noblox.setRank(CONFIG.groupId, userId, novoRole.id);

    console.log(`✅ Rank up: ${username} | ${roles[indexAtual].name} → ${novoRole.name}`);
    return { sucesso: true, rankAnterior: roles[indexAtual].name, novoRank: novoRole.name };
  } catch (err) {
    console.error(`❌ Erro rank up ${username}:`, err.message);
    return { sucesso: false, motivo: err.message };
  }
}

// ============================================
// Rotas
// ============================================

app.get("/", (req, res) => {
  res.json({ ok: true, logado: botLogado, mensagem: "Bot Missão Roblox online!" });
});

app.get("/ping", (req, res) => {
  res.json({ ok: true, logado: botLogado });
});

app.post("/rankup", async (req, res) => {
  if (!botLogado) {
    return res.status(503).json({ erro: "Bot ainda não está logado" });
  }

  const { userId, username } = req.body;
  if (!userId || !username) {
    return res.status(400).json({ erro: "userId e username são obrigatórios" });
  }

  console.log(`📩 Rank up pedido: ${username} (${userId})`);
  const resultado = await darRankUp(Number(userId), username);

  if (resultado.sucesso) {
    res.json({ ok: true, rankAnterior: resultado.rankAnterior, novoRank: resultado.novoRank });
  } else {
    res.status(500).json({ ok: false, motivo: resultado.motivo });
  }
});

// ============================================
// Inicia
// ============================================

app.listen(CONFIG.porta, () => {
  console.log(`🚀 Servidor rodando na porta ${CONFIG.porta}`);
});

iniciarBot();
