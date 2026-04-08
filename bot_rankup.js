const express = require("express");
const noblox = require("noblox.js");

const app = express();
app.use(express.json());

// ============================================
// CONFIGURAÇÕES — edite aqui
// ============================================
const CONFIG = {
  cookie: "_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_CAEaAhADIhsKBGR1aWQSEzg3MDczMjM0Njk1NDk3MTkxMzUoBA.fHjvFso0xq4KUiQckcns8fyDhQCgPvAo7LXyNByVG_Lu7nWgGzAZGQ-sBEXwnOFXAZg8uoO8XgRVQFkcvK5TzgCXNDkQokfDl2XFvKnYQtzoeVqTDhdmulGtxoP-kQNU36lUeR8TLarZjA4aCAnMvr1XVRGTH5o-imsOMbcI_PoIFEBGNO8954oF1ZVQ9rya6Dll_seY_5xplebGI5aSsLgHZ2O0NNrJk3WDiJMoCy7b8maflrYmv0gikofT1bfLdDC0fWOAZEj9glkCRhZi8-I-ggLtj9mVb-mzNNyagPMoPjdBeecJkqQaiL77_kxEoDxKEklywUvFGm3OwdCu2naitwC0OT7-ETtDfYNlp9jtxLlc-eJ6ax7gjZpnBCkoOXicboPF7PF4sFOyF_eUEjjGI8oRDxynxGz0exRax6GHEN0JO5728IKbR2WEAphiXocCEXK1N4NrcYR2uB6uttNS8yMuDphxlgjBVkC63MtXXX7Q6pbCNAiEm88C-IuTo1ALfZT1qECj8RtpEEomdebi1k_8_-rkziS_7dYjjpo2ghjUQB1QBE5ArGETv8HNpGNxmh6VMpMgbq1c-hYq5LM2YzhtPAlXm88DNlfxHZ1nUpjrHf2SN_vy65P7KC-w-APKi_Isph4uvRiEvw976ioAP63vkUeJ-B5mln_1BThkyVAE97A0Hz2-DrOhN_NBMcPreC8CwDa4HNHIAGF_K8xZ9U3p2Yba0gzd2G-EnaoKn2VnTqAqi_TGqFfrC0F0cW1aZcYmO9gmcwBYzcVCgoLfj86LTr5j-43Phjtfm99jjZaY",  // .ROBLOSECURITY da conta bot
  groupId: 343683389,          // ID do seu grupo
  porta: process.env.PORT || 3000,
  rankMinimoBloqueio: 25,      // Rank 25 ou acima = sem up
  rankEntrada: 4,              // Rank dado automaticamente ao entrar pela GUI
};
// ============================================

let botLogado = false;

async function iniciarBot(tentativa = 1) {
  console.log(`🔄 Tentativa de login ${tentativa}...`);
  try {
    let cookie = CONFIG.cookie.trim();
    if (!cookie.startsWith("_|WARNING")) {
      cookie = "_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_" + cookie;
    }
    await noblox.setCookie(cookie);
    const info = await noblox.getCurrentUser();
    console.log(`✅ Bot logado como: ${info.UserName} (ID: ${info.UserID})`);
    botLogado = true;
  } catch (err) {
    console.error(`❌ Erro ao logar:`, err.message);
    if (tentativa < 5) {
      setTimeout(() => iniciarBot(tentativa + 1), 10000);
    }
  }
}

async function getRankAtual(userId) {
  try { return await noblox.getRankInGroup(CONFIG.groupId, userId); } 
  catch (err) { return null; }
}

async function getRoles() {
  try { return await noblox.getRoles(CONFIG.groupId); } 
  catch (err) { return []; }
}

