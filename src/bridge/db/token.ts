import { dbBase } from 'src/controller'
import { db } from 'src/model'
import { Network } from './network'
import * as lineraWasm from '../../../src-bex/wasm/linera_wasm'

export class Token {
  static initialize = async (nativeLogo: string) => {
    if (await Token.native()) return
    db.lineraToken.logo = nativeLogo
    await dbBase.tokens.add(db.lineraToken)
  }

  static create = async (token: db.Token) => {
    if (
      (await dbBase.tokens.toArray()).findIndex(
        (el) => el.applicationId === token.applicationId
      ) >= 0
    )
      return
    await dbBase.tokens.add(token)
  }

  static update = async (token: db.Token) => {
    await dbBase.tokens.update(token.id, token)
  }

  static delete = async (id: number) => {
    await dbBase.tokens.delete(id)
  }

  static native = async () => {
    return (await dbBase.tokens.toArray()).find((el) => el.native)
  }

  static fungibles = async () => {
    return (await dbBase.tokens.toArray()).filter(
      (el) => el.tokenType === db.TokenType.Fungible
    )
  }

  static token = async (applicationId: string) => {
    return (await dbBase.tokens.toArray()).find(
      (el) => el.applicationId === applicationId
    )
  }

  static tokens = async (
    offset: number,
    limit: number,
    applicationIds?: string[]
  ): Promise<db.Token[]> => {
    if (applicationIds && applicationIds.length) {
      return await dbBase.tokens
        .where('applicationId')
        .anyOf(applicationIds)
        .offset(offset)
        .limit(limit)
        .toArray()
    }
    return await dbBase.tokens.offset(offset).limit(limit).toArray()
  }

  static count = async () => {
    return await dbBase.tokens.count()
  }

  static tokenWithId = async (id: number) => {
    return (await dbBase.tokens.toArray()).find((el) => el.id === id)
  }

  static exists = async (applicationId: string) => {
    return (
      (await dbBase.tokens
        .where('applicationId')
        .equals(applicationId)
        .first()) !== undefined
    )
  }

  static logo = async (tokenId: number) => {
    const token = await dbBase.tokens.get(tokenId)
    if (!token) return undefined
    if (token.name) return token.logo
    const network = await Network.selected()
    if (!network) return token.logo
    const creationChain = await lineraWasm.application_creation_chain_id(
      token.applicationId as string
    )
    const blobGatewayUrl = network.blobGatewayUrl.endsWith('/')
      ? network.blobGatewayUrl.slice(0, network.blobGatewayUrl.length - 1)
      : network.blobGatewayUrl
    return (
      blobGatewayUrl +
      '/chains/' +
      creationChain +
      '/applications/' +
      (token.applicationId as string)
    )
  }
}
