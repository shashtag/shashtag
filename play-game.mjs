import fs from 'fs';
import { execSync } from 'child_process';

const stateFile = 'game-state.json';
const readmeFile = 'README.md';

// Helper to read state
function readState() {
  if (!fs.existsSync(stateFile)) {
    return {
      board: [" ", " ", " ", " ", " ", " ", " ", " ", " "],
      status: "PLAYING",
      winner: null
    };
  }
  return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
}

// Helper to write state
function writeState(state) {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

// Check for winner
function checkWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];
  for (let line of lines) {
    const [a, b, c] = line;
    if (board[a] !== " " && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (!board.includes(" ")) return "TIE";
  return null;
}

// Bot move (heuristic / random fallback)
function getBotMove(board) {
  // 1. Can bot win in next move?
  for (let i = 0; i < 9; i++) {
    if (board[i] === " ") {
      const copy = [...board];
      copy[i] = "O";
      if (checkWinner(copy) === "O") return i;
    }
  }
  // 2. Can player win in next move? Block them.
  for (let i = 0; i < 9; i++) {
    if (board[i] === " ") {
      const copy = [...board];
      copy[i] = "X";
      if (checkWinner(copy) === "X") return i;
    }
  }
  // 3. Take center if available
  if (board[4] === " ") return 4;
  // 4. Take corners
  const corners = [0, 2, 6, 8].filter(i => board[i] === " ");
  if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];
  // 5. Take whatever is left
  const empty = board.map((val, idx) => val === " " ? idx : null).filter(val => val !== null);
  return empty[Math.floor(Math.random() * empty.length)];
}

// Main execution
function main() {
  const issueTitle = process.env.ISSUE_TITLE || "";
  const issueUser = process.env.ISSUE_USER || "player";
  
  console.log(`Processing issue title: "${issueTitle}" from user: ${issueUser}`);
  
  let state = readState();
  
  // Parse command
  if (issueTitle.startsWith("ttt|reset")) {
    state = {
      board: [" ", " ", " ", " ", " ", " ", " ", " ", " "],
      status: "PLAYING",
      winner: null
    };
    writeState(state);
    updateReadme(state, issueUser);
    console.log("Game reset successfully!");
    return;
  }
  
  if (!issueTitle.startsWith("ttt|play|")) {
    console.log("Invalid issue title format.");
    return;
  }
  
  if (state.status !== "PLAYING") {
    console.log("Game is not active. Reset is required.");
    return;
  }
  
  const playerMove = parseInt(issueTitle.split("|")[2], 10);
  if (isNaN(playerMove) || playerMove < 0 || playerMove > 8 || state.board[playerMove] !== " ") {
    console.log("Invalid or occupied space.");
    return;
  }
  
  // Make Player Move
  state.board[playerMove] = "X";
  let winner = checkWinner(state.board);
  
  if (winner) {
    state.winner = winner;
    state.status = winner === "TIE" ? "TIE" : "X_WON";
  } else {
    // Make Bot Move
    const botMove = getBotMove(state.board);
    if (botMove !== undefined) {
      state.board[botMove] = "O";
      winner = checkWinner(state.board);
      if (winner) {
        state.winner = winner;
        state.status = winner === "TIE" ? "TIE" : "O_WON";
      }
    }
  }
  
  writeState(state);
  updateReadme(state, issueUser);
  console.log("Move processed successfully!");
}

// Render the grid cell
function getCell(board, idx) {
  const val = board[idx];
  if (val === "X") return "❌";
  if (val === "O") return "⭕";
  
  // link to play this space
  const title = encodeURIComponent(`ttt|play|${idx}`);
  const body = encodeURIComponent(`Playing square ${idx + 1}. Please submit this issue to register your move.`);
  return `[🟦](https://github.com/shashtag/shashtag/issues/new?title=${title}&body=${body})`;
}

// Update the README file
function updateReadme(state, lastPlayer) {
  let readme = fs.readFileSync(readmeFile, 'utf8');
  
  // Generate game board HTML table
  const b = state.board;
  let boardHtml = `
<table align="center">
  <tr>
    <td align="center" width="60" height="60">${getCell(b, 0)}</td>
    <td align="center" width="60" height="60">${getCell(b, 1)}</td>
    <td align="center" width="60" height="60">${getCell(b, 2)}</td>
  </tr>
  <tr>
    <td align="center" width="60" height="60">${getCell(b, 3)}</td>
    <td align="center" width="60" height="60">${getCell(b, 4)}</td>
    <td align="center" width="60" height="60">${getCell(b, 5)}</td>
  </tr>
  <tr>
    <td align="center" width="60" height="60">${getCell(b, 6)}</td>
    <td align="center" width="60" height="60">${getCell(b, 7)}</td>
    <td align="center" width="60" height="60">${getCell(b, 8)}</td>
  </tr>
</table>
`;

  let statusMsg = "";
  if (state.status === "PLAYING") {
    statusMsg = `🎮 **Active Game!** Last move by @${lastPlayer}. Click any blue square above to make your move!`;
  } else if (state.status === "X_WON") {
    statusMsg = `🎉 **You won!** Congratulations @${lastPlayer}! Click [here](https://github.com/shashtag/shashtag/issues/new?title=ttt%7Creset&body=Resetting+board+for+a+new+game.) to play again.`;
  } else if (state.status === "O_WON") {
    statusMsg = `🤖 **AI won!** Better luck next time. Click [here](https://github.com/shashtag/shashtag/issues/new?title=ttt%7Creset&body=Resetting+board+for+a+new+game.) to play again.`;
  } else if (state.status === "TIE") {
    statusMsg = `🤝 **It's a tie!** Great game. Click [here](https://github.com/shashtag/shashtag/issues/new?title=ttt%7Creset&body=Resetting+board+for+a+new+game.) to play again.`;
  }

  const gameSection = `<!-- GAME_START -->
<div align="center">

${boardHtml}

${statusMsg}

</div>
<!-- GAME_END -->`;

  // Replace game section in README
  const regex = /<!-- GAME_START -->[\s\S]*<!-- GAME_END -->/g;
  if (regex.test(readme)) {
    readme = readme.replace(regex, gameSection);
  } else {
    // Append to bottom if section doesn't exist
    readme += `\n\n${gameSection}`;
  }
  
  fs.writeFileSync(readmeFile, readme);
}

main();
