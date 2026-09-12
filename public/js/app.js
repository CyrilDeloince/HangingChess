/* ═══════════ HANGINGCHESS - Main Application ═══════════ */

let game = null;
let socket = null;
let selectedSquare = null;
let validMoves = [];
let boardFlipped = false;
let selectedTimeControl = 0;
let soundEnabled = JSON.parse(localStorage.getItem('hangingchess-sound') ?? 'true');

const PIECE_UNICODE = {
    wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
    bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟'
};

/* ═══════════ SOUND SYSTEM ═══════════ */
let audioCtx = null;

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!soundEnabled) return;
    try {
        initAudio();
        switch (type) {
            case 'move': playTone(220, 0.06, 'sine', 0.15); break;
            case 'capture': playNoise(0.08, 0.3); playTone(160, 0.1, 'sine', 0.2); break;
            case 'check': playTone(440, 0.12, 'square', 0.15); playTone(660, 0.12, 'square', 0.15, 0.1); break;
            case 'ttt': playTone(523, 0.06, 'sine', 0.2); break;
            case 'hangmanCorrect': playTone(523, 0.08, 'sine', 0.15); playTone(659, 0.08, 'sine', 0.15, 0.08); break;
            case 'hangmanWrong': playTone(180, 0.15, 'sawtooth', 0.12); break;
            case 'win': playTone(523, 0.12, 'sine', 0.2); playTone(659, 0.12, 'sine', 0.2, 0.12); playTone(784, 0.18, 'sine', 0.2, 0.24); break;
            case 'lose': playTone(294, 0.15, 'sine', 0.2); playTone(262, 0.15, 'sine', 0.2, 0.15); playTone(220, 0.25, 'sine', 0.2, 0.3); break;
            case 'tick': playTone(800, 0.015, 'sine', 0.06); break;
            case 'timeout': playTone(330, 0.3, 'square', 0.2); playTone(220, 0.4, 'square', 0.2, 0.3); break;
        }
    } catch (e) { /* ignore audio errors */ }
}

function playTone(freq, duration, type, volume, delay) {
    delay = delay || 0;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume || 0.2, audioCtx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + delay);
    osc.stop(audioCtx.currentTime + delay + duration + 0.05);
}

function playNoise(duration, volume) {
    const bufferSize = Math.floor(audioCtx.sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const source = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start();
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('hangingchess-sound', JSON.stringify(soundEnabled));
    updateSoundButtons();
    if (soundEnabled) playSound('move');
}

function updateSoundButtons() {
    const icon = soundEnabled ? '🔊' : '🔇';
    const btn1 = document.getElementById('btn-sound-toggle');
    const btn2 = document.getElementById('btn-game-sound');
    if (btn1) btn1.textContent = icon;
    if (btn2) btn2.textContent = icon;
}

/* ═══════════ NAVIGATION ═══════════ */
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
}

function renderLanding() {
    if (game && game.clock) game.clock.stop();
    game = null;
    updateTexts();
    showView('landing-page');
    document.getElementById('room-info').classList.add('hidden');
    document.getElementById('online-form').classList.remove('hidden');
}

function updateTexts() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
    updateSoundButtons();
}

/* ═══════════ INIT ═══════════ */
document.addEventListener('DOMContentLoaded', () => {
    initSocketIO();
    setupEventListeners();
    checkURLParams();
    updateTexts();
});

function checkURLParams() {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode) {
        document.getElementById('link-room-code').textContent = roomCode.toUpperCase();
        showView('join-link-page');
        document.getElementById('btn-join-via-link').addEventListener('click', () => {
            socket.emit('join-room', { code: roomCode, lang: currentLang });
        });
    } else {
        renderLanding();
    }
}

