export class Building {

  constructor(
    readonly name: string,
    readonly cost: number,
    readonly lots: number,
    readonly economy: number,
    readonly loyalty: number,
    readonly stability: number,
    readonly defense: number,
    readonly unrest: number,
    readonly baseValue: number,
  ) {
  }
}
