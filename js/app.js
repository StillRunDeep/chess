/**
 * 国际象棋应用程序
 * 集成引擎、棋盘UI和AI
 */
document.addEventListener('DOMContentLoaded', function() {
    // 初始化游戏引擎
    const engine = new ChessEngine();
    
    // 初始化AI
    const ai = new ChessAI('level1');
    
    // 玩家当前控制的棋子颜色 (w: 白方, b: 黑方)
    let playerColor = 'w';
    
    // 胜率更新 UI 处理
    const winRateText = document.getElementById('win-rate-text');
    const winRateBar = document.getElementById('win-rate-bar');
    const mateText = document.getElementById('mate-text');
    
    ai.onEvaluationUpdate = function(evalData) {
        winRateText.textContent = evalData.winRate + '%';
        winRateBar.style.width = evalData.winRate + '%';
        
        // 动态更新胜率条颜色: 0% 为红色 (Hue 0), 100% 为绿色 (Hue 120)
        const rate = parseFloat(evalData.winRate);
        const hue = (rate / 100) * 120;
        winRateBar.style.backgroundColor = `hsl(${hue}, 70%, 45%)`;
        
        if (evalData.type === 'mate') {
            mateText.style.display = 'inline';
            if (evalData.score > 0) {
                mateText.textContent = `(白方 ${evalData.score} 步将杀)`;
            } else if (evalData.score < 0) {
                mateText.textContent = `(黑方 ${Math.abs(evalData.score)} 步将杀)`;
            } else {
                mateText.textContent = `(已被将杀)`;
            }
        } else {
            mateText.style.display = 'none';
        }
    };
    
    // 初始化棋盘UI
    const boardElement = document.getElementById('chessboard');
    const chessboard = new ChessboardUI(boardElement, {
        draggable: true,
        showLegalMoves: true,
        onPieceClick: handlePieceClick,
        onSquareClick: handleSquareClick,
        onMove: handleMove
    });
    
    // 游戏状态
    let selectedPiece = null;
    let legalMoves = [];
    let isAIThinking = false;
    let isEngineReady = false;
    let isFirstMoveEver = true; // 记录是否为全场第一次走子
    
    // 初始化引擎状态
    document.getElementById('status').textContent = '正在加载AI引擎...';
    ai.onReady = function() {
        isEngineReady = true;
        // 如果游戏还没开始（或者没人在走棋），则更新状态
        if (!isAIThinking) {
            document.getElementById('status').textContent = engine.getGameStatusText();
            currentBestMoveForHint = null;
            ai.getBestMove(engine, true).then(move => {
                currentBestMoveForHint = move;
                if (isHintTimerTriggered) showHintIfReady();
            });
            resetHintTimer();
        }
    };
    
    // 更新棋盘
    updateUI();
    
    // 设置事件监听器
    document.getElementById('new-game').addEventListener('click', newGame);
    document.getElementById('undo-move').addEventListener('click', undoMove);
    document.getElementById('play-again').addEventListener('click', newGame);
    document.getElementById('review-game').addEventListener('click', function() {
        document.getElementById('game-over-modal').style.display = 'none';
    });
    document.getElementById('swap-sides').addEventListener('click', swapSides);
    document.getElementById('difficulty-select').addEventListener('change', function(e) {
        ai.setDifficulty(e.target.value);
        
        // 更改背景音乐
        const level = e.target.value;
        const audioSrc = level === 'level1' ? 'sound/Canon.mp3' : `sound/${level}.mp3`;
        
        if (!bgmAudio.src.endsWith(audioSrc)) {
            bgmAudio.src = audioSrc;
            if (isBgmPlaying) {
                playCurrentAudio();
            }
        }
    });

    /**
     * 交换控制的棋子颜色
     */
    function swapSides() {
        if (isAIThinking) return;
        playerColor = playerColor === 'w' ? 'b' : 'w';
        
        // 更新状态以反映交换
        if (isEngineReady) {
            document.getElementById('status').textContent = engine.getGameStatusText();
        }
        
        // 如果交换后是AI的回合，则让AI走棋
        if (!engine.gameOver && engine.currentPlayer !== playerColor) {
            makeAIMove();
        }
    }
    
    // 背景音乐控制
    const bgmAudio = document.getElementById('bgm-audio');
    const bgmToggle = document.getElementById('bgm-toggle');
    let isBgmPlaying = false;

    function playCurrentAudio() {
        bgmAudio.play().catch(err => {
            console.error("无法播放背景音乐:", err);
            bgmToggle.textContent = '🎵 开启音乐';
            isBgmPlaying = false;
        });
    }

    function pauseCurrentAudio() {
        bgmAudio.pause();
    }

    bgmToggle.addEventListener('click', function() {
        isBgmPlaying = !isBgmPlaying;
        bgmToggle.classList.toggle('active', isBgmPlaying);
        if (isBgmPlaying) {
            playCurrentAudio();
        } else {
            pauseCurrentAudio();
        }
    });

    // 提示功能状态
    const hintToggle = document.getElementById('hint-toggle');
    let hintCount = 9;

    function updateHintButtonText() {
        hintToggle.textContent = `AI提示 (剩余${hintCount}次)`;
    }
    updateHintButtonText(); // 初始化按钮文本

    hintToggle.addEventListener('click', function() {
        chessboard.clearHint();
        
        // 阻止在AI思考、游戏结束或非玩家回合时使用提示
        if (isAIThinking || engine.gameOver || engine.currentPlayer !== playerColor) {
            return;
        }

        if (hintCount > 0) {
            hintToggle.disabled = true;
            hintToggle.textContent = '思考中...';

            ai.getBestMove(engine, true).then(move => {
                if (move) {
                    const [fromRow, fromCol, toRow, toCol] = move;
                    chessboard.showHint(fromRow, fromCol, toRow, toCol);
                    
                    hintCount--;
                    updateHintButtonText();
                }
                hintToggle.disabled = false;
                
                // 如果用完最后一次，更新文本但保持按钮可用以显示最终信息
                if (hintCount === 0) {
                    updateHintButtonText();
                }
            });
        } else {
            alert('桃桃，你想偷懒吗？');
        }
    });
    
    // 设置升变模态框事件
    setupPromotionModal();
    
    /**
     * 处理棋子点击事件
     */
    /**
     * 处理棋子点击事件
     */
    function handlePieceClick(row, col, piece) {
        // 如果引擎未加载完成，不允许操作
        if (!isEngineReady) return;
        
        // 如果AI正在思考，不允许操作
        if (isAIThinking) return;
        
        // 如果当前是AI的回合，不允许操作
        if (engine.currentPlayer !== playerColor) return;
        
        chessboard.clearHint();

        // 检查是否是当前玩家的棋子
        const pieceColor = engine.getPieceColor(piece);
        if (pieceColor !== engine.currentPlayer) {
            // 如果已经选中了我方棋子，并且点击的是对方棋子，尝试吃子
            if (selectedPiece) {
                const [fromRow, fromCol] = selectedPiece;
                if (engine.isValidMove(fromRow, fromCol, row, col)) {
                    executeMove(fromRow, fromCol, row, col);
                    return;
                }
            }
            return;
        }
        
        // 选择棋子
        selectedPiece = [row, col];
        chessboard.selectPiece(row, col);
        
        // 计算合法移动
        legalMoves = calculateLegalMoves(row, col);
        
        // 高亮显示合法移动
        chessboard.highlightLegalMoves(legalMoves);
    }
    
    /**
     * 处理方格点击事件
     */
    /**
     * 处理方格点击事件
     */
    function handleSquareClick(row, col) {
        // 如果引擎未加载完成，不允许操作
        if (!isEngineReady) return;
        
        // 如果AI正在思考，不允许操作
        if (isAIThinking) return;
        
        // 如果当前是AI的回合，不允许操作
        if (engine.currentPlayer !== playerColor) return;
        
        chessboard.clearHint();

        // 如果没有选中棋子，不做任何处理
        if (!selectedPiece) return;
        
        // 如果点击了选中棋子的当前位置，取消选择
        if (selectedPiece[0] === row && selectedPiece[1] === col) {
            chessboard.clearSelection();
            selectedPiece = null;
            legalMoves = [];
            return;
        }
        
        // 获取目标位置的棋子
        const targetPiece = engine.getPiece(row, col);
        
        // 检查移动是否合法
        if (!isMoveLegal(row, col)) {
            // 如果移动不合法，但目标位置有对方的棋子，可能是想吃子
            if (targetPiece && engine.getPieceColor(targetPiece) !== engine.currentPlayer) {
                const [fromRow, fromCol] = selectedPiece;
                if (engine.isValidMove(fromRow, fromCol, row, col)) {
                    executeMove(fromRow, fromCol, row, col);
                }
            }
            return;
        }
        
        // 执行移动
        const [fromRow, fromCol] = selectedPiece;
		tryMove(fromRow, fromCol, row, col);
    }
    
    /**
     * 处理移动事件
     */
    function handleMove(fromRow, fromCol, toRow, toCol) {
        // 如果引擎未加载完成，不允许操作
        if (!isEngineReady) return false;
        
        // 如果AI正在思考，不允许操作
        if (isAIThinking) return false;
        
        // 如果当前是AI的回合，不允许操作
        if (engine.currentPlayer !== playerColor) return false;
        
        chessboard.clearHint();

        // 检查移动是否合法
        if (!engine.isValidMove(fromRow, fromCol, toRow, toCol)) {
            return false;
        }
        
        // 检查是否是兵的升变+执行移动
        return tryMove(fromRow, fromCol, toRow, toCol);
    }
    
	
	/**
     * 统一走子入口（含升变判断）
     */
	function tryMove(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
	    const piece = engine.getPiece(fromRow, fromCol);
	    if (!piece) return false;
	
	    // 如果是兵到达底线且没有指定升变棋子
	    if (
	        engine.getPieceType(piece) === 'P' &&
	        (toRow === 0 || toRow === 7) &&
	        !promotionPiece
	    ) {
	        showPromotionDialog(fromRow, fromCol, toRow, toCol);
	        return true;
	    }
	
	    // 正常执行
	    return executeMove(fromRow, fromCol, toRow, toCol, promotionPiece);
	}
	
    /**
     * 执行移动
     */
    function executeMove(fromRow, fromCol, toRow, toCol, promotionPiece) {
        // 执行移动
        const success = engine.makeMove(fromRow, fromCol, toRow, toCol, promotionPiece);
        
        if (success) {
            chessboard.clearHint();
            
            // 更新UI
            updateUI();
            
            // 仅在全场第一场对局的第一步棋且音乐未播放时，自动开启
            if (isFirstMoveEver && engine.moveHistory.length === 1 && !isBgmPlaying) {
                isBgmPlaying = true;
                bgmToggle.classList.add('active');
                playCurrentAudio();
                isFirstMoveEver = false; // 标记已触发过首次自动播放
            }
            
            // 重置选择状态
            selectedPiece = null;
            legalMoves = [];
            
            // 高亮显示最后一步移动
            chessboard.highlightLastMove(fromRow, fromCol, toRow, toCol);
            
            // 检查游戏是否结束
            if (engine.gameOver) {
                showGameOverDialog();
                return true;
            }
            
            // 如果轮到AI走棋
            if (engine.currentPlayer !== playerColor) {
                makeAIMove();
            } else {
                // 如果是玩家走完，进行一次静默评估以更新胜率
                ai.getBestMove(engine, true).then(move => {
                    // 只更新胜率，不显示提示
                });
            }
            
            return true;
        }
        
        return false;
    }
    
    /**
     * 计算指定位置棋子的所有合法移动
     */
    function calculateLegalMoves(row, col) {
        const moves = [];
        
        for (let toRow = 0; toRow < 8; toRow++) {
            for (let toCol = 0; toCol < 8; toCol++) {
                if (engine.isValidMove(row, col, toRow, toCol)) {
                    moves.push([toRow, toCol]);
                }
            }
        }
        
        return moves;
    }
    
    /**
     * 检查移动是否在合法移动列表中
     */
    function isMoveLegal(row, col) {
        return legalMoves.some(move => move[0] === row && move[1] === col);
    }
    
    /**
     * 开始新游戏
     */
    function newGame() {
        // 重置提示计数器
        hintCount = 9;
        updateHintButtonText();
        hintToggle.disabled = false;
        
        // 重置玩家颜色为白方
        playerColor = 'w';
        
        // 重置引擎
        engine.reset();
        
        // 重置UI
        selectedPiece = null;
        legalMoves = [];
        chessboard.clearSelection();
        chessboard.clearLastMoveHighlight();
        chessboard.clearHint();
        
        // 更新UI
        updateUI();
        
        // 隐藏游戏结束对话框
        const gameOverModal = document.getElementById('game-over-modal');
        gameOverModal.style.display = 'none';
        
        // 刷新胜率
        winRateText.textContent = '50.0%';
        winRateBar.style.width = '50%';
        winRateBar.style.backgroundColor = 'hsl(60, 70%, 45%)';
        mateText.style.display = 'none';
        
        // 游戏开始时静默获取一次胜率
        if (isEngineReady) {
            ai.getBestMove(engine, true).then(move => {
                 // 只更新胜率，不显示提示
            });
        }
    }
    
    /**
     * 悔棋
     */
    function undoMove() {
        if (engine.moveHistory.length === 0) return;
        
        // 需要撤销两步（玩家的和AI的）
        engine.undoLastMove(); // 撤销AI的移动
        if (engine.moveHistory.length === 0) {
            newGame();
            return;
        }
        
        engine.undoLastMove(); // 撤销玩家的移动
        
        // 更新UI
        updateUI();
        
        // 重置选择状态
        selectedPiece = null;
        legalMoves = [];
        chessboard.clearSelection();
        chessboard.clearHint();
        
        // 如果有最后一步移动，高亮显示
        if (engine.moveHistory.length > 0) {
            const lastMove = engine.getLastMove();
            chessboard.highlightLastMove(lastMove.from[0], lastMove.from[1], lastMove.to[0], lastMove.to[1]);
        } else {
            chessboard.clearLastMoveHighlight();
        }
        
        // 刷新胜率
        if (isEngineReady) {
            ai.getBestMove(engine, true).then(move => {
                // 只更新胜率
            });
        } else {
            winRateText.textContent = '50.0%';
            winRateBar.style.width = '50%';
            winRateBar.style.backgroundColor = 'hsl(60, 70%, 45%)';
            mateText.style.display = 'none';
        }
    }
    
    /**
     * 让AI走棋
     */
    function makeAIMove() {
        const startTime = Date.now();
        // 设置AI思考标志
        isAIThinking = true;
        
        // 更新状态文本
        const aiColorText = engine.currentPlayer === 'w' ? '白方' : '黑方';
        document.getElementById('status').textContent = `${aiColorText}(AI)正在思考...`;
        
        // 使用setTimeout让UI有时间更新
        setTimeout(() => {
            // 获取AI的移动 (现在返回 Promise)
            Promise.resolve(ai.getBestMove(engine)).then(bestMove => {
                const endTime = Date.now();
                const thinkingTime = endTime - startTime;
                const minDelay = 2000; // 至少等待2秒
                const remainingDelay = Math.max(0, minDelay - thinkingTime);

                setTimeout(() => {
                    if (bestMove) {
                        const [fromRow, fromCol, toRow, toCol, promotion] = bestMove;
                        
                        // 执行移动
                        engine.makeMove(fromRow, fromCol, toRow, toCol, promotion ? promotion.toUpperCase() : 'Q');
                        
                        // 更新UI
                        updateUI();
                        
                        // 高亮显示最后一步移动
                        chessboard.highlightLastMove(fromRow, fromCol, toRow, toCol);
                        
                        // 检查游戏是否结束
                        if (engine.gameOver) {
                            showGameOverDialog();
                        }
                    }
                    
                    // 重置AI思考标志
                    isAIThinking = false;
                    
                    // AI走完后轮到玩家走棋，开启静默评估和提示计时器
                    if (!engine.gameOver) {
                        ai.getBestMove(engine, true).then(move => {
                             // 只更新胜率
                        });
                    }
                }, remainingDelay);
            });
        }, 100);
    }
    
    /**
     * 更新游戏UI
     */
    function updateUI() {
        // 更新棋盘
        chessboard.updateBoard(engine.board);
        
        // 更新状态文本
        if (isEngineReady) {
            document.getElementById('status').textContent = engine.getGameStatusText();
        } else {
            document.getElementById('status').textContent = '正在加载AI引擎...';
        }
        
        // 更新被吃掉的棋子
        updateCapturedPieces();
        
        // 更新移动历史
        updateMoveHistory();
    }
    
    /**
     * 更新被吃掉的棋子显示
     */
    function updateCapturedPieces() {
        const whiteCaptured = document.querySelector('.white-captured');
        const blackCaptured = document.querySelector('.black-captured');
        
        whiteCaptured.innerHTML = '白方吃子：' + formatCapturedPieces(engine.capturedPieces.w);
        blackCaptured.innerHTML = '黑方吃子：' + formatCapturedPieces(engine.capturedPieces.b);
    }
    
    /**
     * 格式化被吃掉的棋子
     */
    function formatCapturedPieces(capturedPieces) {
        if (capturedPieces.length === 0) return '<span style="font-weight: normal; opacity: 0.6;">无</span>';
        
        // 使用符号表示棋子
        const pieceSymbols = {
            'wP': '♙', 'wR': '♖', 'wN': '♘', 'wB': '♗', 'wQ': '♕', 'wK': '♔',
            'bP': '♟', 'bR': '♜', 'bN': '♞', 'bB': '♝', 'bQ': '♛', 'bK': '♚'
        };
        
        return capturedPieces.map(piece => {
            const symbol = pieceSymbols[piece] || piece;
            return `<span class="captured-symbol">${symbol}</span>`;
        }).join('');
    }
    
    /**
     * 更新移动历史
     */
    function updateMoveHistory() {
        const movesElement = document.getElementById('moves');
        movesElement.innerHTML = '';
        
        const moves = engine.moveHistory;
        
        for (let i = 0; i < moves.length; i += 2) {
            const moveNumber = Math.floor(i / 2) + 1;
            const moveWhite = moves[i].notation;
            const moveBlack = i + 1 < moves.length ? moves[i + 1].notation : '';
            
            const moveNumberSpan = document.createElement('span');
            moveNumberSpan.textContent = moveNumber + '.';
            moveNumberSpan.className = 'move-number';
            
            const moveWhiteSpan = document.createElement('span');
            moveWhiteSpan.textContent = moveWhite;
            moveWhiteSpan.className = 'move-white';
            
            movesElement.appendChild(moveNumberSpan);
            movesElement.appendChild(moveWhiteSpan);
            
            if (moveBlack) {
                const moveBlackSpan = document.createElement('span');
                moveBlackSpan.textContent = moveBlack;
                moveBlackSpan.className = 'move-black';
                
                movesElement.appendChild(moveBlackSpan);
            } else {
                const emptySpan = document.createElement('span');
                movesElement.appendChild(emptySpan);
            }
        }
        
        // 滚动到底部
        movesElement.scrollTop = movesElement.scrollHeight;
    }
    
    /**
     * 设置升变模态框
     */
    function setupPromotionModal() {
        const promotionModal = document.getElementById('promotion-modal');
        const promotionPieces = promotionModal.querySelectorAll('.piece');
        
        promotionPieces.forEach(pieceElement => {
            pieceElement.addEventListener('click', function() {
                const piece = this.getAttribute('data-piece');
                promotionModal.style.display = 'none';
                
                const pieceMap = {
                    'queen': 'Q',
                    'rook': 'R',
                    'bishop': 'B',
                    'knight': 'N'
                };
                
                // 完成升变移动
                if (promotionData) {
                    tryMove(
                        promotionData.fromRow, 
                        promotionData.fromCol, 
                        promotionData.toRow, 
                        promotionData.toCol, 
                        pieceMap[piece] || 'Q'
                    );
                }
                
                promotionData = null;
            });
        });
    }
    
    // 存储升变数据
    let promotionData = null;
    
    /**
     * 显示升变选择对话框
     */
    function showPromotionDialog(fromRow, fromCol, toRow, toCol) {
        promotionData = { fromRow, fromCol, toRow, toCol };
        
        // 显示对话框
        const promotionModal = document.getElementById('promotion-modal');
        promotionModal.style.display = 'flex';
        
        // 根据当前玩家设置升变棋子的颜色
        const color = engine.currentPlayer;
        const pieces = promotionModal.querySelectorAll('.piece');
        
        pieces.forEach(piece => {
            piece.className = 'piece ' + piece.getAttribute('data-piece');
            
            // 根据当前玩家更改背景图片
            if (color === 'b') {
                piece.style.backgroundImage = piece.style.backgroundImage.replace('w', 'b');
            } else {
                piece.style.backgroundImage = piece.style.backgroundImage.replace('b', 'w');
            }
        });
    }
    
    /**
     * 显示游戏结束对话框
     */
    function showGameOverDialog() {
        const gameOverModal = document.getElementById('game-over-modal');
        const gameResult = document.getElementById('game-result');
        
        gameResult.textContent = engine.getGameStatusText();
        gameOverModal.style.display = 'flex';
    }
});