function setupEventListeners() {
    document.getElementById('btn-vs-bot').addEventListener('click', () => showView('bot-setup'));
    document.getElementById('btn-online').addEventListener('click', () => showView('online-setup'));
    document.getElementById('btn-rules').addEventListener('click', () => showView('rules-page'));
    document.getElementById('btn-sound-toggle').addEventListener('click', toggleSound);
    document.getElementById('btn-game-sound').addEventListener('click', toggleSound);

    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', renderLanding);
    });

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setLang(btn.dataset.lang);
            updateTexts();
        });
    });

    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const container = btn.closest('.time-buttons');
            container.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedTimeControl = parseInt(btn.dataset.time) || 0;
        });
    });

    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', () => startBotGame(btn.dataset.difficulty));
    });

    document.getElementById('btn-create-room').addEventListener('click', createRoom);
    document.getElementById('btn-join-room').addEventListener('click', joinRoom);
    document.getElementById('btn-resign').addEventListener('click', resignGame);
    document.getElementById('btn-skip-hangman').addEventListener('click', skipHangmanPhase);
    document.getElementById('btn-new-game').addEventListener('click', renderLanding);
    document.getElementById('btn-analysis').addEventListener('click', showAnalysis);
    document.getElementById('btn-back-analysis').addEventListener('click', () => showView('game-over-page'));
    document.getElementById('btn-new-game-analysis').addEventListener('click', renderLanding);
    document.getElementById('btn-rematch').addEventListener('click', requestRematch);
}

/* ═══════════ INVITATION LINKS ═══════════ */
function copyRoomCode() {
    const code = document.getElementById('room-code-display').textContent;
    navigator.clipboard.writeText(code).then(() => showNotification(t('copied')));
}

function copyInvitationLink() {
    const code = document.getElementById('room-code-display').textContent;
    const link = window.location.origin + window.location.pathname + '?room=' + code;
    navigator.clipboard.writeText(link).then(() => showNotification(t('linkCopied')));
}

/* ═══════════ SOCKET.IO ═══════════ */
function initSocketIO() {
    socket = io();

    socket.on('room-created', ({ code }) => {
        document.getElementById('room-code-display').textContent = code;
        document.getElementById('room-info').classList.remove('hidden');
        document.getElementById('online-form').classList.add('hidden');
    });

    socket.on('error-msg', ({ message }) => {
        alert(message);
    });

    socket.on('game-start', ({ color, hangmanWord, opponentHangmanLength, timeControl }) => {
        window.history.replaceState({}, '', window.location.pathname);
        startOnlineGame(color, hangmanWord, opponentHangmanLength, timeControl || 0);
    });

    socket.on('chess-move', ({ from, to, promotion }) => {
        if (game && !game.gameOver) {
            const moveResult = game.makeChessMove(from, to, promotion);
            if (moveResult) {
                if (moveResult.captured) playSound('capture');
                else playSound('move');
                if (game.chess.in_check()) playSound('check');
            }
            renderGame();
        }
    });

    socket.on('ttt-move', ({ pos }) => {
        if (game && !game.gameOver) {
            game.makeTTTMove(pos);
            playSound('ttt');
            renderGame();
        }
    });

    socket.on('hangman-guess', ({ letter, correct, won, display }) => {
        if (game) {
            const hangman = game.opponentHangman;
            hangman.guessed.push(letter.toUpperCase());
            if (!correct) {
                hangman.wrongCount++;
                if (hangman.wrongCount >= hangman.maxWrong) hangman.lost = true;
                playSound('hangmanWrong');
            } else {
                playSound('hangmanCorrect');
            }
            if (display) game.opponentHangmanDisplay = display;
            if (won) {
                hangman.won = true;
                game.endGame(game.opponentColor, 'loseByHangman');
                playSound('lose');
            } else {
                game.advanceToNextTurn();
            }
            renderGame();
        }
    });

    socket.on('skip-hangman', () => {
        if (game) {
            game.advanceToNextTurn();
            renderGame();
        }
    });

    socket.on('opponent-resigned', () => {
        if (game) {
            game.endGame(game.playerColor, 'winByResign');
            playSound('win');
            renderGame();
        }
    });

    socket.on('opponent-disconnected', () => {
        if (game && !game.gameOver) {
            game.endGame(game.playerColor, 'winByResign');
            renderGame();
            showNotification(t('opponentDisconnected'));
        }
    });

    socket.on('rematch-request', () => {
        showNotification(t('opponentWantsRematch'));
        if (confirm(t('opponentWantsRematch') + ' ' + t('accept') + '?')) {
            socket.emit('rematch-accept');
        }
    });
}

