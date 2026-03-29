/**
 * 国际象棋规则引擎
 * 实现国际象棋的规则、移动验证和游戏状态检查
 */
class ChessEngine {
    constructor() {
        this.reset();
    }

    // 重置棋盘到初始状态
    reset() {
        // 初始化棋盘
        this.board = [
            ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'],
            ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'],
            ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR']
        ];

        // 游戏状态
        this.currentPlayer = 'w'; // 'w'代表白方，'b'代表黑方
        this.gameOver = false;
        this.castlingRights = { 
            w: { kingSide: true, queenSide: true }, 
            b: { kingSide: true, queenSide: true } 
        };
        this.enPassantTarget = null;
        this.moveHistory = [];
        this.capturedPieces = { w: [], b: [] };
        this.halfMoveClock = 0; // 50回合规则计数
        this.fullMoveNumber = 1; // 完整回合数
        this.kingPositions = { w: [7, 4], b: [0, 4] };
    }

    // 获取特定位置的棋子
    getPiece(row, col) {
        if (row < 0 || row > 7 || col < 0 || col > 7) return null;
        return this.board[row][col];
    }

    // 放置棋子到特定位置
    setPiece(row, col, piece) {
        if (row < 0 || row > 7 || col < 0 || col > 7) return;
        this.board[row][col] = piece;
    }

    // 获取棋子颜色
    getPieceColor(piece) {
        if (!piece) return null;
        return piece.charAt(0);
    }

    // 获取棋子类型
    getPieceType(piece) {
        if (!piece) return null;
        return piece.charAt(1);
    }

    // 判断是否为玩家自己的棋子
    isPlayerPiece(piece, player) {
        return piece && this.getPieceColor(piece) === player;
    }

