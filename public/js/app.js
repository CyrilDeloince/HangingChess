/* ═══════════ HANGINGCHESS - Main Application ═══════════ */

let game = null;
let socket = null;
let selectedSquare = null;
let validMoves = [];
let boardFlipped = false;
let selectedTimeControl = 0;
let soundEnabled = JSON.parse(localStorage.getItem('hangingchess-sound') ?? 'true');
let analysisData = null;
let analysisIndex = -1;

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
            case 'timeout': playTone(330, 0.3, 'square', 0.2); playTone(220, 0.4, 'square', 0.2, 0.3); break;
        }
    } catch (e) {}
}
function playTone(freq, dur, type, vol, delay) {
    delay = delay || 0;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(audioCtx.currentTime + delay); o.stop(audioCtx.currentTime + delay + dur + 0.05);
}
function playNoise(dur, vol) {
    const sz = Math.floor(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, sz, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < sz; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    const s = audioCtx.createBufferSource(), g = audioCtx.createGain();
    s.buffer = buf; g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    s.connect(g); g.connect(audioCtx.destination); s.start();
}
function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('hangingchess-sound', JSON.stringify(soundEnabled));
    updateSoundButtons();
    if (soundEnabled) playSound('move');
}
function updateSoundButtons() {
    const icon = soundEnabled ? '🔊' : '🔇';
    document.querySelectorAll('#btn-sound-toggle, #btn-game-sound').forEach(b => { if (b) b.textContent = icon; });
}

/* ═══════════ NAVIGATION ═══════════ */
let navStack = ['landing-page'];

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
}

function navigateTo(viewId) {
    navStack.push(viewId);
    showView(viewId);
    window.history.pushState({ view: viewId }, '');
}

function goHome() {
    if (game && !game.gameOver) {
        if (!confirm(t('confirmResign'))) return;
        if (game.mode === 'online') socket.emit('resign');
        game.endGame(game.opponentColor, 'loseByResign');
    }
    renderLanding();
}

function renderLanding() {
    if (game && game.clock) game.clock.stop();
    game = null;
    analysisData = null;
    analysisIndex = -1;
    selectedSquare = null;
    validMoves = [];
    navStack = ['landing-page'];
    updateTexts();
    showView('landing-page');
    document.getElementById('room-info').classList.add('hidden');
    document.getElementById('online-form').classList.remove('hidden');
    window.history.replaceState({ view: 'landing-page' }, '', window.location.pathname);
}

function updateTexts() {
    document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => el.placeholder = t(el.dataset.i18nPlaceholder));
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === currentLang));
    updateSoundButtons();
}

/* ═══════════ INIT ═══════════ */
document.addEventListener('DOMContentLoaded', () => {
    initSocketIO();
    setupEventListeners();
    setupHistoryNavigation();
    checkURLParams();
    updateTexts();
});

function setupHistoryNavigation() {
    window.history.replaceState({ view: 'landing-page' }, '');
    window.addEventListener('popstate', (e) => {
        const state = e.state;
        if (state && state.view === 'landing-page') {
            renderLanding();
        } else if (state && state.view) {
            showView(state.view);
        } else {
            window.history.pushState({ view: 'landing-page' }, '');
            renderLanding();
        }
    });
}

function checkURLParams() {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode) {
        document.getElementById('link-room-code').textContent = roomCode.toUpperCase();
        showView('join-link-page');
        document.getElementById('btn-join-via-link').onclick = () => {
            socket.emit('join-room', { code: roomCode, lang: currentLang });
        };
    } else {
        renderLanding();
    }
}