/* ═══════════ START GAMES ═══════════ */
function startBotGame(difficulty) {
    const playerWord = randomWord();
    const botWord = randomWord();
    game = new CombinedGame({
        mode: 'bot',
        difficulty,
        playerColor: 'w',
        playerWord,
        opponentWord: botWord,
        timeControl: selectedTimeControl,
        onUpdate: () => renderGame(),
        onPhaseChange: () => renderGame(),
        onGameOver: (result) => handleGameOver(result)
    });
    if (game.clock) {
        game.clock.onTick = () => renderClocks();
    }
    boardFlipped = false;
    showView('game-page');
    renderGame();
}

function startOnlineGame(color, hangmanWord, opponentHangmanLength, timeControl) {
    const opponentWord = '_'.repeat(opponentHangmanLength);
    game = new CombinedGame({
        mode: 'online',
        playerColor: color,
        playerWord: hangmanWord,
        opponentWord: opponentWord,
        timeControl: timeControl || 0,
        onUpdate: () => renderGame(),
        onPhaseChange: () => renderGame(),
        onGameOver: (result) => handleGameOver(result)
    });
    if (game.clock) {
        game.clock.onTick = () => renderClocks();
    }
    boardFlipped = color === 'b';
    showView('game-page');
    renderGame();
}

function createRoom() {
    socket.emit('create-room', { lang: currentLang, timeControl: selectedTimeControl });
}

function joinRoom() {
    const code = document.getElementById('room-code-input').value.trim();
    if (!code) return;
    socket.emit('join-room', { code, lang: currentLang });
}

/* ═══════════ CHESS BOARD RENDERING ═══════════ */
function renderChessBoard() {
    const container = document.getElementById('chess-board');
    container.innerHTML = '';

    const board = game.chess.board();
    const canMove = game.isPlayerTurn && !game.gameOver && game.phase === 'chess';

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const row = boardFlipped ? 7 - r : r;
            const col = boardFlipped ? 7 - c : c;
            const square = String.fromCharCode(97 + col) + (8 - row);
            const piece = board[row][col];

            const cell = document.createElement('div');
            cell.className = 'chess-square ' + ((row + col) % 2 === 0 ? 'light' : 'dark');
            cell.dataset.square = square;

            if (selectedSquare === square) cell.classList.add('selected');
            if (validMoves.includes(square)) {
                cell.classList.add('valid-move');
                if (piece) cell.classList.add('has-piece');
            }

            const history = game.chess.history({ verbose: true });
            if (history.length > 0) {
                const last = history[history.length - 1];
                if (square === last.from || square === last.to) cell.classList.add('last-move');
            }

            if (piece) {
                const pieceEl = document.createElement('span');
                pieceEl.className = 'chess-piece' + (piece.color === 'w' ? ' white-piece' : ' black-piece');
                pieceEl.textContent = PIECE_UNICODE[piece.color + piece.type];
                if (canMove && piece.color === game.playerColor) pieceEl.classList.add('clickable');
                cell.appendChild(pieceEl);
            }

            if (canMove) cell.addEventListener('click', () => handleSquareClick(square));

            if (r === 7) {
                const fl = document.createElement('span');
                fl.className = 'board-label file-label';
                fl.textContent = String.fromCharCode(97 + col);
                cell.appendChild(fl);
            }
            if (c === 0) {
                const rl = document.createElement('span');
                rl.className = 'board-label rank-label';
                rl.textContent = 8 - row;
                cell.appendChild(rl);
            }

            container.appendChild(cell);
        }
    }
}

