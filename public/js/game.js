/* ───────────────────────── WORD LISTS ───────────────────────── */
const WORDS = {
    en: [
        'CHECKMATE','STRATEGY','TREASURE','CHAMPION','DINOSAUR','BUTTERFLY',
        'ELEPHANT','FORTRESS','MUSHROOM','NOTEBOOK','PARADISE','SANDWICH',
        'UMBRELLA','WORKSHOP','KANGAROO','MYSTERY','VOLCANO','DOLPHIN',
        'PHOENIX','CRYSTAL','PHANTOM','TORNADO','CAPTAIN','KINGDOM',
        'DIAMOND','JOURNEY','HARVEST','SILENCE','BALANCE','LANTERN'
    ],
    fr: [
        'CAVALIER','STRATEGIE','AVENTURE','CHOCOLAT','FANTOME','MYSTERE',
        'VICTOIRE','DIAMANT','TRESOR','LUMIERE','PARADIS','SORCIER',
        'HARMONIE','GALAXIE','BONHEUR','OISEAU','JARDIN','QUARTIER',
        'NOISETTE','REPONSE','UNIVERS','PEINTURE','MONTAGNE','HORIZON',
        'CHAMPION','BATAILLE','COURONNE','ETOILE','VOLCAN','CHATEAU'
    ]
};

function randomWord() {
    const list = WORDS[currentLang] || WORDS.en;
    return list[Math.floor(Math.random() * list.length)];
}

/* ───────────────────────── TIC-TAC-TOE ───────────────────────── */
class TicTacToe {
    constructor() {
        this.board = Array(9).fill(null);
        this.history = [];
    }

    move(pos, player) {
        if (this.board[pos] !== null) return false;
        this.board[pos] = player;
        this.history.push({ pos, player });
        return true;
    }

    checkWin() {
        const lines = [
            [0,1,2],[3,4,5],[6,7,8],
            [0,3,6],[1,4,7],[2,5,8],
            [0,4,8],[2,4,6]
        ];
        for (const [a,b,c] of lines) {
            if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
                return { winner: this.board[a], line: [a,b,c] };
            }
        }
        return null;
    }

    getValidMoves() {
        return this.board.map((v,i) => v === null ? i : -1).filter(i => i >= 0);
    }

    isFull() {
        return this.board.every(v => v !== null);
    }

    clone() {
        const c = new TicTacToe();
        c.board = [...this.board];
        return c;
    }
}

/* TTT Bot AI - Minimax (perfect play) */
function tttMinimax(board, player, depth) {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,b,c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a] === 'X' ? { score: 10 - depth } : { score: depth - 10 };
        }
    }
    const empty = board.map((v,i) => v === null ? i : -1).filter(i => i >= 0);
    if (empty.length === 0) return { score: 0 };

    const isMax = player === 'X';
    let best = { score: isMax ? -Infinity : Infinity, pos: empty[0] };
    for (const pos of empty) {
        board[pos] = player;
        const result = tttMinimax(board, player === 'X' ? 'O' : 'X', depth + 1);
        board[pos] = null;
        if (isMax ? result.score > best.score : result.score < best.score) {
            best = { score: result.score, pos };
        }
    }
    return best;
}

function getBestTTTMove(ttt, player, difficulty) {
    const valid = ttt.getValidMoves();
    if (valid.length === 0) return -1;
    if (difficulty === 'easy') {
        return valid[Math.floor(Math.random() * valid.length)];
    }
    if (difficulty === 'medium') {
        if (Math.random() < 0.3) return valid[Math.floor(Math.random() * valid.length)];
    }
    const board = [...ttt.board];
    const result = tttMinimax(board, player, 0);
    return result.pos;
}

/* ───────────────────────── HANGMAN ───────────────────────── */
class Hangman {
    constructor(word) {
        this.word = word.toUpperCase();
        this.guessed = [];
        this.wrongCount = 0;
        this.maxWrong = 6;
        this.won = false;
        this.lost = false;
    }

    guess(letter) {
        letter = letter.toUpperCase();
        if (this.guessed.includes(letter) || this.won || this.lost) return null;
        this.guessed.push(letter);
        if (!this.word.includes(letter)) {
            this.wrongCount++;
            if (this.wrongCount >= this.maxWrong) this.lost = true;
            return false;
        }
        if (this.word.split('').every(c => this.guessed.includes(c))) {
            this.won = true;
        }
        return true;
    }

