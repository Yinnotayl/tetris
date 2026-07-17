const COLS = 10;
const ROWS = 20;

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

const SETTINGS_STORAGE_KEY = 'tetrisSettings';
const HIGH_SCORE_STORAGE_KEY = 'tetrisHighScore';

const DEFAULT_SETTINGS = Object.freeze({
    speedIncrease: true,
    immediateRespawn: false,
    gridLinesVisible: false
});

function rotateMatrix(matrix, direction) {
    const size = matrix.length;
    const rotated = [];

    for (let i = 0; i < size; i++) {
        rotated.push(new Array(size).fill(0));
    }

    for (let row = 0; row < size; row++) {
        for (let column = 0; column < size; column++) {
            if (direction === 1) {
                rotated[column][size - 1 - row] = matrix[row][column];
            } else {
                rotated[size - 1 - column][row] = matrix[row][column];
            }
        }
    }

    return rotated;
}

function newBag() {
    const newPieces = KEYS.slice();

    for (let i = newPieces.length - 1; i > 0; i--) {
        const randomIndex = Math.floor(Math.random() * (i + 1));

        [newPieces[i], newPieces[randomIndex]] = [
            newPieces[randomIndex],
            newPieces[i]
        ];
    }

    return newPieces;
}

let bag = newBag();

function nextFromBag() {
    if (bag.length === 0) {
        bag = newBag();
    }

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

function loadSettings() {
    try {
        const savedText = localStorage.getItem(SETTINGS_STORAGE_KEY);
        const saved = savedText ? JSON.parse(savedText) : {};

        return {
            speedIncrease:
                typeof saved.speedIncrease === 'boolean'
                    ? saved.speedIncrease
                    : DEFAULT_SETTINGS.speedIncrease,

            immediateRespawn:
                typeof saved.immediateRespawn === 'boolean'
                    ? saved.immediateRespawn
                    : DEFAULT_SETTINGS.immediateRespawn,

            gridLinesVisible:
                typeof saved.gridLinesVisible === 'boolean'
                    ? saved.gridLinesVisible
                    : DEFAULT_SETTINGS.gridLinesVisible
        };
    } catch (error) {
        console.warn(
            'Could not load Tetris settings. Default settings will be used.',
            error
        );

        return {
            ...DEFAULT_SETTINGS
        };
    }
}

function saveSettings() {
    try {
        localStorage.setItem(
            SETTINGS_STORAGE_KEY,
            JSON.stringify(settings)
        );
    } catch (error) {
        console.warn('Could not save Tetris settings.', error);
    }
}

function loadHighScore() {
    try {
        const savedValue = Number.parseInt(
            localStorage.getItem(HIGH_SCORE_STORAGE_KEY) || '0',
            10
        );

        if (!Number.isFinite(savedValue) || savedValue < 0) {
            return 0;
        }

        return savedValue;
    } catch (error) {
        console.warn('Could not load the Tetris high score.', error);
        return 0;
    }
}

function saveHighScore() {
    try {
        localStorage.setItem(
            HIGH_SCORE_STORAGE_KEY,
            String(highScore)
        );
    } catch (error) {
        console.warn('Could not save the Tetris high score.', error);
    }
}

const settings = loadSettings();

let board;
let current;
let next;
let score;
let gameOver;
let dropInterval;
let lastTime;
let dropAcc;
let level;
let linesCleared;

let highScore = loadHighScore();
let animationFrameId = null;

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
    const availableHeight = window.innerHeight - 40;
    const availableWidth = window.innerWidth - 190 - 28 - 40;

    cell = Math.max(
        10,
        Math.floor(
            Math.min(
                availableHeight / ROWS,
                availableWidth / COLS
            )
        )
    );

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

    for (let row = 0; row < ROWS; row++) {
        board.push(new Array(COLS).fill(null));
    }

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

    const speedPercentage = Math.round(
        (BASE_DROP_INTERVAL / dropInterval) * 100
    );

    speedPctEl.textContent = `${speedPercentage}%`;
}

function collides(matrix, pieceX, pieceY) {
    for (let row = 0; row < matrix.length; row++) {
        for (let column = 0; column < matrix.length; column++) {
            if (!matrix[row][column]) {
                continue;
            }

            const x = pieceX + column;
            const y = pieceY + row;

            if (x < 0 || x >= COLS || y >= ROWS) {
                return true;
            }

            if (y >= 0 && board[y][x]) {
                return true;
            }
        }
    }

    return false;
}

function merge() {
    const matrix = current.matrix;

    for (let row = 0; row < matrix.length; row++) {
        for (let column = 0; column < matrix.length; column++) {
            if (!matrix[row][column]) {
                continue;
            }

            const x = current.x + column;
            const y = current.y + row;

            if (y >= 0) {
                board[y][x] = current.type;
            }
        }
    }
}