function handleSquareClick(square) {
    if (!game || game.gameOver || game.phase !== 'chess' || !game.isPlayerTurn) return;

    if (selectedSquare) {
        if (validMoves.includes(square)) {
            const piece = game.chess.get(selectedSquare);
            let promotion = undefined;
            if (piece && piece.type === 'p') {
                const targetRank = square[1];
                if ((piece.color === 'w' && targetRank === '8') || (piece.color === 'b' && targetRank === '1')) {
                    promotion = prompt('Promotion: q (queen), r (rook), b (bishop), n (knight)', 'q') || 'q';
                }
            }
            const move = game.makeChessMove(selectedSquare, square, promotion);
            if (move) {
                playSound(move.captured ? 'capture' : 'move');
                if (game.chess.in_check()) playSound('check');
                if (game.mode === 'online') {
                    socket.emit('chess-move', { from: selectedSquare, to: square, promotion });
                }
            }
            selectedSquare = null;
            validMoves = [];
            renderGame();

            if (game.mode === 'bot' && !game.gameOver && !game.isPlayerTurn) {
                setTimeout(() => executeBotTurn(), 200);
            }
        } else {
            const piece = game.chess.get(square);
            if (piece && piece.color === game.playerColor) {
                selectedSquare = square;
                validMoves = game.chess.moves({ square, verbose: true }).map(m => m.to);
            } else {
                selectedSquare = null;
                validMoves = [];
            }
            renderChessBoard();
        }
    } else {
        const piece = game.chess.get(square);
        if (piece && piece.color === game.playerColor) {
            selectedSquare = square;
            validMoves = game.chess.moves({ square, verbose: true }).map(m => m.to);
            renderChessBoard();
        }
    }
}

async function executeBotTurn() {
    if (!game || game.gameOver || game.isPlayerTurn) return;
    const prevLog = game.moveLog.length;
    await game.botTurn();

    const newEntries = game.moveLog.slice(prevLog);
    for (const entry of newEntries) {
        if (entry.type === 'chess') playSound(entry.captured ? 'capture' : 'move');
        if (entry.type === 'chess' && entry.check) playSound('check');
        if (entry.type === 'ttt') playSound('ttt');
        if (entry.type === 'hangman') playSound(entry.correct ? 'hangmanCorrect' : 'hangmanWrong');
    }
    renderGame();
}

/* ═══════════ TIC-TAC-TOE RENDERING ═══════════ */
function renderTicTacToe() {
    const container = document.getElementById('ttt-board');
    container.innerHTML = '';

    const canMove = !game.gameOver && game.phase === 'ttt' &&
        game.pendingTTTPlayer === game.tttPlayerMark;
    const winResult = game.ttt.checkWin();

    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.className = 'ttt-cell';

        if (game.ttt.board[i]) {
            cell.textContent = game.ttt.board[i];
            cell.classList.add(game.ttt.board[i] === 'X' ? 'ttt-x' : 'ttt-o');
        }

        if (winResult && winResult.line.includes(i)) cell.classList.add('ttt-win');

        if (canMove && !game.ttt.board[i]) {
            cell.classList.add('ttt-clickable');
            cell.addEventListener('click', () => handleTTTClick(i));
        }

        container.appendChild(cell);
    }

    const scoreEl = document.getElementById('ttt-score');
    const pM = game.ttt.board.filter(v => v === game.tttPlayerMark).length;
    const oM = game.ttt.board.filter(v => v === game.tttOpponentMark).length;
    scoreEl.textContent = `${t('you')}: ${pM} | ${t(game.mode === 'bot' ? 'bot' : 'opponent')}: ${oM}`;
}

function handleTTTClick(pos) {
    if (!game || game.gameOver || game.phase !== 'ttt') return;
    if (game.pendingTTTPlayer !== game.tttPlayerMark) return;

    const success = game.makeTTTMove(pos);
    if (success) {
        playSound('ttt');
        if (game.mode === 'online') socket.emit('ttt-move', { pos });
    }
    renderGame();

    if (game.mode === 'bot' && !game.gameOver && !game.isPlayerTurn && game.phase === 'chess') {
        setTimeout(() => executeBotTurn(), 200);
    }
}

