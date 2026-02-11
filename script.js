// ==================== CONFIGURACIÓN ====================

// API URL - Compatible con desarrollo y producción
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : `${window.location.origin}/api`;

// Estado de autenticación
let currentUser = null;
let authToken = null;

// Estado del juego
let board = [];
let currentTurn = 'white';
let selectedPiece = null;
let moves = [];
let capturedPieces = { white: [], black: [] };
let gameMode = null; // 'ai' o 'player'
let isAIThinking = false;
let moveHistory = [];
let castleRights = {
  white: { kingside: true, queenside: true },
  black: { kingside: true, queenside: true }
};
let enPassantTarget = null;

// Elementos del DOM
const authScreen = document.getElementById('auth-screen');
const modeScreen = document.getElementById('mode-screen');
const gameScreen = document.getElementById('game-screen');
const boardElement = document.getElementById('board');
const turnInfo = document.getElementById('turn-info');

// ==================== INICIALIZACIÓN DEL TABLERO ====================

function initBoard() {
  board = [
    ['♜','♞','♝','♛','♚','♝','♞','♜'],
    ['♟','♟','♟','♟','♟','♟','♟','♟'],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ['♙','♙','♙','♙','♙','♙','♙','♙'],
    ['♖','♘','♗','♕','♔','♗','♘','♖']
  ];
  currentTurn = 'white';
  selectedPiece = null;
  moves = [];
  moveHistory = [];
  capturedPieces = { white: [], black: [] };
  castleRights = {
    white: { kingside: true, queenside: true },
    black: { kingside: true, queenside: true }
  };
  enPassantTarget = null;
  isAIThinking = false;
}

// ==================== UTILIDADES HTTP MEJORADAS ====================

async function safeFetch(url, options = {}) {
  try {
    const response = await fetch(url, options);
    
    // Intentar parsear como JSON
    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text || 'Error desconocido del servidor' };
      }
    }
    
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    console.error('Error de red:', error);
    return { 
      ok: false, 
      status: 0, 
      data: { error: 'Error de conexión. Verifica tu conexión a internet.' }
    };
  }
}

// ==================== AUTENTICACIÓN MEJORADA ====================

function showMessage(message, isError = false) {
  const authMessage = document.getElementById('auth-message');
  authMessage.textContent = message;
  authMessage.className = isError ? 'message error' : 'message success';
  setTimeout(() => authMessage.className = 'message', 5000);
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

document.getElementById('show-register')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'block';
  document.getElementById('auth-message').className = 'message';
});

document.getElementById('show-login')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('auth-message').className = 'message';
});

document.getElementById('register-btn')?.addEventListener('click', async () => {
  const username = document.getElementById('register-username').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;

  if (!username || !email || !password) {
    showMessage('Todos los campos son requeridos', true);
    return;
  }

  if (!validateUsername(username)) {
    showMessage('Usuario debe tener 3-20 caracteres alfanuméricos', true);
    return;
  }

  if (!validateEmail(email)) {
    showMessage('Email inválido', true);
    return;
  }

  if (password.length < 6) {
    showMessage('La contraseña debe tener al menos 6 caracteres', true);
    return;
  }

  const response = await safeFetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });

  if (response.ok) {
    authToken = response.data.token;
    currentUser = response.data.user;
    localStorage.setItem('authToken', authToken);
    showMessage('¡Registro exitoso!', false);
    setTimeout(showModeScreen, 1000);
  } else {
    showMessage(response.data.error || 'Error al registrarse', true);
  }
});

document.getElementById('login-btn')?.addEventListener('click', async () => {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  if (!username || !password) {
    showMessage('Usuario y contraseña son requeridos', true);
    return;
  }

  const response = await safeFetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (response.ok) {
    authToken = response.data.token;
    currentUser = response.data.user;
    localStorage.setItem('authToken', authToken);
    showMessage('¡Login exitoso!', false);
    setTimeout(showModeScreen, 1000);
  } else {
    showMessage(response.data.error || 'Credenciales inválidas', true);
  }
});

