import { dbWallet } from 'src/controller'
import { dbModel } from 'src/model'

export class MicrochainOwner {
  static ownerMicrochainOwners = async (
    owner: string
  ): Promise<dbModel.MicrochainOwner[]> => {
    return await dbWallet.microchainOwners
      .where('owner')
      .equals(owner)
      .toArray()
  }

  static microchainOwners = async (
    microchain: string
  ): Promise<dbModel.Owner[]> => {
    const _microchainOwners = await dbWallet.microchainOwners
      .where('microchain')
      .equals(microchain)
      .toArray()
    if (!_microchainOwners.length) return []
    const owners = _microchainOwners.reduce((ids: string[], a): string[] => {
      ids.push(a.owner)
      return ids
    }, [])
    return await dbWallet.owners.where('owner').anyOf(owners).toArray()
  }

  static create = async (owner: string, microchain: string) => {
    await dbWallet.microchainOwners.add({
      microchain,
      owner,
      balance: 0
    } as dbModel.MicrochainOwner)
  }
}
