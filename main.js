const COLS = 10,
    ROWS = 20;

const COLORS = {
    I: '#5ad1e6',
    O: '#e6c85a',
    T: '#b45ae6',
    S: '#5ae67a',
    Z: '#e65a5a',
    J: '#5a7ae6',
    L: '#e68a3a'
};

const SHAPES = {
    I: [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    O: [
        [1, 1],
        [1, 1]
    ],
    T: [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0]
    ],
    S: [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0]
    ],
    Z: [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0]
    ],
    J: [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0]
    ],
    L: [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0]
    ]
};

const KEYS = Object.keys(SHAPES);
const BASE_DROP_INTERVAL = 800;

function rotateMatrix(m, dir) {
    const n = m.length;
    const res = [];
    for (let i = 0; i < n; i++) res.push(new Array(n).fill(0));
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (dir === 1) { // clockwise
                res[c][n - 1 - r] = m[r][c];
            } else { // counter-clockwise
                res[n - 1 - c][r] = m[r][c];
            }
        }
    }
    return res;
}

function newBag() {
    const bag = KEYS.slice();
    for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
}

let bag = newBag();

function nextFromBag() {
    if (bag.length === 0) bag = newBag();
    return bag.pop();
}

function makePiece(type) {
    return {
        type,
        matrix: SHAPES[type].map(row => row.slice()),
        x: Math.floor((COLS - SHAPES[type].length) / 2),
        y: -1
    };
}

// settings
const settings = Object.assign({
    speedIncrease: true,
    immediateRespawn: false,
    gridLinesVisible: false
}, JSON.parse(localStorage.getItem('tetrisSettings') || '{}'));

function saveSettings() {
    localStorage.setItem('tetrisSettings', JSON.stringify(settings));
}

// board state
let board, current, next, score, gameOver, dropInterval, lastTime, dropAcc, level, linesCleared;
let highScore = parseInt(localStorage.getItem('tetrisHighScore') || '0', 10);

const boardCanvas = document.getElementById('board');
const ctx = boardCanvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nctx = nextCanvas.getContext('2d');
const boardWrap = document.getElementById('board-wrap');
const scoreEl = document.getElementById('score');
const highscoreEl = document.getElementById('highscore');
const sheetScoreEl = document.getElementById('sheet-score');
const sheetHighscoreEl = document.getElementById('sheet-highscore');
const gameoverOverlay = document.getElementById('gameover-overlay');
const speedPctEl = document.getElementById('speed-pct');

let cell = 24;
let previewCell = 18;

function resize() {
    const availH = window.innerHeight - 40;
    const availW = window.innerWidth - 190 - 28 - 40;
    cell = Math.max(10, Math.floor(Math.min(availH / ROWS, availW / COLS)));
    boardCanvas.width = cell * COLS;
    boardCanvas.height = cell * ROWS;

    previewCell = Math.max(14, Math.min(cell, 34));
    nextCanvas.width = previewCell * 4;
    nextCanvas.height = previewCell * 4;

    draw();
    drawNext();
}
window.addEventListener('resize', resize);

function resetGame() {
    board = [];
    for (let r = 0; r < ROWS; r++) board.push(new Array(COLS).fill(null));
    current = makePiece(nextFromBag());
    next = makePiece(nextFromBag());
    score = 0;
    level = 1;
    linesCleared = 0;
    dropInterval = BASE_DROP_INTERVAL;
    dropAcc = 0;
    lastTime = performance.now();
    gameOver = false;
    gameoverOverlay.classList.remove('show');
    updateScoreUI();
    resize();
}

function updateScoreUI() {
    scoreEl.textContent = score;
    highscoreEl.textContent = highScore;
    sheetScoreEl.textContent = score;
    sheetHighscoreEl.textContent = highScore;
    const pct = Math.round((BASE_DROP_INTERVAL / dropInterval) * 100);
    speedPctEl.textContent = pct + '%';
}

function collides(matrix, px, py) {
    for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix.length; c++) {
            if (!matrix[r][c]) continue;
            const x = px + c;
            const y = py + r;
            if (x < 0 || x >= COLS || y >= ROWS) return true;
            if (y >= 0 && board[y][x]) return true;
        }
    }
    return false;
}