/**
 * 加载国际象棋SVG棋子图像
 */
function loadChessPieceImages() {
    const pieces = ['wP', 'wR', 'wN', 'wB', 'wQ', 'wK', 'bP', 'bR', 'bN', 'bB', 'bQ', 'bK'];
    
    // 创建images目录（如果不存在）
    const imagesDir = 'images';
    
    // 为每个棋子创建SVG文件
    pieces.forEach(piece => {
        const color = piece.charAt(0) === 'w' ? 'white' : 'black';
        let type;
        
        switch (piece.charAt(1)) {
            case 'P': type = 'pawn'; break;
            case 'R': type = 'rook'; break;
            case 'N': type = 'knight'; break;
            case 'B': type = 'bishop'; break;
            case 'Q': type = 'queen'; break;
            case 'K': type = 'king'; break;
        }
        
        createChessPieceSVG(piece, color, type);
    });
}

/**
 * 创建国际象棋棋子的SVG文件
 */
function createChessPieceSVG(piece, color, type) {
    // 获取SVG内容
    const svgContent = getChessPieceSVG(color, type);
    
    // 创建Blob对象
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    // 创建一个图像元素预加载SVG
    const img = new Image();
    img.src = url;
    img.style.display = 'none';
    document.body.appendChild(img);
    
    // 创建a标签下载SVG文件
    const a = document.createElement('a');
    a.href = url;
    a.download = `${piece}.svg`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    // 清理
    setTimeout(() => {
        document.body.removeChild(a);
        document.body.removeChild(img);
        URL.revokeObjectURL(url);
    }, 100);
}