async function darRankUp(userId, username, upsSolicitados) {
  try {
    const rankAtual = await getRankAtual(userId);
    if (rankAtual === null) throw new Error("Não foi possível obter o rank atual");
    if (rankAtual === 0) throw new Error(`${username} não está no grupo`);
    if (rankAtual >= CONFIG.rankMinimoBloqueio) {
      return { sucesso: false, motivo: "Jogador já está no limite de rank" };
    }

    const roles = await getRoles();
    roles.sort((a, b) => a.rank - b.rank);

    const indexAtual = roles.findIndex((r) => r.rank === rankAtual);
    if (indexAtual === -1) throw new Error("Rank atual não encontrado");

    // Limita para não passar do limite estipulado pelo array de roles
    const novoIndex = Math.min(indexAtual + upsSolicitados, roles.length - 1);

    if (novoIndex === indexAtual) {
      return { sucesso: false, motivo: "Usuário já está no rank máximo" };
    }

    const novoRole = roles[novoIndex];
    await noblox.setRank(CONFIG.groupId, userId, novoRole.id);

    console.log(`✅ Rank up: ${username} | ${roles[indexAtual].name} → ${novoRole.name}`);
    return { sucesso: true, rankAnterior: roles[indexAtual].name, novoRank: novoRole.name };
  } catch (err) {
    return { sucesso: false, motivo: err.message };
  }
}

app.get("/", (req, res) => res.json({ ok: true, logado: botLogado }));

app.post("/rankup", async (req, res) => {
  if (!botLogado) return res.status(503).json({ erro: "Bot offline" });

  const { userId, username, ups } = req.body; // Pega os UPS enviados pelo script
  if (!userId || !username || !ups) return res.status(400).json({ erro: "Dados incompletos" });

  const resultado = await darRankUp(Number(userId), username, Number(ups));

  if (resultado.sucesso) {
    res.json({ ok: true, rankAnterior: resultado.rankAnterior, novoRank: resultado.novoRank });
  } else {
    res.status(500).json({ ok: false, motivo: resultado.motivo });
  }
});

// ============================================
//  NOVO ENDPOINT — /entrar
//  Aceita pedido pendente no grupo e seta rank 4
// ============================================
app.post("/entrar", async (req, res) => {
  if (!botLogado) return res.status(503).json({ ok: false, erro: "Bot offline" });

  const { userId, username } = req.body;
  if (!userId || !username) {
    return res.status(400).json({ ok: false, erro: "userId e username são obrigatórios" });
  }

  const uid = Number(userId);
  if (!uid || isNaN(uid)) {
    return res.status(400).json({ ok: false, erro: "userId inválido" });
  }

  try {
    // 1. Tenta aceitar o pedido pendente
    // noblox.js usa handleJoinRequest com action "accept"
    try {
      await noblox.handleJoinRequest(CONFIG.groupId, uid, true);
      console.log(`✅ Pedido aceito: ${username} (${uid})`);
    } catch (e) {
      // Pode não ter pedido pendente (já está no grupo) — ignora
      console.warn(`⚠️ handleJoinRequest: ${e.message}`);
    }

    // 2. Aguarda 1s para o Roblox processar
    await new Promise(r => setTimeout(r, 1000));

    // 3. Busca os roles e seta rank 4
    const roles = await getRoles();
    roles.sort((a, b) => a.rank - b.rank);

    const roleAlvo = roles.find(r => r.rank === CONFIG.rankEntrada);
    if (!roleAlvo) {
      return res.status(500).json({ ok: false, erro: `Rank ${CONFIG.rankEntrada} não encontrado no grupo` });
    }

    await noblox.setRank(CONFIG.groupId, uid, roleAlvo.id);
    console.log(`✅ Rank setado: ${username} → ${roleAlvo.name} (rank ${CONFIG.rankEntrada})`);

    return res.json({
      ok: true,
      mensagem: `${username} aceito e setado para ${roleAlvo.name}`,
      rank: roleAlvo.name,
    });

  } catch (err) {
    console.error(`❌ Erro no /entrar:`, err.message);
    return res.status(500).json({ ok: false, erro: err.message });
  }
});

app.listen(CONFIG.porta, () => console.log(`🚀 Servidor rodando na porta ${CONFIG.porta}`));
iniciarBot();