function clearLines() {
    let cleared = 0;

    for (let row = ROWS - 1; row >= 0; row--) {
        if (board[row].every(boardCell => boardCell)) {
            board.splice(row, 1);
            board.unshift(new Array(COLS).fill(null));

            cleared++;
            row++;
        }
    }

    if (cleared === 0) {
        return;
    }

    const pointsTable = [0, 40, 100, 300, 1200];
    const points = pointsTable[cleared] * level;

    score += points;
    linesCleared += cleared;

    if (settings.speedIncrease) {
        level = 1 + Math.floor(linesCleared / 10);

        dropInterval = Math.max(
            100,
            BASE_DROP_INTERVAL - (level - 1) * 70
        );
    }

    if (score > highScore) {
        highScore = score;
        saveHighScore();
    }

    updateScoreUI();
}

function spawnNext() {
    current = next;

    current.x = Math.floor(
        (COLS - current.matrix.length) / 2
    );

    current.y = -1;

    next = makePiece(nextFromBag());
    drawNext();

    if (!collides(current.matrix, current.x, current.y)) {
        return;
    }

    if (settings.immediateRespawn) {
        /*
         * A top-out starts a completely new run.
         *
         * This fixes the exploit where the board was cleared,
         * but score, level and line totals continued accumulating.
         */
        resetGame();
        return;
    }

    endGame();
}

function endGame() {
    gameOver = true;

    if (score > highScore) {
        highScore = score;
        saveHighScore();
    }

    updateScoreUI();
    gameoverOverlay.classList.add('show');
}

function lockPiece() {
    merge();
    clearLines();
    spawnNext();
}

function move(directionX) {
    if (gameOver) {
        return;
    }

    if (
        !collides(
            current.matrix,
            current.x + directionX,
            current.y
        )
    ) {
        current.x += directionX;
        draw();
    }
}

function moveAllWay(directionX) {
    if (gameOver) {
        return;
    }

    while (
        !collides(
            current.matrix,
            current.x + directionX,
            current.y
        )
    ) {
        current.x += directionX;
    }

    triggerBounce(directionX < 0 ? 'left' : 'right');
    draw();
}

function softDrop() {
    if (gameOver) {
        return;
    }

    if (
        !collides(
            current.matrix,
            current.x,
            current.y + 1
        )
    ) {
        current.y++;
        dropAcc = 0;
    } else {
        lockPiece();
    }

    draw();
}

function hardDrop() {
    if (gameOver) {
        return;
    }

    while (
        !collides(
            current.matrix,
            current.x,
            current.y + 1
        )
    ) {
        current.y++;
    }

    lockPiece();
    triggerBounce('down');
    draw();
}

function rotate(direction) {
    if (gameOver) {
        return;
    }

    const rotated = rotateMatrix(
        current.matrix,
        direction
    );

    const kicks = [0, -1, 1, -2, 2];

    for (const kick of kicks) {
        if (
            !collides(
                rotated,
                current.x + kick,
                current.y
            )
        ) {
            current.matrix = rotated;
            current.x += kick;

            draw();
            return;
        }
    }
}

function triggerBounce(direction) {
    const className = `bounce-${direction}`;

    boardWrap.classList.remove(
        'bounce-down',
        'bounce-left',
        'bounce-right'
    );

    // Force browser reflow so the animation can restart.
    void boardWrap.offsetWidth;

    boardWrap.classList.add(className);
}

function ghostY() {
    let projectedY = current.y;

    while (
        !collides(
            current.matrix,
            current.x,
            projectedY + 1
        )
    ) {
        projectedY++;
    }

    return projectedY;
}

function drawCell(
    target,
    column,
    row,
    size,
    color,
    alpha = 1
) {
    target.globalAlpha = alpha;
    target.fillStyle = color;

    target.fillRect(
        column * size + 1,
        row * size + 1,
        size - 2,
        size - 2
    );

    target.globalAlpha = 1;
}