async function verifyToken() {
  const token = localStorage.getItem('authToken');
  if (!token) return false;

  const response = await safeFetch(`${API_URL}/verify`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (response.ok) {
    authToken = token;
    currentUser = response.data.user;
    return true;
  } else {
    localStorage.removeItem('authToken');
    return false;
  }
}

// ==================== NAVEGACIÓN ====================

function showModeScreen() {
  authScreen.style.display = 'none';
  modeScreen.style.display = 'flex';
  gameScreen.style.display = 'none';
}

function showGameScreen() {
  authScreen.style.display = 'none';
  modeScreen.style.display = 'none';
  gameScreen.style.display = 'flex';
  document.getElementById('username-display').textContent = `👤 ${currentUser.username}`;
  initBoard();
  renderBoard();
}

document.getElementById('mode-vs-ai')?.addEventListener('click', () => {
  gameMode = 'ai';
  document.getElementById('game-mode-text').textContent = '🤖 VS Computadora';
  document.getElementById('black-player').textContent = 'Computadora (IA)';
  document.getElementById('white-player').textContent = currentUser.username;
  showGameScreen();
});

document.getElementById('mode-vs-player')?.addEventListener('click', () => {
  gameMode = 'player';
  document.getElementById('game-mode-text').textContent = '👥 VS Jugador';
  document.getElementById('black-player').textContent = 'Jugador 2';
  document.getElementById('white-player').textContent = currentUser.username;
  showGameScreen();
});

document.getElementById('back-to-menu')?.addEventListener('click', () => {
  localStorage.removeItem('authToken');
  authToken = null;
  currentUser = null;
  modeScreen.style.display = 'none';
  authScreen.style.display = 'flex';
});

document.getElementById('back-btn')?.addEventListener('click', () => {
  gameScreen.style.display = 'none';
  showModeScreen();
});

// ==================== LÓGICA AJEDREZ ====================

function isPieceWhite(piece) {
  return ['♖','♘','♗','♕','♔','♙'].includes(piece);
}

function isPieceBlack(piece) {
  return ['♜','♞','♝','♛','♚','♟'].includes(piece);
}

function getPieceType(piece) {
  const types = {
    '♔': 'king', '♚': 'king',
    '♕': 'queen', '♛': 'queen',
    '♖': 'rook', '♜': 'rook',
    '♗': 'bishop', '♝': 'bishop',
    '♘': 'knight', '♞': 'knight',
    '♙': 'pawn', '♟': 'pawn'
  };
  return types[piece] || null;
}

function findKing(color) {
  const kingPiece = color === 'white' ? '♔' : '♚';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (board[row][col] === kingPiece) {
        return { row, col };
      }
    }
  }
  return null;
}

function isSquareUnderAttack(row, col, byColor) {
  for (let fromRow = 0; fromRow < 8; fromRow++) {
    for (let fromCol = 0; fromCol < 8; fromCol++) {
      const piece = board[fromRow][fromCol];
      if (!piece) continue;
      
      if ((byColor === 'white' && isPieceWhite(piece)) || 
          (byColor === 'black' && isPieceBlack(piece))) {
        if (canPieceAttack(fromRow, fromCol, row, col)) {
          return true;
        }
      }
    }
  }
  return false;
}

function canPieceAttack(fromRow, fromCol, toRow, toCol) {
  const piece = board[fromRow][fromCol];
  if (!piece) return false;
  
  const pieceType = getPieceType(piece);
  const isWhite = isPieceWhite(piece);
  
  switch (pieceType) {
    case 'pawn':
      const direction = isWhite ? -1 : 1;
      return Math.abs(fromCol - toCol) === 1 && toRow === fromRow + direction;
    case 'rook':
      return isValidRookMove(fromRow, fromCol, toRow, toCol);
    case 'knight':
      return isValidKnightMove(fromRow, fromCol, toRow, toCol);
    case 'bishop':
      return isValidBishopMove(fromRow, fromCol, toRow, toCol);
    case 'queen':
      return isValidQueenMove(fromRow, fromCol, toRow, toCol);
    case 'king':
      return isValidKingMove(fromRow, fromCol, toRow, toCol);
    default:
      return false;
  }
}

function isInCheck(color) {
  const king = findKing(color);
  if (!king) return false;
  return isSquareUnderAttack(king.row, king.col, color === 'white' ? 'black' : 'white');
}

function wouldBeInCheck(fromRow, fromCol, toRow, toCol, color) {
  const originalPiece = board[toRow][toCol];
  const movingPiece = board[fromRow][fromCol];
  
  board[toRow][toCol] = movingPiece;
  board[fromRow][fromCol] = null;
  
  const inCheck = isInCheck(color);
  
  board[fromRow][fromCol] = movingPiece;
  board[toRow][toCol] = originalPiece;
  
  return inCheck;
}

