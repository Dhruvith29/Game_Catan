const NON_DESERT_RESOURCES = [
  ...Array(4).fill('Wood'),
  ...Array(3).fill('Brick'),
  ...Array(4).fill('Sheep'),
  ...Array(4).fill('Wheat'),
  ...Array(3).fill('Ore'),
];

const TOKENS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
const PORTS = ['3:1', '3:1', '3:1', '3:1', '2:1 Wood', '2:1 Brick', '2:1 Sheep', '2:1 Wheat', '2:1 Ore'];

function getHexCoordinates() {
  const coords = [];
  for (let q = -2; q <= 2; q++) {
    for (let r = -2; r <= 2; r++) {
      if (Math.abs(-q - r) <= 2) {
        coords.push({ q, r });
      }
    }
  }
  return coords;
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getVerticesForHex(q, r, R, nodeMap, nodesLookup) {
  const SQRT3 = Math.sqrt(3);
  const cx = R * SQRT3 * (q + r / 2);
  const cy = R * 1.5 * r;
  
  const offsets = [
    { dx: 0, dy: -R },
    { dx: (SQRT3 / 2) * R, dy: -R / 2 },
    { dx: (SQRT3 / 2) * R, dy: R / 2 },
    { dx: 0, dy: R },
    { dx: -(SQRT3 / 2) * R, dy: R / 2 },
    { dx: -(SQRT3 / 2) * R, dy: -R / 2 },
  ];

  const nodeIds = [];
  for (const offset of offsets) {
    let vx = cx + offset.dx;
    let vy = cy + offset.dy;
    if (Math.abs(vx) < 0.001) vx = 0;
    if (Math.abs(vy) < 0.001) vy = 0;
    
    const key = `${vx.toFixed(2)},${vy.toFixed(2)}`;
    if (!nodeMap.has(key)) {
      const id = nodeMap.size;
      nodeMap.set(key, id);
      nodesLookup[id] = { x: vx, y: vy };
    }
    nodeIds.push(nodeMap.get(key));
  }
  return nodeIds;
}

function generateBoard() {
  const coords = getHexCoordinates();
  
  let isValid = false;
  let hexes = [];
  const robberLocation = { q: 0, r: 0 };
  const nodeMap = new Map();
  const nodesLookup = {};
  const R = 48; // Hex radius matches frontend

  while (!isValid) {
    const ALL_RESOURCES = [...NON_DESERT_RESOURCES, 'Desert'];
    const shuffledResources = shuffle(ALL_RESOURCES);
    const shuffledTokens = shuffle(TOKENS);
    nodeMap.clear();
    for (const key in nodesLookup) delete nodesLookup[key];

    hexes = new Array(19);

    for (let i = 0; i < 19; i++) {
      const coord = coords[i];
      const res = shuffledResources.pop();
      const num = res === 'Desert' ? null : shuffledTokens.pop();
      
      if (res === 'Desert') {
        robberLocation.q = coord.q;
        robberLocation.r = coord.r;
      }
      
      hexes[i] = {
        q: coord.q,
        r: coord.r,
        resourceType: res,
        numberToken: num,
        nodes: getVerticesForHex(coord.q, coord.r, R, nodeMap, nodesLookup)
      };
    }

    // 3. Strict 6/8 Validation Check using Node Graph adjacency
    const highYieldHexes = hexes.filter(h => h.numberToken === 6 || h.numberToken === 8);
    let violationFound = false;

    for (let i = 0; i < highYieldHexes.length; i++) {
      for (let j = i + 1; j < highYieldHexes.length; j++) {
        const hexA = highYieldHexes[i];
        const hexB = highYieldHexes[j];
        
        // Two hexes share an edge if they share EXACTLY 2 vertex nodes
        const sharedNodes = hexA.nodes.filter(n => hexB.nodes.includes(n));
        if (sharedNodes.length >= 2) {
          violationFound = true;
          break;
        }
      }
      if (violationFound) break;
    }

    if (!violationFound) {
      isValid = true;
    }
  }

  // Coastline Algorithm
  const edgeCounts = {};
  const edgesMap = new Map();
  const nodeAdjacency = {};
  
  for (let i = 0; i < nodeMap.size; i++) {
    nodeAdjacency[i] = new Set();
  }

  hexes.forEach(hex => {
    for (let i = 0; i < 6; i++) {
      const n1 = hex.nodes[i];
      const n2 = hex.nodes[(i + 1) % 6];
      const key = Math.min(n1, n2) + '-' + Math.max(n1, n2);
      
      if (!edgeCounts[key]) edgeCounts[key] = { count: 0, nodes: [n1, n2] };
      edgeCounts[key].count++;

      nodeAdjacency[n1].add(n2);
      nodeAdjacency[n2].add(n1);

      if (!edgesMap.has(key)) {
        edgesMap.set(key, { id: edgesMap.size, nodes: [Math.min(n1, n2), Math.max(n1, n2)] });
      }
    }
  });

  const edges = Array.from(edgesMap.values());
  for (const key in nodeAdjacency) {
    nodeAdjacency[key] = Array.from(nodeAdjacency[key]);
  }

  const outerEdges = Object.values(edgeCounts)
    .filter(e => e.count === 1)
    .map(e => {
      const p1 = nodesLookup[e.nodes[0]];
      const p2 = nodesLookup[e.nodes[1]];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const angle = Math.atan2(midY, midX);
      return { ...e, angle };
    });

  outerEdges.sort((a, b) => a.angle - b.angle);

  const shuffledPorts = shuffle(PORTS);
  const selectedPorts = [];
  
  for (let i = 0; i < 9; i++) {
    const edgeIndex = Math.floor(i * outerEdges.length / 9);
    const edge = outerEdges[edgeIndex];
    selectedPorts.push({
      tradeType: shuffledPorts[i],
      connectedNodes: edge.nodes
    });
  }

  return {
    hexes,
    ports: selectedPorts,
    robberLocation,
    nodeCount: nodeMap.size,
    nodesLookup,
    edges,
    nodeAdjacency
  };
}

function rollDice() {
  return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
}

function distributeResources(rollSum, gameState) {
  if (rollSum === 7) return;

  const { hexes } = gameState.board;
  const matchingHexes = hexes.filter(h => h.numberToken === rollSum);

  matchingHexes.forEach(hex => {
    hex.nodes.forEach(nodeId => {
      const building = gameState.buildings[nodeId];
      if (building) {
        const ownerId = building.owner;
        const amount = building.type === 'city' ? 2 : 1;
        
        const playerObj = gameState.players.find(p => p.id === ownerId);
        if (playerObj) {
          for (let i = 0; i < amount; i++) {
            playerObj.inventory.push(hex.resourceType);
          }
        }
      }
    });
  });
}

function validateSettlement(nodeId, playerId, gameState, isSetupPhase) {
  const { nodeAdjacency, edges } = gameState.board;
  
  if (nodeId === undefined || nodeId === null || Number.isNaN(nodeId)) return { valid: false, error: "Invalid node" };
  if (gameState.buildings[nodeId]) return { valid: false, error: "Node already occupied" };
  if (!nodeAdjacency[nodeId]) return { valid: false, error: "Node does not exist" };

  const adjacentNodes = nodeAdjacency[nodeId];
  for (const adj of adjacentNodes) {
    if (gameState.buildings[adj]) {
      return { valid: false, error: "Distance Rule violation: adjacent building exists." };
    }
  }

  if (!isSetupPhase) {
    const playerRoads = Object.keys(gameState.roads).filter(eId => gameState.roads[eId] === playerId);
    const connectedToRoad = playerRoads.some(eId => edges[eId].nodes.includes(nodeId));
    if (!connectedToRoad) {
      return { valid: false, error: "Must connect to your road." };
    }

    const playerObj = gameState.players.find(p => p.id === playerId);
    const inv = playerObj.inventory;
    const required = ['Wood', 'Brick', 'Sheep', 'Wheat'];
    const tempInv = [...inv];
    for (const req of required) {
      const idx = tempInv.indexOf(req);
      if (idx === -1) return { valid: false, error: "Insufficient resources: Need Wood, Brick, Sheep, Wheat." };
      tempInv.splice(idx, 1);
    }
  }

  return { valid: true };
}

function validateRoad(edgeId, playerId, gameState, isSetupPhase, isFree = false) {
  const { edges } = gameState.board;
  const edge = edges[edgeId];
  
  if (edgeId === undefined || edgeId === null || Number.isNaN(edgeId)) return { valid: false, error: "Invalid edge" };
  if (!edge) return { valid: false, error: "Edge does not exist" };
  if (gameState.roads[edgeId]) return { valid: false, error: "Edge already occupied" };

  const [n1, n2] = edge.nodes;

  let isConnected = false;
  
  if (isSetupPhase) {
    const pState = gameState.setupPhaseState && gameState.setupPhaseState[playerId];
    if (pState && pState.lastSettlement !== undefined) {
      if (n1 === pState.lastSettlement || n2 === pState.lastSettlement) {
        isConnected = true;
      }
    }
  } else {
    if (gameState.buildings[n1]?.owner === playerId || gameState.buildings[n2]?.owner === playerId) {
      isConnected = true;
    }
    
    if (!isConnected) {
      const playerRoads = Object.keys(gameState.roads).filter(eId => gameState.roads[eId] === playerId);
      isConnected = playerRoads.some(eId => {
        const otherNodes = edges[eId].nodes;
        return otherNodes.includes(n1) || otherNodes.includes(n2);
      });
    }
  }
  
  if (!isConnected) {
    return { valid: false, error: isSetupPhase ? "Road must connect to your newly placed settlement." : "Must connect to your settlement or road." };
  }

  if (!isSetupPhase && !isFree) {
    const playerObj = gameState.players.find(p => p.id === playerId);
    const inv = playerObj.inventory;
    const required = ['Wood', 'Brick'];
    const tempInv = [...inv];
    for (const req of required) {
      const idx = tempInv.indexOf(req);
      if (idx === -1) return { valid: false, error: "Insufficient resources: Need Wood and Brick." };
      tempInv.splice(idx, 1);
    }
  }

  return { valid: true };
}

function validateCity(nodeId, playerId, gameState) {
  const building = gameState.buildings[nodeId];
  
  if (nodeId === undefined || nodeId === null || Number.isNaN(nodeId)) return { valid: false, error: "Invalid node" };
  if (!building) return { valid: false, error: "No building at this node." };
  if (building.owner !== playerId) return { valid: false, error: "You don't own this building." };
  if (building.type === 'city') return { valid: false, error: "This building is already a city." };

  const playerObj = gameState.players.find(p => p.id === playerId);
  const inv = playerObj.inventory;
  const required = ['Ore', 'Ore', 'Ore', 'Wheat', 'Wheat'];
  const tempInv = [...inv];
  for (const req of required) {
    const idx = tempInv.indexOf(req);
    if (idx === -1) return { valid: false, error: "Insufficient resources: Need 3 Ore and 2 Wheat." };
    tempInv.splice(idx, 1);
  }

  return { valid: true };
}

function getPlayerTradeRates(playerId, gameState) {
  const rates = { Wood: 4, Brick: 4, Sheep: 4, Wheat: 4, Ore: 4 };
  let hasGenericPort = false;

  const playerNodes = new Set();
  Object.keys(gameState.buildings).forEach(nodeId => {
    if (gameState.buildings[nodeId].owner === playerId) {
      playerNodes.add(Number(nodeId));
    }
  });

  gameState.board.ports.forEach((port) => {
    const isConnected = port.connectedNodes.some(n => playerNodes.has(n));
    if (isConnected) {
      if (port.tradeType === '3:1') {
        hasGenericPort = true;
      } else if (port.tradeType.startsWith('2:1')) {
        const res = port.tradeType.split(' ')[1];
        if (rates[res]) rates[res] = 2;
      }
    }
  });

  if (hasGenericPort) {
    Object.keys(rates).forEach(res => {
      if (rates[res] > 3) rates[res] = 3;
    });
  }

  return rates;
}

function calculateLongestRoad(playerId, gameState) {
  const { edges } = gameState.board;
  const globalRoads = gameState.roads;
  const buildings = gameState.buildings;
  
  const playerEdges = [];
  for (const edgeId in globalRoads) {
    if (globalRoads[edgeId] === playerId) {
      playerEdges.push(Number(edgeId));
    }
  }

  if (playerEdges.length === 0) return 0;

  let maxLength = 0;
  const playerNetwork = {};
  
  playerEdges.forEach(eId => {
    const edge = edges[eId];
    if (!edge) return;
    const [n1, n2] = edge.nodes;
    if (!playerNetwork[n1]) playerNetwork[n1] = [];
    if (!playerNetwork[n2]) playerNetwork[n2] = [];
    playerNetwork[n1].push(eId);
    playerNetwork[n2].push(eId);
  });

  function dfs(currentNode, visitedEdges) {
    maxLength = Math.max(maxLength, visitedEdges.size);

    const building = buildings[currentNode];
    if (building && building.owner !== playerId) {
      return; 
    }

    const adjacentEdges = playerNetwork[currentNode] || [];
    for (const eId of adjacentEdges) {
      if (!visitedEdges.has(eId)) {
        visitedEdges.add(eId);
        const edge = edges[eId];
        const nextNode = edge.nodes[0] === currentNode ? edge.nodes[1] : edge.nodes[0];
        
        dfs(nextNode, visitedEdges);
        
        visitedEdges.delete(eId);
      }
    }
  }

  for (const startNode in playerNetwork) {
    dfs(Number(startNode), new Set());
  }

  return maxLength;
}

module.exports = {
  generateBoard,
  rollDice,
  distributeResources,
  validateSettlement,
  validateRoad,
  validateCity,
  getPlayerTradeRates,
  calculateLongestRoad
};
