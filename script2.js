const boardElement = document.getElementById('board');
const statusDisplay = document.getElementById('status');
const resetButton = document.getElementById('reset-button');
const passTurnButton = document.getElementById('pass-turn-button'); // Novo botão

const BOARD_SIZE = 8;
const PLAYER1 = 'player1'; // Vermelhas (começa)
const PLAYER2 = 'player2'; // Pretas
const AUTO_PASS_TIMEOUT = 5000; // 5 segundos

let boardState = [];
let currentPlayer = PLAYER1;
let selectedPiece = null;
let validMoves = [];
let gameActive = true;
let lockedPieceInfo = null; // Guarda { element, row, col, isKing } da peça que pode capturar de novo
let autoPassTimer = null; // Guarda o ID do timer
let allowBackwardPawnCapture = true; // Defina como true para permitir, false para proibir
let player1Wins = 0;
let player2Wins = 0;

// ... (resto das variáveis globais) ...

// --- Inicialização (createBoard, createPiece - sem mudanças significativas) ---
function createBoard() { /* ... código igual ao anterior ... */
    boardElement.innerHTML = ''; // Limpa o tabuleiro existente
    boardState = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        boardState[row] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((row + col) % 2 === 0 ? 'light' : 'dark'); // Alterna cores
            square.dataset.row = row;
            square.dataset.col = col;

            let piece = null;
            // Posiciona as peças iniciais (somente nas casas escuras)
            if ((row + col) % 2 !== 0) { // Somente casas escuras
                if (row < 3) {
                    piece = createPiece(PLAYER2, row, col); // Peças Pretas/Jogador 2 em cima
                    boardState[row][col] = { player: PLAYER2, isKing: false };
                } else if (row > 4) {
                    piece = createPiece(PLAYER1, row, col); // Peças Vermelhas/Jogador 1 em baixo
                    boardState[row][col] = { player: PLAYER1, isKing: false };
                } else {
                    boardState[row][col] = null; // Casa vazia
                }
            } else {
                boardState[row][col] = null; // Casa clara sempre vazia no estado
            }

            if (piece) {
                square.appendChild(piece);
            }
            square.addEventListener('click', handleSquareClick);
            boardElement.appendChild(square);
        }
    }
}


function createPiece(player, row, col) { /* ... código igual ao anterior ... */
    const piece = document.createElement('div');
    piece.classList.add('piece', player);
    piece.dataset.row = row;
    piece.dataset.col = col;
    // Adiciona o listener diretamente na peça para facilitar a seleção
    piece.addEventListener('click', handlePieceClick);
    return piece;
}
// --- Lógica do Jogo (Com Alterações) ---

function handlePieceClick(event) {
    event.stopPropagation(); // Impede que o clique propague para o quadrado
    if (!gameActive) return;

    const pieceElement = event.target;
    const row = parseInt(pieceElement.dataset.row);
    const col = parseInt(pieceElement.dataset.col);
    const pieceData = boardState[row][col]; // Pega dados da peça no estado (se houver)

    // Verifica se o clique foi em uma peça válida
    if (!pieceData || pieceData.player !== currentPlayer) {
         // Clicou em casa vazia, peça do oponente, ou bug?
         // Se uma peça estava travada, não deseleciona, mantém o foco nela.
         if (!lockedPieceInfo && selectedPiece) {
              deselectPiece(); // Deseleciona se clicou fora e nada está travado
         }
         console.log("Clique inválido - não é sua peça.");
         return;
    }

    // Se uma peça está travada (captura obrigatória subsequente)
    if (lockedPieceInfo) {
        if (pieceElement === lockedPieceInfo.element) {
            // Clicou na peça correta (a que deve capturar de novo)
            // Re-seleciona para garantir que os movimentos (apenas capturas) sejam mostrados
            selectPiece(pieceElement, row, col, pieceData.isKing);
        } else {
            // Clicou em OUTRA peça sua enquanto uma estava travada
            console.log("Ação inválida: Você DEVE capturar novamente com a peça destacada.");
            // Não faz nada, não permite selecionar outra peça.
        }
        return; // Sai da função após tratar clique durante trava
    }

    // Lógica normal de seleção (nenhuma peça travada)
    if (selectedPiece && selectedPiece.element === pieceElement) {
        // Clicou na peça que já estava selecionada -> Deseleciona
        deselectPiece();
    } else {
        // Tenta selecionar a peça clicada, aplicando regras de captura obrigatória
        selectPiece(pieceElement, row, col, pieceData.isKing);
         // A função selectPiece agora contém a lógica para verificar se
         // esta peça pode ser selecionada (devido a capturas obrigatórias gerais)
         // e quais movimentos mostrar.
    }
}


