const fs = require('fs');
let content = fs.readFileSync('frontend/src/app/host/page.tsx', 'utf8');

// 1. Add gameOver state
content = content.replace(
  `  const [toastMessage, setToastMessage] = useState<string | null>(null);`,
  `  const [toastMessage, setToastMessage] = useState<string | null>(null);\n  const [gameOver, setGameOver] = useState<{winnerName: string, score: number} | null>(null);`
);

// 2. Add game_over socket listener
content = content.replace(
  `    newSocket.on('game_message', ({ message }) => {`,
  `    newSocket.on('game_over', (data) => setGameOver(data));\n\n    newSocket.on('game_message', ({ message }) => {`
);

// 3. Add Longest Road state to GameState interface
content = content.replace(
  `  players: Player[];`,
  `  players: Player[];\n  longestRoadOwner?: string;\n  longestRoadLength?: number;`
);

// 4. Update the player badge with Longest Road indicator
content = content.replace(
  `            <div key={p.id} className="backdrop-blur-sm px-6 py-3 rounded-xl text-white font-bold shadow-2xl border-2" style={{ backgroundColor: \`\${p.color}dd\`, borderColor: p.color }}>
              {p.name}
            </div>`,
  `            <div key={p.id} className="backdrop-blur-sm px-6 py-3 rounded-xl text-white font-bold shadow-2xl border-2 flex items-center" style={{ backgroundColor: \`\${p.color}dd\`, borderColor: p.color }}>
              <span>{p.name}</span>
              {gameState.longestRoadOwner === p.id && <span className="bg-yellow-500 text-yellow-950 text-[10px] px-2 py-0.5 rounded-full ml-2 shadow-sm font-black whitespace-nowrap tracking-wider">LONGEST ROAD</span>}
            </div>`
);

// 5. Add gameOver UI
content = content.replace(
  `        {/* Ocean Background mapping */}`,
  `        {gameOver && (
          <div className="absolute inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-6 backdrop-blur-md">
            <div className="bg-gradient-to-b from-yellow-500 to-yellow-700 p-2 rounded-3xl shadow-[0_0_150px_rgba(234,179,8,0.6)] animate-bounce w-[800px]">
              <div className="bg-slate-900 rounded-3xl p-16 flex flex-col items-center border-2 border-yellow-500/50">
                <div className="text-8xl mb-8">🏆</div>
                <h2 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 mb-6 uppercase tracking-[0.2em] text-center drop-shadow-2xl">Victory!</h2>
                <p className="text-white text-4xl text-center leading-relaxed">
                  <span className="font-bold text-yellow-400 text-6xl drop-shadow-lg">{gameOver.winnerName}</span><br/><br/>
                  has won the game with <span className="font-black text-emerald-400">{gameOver.score}</span> Victory Points!
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Ocean Background mapping */}`
);

fs.writeFileSync('frontend/src/app/host/page.tsx', content, 'utf8');
console.log('Host page refactored.');