function merge() {
    const m = current.matrix;
    for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m.length; c++) {
            if (m[r][c]) {
                const x = current.x + c;
                const y = current.y + r;
                if (y >= 0) board[y][x] = current.type;
            }
        }
    }
}

function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r].every(cell => cell)) {
            board.splice(r, 1);
            board.unshift(new Array(COLS).fill(null));
            cleared++;
            r++;
        }
    }
    if (cleared > 0) {
        const points = [0, 40, 100, 300, 1200][cleared] * level;
        score += points;
        linesCleared += cleared;
        if (settings.speedIncrease) {
            level = 1 + Math.floor(linesCleared / 10);
            dropInterval = Math.max(100, BASE_DROP_INTERVAL - (level - 1) * 70);
        }
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('tetrisHighScore', String(highScore));
        }
        updateScoreUI();
    }
}

function spawnNext() {
    current = next;
    current.x = Math.floor((COLS - current.matrix.length) / 2);
    current.y = -1;
    next = makePiece(nextFromBag());
    if (collides(current.matrix, current.x, current.y)) {
        if (settings.immediateRespawn) {
            for (let r = 0; r < ROWS; r++) board[r].fill(null);
            current.x = Math.floor((COLS - current.matrix.length) / 2);
            current.y = -1;
        } else {
            endGame();
        }
    }
}

function endGame() {
    gameOver = true;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('tetrisHighScore', String(highScore));
    }
    updateScoreUI();
    gameoverOverlay.classList.add('show');
}

function lockPiece() {
    merge();
    clearLines();
    spawnNext();
}

function move(dx) {
    if (gameOver) return;
    if (!collides(current.matrix, current.x + dx, current.y)) {
        current.x += dx;
        draw();
    }
}

function moveAllWay(dx) {
    if (gameOver) return;
    while (!collides(current.matrix, current.x + dx, current.y)) {
        current.x += dx;
    }
    triggerBounce(dx < 0 ? 'left' : 'right');
    draw();
}

function softDrop() {
    if (gameOver) return;
    if (!collides(current.matrix, current.x, current.y + 1)) {
        current.y += 1;
        dropAcc = 0;
        draw();
    } else {
        lockPiece();
        draw();
    }
}

function hardDrop() {
    if (gameOver) return;
    while (!collides(current.matrix, current.x, current.y + 1)) {
        current.y += 1;
    }
    lockPiece();
    triggerBounce('down');
    draw();
}

function rotate(dir) {
    if (gameOver) return;
    const rotated = rotateMatrix(current.matrix, dir);
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
        if (!collides(rotated, current.x + k, current.y)) {
            current.matrix = rotated;
            current.x += k;
            draw();
            return;
        }
    }
}

function triggerBounce(direction) {
    const cls = 'bounce-' + direction;
    boardWrap.classList.remove('bounce-down', 'bounce-left', 'bounce-right');
    void boardWrap.offsetWidth; // reflow to restart animation
    boardWrap.classList.add(cls);
}

function ghostY() {
    let gy = current.y;
    while (!collides(current.matrix, current.x, gy + 1)) gy++;
    return gy;
}

function drawCell(target, c, r, size, color, alpha) {
    target.globalAlpha = alpha === undefined ? 1 : alpha;
    target.fillStyle = color;
    target.fillRect(c * size + 1, r * size + 1, size - 2, size - 2);
    target.globalAlpha = 1;
}