function setupEventListeners() {
    document.getElementById('btn-vs-bot').addEventListener('click', () => navigateTo('bot-setup'));
    document.getElementById('btn-online').addEventListener('click', () => navigateTo('online-setup'));
    document.getElementById('btn-rules').addEventListener('click', () => navigateTo('rules-page'));
    document.getElementById('btn-sound-toggle').addEventListener('click', toggleSound);
    document.getElementById('btn-game-sound').addEventListener('click', toggleSound);

    document.querySelectorAll('.btn-back').forEach(btn => btn.addEventListener('click', renderLanding));
    document.querySelectorAll('.btn-back-visible').forEach(btn => {
        if (!btn.onclick) btn.addEventListener('click', () => {
            if (navStack.length > 1) { navStack.pop(); window.history.back(); }
            else renderLanding();
        });
    });

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => { setLang(btn.dataset.lang); updateTexts(); });
    });

    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.time-buttons').querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
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
    document.getElementById('btn-back-analysis').addEventListener('click', () => {
        if (navStack.length > 1) { navStack.pop(); window.history.back(); }
        else showView('game-over-page');
    });
    document.getElementById('btn-new-game-analysis').addEventListener('click', renderLanding);
    document.getElementById('btn-rematch').addEventListener('click', requestRematch);

    document.getElementById('btn-first').addEventListener('click', () => goToAnalysisMove(0));
    document.getElementById('btn-prev').addEventListener('click', () => goToAnalysisMove(analysisIndex - 1));
    document.getElementById('btn-next').addEventListener('click', () => goToAnalysisMove(analysisIndex + 1));
    document.getElementById('btn-last').addEventListener('click', () => {
        if (analysisData) goToAnalysisMove(analysisData.moves.length - 1);
    });

    document.addEventListener('keydown', (e) => {
        if (!analysisData) return;
        if (e.key === 'ArrowLeft') goToAnalysisMove(analysisIndex - 1);
        if (e.key === 'ArrowRight') goToAnalysisMove(analysisIndex + 1);
    });
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
    socket.on('error-msg', ({ message }) => alert(message));
    socket.on('game-start', ({ color, hangmanWord, opponentHangmanLength, timeControl }) => {
        window.history.replaceState({}, '', window.location.pathname);
        startOnlineGame(color, hangmanWord, opponentHangmanLength, timeControl || 0);
    });
    socket.on('chess-move', ({ from, to, promotion }) => {
        if (game && !game.gameOver) {
            const m = game.makeChessMove(from, to, promotion);
            if (m) { playSound(m.captured ? 'capture' : 'move'); if (game.chess.in_check()) playSound('check'); }
            renderGame();
        }
    });
    socket.on('ttt-move', ({ pos }) => {
        if (game && !game.gameOver) { game.makeTTTMove(pos); playSound('ttt'); renderGame(); }
    });
    socket.on('hangman-guess', ({ letter, correct, won, display }) => {
        if (game) {
            const h = game.opponentHangman;
            h.guessed.push(letter.toUpperCase());
            if (!correct) { h.wrongCount++; if (h.wrongCount >= h.maxWrong) h.lost = true; playSound('hangmanWrong'); }
            else playSound('hangmanCorrect');
            if (display) game.opponentHangmanDisplay = display;
        if (won) { h.won = true; game.endGame(game.opponentColor, 'loseByHangman'); playSound('lose'); }
            renderGame();
        }
    });
    socket.on('skip-hangman', () => { if (game) { game.advanceToNextTurn(); renderGame(); } });
    socket.on('opponent-resigned', () => { if (game) { game.endGame(game.playerColor, 'winByResign'); playSound('win'); renderGame(); } });
    socket.on('opponent-disconnected', () => {
        if (game && !game.gameOver) { game.endGame(game.playerColor, 'winByResign'); renderGame(); showNotification(t('opponentDisconnected')); }
    });
    socket.on('rematch-request', () => {
        showNotification(t('opponentWantsRematch'));
        if (confirm(t('opponentWantsRematch') + ' ' + t('accept') + '?')) socket.emit('rematch-accept');
    });
}

/* ═══════════ START GAMES ═══════════ */
function startBotGame(difficulty) {
    game = new CombinedGame({
        mode: 'bot', difficulty, playerColor: 'w',
        playerWord: randomWord(), opponentWord: randomWord(),
        timeControl: selectedTimeControl,
        onUpdate: () => renderGame(), onPhaseChange: () => renderGame(),
        onGameOver: (r) => handleGameOver(r)
    });
    if (game.clock) game.clock.onTick = () => renderClocks();
    boardFlipped = false;
    navigateTo('game-page');
    renderGame();
}

function startOnlineGame(color, hangmanWord, opponentHangmanLength, timeControl) {
    game = new CombinedGame({
        mode: 'online', playerColor: color,
        playerWord: hangmanWord, opponentWord: '_'.repeat(opponentHangmanLength),
        timeControl: timeControl || 0,
        onUpdate: () => renderGame(), onPhaseChange: () => renderGame(),
        onGameOver: (r) => handleGameOver(r)
    });
    if (game.clock) game.clock.onTick = () => renderClocks();
    boardFlipped = color === 'b';
    navigateTo('game-page');
    renderGame();
}