function handleSquareClick(event) {
    if (!gameActive || !selectedPiece) {
        // Ignora clique se jogo acabou ou nenhuma peça está selecionada
        // Se uma peça estava selecionada mas clicou fora (e não está travada), deseleciona?
        // A lógica atual já faz isso implicitamente ao não encontrar 'validMove'.
        if (selectedPiece && !lockedPieceInfo) {
            // Poderia deselecionar aqui se clicar num quadrado vazio, mas talvez seja melhor
            // deixar como está: só deseleciona se clicar em outra peça (handlePieceClick)
            // ou após fazer um movimento.
        }
        return;
    }

    const squareElement = event.currentTarget;
    const toRow = parseInt(squareElement.dataset.row);
    const toCol = parseInt(squareElement.dataset.col);

    // Encontra o movimento correspondente ao quadrado clicado DENTRO dos movimentos válidos ATUALMENTE MOSTRADOS
    const validMove = validMoves.find(move => move.toRow === toRow && move.toCol === toCol);

    if (validMove) {
        // Achou um movimento válido (seja simples ou captura)!
        makeMove(selectedPiece, validMove); // Processa o movimento
    } else {
        // Clicou num quadrado que NÃO é um movimento válido para a peça selecionada.
        // Se a peça está travada, não faz nada (espera clique no highlight).
        // Se não está travada, poderia deselecionar a peça.
        if (!lockedPieceInfo) {
            console.log("Clique em quadrado inválido.");
            // deselectPiece(); // Descomente se quiser deselecionar ao clicar fora
        }
    }
}


function selectPiece(element, row, col, isKing) {
    if (selectedPiece && selectedPiece.element !== element) {
        deselectPiece();
    }
    selectedPiece = { element, row, col, isKing };
    element.classList.add('selected');

    let forbiddenDirection = null; // Direção a ser evitada no próximo passo

    // Se esta peça está travada E é uma Dama, calcula a direção proibida (reversa da última)
    if (lockedPieceInfo && lockedPieceInfo.element === element && lockedPieceInfo.isKing && lockedPieceInfo.lastMoveDirection) {
        const lastDir = lockedPieceInfo.lastMoveDirection;
        // A direção proibida é a oposta da última usada
        forbiddenDirection = { dr: -lastDir.dr, dc: -lastDir.dc };
        console.log("Peça Dama travada. Direção proibida para próximo salto:", forbiddenDirection);
    }

    // Calcula movimentos válidos, passando a direção proibida se aplicável
    validMoves = calculateValidMoves(row, col, isKing, currentPlayer, forbiddenDirection);

    // Filtra os movimentos baseado no estado do jogo (Trava ou Obrigação Geral)
    if (lockedPieceInfo && lockedPieceInfo.element === element) {
        // Se esta é a peça travada, mostra APENAS as capturas OBRIGATÓRIAS subsequentes
        validMoves = validMoves.filter(move => move.captures);
        console.log("Mostrando apenas próximas capturas obrigatórias (filtradas pela direção se for Dama).", validMoves);
        if(validMoves.length == 0)
            promoted = true
    } else if (!lockedPieceInfo) {
        // Aplica a regra geral de captura obrigatória
        const allPlayerMoves = getAllMovesForPlayer(currentPlayer);
        const captureIsAvailable = allPlayerMoves.some(move => move.captures);
        if (captureIsAvailable) {
            const pieceCanCapture = validMoves.some(move => move.captures);
            if (pieceCanCapture) {
                validMoves = validMoves.filter(move => move.captures);
            } else {
                validMoves = []; // Esta peça não pode mover
            }
        }
    }

    highlightValidMoves(validMoves); // Mostra os movimentos filtrados
}


