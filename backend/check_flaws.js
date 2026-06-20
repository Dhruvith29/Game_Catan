const { generateBoard, areAdjacent } = require('./gameLogic');

function run() {
  let flaws = 0;
  for (let i = 0; i < 10000; i++) {
    const board = generateBoard();
    const desert = board.hexes.find(h => h.resourceType === 'Desert');
    if (desert.q !== 0 || desert.r !== 0) {
      console.log(`FLAW: Desert at ${desert.q}, ${desert.r}`);
      flaws++;
    }

    const highs = board.hexes.filter(h => h.numberToken === 6 || h.numberToken === 8);
    let violation = false;
    for (let a = 0; a < highs.length; a++) {
      for (let b = a + 1; b < highs.length; b++) {
        if (areAdjacent(highs[a], highs[b])) {
          violation = true;
        }
      }
    }
    if (violation) {
      console.log("FLAW: Adjacency violation");
      flaws++;
    }
  }
  console.log(`Total flaws found: ${flaws}`);
}

run();
