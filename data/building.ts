interface Building {
  name: string;
  cost: number;
  lots: number;
  economy?: number;
  loyalty?: number;
  stability?: number;
  defense?: number;
  unrest?: number;
  baseValue?: number;
};

export default Building;