    getDisplay() {
        return this.word.split('').map(c => this.guessed.includes(c) ? c : '_').join(' ');
    }

    getRevealedCount() {
        return this.word.split('').filter(c => this.guessed.includes(c)).length;
    }

    isFinished() { return this.won || this.lost; }
}

const LETTER_FREQ_EN = 'ETAOINSHRDLCUMWFGYPBVKJXQZ';
const LETTER_FREQ_FR = 'ESAITNRULODCMPGBVHFQYXJKWZ';

function getBestHangmanGuess(hangman, difficulty) {
    const freq = currentLang === 'fr' ? LETTER_FREQ_FR : LETTER_FREQ_EN;
    const available = freq.split('').filter(l => !hangman.guessed.includes(l));
    if (available.length === 0) return null;

    if (difficulty === 'easy') {
        const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => !hangman.guessed.includes(l));
        return allLetters[Math.floor(Math.random() * allLetters.length)];
    }
    if (difficulty === 'medium') {
        if (Math.random() < 0.3) {
            const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => !hangman.guessed.includes(l));
            return allLetters[Math.floor(Math.random() * allLetters.length)];
        }
    }
    return available[0];
}

/* ───────────────────────── CHESS BOT AI ───────────────────────── */
const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

const PAWN_TABLE = [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0
];
const KNIGHT_TABLE = [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
];
const BISHOP_TABLE = [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
];

function getPST(type) {
    switch(type) {
        case 'p': return PAWN_TABLE;
        case 'n': return KNIGHT_TABLE;
        case 'b': return BISHOP_TABLE;
        default: return null;
    }
}

function evaluateBoard(chess) {
    if (chess.in_checkmate()) {
        return chess.turn() === 'w' ? -99999 : 99999;
    }
    if (chess.in_stalemate() || chess.in_draw()) return 0;

    let score = 0;
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece) continue;
            let value = PIECE_VALUES[piece.type] || 0;
            const pst = getPST(piece.type);
            if (pst) {
                const idx = piece.color === 'w' ? (r * 8 + c) : ((7 - r) * 8 + c);
                value += pst[idx];
            }
            score += piece.color === 'w' ? value : -value;
        }
    }

    if (chess.in_check()) {
        score += chess.turn() === 'w' ? -50 : 50;
    }
    return score;
}

