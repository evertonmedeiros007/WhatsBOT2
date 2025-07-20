const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const WebSocket = require('ws');
const mysql = require('mysql2/promise');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const wss = new WebSocket.Server({ port: 0 }); // Porta dinâmica para WebSocket

let lastQr = null;
let isConnected = false;

// Controle de estado para queixa
const waitingForComplaint = {}; // { [userId]: true/false }

// Configuração do banco de dados
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gerencia_os',
    charset: 'utf8mb4'
};

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', async (qr) => {
    lastQr = await qrcode.toDataURL(qr); // Gera imagem base64
    isConnected = false;
    broadcast({ type: 'qr', data: lastQr });
    broadcast({ type: 'status', data: 'Desconectado' });
});

client.on('ready', () => {
    isConnected = true;
    broadcast({ type: 'status', data: 'Conectado' });
});

client.on('disconnected', () => {
    isConnected = false;
    broadcast({ type: 'status', data: 'Desconectado' });
    if (lastQr) broadcast({ type: 'qr', data: lastQr });
    client.initialize(); // Reinicializa o cliente para forçar novo QR
});

client.on('message', async (message) => {
    const texto = message.body.trim().toLowerCase();
    const userId = message.from;

    // Se o usuário está aguardando digitar a queixa
    if (waitingForComplaint[userId]) {
        const nomeContato = message._data?.notifyName || message._data?.pushName || userId.split('@')[0];
        const numeroContato = userId.replace('@c.us', '');
        try {
            const conn = await mysql.createConnection(dbConfig);
            const [rows] = await conn.execute("SELECT nome, usuario, contato FROM usuarios WHERE nivel = 'ti'");
            await conn.end();
            if (rows.length > 0) {
                for (const user of rows) {
                    if (user.contato) {
                        // Remove "+" se existir e adiciona o sufixo @c.us
                        let contatoFormatado = user.contato.replace(/[^0-9]/g, '') + '@c.us';
                        await client.sendMessage(
                            contatoFormatado,
                            `Olá, *${user.nome}*, Um novo problema foi identificado e o usuário não conseguiu resolvê-lo por meio do atendimento automático. Solicitamos sua intervenção para análise e suporte.\n\n` +
                            `Dados do contato - \n` +
                            `Nome: ${nomeContato}\n` +
                            `Número: ${numeroContato}\n` +
                            `Queixa: ${message.body}`
                        );
                    }
                }
            }
        } catch (err) {
            console.error('Erro ao consultar técnicos TI:', err);
        }
        await message.reply("Sua solicitação foi enviada para o suporte técnico. Em breve um técnico entrará em contato com você.");
        waitingForComplaint[userId] = false;
        return;
    }

    if ([
        "oi","opa","Opa", "olá", "ola", "menu", "bom dia", "boa tarde", "boa noite",
        "e aí", "fala", "oii", "oiii", "oiê", "oie", "início", "start", "começar",
        "quero atendimento", "preciso de ajuda", "ajuda", "atendimento", "suporte"
      ].includes(texto)) {
        await message.reply(
            "👋 Olá! Seja bem-vindo, escolha a opção desejada.\n\n" +
            "Por favor, escolha uma opção:\n" +
            "1️⃣ Abrir uma Ordem de Serviço\n" +
            "2️⃣ Consultar uma Ordem de Serviço\n" +
            "3️⃣ Falar com suporte\n" +
            "4️⃣ Informações gerais\n\n" +
            "Digite o número da opção desejada. 📲"
        );
    } else if (texto === "1") {
        await message.reply(
            "🔧 Para abrir uma nova Ordem de Serviço, por favor acesse o link abaixo e preencha o formulário:\n\n" +
            "👉 TI/cliente_os.php\n\n" +
            "Caso tenha dúvidas, digite *3* para falar com o suporte"
        );
    } else if (texto === "2") {
        await message.reply(
            "📄 Para consultar o status da sua OS, acesse o link:\n\n" +
            "👉 TI/consulta_os.php\n\n" +
            "Você precisará do número da sua OS."
        );
    } else if (texto === "3") {
        await message.reply(
            "Por favor, descreva brevemente o seu problema. Assim que enviar, um técnico será notificado."
        );
        waitingForComplaint[userId] = true;
        return;
    } else if (texto === "4") {
        await message.reply(
            "ℹ️ Informações gerais: Nosso sistema IPUBI_OS está disponível 24h para você!"
        );
    } else if (texto.includes("bom dia")) {
        await message.reply("🌞 Bom dia! Como posso te ajudar hoje? Digite *menu* para ver as opções.");
    } else if (texto.includes("boa tarde")) {
        await message.reply("🌇 Boa tarde! Como posso te ajudar? Digite *menu* para ver as opções.");
    } else if (texto.includes("boa noite")) {
        await message.reply("🌙 Boa noite! Em que posso te ajudar? Digite *menu* para ver as opções.");
    }
});

client.initialize();

// Função para enviar mensagem a todos os clientes conectados
function broadcast(msg) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(msg));
        }
    });
}

// Quando um novo cliente conecta, envia o último QR e status
wss.on('connection', ws => {
    if (lastQr) ws.send(JSON.stringify({ type: 'qr', data: lastQr }));
    ws.send(JSON.stringify({ type: 'status', data: isConnected ? 'Conectado' : 'Desconectado' }));
});

// Endpoint para envio de mensagem via HTTP
app.post('/send', async (req, res) => {
    const { numero, mensagem } = req.body;
    
    if (!isConnected) {
        return res.status(400).json({ ok: false, error: 'WhatsApp não está conectado.' });
    }
    
    if (!numero || !mensagem) {
        return res.status(400).json({ ok: false, error: 'Número e mensagem são obrigatórios.' });
    }
    
    try {
        // Normalizar o número
        const numeroLimpo = numero.replace(/\D/g, '');
        const numeroFormatado = numeroLimpo + '@c.us';
        
        await client.sendMessage(numeroFormatado, mensagem);
        console.log(`[BOT] Mensagem enviada para ${numeroLimpo}: ${mensagem.substring(0, 50)}...`);
        
        res.json({ ok: true, message: 'Mensagem enviada com sucesso.' });
    } catch (err) {
        console.error('[BOT] Erro ao enviar mensagem:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

// Endpoint para status do bot
app.get('/status', (req, res) => {
    res.json({
        conectado: isConnected,
        status: isConnected ? 'Conectado' : 'Desconectado',
        qr_code: lastQr
    });
});

// Endpoint para obter QR code
app.get('/qr', (req, res) => {
    if (isConnected) {
        res.json({ 
            has_qr: false, 
            message: 'WhatsApp já está conectado' 
        });
    } else if (lastQr) {
        res.json({ 
            has_qr: true, 
            qr_code: lastQr 
        });
    } else {
        res.json({ 
            has_qr: false, 
            message: 'QR Code não disponível' 
        });
    }
});

// Iniciar servidor HTTP na porta 65535
const PORT = 65535;
app.listen(PORT, () => {
    console.log(`[BOT] Servidor HTTP rodando na porta ${PORT}`);
    console.log(`[BOT] WebSocket rodando na porta ${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[BOT] Erro: Porta ${PORT} já está em uso!`);
        console.error('[BOT] Soluções:');
        console.error('1. Feche outros processos que possam estar usando a porta');
        console.error('2. Ou altere a porta no código (linha 187)');
        process.exit(1);
    } else {
        console.error('[BOT] Erro ao iniciar servidor:', err);
        process.exit(1);
    }
}); 