function deselectPiece() {
    if (selectedPiece) {
        selectedPiece.element.classList.remove('selected');
    }
    clearValidMoveHighlights();
    selectedPiece = null; // Limpa a referência à peça selecionada
    validMoves = [];      // Limpa a lista de movimentos válidos mostrados
}


function finalizeAndSwitchPlayer() {
    if (!gameActive) return;
    lockedPieceInfo = null; // << GARANTA QUE ISSO ESTÁ AQUI
    currentPlayer = currentPlayer === PLAYER1 ? PLAYER2 : PLAYER1;
    statusDisplay.textContent = `Vez do ${currentPlayer === PLAYER1 ? 'Jogador 1 (Vermelhas)' : 'Jogador 2 (Pretas)'}`;
    console.log("Jogador trocado para:", currentPlayer);
    checkWinCondition();
}



function makeMove(pieceInfo, move) {
    const previousPosition = { row: pieceInfo.row, col: pieceInfo.col };
    const { element } = pieceInfo;
    const { toRow, toCol, captures } = move;

    // --- Atualização Lógica e Visual ---
    const pieceDataBeforeMove = { ...boardState[previousPosition.row][previousPosition.col] };
    boardState[toRow][toCol] = pieceDataBeforeMove;
    boardState[previousPosition.row][previousPosition.col] = null;
    const targetSquare = boardElement.querySelector(`.square[data-row="${toRow}"][data-col="${toCol}"]`);
    targetSquare.appendChild(element);
    element.dataset.row = toRow;
    element.dataset.col = toCol;

    let captured = false;
    if (captures) {
        const capturedPieceElement = boardElement.querySelector(`.piece[data-row="${captures.row}"][data-col="${captures.col}"]`);
        if (capturedPieceElement) capturedPieceElement.remove();
        boardState[captures.row][captures.col] = null;
        captured = true;
    }

    // --- Verificação de Promoção ---
    let promoted = false;
    const pieceDataAfterMove = boardState[toRow][toCol];
    if (!pieceDataBeforeMove.isKing &&
        ((pieceDataAfterMove.player === PLAYER1 && toRow === 0) ||
         (pieceDataAfterMove.player === PLAYER2 && toRow === BOARD_SIZE - 1)))
    {
        pieceDataAfterMove.isKing = true;
        element.classList.add('king');
        promoted = true;
    }

    // --- Limpa Seleção Visual Atual ---
    deselectPiece();

    // --- Decide Próximo Passo ---
    if (promoted) {
        console.log("Promoção encerra o turno. Passando a vez.");
        finalizeAndSwitchPlayer();
        return;
    }

    if (captured) {
        // CAPTUROU. Verifica OBRIGATORIEDADE de nova captura.
        let forbiddenDirection = null;
        const lastMoveDr = Math.sign(toRow - previousPosition.row);
        const lastMoveDc = Math.sign(toCol - previousPosition.col);
        const lastMoveDirection = { dr: lastMoveDr, dc: lastMoveDc };

        // Se a peça que capturou É uma Dama, calcula a direção proibida para a próxima checagem
        if (pieceDataAfterMove.isKing) {
            forbiddenDirection = { dr: -lastMoveDr, dc: -lastMoveDc };
            console.log("Dama capturou. Verificando próximas capturas, proibindo:", forbiddenDirection);
        } else {
             console.log("Peão capturou. Verificando próximas capturas.");
        }


        // *** A VERIFICAÇÃO CRÍTICA ***
        // Calcula as capturas possíveis A PARTIR DA NOVA POSIÇÃO,
        // JÁ considerando a 'forbiddenDirection' se for uma Dama.
        const validFurtherCaptures = calculateValidMoves(
                                            toRow,                          // Posição atual
                                            toCol,                          // Posição atual
                                            pieceDataAfterMove.isKing,      // Status de Dama atual
                                            currentPlayer,                  // Jogador atual
                                            forbiddenDirection              // Direção proibida (ou null se peão)
                                        )
                                        .filter(m => m.captures); // Pega SÓ capturas desta lista filtrada

        // AGORA, verifica se há capturas VÁLIDAS restantes
        if (validFurtherCaptures.length > 0) {
            // SIM, HÁ MAIS CAPTURAS VÁLIDAS (não proibidas). Trava a peça.
            console.log("Captura subsequente obrigatória encontrada. Peça travada.");
            lockedPieceInfo = {
                element,
                row: toRow,
                col: toCol,
                isKing: pieceDataAfterMove.isKing,
                lastMoveDirection: lastMoveDirection // Guarda a direção do salto que acabou de acontecer
            };
            statusDisplay.textContent = `Vez do ${currentPlayer === PLAYER1 ? 'Jogador 1' : 'Jogador 2'} - DEVE capturar novamente.`;
            // Re-seleciona a peça para mostrar os movimentos válidos (já filtrados)
            selectPiece(element, toRow, toCol, pieceDataAfterMove.isKing);
            // O turno NÃO MUDA.
            return;

        } else {
            // NÃO HÁ mais capturas VÁLIDAS (ou nunca houve, ou a única opção era proibida).
            // A sequência de capturas terminou. Passa a vez.
            console.log("Nenhuma captura subsequente válida encontrada. Passando a vez.");
            finalizeAndSwitchPlayer(); // Troca o jogador
        }
    } else {
        // Movimento simples. Passa a vez.
        console.log("Movimento simples. Passando a vez automaticamente.");
        finalizeAndSwitchPlayer(); // Troca o jogador
    }
}


