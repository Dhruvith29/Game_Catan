const { generateBoard, areAdjacent } = require('./gameLogic');

function runTests() {
  const ITERATIONS = 1000; // Increased iterations for robustness
  console.log(`Running ${ITERATIONS} board generation tests...`);
  
  for (let k = 0; k < ITERATIONS; k++) {
    const { hexes, robberLocation } = generateBoard();
    
    // Check 19 hexes
    if (hexes.length !== 19) {
      console.error(`Test ${k} FAILED: Hex count is ${hexes.length}`);
      process.exit(1);
    }
    
    // Check Desert count
    const deserts = hexes.filter(h => h.resourceType === 'Desert');
    if (deserts.length !== 1) {
      console.error(`Test ${k} FAILED: Found ${deserts.length} deserts`);
      process.exit(1);
    }
    
    // Check Desert is perfectly centered (0,0)
    if (deserts[0].q !== 0 || deserts[0].r !== 0) {
      console.error(`Test ${k} FAILED: Desert is not at (0,0)`);
      process.exit(1);
    }
    
    if (deserts[0].q !== robberLocation.q || deserts[0].r !== robberLocation.r) {
      console.error(`Test ${k} FAILED: Robber location mismatch`);
      process.exit(1);
    }

    // Check 6/8 adjacency
    const highYields = hexes.filter(h => h.numberToken === 6 || h.numberToken === 8);
    if (highYields.length !== 4) {
      console.error(`Test ${k} FAILED: Expected 4 high yield tokens, got ${highYields.length}`);
      process.exit(1);
    }

    for (let i = 0; i < highYields.length; i++) {
      for (let j = i + 1; j < highYields.length; j++) {
        if (areAdjacent(highYields[i], highYields[j])) {
          console.error(`Test ${k} FAILED: 6 and 8 are adjacent at (${highYields[i].q},${highYields[i].r}) and (${highYields[j].q},${highYields[j].r})`);
          process.exit(1);
        }
      }
    }
  }
  
  console.log('SUCCESS: All board generation constraints passed!');
}

runTests();