/* ═══════════ HANGMAN RENDERING ═══════════ */
function renderHangman() {
    const hangman = game.playerHangman;
    const opponentHangman = game.opponentHangman;

    drawHangmanSVG('hangman-svg', hangman.wrongCount);
    document.getElementById('hangman-word').textContent = hangman.getDisplay();
    document.getElementById('hangman-wrong').textContent =
        `${t('wrongGuesses')}: ${hangman.wrongCount} / ${hangman.maxWrong}`;

    if (hangman.won) {
        document.getElementById('hangman-status').textContent = t('hangmanWon');
        document.getElementById('hangman-status').className = 'hangman-status won';
    } else if (hangman.lost) {
        document.getElementById('hangman-status').textContent = t('hangmanLost') + ' → ' + hangman.word;
        document.getElementById('hangman-status').className = 'hangman-status lost';
    } else {
        document.getElementById('hangman-status').textContent = '';
        document.getElementById('hangman-status').className = 'hangman-status';
    }

    renderHangmanKeyboard(hangman);

    drawHangmanSVG('opponent-hangman-svg', opponentHangman.wrongCount);
    const oppDisplay = game.mode === 'bot'
        ? opponentHangman.getDisplay()
        : (game.opponentHangmanDisplay || '_ '.repeat(opponentHangman.word.length).trim());
    document.getElementById('opponent-hangman-word').textContent = oppDisplay;
    document.getElementById('opponent-hangman-wrong').textContent =
        `${t('wrongGuesses')}: ${opponentHangman.wrongCount} / ${opponentHangman.maxWrong}`;
}

function renderHangmanKeyboard(hangman) {
    const container = document.getElementById('hangman-keyboard');
    container.innerHTML = '';

    const canGuess = !game.gameOver && game.phase === 'hangman' &&
        game.isPlayerTurn && !hangman.isFinished();

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const letter of letters) {
        const btn = document.createElement('button');
        btn.className = 'letter-btn';
        btn.textContent = letter;

        if (hangman.guessed.includes(letter)) {
            btn.classList.add('guessed');
            btn.classList.add(hangman.word.includes(letter) ? 'correct' : 'wrong');
            btn.disabled = true;
        } else if (!canGuess) {
            btn.disabled = true;
        } else {
            btn.addEventListener('click', () => handleHangmanGuess(letter));
        }
        container.appendChild(btn);
    }
}

function handleHangmanGuess(letter) {
    if (!game || game.gameOver || game.phase !== 'hangman' || !game.isPlayerTurn) return;

    const result = game.makeHangmanGuess(letter);
    if (result !== null) {
        playSound(result ? 'hangmanCorrect' : 'hangmanWrong');
        if (game.mode === 'online') {
            socket.emit('hangman-guess', {
                letter,
                correct: result,
                won: game.playerHangman.won,
                display: game.playerHangman.getDisplay()
            });
        }
    }
    renderGame();

    if (game.mode === 'bot' && !game.gameOver && !game.isPlayerTurn) {
        setTimeout(() => executeBotTurn(), 200);
    }
}

function drawHangmanSVG(containerId, wrongCount) {
    const svg = document.getElementById(containerId);
    svg.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';

    function line(x1, y1, x2, y2, cls) {
        const el = document.createElementNS(ns, 'line');
        el.setAttribute('x1', x1); el.setAttribute('y1', y1);
        el.setAttribute('x2', x2); el.setAttribute('y2', y2);
        el.setAttribute('class', cls || 'gallows');
        svg.appendChild(el);
    }
    function circle(cx, cy, r, cls) {
        const el = document.createElementNS(ns, 'circle');
        el.setAttribute('cx', cx); el.setAttribute('cy', cy); el.setAttribute('r', r);
        el.setAttribute('class', cls || 'body');
        svg.appendChild(el);
    }

    line(10, 140, 70, 140, 'gallows');
    line(40, 140, 40, 20, 'gallows');
    line(40, 20, 90, 20, 'gallows');
    line(90, 20, 90, 35, 'gallows');

    if (wrongCount >= 1) circle(90, 47, 12, 'body head');
    if (wrongCount >= 2) line(90, 59, 90, 95, 'body');
    if (wrongCount >= 3) line(90, 68, 65, 85, 'body');
    if (wrongCount >= 4) line(90, 68, 115, 85, 'body');
    if (wrongCount >= 5) line(90, 95, 70, 125, 'body');
    if (wrongCount >= 6) line(90, 95, 110, 125, 'body');
}

function skipHangmanPhase() {
    if (!game || game.phase !== 'hangman') return;
    if (game.mode === 'online') socket.emit('skip-hangman');
    game.skipHangman();
    renderGame();

    if (game.mode === 'bot' && !game.gameOver && !game.isPlayerTurn) {
        setTimeout(() => executeBotTurn(), 200);
    }
}