function handlePassTurn() {
    // Só deve fazer algo se o jogo estiver ativo e uma peça estiver de fato travada
    if (!gameActive || !lockedPieceInfo) {
        console.log("handlePassTurn chamado mas sem peça travada ou jogo inativo.");
        // Limpa timer e botão por segurança
        clearTimeout(autoPassTimer);
        autoPassTimer = null;
        passTurnButton.disabled = true;
        return;
    }

    console.log(`Jogador ${currentPlayer} passou a vez (manualmente ou timeout).`);
    lockedPieceInfo = null; // Libera a trava OBRIGATORIAMENTE
    clearTimeout(autoPassTimer); // Cancela o timer
    autoPassTimer = null;
    deselectPiece(); // Limpa qualquer seleção/highlight
    passTurnButton.disabled = true; // Desabilita o botão para o próximo jogador

    // Troca o jogador e verifica condição de vitória
    finalizeAndSwitchPlayer();
}


function switchPlayer() {
    currentPlayer = currentPlayer === PLAYER1 ? PLAYER2 : PLAYER1;
    statusDisplay.textContent = `Vez do ${currentPlayer === PLAYER1 ? 'Jogador 1 (Vermelhas)' : 'Jogador 2 (Pretas)'}`;
    passTurnButton.disabled = true; // Desabilita o botão até o próximo movimento ser concluído
}


function checkWinCondition() {
    const possibleMoves = getAllMovesForPlayer(currentPlayer);
    if (possibleMoves.length === 0 && gameActive) { // Adiciona checagem gameActive para evitar múltiplos incrementos
        gameActive = false; // Marca o jogo como inativo
        const winner = currentPlayer === PLAYER1 ? PLAYER2 : PLAYER1; // O oponente é o vencedor

        // Determina e atualiza o placar
        if (winner === PLAYER1) {
            player1Wins++;
            console.log("Jogador 1 venceu! Placar atual:", player1Wins, "-", player2Wins);
        } else {
            player2Wins++;
            console.log("Jogador 2 venceu! Placar atual:", player1Wins, "-", player2Wins);
        }

        // Atualiza a exibição do placar na tela
        updateScoreDisplay();

        // Atualiza a mensagem de status para indicar o vencedor
        statusDisplay.textContent = `Fim de Jogo! ${winner === PLAYER1 ? 'Jogador 1 (Vermelhas)' : 'Jogador 2 (Pretas)'} venceu! (Sem movimentos)`;
        // passTurnButton.disabled = true; // Se ainda existir referência, mantenha ou remova

        console.log("Fim de jogo detectado.");
        return true; // Jogo acabou
    }
    return false; // Jogo continua
}

// --- Funções de Cálculo (calculateValidMoves modificada) ---

// Retorna TODOS os movimentos (simples e capturas) para um jogador
function getAllMovesForPlayer(player) {
    // ... (código igual ao anterior) ...
    const allMoves = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = boardState[r][c];
            if (piece && piece.player === player) {
                // Usamos a regra normal (sem permitir captura para trás forçada) para esta verificação geral
                const moves = calculateValidMoves(r, c, piece.isKing, player, false);
                moves.forEach(move => allMoves.push({ ...move, fromRow: r, fromCol: c }));
            }
        }
    }
    return allMoves;
}


