import { Player, Position, Move, Jump, PieceData } from './types';

export const EMPTY = 0;
export const WHITE = 1;
export const BLACK = 2;
export const WHITE_KING = 3;
export const BLACK_KING = 4;

export const isWhite = (val: number) => val === WHITE || val === WHITE_KING;
export const isBlack = (val: number) => val === BLACK || val === BLACK_KING;
export const isKing = (val: number) => val === WHITE_KING || val === BLACK_KING;
export const getPlayer = (val: number) => isWhite(val) ? Player.WHITE : (isBlack(val) ? Player.BLACK : null);

const isValid = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

export const getBoardArray = (pieces: PieceData[]): number[][] => {
  const b = Array(8).fill(0).map(() => Array(8).fill(0));
  pieces.forEach(p => {
    if (!p.captured) {
      b[p.r][p.c] = p.player === Player.WHITE
        ? (p.isKing ? WHITE_KING : WHITE)
        : (p.isKing ? BLACK_KING : BLACK);
    }
  });
  return b;
};

export function getValidMoves(board: number[][], player: Player): Move[] {
  let captures: Move[] = [];
  let normals: Move[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const val = board[r][c];
      if (getPlayer(val) === player) {
        captures.push(...findCaptures(board, { r, c }, { r, c }));
      }
    }
  }

  // Forced capture rule: if any capture is possible, only captures are valid
  if (captures.length > 0) return captures;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const val = board[r][c];
      if (getPlayer(val) === player) {
        normals.push(...findNormals(board, { r, c }));
      }
    }
  }
  return normals;
}

function findCaptures(board: number[][], currentPos: Position, originalStart: Position, currentPath: Jump[] = []): Move[] {
  const moves: Move[] = [];
  const val = board[currentPos.r][currentPos.c];
  const player = getPlayer(val);
  const king = isKing(val);

  // Russian checkers: Men can capture backwards
  const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  for (const [dr, dc] of directions) {
    const maxDist = king ? 7 : 1;
    for (let dist = 1; dist <= maxDist; dist++) {
      const r1 = currentPos.r + dr * dist;
      const c1 = currentPos.c + dc * dist;
      if (!isValid(r1, c1)) break;

      const targetVal = board[r1][c1];
      if (targetVal !== EMPTY) {
        if (getPlayer(targetVal) === player) break; // Blocked by own piece

        // Cannot capture the same piece twice in a multi-jump
        if (currentPath.some(j => j.capturedPos.r === r1 && j.capturedPos.c === c1)) break;

        // Found opponent, check landing square
        const r2 = r1 + dr;
        const c2 = c1 + dc;
        if (isValid(r2, c2) && board[r2][c2] === EMPTY) {
          const jump: Jump = { to: { r: r2, c: c2 }, capturedPos: { r: r1, c: c1 } };
          const newPath = [...currentPath, jump];

          // Create hypothetical board for further jumps
          const nextBoard = board.map(row => [...row]);
          nextBoard[currentPos.r][currentPos.c] = EMPTY;
          nextBoard[r1][c1] = EMPTY; // Remove captured piece
          nextBoard[r2][c2] = val;   // Move current piece

          const further = findCaptures(nextBoard, { r: r2, c: c2 }, originalStart, newPath);
          if (further.length > 0) {
            moves.push(...further);
          } else {
            // Terminal path
            moves.push({ from: originalStart, to: { r: r2, c: c2 }, path: newPath });
          }
        }
        break; // Cannot jump over multiple pieces in one line
      }
    }
  }
  return moves;
}

function findNormals(board: number[][], start: Position): Move[] {
  const moves: Move[] = [];
  const val = board[start.r][start.c];
  const player = getPlayer(val);
  const king = isKing(val);

  // Men move forward only. Kings move any direction.
  const directions = king
    ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
    : player === Player.WHITE ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];

  for (const [dr, dc] of directions) {
    const maxDist = king ? 7 : 1;
    for (let dist = 1; dist <= maxDist; dist++) {
      const r = start.r + dr * dist;
      const c = start.c + dc * dist;
      if (!isValid(r, c)) break;
      if (board[r][c] !== EMPTY) break; // Blocked
      moves.push({ from: start, to: { r, c }, path: [] });
    }
  }
  return moves;
}