    // 交换玩家回合
    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'w' ? 'b' : 'w';
    }

    // 执行移动
    makeMove(fromRow, fromCol, toRow, toCol, promotionPiece = 'Q') {
        const piece = this.getPiece(fromRow, fromCol);
        if (!piece) return false;

        // 检查是否是当前玩家的棋子
        if (!this.isPlayerPiece(piece, this.currentPlayer)) return false;

        // 检查移动是否合法
        if (!this.isValidMove(fromRow, fromCol, toRow, toCol)) return false;

        // 记录被吃掉的棋子
        const capturedPiece = this.getPiece(toRow, toCol);
        if (capturedPiece) {
            this.capturedPieces[this.currentPlayer].push(capturedPiece);
        }

        // 特殊移动：吃过路兵
        let enPassantCapture = false;
        if (this.getPieceType(piece) === 'P' && this.enPassantTarget && 
            toRow === this.enPassantTarget[0] && toCol === this.enPassantTarget[1]) {
            const direction = this.currentPlayer === 'w' ? 1 : -1;
            this.capturedPieces[this.currentPlayer].push(`${this.currentPlayer === 'w' ? 'b' : 'w'}P`);
            this.setPiece(toRow + direction, toCol, null);
            enPassantCapture = true;
        }

        // 更新en passant目标
        this.enPassantTarget = null;
        if (this.getPieceType(piece) === 'P' && Math.abs(fromRow - toRow) === 2) {
            const direction = this.currentPlayer === 'w' ? -1 : 1;
            this.enPassantTarget = [fromRow + direction, fromCol];
        }

        // 特殊移动：王车易位
        if (this.getPieceType(piece) === 'K' && Math.abs(fromCol - toCol) === 2) {
            // 王车易位
            const rookCol = toCol > fromCol ? 7 : 0;
            const newRookCol = toCol > fromCol ? toCol - 1 : toCol + 1;
            const rookPiece = this.getPiece(fromRow, rookCol);
            this.setPiece(fromRow, rookCol, null);
            this.setPiece(fromRow, newRookCol, rookPiece);
        }

        // 更新王的位置
        if (this.getPieceType(piece) === 'K') {
            this.kingPositions[this.currentPlayer] = [toRow, toCol];
        }

        // 执行移动
        this.setPiece(toRow, toCol, piece);
        this.setPiece(fromRow, fromCol, null);

        // 兵的升变
        if (this.getPieceType(piece) === 'P' && (toRow === 0 || toRow === 7)) {
            this.setPiece(toRow, toCol, this.currentPlayer + promotionPiece);
        }

        // 保存王车易位权利快照（用于悔棋恢复）
        const castlingRightsBefore = {
            w: { kingSide: this.castlingRights.w.kingSide, queenSide: this.castlingRights.w.queenSide },
            b: { kingSide: this.castlingRights.b.kingSide, queenSide: this.castlingRights.b.queenSide }
        };

        // 更新王车易位权利
        if (this.getPieceType(piece) === 'K') {
            this.castlingRights[this.currentPlayer].kingSide = false;
            this.castlingRights[this.currentPlayer].queenSide = false;
        } else if (this.getPieceType(piece) === 'R') {
            if (fromCol === 0) {
                this.castlingRights[this.currentPlayer].queenSide = false;
            } else if (fromCol === 7) {
                this.castlingRights[this.currentPlayer].kingSide = false;
            }
        }

        // 记录移动历史
        const move = {
            piece: piece,
            from: [fromRow, fromCol],
            to: [toRow, toCol],
            captured: capturedPiece || (enPassantCapture ? `${this.currentPlayer === 'w' ? 'b' : 'w'}P` : null),
            promotion: this.getPieceType(piece) === 'P' && (toRow === 0 || toRow === 7) ? promotionPiece : null,
            castling: this.getPieceType(piece) === 'K' && Math.abs(fromCol - toCol) === 2,
            enPassant: enPassantCapture,
            check: false, // 将在稍后检查
            checkmate: false, // 将在稍后检查
            notation: this.moveToNotation(piece, fromRow, fromCol, toRow, toCol, capturedPiece, enPassantCapture, promotionPiece),
            castlingRightsBefore: castlingRightsBefore
        };

        // 更新半回合时钟（用于50回合规则）
        if (this.getPieceType(piece) === 'P' || capturedPiece || enPassantCapture) {
            this.halfMoveClock = 0;
        } else {
            this.halfMoveClock++;
        }

        // 切换玩家
        this.switchPlayer();

        // 检查是否将军
        if (this.isKingInCheck(this.currentPlayer)) {
            move.check = true;
            
            // 检查是否将杀
            if (this.isCheckmate()) {
                move.checkmate = true;
                this.gameOver = true;
            }
        }

        // 检查和局条件
        if (this.isStalemate() || this.isDrawByMaterial() || this.halfMoveClock >= 100) {
            this.gameOver = true;
        }

        // 更新完整回合数
        if (this.currentPlayer === 'w') {
            this.fullMoveNumber++;
        }

        this.moveHistory.push(move);
        return true;
    }

    // 检查移动是否合法
    isValidMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.getPiece(fromRow, fromCol);
        if (!piece) return false;

        const pieceColor = this.getPieceColor(piece);
        const pieceType = this.getPieceType(piece);

        // 目标位置检查
        const targetPiece = this.getPiece(toRow, toCol);
        if (targetPiece && this.getPieceColor(targetPiece) === pieceColor) {
            return false; // 不能吃自己的棋子
        }

        // 根据棋子类型检查移动
        let validMove = false;

        switch (pieceType) {
            case 'P': // 兵
                validMove = this.isPawnMoveValid(fromRow, fromCol, toRow, toCol);
                break;
            case 'R': // 车
                validMove = this.isRookMoveValid(fromRow, fromCol, toRow, toCol);
                break;
            case 'N': // 马
                validMove = this.isKnightMoveValid(fromRow, fromCol, toRow, toCol);
                break;
            case 'B': // 象
                validMove = this.isBishopMoveValid(fromRow, fromCol, toRow, toCol);
                break;
            case 'Q': // 后
                validMove = this.isQueenMoveValid(fromRow, fromCol, toRow, toCol);
                break;
            case 'K': // 王
                validMove = this.isKingMoveValid(fromRow, fromCol, toRow, toCol);
                break;
        }

        if (!validMove) return false;

        // 模拟移动，检查是否会导致自己被将军
        const originalPiece = this.getPiece(toRow, toCol);
        const originalEnPassantTarget = this.enPassantTarget;
        
        // 处理吃过路兵的特殊情况
        let enPassantPiece = null;
        let enPassantPos = null;
        
        if (pieceType === 'P' && this.enPassantTarget && 
            toRow === this.enPassantTarget[0] && toCol === this.enPassantTarget[1]) {
            const direction = pieceColor === 'w' ? 1 : -1;
            enPassantPos = [toRow + direction, toCol];
            enPassantPiece = this.getPiece(toRow + direction, toCol);
            this.setPiece(toRow + direction, toCol, null);
        }
        
        // 模拟移动
        this.setPiece(toRow, toCol, piece);
        this.setPiece(fromRow, fromCol, null);
        
        // 临时更新王的位置
        const originalKingPos = [...this.kingPositions[pieceColor]];
        if (pieceType === 'K') {
            this.kingPositions[pieceColor] = [toRow, toCol];
        }
        
        // 检查是否导致自己被将军
        const isInCheck = this.isKingInCheck(pieceColor);
        
        // 恢复棋盘状态
        this.setPiece(fromRow, fromCol, piece);
        this.setPiece(toRow, toCol, originalPiece);
        this.kingPositions[pieceColor] = originalKingPos;
        this.enPassantTarget = originalEnPassantTarget;
        
        // 恢复吃过路兵
        if (enPassantPos) {
            this.setPiece(enPassantPos[0], enPassantPos[1], enPassantPiece);
        }
        
        return !isInCheck;
    }

    // 检查兵的移动是否合法
    isPawnMoveValid(fromRow, fromCol, toRow, toCol) {
        const piece = this.getPiece(fromRow, fromCol);
        const pieceColor = this.getPieceColor(piece);
        const direction = pieceColor === 'w' ? -1 : 1;
        const startRow = pieceColor === 'w' ? 6 : 1;

        // 前进一格
        if (fromCol === toCol && toRow === fromRow + direction && !this.getPiece(toRow, toCol)) {
            return true;
        }

        // 初始位置可前进两格
        if (fromCol === toCol && fromRow === startRow && toRow === fromRow + 2 * direction &&
            !this.getPiece(fromRow + direction, fromCol) && !this.getPiece(toRow, toCol)) {
            return true;
        }

        // 斜向吃子
        if (Math.abs(fromCol - toCol) === 1 && toRow === fromRow + direction) {
            // 目标位置有对方棋子
            if (this.getPiece(toRow, toCol) && this.getPieceColor(this.getPiece(toRow, toCol)) !== pieceColor) {
                return true;
            }
            
            // 吃过路兵
            if (this.enPassantTarget && 
                toRow === this.enPassantTarget[0] && toCol === this.enPassantTarget[1]) {
                return true;
            }
        }

        return false;
    }

    // 检查车的移动是否合法
    isRookMoveValid(fromRow, fromCol, toRow, toCol) {
        // 车只能横向或纵向移动
        if (fromRow !== toRow && fromCol !== toCol) {
            return false;
        }

        // 检查路径上是否有其他棋子
        if (fromRow === toRow) {
            // 横向移动
            const step = fromCol < toCol ? 1 : -1;
            for (let col = fromCol + step; col !== toCol; col += step) {
                if (this.getPiece(fromRow, col)) {
                    return false;
                }
            }
        } else {
            // 纵向移动
            const step = fromRow < toRow ? 1 : -1;
            for (let row = fromRow + step; row !== toRow; row += step) {
                if (this.getPiece(row, fromCol)) {
                    return false;
                }
            }
        }

        return true;
    }

    // 检查马的移动是否合法
    isKnightMoveValid(fromRow, fromCol, toRow, toCol) {
        // 马走"日"字
        const rowDiff = Math.abs(fromRow - toRow);
        const colDiff = Math.abs(fromCol - toCol);
        return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
    }

    // 检查象的移动是否合法
    isBishopMoveValid(fromRow, fromCol, toRow, toCol) {
        // 象只能沿对角线移动
        if (Math.abs(fromRow - toRow) !== Math.abs(fromCol - toCol)) {
            return false;
        }

        // 检查路径上是否有其他棋子
        const rowStep = fromRow < toRow ? 1 : -1;
        const colStep = fromCol < toCol ? 1 : -1;

        let row = fromRow + rowStep;
        let col = fromCol + colStep;

        while (row !== toRow && col !== toCol) {
            if (this.getPiece(row, col)) {
                return false;
            }
            row += rowStep;
            col += colStep;
        }

        return true;
    }

    // 检查后的移动是否合法
    isQueenMoveValid(fromRow, fromCol, toRow, toCol) {
        // 后可以沿直线或对角线移动，结合车和象的移动规则
        return this.isRookMoveValid(fromRow, fromCol, toRow, toCol) || 
               this.isBishopMoveValid(fromRow, fromCol, toRow, toCol);
    }

    // 检查王的移动是否合法
    isKingMoveValid(fromRow, fromCol, toRow, toCol) {
        const rowDiff = Math.abs(fromRow - toRow);
        const colDiff = Math.abs(fromCol - toCol);

        // 普通移动：王可以向任何方向移动一格
        if (rowDiff <= 1 && colDiff <= 1) {
            return true;
        }

        // 王车易位
        if (rowDiff === 0 && colDiff === 2 && !this.isKingInCheck(this.currentPlayer)) {
            const isKingSide = toCol > fromCol;
            const castlingRight = isKingSide ? 'kingSide' : 'queenSide';
            
            // 检查是否有王车易位权利
            if (!this.castlingRights[this.currentPlayer][castlingRight]) {
                return false;
            }
            
            // 检查王和车之间是否有棋子
            const rookCol = isKingSide ? 7 : 0;
            const rookPiece = this.getPiece(fromRow, rookCol);
            
            if (!rookPiece || this.getPieceType(rookPiece) !== 'R' || 
                this.getPieceColor(rookPiece) !== this.currentPlayer) {
                return false;
            }
            
            const step = isKingSide ? 1 : -1;
            for (let col = fromCol + step; col !== rookCol; col += step) {
                if (this.getPiece(fromRow, col)) {
                    return false;
                }
            }
            
            // 检查王移动路径上的格子是否受到攻击
            for (let col = fromCol; col !== toCol + step; col += step) {
                if (this.isSquareAttacked(fromRow, col, this.currentPlayer)) {
                    return false;
                }
            }
            
            return true;
        }
        
        return false;
    }

    // 检查指定格子是否被攻击
    isSquareAttacked(row, col, defendingColor) {
        const attackingColor = defendingColor === 'w' ? 'b' : 'w';
        
        // 检查是否被兵攻击
        const pawnDir = attackingColor === 'w' ? -1 : 1;
        const pawnRows = [row - pawnDir];
        const pawnCols = [col - 1, col + 1];
        
        for (const pCol of pawnCols) {
            if (pCol >= 0 && pCol <= 7) {
                const piece = this.getPiece(row - pawnDir, pCol);
                if (piece && this.getPieceColor(piece) === attackingColor && 
                    this.getPieceType(piece) === 'P') {
                    return true;
                }
            }
        }
        
        // 检查是否被马攻击
        const knightMoves = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        
        for (const [dRow, dCol] of knightMoves) {
            const r = row + dRow;
            const c = col + dCol;
            
            if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                const piece = this.getPiece(r, c);
                if (piece && this.getPieceColor(piece) === attackingColor && 
                    this.getPieceType(piece) === 'N') {
                    return true;
                }
            }
        }
        
        // 检查是否被王攻击
        const kingMoves = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        
        for (const [dRow, dCol] of kingMoves) {
            const r = row + dRow;
            const c = col + dCol;
            
            if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                const piece = this.getPiece(r, c);
                if (piece && this.getPieceColor(piece) === attackingColor && 
                    this.getPieceType(piece) === 'K') {
                    return true;
                }
            }
        }
        
        // 检查是否被车或后攻击（横向和纵向）
        const rookDirections = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        
        for (const [dRow, dCol] of rookDirections) {
            let r = row + dRow;
            let c = col + dCol;
            
            while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                const piece = this.getPiece(r, c);
                
                if (piece) {
                    if (this.getPieceColor(piece) === attackingColor && 
                        (this.getPieceType(piece) === 'R' || this.getPieceType(piece) === 'Q')) {
                        return true;
                    }
                    break;
                }
                
                r += dRow;
                c += dCol;
            }
        }
        
        // 检查是否被象或后攻击（对角线）
        const bishopDirections = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        
        for (const [dRow, dCol] of bishopDirections) {
            let r = row + dRow;
            let c = col + dCol;
            
            while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                const piece = this.getPiece(r, c);
                
                if (piece) {
                    if (this.getPieceColor(piece) === attackingColor && 
                        (this.getPieceType(piece) === 'B' || this.getPieceType(piece) === 'Q')) {
                        return true;
                    }
                    break;
                }
                
                r += dRow;
                c += dCol;
            }
        }
        
        return false;
    }

    // 检查王是否被将军
    isKingInCheck(color) {
        const [kingRow, kingCol] = this.kingPositions[color];
        return this.isSquareAttacked(kingRow, kingCol, color);
    }

    // 检查是否将杀
    isCheckmate() {
        if (!this.isKingInCheck(this.currentPlayer)) {
            return false;
        }
        
        return this.hasNoLegalMoves();
    }

    // 检查是否逼和
    isStalemate() {
        if (this.isKingInCheck(this.currentPlayer)) {
            return false;
        }
        
        return this.hasNoLegalMoves();
    }

    // 检查玩家是否没有合法移动
    hasNoLegalMoves() {
        for (let fromRow = 0; fromRow < 8; fromRow++) {
            for (let fromCol = 0; fromCol < 8; fromCol++) {
                const piece = this.getPiece(fromRow, fromCol);
                
                if (piece && this.getPieceColor(piece) === this.currentPlayer) {
                    for (let toRow = 0; toRow < 8; toRow++) {
                        for (let toCol = 0; toCol < 8; toCol++) {
                            if (this.isValidMove(fromRow, fromCol, toRow, toCol)) {
                                return false;
                            }
                        }
                    }
                }
            }
        }
        
        return true;
    }

    // 检查是否因子力不足导致和局
    isDrawByMaterial() {
        // 计算棋盘上所有剩余的棋子
        let pieces = { wK: 0, bK: 0, wQ: 0, bQ: 0, wR: 0, bR: 0, wB: 0, bB: 0, wN: 0, bN: 0, wP: 0, bP: 0 };
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.getPiece(row, col);
                if (piece) {
                    pieces[piece]++;
                }
            }
        }
        
        // 王对王
        if (pieces.wK === 1 && pieces.bK === 1 && 
            Object.values(pieces).reduce((sum, count) => sum + count, 0) === 2) {
            return true;
        }
        
        // 王对王加单骑士
        if (pieces.wK === 1 && pieces.bK === 1 && 
            ((pieces.wN === 1 && Object.values(pieces).reduce((sum, count) => sum + count, 0) === 3) || 
             (pieces.bN === 1 && Object.values(pieces).reduce((sum, count) => sum + count, 0) === 3))) {
            return true;
        }
        
        // 王对王加单象
        if (pieces.wK === 1 && pieces.bK === 1 && 
            ((pieces.wB === 1 && Object.values(pieces).reduce((sum, count) => sum + count, 0) === 3) || 
             (pieces.bB === 1 && Object.values(pieces).reduce((sum, count) => sum + count, 0) === 3))) {
            return true;
        }
        
        // 王加单象对王加单象（同色象）
        if (pieces.wK === 1 && pieces.bK === 1 && pieces.wB === 1 && pieces.bB === 1 && 
            Object.values(pieces).reduce((sum, count) => sum + count, 0) === 4) {
            // 检查象是否在同色格子上
            let whiteBishopSquareColor = null;
            let blackBishopSquareColor = null;
            
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    const piece = this.getPiece(row, col);
                    if (piece === 'wB') {
                        whiteBishopSquareColor = (row + col) % 2;
                    } else if (piece === 'bB') {
                        blackBishopSquareColor = (row + col) % 2;
                    }
                }
            }
            
            if (whiteBishopSquareColor === blackBishopSquareColor) {
                return true;
            }
        }
        
        return false;
    }

    // 将移动转换为国际象棋标准注释
    moveToNotation(piece, fromRow, fromCol, toRow, toCol, capturedPiece, enPassantCapture, promotionPiece) {
        const pieceType = this.getPieceType(piece);
        const files = 'abcdefgh';
        const ranks = '87654321';
        
        // 王车易位
        if (pieceType === 'K' && Math.abs(fromCol - toCol) === 2) {
            return toCol > fromCol ? 'O-O' : 'O-O-O';
        }
        
        let notation = '';
        
        // 棋子字母（兵除外）
        if (pieceType !== 'P') {
            notation += pieceType;
        }
        
        // 出发坐标（需要时才添加，以区分同类棋子可以移动到同一个目标位置的情况）
        const ambiguousPieces = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row !== fromRow || col !== fromCol) && 
                    this.getPiece(row, col) === piece &&
                    this.isValidMove(row, col, toRow, toCol)) {
                    ambiguousPieces.push([row, col]);
                }
            }
        }
        
        if (ambiguousPieces.length > 0) {
            let needFile = false;
            let needRank = false;
            
            for (const [ambRow, ambCol] of ambiguousPieces) {
                if (ambCol === fromCol) {
                    needFile = true;
                }
                if (ambRow === fromRow) {
                    needRank = true;
                }
            }
            
            if (needFile && needRank) {
                notation += files[fromCol] + ranks[fromRow];
            } else if (needFile) {
                notation += files[fromCol];
            } else if (needRank) {
                notation += ranks[fromRow];
            } else {
                notation += files[fromCol];
            }
        }
        
        // 吃子符号
        if (capturedPiece || enPassantCapture) {
            // 如果是兵吃子，需要标注出发列
            if (pieceType === 'P' && notation === '') {
                notation += files[fromCol];
            }
            notation += 'x';
        }
        
        // 目标坐标
        notation += files[toCol] + ranks[toRow];
        
        // 兵升变
        if (pieceType === 'P' && (toRow === 0 || toRow === 7)) {
            notation += '=' + promotionPiece;
        }
        
        return notation;
    }

    // 获取上一步移动
    getLastMove() {
        if (this.moveHistory.length === 0) {
            return null;
        }
        return this.moveHistory[this.moveHistory.length - 1];
    }

    // 悔棋
    undoLastMove() {
        if (this.moveHistory.length === 0) {
            return false;
        }
        
        const lastMove = this.moveHistory.pop();
        const [fromRow, fromCol] = lastMove.from;
        const [toRow, toCol] = lastMove.to;
        
        // 恢复移动的棋子
        this.setPiece(fromRow, fromCol, lastMove.piece);
        
        // 处理升变
        if (lastMove.promotion) {
            // 如果是升变，恢复为兵
            this.setPiece(fromRow, fromCol, this.getPieceColor(lastMove.piece) + 'P');
        }
        
        // 处理正常吃子
        if (lastMove.captured && !lastMove.enPassant) {
            this.setPiece(toRow, toCol, lastMove.captured);
        } else {
            this.setPiece(toRow, toCol, null);
        }
        
        // 处理吃过路兵
        if (lastMove.enPassant) {
            const direction = this.getPieceColor(lastMove.piece) === 'w' ? 1 : -1;
            this.setPiece(toRow + direction, toCol, lastMove.captured);
        }
        
        // 处理王车易位
        if (lastMove.castling) {
            const isKingSide = toCol > fromCol;
            const rookFromCol = isKingSide ? 7 : 0;
            const rookToCol = isKingSide ? toCol - 1 : toCol + 1;
            const rookPiece = this.getPiece(toRow, rookToCol);
            
            this.setPiece(toRow, rookToCol, null);
            this.setPiece(toRow, rookFromCol, rookPiece);
        }
        
        // 恢复王的位置
        if (this.getPieceType(lastMove.piece) === 'K') {
            this.kingPositions[this.getPieceColor(lastMove.piece)] = [fromRow, fromCol];
        }
        
        // 恢复吃子记录
        if (lastMove.captured) {
            const captureColor = this.getPieceColor(lastMove.piece);
            const capturedPieces = this.capturedPieces[captureColor];
            
            if (capturedPieces.length > 0) {
                // 移除最后一个被吃的棋子
                capturedPieces.pop();
            }
        }
        
        // 恢复玩家
        this.switchPlayer();
        
        // 恢复游戏状态
        this.gameOver = false;
        
        // 恢复en passant目标
        if (this.moveHistory.length > 0) {
            const prevMove = this.moveHistory[this.moveHistory.length - 1];
            
            if (this.getPieceType(prevMove.piece) === 'P' && Math.abs(prevMove.from[0] - prevMove.to[0]) === 2) {
                const direction = this.getPieceColor(prevMove.piece) === 'w' ? -1 : 1;
                this.enPassantTarget = [prevMove.from[0] + direction, prevMove.from[1]];
            } else {
                this.enPassantTarget = null;
            }
        } else {
            this.enPassantTarget = null;
        }
        
        // 恢复王车易位权利
        if (lastMove.castlingRightsBefore) {
            this.castlingRights = lastMove.castlingRightsBefore;
        }

        return true;
    }

    // 获取游戏状态描述
    getGameStatusText() {
        if (this.isCheckmate()) {
            return this.currentPlayer === 'w' ? '黑方胜利！' : '白方胜利！';
        } else if (this.isStalemate()) {
            return '和局：逼和';
        } else if (this.isDrawByMaterial()) {
            return '和局：子力不足';
        } else if (this.halfMoveClock >= 100) {
            return '和局：50回合规则';
        } else if (this.isKingInCheck(this.currentPlayer)) {
            return (this.currentPlayer === 'w' ? '白方' : '黑方') + '被将军';
        } else {
            return (this.currentPlayer === 'w' ? '白方' : '黑方') + '走棋';
        }
    }
}

// 导出类使其可以被其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChessEngine;
} 