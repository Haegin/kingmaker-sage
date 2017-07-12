import * as _ from 'lodash';
import { Dictionary } from '@types/lodash'

interface Building {
  name: string
  cost: number
  lots: number
  economy: number
  stability: number
  loyalty: number
}

export const formatBuilding = function(building: Building): string {
  const bonuses: {} = _.pickBy(
    {economy: building.economy, loyalty: building.loyalty, stability: building.stability},
    value => value > 0
  )
  const bonusDescription: string[] = _.map(bonuses, (value: number, name: string) => `+${value} ${name}`)
  return `${building.name}: Costs ${building.cost} BP (${building.lots} Lots)\n\t${bonusDescription.join(", ")}`
}