function isValidMove(fromRow, fromCol, toRow, toCol) {
  if (fromRow === toRow && fromCol === toCol) return false;
  if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;

  const piece = board[fromRow][fromCol];
  const target = board[toRow][toCol];
  
  if (!piece) return false;
  
  if (target && ((isPieceWhite(piece) && isPieceWhite(target)) || 
                 (isPieceBlack(piece) && isPieceBlack(target)))) {
    return false;
  }

  const pieceType = getPieceType(piece);
  const isWhite = isPieceWhite(piece);
  const color = isWhite ? 'white' : 'black';

  let isValid = false;

  switch (pieceType) {
    case 'pawn':
      isValid = isValidPawnMove(fromRow, fromCol, toRow, toCol, isWhite);
      break;
    case 'rook':
      isValid = isValidRookMove(fromRow, fromCol, toRow, toCol);
      break;
    case 'knight':
      isValid = isValidKnightMove(fromRow, fromCol, toRow, toCol);
      break;
    case 'bishop':
      isValid = isValidBishopMove(fromRow, fromCol, toRow, toCol);
      break;
    case 'queen':
      isValid = isValidQueenMove(fromRow, fromCol, toRow, toCol);
      break;
    case 'king':
      isValid = isValidKingMove(fromRow, fromCol, toRow, toCol);
      if (!isValid && fromRow === toRow && Math.abs(fromCol - toCol) === 2) {
        isValid = canCastleMove(fromRow, fromCol, toRow, toCol, color);
      }
      break;
    default:
      return false;
  }

  if (!isValid) return false;
  return !wouldBeInCheck(fromRow, fromCol, toRow, toCol, color);
}

function isValidPawnMove(fromRow, fromCol, toRow, toCol, isWhite) {
  const direction = isWhite ? -1 : 1;
  const startRow = isWhite ? 6 : 1;
  
  if (fromCol === toCol && !board[toRow][toCol]) {
    if (toRow === fromRow + direction) return true;
    if (fromRow === startRow && toRow === fromRow + 2 * direction && 
        !board[fromRow + direction][toCol]) {
      return true;
    }
  }
  
  if (Math.abs(fromCol - toCol) === 1 && toRow === fromRow + direction) {
    const target = board[toRow][toCol];
    if (target && ((isWhite && isPieceBlack(target)) || 
                   (!isWhite && isPieceWhite(target)))) {
      return true;
    }
    if (enPassantTarget && enPassantTarget.row === toRow && 
        enPassantTarget.col === toCol) {
      return true;
    }
  }
  
  return false;
}

function isValidRookMove(fromRow, fromCol, toRow, toCol) {
  if (fromRow !== toRow && fromCol !== toCol) return false;
  
  const rowStep = fromRow === toRow ? 0 : (toRow > fromRow ? 1 : -1);
  const colStep = fromCol === toCol ? 0 : (toCol > fromCol ? 1 : -1);
  
  let row = fromRow + rowStep;
  let col = fromCol + colStep;
  
  while (row !== toRow || col !== toCol) {
    if (board[row][col]) return false;
    row += rowStep;
    col += colStep;
  }
  
  return true;
}

function isValidKnightMove(fromRow, fromCol, toRow, toCol) {
  const rowDiff = Math.abs(fromRow - toRow);
  const colDiff = Math.abs(fromCol - toCol);
  return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
}

function isValidBishopMove(fromRow, fromCol, toRow, toCol) {
  if (Math.abs(fromRow - toRow) !== Math.abs(fromCol - toCol)) return false;
  
  const rowStep = toRow > fromRow ? 1 : -1;
  const colStep = toCol > fromCol ? 1 : -1;
  
  let row = fromRow + rowStep;
  let col = fromCol + colStep;
  
  while (row !== toRow || col !== toCol) {
    if (board[row][col]) return false;
    row += rowStep;
    col += colStep;
  }
  
  return true;
}

function isValidQueenMove(fromRow, fromCol, toRow, toCol) {
  return isValidRookMove(fromRow, fromCol, toRow, toCol) || 
         isValidBishopMove(fromRow, fromCol, toRow, toCol);
}

function isValidKingMove(fromRow, fromCol, toRow, toCol) {
  const rowDiff = Math.abs(fromRow - toRow);
  const colDiff = Math.abs(fromCol - toCol);
  return rowDiff <= 1 && colDiff <= 1;
}

