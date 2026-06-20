const { io } = require('socket.io-client');

async function runTest() {
  console.log('Starting Lobby Verification Test...');
  
  // 1. Connect host
  const hostSocket = io('http://localhost:3001');
  
  let currentRoomCode = null;

  hostSocket.on('connect', () => {
    console.log('Host connected');
    hostSocket.emit('create_room');
  });

  hostSocket.on('room_created', ({ roomCode }) => {
    console.log(`Host created room: ${roomCode}`);
    currentRoomCode = roomCode;
    
    // 2. Connect player
    const playerSocket = io('http://localhost:3001');
    
    playerSocket.on('connect', () => {
      console.log('Player connected, joining room:', currentRoomCode);
      playerSocket.emit('join_room', { name: 'TestPlayer', roomCode: currentRoomCode });
    });

    playerSocket.on('join_success', () => {
      console.log('Player joined successfully!');
    });

    playerSocket.on('error', (err) => {
      console.error('Player join error:', err);
    });
  });

  hostSocket.on('player_joined', ({ players }) => {
    console.log('Host received player_joined event. Current players:', players);
    
    if (players.length === 1 && players[0].name === 'TestPlayer') {
      console.log('SUCCESS: Lobby verification passed!');
      process.exit(0);
    } else {
      console.error('FAILED: Players list incorrect');
      process.exit(1);
    }
  });

  // Timeout
  setTimeout(() => {
    console.error('FAILED: Test timed out');
    process.exit(1);
  }, 5000);
}

runTest();