function calculatePawnMoves(row, col, player) {
    let simpleMoves = [];
    const captures = [];
    const opponent = player === PLAYER1 ? PLAYER2 : PLAYER1;
    const moveDirection = player === PLAYER1 ? -1 : 1;

    const forwardDirections = [{ dr: moveDirection, dc: -1 }, { dr: moveDirection, dc: 1 }];
    const backwardDirectionValue = -moveDirection;
    const backwardDirections = [{ dr: backwardDirectionValue, dc: -1 }, { dr: backwardDirectionValue, dc: 1 }];

    const captureCheckDirections = [...forwardDirections];
    if (allowBackwardPawnCapture) { // Usa a variável global
        captureCheckDirections.push(...backwardDirections);
    }

    // 1. Verifica Capturas
    for (const dir of captureCheckDirections) {
        const opponentRow = row + dir.dr;
        const opponentCol = col + dir.dc;
        const landingRow = opponentRow + dir.dr;
        const landingCol = opponentCol + dir.dc;
        if (isValidSquare(landingRow, landingCol) && boardState[landingRow][landingCol] === null &&
            isValidSquare(opponentRow, opponentCol) && boardState[opponentRow][opponentCol] !== null &&
            boardState[opponentRow][opponentCol].player === opponent) {
            captures.push({ toRow: landingRow, toCol: landingCol, captures: { row: opponentRow, col: opponentCol } });
        }
    }

    if (captures.length > 0) return captures;

    // 2. Verifica Movimentos Simples (só para frente)
    for (const dir of forwardDirections) {
        const nextRow = row + dir.dr;
        const nextCol = col + dir.dc;
        if (isValidSquare(nextRow, nextCol) && boardState[nextRow][nextCol] === null) {
            simpleMoves.push({ toRow: nextRow, toCol: nextCol, captures: null });
        }
    }
    return simpleMoves;
}



function calculateKingMoves(row, col, player, forbiddenDirection = null) {
    const simpleMoves = [];
    const captureMoves = [];
    const opponent = player === PLAYER1 ? PLAYER2 : PLAYER1;
    const directions = [
        { dr: -1, dc: -1 }, { dr: -1, dc: 1 }, // Cima
        { dr: 1, dc: -1 }, { dr: 1, dc: 1 }    // Baixo
    ];

    for (const dir of directions) {
        // --- VERIFICA SE A DIREÇÃO ATUAL É A PROIBIDA ---
        if (forbiddenDirection && dir.dr === forbiddenDirection.dr && dir.dc === forbiddenDirection.dc) {
            console.log(`   - Dama: Ignorando direção proibida {dr: ${dir.dr}, dc: ${dir.dc}}`);
            continue; // Pula para a próxima direção
        }
        // --- FIM DA VERIFICAÇÃO ---

        let potentialCapture = null;
        let foundOpponent = false;

        for (let step = 1; ; step++) {
            const currentRow = row + step * dir.dr;
            const currentCol = col + step * dir.dc;

            if (!isValidSquare(currentRow, currentCol)) break; // Saiu do tabuleiro

            const squareContent = boardState[currentRow][currentCol];

            if (squareContent === null) { // Casa Vazia
                if (foundOpponent) {
                    captureMoves.push({ toRow: currentRow, toCol: currentCol, captures: potentialCapture });
                } else {
                    simpleMoves.push({ toRow: currentRow, toCol: currentCol, captures: null });
                }
            } else if (squareContent.player === player) { // Peça Própria
                break; // Bloqueia
            } else { // Peça Oponente
                if (foundOpponent) break; // Não pode pular duas na mesma linha

                const nextRow = currentRow + dir.dr;
                const nextCol = currentCol + dir.dc;
                if (isValidSquare(nextRow, nextCol) && boardState[nextRow][nextCol] === null) {
                    potentialCapture = { row: currentRow, col: currentCol };
                    foundOpponent = true; // Continua procurando pouso
                } else {
                    break; // Oponente bloqueado, não pode pular
                }
            }
        } // Fim loop step
    } // Fim loop directions

    if (captureMoves.length > 0) {
        return captureMoves;
    } else {
        return simpleMoves;
    }
}