function createRoom() { socket.emit('create-room', { lang: currentLang, timeControl: selectedTimeControl }); }
function joinRoom() {
    const code = document.getElementById('room-code-input').value.trim();
    if (code) socket.emit('join-room', { code, lang: currentLang });
}

/* ═══════════ CHESS BOARD RENDERING ═══════════ */
function renderBoardToContainer(containerId, fen, flipped, interactive) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const c = new Chess(fen);
    const board = c.board();

    for (let r = 0; r < 8; r++) {
        for (let col = 0; col < 8; col++) {
            const row = flipped ? 7 - r : r;
            const colIdx = flipped ? 7 - col : col;
            const square = String.fromCharCode(97 + colIdx) + (8 - row);
            const piece = board[row][colIdx];

            const cell = document.createElement('div');
            cell.className = 'chess-square ' + ((row + colIdx) % 2 === 0 ? 'light' : 'dark');

            if (interactive && selectedSquare === square) cell.classList.add('selected');
            if (interactive && validMoves.includes(square)) {
                cell.classList.add('valid-move');
                if (piece) cell.classList.add('has-piece');
            }

            if (interactive && game) {
                const history = game.chess.history({ verbose: true });
                if (history.length > 0) {
                    const last = history[history.length - 1];
                    if (square === last.from || square === last.to) cell.classList.add('last-move');
                }
            }

            if (piece) {
                const pe = document.createElement('span');
                pe.className = 'chess-piece' + (piece.color === 'w' ? ' white-piece' : ' black-piece');
                pe.textContent = PIECE_UNICODE[piece.color + piece.type];
                if (interactive && game && game.phase === 'chess' && game.isPlayerTurn && !game.gameOver && piece.color === game.playerColor)
                    pe.classList.add('clickable');
                cell.appendChild(pe);
            }

            if (interactive && game && game.phase === 'chess' && game.isPlayerTurn && !game.gameOver)
                cell.addEventListener('click', ((sq) => () => handleSquareClick(sq))(square));

            if (r === 7) { const fl = document.createElement('span'); fl.className = 'board-label file-label'; fl.textContent = String.fromCharCode(97 + colIdx); cell.appendChild(fl); }
            if (col === 0) { const rl = document.createElement('span'); rl.className = 'board-label rank-label'; rl.textContent = 8 - row; cell.appendChild(rl); }

            container.appendChild(cell);
        }
    }
}

function renderChessBoard() {
    if (!game) return;
    renderBoardToContainer('chess-board', game.chess.fen(), boardFlipped, true);
}