function draw() {
    ctx.clearRect(
        0,
        0,
        boardCanvas.width,
        boardCanvas.height
    );

    ctx.strokeStyle = settings.gridLinesVisible
        ? 'rgba(255,255,255,0.14)'
        : 'rgba(255,255,255,0.04)';

    ctx.lineWidth = settings.gridLinesVisible
        ? 1.2
        : 1;

    for (let column = 0; column <= COLS; column++) {
        ctx.beginPath();
        ctx.moveTo(column * cell, 0);
        ctx.lineTo(column * cell, ROWS * cell);
        ctx.stroke();
    }

    for (let row = 0; row <= ROWS; row++) {
        ctx.beginPath();
        ctx.moveTo(0, row * cell);
        ctx.lineTo(COLS * cell, row * cell);
        ctx.stroke();
    }

    for (let row = 0; row < ROWS; row++) {
        for (let column = 0; column < COLS; column++) {
            const blockType = board[row][column];

            if (blockType) {
                drawCell(
                    ctx,
                    column,
                    row,
                    cell,
                    COLORS[blockType]
                );
            }
        }
    }

    if (!current) {
        return;
    }

    const projectedY = ghostY();
    const matrix = current.matrix;

    // Draw ghost piece.
    for (let row = 0; row < matrix.length; row++) {
        for (let column = 0; column < matrix.length; column++) {
            if (!matrix[row][column]) {
                continue;
            }

            const x = current.x + column;
            const y = projectedY + row;

            if (y >= 0) {
                drawCell(
                    ctx,
                    x,
                    y,
                    cell,
                    COLORS[current.type],
                    0.18
                );
            }
        }
    }

    // Draw current piece.
    for (let row = 0; row < matrix.length; row++) {
        for (let column = 0; column < matrix.length; column++) {
            if (!matrix[row][column]) {
                continue;
            }

            const x = current.x + column;
            const y = current.y + row;

            if (y >= 0) {
                drawCell(
                    ctx,
                    x,
                    y,
                    cell,
                    COLORS[current.type]
                );
            }
        }
    }
}

function drawNext() {
    nctx.clearRect(
        0,
        0,
        nextCanvas.width,
        nextCanvas.height
    );

    if (!next) {
        return;
    }

    const matrix = next.matrix;
    const size = matrix.length;

    let minimumRow = size;
    let maximumRow = -1;
    let minimumColumn = size;
    let maximumColumn = -1;

    for (let row = 0; row < size; row++) {
        for (let column = 0; column < size; column++) {
            if (!matrix[row][column]) {
                continue;
            }

            minimumRow = Math.min(minimumRow, row);
            maximumRow = Math.max(maximumRow, row);
            minimumColumn = Math.min(minimumColumn, column);
            maximumColumn = Math.max(maximumColumn, column);
        }
    }

    const pieceWidth =
        maximumColumn - minimumColumn + 1;

    const pieceHeight =
        maximumRow - minimumRow + 1;

    const offsetX =
        (4 - pieceWidth) / 2 - minimumColumn;

    const offsetY =
        (4 - pieceHeight) / 2 - minimumRow;

    for (let row = 0; row < size; row++) {
        for (let column = 0; column < size; column++) {
            if (!matrix[row][column]) {
                continue;
            }

            drawCell(
                nctx,
                column + offsetX,
                row + offsetY,
                previewCell,
                COLORS[next.type]
            );
        }
    }
}

window.addEventListener('keydown', event => {
    if (gameOver) {
        if (event.key === ' ') {
            resetGame();
            startLoop();
            event.preventDefault();
        }

        return;
    }

    const key = event.key;
    const shiftPressed = event.shiftKey;

    switch (key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            rotate(1);
            event.preventDefault();
            break;

        case 'q':
        case 'Q':
            rotate(-1);
            event.preventDefault();
            break;

        case 'e':
        case 'E':
            rotate(1);
            event.preventDefault();
            break;

        case 'ArrowLeft':
        case 'a':
        case 'A':
            if (shiftPressed) {
                moveAllWay(-1);
            } else {
                move(-1);
            }

            event.preventDefault();
            break;

        case 'ArrowRight':
        case 'd':
        case 'D':
            if (shiftPressed) {
                moveAllWay(1);
            } else {
                move(1);
            }

            event.preventDefault();
            break;

        case 'ArrowDown':
        case 's':
        case 'S':
            if (shiftPressed) {
                hardDrop();
            } else {
                softDrop();
            }

            event.preventDefault();
            break;

        case ' ':
            hardDrop();
            event.preventDefault();
            break;
    }
});

function startLoop() {
    if (animationFrameId === null) {
        animationFrameId = requestAnimationFrame(loop);
    }
}

function loop(time) {
    const elapsed = Math.min(time - lastTime, 250);
    lastTime = time;

    if (!gameOver) {
        dropAcc += elapsed;

        if (dropAcc >= dropInterval) {
            dropAcc = 0;

            if (
                !collides(
                    current.matrix,
                    current.x,
                    current.y + 1
                )
            ) {
                current.y++;
            } else {
                lockPiece();
            }

            draw();
        }
    }

    animationFrameId = requestAnimationFrame(loop);
}

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

sheetBackdrop.addEventListener('click', event => {
    if (event.target === sheetBackdrop) {
        sheetBackdrop.classList.remove('show');
    }
});

toggleSpeed.addEventListener('change', () => {
    settings.speedIncrease = toggleSpeed.checked;
    saveSettings();

    resetGame();
    startLoop();
});

toggleRespawn.addEventListener('change', () => {
    settings.immediateRespawn = toggleRespawn.checked;
    saveSettings();

    resetGame();
    startLoop();
});

toggleGridlines.addEventListener('change', () => {
    settings.gridLinesVisible = toggleGridlines.checked;
    saveSettings();

    draw();
});

resetGame();
startLoop();