function minimax(chess, depth, alpha, beta, maximizing) {
    if (depth === 0 || chess.game_over()) {
        return evaluateBoard(chess);
    }

    const moves = chess.moves({ verbose: true });
    moves.sort((a, b) => {
        let sa = 0, sb = 0;
        if (a.captured) sa += PIECE_VALUES[a.captured] || 0;
        if (b.captured) sb += PIECE_VALUES[b.captured] || 0;
        if (a.flags.includes('p')) sa += 800;
        if (b.flags.includes('p')) sb += 800;
        return sb - sa;
    });

    if (maximizing) {
        let maxEval = -Infinity;
        for (const move of moves) {
            chess.move(move);
            const val = minimax(chess, depth - 1, alpha, beta, false);
            chess.undo();
            maxEval = Math.max(maxEval, val);
            alpha = Math.max(alpha, val);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            chess.move(move);
            const val = minimax(chess, depth - 1, alpha, beta, true);
            chess.undo();
            minEval = Math.min(minEval, val);
            beta = Math.min(beta, val);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function getBestChessMove(chess, difficulty) {
    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) return null;

    if (difficulty === 'easy') {
        const captures = moves.filter(m => m.captured);
        if (captures.length > 0 && Math.random() < 0.3) {
            return captures[Math.floor(Math.random() * captures.length)];
        }
        return moves[Math.floor(Math.random() * moves.length)];
    }

    const searchDepth = difficulty === 'hard' ? 3 : 2;
    const isMax = chess.turn() === 'w';
    let bestMove = moves[0];
    let bestVal = isMax ? -Infinity : Infinity;

    for (const move of moves) {
        chess.move(move);
        const val = minimax(chess, searchDepth - 1, -Infinity, Infinity, !isMax);
        chess.undo();

        if (isMax ? val > bestVal : val < bestVal) {
            bestVal = val;
            bestMove = move;
        }
    }

    if (difficulty === 'medium' && Math.random() < 0.15) {
        return moves[Math.floor(Math.random() * moves.length)];
    }

    return bestMove;
}

/* ───────────────────── GAME CLOCK ───────────────────── */
class GameClock {
    constructor(timeMs) {
        this.white = timeMs;
        this.black = timeMs;
        this.active = null;
        this.lastTick = null;
        this.interval = null;
        this.onTick = null;
        this.onTimeout = null;
    }

    start(color) {
        this.active = color;
        this.lastTick = Date.now();
        if (!this.interval) {
            this.interval = setInterval(() => this.tick(), 100);
        }
    }

    tick() {
        if (!this.active || !this.lastTick) return;
        const now = Date.now();
        const elapsed = now - this.lastTick;
        this.lastTick = now;

        if (this.active === 'w') {
            this.white = Math.max(0, this.white - elapsed);
            if (this.white <= 0) { this.stop(); if (this.onTimeout) this.onTimeout('w'); return; }
        } else {
            this.black = Math.max(0, this.black - elapsed);
            if (this.black <= 0) { this.stop(); if (this.onTimeout) this.onTimeout('b'); return; }
        }
        if (this.onTick) this.onTick();
    }

    switchTo(color) {
        this.active = color;
        this.lastTick = Date.now();
    }

    pause() { this.active = null; }

    stop() {
        this.active = null;
        if (this.interval) { clearInterval(this.interval); this.interval = null; }
    }

    getTime(color) { return color === 'w' ? this.white : this.black; }

    formatTime(color) {
        const ms = this.getTime(color);
        const totalSec = Math.max(0, Math.ceil(ms / 1000));
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        return `${min}:${sec.toString().padStart(2, '0')}`;
    }
}

/* ───────────────────── COMBINED GAME ───────────────────── */
class CombinedGame {
    constructor(opts = {}) {
        this.mode = opts.mode || 'bot';
        this.difficulty = opts.difficulty || 'medium';
        this.playerColor = opts.playerColor || 'w';
        this.chess = new Chess();
        this.ttt = new TicTacToe();
        this.playerHangman = new Hangman(opts.playerWord || randomWord());
        this.opponentHangman = new Hangman(opts.opponentWord || randomWord());
        this.positions = [this.chess.fen()];
        this.phase = 'chess';
        this.activeTurnColor = 'w';
        this.gameOver = false;
        this.winner = null;
        this.winReason = null;
        this.moveLog = [];
        this.turnNumber = 0;
        this.lastCapture = false;
        this.pendingTTTPlayer = null;
        this.opponentHangmanDisplay = this.opponentHangman.getDisplay();
        this.timeControl = opts.timeControl || 0;
        this.clock = null;
        this.clockStarted = false;
        if (this.timeControl > 0) {
            this.clock = new GameClock(this.timeControl);
            this.clock.onTimeout = (color) => {
                const isPlayerTimeout = color === this.playerColor;
                this.endGame(
                    isPlayerTimeout ? this.opponentColor : this.playerColor,
                    isPlayerTimeout ? 'loseByTimeout' : 'winByTimeout'
                );
            };
        }
        this.onUpdate = opts.onUpdate || (() => {});
        this.onPhaseChange = opts.onPhaseChange || (() => {});
        this.onGameOver = opts.onGameOver || (() => {});
    }

    get currentTurn() {
        return this.activeTurnColor;
    }

    get isPlayerTurn() {
        return this.activeTurnColor === this.playerColor;
    }

    get opponentColor() {
        return this.playerColor === 'w' ? 'b' : 'w';
    }

    get tttPlayerMark() {
        return this.playerColor === 'w' ? 'X' : 'O';
    }

    get tttOpponentMark() {
        return this.playerColor === 'w' ? 'O' : 'X';
    }

    getHangmanForTurn(turn) {
        return turn === this.playerColor ? this.playerHangman : this.opponentHangman;
    }

    makeChessMove(from, to, promotion) {
        if (this.gameOver || this.phase !== 'chess') return null;

        const move = this.chess.move({ from, to, promotion: promotion || 'q' });
        if (!move) return null;

        if (this.clock && !this.clockStarted) {
            this.clock.start(this.activeTurnColor);
            this.clockStarted = true;
        }

        this.lastCapture = !!move.captured;
        this.moveLog.push({
            turn: this.turnNumber,
            player: this.activeTurnColor,
            type: 'chess',
            move: move.san,
            captured: move.captured,
            check: this.chess.in_check(),
            checkmate: this.chess.in_checkmate()
        });

        this.positions.push(this.chess.fen());

        if (this.chess.in_checkmate()) {
            const isPlayerWin = this.activeTurnColor === this.playerColor;
            this.endGame(this.activeTurnColor, isPlayerWin ? 'winByCheckmate' : 'loseByCheckmate');
            return move;
        }
        if (this.chess.in_stalemate() || this.chess.in_draw()) {
            this.endGame(null, 'stalemate');
            return move;
        }

        if (this.lastCapture) {
            this.phase = 'ttt';
            this.pendingTTTPlayer = this.activeTurnColor === this.playerColor ? this.tttPlayerMark : this.tttOpponentMark;
            this.onPhaseChange('ttt');
        } else {
            this.phase = 'hangman';
            this.onPhaseChange('hangman');
        }

        this.onUpdate();
        return move;
    }

    makeTTTMove(pos) {
        if (this.gameOver || this.phase !== 'ttt') return false;

        const player = this.pendingTTTPlayer;
        if (!this.ttt.move(pos, player)) return false;

        this.moveLog.push({
            turn: this.turnNumber,
            player: this.activeTurnColor,
            type: 'ttt',
            pos,
            mark: player
        });

        const win = this.ttt.checkWin();
        if (win) {
            const isPlayerWin = this.activeTurnColor === this.playerColor;
            this.endGame(
                this.activeTurnColor,
                isPlayerWin ? 'winByTTT' : 'loseByTTT'
            );
            return true;
        }

        this.phase = 'hangman';
        this.onPhaseChange('hangman');
        this.onUpdate();
        return true;
    }

    makeHangmanGuess(letter) {
        if (this.gameOver || this.phase !== 'hangman') return null;

        const hangman = this.getHangmanForCurrentPhase();
        if (hangman.isFinished()) {
            this.advanceToNextTurn();
            return null;
        }

        const result = hangman.guess(letter);
        if (result === null) return null;

        this.moveLog.push({
            turn: this.turnNumber,
            player: this.activeTurnColor,
            type: 'hangman',
            letter,
            correct: result
        });

        if (hangman.won) {
            const isPlayerWin = this.activeTurnColor === this.playerColor;
            this.endGame(
                this.activeTurnColor,
                isPlayerWin ? 'winByHangman' : 'loseByHangman'
            );
            return result;
        }

        this.advanceToNextTurn();
        this.onUpdate();
        return result;
    }

    getHangmanForCurrentPhase() {
        return this.activeTurnColor === this.playerColor ? this.playerHangman : this.opponentHangman;
    }

    skipHangman() {
        if (this.phase !== 'hangman') return;
        this.advanceToNextTurn();
        this.onUpdate();
    }

    advanceToNextTurn() {
        this.turnNumber++;
        this.activeTurnColor = this.activeTurnColor === 'w' ? 'b' : 'w';
        this.phase = 'chess';
        this.pendingTTTPlayer = null;
        this.lastCapture = false;
        if (this.clock && this.clockStarted) {
            this.clock.switchTo(this.activeTurnColor);
        }
        this.onPhaseChange('chess');
    }

    endGame(winnerColor, reason) {
        this.gameOver = true;
        this.winner = winnerColor;
        this.winReason = reason;
        if (this.clock) this.clock.stop();
        this.onGameOver({ winner: winnerColor, reason });
    }

    async botTurn() {
        if (this.gameOver || this.isPlayerTurn) return;

        await sleep(400 + Math.random() * 600);
        if (this.gameOver) return;

        const chessMove = getBestChessMove(this.chess, this.difficulty);
        if (!chessMove) { this.skipHangman(); return; }
        const result = this.makeChessMove(chessMove.from, chessMove.to, chessMove.promotion);
        if (!result || this.gameOver) return;

        if (this.phase === 'ttt') {
            await sleep(300 + Math.random() * 400);
            if (this.gameOver) return;
            const tttMove = getBestTTTMove(this.ttt, this.tttOpponentMark, this.difficulty);
            if (tttMove >= 0) {
                this.makeTTTMove(tttMove);
            } else {
                this.phase = 'hangman';
                this.onPhaseChange('hangman');
            }
            if (this.gameOver) return;
        }

        if (this.phase === 'hangman') {
            await sleep(300 + Math.random() * 400);
            if (this.gameOver) return;
            if (!this.opponentHangman.isFinished()) {
                const letter = getBestHangmanGuess(this.opponentHangman, this.difficulty);
                if (letter) {
                    this.makeHangmanGuess(letter);
                } else {
                    this.skipHangman();
                }
            } else {
                this.skipHangman();
            }
        }
    }

    getAnalysis() {
        const playerMoves = this.moveLog.filter(m => m.player === this.playerColor);
        const opponentMoves = this.moveLog.filter(m => m.player === this.opponentColor);

        const playerChessMoves = playerMoves.filter(m => m.type === 'chess');
        const opponentChessMoves = opponentMoves.filter(m => m.type === 'chess');
        const playerCaptures = playerChessMoves.filter(m => m.captured);
        const opponentCaptures = opponentChessMoves.filter(m => m.captured);

        const playerTTTMoves = playerMoves.filter(m => m.type === 'ttt');
        const opponentTTTMoves = opponentMoves.filter(m => m.type === 'ttt');

        const playerHangmanGuesses = playerMoves.filter(m => m.type === 'hangman');
        const opponentHangmanGuesses = opponentMoves.filter(m => m.type === 'hangman');

        const keyMoments = [];
        this.moveLog.forEach((entry, i) => {
            if (entry.type === 'chess' && entry.captured) {
                keyMoments.push({
                    turn: entry.turn,
                    text: `${entry.player === this.playerColor ? t('you') : t('opponent')} captured a piece (${entry.move}) → Tic-Tac-Toe move earned`
                });
            }
            if (entry.type === 'chess' && entry.checkmate) {
                keyMoments.push({
                    turn: entry.turn,
                    text: `♔ ${entry.player === this.playerColor ? t('you') : t('opponent')} - Checkmate!`
                });
            }
            if (entry.type === 'chess' && entry.check && !entry.checkmate) {
                keyMoments.push({
                    turn: entry.turn,
                    text: `⚡ ${entry.player === this.playerColor ? t('you') : t('opponent')} - Check!`
                });
            }
        });

        const tips = [];
        if (playerCaptures.length < opponentCaptures.length) {
            tips.push(currentLang === 'fr'
                ? 'Essayez de capturer plus de pièces pour gagner des coups au morpion.'
                : 'Try to capture more pieces to earn Tic-Tac-Toe moves.');
        }
        if (playerHangmanGuesses.filter(g => !g.correct).length > 2) {
            tips.push(currentLang === 'fr'
                ? 'Commencez par les lettres fréquentes (E, A, S, R, T) au pendu.'
                : 'Start with common letters (E, A, R, S, T) in Hangman.');
        }
        if (playerChessMoves.length > 0 && playerCaptures.length === 0) {
            tips.push(currentLang === 'fr'
                ? 'N\'oubliez pas : capturer des pièces est essentiel pour débloquer le morpion !'
                : 'Remember: capturing pieces is essential to unlock Tic-Tac-Toe moves!');
        }
        if (this.ttt.getValidMoves().length > 5) {
            tips.push(currentLang === 'fr'
                ? 'Le morpion est sous-utilisé. Jouez plus agressivement aux échecs !'
                : 'Tic-Tac-Toe is underused. Play more aggressively in chess!');
        }

        return {
            totalMoves: this.moveLog.length,
            player: {
                chessMoves: playerChessMoves.length,
                captures: playerCaptures.length,
                tttMoves: playerTTTMoves.length,
                hangmanGuesses: playerHangmanGuesses.length,
                hangmanCorrect: playerHangmanGuesses.filter(g => g.correct).length,
                hangmanWrong: playerHangmanGuesses.filter(g => !g.correct).length,
            },
            opponent: {
                chessMoves: opponentChessMoves.length,
                captures: opponentCaptures.length,
                tttMoves: opponentTTTMoves.length,
                hangmanGuesses: opponentHangmanGuesses.length,
                hangmanCorrect: opponentHangmanGuesses.filter(g => g.correct).length,
                hangmanWrong: opponentHangmanGuesses.filter(g => !g.correct).length,
            },
            keyMoments,
            tips,
            winner: this.winner,
            winReason: this.winReason
        };
    }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function deepEval(fen, depth) {
    const c = new Chess(fen);
    if (c.game_over()) return evaluateBoard(c);
    const isMax = c.turn() === 'w';
    return minimax(c, depth, -Infinity, Infinity, isMax);
}

function analyzePositions(positions, chessMoves) {
    const results = [];
    for (let i = 0; i < chessMoves.length; i++) {
        const fenBefore = positions[i];
        const fenAfter = positions[i + 1];
        if (!fenBefore || !fenAfter) continue;

        const evalBefore = deepEval(fenBefore, 1);
        const evalAfter = deepEval(fenAfter, 1);

        const isWhite = chessMoves[i].player === 'w';
        const diff = isWhite ? (evalAfter - evalBefore) : (evalBefore - evalAfter);
        const cpLoss = Math.max(0, -diff);

        let quality, qualityIcon;
        if (diff > 80) { quality = 'brilliant'; qualityIcon = '✨'; }
        else if (diff >= -15) { quality = 'good'; qualityIcon = '✅'; }
        else if (cpLoss <= 60) { quality = 'inaccuracy'; qualityIcon = '⚠️'; }
        else if (cpLoss <= 200) { quality = 'mistake'; qualityIcon = '❌'; }
        else { quality = 'blunder'; qualityIcon = '💀'; }

        let comment = '';
        if (chessMoves[i].checkmate) comment = isWhite ? 'Checkmate! Decisive blow.' : 'Checkmate! Game over.';
        else if (chessMoves[i].check) comment = quality === 'good' || quality === 'brilliant' ? 'Strong check!' : 'Check, but there may have been better options.';
        else if (chessMoves[i].captured) comment = quality === 'good' || quality === 'brilliant' ? 'Good capture, material advantage.' : 'Capture, but positional cost.';
        else if (quality === 'brilliant') comment = 'Excellent positional move!';
        else if (quality === 'good') comment = 'Solid move.';
        else if (quality === 'inaccuracy') comment = 'Slight imprecision, a better move was available.';
        else if (quality === 'mistake') comment = 'This move loses material or position.';
        else if (quality === 'blunder') comment = 'Critical error! Significant advantage lost.';

        results.push({
            moveIndex: i,
            move: chessMoves[i].move,
            player: chessMoves[i].player,
            captured: chessMoves[i].captured,
            check: chessMoves[i].check,
            checkmate: chessMoves[i].checkmate,
            evalBefore: evalBefore / 100,
            evalAfter: evalAfter / 100,
            cpLoss: cpLoss / 100,
            quality,
            qualityIcon,
            comment,
            fen: fenAfter
        });
    }

    const playerMoves = results.filter(r => r.player === 'w');
    const blackMoves = results.filter(r => r.player === 'b');

    function estimateElo(moves) {
        if (moves.length === 0) return 800;
        const acpl = moves.reduce((s, m) => s + m.cpLoss, 0) / moves.length;
        if (acpl < 0.15) return 2200;
        if (acpl < 0.30) return 1800;
        if (acpl < 0.50) return 1500;
        if (acpl < 0.80) return 1200;
        if (acpl < 1.20) return 1000;
        if (acpl < 2.00) return 800;
        return 600;
    }

    return {
        moves: results,
        whiteElo: estimateElo(playerMoves),
        blackElo: estimateElo(blackMoves),
        summary: {
            white: {
                brilliant: playerMoves.filter(m => m.quality === 'brilliant').length,
                good: playerMoves.filter(m => m.quality === 'good').length,
                inaccuracy: playerMoves.filter(m => m.quality === 'inaccuracy').length,
                mistake: playerMoves.filter(m => m.quality === 'mistake').length,
                blunder: playerMoves.filter(m => m.quality === 'blunder').length,
                acpl: playerMoves.length ? (playerMoves.reduce((s,m) => s + m.cpLoss, 0) / playerMoves.length).toFixed(2) : 0
            },
            black: {
                brilliant: blackMoves.filter(m => m.quality === 'brilliant').length,
                good: blackMoves.filter(m => m.quality === 'good').length,
                inaccuracy: blackMoves.filter(m => m.quality === 'inaccuracy').length,
                mistake: blackMoves.filter(m => m.quality === 'mistake').length,
                blunder: blackMoves.filter(m => m.quality === 'blunder').length,
                acpl: blackMoves.length ? (blackMoves.reduce((s,m) => s + m.cpLoss, 0) / blackMoves.length).toFixed(2) : 0
            }
        }
    };
}
