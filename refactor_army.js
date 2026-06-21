const fs = require('fs');

// --- Backend ---
let serverContent = fs.readFileSync('backend/server.js', 'utf8');

// 1. Initialize knightsPlayed and largestArmySize
serverContent = serverContent.replace(
  `        largestArmyOwner: null,`,
  `        largestArmyOwner: null,\n        largestArmySize: 2,\n        knightsPlayed: {},`
);

// 2. Track Knights in play_dev_card
const knightHook = `      if (type === 'Knight') {
        state.turnPhase = 'MOVE_ROBBER';
      } else if (type === 'Year of Plenty') {`;

const newKnightHook = `      if (type === 'Knight') {
        state.turnPhase = 'MOVE_ROBBER';
        state.knightsPlayed[socket.id] = (state.knightsPlayed[socket.id] || 0) + 1;
        
        if (state.knightsPlayed[socket.id] > state.largestArmySize) {
          state.largestArmySize = state.knightsPlayed[socket.id];
          state.largestArmyOwner = socket.id;
          io.to(code).emit('game_message', { message: \`\${playerObj.name} took the Largest Army!\` });
        }
      } else if (type === 'Year of Plenty') {`;

serverContent = serverContent.replace(knightHook, newKnightHook);

fs.writeFileSync('backend/server.js', serverContent, 'utf8');


// --- Frontend ---
let hostContent = fs.readFileSync('frontend/src/app/host/page.tsx', 'utf8');

// Add to GameState
hostContent = hostContent.replace(
  `  longestRoadLength?: number;`,
  `  longestRoadLength?: number;\n  largestArmyOwner?: string;\n  largestArmySize?: number;`
);

// Add Badge
hostContent = hostContent.replace(
  `{gameState.longestRoadOwner === p.id && <span className="bg-yellow-500 text-yellow-950 text-[10px] px-2 py-0.5 rounded-full ml-2 shadow-sm font-black whitespace-nowrap tracking-wider">LONGEST ROAD</span>}`,
  `{gameState.longestRoadOwner === p.id && <span className="bg-yellow-500 text-yellow-950 text-[10px] px-2 py-0.5 rounded-full ml-2 shadow-sm font-black whitespace-nowrap tracking-wider">LONGEST ROAD</span>}\n              {gameState.largestArmyOwner === p.id && <span className="bg-red-500 text-red-950 text-[10px] px-2 py-0.5 rounded-full ml-2 shadow-sm font-black whitespace-nowrap tracking-wider">LARGEST ARMY</span>}`
);

fs.writeFileSync('frontend/src/app/host/page.tsx', hostContent, 'utf8');

console.log('Largest Army added.');