function canCastleMove(fromRow, fromCol, toRow, toCol, color) {
  if (fromRow !== toRow) return false;
  if (isInCheck(color)) return false;
  
  const isKingside = toCol > fromCol;
  const rookCol = isKingside ? 7 : 0;
  const direction = isKingside ? 1 : -1;
  
  if (color === 'white') {
    if (isKingside && !castleRights.white.kingside) return false;
    if (!isKingside && !castleRights.white.queenside) return false;
  } else {
    if (isKingside && !castleRights.black.kingside) return false;
    if (!isKingside && !castleRights.black.queenside) return false;
  }
  
  for (let col = fromCol + direction; col !== rookCol; col += direction) {
    if (board[fromRow][col]) return false;
  }
  
  for (let col = fromCol; col !== toCol + direction; col += direction) {
    if (isSquareUnderAttack(fromRow, col, color === 'white' ? 'black' : 'white')) {
      return false;
    }
  }
  
  return true;
}

function performCastle(fromRow, fromCol, toRow, toCol) {
  const isKingside = toCol > fromCol;
  const rookFromCol = isKingside ? 7 : 0;
  const rookToCol = isKingside ? toCol - 1 : toCol + 1;
  
  board[fromRow][rookToCol] = board[fromRow][rookFromCol];
  board[fromRow][rookFromCol] = null;
}

function promotePawn(row, col) {
  const isWhite = row === 0;
  const queenPiece = isWhite ? '♕' : '♛';
  board[row][col] = queenPiece;
}

function getAllValidMoves(color) {
  const moves = [];
  for (let fromRow = 0; fromRow < 8; fromRow++) {
    for (let fromCol = 0; fromCol < 8; fromCol++) {
      const piece = board[fromRow][fromCol];
      if (!piece) continue;
      if ((color === 'white' && !isPieceWhite(piece)) || 
          (color === 'black' && !isPieceBlack(piece))) continue;
      
      for (let toRow = 0; toRow < 8; toRow++) {
        for (let toCol = 0; toCol < 8; toCol++) {
          if (isValidMove(fromRow, fromCol, toRow, toCol)) {
            moves.push({ fromRow, fromCol, toRow, toCol, piece });
          }
        }
      }
    }
  }
  return moves;
}

function isCheckmate(color) {
  if (!isInCheck(color)) return false;
  return getAllValidMoves(color).length === 0;
}

function isStalemate(color) {
  if (isInCheck(color)) return false;
  return getAllValidMoves(color).length === 0;
}

// ==================== IA ====================

function evaluateBoard() {
  let score = 0;
  const pieceValues = {
    '♙': 1, '♟': -1,
    '♘': 3, '♞': -3,
    '♗': 3, '♝': -3,
    '♖': 5, '♜': -5,
    '♕': 9, '♛': -9,
    '♔': 100, '♚': -100
  };
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        score += pieceValues[piece] || 0;
      }
    }
  }
  
  return score;
}

