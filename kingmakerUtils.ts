import { map, pick, pickBy, startCase } from 'lodash';
import Building from './data/building';

const sign = number => {
  return number >= 0 ? '+' : '-';
}

const pickBonuses = (building: Building, bonuses: string[]): string[] => {
  const data: {} = pickBy(
    pick(building, bonuses),
    value => value !== 0
  )
  return map(data, (value: number, name: string) => `${sign(value)}${Math.abs(value)} ${startCase(name)}`);
}

export const formatBuilding = function(building: Building): string {
  const keyBonuses: string[] = pickBonuses(building, ['economy', 'stability', 'loyalty', 'unrest']);
  const minorBonuses: string[] = pickBonuses(building, ['defense', 'baseValue']);
  return `${building.name}: ${building.cost} BP (${building.lots} Lots)
\t${keyBonuses.join(", ")}
\t${minorBonuses.join(", ")}`
}
