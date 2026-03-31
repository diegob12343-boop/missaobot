const express = require("express");
const noblox = require("noblox.js");

const app = express();
app.use(express.json());

// ============================================
// CONFIGURAÇÕES — edite aqui
// ============================================
const CONFIG = {
  cookie: "SEU_COOKIE_AQUI",  // .ROBLOSECURITY da conta bot
  groupId: 123456789,          // ID do seu grupo
  rankUpAmount: 2,             // Quantos ranks subir
  targetRankId: null,          // null = sobe ranks | número = rank fixo
  porta: process.env.PORT || 3000,
  rankMinimoBloqueio: 25,      // Rank 25 ou acima = sem up
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
    if (rankAtual >= CONFIG.rankMinimoBloqueio) {
      console.log(`🚫 ${username} está no rank ${rankAtual} (rank 25 ou acima), sem up.`);
      return { sucesso: false, motivo: "Jogador já está no limite de rank" };
    }

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
