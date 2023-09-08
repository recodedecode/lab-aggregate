import intformat from 'biguint-format'
import FlakeId from 'flake-idgen'


type FlakeID = string

const flakeIdGen = new FlakeId()

export const nextFlakeId = (): FlakeID =>
  intformat(flakeIdGen.next(), 'dec')
