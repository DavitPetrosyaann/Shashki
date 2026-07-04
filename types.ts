export enum Player {
  WHITE = 'WHITE',
  BLACK = 'BLACK'
}

export type Position = {
  r: number;
  c: number;
};

export type Jump = {
  to: Position;
  capturedPos: Position;
};

export type Move = {
  from: Position;
  to: Position;
  path: Jump[]; // Empty if normal move, contains sequence of jumps if capture
};

export type PieceData = {
  id: string;
  player: Player;
  isKing: boolean;
  r: number;
  c: number;
  captured: boolean;
};

export type GameMode = 'menu' | 'pvp' | 'pvc';