/* ═══════════ CLOCKS ═══════════ */
function renderClocks() {
    if (!game) return;
    const clockTop = document.getElementById('clock-top');
    const clockBottom = document.getElementById('clock-bottom');

    if (!game.clock) {
        clockTop.classList.add('hidden');
        clockBottom.classList.add('hidden');
        return;
    }

    clockTop.classList.remove('hidden');
    clockBottom.classList.remove('hidden');

    const topColor = boardFlipped ? 'w' : 'b';
    const bottomColor = boardFlipped ? 'b' : 'w';

    const topLabel = topColor === game.playerColor
        ? t('you') : t(game.mode === 'bot' ? 'bot' : 'opponent');
    const bottomLabel = bottomColor === game.playerColor
        ? t('you') : t(game.mode === 'bot' ? 'bot' : 'opponent');

    document.getElementById('clock-top-label').textContent =
        `${topLabel} (${topColor === 'w' ? t('white') : t('black')})`;
    document.getElementById('clock-top-time').textContent = game.clock.formatTime(topColor);
    document.getElementById('clock-bottom-label').textContent =
        `${bottomLabel} (${bottomColor === 'w' ? t('white') : t('black')})`;
    document.getElementById('clock-bottom-time').textContent = game.clock.formatTime(bottomColor);

    clockTop.className = 'clock';
    clockBottom.className = 'clock';

    if (game.clock.active === topColor) clockTop.classList.add('active-clock');
    if (game.clock.active === bottomColor) clockBottom.classList.add('active-clock');

    if (game.clock.getTime(topColor) < 30000 && game.clock.active === topColor) clockTop.classList.add('low-time');
    if (game.clock.getTime(bottomColor) < 30000 && game.clock.active === bottomColor) clockBottom.classList.add('low-time');
}

/* ═══════════ MAIN RENDER ═══════════ */
function renderGame() {
    if (!game) return;

    renderChessBoard();
    renderTicTacToe();
    renderHangman();
    renderStatus();
    renderMoveHistory();
    renderClocks();

    document.getElementById('btn-skip-hangman').classList.toggle('hidden',
        game.phase !== 'hangman' || !game.isPlayerTurn || game.gameOver);
    document.getElementById('btn-resign').classList.toggle('hidden', game.gameOver);

    if (!game.gameOver && game.phase === 'hangman' && game.isPlayerTurn &&
        game.playerHangman.isFinished()) {
        setTimeout(() => {
            if (game && !game.gameOver && game.phase === 'hangman' && game.isPlayerTurn) {
                skipHangmanPhase();
            }
        }, 600);
    }

    if (game.gameOver) showGameOver();
}

function renderStatus() {
    const statusEl = document.getElementById('status-bar');
    if (game.gameOver) {
        statusEl.textContent = t('gameOver');
        statusEl.className = 'status-bar game-over';
        return;
    }

    if (!game.isPlayerTurn) {
        statusEl.textContent = game.mode === 'bot' ? t('botThinking') : t('opponentTurn');
        statusEl.className = 'status-bar waiting';
        return;
    }

    switch (game.phase) {
        case 'chess':
            statusEl.textContent = t('phaseChess');
            statusEl.className = 'status-bar phase-chess';
            break;
        case 'ttt':
            statusEl.textContent = t('phaseTTT');
            statusEl.className = 'status-bar phase-ttt';
            break;
        case 'hangman':
            statusEl.textContent = t('phaseHangman');
            statusEl.className = 'status-bar phase-hangman';
            break;
    }

    if (game.chess.in_check()) statusEl.textContent += ' — ' + t('check');
}

function renderMoveHistory() {
    const container = document.getElementById('move-history');
    container.innerHTML = '';

    const chessMoves = game.moveLog.filter(m => m.type === 'chess');
    for (let i = 0; i < chessMoves.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        const white = chessMoves[i] ? chessMoves[i].move : '';
        const black = chessMoves[i + 1] ? chessMoves[i + 1].move : '';
        const row = document.createElement('div');
        row.className = 'move-row';
        row.innerHTML = `<span class="move-num">${moveNum}.</span>
            <span class="move-white">${white}</span>
            <span class="move-black">${black}</span>`;
        container.appendChild(row);
    }
    container.scrollTop = container.scrollHeight;
}

