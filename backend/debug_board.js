const { generateBoard } = require('./gameLogic');
const board = generateBoard();

console.log("Desert Hex:");
const desert = board.hexes.find(h => h.resourceType === 'Desert');
console.log(desert);

console.log("\nHigh Yield Hexes:");
const highYields = board.hexes.filter(h => h.numberToken === 6 || h.numberToken === 8);
highYields.forEach(h => console.log(`Token ${h.numberToken} at q:${h.q}, r:${h.r}`));

console.log("\nPorts:");
console.log(board.ports);

console.log("\nNodesLookup Sample:");
console.log(Object.keys(board.nodesLookup).slice(0, 5).map(k => `${k}: ${JSON.stringify(board.nodesLookup[k])}`));
