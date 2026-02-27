/**
 * 国际象棋棋盘UI组件
 * 处理棋盘渲染和交互
 */
class ChessboardUI {
    constructor(containerElement, options = {}) {
        // 设置默认选项
        this.options = {
            draggable: true,
            showLabels: true,
            showLegalMoves: true,
            orientation: 'white', // 'white' 或 'black'
            onPieceClick: null,
            onSquareClick: null,
            onMove: null,
            ...options
        };

        this.containerElement = containerElement;
        this.selectedPiece = null;
        this.highlightedSquares = [];
        this.lastMove = null;
        this.hintSquares = null;
        this.flipped = this.options.orientation === 'black';
        
        // 初始化棋盘
        this.createBoard();
    }

    // 创建棋盘
    createBoard() {
        this.clearBoard();
        
        const boardElement = this.containerElement;
        boardElement.innerHTML = '';
        
        // 创建64个方格
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = 'square ' + ((row + col) % 2 === 0 ? 'light' : 'dark');
                square.setAttribute('data-row', row);
                square.setAttribute('data-col', col);
                
                // 添加点击事件
                square.addEventListener('click', (e) => this.handleSquareClick(e, row, col));
                
                boardElement.appendChild(square);
            }
        }
    }

    // 清空棋盘
    clearBoard() {
        this.selectedPiece = null;
        this.highlightedSquares = [];
        this.hintSquares = null;
    }

    // 根据引擎的棋盘状态更新UI
    updateBoard(board) {
        this.clearHint();
        const squares = this.containerElement.querySelectorAll('.square');
        
        // 移除所有棋子
        squares.forEach(square => {
            const pieceElement = square.querySelector('.chess-piece');
            if (pieceElement) {
                square.removeChild(pieceElement);
            }
        });
        
        // 放置棋子
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece) {
                    this.placePiece(piece, row, col);
                }
            }
        }
    }

    // 放置一个棋子
    placePiece(piece, row, col) {
        // 如果棋盘被翻转，调整坐标
        const displayRow = this.flipped ? 7 - row : row;
        const displayCol = this.flipped ? 7 - col : col;
        
        const square = this.getSquareElement(displayRow, displayCol);
        if (!square) return;
        
        // 检查是否已有棋子
        let pieceElement = square.querySelector('.chess-piece');
        
        if (!pieceElement) {
            pieceElement = document.createElement('div');
            pieceElement.className = 'chess-piece';
            square.appendChild(pieceElement);
        }
        
        pieceElement.className = `chess-piece piece-${piece}`;
        pieceElement.setAttribute('data-piece', piece);
        
        // 添加棋子的点击事件
        pieceElement.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡到方格
            this.handlePieceClick(e, row, col, piece);
        });
        
        // 添加拖拽功能（如果启用）
        if (this.options.draggable) {
            this.setupDraggable(pieceElement, row, col);
        }
    }

    // 获取指定坐标的方格元素
    getSquareElement(row, col) {
        return this.containerElement.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
    }

    // 处理方格点击事件
    // 处理方格点击事件
    handleSquareClick(event, row, col) {
        // 转换为实际坐标（考虑棋盘翻转）
        const actualRow = this.flipped ? 7 - row : row;
        const actualCol = this.flipped ? 7 - col : col;
        
        // 如果有选中的棋子，尝试移动
        if (this.selectedPiece) {
            const [selectedRow, selectedCol] = this.selectedPiece;
            
            // 如果点击了同一个方格，取消选择
            if (selectedRow === actualRow && selectedCol === actualCol) {
                this.clearSelection();
                return;
            }
            
            // 尝试移动
            if (this.options.onMove) {
                // 获取目标方格的棋子元素
                const targetSquare = this.getSquareElement(row, col);
                const targetPiece = targetSquare ? targetSquare.querySelector('.chess-piece') : null;
                
                const success = this.options.onMove(selectedRow, selectedCol, actualRow, actualCol);
                if (success) {
                    // 如果目标位置有棋子，先移除它
                    if (targetPiece) {
                        targetSquare.removeChild(targetPiece);
                    }
                    
                    // 移动成功后清除选择
                    this.clearSelection();
                    return;
                }
            }
        }
        
        // 调用回调函数
        if (this.options.onSquareClick) {
            this.options.onSquareClick(actualRow, actualCol);
        }
    }

    // 处理棋子点击事件
    handlePieceClick(event, row, col, piece) {
        // 转换为实际坐标（考虑棋盘翻转）
        const actualRow = this.flipped ? 7 - row : row;
        const actualCol = this.flipped ? 7 - col : col;
        
        // 如果已经选中了这个棋子，取消选择
        if (this.selectedPiece && 
            this.selectedPiece[0] === actualRow && 
            this.selectedPiece[1] === actualCol) {
            this.clearSelection();
            return;
        }
        
        // 调用回调函数
        if (this.options.onPieceClick) {
            this.options.onPieceClick(actualRow, actualCol, piece);
        }
    }

    // 选择一个棋子
    selectPiece(row, col) {
        this.clearSelection();
        
        // 存储选中的棋子坐标
        this.selectedPiece = [row, col];
        
        // 高亮显示选中的方格
        const displayRow = this.flipped ? 7 - row : row;
        const displayCol = this.flipped ? 7 - col : col;
        const square = this.getSquareElement(displayRow, displayCol);
        
        if (square) {
            square.classList.add('selected');
        }
    }

    // 高亮显示可行的移动位置
    highlightLegalMoves(moves) {
        // 清除之前的高亮
        this.clearHighlights();
        
        moves.forEach(([toRow, toCol]) => {
            const displayRow = this.flipped ? 7 - toRow : toRow;
            const displayCol = this.flipped ? 7 - toCol : toCol;
            const square = this.getSquareElement(displayRow, displayCol);
            
            if (square) {
                square.classList.add('highlight');
                this.highlightedSquares.push(square);
            }
        });
    }

    // 高亮显示最后一步移动
    highlightLastMove(fromRow, fromCol, toRow, toCol) {
        // 清除之前的最后移动高亮
        this.clearLastMoveHighlight();
        
        const displayFromRow = this.flipped ? 7 - fromRow : fromRow;
        const displayFromCol = this.flipped ? 7 - fromCol : fromCol;
        const displayToRow = this.flipped ? 7 - toRow : toRow;
        const displayToCol = this.flipped ? 7 - toCol : toCol;
        
        const fromSquare = this.getSquareElement(displayFromRow, displayFromCol);
        const toSquare = this.getSquareElement(displayToRow, displayToCol);
        
        if (fromSquare) {
            fromSquare.classList.add('last-move');
            this.lastMove = [fromSquare, toSquare];
        }
        
        if (toSquare) {
            toSquare.classList.add('last-move');
        }
    }

    // 清除选择
    clearSelection() {
        // 取消选中高亮
        if (this.selectedPiece) {
            const [row, col] = this.selectedPiece;
            const displayRow = this.flipped ? 7 - row : row;
            const displayCol = this.flipped ? 7 - col : col;
            const square = this.getSquareElement(displayRow, displayCol);
            
            if (square) {
                square.classList.remove('selected');
            }
        }
        
        this.selectedPiece = null;
        
        // 清除可行移动高亮
        this.clearHighlights();
    }

    // 清除可行移动高亮
    clearHighlights() {
        this.highlightedSquares.forEach(square => {
            square.classList.remove('highlight');
        });
        
        this.highlightedSquares = [];
    }

    // 清除最后一步移动高亮
    clearLastMoveHighlight() {
        if (this.lastMove) {
            this.lastMove.forEach(square => {
                if (square) {
                    square.classList.remove('last-move');
                }
            });
            
            this.lastMove = null;
        }
    }

    // 高亮提示移动
    showHint(fromRow, fromCol, toRow, toCol) {
        this.clearHint();
        
        const displayFromRow = this.flipped ? 7 - fromRow : fromRow;
        const displayFromCol = this.flipped ? 7 - fromCol : fromCol;
        const displayToRow = this.flipped ? 7 - toRow : toRow;
        const displayToCol = this.flipped ? 7 - toCol : toCol;
        
        const fromSquare = this.getSquareElement(displayFromRow, displayFromCol);
        const toSquare = this.getSquareElement(displayToRow, displayToCol);
        
        if (fromSquare) {
            fromSquare.classList.add('hint-move');
            this.hintSquares = [fromSquare];
        }
        
        if (toSquare) {
            toSquare.classList.add('hint-move');
            if (this.hintSquares) {
                this.hintSquares.push(toSquare);
            } else {
                this.hintSquares = [toSquare];
            }
        }
    }

    // 清除提示高亮
    clearHint() {
        if (this.hintSquares) {
            this.hintSquares.forEach(square => {
                if (square) {
                    square.classList.remove('hint-move');
                }
            });
            this.hintSquares = null;
        }
    }

    // 设置拖拽功能
    setupDraggable(pieceElement, row, col) {
        pieceElement.setAttribute('draggable', 'true');
        
        pieceElement.addEventListener('dragstart', (e) => {
            // 存储拖拽的起始位置
            e.dataTransfer.setData('text/plain', `${row},${col}`);
            
            // 设置拖拽效果
            setTimeout(() => {
                pieceElement.classList.add('dragging');
            }, 0);
            
            // 选择棋子
            const actualRow = this.flipped ? 7 - row : row;
            const actualCol = this.flipped ? 7 - col : col;
            
            if (this.options.onPieceClick) {
                this.options.onPieceClick(actualRow, actualCol, pieceElement.getAttribute('data-piece'));
            }
        });
        
        pieceElement.addEventListener('dragend', () => {
            pieceElement.classList.remove('dragging');
        });
        
        // 为方格添加放置事件
        const square = pieceElement.parentElement;
        
        square.addEventListener('dragover', (e) => {
            e.preventDefault(); // 允许放置
        });
        
        square.addEventListener('drop', (e) => {
            e.preventDefault();
            
            const [fromRow, fromCol] = e.dataTransfer.getData('text/plain').split(',').map(Number);
            const toRow = parseInt(square.getAttribute('data-row'));
            const toCol = parseInt(square.getAttribute('data-col'));
            
            // 转换为实际坐标
            const actualFromRow = this.flipped ? 7 - fromRow : fromRow;
            const actualFromCol = this.flipped ? 7 - fromCol : fromCol;
            const actualToRow = this.flipped ? 7 - toRow : toRow;
            const actualToCol = this.flipped ? 7 - toCol : toCol;
            
            // 尝试移动
            if (this.options.onMove) {
                this.options.onMove(actualFromRow, actualFromCol, actualToRow, actualToCol);
            }
            
            // 清除选择
            this.clearSelection();
        });
    }

    // 翻转棋盘
    flipBoard() {
        this.flipped = !this.flipped;
        
        // 重新放置棋子
        const pieces = [];
        const pieceElements = this.containerElement.querySelectorAll('.chess-piece');
        
        pieceElements.forEach(pieceElement => {
            const square = pieceElement.parentElement;
            const row = parseInt(square.getAttribute('data-row'));
            const col = parseInt(square.getAttribute('data-col'));
            const piece = pieceElement.getAttribute('data-piece');
            
            // 移除棋子
            square.removeChild(pieceElement);
            
            // 存储信息，以便重新放置
            pieces.push({
                piece,
                row: this.flipped ? 7 - row : row,
                col: this.flipped ? 7 - col : col
            });
        });
        
        // 重新放置棋子
        pieces.forEach(({ piece, row, col }) => {
            const actualRow = this.flipped ? 7 - row : row;
            const actualCol = this.flipped ? 7 - col : col;
            this.placePiece(piece, actualRow, actualCol);
        });
    }
}

// 导出类使其可以被其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChessboardUI;
}