function makeAIMove() {
  if (isAIThinking) return;
  isAIThinking = true;
  
  showAIThinkingIndicator();
  
  setTimeout(() => {
    const validMoves = getAllValidMoves('black');
    
    if (validMoves.length === 0) {
      hideAIThinkingIndicator();
      isAIThinking = false;
      
      if (isInCheck('black')) {
        showWinnerAnimation('Blancas', 'Jaque Mate');
        saveGameToServer('Blancas');
      } else {
        showWinnerAnimation('Empate', 'Ahogado');
        saveGameToServer('Empate');
      }
      setTimeout(() => resetGame(), 3000);
      return;
    }
    
    let bestMove = validMoves[0];
    let bestScore = -Infinity;
    
    for (const move of validMoves) {
      const originalPiece = board[move.toRow][move.toCol];
      board[move.toRow][move.toCol] = board[move.fromRow][move.fromCol];
      board[move.fromRow][move.fromCol] = null;
      
      let score = -evaluateBoard();
      
      if (originalPiece) {
        const pieceValue = {
          '♙': 10, '♘': 30, '♗': 30, '♖': 50, '♕': 90, '♔': 1000
        };
        score += (pieceValue[originalPiece] || 0) * 10;
      }
      
      const centerDist = Math.abs(move.toRow - 3.5) + Math.abs(move.toCol - 3.5);
      score += (7 - centerDist) * 2;
      
      if (isInCheck('white')) {
        score += 50;
      }
      
      score += Math.random() * 5;
      
      board[move.fromRow][move.fromCol] = board[move.toRow][move.toCol];
      board[move.toRow][move.toCol] = originalPiece;
      
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    
    executeMove(bestMove.fromRow, bestMove.fromCol, bestMove.toRow, bestMove.toCol);
    
    hideAIThinkingIndicator();
    isAIThinking = false;
    
    const winner = checkGameEnd();
    if (winner) {
      setTimeout(() => {
        if (winner === 'Empate') {
          showWinnerAnimation('Empate', 'Tablas');
        } else if (isCheckmate(winner === 'Blancas' ? 'black' : 'white')) {
          showWinnerAnimation(winner, 'Jaque Mate');
        } else {
          showWinnerAnimation(winner, 'Captura de Rey');
        }
        saveGameToServer(winner);
        setTimeout(() => resetGame(), 3000);
      }, 500);
    }
    
    renderBoard();
  }, 800);
}

function showAIThinkingIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'ai-thinking-indicator';
  indicator.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9); padding: 30px 50px; border-radius: 15px;
    color: white; font-size: 1.5rem; font-weight: bold; z-index: 9999;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8); border: 2px solid #FFD700;
  `;
  indicator.innerHTML = '🤖 IA pensando<span class="dots"></span>';
  document.body.appendChild(indicator);
  
  let dots = 0;
  const dotsInterval = setInterval(() => {
    const dotsElement = indicator.querySelector('.dots');
    if (dotsElement) {
      dots = (dots + 1) % 4;
      dotsElement.textContent = '.'.repeat(dots);
    } else {
      clearInterval(dotsInterval);
    }
  }, 500);
}

function hideAIThinkingIndicator() {
  const indicator = document.getElementById('ai-thinking-indicator');
  if (indicator) {
    document.body.removeChild(indicator);
  }
}

// ==================== RENDERIZADO ====================

function renderBoard() {
  boardElement.innerHTML = '';
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = document.createElement('div');
      square.classList.add('square');
      if ((row + col) % 2 === 0) square.classList.add('light');
      else square.classList.add('dark');

      const piece = board[row][col];
      if (piece) {
        const pieceElement = document.createElement('span');
        pieceElement.classList.add('piece');
        pieceElement.classList.add(isPieceWhite(piece) ? 'white' : 'black');
        pieceElement.textContent = piece;
        square.appendChild(pieceElement);
      }

      square.addEventListener('click', () => handleSquareClick(row, col));
      boardElement.appendChild(square);
    }
  }
  
  const turnEmoji = currentTurn === 'white' ? '⚪' : '⚫';
  const turnText = currentTurn === 'white' ? 'Blancas' : 'Negras';
  let statusText = `Turno: <strong>${turnText}</strong>`;
  
  if (isInCheck(currentTurn)) {
    statusText += ' <span style="color: #e74c3c; font-weight: bold;">⚠️ JAQUE</span>';
  }
  
  turnInfo.innerHTML = `<div class="turn-icon">${turnEmoji}</div><div>${statusText}</div>`;
}

function executeMove(fromRow, fromCol, toRow, toCol) {
  const piece = board[fromRow][fromCol];
  const pieceType = getPieceType(piece);
  const isWhite = isPieceWhite(piece);
  const color = isWhite ? 'white' : 'black';
  
  moveHistory.push({
    from: { row: fromRow, col: fromCol },
    to: { row: toRow, col: toCol },
    piece,
    captured: board[toRow][toCol]
  });
  
  const capturedPiece = board[toRow][toCol];
  if (capturedPiece) {
    if (isPieceWhite(capturedPiece)) capturedPieces.black.push(capturedPiece);
    else capturedPieces.white.push(capturedPiece);
    updateCapturedPieces();
  }
  
  if (pieceType === 'pawn' && enPassantTarget && 
      enPassantTarget.row === toRow && enPassantTarget.col === toCol) {
    const capturedRow = isWhite ? toRow + 1 : toRow - 1;
    const capturedPawn = board[capturedRow][toCol];
    if (capturedPawn) {
      if (isPieceWhite(capturedPawn)) capturedPieces.black.push(capturedPawn);
      else capturedPieces.white.push(capturedPawn);
      board[capturedRow][toCol] = null;
      updateCapturedPieces();
    }
  }
  
  enPassantTarget = null;
  if (pieceType === 'pawn' && Math.abs(fromRow - toRow) === 2) {
    enPassantTarget = {
      row: isWhite ? fromRow - 1 : fromRow + 1,
      col: fromCol
    };
  }
  
  if (pieceType === 'king' && Math.abs(fromCol - toCol) === 2) {
    performCastle(fromRow, fromCol, toRow, toCol);
  }
  
  if (pieceType === 'king') {
    if (color === 'white') {
      castleRights.white.kingside = false;
      castleRights.white.queenside = false;
    } else {
      castleRights.black.kingside = false;
      castleRights.black.queenside = false;
    }
  }
  if (pieceType === 'rook') {
    if (color === 'white') {
      if (fromCol === 0) castleRights.white.queenside = false;
      if (fromCol === 7) castleRights.white.kingside = false;
    } else {
      if (fromCol === 0) castleRights.black.queenside = false;
      if (fromCol === 7) castleRights.black.kingside = false;
    }
  }
  
  board[toRow][toCol] = piece;
  board[fromRow][fromCol] = null;
  
  if (pieceType === 'pawn' && (toRow === 0 || toRow === 7)) {
    promotePawn(toRow, toCol);
  }
  
  const fromFile = String.fromCharCode(97 + fromCol);
  const fromRank = 8 - fromRow;
  const toFile = String.fromCharCode(97 + toCol);
  const toRank = 8 - toRow;
  moves.push(`${fromFile}${fromRank}${toFile}${toRank}`);
  
  currentTurn = currentTurn === 'white' ? 'black' : 'white';
}

function handleSquareClick(row, col) {
  if (gameMode === 'ai' && currentTurn === 'black') return;
  if (isAIThinking) return;
  
  if (selectedPiece) {
    if (isValidMove(selectedPiece.row, selectedPiece.col, row, col)) {
      executeMove(selectedPiece.row, selectedPiece.col, row, col);
      selectedPiece = null;
      
      const winner = checkGameEnd();
      if (winner) {
        setTimeout(() => {
          if (winner === 'Empate') {
            showWinnerAnimation('Empate', 'Tablas');
          } else if (isCheckmate(winner === 'Blancas' ? 'black' : 'white')) {
            showWinnerAnimation(winner, 'Jaque Mate');
          } else {
            showWinnerAnimation(winner, 'Captura de Rey');
          }
          saveGameToServer(winner);
          setTimeout(() => resetGame(), 3000);
        }, 100);
        renderBoard();
        return;
      }
      
      renderBoard();
      
      if (gameMode === 'ai' && currentTurn === 'black') {
        makeAIMove();
      }
    } else {
      selectedPiece = null;
      renderBoard();
    }
  } else {
    const piece = board[row][col];
    if (piece && ((currentTurn === 'white' && isPieceWhite(piece)) || 
                  (currentTurn === 'black' && isPieceBlack(piece)))) {
      selectedPiece = {row, col};
      renderBoard();
      highlightSelected(row, col);
    }
  }
}

function highlightSelected(row, col) {
  const squares = boardElement.children;
  const index = row * 8 + col;
  squares[index].classList.add('selected');
  
  for (let i = 0; i < 64; i++) {
    const r = Math.floor(i / 8);
    const c = i % 8;
    if (isValidMove(row, col, r, c)) {
      squares[i].classList.add('possible-move');
    }
  }
}

function updateCapturedPieces() {
  const whiteCaptured = document.querySelector('#captured-black .pieces-container');
  const blackCaptured = document.querySelector('#captured-white .pieces-container');
  
  whiteCaptured.innerHTML = capturedPieces.white.map(p => `<span class="white">${p}</span>`).join('');
  blackCaptured.innerHTML = capturedPieces.black.map(p => `<span class="black">${p}</span>`).join('');
}

function checkGameEnd() {
  if (isCheckmate('white')) return 'Negras';
  if (isCheckmate('black')) return 'Blancas';
  if (isStalemate('white') || isStalemate('black')) return 'Empate';
  
  let whiteKing = false;
  let blackKing = false;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (board[row][col] === '♔') whiteKing = true;
      if (board[row][col] === '♚') blackKing = true;
    }
  }
  if (!blackKing) return 'Blancas';
  if (!whiteKing) return 'Negras';
  
  return null;
}

function showWinnerAnimation(winner, reason = '') {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.9); display: flex; align-items: center;
    justify-content: center; z-index: 10000; animation: fadeIn 0.5s ease-out;
    flex-direction: column; gap: 20px;
  `;
  
  const messageBox = document.createElement('div');
  messageBox.style.cssText = `
    background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
    padding: 40px 60px; border-radius: 20px; font-size: 2.5rem;
    font-weight: bold; color: #1a1a2e; text-align: center;
    box-shadow: 0 20px 60px rgba(255, 215, 0, 0.8);
  `;
  
  let emoji = '🏆';
  let text = '';
  
  if (winner === 'Empate') {
    emoji = '🤝';
    text = `${emoji} ¡${winner}!`;
  } else {
    emoji = winner === 'Blancas' ? '⚪' : '⚫';
    text = `${emoji} ¡${winner} gana! 🏆`;
  }
  
  messageBox.textContent = text;
  
  if (reason) {
    const reasonBox = document.createElement('div');
    reasonBox.style.cssText = `
      color: #FFD700; font-size: 1.5rem; font-weight: bold;
    `;
    reasonBox.textContent = reason;
    overlay.appendChild(messageBox);
    overlay.appendChild(reasonBox);
  } else {
    overlay.appendChild(messageBox);
  }
  
  document.body.appendChild(overlay);
  
  setTimeout(() => {
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
  }, 2800);
}

