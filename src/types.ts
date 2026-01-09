export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'w' | 'b';

export interface Position {
  row: number;
  col: number;
}

export interface BoardSquare {
  square: string;
  type: PieceType;
  color: PieceColor;
}

export interface Move {
  from: string;
  to: string;
  promotion?: string;
}

export type GameMode = 'friend' | 'bot' | 'online';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'impossible';