/**
 * 获取棋子的SVG内容
 */
function getChessPieceSVG(color, type) {
    const fillColor = color === 'white' ? '#ffffff' : '#000000';
    const strokeColor = color === 'white' ? '#000000' : '#ffffff';
    
    let path = '';
    
    switch (type) {
        case 'pawn':
            path = 'M 22,9 C 19.79,9 18,10.79 18,13 C 18,13.89 18.29,14.71 18.78,15.38 C 16.83,16.5 15.5,18.59 15.5,21 C 15.5,23.03 16.44,24.84 17.91,26.03 C 14.91,27.09 10.5,31.58 10.5,39.5 L 33.5,39.5 C 33.5,31.58 29.09,27.09 26.09,26.03 C 27.56,24.84 28.5,23.03 28.5,21 C 28.5,18.59 27.17,16.5 25.22,15.38 C 25.71,14.71 26,13.89 26,13 C 26,10.79 24.21,9 22,9 z';
            break;
        case 'rook':
            path = 'M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z M 12.5,32 L 14,29.5 L 31,29.5 L 32.5,32 L 12.5,32 z M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14 L 11,14 z M 34,14 L 34,29.5 L 31,29.5 L 31,17 L 14,17 L 14,29.5 L 11,29.5 L 11,14 L 34,14 z';
            break;
        case 'knight':
            path = 'M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18 M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10';
            break;
        case 'bishop':
            path = 'M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.646,38.99 6.677,38.97 6,38 C 7.354,36.06 9,36 9,36 z M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z M 25,8 A 2.5,2.5 0 1,1 20,8 A 2.5,2.5 0 1,1 25,8 z';
            break;
        case 'queen':
            path = 'M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 10.5,36 10.5,36 C 9,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z M 11.5,30 C 15,29 30,29 33.5,30 M 12,33.5 C 18,32.5 27,32.5 33,33.5';
            break;
        case 'king':
            path = 'M 22.5,11.63 L 22.5,6 M 20,8 L 25,8 M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25 M 11.5,37 C 17,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 19,16 9.5,13 6.5,19.5 C 3.5,25.5 11.5,29.5 11.5,29.5 L 11.5,37 z';
            break;
    }
    
    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="45" height="45">
  <g style="fill:none; fill-opacity:1; fill-rule:evenodd; stroke:${strokeColor}; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; stroke-miterlimit:4; stroke-dasharray:none; stroke-opacity:1;">
    <path d="${path}" style="fill:${fillColor}; stroke:${strokeColor};" />
  </g>
</svg>`;
}

// 执行加载棋子图像的函数
// loadChessPieceImages();