function handleSquareClick(square) {
    if (!game || game.gameOver || game.phase !== 'chess' || !game.isPlayerTurn) return;
    if (selectedSquare) {
        if (validMoves.includes(square)) {
            const piece = game.chess.get(selectedSquare);
            let promotion;
            if (piece && piece.type === 'p') {
                const tr = square[1];
                if ((piece.color === 'w' && tr === '8') || (piece.color === 'b' && tr === '1'))
                    promotion = prompt('Promotion: q (queen), r (rook), b (bishop), n (knight)', 'q') || 'q';
            }
            const move = game.makeChessMove(selectedSquare, square, promotion);
            if (move) {
                playSound(move.captured ? 'capture' : 'move');
                if (game.chess.in_check()) playSound('check');
                if (game.mode === 'online') socket.emit('chess-move', { from: selectedSquare, to: square, promotion });
            }
            selectedSquare = null; validMoves = [];
            renderGame();
            if (game.mode === 'bot' && !game.gameOver && !game.isPlayerTurn) setTimeout(() => executeBotTurn(), 200);
        } else {
            const piece = game.chess.get(square);
            if (piece && piece.color === game.playerColor) {
                selectedSquare = square;
                validMoves = game.chess.moves({ square, verbose: true }).map(m => m.to);
            } else { selectedSquare = null; validMoves = []; }
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
    for (const e of game.moveLog.slice(prevLog)) {
        if (e.type === 'chess') playSound(e.captured ? 'capture' : 'move');
        if (e.type === 'chess' && e.check) playSound('check');
        if (e.type === 'ttt') playSound('ttt');
        if (e.type === 'hangman') playSound(e.correct ? 'hangmanCorrect' : 'hangmanWrong');
    }
    renderGame();
}

/* ═══════════ TIC-TAC-TOE ═══════════ */
function renderTicTacToe() {
    const container = document.getElementById('ttt-board');
    container.innerHTML = '';
    const canMove = !game.gameOver && game.phase === 'ttt' && game.pendingTTTPlayer === game.tttPlayerMark;
    const winResult = game.ttt.checkWin();
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.className = 'ttt-cell';
        if (game.ttt.board[i]) { cell.textContent = game.ttt.board[i]; cell.classList.add(game.ttt.board[i] === 'X' ? 'ttt-x' : 'ttt-o'); }
        if (winResult && winResult.line.includes(i)) cell.classList.add('ttt-win');
        if (canMove && !game.ttt.board[i]) { cell.classList.add('ttt-clickable'); cell.addEventListener('click', ((p) => () => handleTTTClick(p))(i)); }
        container.appendChild(cell);
    }
    const pM = game.ttt.board.filter(v => v === game.tttPlayerMark).length;
    const oM = game.ttt.board.filter(v => v === game.tttOpponentMark).length;
    document.getElementById('ttt-score').textContent = `${t('you')}: ${pM} | ${t(game.mode === 'bot' ? 'bot' : 'opponent')}: ${oM}`;
}

function handleTTTClick(pos) {
    if (!game || game.gameOver || game.phase !== 'ttt' || game.pendingTTTPlayer !== game.tttPlayerMark) return;
    const ok = game.makeTTTMove(pos);
    if (ok) { playSound('ttt'); if (game.mode === 'online') socket.emit('ttt-move', { pos }); }
    renderGame();
    if (game.mode === 'bot' && !game.gameOver && !game.isPlayerTurn && game.phase === 'chess') setTimeout(() => executeBotTurn(), 200);
}

/* ═══════════ HANGMAN ═══════════ */
function renderHangman() {
    const h = game.playerHangman, oh = game.opponentHangman;
    drawHangmanSVG('hangman-svg', h.wrongCount);
    document.getElementById('hangman-word').textContent = h.getDisplay();
    document.getElementById('hangman-wrong').textContent = `${t('wrongGuesses')}: ${h.wrongCount} / ${h.maxWrong}`;
    const statusEl = document.getElementById('hangman-status');
    if (h.won) { statusEl.textContent = t('hangmanWon'); statusEl.className = 'hangman-status won'; }
    else if (h.lost) { statusEl.textContent = t('hangmanLost') + ' → ' + h.word; statusEl.className = 'hangman-status lost'; }
    else { statusEl.textContent = ''; statusEl.className = 'hangman-status'; }
    renderHangmanKeyboard(h);
    drawHangmanSVG('opponent-hangman-svg', oh.wrongCount);
    document.getElementById('opponent-hangman-word').textContent = game.mode === 'bot' ? oh.getDisplay() : (game.opponentHangmanDisplay || '_ '.repeat(oh.word.length).trim());
    document.getElementById('opponent-hangman-wrong').textContent = `${t('wrongGuesses')}: ${oh.wrongCount} / ${oh.maxWrong}`;
}

function renderHangmanKeyboard(h) {
    const c = document.getElementById('hangman-keyboard'); c.innerHTML = '';
    const canGuess = !game.gameOver && !h.isFinished();
    for (const l of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        const btn = document.createElement('button'); btn.className = 'letter-btn'; btn.textContent = l;
        if (h.guessed.includes(l)) { btn.classList.add('guessed', h.word.includes(l) ? 'correct' : 'wrong'); btn.disabled = true; }
        else if (!canGuess) btn.disabled = true;
        else btn.addEventListener('click', () => handleHangmanGuess(l));
        c.appendChild(btn);
    }
}

function handleHangmanGuess(letter) {
    if (!game || game.gameOver) return;
    const result = game.makeHangmanGuess(letter);
    if (result !== null) {
        playSound(result ? 'hangmanCorrect' : 'hangmanWrong');
        if (game.mode === 'online') socket.emit('hangman-guess', { letter, correct: result, won: game.playerHangman.won, display: game.playerHangman.getDisplay() });
    }
    renderGame();
}

function drawHangmanSVG(id, wrong) {
    const svg = document.getElementById(id); svg.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';
    const ln = (x1,y1,x2,y2,cls) => { const e = document.createElementNS(ns,'line'); e.setAttribute('x1',x1); e.setAttribute('y1',y1); e.setAttribute('x2',x2); e.setAttribute('y2',y2); e.setAttribute('class',cls||'gallows'); svg.appendChild(e); };
    const ci = (cx,cy,r,cls) => { const e = document.createElementNS(ns,'circle'); e.setAttribute('cx',cx); e.setAttribute('cy',cy); e.setAttribute('r',r); e.setAttribute('class',cls||'body'); svg.appendChild(e); };
    ln(10,140,70,140,'gallows'); ln(40,140,40,20,'gallows'); ln(40,20,90,20,'gallows'); ln(90,20,90,35,'gallows');
    if (wrong>=1) ci(90,47,12,'body head'); if (wrong>=2) ln(90,59,90,95,'body');
    if (wrong>=3) ln(90,68,65,85,'body'); if (wrong>=4) ln(90,68,115,85,'body');
    if (wrong>=5) ln(90,95,70,125,'body'); if (wrong>=6) ln(90,95,110,125,'body');
}

function skipHangmanPhase() {
    if (!game || game.phase !== 'hangman') return;
    if (game.mode === 'online') socket.emit('skip-hangman');
    game.skipHangman(); renderGame();
    if (game.mode === 'bot' && !game.gameOver && !game.isPlayerTurn) setTimeout(() => executeBotTurn(), 200);
}

/* ═══════════ CLOCKS ═══════════ */
function renderClocks() {
    if (!game) return;
    const ct = document.getElementById('clock-top'), cb = document.getElementById('clock-bottom');
    if (!game.clock) { ct.classList.add('hidden'); cb.classList.add('hidden'); return; }
    ct.classList.remove('hidden'); cb.classList.remove('hidden');
    const topC = boardFlipped ? 'w' : 'b', botC = boardFlipped ? 'b' : 'w';
    const tl = topC === game.playerColor ? t('you') : t(game.mode === 'bot' ? 'bot' : 'opponent');
    const bl = botC === game.playerColor ? t('you') : t(game.mode === 'bot' ? 'bot' : 'opponent');
    document.getElementById('clock-top-label').textContent = `${tl} (${topC === 'w' ? t('white') : t('black')})`;
    document.getElementById('clock-top-time').textContent = game.clock.formatTime(topC);
    document.getElementById('clock-bottom-label').textContent = `${bl} (${botC === 'w' ? t('white') : t('black')})`;
    document.getElementById('clock-bottom-time').textContent = game.clock.formatTime(botC);
    ct.className = 'clock'; cb.className = 'clock';
    if (game.clock.active === topC) ct.classList.add('active-clock');
    if (game.clock.active === botC) cb.classList.add('active-clock');
    if (game.clock.getTime(topC) < 30000 && game.clock.active === topC) ct.classList.add('low-time');
    if (game.clock.getTime(botC) < 30000 && game.clock.active === botC) cb.classList.add('low-time');
}

/* ═══════════ MAIN RENDER ═══════════ */
function renderGame() {
    if (!game) return;
    renderChessBoard(); renderTicTacToe(); renderHangman(); renderStatus(); renderMoveHistory(); renderClocks();
    document.getElementById('btn-skip-hangman').classList.add('hidden');
    document.getElementById('btn-resign').classList.toggle('hidden', game.gameOver);
    if (game.gameOver) showGameOver();
}

function renderStatus() {
    const s = document.getElementById('status-bar');
    if (game.gameOver) { s.textContent = t('gameOver'); s.className = 'status-bar game-over'; return; }
    if (!game.isPlayerTurn) { s.textContent = game.mode === 'bot' ? t('botThinking') : t('opponentTurn'); s.className = 'status-bar waiting'; return; }
    switch (game.phase) {
        case 'chess': s.textContent = t('phaseChess'); s.className = 'status-bar phase-chess'; break;
        case 'ttt': s.textContent = t('phaseTTT'); s.className = 'status-bar phase-ttt'; break;
        case 'hangman': s.textContent = t('phaseHangman'); s.className = 'status-bar phase-hangman'; break;
    }
    if (game.chess.in_check()) s.textContent += ' — ' + t('check');
}

function renderMoveHistory() {
    const c = document.getElementById('move-history'); c.innerHTML = '';
    const cm = game.moveLog.filter(m => m.type === 'chess');
    for (let i = 0; i < cm.length; i += 2) {
        const n = Math.floor(i/2) + 1, w = cm[i]?cm[i].move:'', b = cm[i+1]?cm[i+1].move:'';
        const row = document.createElement('div'); row.className = 'move-row';
        row.innerHTML = `<span class="move-num">${n}.</span><span class="move-white">${w}</span><span class="move-black">${b}</span>`;
        c.appendChild(row);
    }
    c.scrollTop = c.scrollHeight;
}

/* ═══════════ GAME OVER ═══════════ */
function handleGameOver(result) {
    playSound(result.winner === game.playerColor ? 'win' : (result.winner === null ? 'lose' : 'lose'));
    renderGame();
}

function showGameOver() {
    const isW = game.winner === game.playerColor, isD = game.winner === null;
    let title, subtitle;
    if (isD) { title = t('draw'); subtitle = t('stalemate'); }
    else if (isW) { title = t('youWin'); subtitle = t(game.winReason); }
    else { title = t('youLose'); subtitle = t(game.winReason); }
    document.getElementById('game-over-title').textContent = title;
    document.getElementById('game-over-subtitle').textContent = subtitle;
    document.getElementById('game-over-title').className = isD ? 'draw' : (isW ? 'win' : 'lose');
    navigateTo('game-over-page');
}

function resignGame() {
    if (!game || game.gameOver) return;
    if (!confirm(t('confirmResign'))) return;
    if (game.mode === 'online') socket.emit('resign');
    game.endGame(game.opponentColor, 'loseByResign'); playSound('lose'); renderGame();
}

function requestRematch() {
    if (game.mode === 'online') { socket.emit('rematch-request'); showNotification(t('rematchRequested')); }
    else startBotGame(game.difficulty);
}

/* ═══════════ ANALYSIS ═══════════ */
function showAnalysis() {
    if (!game) return;
    navigateTo('analysis-page');

    const chessMoves = game.moveLog.filter(m => m.type === 'chess');
    if (chessMoves.length === 0) {
        document.getElementById('analysis-content').innerHTML = '<p style="text-align:center;color:var(--text-muted)">No chess moves to analyze.</p>';
        return;
    }

    analysisData = analyzePositions(game.positions, chessMoves);
    analysisIndex = -1;

    goToAnalysisMove(0);
    renderAnalysisSummary();
}

function goToAnalysisMove(idx) {
    if (!analysisData || !analysisData.moves.length) return;
    idx = Math.max(0, Math.min(idx, analysisData.moves.length - 1));
    analysisIndex = idx;
    const m = analysisData.moves[idx];

    renderBoardToContainer('analysis-board', m.fen, false, false);

    const moveNum = Math.floor(idx / 2) + 1;
    const color = m.player === 'w' ? '⬜' : '⬛';
    document.getElementById('analysis-move-header').innerHTML =
        `${color} ${moveNum}${m.player === 'w' ? '.' : '...'} <strong>${m.move}</strong>`;

    const evalPct = Math.max(5, Math.min(95, 50 + (m.evalAfter * 5)));
    const fillEl = document.querySelector('.eval-fill');
    if (fillEl) fillEl.style.width = evalPct + '%';

    document.getElementById('analysis-move-detail').innerHTML = `
        <div class="move-quality quality-${m.quality}">${m.qualityIcon} ${t(m.quality)}</div>
        <div class="move-comment">${m.comment}</div>
        <div class="move-eval-info">
            ${t('eval')}: ${m.evalAfter >= 0 ? '+' : ''}${m.evalAfter.toFixed(1)} · 
            Δ ${m.cpLoss > 0 ? '-' + m.cpLoss.toFixed(1) : '+0.0'} cp
        </div>`;

    document.getElementById('analysis-move-counter').textContent =
        `${idx + 1} ${t('moveOf')} ${analysisData.moves.length}`;
}

function renderAnalysisSummary() {
    if (!analysisData || !game) return;
    const a = game.getAnalysis();
    const d = analysisData;
    const pColor = game.playerColor === 'w' ? 'white' : 'black';
    const oColor = game.playerColor === 'w' ? 'black' : 'white';
    const pSummary = d.summary[pColor];
    const oSummary = d.summary[oColor];
    const pElo = pColor === 'white' ? d.whiteElo : d.blackElo;
    const oElo = oColor === 'white' ? d.whiteElo : d.blackElo;

    let html = `
    <div class="analysis-section">
        <h3>${t('estimatedElo')}</h3>
        <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
            <div style="text-align:center">
                <div style="color:var(--text-secondary);margin-bottom:4px">${t('you')} (${t(pColor === 'white' ? 'white' : 'black')})</div>
                <span class="elo-badge">~${pElo}</span>
                <div style="color:var(--text-muted);font-size:12px;margin-top:4px">ACPL: ${pSummary.acpl}</div>
            </div>
            <div style="text-align:center">
                <div style="color:var(--text-secondary);margin-bottom:4px">${t(game.mode === 'bot' ? 'bot' : 'opponent')} (${t(oColor === 'white' ? 'white' : 'black')})</div>
                <span class="elo-badge">~${oElo}</span>
                <div style="color:var(--text-muted);font-size:12px;margin-top:4px">ACPL: ${oSummary.acpl}</div>
            </div>
        </div>
        <div style="display:flex;gap:24px;justify-content:center;margin-top:16px;flex-wrap:wrap;">
            <div>
                <div style="color:var(--text-muted);font-size:12px;margin-bottom:6px">${t('you')}</div>
                <div class="quality-summary">
                    <span class="quality-chip quality-brilliant">✨ ${pSummary.brilliant}</span>
                    <span class="quality-chip quality-good">✅ ${pSummary.good}</span>
                    <span class="quality-chip quality-inaccuracy">⚠️ ${pSummary.inaccuracy}</span>
                    <span class="quality-chip quality-mistake">❌ ${pSummary.mistake}</span>
                    <span class="quality-chip quality-blunder">💀 ${pSummary.blunder}</span>
                </div>
            </div>
            <div>
                <div style="color:var(--text-muted);font-size:12px;margin-bottom:6px">${t(game.mode === 'bot' ? 'bot' : 'opponent')}</div>
                <div class="quality-summary">
                    <span class="quality-chip quality-brilliant">✨ ${oSummary.brilliant}</span>
                    <span class="quality-chip quality-good">✅ ${oSummary.good}</span>
                    <span class="quality-chip quality-inaccuracy">⚠️ ${oSummary.inaccuracy}</span>
                    <span class="quality-chip quality-mistake">❌ ${oSummary.mistake}</span>
                    <span class="quality-chip quality-blunder">💀 ${oSummary.blunder}</span>
                </div>
            </div>
        </div>
    </div>

    <div class="analysis-section">
        <h3>${t('analysisSummary')}</h3>
        <table class="analysis-table">
            <thead><tr><th></th><th>${t('you')}</th><th>${t(game.mode === 'bot' ? 'bot' : 'opponent')}</th></tr></thead>
            <tbody>
                <tr><td>♟️ ${t('chess')}</td><td>${a.player.chessMoves}</td><td>${a.opponent.chessMoves}</td></tr>
                <tr><td>⚔️ ${t('captures')}</td><td>${a.player.captures}</td><td>${a.opponent.captures}</td></tr>
                <tr><td>⭕ ${t('tictactoe')}</td><td>${a.player.tttMoves}</td><td>${a.opponent.tttMoves}</td></tr>
                <tr><td>📝 ${t('hangman')} ✓</td><td>${a.player.hangmanCorrect}</td><td>${a.opponent.hangmanCorrect}</td></tr>
                <tr><td>📝 ${t('hangman')} ✗</td><td>${a.player.hangmanWrong}</td><td>${a.opponent.hangmanWrong}</td></tr>
            </tbody>
        </table>
    </div>`;

    if (a.tips.length > 0) {
        html += `<div class="analysis-section"><h3>${t('analysisTips')}</h3>
            <ul class="tips-list">${a.tips.map(tip => `<li>${tip}</li>`).join('')}</ul></div>`;
    }

    document.getElementById('analysis-content').innerHTML = html;
}

/* ═══════════ NOTIFICATIONS ═══════════ */
function showNotification(message) {
    const n = document.createElement('div'); n.className = 'notification'; n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 3000);
}
