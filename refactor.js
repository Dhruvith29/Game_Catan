const fs = require('fs');

let content = fs.readFileSync('backend/server.js', 'utf8');

// 1. Add calculateLongestRoad
content = content.replace(
  "const { generateBoard, distributeResources, validateSettlement, validateRoad, validateCity, getPlayerTradeRates } = require('./gameLogic');",
  "const { generateBoard, distributeResources, validateSettlement, validateRoad, validateCity, getPlayerTradeRates, calculateLongestRoad } = require('./gameLogic');"
);

// 2. Add broadcastState and evaluateWinner
content = content.replace(
  `const saveSnapshot = (code) => {
  if (rooms[code] && rooms[code].gameState) {
    if (!rooms[code].undoStack) rooms[code].undoStack = [];
    rooms[code].undoStack.push(JSON.parse(JSON.stringify(rooms[code].gameState)));
  }
};`,
  `const saveSnapshot = (code) => {
  if (rooms[code] && rooms[code].gameState) {
    if (!rooms[code].undoStack) rooms[code].undoStack = [];
    rooms[code].undoStack.push(JSON.parse(JSON.stringify(rooms[code].gameState)));
  }
};

const broadcastState = (code, eventName, extraData = {}) => {
  const room = rooms[code];
  if (!room || !room.gameState) return;
  const state = room.gameState;
  
  const sendToSocket = (socketId) => {
    const sanitized = JSON.parse(JSON.stringify(state));
    sanitized.players.forEach(p => {
      if (p.id !== socketId && socketId !== room.hostId) {
        p.devCards = p.devCards.map(card => card === 'Victory Point' ? 'Hidden VP' : card);
      }
    });
    if (eventName === 'game_started') {
      io.to(socketId).emit('game_started', sanitized);
    } else {
      io.to(socketId).emit(eventName, { ...extraData, gameState: sanitized });
    }
  };

  room.players.forEach(p => sendToSocket(p.id));
  sendToSocket(room.hostId);
};

const evaluateWinner = (code) => {
  const room = rooms[code];
  if (!room || !room.gameState || room.status === 'GAME_OVER') return;
  const state = room.gameState;

  for (const player of state.players) {
    let score = 0;
    
    Object.values(state.buildings).forEach(b => {
      if (b.owner === player.id) {
        score += b.type === 'city' ? 2 : 1;
      }
    });
    
    if (state.longestRoadOwner === player.id) score += 2;
    if (state.largestArmyOwner === player.id) score += 2;
    
    score += player.devCards.filter(c => c === 'Victory Point').length;

    if (score >= 10) {
      room.status = 'GAME_OVER';
      io.to(code).emit('game_over', { winnerId: player.id, winnerName: player.name, score });
      return;
    }
  }
};`
);

// 3. Add to gameState
content = content.replace(
  `        buildings,
        roads: {},
        devCardDeck,`,
  `        buildings,
        roads: {},
        longestRoadOwner: null,
        longestRoadLength: 4,
        largestArmyOwner: null,
        devCardDeck,`
);

// 4. game_started emit
content = content.replace(
  `io.to(code).emit('game_started', rooms[code].gameState);`,
  `broadcastState(code, 'game_started');`
);

// 5. Replace 'ROLL' and 'MAIN_ACTION'
content = content.replace(/'ROLL'/g, "'waiting_for_roll'");
content = content.replace(/'MAIN_ACTION'/g, "'main_action'");

// 6. Dice Roll emit
content = content.replace(
  `      io.to(code).emit('dice_rolled', {
        roll1, roll2, rollSum,
        gameState: state
      });`,
  `      broadcastState(code, 'dice_rolled', { roll1, roll2, rollSum });`
);

// 7. Replace all io.to(code).emit('turn_ended', { gameState: state })
content = content.replace(/io\.to\(code\)\.emit\('turn_ended', \{ gameState: state \}\);/g, `broadcastState(code, 'turn_ended');`);
// Handle one specific case where we want evaluateWinner
content = content.replace(/io\.to\(code\)\.emit\('turn_ended', \{ gameState: rooms\[code\]\.gameState \}\);/g, `broadcastState(code, 'turn_ended');`);

// 8. Add evaluateWinner to build/play actions
// Instead of complex regex, we can just append evaluateWinner(code) right before broadcastState(code, 'turn_ended') in the handlers.
// But some handlers like checkSetupTurnProgress shouldn't evaluateWinner (though it's harmless).
// Let's just insert it before broadcastState(code, 'turn_ended') globally, it's safe.
content = content.replace(/broadcastState\(code, 'turn_ended'\);/g, `evaluateWinner(code);\n      broadcastState(code, 'turn_ended');`);

// 9. Fix Longest Road in build_road
const buildRoadHook = `      state.roads[edgeId] = socket.id;

      if (isSetupPhase) {`;
const newBuildRoadHook = `      state.roads[edgeId] = socket.id;
      
      const newRoadLen = calculateLongestRoad(socket.id, state);
      if (newRoadLen > state.longestRoadLength) {
        state.longestRoadLength = newRoadLen;
        state.longestRoadOwner = socket.id;
        io.to(code).emit('game_message', { message: \`\${state.players.find(p => p.id === socket.id).name} took the Longest Road!\` });
      }

      if (isSetupPhase) {`;
content = content.replace(buildRoadHook, newBuildRoadHook);

// 10. Fix 'Knight' playable in waiting_for_roll
// In play_dev_card:
// if (state.turnPhase !== 'main_action') {
content = content.replace(
  `      if (state.turnPhase !== 'main_action') {
        socket.emit('game_error', { message: "You can only play a card during your main action phase." });
        return;
      }`,
  `      if (state.turnPhase !== 'main_action') {
        if (state.turnPhase === 'waiting_for_roll' && type === 'Knight') {
          // Allowed
        } else {
          socket.emit('game_error', { message: "You can only play this card during your main action phase." });
          return;
        }
      }`
);

fs.writeFileSync('backend/server.js', content, 'utf8');
console.log('Refactor complete.');
