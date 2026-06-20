const { generateBoard, distributeResources } = require('./gameLogic');

function runTest() {
  console.log('Running Resource Distribution Test...');
  
  const boardData = generateBoard();
  if (boardData.nodeCount !== 54) {
    console.error(`FAILED: Expected 54 nodes, got ${boardData.nodeCount}`);
    process.exit(1);
  }
  
  const gameState = {
    board: boardData,
    players: {
      'player1': { name: 'Alice', inventory: [] }
    },
    buildings: {}
  };

  // Find a Wood hex with a 6 token
  const woodHex = boardData.hexes.find(h => h.resourceType === 'Wood' && h.numberToken === 6);
  if (!woodHex) {
    console.log('No Wood hex with 6 found on this random board. That is okay, finding any non-desert hex...');
    // Fallback if random board doesn't have 6 Wood. Just find any hex that is not desert.
  }
  
  const targetHex = woodHex || boardData.hexes.find(h => h.resourceType !== 'Desert');
  const targetRoll = targetHex.numberToken;
  const targetResource = targetHex.resourceType;
  
  // Hardcode 2 settlements on its first two nodes
  gameState.buildings[targetHex.nodes[0]] = { owner: 'player1', type: 'settlement' };
  gameState.buildings[targetHex.nodes[1]] = { owner: 'player1', type: 'settlement' };
  
  console.log(`Setup: Player has 2 settlements on nodes ${targetHex.nodes[0]} and ${targetHex.nodes[1]}.`);
  console.log(`These nodes belong to a ${targetResource} hex with token ${targetRoll}.`);
  
  // Distribute for that specific roll
  console.log(`Rolling a ${targetRoll}...`);
  distributeResources(targetRoll, gameState);
  
  const inventory = gameState.players['player1'].inventory;
  console.log(`Player inventory after roll: [${inventory.join(', ')}]`);
  
  const expectedCount = 2; // 2 settlements = 2 resources
  const actualCount = inventory.filter(r => r === targetResource).length;
  
  if (actualCount === expectedCount) {
    console.log(`SUCCESS: Player received exactly ${expectedCount} ${targetResource}!`);
  } else {
    console.error(`FAILED: Player should have ${expectedCount} ${targetResource}, but has ${actualCount}`);
    process.exit(1);
  }
}

runTest();
