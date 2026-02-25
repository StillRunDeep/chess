/**
 * 国际象棋AI引擎
 * 使用 Stockfish Web Worker 替换原来的极小化极大算法
 */
class ChessAI {
    constructor(difficulty = 'medium') {
        this.setDifficulty(difficulty);
        
        // 初始化 Stockfish Worker
        // 使用相对当前页面的绝对路径解析，以防 GitHub Pages 子目录访问时缺少斜杠导致的 404 错误
        this.worker = new Worker(new URL('js/stockfish.js', document.baseURI || window.location.href));
        this.worker.postMessage('uci');
        
        this.ready = false;
        this.callbacks = [];
        this.onEvaluationUpdate = null; // 胜率更新回调
        
        this.worker.onmessage = (event) => {
            const line = event.data;
            if (typeof line !== 'string') return;
            
            if (line === 'uciok') {
                this.ready = true;
            } else if (line.startsWith('info') && line.includes('score')) {
                this.handleEvaluation(line);
            } else if (line.startsWith('bestmove')) {
                const match = line.match(/^bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
                if (match) {
                    const move = match[1];
                    this.handleBestMove(move);
                } else {
                    this.handleBestMove(null); // 没有合法的移动
                }
            }
        };
    }

    // 设置AI难度
    setDifficulty(difficulty) {
        switch (difficulty) {
            case 'level1':
                this.searchDepth = 1;
                break;
            case 'level2':
                this.searchDepth = 2;
                break;
            case 'level3':
                this.searchDepth = 4;
                break;
            case 'level4':
            case 'medium': // 兼容初始默认值
                this.searchDepth = 6;
                break;
            case 'level5':
                this.searchDepth = 8;
                break;
            case 'level6':
                this.searchDepth = 12;
                break;
            case 'level7':
                this.searchDepth = 16;
                break;
            case 'level8':
                this.searchDepth = 20;
                break;
            default:
                this.searchDepth = 6;
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
    getBestMove(engine) {
        return new Promise((resolve) => {
            if (!this.ready) {
                // 如果引擎还没有准备好，稍后重试
                setTimeout(() => {
                    resolve(this.getBestMove(engine));
                }, 100);
                return;
            }
            
            this.callbacks.push(resolve);
            
            const uciMoves = this.getUciMoves(engine);
            if (uciMoves.length > 0) {
                this.worker.postMessage(`position startpos moves ${uciMoves}`);
            } else {
                this.worker.postMessage('position startpos');
            }
            
            // 开始计算
            this.worker.postMessage(`go depth ${this.searchDepth}`);
        });
    }

    handleBestMove(uciMove) {
        const resolve = this.callbacks.shift();
        if (resolve) {
            resolve(this.parseUciMove(uciMove));
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