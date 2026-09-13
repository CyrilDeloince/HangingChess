const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/js/chess.lib.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', 'chess.js', 'chess.js'));
});

const rooms = {};
const WORDS_EN = [
    'CHECKMATE','STRATEGY','TREASURE','CHAMPION','DINOSAUR','BUTTERFLY',
    'ELEPHANT','FORTRESS','MUSHROOM','NOTEBOOK','PARADISE','SANDWICH',
    'UMBRELLA','WORKSHOP','KANGAROO','JUKEBOX','MYSTERY','VOLCANO',
    'DOLPHIN','PHOENIX','CRYSTAL','PHANTOM','TORNADO','CAPTAIN',
    'KINGDOM','DIAMOND','JOURNEY','HARVEST','SILENCE','BALANCE'
];
const WORDS_FR = [
    'CAVALIER','STRATEGIE','AVENTURE','CHOCOLAT','FANTOME','MYSTERE',
    'VICTOIRE','DIAMANT','TRESOR','LUMIERE','PARADIS','SORCIER',
    'HARMONIE','GALAXIE','BONHEUR','OISEAU','JARDIN','QUARTIER',
    'NOISETTE','REPONSE','UNIVERS','PEINTURE','MONTAGNE','HORIZON',
    'ELEPHANT','CHAMPION','CAPITAINE','BATAILLE','COURONNE','ETOILE'
];

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function randomWord(lang) {
    const list = lang === 'fr' ? WORDS_FR : WORDS_EN;
    return list[Math.floor(Math.random() * list.length)];
}

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('create-room', ({ lang, timeControl }) => {
        let code;
        do { code = generateRoomCode(); } while (rooms[code]);
        rooms[code] = {
            players: [socket],
            lang: lang || 'en',
            timeControl: timeControl || 0,
            words: {},
            started: false
        };
        socket.roomCode = code;
        socket.playerIndex = 0;
        socket.join(code);
        socket.emit('room-created', { code });
        console.log(`Room created: ${code}`);
    });

    socket.on('join-room', ({ code, lang }) => {
        code = code.toUpperCase();
        const room = rooms[code];
        if (!room) return socket.emit('error-msg', { message: 'Room not found' });
        if (room.players.length >= 2) return socket.emit('error-msg', { message: 'Room is full' });

        room.players.push(socket);
        socket.roomCode = code;
        socket.playerIndex = 1;
        socket.join(code);

        const useLang = room.lang || lang || 'en';
        const word0 = randomWord(useLang);
        const word1 = randomWord(useLang);
        room.words = { 0: word0, 1: word1 };
        room.started = true;

        room.players[0].emit('game-start', { color: 'w', hangmanWord: word0, opponentHangmanLength: word1.length, timeControl: room.timeControl || 0 });
        room.players[1].emit('game-start', { color: 'b', hangmanWord: word1, opponentHangmanLength: word0.length, timeControl: room.timeControl || 0 });
        console.log(`Game started in room ${code}`);
    });

    socket.on('chess-move', (data) => {
        if (!socket.roomCode) return;
        socket.to(socket.roomCode).emit('chess-move', data);
    });

    socket.on('ttt-move', (data) => {
        if (!socket.roomCode) return;
        socket.to(socket.roomCode).emit('ttt-move', data);
    });

    socket.on('hangman-guess', (data) => {
        if (!socket.roomCode) return;
        socket.to(socket.roomCode).emit('hangman-guess', data);
    });

    socket.on('skip-hangman', () => {
        if (!socket.roomCode) return;
        socket.to(socket.roomCode).emit('skip-hangman');
    });

    socket.on('game-won', (data) => {
        if (!socket.roomCode) return;
        socket.to(socket.roomCode).emit('game-won', data);
    });

    socket.on('resign', () => {
        if (!socket.roomCode) return;
        socket.to(socket.roomCode).emit('opponent-resigned');
    });

    socket.on('rematch-request', () => {
        if (!socket.roomCode) return;
        socket.to(socket.roomCode).emit('rematch-request');
    });

    socket.on('rematch-accept', () => {
        const code = socket.roomCode;
        if (!code || !rooms[code]) return;
        const room = rooms[code];
        const useLang = room.lang || 'en';
        const word0 = randomWord(useLang);
        const word1 = randomWord(useLang);
        room.words = { 0: word0, 1: word1 };
        room.players[0].emit('game-start', { color: 'b', hangmanWord: word0, opponentHangmanLength: word1.length, timeControl: room.timeControl || 0 });
        room.players[1].emit('game-start', { color: 'w', hangmanWord: word1, opponentHangmanLength: word0.length, timeControl: room.timeControl || 0 });
    });

    socket.on('chat-message', (data) => {
        if (!socket.roomCode) return;
        socket.to(socket.roomCode).emit('chat-message', data);
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        const code = socket.roomCode;
        if (code && rooms[code]) {
            socket.to(code).emit('opponent-disconnected');
            rooms[code].players = rooms[code].players.filter(p => p.id !== socket.id);
            if (rooms[code].players.length === 0) {
                delete rooms[code];
                console.log(`Room ${code} deleted`);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  ♔ HangingChess server running at http://localhost:${PORT}\n`);
});