async function saveGameToServer(winner) {
  if (!authToken) return;
  
  const response = await safeFetch(`${API_URL}/games`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ winner, moves })
  });
  
  if (!response.ok) {
    console.error('Error al guardar partida:', response.data.error);
  }
}

function resetGame() {
  initBoard();
  renderBoard();
  updateCapturedPieces();
}

// ==================== CONTROLES ====================

document.getElementById('reset-btn')?.addEventListener('click', () => {
  if (confirm('¿Reiniciar la partida actual?')) resetGame();
});

document.getElementById('show-history-btn')?.addEventListener('click', async () => {
  if (!authToken) return;
  
  const response = await safeFetch(`${API_URL}/games`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  
  if (response.ok) {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = response.data.games.length === 0 
      ? '<p style="text-align: center; color: #999;">No hay partidas guardadas</p>'
      : response.data.games.map((game, i) => `
          <div class="history-item">
            <strong>🏆 Partida #${response.data.games.length - i}</strong><br>
            📅 ${new Date(game.played_at).toLocaleString('es-ES')}<br>
            ${game.winner === 'Blancas' ? '⚪' : game.winner === 'Negras' ? '⚫' : '🤝'} Ganador: <strong>${game.winner}</strong><br>
            ♟️ Movimientos: ${game.move_count}
          </div>
        `).join('');
    document.getElementById('history-modal').style.display = 'flex';
  } else {
    alert('Error al cargar historial: ' + response.data.error);
  }
});

document.getElementById('show-stats-btn')?.addEventListener('click', async () => {
  if (!authToken) return;
  
  const response = await safeFetch(`${API_URL}/stats`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  
  if (response.ok) {
    const stats = response.data.stats;
    document.getElementById('stats-content').innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
        <div class="stat-card"><h3>🎮 Partidas</h3><div class="stat-value">${stats.total_games || 0}</div></div>
        <div class="stat-card"><h3>⚪ Victorias Blancas</h3><div class="stat-value">${stats.white_wins || 0}</div></div>
        <div class="stat-card"><h3>⚫ Victorias Negras</h3><div class="stat-value">${stats.black_wins || 0}</div></div>
        <div class="stat-card"><h3>♟️ Promedio Mov.</h3><div class="stat-value">${stats.avg_moves ? parseFloat(stats.avg_moves).toFixed(1) : 0}</div></div>
      </div>
    `;
    document.getElementById('stats-modal').style.display = 'flex';
  } else {
    alert('Error al cargar estadísticas: ' + response.data.error);
  }
});

document.getElementById('close-history')?.addEventListener('click', () => {
  document.getElementById('history-modal').style.display = 'none';
});

document.getElementById('close-stats')?.addEventListener('click', () => {
  document.getElementById('stats-modal').style.display = 'none';
});

window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) e.target.style.display = 'none';
});

// ==================== INICIALIZACIÓN ====================

(async function init() {
  const isAuthenticated = await verifyToken();
  if (isAuthenticated) showModeScreen();
})();