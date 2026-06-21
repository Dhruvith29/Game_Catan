const fs = require('fs');
let content = fs.readFileSync('frontend/src/app/play/page.tsx', 'utf8');

// 1. Add gameOver state
content = content.replace(
  `const [incomingTrade, setIncomingTrade] = useState<{`,
  `const [gameOver, setGameOver] = useState<{winnerName: string, score: number} | null>(null);\n  const [incomingTrade, setIncomingTrade] = useState<{`
);

// 2. Add game_over socket listener
content = content.replace(
  `    newSocket.on('game_started', (state) => setGameState(state));`,
  `    newSocket.on('game_started', (state) => setGameState(state));\n    newSocket.on('game_over', (data) => setGameOver(data));`
);

// 3. Rename ROLL and MAIN_ACTION
content = content.replace(/'ROLL'/g, "'waiting_for_roll'");
content = content.replace(/'MAIN_ACTION'/g, "'main_action'");

// 4. Update Dev Card isPlayable logic
content = content.replace(
  `const isPlayable = isActivePlayer && gameState.turnPhase === 'main_action' && !gameState.hasPlayedDevCardThisTurn && card !== 'Victory Point';`,
  `const isPlayable = isActivePlayer && !gameState.hasPlayedDevCardThisTurn && card !== 'Victory Point' && card !== 'Hidden VP' && (gameState.turnPhase === 'main_action' || (gameState.turnPhase === 'waiting_for_roll' && card === 'Knight'));`
);

// 5. Add gameOver UI
const uiHook = `        <div className="w-full max-w-sm flex-1 flex flex-col items-center">`;
const newUiHook = `        <div className="w-full max-w-sm flex-1 flex flex-col items-center">
          {gameOver && (
            <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-6 backdrop-blur-sm">
              <div className="bg-gradient-to-b from-yellow-500 to-yellow-700 p-1 rounded-3xl shadow-[0_0_100px_rgba(234,179,8,0.5)] w-full max-w-sm animate-bounce">
                <div className="bg-slate-900 rounded-3xl p-8 flex flex-col items-center border border-yellow-500/50">
                  <div className="text-6xl mb-4">🏆</div>
                  <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 mb-2 uppercase tracking-widest text-center">Victory!</h2>
                  <p className="text-white text-xl text-center mb-6">
                    <span className="font-bold text-yellow-400 text-3xl">{gameOver.winnerName}</span><br/>
                    has won the game with <span className="font-black text-emerald-400">{gameOver.score}</span> VP!
                  </p>
                </div>
              </div>
            </div>
          )}`;
content = content.replace(uiHook, newUiHook);

fs.writeFileSync('frontend/src/app/play/page.tsx', content, 'utf8');
console.log('Play page refactored.');