// Calcula movimentos para UMA peça. allowBackwardCapture só é true na verificação pós-captura.
function calculateValidMoves(row, col, isKing, player, forbiddenDirection = null) {
    if (isKing) {
        // Passa a direção proibida para a função da Dama
        return calculateKingMoves(row, col, player, forbiddenDirection);
    } else {
        // Função do peão não precisa da direção proibida (regra é só pra Dama multi-captura)
        return calculatePawnMoves(row, col, player);
    }
}


// --- Funções Auxiliares e de UI (sem mudanças significativas) ---
function isValidSquare(row, col) { /* ... código igual ... */
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}


function highlightValidMoves(moves) { /* ... código igual ... */
    clearValidMoveHighlights();
    moves.forEach(move => {
        const square = boardElement.querySelector(`.square[data-row="${move.toRow}"][data-col="${move.toCol}"]`);
        if (square) {
            const indicator = document.createElement('div');
            indicator.classList.add('valid-move-indicator');
             if (square.firstChild && !square.firstChild.classList.contains('valid-move-indicator')) { // Evita adicionar múltiplos indicadores
                square.insertBefore(indicator, square.firstChild);
            } else if (!square.firstChild) { // Se o quadrado está vazio
                square.appendChild(indicator);
            }
        }
    });
}


function clearValidMoveHighlights() { /* ... código igual ... */
    boardElement.querySelectorAll('.valid-move-indicator').forEach(indicator => indicator.remove());
}


/**
 * Atualiza os elementos HTML que exibem o número de vitórias de cada jogador.
 */
function updateScoreDisplay() {
    const player1ScoreElement = document.getElementById('player1-score');
    const player2ScoreElement = document.getElementById('player2-score');

    if (player1ScoreElement) {
        player1ScoreElement.textContent = player1Wins;
    }
    if (player2ScoreElement) {
        player2ScoreElement.textContent = player2Wins;
    }
}


function resetGame() {
    console.log("Reiniciando novo jogo...");
    gameActive = true;
    currentPlayer = PLAYER1;
    selectedPiece = null;
    validMoves = [];
    lockedPieceInfo = null;
    // clearTimeout(autoPassTimer); // Remover se não existir mais
    // autoPassTimer = null;       // Remover se não existir mais
    statusDisplay.textContent = `Vez do Jogador 1 (Vermelhas)`;
    // passTurnButton.disabled = true; // Remover se não existir mais
    createBoard(); // Recria o tabuleiro e peças

    // ATUALIZA A EXIBIÇÃO DO PLACAR ao reiniciar (mostra o placar acumulado)
    updateScoreDisplay();
}

// --- Inicialização ---
resetButton.addEventListener('click', resetGame);
// passTurnButton.addEventListener('click', handlePassTurn); // Remover se não existir mais
// passTurnButton.disabled = true; // Remover se não existir mais
createBoard();
// --- EXIBE O PLACAR INICIAL (0-0) ---
updateScoreDisplay();
// --- FIM DA CHAMADA INICIAL ---














// ==========================================================
//         SUBSTITUA ESTA FUNÇÃO NO SEU script.js
// ==========================================================

/**
 * Processa o movimento, atualiza tabuleiro, promove, verifica capturas
 * subsequentes (considerando direção proibida para Damas) e passa a vez.
 */


// ==========================================================
//      FIM DA FUNÇÃO A SER SUBSTITUÍDA
// ==========================================================

// Certifique-se de que as outras funções (selectPiece, calculateValidMoves,
// calculateKingMoves, calculatePawnMoves, finalizeAndSwitchPlayer)
// estejam como na versão anterior, pois elas já lidam corretamente
// com o parâmetro 'forbiddenDirection' quando ele é passado.






// ==========================================================
//         SUBSTITUA ESTA FUNÇÃO NO SEU script.js
// ==========================================================

/**
 * Processa o movimento da peça com ANIMAÇÃO.
 * Atualiza tabuleiro, promove, verifica capturas subsequentes e passa a vez.
 */

// ==========================================================
//      FIM DA FUNÇÃO A SER SUBSTITUÍDA
// ==========================================================