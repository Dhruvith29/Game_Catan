const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { generateBoard, distributeResources, validateSettlement, validateRoad, validateCity, getPlayerTradeRates, calculateLongestRoad } = require('./gameLogic');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

const rooms = {};

const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const shuffleDeck = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const saveSnapshot = (code) => {
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
};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('create_room', () => {
    let roomCode = generateRoomCode();
    while (rooms[roomCode]) {
      roomCode = generateRoomCode();
    }

    rooms[roomCode] = {
      hostId: socket.id,
      players: [],
      status: 'LOBBY',
      gameState: null,
      undoStack: []
    };

    socket.join(roomCode);
    console.log(`Room created: ${roomCode} by host ${socket.id}`);
    socket.emit('room_created', { roomCode });
  });

  socket.on('join_room', ({ name, roomCode }) => {
    const code = roomCode.toUpperCase();
    if (rooms[code]) {
      if (rooms[code].status !== 'LOBBY') {
        socket.emit('error', { message: 'Game already started' });
        return;
      }

      const player = { id: socket.id, name };
      rooms[code].players.push(player);
      socket.join(code);
      
      console.log(`Player ${name} joined room ${code}`);
      
      io.to(code).emit('player_joined', { players: rooms[code].players });
      socket.emit('join_success', { roomCode: code });
    } else {
      socket.emit('error', { message: 'Room not found' });
    }
  });

  socket.on('start_game', ({ roomCode }) => {
    const code = roomCode.toUpperCase();
    if (rooms[code] && rooms[code].hostId === socket.id) {
      const boardData = generateBoard();
      
      const playerOrder = rooms[code].players.map(p => p.id);
      
      const colors = ['#ef4444', '#3b82f6', '#f97316', '#f8fafc'];
      const playersArray = rooms[code].players.map((p, index) => ({
        id: p.id,
        name: p.name,
        color: colors[index % colors.length],
        inventory: [],
        devCards: [],
        tradeRates: { Wood: 4, Brick: 4, Sheep: 4, Wheat: 4, Ore: 4 }
      }));
      
      const buildings = {};

      const devCardTypes = [
        ...Array(14).fill('Knight'),
        ...Array(5).fill('Victory Point'),
        ...Array(2).fill('Road Building'),
        ...Array(2).fill('Year of Plenty'),
        ...Array(2).fill('Monopoly')
      ];
      const devCardDeck = shuffleDeck(devCardTypes);

      rooms[code].status = 'PLAYING';
      rooms[code].gameState = {
        board: boardData,
        players: playersArray,
        playerOrder,
        activePlayerIndex: 0,
        turnPhase: 'SETUP',
        setupTurnCount: 0,
        setupPhaseState: {},
        buildings,
        roads: {},
        longestRoadOwner: null,
        longestRoadLength: 4,
        largestArmyOwner: null,
        devCardDeck,
        discardingPlayers: {},
        robberVictims: [],
        hasPlayedDevCardThisTurn: false,
        roadBuildingRoadsPlaced: 0,
      };
      
      rooms[code].undoStack = [];
      
      console.log(`Game started in room ${code}`);
      broadcastState(code, 'game_started');
    }
  });

  socket.on('roll_dice', ({ roomCode }) => {
    const code = roomCode.toUpperCase();
    if (rooms[code] && rooms[code].status === 'PLAYING') {
      rooms[code].undoStack = [];
      const state = rooms[code].gameState;
      
      if (state.players[state.activePlayerIndex].id !== socket.id) return;
      if (state.turnPhase !== 'waiting_for_roll') return;

      const roll1 = Math.floor(Math.random() * 6) + 1;
      const roll2 = Math.floor(Math.random() * 6) + 1;
      const rollSum = roll1 + roll2;
      
      console.log(`Room ${code} rolled a ${rollSum}`);
      
      if (rollSum === 7) {
        state.discardingPlayers = {};
        let needsDiscard = false;
        state.players.forEach(p => {
          if (p.inventory.length > 7) {
            state.discardingPlayers[p.id] = Math.floor(p.inventory.length / 2);
            needsDiscard = true;
          }
        });
        
        if (needsDiscard) {
          state.turnPhase = 'DISCARD';
        } else {
          state.turnPhase = 'MOVE_ROBBER';
        }
      } else {
        distributeResources(rollSum, state);
        state.turnPhase = 'main_action';
      }
      
      broadcastState(code, 'dice_rolled', { roll1, roll2, rollSum });
    }
  });

  socket.on('end_turn', ({ roomCode }) => {
    const code = roomCode.toUpperCase();
    if (rooms[code] && rooms[code].status === 'PLAYING') {
      rooms[code].undoStack = [];
      const state = rooms[code].gameState;
      
      if (state.players[state.activePlayerIndex].id !== socket.id) return;
      if (state.turnPhase !== 'main_action') return;

      state.activePlayerIndex = (state.activePlayerIndex + 1) % state.players.length;
      state.turnPhase = 'waiting_for_roll';
      state.hasPlayedDevCardThisTurn = false;
      
      console.log(`Room ${code} turn ended. New active player: ${state.players[state.activePlayerIndex].name}`);
      
      evaluateWinner(code);
      broadcastState(code, 'turn_ended');
    }
  });

  function checkSetupTurnProgress(state, code) {
    const activePlayerId = state.players[state.activePlayerIndex].id;
    const pState = state.setupPhaseState[activePlayerId];
    
    evaluateWinner(code);
    broadcastState(code, 'turn_ended');
    
    if (pState && pState.settlement && pState.road) {
      pState.settlement = false;
      pState.road = false;

      const numPlayers = state.players.length;

      if (state.setupTurnCount >= numPlayers) {
        const lastNodeId = pState.lastSettlement;
        const playerObj = state.players.find(p => p.id === activePlayerId);
        
        if (lastNodeId !== undefined) {
          const adjacentHexes = state.board.hexes.filter(h => h.nodes.includes(Number(lastNodeId)));
          adjacentHexes.forEach(hex => {
            if (hex.resourceType !== 'Desert') {
              playerObj.inventory.push(hex.resourceType);
            }
          });
        }
      }

      state.setupTurnCount += 1;
      
      if (state.setupTurnCount >= numPlayers * 2) {
        state.turnPhase = 'waiting_for_roll';
        state.activePlayerIndex = 0;
      } else {
        const tc = state.setupTurnCount;
        state.activePlayerIndex = tc < numPlayers ? tc : (2 * numPlayers - 1 - tc);
      }
      
      evaluateWinner(code);
      broadcastState(code, 'turn_ended');
    }
  }

  socket.on('build_settlement', ({ roomCode, nodeId }) => {
    const code = roomCode.toUpperCase();
    if (rooms[code] && rooms[code].status === 'PLAYING') {
      const state = rooms[code].gameState;
      
      if (state.players[state.activePlayerIndex].id !== socket.id) {
        socket.emit('game_error', { message: "It's not your turn!" });
        return;
      }
      if (state.turnPhase !== 'SETUP' && state.turnPhase !== 'main_action') {
        socket.emit('game_error', { message: "You cannot build right now." });
        return;
      }

      const isSetupPhase = state.turnPhase === 'SETUP';
      
      if (isSetupPhase && state.setupPhaseState[socket.id]?.settlement) {
        socket.emit('game_error', { message: "You already placed a settlement. Now place a road." });
        return;
      }

      const validation = validateSettlement(nodeId, socket.id, state, isSetupPhase);
      
      if (!validation.valid) {
        socket.emit('game_error', { message: validation.error });
        return;
      }

      saveSnapshot(code);

      if (!isSetupPhase) {
        const playerObj = state.players.find(p => p.id === socket.id);
        ['Wood', 'Brick', 'Sheep', 'Wheat'].forEach(res => {
          playerObj.inventory.splice(playerObj.inventory.indexOf(res), 1);
        });
      }

      state.buildings[nodeId] = { owner: socket.id, type: 'settlement' };

      const playerObjForRates = state.players.find(p => p.id === socket.id);
      playerObjForRates.tradeRates = getPlayerTradeRates(socket.id, state);

      if (isSetupPhase) {
        if (!state.setupPhaseState[socket.id]) state.setupPhaseState[socket.id] = { settlement: false, road: false };
        state.setupPhaseState[socket.id].settlement = true;
        state.setupPhaseState[socket.id].lastSettlement = nodeId;
        checkSetupTurnProgress(state, code);
      } else {
        evaluateWinner(code);
      broadcastState(code, 'turn_ended');
      }
    }
  });

  socket.on('build_road', ({ roomCode, edgeId }) => {
    const code = roomCode.toUpperCase();
    if (rooms[code] && rooms[code].status === 'PLAYING') {
      const state = rooms[code].gameState;
      
      if (state.players[state.activePlayerIndex].id !== socket.id) {
        socket.emit('game_error', { message: "It's not your turn!" });
        return;
      }
      if (state.turnPhase !== 'SETUP' && state.turnPhase !== 'main_action' && state.turnPhase !== 'ROAD_BUILDING_CARD') {
        socket.emit('game_error', { message: "You cannot build right now." });
        return;
      }

      const isSetupPhase = state.turnPhase === 'SETUP';
      const isRoadBuilding = state.turnPhase === 'ROAD_BUILDING_CARD';
      
      if (isSetupPhase && !state.setupPhaseState[socket.id]?.settlement) {
        socket.emit('game_error', { message: "You must place a settlement first." });
        return;
      }

      const validation = validateRoad(edgeId, socket.id, state, isSetupPhase, isRoadBuilding);
      
      if (!validation.valid) {
        socket.emit('game_error', { message: validation.error });
        return;
      }

      saveSnapshot(code);

      if (!isSetupPhase && !isRoadBuilding) {
        const playerObj = state.players.find(p => p.id === socket.id);
        ['Wood', 'Brick'].forEach(res => {
          playerObj.inventory.splice(playerObj.inventory.indexOf(res), 1);
        });
      }

      state.roads[edgeId] = socket.id;
      
      const newRoadLen = calculateLongestRoad(socket.id, state);
      if (newRoadLen > state.longestRoadLength) {
        state.longestRoadLength = newRoadLen;
        state.longestRoadOwner = socket.id;
        io.to(code).emit('game_message', { message: `${state.players.find(p => p.id === socket.id).name} took the Longest Road!` });
      }

      if (isSetupPhase) {
        if (!state.setupPhaseState[socket.id]) state.setupPhaseState[socket.id] = { settlement: false, road: false };
        state.setupPhaseState[socket.id].road = true;
        checkSetupTurnProgress(state, code);
      } else if (isRoadBuilding) {
        state.roadBuildingRoadsPlaced = (state.roadBuildingRoadsPlaced || 0) + 1;
        if (state.roadBuildingRoadsPlaced >= 2) {
          state.turnPhase = 'main_action';
        }
        evaluateWinner(code);
      broadcastState(code, 'turn_ended');
      } else {
        evaluateWinner(code);
      broadcastState(code, 'turn_ended');
      }
    }
  });

  socket.on('propose_trade', ({ roomCode, targetId, offerResource, offerAmount, requestResource, requestAmount }) => {
    const code = roomCode.toUpperCase();
    if (rooms[code] && rooms[code].status === 'PLAYING') {
      const state = rooms[code].gameState;
      
      if (state.players[state.activePlayerIndex].id !== socket.id) {
        socket.emit('game_error', { message: "It's not your turn!" });
        return;
      }
      
      const proposer = state.players.find(p => p.id === socket.id);
      
      const proposerResCount = proposer.inventory.filter(r => r === offerResource).length;
      if (proposerResCount < offerAmount) {
        socket.emit('game_error', { message: `You don't have enough ${offerResource} to offer.` });
        return;
      }

      io.to(targetId).emit('trade_offer', {
        proposerId: socket.id,
        proposerName: proposer.name,
        offerRes: offerResource,
        offerAmt: offerAmount,
        reqRes: requestResource,
        reqAmt: requestAmount
      });
    }
  });

  socket.on('accept_trade', ({ roomCode, proposerId, offerResource, offerAmount, requestResource, requestAmount }) => {
    const code = roomCode.toUpperCase();
    if (rooms[code] && rooms[code].status === 'PLAYING') {
      rooms[code].undoStack = [];
      const state = rooms[code].gameState;
      const target = state.players.find(p => p.id === socket.id);
      const proposer = state.players.find(p => p.id === proposerId);

      const targetResCount = target.inventory.filter(r => r === requestResource).length;
      if (targetResCount < requestAmount) {
        socket.emit('game_error', { message: `You don't have enough ${requestResource} to accept.` });
        io.to(proposerId).emit('game_error', { message: `${target.name} didn't have the required resources.` });
        return;
      }

      const proposerResCount = proposer.inventory.filter(r => r === offerResource).length;
      if (proposerResCount < offerAmount) {
        socket.emit('game_error', { message: `${proposer.name} no longer has the offered resources.` });
        io.to(proposerId).emit('game_error', { message: `You no longer have enough ${offerResource} to complete the trade.` });
        return;
      }

      for (let i = 0; i < offerAmount; i++) {
        proposer.inventory.splice(proposer.inventory.indexOf(offerResource), 1);
        target.inventory.push(offerResource);
      }

      for (let i = 0; i < requestAmount; i++) {
        target.inventory.splice(target.inventory.indexOf(requestResource), 1);
        proposer.inventory.push(requestResource);
      }

      io.to(proposerId).emit('game_message', { message: `Trade accepted by ${target.name}!` });
      socket.emit('game_message', { message: "Trade complete!" });

      evaluateWinner(code);
      broadcastState(code, 'turn_ended');
    }
  });

  socket.on('reject_trade', ({ roomCode, proposerId }) => {
    const code = roomCode.toUpperCase();
    if (rooms[code]) {
      const target = rooms[code].gameState.players.find(p => p.id === socket.id);
      io.to(proposerId).emit('game_error', { message: `${target?.name || 'Player'} rejected your trade offer.` });
    }
  });

  socket.on('build_city', ({ roomCode, nodeId }) => {
    const code = roomCode.toUpperCase();
    if (rooms[code] && rooms[code].status === 'PLAYING') {
      const state = rooms[code].gameState;
      
      if (state.players[state.activePlayerIndex].id !== socket.id) {
        socket.emit('game_error', { message: "It's not your turn!" });
        return;
      }
      if (state.turnPhase !== 'main_action') {
        socket.emit('game_error', { message: "You cannot build right now." });
        return;
      }

      const validation = validateCity(nodeId, socket.id, state);
      if (!validation.valid) {
        socket.emit('game_error', { message: validation.error });
        return;
      }

      saveSnapshot(code);

      const playerObj = state.players.find(p => p.id === socket.id);
      ['Ore', 'Ore', 'Ore', 'Wheat', 'Wheat'].forEach(res => {
        playerObj.inventory.splice(playerObj.inventory.indexOf(res), 1);
      });

      state.buildings[nodeId].type = 'city';

      const playerObjForRates = state.players.find(p => p.id === socket.id);
      playerObjForRates.tradeRates = getPlayerTradeRates(socket.id, state);

      evaluateWinner(code);
      broadcastState(code, 'turn_ended');
    }
  });

  socket.on('buy_dev_card', ({ roomCode }) => {
    const code = roomCode.toUpperCase();
    if (rooms[code] && rooms[code].status === 'PLAYING') {
      rooms[code].undoStack = [];
      const state = rooms[code].gameState;
      
      if (state.players[state.activePlayerIndex].id !== socket.id) {
        socket.emit('game_error', { message: "It's not your turn!" });
        return;
      }
      if (state.turnPhase !== 'main_action') {
        socket.emit('game_error', { message: "You cannot buy right now." });
        return;
      }

      if (state.devCardDeck.length === 0) {
        socket.emit('game_error', { message: "The Development Card deck is empty." });
        return;
      }

      const playerObj = state.players.find(p => p.id === socket.id);
      const inv = playerObj.inventory;
      const required = ['Sheep', 'Wheat', 'Ore'];
      const tempInv = [...inv];
      for (const req of required) {
        const idx = tempInv.indexOf(req);
        if (idx === -1) {
          socket.emit('game_error', { message: "Insufficient resources: Need 1 Sheep, 1 Wheat, 1 Ore." });
          return;
        }
        tempInv.splice(idx, 1);
      }

      required.forEach(res => {
        playerObj.inventory.splice(playerObj.inventory.indexOf(res), 1);
      });

      const card = state.devCardDeck.pop();
      playerObj.devCards.push(card);
      evaluateWinner(code);
      broadcastState(code, 'turn_ended');
      socket.emit('game_message', { message: `You bought a ${card} card!` });
    }
  });

  socket.on('play_dev_card', ({ roomCode, type, resource1, resource2 }) => {
    const code = roomCode.toUpperCase();
    if (rooms[code] && rooms[code].status === 'PLAYING') {
      rooms[code].undoStack = [];
      const state = rooms[code].gameState;
      
      if (state.players[state.activePlayerIndex].id !== socket.id) return;
      if (state.turnPhase !== 'main_action') {
        if (state.turnPhase === 'waiting_for_roll' && type === 'Knight') {
          // Allowed
        } else {
          socket.emit('game_error', { message: "You can only play this card during your main action phase." });
          return;
        }
      }
      if (state.hasPlayedDevCardThisTurn) {
        socket.emit('game_error', { message: "You have already played a Development Card this turn." });
        return;
      }

      const playerObj = state.players.find(p => p.id === socket.id);
      const cardIdx = playerObj.devCards.indexOf(type);
      if (cardIdx === -1) {
        socket.emit('game_error', { message: "You don't have that card." });
        return;
      }

      playerObj.devCards.splice(cardIdx, 1);
      state.hasPlayedDevCardThisTurn = true;
      socket.emit('game_message', { message: `You played ${type}!` });

      if (type === 'Knight') {
        state.turnPhase = 'MOVE_ROBBER';
      } else if (type === 'Year of Plenty') {
        playerObj.inventory.push(resource1);
        playerObj.inventory.push(resource2);
      } else if (type === 'Monopoly') {
        let stolenCount = 0;
        state.players.forEach(p => {
          if (p.id !== socket.id) {
            const count = p.inventory.filter(r => r === resource1).length;
            stolenCount += count;
            p.inventory = p.inventory.filter(r => r !== resource1);
          }
        });
        for (let i = 0; i < stolenCount; i++) {
          playerObj.inventory.push(resource1);
        }
        io.to(code).emit('game_message', { message: `${playerObj.name} used Monopoly on ${resource1} and stole ${stolenCount} cards!` });
      } else if (type === 'Road Building') {
        state.turnPhase = 'ROAD_BUILDING_CARD';
        state.roadBuildingRoadsPlaced = 0;
      }

      evaluateWinner(code);
      broadcastState(code, 'turn_ended');
    }
  });

  socket.on('submit_discard', ({ roomCode, discardedResources }) => {
    const code = roomCode.toUpperCase();
    if (rooms[code] && rooms[code].status === 'PLAYING') {
      const state = rooms[code].gameState;
      if (state.turnPhase !== 'DISCARD') return;

      const requiredAmount = state.discardingPlayers[socket.id];
      if (!requiredAmount) return;
      if (discardedResources.length !== requiredAmount) {
        socket.emit('game_error', { message: `You must discard exactly ${requiredAmount} cards.` });
        return;
      }

      const playerObj = state.players.find(p => p.id === socket.id);
      
      const tempInv = [...playerObj.inventory];
      let valid = true;
      for (const res of discardedResources) {
        const idx = tempInv.indexOf(res);
        if (idx === -1) {
          valid = false;
          break;
        }
        tempInv.splice(idx, 1);
      }
      
      if (!valid) {
        socket.emit('game_error', { message: "Invalid discard selection." });
        return;
      }
      
      playerObj.inventory = tempInv;
      delete state.discardingPlayers[socket.id];
      
      if (Object.keys(state.discardingPlayers).length === 0) {
        state.turnPhase = 'MOVE_ROBBER';
      }
      
      evaluateWinner(code);
      broadcastState(code, 'turn_ended');
    }
  });

  socket.on('move_robber', ({ roomCode, hexId }) => {
    const code = roomCode.toUpperCase();
    if (rooms[code] && rooms[code].status === 'PLAYING') {
      const state = rooms[code].gameState;
      
      if (state.players[state.activePlayerIndex].id !== socket.id) return;
      if (state.turnPhase !== 'MOVE_ROBBER') return;
      
      const hex = state.board.hexes[hexId];
      if (!hex) {
        socket.emit('game_error', { message: "Invalid Hex ID." });
        return;
      }
      
      if (state.board.robberLocation && state.board.robberLocation.q === hex.q && state.board.robberLocation.r === hex.r) {
        socket.emit('game_error', { message: "Robber must be moved to a different hex." });
        return;
      }
      
      state.board.robberLocation = { q: hex.q, r: hex.r };
      
      const victims = new Set();
      hex.nodes.forEach(n => {
        const building = state.buildings[n];
        if (building && building.owner !== socket.id) {
          victims.add(building.owner);
        }
      });
      
      state.robberVictims = Array.from(victims);
      
      if (state.robberVictims.length > 0) {
        state.turnPhase = 'STEAL_CARD';
      } else {
        state.turnPhase = 'main_action';
      }
      
      evaluateWinner(code);
      broadcastState(code, 'turn_ended');
    }
  });

  socket.on('steal_card', ({ roomCode, victimId }) => {
    const code = roomCode.toUpperCase();
    if (rooms[code] && rooms[code].status === 'PLAYING') {
      const state = rooms[code].gameState;
      
      if (state.players[state.activePlayerIndex].id !== socket.id) return;
      if (state.turnPhase !== 'STEAL_CARD') return;
      if (!state.robberVictims.includes(victimId)) {
        socket.emit('game_error', { message: "Invalid victim." });
        return;
      }
      
      const victim = state.players.find(p => p.id === victimId);
      const activePlayer = state.players.find(p => p.id === socket.id);
      
      if (victim.inventory.length > 0) {
        const randIdx = Math.floor(Math.random() * victim.inventory.length);
        const stolenRes = victim.inventory.splice(randIdx, 1)[0];
        activePlayer.inventory.push(stolenRes);
        socket.emit('game_message', { message: `You stole 1 ${stolenRes} from ${victim.name}!` });
        io.to(victimId).emit('game_message', { message: `${activePlayer.name} stole 1 ${stolenRes} from you!` });
      } else {
        socket.emit('game_message', { message: `${victim.name} has no cards to steal.` });
      }
      
      state.robberVictims = [];
      state.turnPhase = 'main_action';
      evaluateWinner(code);
      broadcastState(code, 'turn_ended');
    }
  });

  socket.on('maritime_trade', ({ roomCode, giveResource, getResource }) => {
    const code = roomCode.toUpperCase();
    if (rooms[code] && rooms[code].status === 'PLAYING') {
      const state = rooms[code].gameState;
      
      if (state.players[state.activePlayerIndex].id !== socket.id) {
        socket.emit('game_error', { message: "It's not your turn!" });
        return;
      }
      if (state.turnPhase !== 'main_action') {
        socket.emit('game_error', { message: "You cannot trade right now." });
        return;
      }
      
      const playerObj = state.players.find(p => p.id === socket.id);
      const rate = playerObj.tradeRates[giveResource];
      
      const resCount = playerObj.inventory.filter(r => r === giveResource).length;
      if (resCount < rate) {
        socket.emit('game_error', { message: `You need ${rate} ${giveResource} to trade.` });
        return;
      }

      saveSnapshot(code);

      for (let i = 0; i < rate; i++) {
        playerObj.inventory.splice(playerObj.inventory.indexOf(giveResource), 1);
      }
      playerObj.inventory.push(getResource);
      
      let usedPortIndex = -1;
      const playerNodes = new Set();
      Object.keys(state.buildings).forEach(nodeId => {
        if (state.buildings[nodeId].owner === socket.id) {
          playerNodes.add(Number(nodeId));
        }
      });
      state.board.ports.forEach((port, index) => {
        const isConnected = port.connectedNodes.some(n => playerNodes.has(n));
        if (isConnected) {
          if (rate === 2 && port.tradeType === `2:1 ${giveResource}`) {
            usedPortIndex = index;
          } else if (rate === 3 && usedPortIndex === -1 && port.tradeType === '3:1') {
            usedPortIndex = index;
          }
        }
      });

      io.to(code).emit('game_message', { message: `${playerObj.name} traded ${rate} ${giveResource} for 1 ${getResource}!` });
      if (usedPortIndex !== -1) {
        io.to(code).emit('port_used', { portIndex: usedPortIndex });
      }

      evaluateWinner(code);
      broadcastState(code, 'turn_ended');
    }
  });

  socket.on('undo_last_action', ({ roomCode }) => {
    const code = roomCode.toUpperCase();
    if (rooms[code] && rooms[code].status === 'PLAYING') {
      const state = rooms[code].gameState;
      if (state.players[state.activePlayerIndex].id !== socket.id) {
        socket.emit('game_error', { message: "It's not your turn!" });
        return;
      }
      if (rooms[code].undoStack && rooms[code].undoStack.length > 0) {
        rooms[code].gameState = rooms[code].undoStack.pop();
        evaluateWinner(code);
      broadcastState(code, 'turn_ended');
        socket.emit('game_message', { message: "Action Undone." });
      } else {
        socket.emit('game_error', { message: "Nothing to undo." });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