function draw() {
    ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

    // grid lines
    ctx.strokeStyle = settings.gridLinesVisible ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.04)';
    ctx.lineWidth = settings.gridLinesVisible ? 1.2 : 1;
    for (let c = 0; c <= COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * cell, 0);
        ctx.lineTo(c * cell, ROWS * cell);
        ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * cell);
        ctx.lineTo(COLS * cell, r * cell);
        ctx.stroke();
    }

    // settled blocks
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c]) drawCell(ctx, c, r, cell, COLORS[board[r][c]]);
        }
    }

    if (current) {
        // ghost
        const gy = ghostY();
        const m = current.matrix;
        for (let r = 0; r < m.length; r++) {
            for (let c = 0; c < m.length; c++) {
                if (m[r][c]) {
                    const x = current.x + c,
                        y = gy + r;
                    if (y >= 0) drawCell(ctx, x, y, cell, COLORS[current.type], 0.18);
                }
            }
        }
        // current piece
        for (let r = 0; r < m.length; r++) {
            for (let c = 0; c < m.length; c++) {
                if (m[r][c]) {
                    const x = current.x + c,
                        y = current.y + r;
                    if (y >= 0) drawCell(ctx, x, y, cell, COLORS[current.type]);
                }
            }
        }
    }
}

function drawNext() {
    nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const m = next.matrix;
    const n = m.length;

    let minR = n,
        maxR = -1,
        minC = n,
        maxC = -1;
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (m[r][c]) {
                if (r < minR) minR = r;
                if (r > maxR) maxR = r;
                if (c < minC) minC = c;
                if (c > maxC) maxC = c;
            }
        }
    }
    const pw = maxC - minC + 1;
    const ph = maxR - minR + 1;
    const offX = (4 - pw) / 2 - minC;
    const offY = (4 - ph) / 2 - minR;

    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (m[r][c]) {
                drawCell(nctx, c + offX, r + offY, previewCell, COLORS[next.type]);
            }
        }
    }
}

// input handling
window.addEventListener('keydown', (e) => {
    if (gameOver) {
        if (e.key === ' ') {
            resetGame();
            loop(performance.now());
            e.preventDefault();
        }
        return;
    }
    const key = e.key;
    const shift = e.shiftKey;

    switch (key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            rotate(1);
            e.preventDefault();
            break;
        case 'q':
        case 'Q':
            rotate(-1);
            e.preventDefault();
            break;
        case 'e':
        case 'E':
            rotate(1);
            e.preventDefault();
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            if (shift) moveAllWay(-1);
            else move(-1);
            e.preventDefault();
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            if (shift) moveAllWay(1);
            else move(1);
            e.preventDefault();
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            if (shift) hardDrop();
            else softDrop();
            e.preventDefault();
            break;
        case ' ':
            hardDrop();
            e.preventDefault();
            break;
    }
});

function loop(time) {
    if (gameOver) return;
    const dt = time - lastTime;
    lastTime = time;
    dropAcc += dt;
    if (dropAcc >= dropInterval) {
        dropAcc = 0;
        if (!collides(current.matrix, current.x, current.y + 1)) {
            current.y += 1;
        } else {
            lockPiece();
        }
        draw();
    }
    drawNext();
    requestAnimationFrame(loop);
}

// info sheet
const infoBtn = document.getElementById('info-btn');
const sheetBackdrop = document.getElementById('sheet-backdrop');
const sheetClose = document.getElementById('sheet-close');
const toggleSpeed = document.getElementById('toggle-speed');
const toggleRespawn = document.getElementById('toggle-respawn');
const toggleGridlines = document.getElementById('toggle-gridlines');

toggleSpeed.checked = settings.speedIncrease;
toggleRespawn.checked = settings.immediateRespawn;
toggleGridlines.checked = settings.gridLinesVisible;

infoBtn.addEventListener('click', () => {
    sheetBackdrop.classList.add('show');
});
sheetClose.addEventListener('click', () => {
    sheetBackdrop.classList.remove('show');
});
sheetBackdrop.addEventListener('click', (e) => {
    if (e.target === sheetBackdrop) sheetBackdrop.classList.remove('show');
});

toggleSpeed.addEventListener('change', () => {
    settings.speedIncrease = toggleSpeed.checked;
    saveSettings();
    resetGame();
    loop(performance.now());
});
toggleRespawn.addEventListener('change', () => {
    settings.immediateRespawn = toggleRespawn.checked;
    saveSettings();
    resetGame();
    loop(performance.now());
});
toggleGridlines.addEventListener('change', () => {
    settings.gridLinesVisible = toggleGridlines.checked;
    saveSettings();
    draw();
});

resetGame();
requestAnimationFrame(loop);