/* ═══════════ GAME OVER ═══════════ */
function handleGameOver(result) {
    const isWinner = result.winner === game.playerColor;
    const isDraw = result.winner === null;
    if (isDraw) playSound('lose');
    else if (isWinner) playSound('win');
    else playSound('lose');
    renderGame();
}

function showGameOver() {
    const isWinner = game.winner === game.playerColor;
    const isDraw = game.winner === null;

    let title, subtitle;
    if (isDraw) {
        title = t('draw');
        subtitle = t('stalemate');
    } else if (isWinner) {
        title = t('youWin');
        subtitle = t(game.winReason);
    } else {
        title = t('youLose');
        subtitle = t(game.winReason);
    }

    document.getElementById('game-over-title').textContent = title;
    document.getElementById('game-over-subtitle').textContent = subtitle;
    document.getElementById('game-over-title').className = isDraw ? 'draw' : (isWinner ? 'win' : 'lose');

    showView('game-over-page');
}

function resignGame() {
    if (!game || game.gameOver) return;
    if (!confirm(t('confirmResign'))) return;
    if (game.mode === 'online') socket.emit('resign');
    game.endGame(game.opponentColor, 'loseByResign');
    playSound('lose');
    renderGame();
}

function requestRematch() {
    if (game.mode === 'online') {
        socket.emit('rematch-request');
        showNotification(t('rematchRequested'));
    } else {
        startBotGame(game.difficulty);
    }
}

/* ═══════════ ANALYSIS ═══════════ */
function showAnalysis() {
    if (!game) return;
    const analysis = game.getAnalysis();
    const container = document.getElementById('analysis-content');

    let html = `
        <div class="analysis-section">
            <h3>${t('analysisSummary')}</h3>
            <div class="analysis-grid">
                <div class="analysis-card">
                    <div class="analysis-label">${t('analysisMoves')}</div>
                    <div class="analysis-value">${analysis.totalMoves}</div>
                </div>
            </div>
            <table class="analysis-table">
                <thead>
                    <tr><th></th><th>${t('you')}</th><th>${t(game.mode === 'bot' ? 'bot' : 'opponent')}</th></tr>
                </thead>
                <tbody>
                    <tr><td>♟️ ${t('chess')}</td><td>${analysis.player.chessMoves}</td><td>${analysis.opponent.chessMoves}</td></tr>
                    <tr><td>⚔️ ${t('captures')}</td><td>${analysis.player.captures}</td><td>${analysis.opponent.captures}</td></tr>
                    <tr><td>⭕ ${t('tictactoe')}</td><td>${analysis.player.tttMoves}</td><td>${analysis.opponent.tttMoves}</td></tr>
                    <tr><td>📝 ${t('hangman')} ✓</td><td>${analysis.player.hangmanCorrect}</td><td>${analysis.opponent.hangmanCorrect}</td></tr>
                    <tr><td>📝 ${t('hangman')} ✗</td><td>${analysis.player.hangmanWrong}</td><td>${analysis.opponent.hangmanWrong}</td></tr>
                </tbody>
            </table>
        </div>`;

    if (analysis.keyMoments.length > 0) {
        html += `<div class="analysis-section">
            <h3>${t('analysisKeyMoments')}</h3>
            <ul class="key-moments">
                ${analysis.keyMoments.map(m => `<li><strong>Tour ${m.turn + 1}:</strong> ${m.text}</li>`).join('')}
            </ul>
        </div>`;
    }

    if (analysis.tips.length > 0) {
        html += `<div class="analysis-section">
            <h3>${t('analysisTips')}</h3>
            <ul class="tips-list">
                ${analysis.tips.map(tip => `<li>${tip}</li>`).join('')}
            </ul>
        </div>`;
    }

    container.innerHTML = html;
    showView('analysis-page');
}

/* ═══════════ NOTIFICATIONS ═══════════ */
function showNotification(message) {
    const notif = document.createElement('div');
    notif.className = 'notification';
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.classList.add('show'), 10);
    setTimeout(() => {
        notif.classList.remove('show');
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}
