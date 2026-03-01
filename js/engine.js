/**
 * 国际象棋AI引擎
 * 使用 Stockfish Web Worker 替换原来的极小化极大算法
 */
class ChessAI {
    constructor(difficulty = 'medium') {
        this.setDifficulty(difficulty);
        
        // 初始化 Stockfish Worker
        this.worker = new Worker(new URL('js/stockfish.js', document.baseURI || window.location.href));
        this.worker.postMessage('uci');
        this.worker.postMessage('setoption name MultiPV value 3'); // 启用多路分析以提升残局视野
        
        this.ready = false;
        this.bestMoves = []; 
        this.isThinking = false;
        this.onEvaluationUpdate = null; 
        this.sideToMove = 'w'; 
        
        this.worker.onmessage = (event) => {
            const line = event.data;
            if (typeof line !== 'string') return;
            
            if (line === 'uciok') {
                this.ready = true;
                if (this.onReady) this.onReady();
            } else if (line.startsWith('info') && line.includes('multipv')) {
                this.handleMultiPVInfo(line);
            } else if (line.startsWith('info') && line.includes('score') && !line.includes('multipv')) {
                // 兼容常规的评估信息
                this.handleEvaluation(line);
            } else if (line.startsWith('bestmove')) {
                this.isThinking = false;
                this.handleBestMoveFallback(line); // 处理备用或常规的bestmove
            }
        };
    }

    // 设置AI难度
    setDifficulty(difficulty) {
        // ... (保持不变)
        switch (difficulty) {
            case 'level1': this.searchDepth = 1; break;
            case 'level2': this.searchDepth = 2; break;
            case 'level3': this.searchDepth = 4; break;
            case 'level4':
            case 'medium': this.searchDepth = 6; break;
            case 'level5': this.searchDepth = 8; break;
            case 'level6': this.searchDepth = 12; break;
            case 'level7': this.searchDepth = 16; break;
            case 'level8': this.searchDepth = 20; break;
            default: this.searchDepth = 6;
        }
    }

    // 将内部引擎的移动历史转换为 UCI 格式 (如 e2e4)
    getUciMoves(engine) {
        return engine.moveHistory.map(move => {
            const fromFile = String.fromCharCode(97 + move.from[1]);
            const fromRank = 8 - move.from[0];
            const toFile = String.fromCharCode(97 + move.to[1]);
            const toRank = 8 - move.to[0];
            let uci = `${fromFile}${fromRank}${toFile}${toRank}`;
            if (move.promotion) {
                uci += move.promotion.toLowerCase();
            }
            return uci;
        }).join(' ');
    }

    // 解析 UCI 格式到内部表示 [fromRow, fromCol, toRow, toCol, promotion]
    parseUciMove(uci) {
        if (!uci) return null;
        const fromFile = uci.charCodeAt(0) - 97;
        const fromRank = 8 - parseInt(uci[1]);
        const toFile = uci.charCodeAt(2) - 97;
        const toRank = 8 - parseInt(uci[3]);
        let promotion = uci.length === 5 ? uci[4] : null;
        return [fromRank, fromFile, toRank, toFile, promotion];
    }

    // 获取AI建议的最佳移动 (返回 Promise)
    getBestMove(engine, depth = null, time = null, useClock = false) {
        return new Promise((resolve) => {
            if (!this.ready || this.isThinking) {
                setTimeout(() => resolve(this.getBestMove(engine, depth, time, useClock)), 100);
                return;
            }
            
            this.isThinking = true;
            this.bestMoves = []; // 清理缓存
            this.resolveBestMove = resolve; // 保存回调
            
            this.sideToMove = engine.currentPlayer;
            const uciMoves = this.getUciMoves(engine);
            const positionCmd = uciMoves.length > 0 ? `position startpos moves ${uciMoves}` : 'position startpos';
            this.worker.postMessage(positionCmd);
            
            let goCmd = 'go';
            if (useClock) {
                // 模拟时钟：让AI根据局面复杂度和剩余时间(假设为5分钟)自行决定深度
                // 这在残局中尤为有效，它会为了解残局投入更多时间
                goCmd += ` wtime 300000 btime 300000 winc 5000 binc 5000`;
            } else if (time) {
                goCmd += ` movetime ${time}`;
            } else if (depth) {
                goCmd += ` depth ${depth}`;
            } else {
                goCmd += ` depth ${this.searchDepth}`;
            }
            this.worker.postMessage(goCmd);
        });
    }

    handleMultiPVInfo(line) {
        const pvMatch = line.match(/multipv (\d+) score (cp|mate) (-?\d+).* pv (.+)/);
        if (pvMatch) {
            const pvIndex = parseInt(pvMatch[1]);
            const moveUci = pvMatch[4].split(' ')[0];
            // 只保留第一个最佳移动，但要求引擎计算MultiPV以拓宽搜索树
            if (pvIndex === 1) {
                this.bestMoves[0] = this.parseUciMove(moveUci);
            }
            // 同时可以调用评价函数更新胜率
            this.handleEvaluation(line);
        }
    }

    handleBestMoveFallback(line) {
        if (this.resolveBestMove) {
            let finalMove = null;
            // 优先使用 MultiPV 找到的最好移动
            if (this.bestMoves.length > 0 && this.bestMoves[0]) {
                 finalMove = this.bestMoves[0];
            } else {
                 // 回退到常规解析
                 const match = line.match(/^bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
                 if (match) {
                     finalMove = this.parseUciMove(match[1]);
                 }
            }
            this.resolveBestMove(finalMove);
            this.resolveBestMove = null;
        }
    }

    // 处理 Stockfish 发送的评价信息
    handleEvaluation(line) {
        if (!this.onEvaluationUpdate) return;

        let score = 0;
        let type = 'cp';

        // 解析分值 (centipawns)
        const cpMatch = line.match(/score cp (-?\d+)/);
        if (cpMatch) {
            score = parseInt(cpMatch[1]);
        } else {
            // 解析将杀步数
            const mateMatch = line.match(/score mate (-?\d+)/);
            if (mateMatch) {
                type = 'mate';
                score = parseInt(mateMatch[1]);
            } else {
                return;
            }
        }

        // Stockfish 返回的分数是相对于当前走棋方的
        // 如果当前是黑方走棋，我们需要对分数取反，以获得相对于白方的分数
        if (this.sideToMove === 'b') {
            score = -score;
        }

        // 计算胜率 (基于白方的胜率)
        // 胜率公式: Win Prob = 50 + 50 * (2 / (1 + exp(-0.003682 * cp)) - 1)
        let winRate = 50;
        if (type === 'cp') {
            winRate = 50 + 50 * (2 / (1 + Math.exp(-0.003682 * score)) - 1);
        } else if (type === 'mate') {
            winRate = score > 0 ? 100 : 0;
        }

        this.onEvaluationUpdate({
            score: score,
            type: type,
            winRate: winRate.toFixed(1)
        });
    }
}

// 导出类使其可以被其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChessAI;
}