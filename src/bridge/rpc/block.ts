import { EndpointType, getClientOptionsWithEndpointType } from 'src/apollo'
import { ApolloClient } from '@apollo/client/core'
import {
  provideApolloClient,
  useQuery,
  useSubscription
} from '@vue/apollo-composable'
import { graphqlResult, _hex } from 'src/utils'
import { Ed25519SigningKey, Memory } from '@hazae41/berith'
import { db, rpc } from 'src/model'
import { dbBase } from 'src/controller'
import {
  NOTIFICATIONS,
  BLOCK,
  SUBMIT_BLOCK_AND_SIGNATURE_BCS
} from 'src/graphql'
import {
  type BlockQuery,
  type NotificationsSubscription,
  type ConfirmedBlock,
  type Block as _Block,
  type SubmitBlockAndSignatureBcsMutation
} from 'src/__generated__/graphql/service/graphql'
import * as dbBridge from '../db'
import axios from 'axios'
import { parse, stringify } from 'lossless-json'
import * as lineraWasm from '../../../src-bex/wasm/linera_wasm'

export class Block {
  static submitBlockAndSignature = async (
    chainId: string,
    height: number,
    block: _Block,
    round: rpc.Round,
    signature: string,
    validatedBlockCertificate: unknown | undefined,
    blobBytes: Array<Uint8Array>
  ): Promise<string> => {
    const network = (await dbBridge.Network.selected()) as db.Network
    if (!network) return Promise.reject('Invalid network')

    const applicationUrl = process.env.DEV
      ? network?.path
      : `${network?.rpcSchema}://${network?.host}:${network?.port}${
          network.path?.length ? network.path : ''
        }`
    const sig = {
      Ed25519: signature
    }
    const signedBlock = {
      block,
      round,
      signature: sig,
      validatedBlockCertificate,
      blobBytes: Array.from(blobBytes.map((bytes) => Array.from(bytes)))
    }
    // TODO: we have to use bcs here due to issue https://github.com/linera-io/linera-protocol/issues/3734
    const bcsStr = await lineraWasm.bcs_serialize_signed_block(
      stringify(signedBlock) as string
    )
    const bcsBytes = Array.from(parse(bcsStr) as number[])
    const bcsHex = _hex.toHex(new Uint8Array(bcsBytes))

    return new Promise((resolve, reject) => {
      axios
        .post(
          applicationUrl,
          stringify({
            query: SUBMIT_BLOCK_AND_SIGNATURE_BCS.loc?.source.body,
            variables: {
              chainId,
              height,
              block: bcsHex
            },
            operationName: 'submitBlockAndSignatureBcs'
          }),
          {
            responseType: 'text',
            transformResponse: [(data) => data as string]
          }
        )
        .then((res) => {
          const dataString = graphqlResult.rootData(res) as string
          const data = parse(dataString)
          const errors = (data as Record<string, unknown[]>).errors
          if (errors && errors.length > 0) {
            return reject(stringify(errors))
          }
          const submitBlockAndSignatureBcs = (
            data as Record<string, SubmitBlockAndSignatureBcsMutation>
          ).data
          resolve(
            submitBlockAndSignatureBcs.submitBlockAndSignatureBcs as string
          )
        })
        .catch((e) => {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          console.log(`Failed execute block with full materials: ${e}`)
          reject(e)
        })
    })
  }

  static signPayload = async (
    owner: db.Owner,
    payload: Uint8Array
  ): Promise<string> => {
    const password = (await dbBase.passwords.toArray()).find((el) => el.active)
    if (!password) return Promise.reject('Invalid password')
    const fingerPrint = (await dbBase.deviceFingerPrint.toArray())[0]
    if (!fingerPrint) return Promise.reject('Invalid fingerprint')
    const _password = db.decryptPassword(password, fingerPrint.fingerPrint)
    const privateKey = db.privateKey(owner, _password)
    const keyPair = Ed25519SigningKey.from_bytes(
      new Memory(_hex.toBytes(privateKey))
    )
    return _hex.toHex(keyPair.sign(new Memory(payload)).to_bytes().bytes)
  }

  static subscribe = async (
    chainId: string,
    onNewBlock?: (hash: string) => void,
    onNewIncomingBundle?: () => void
  ): Promise<(() => void) | undefined> => {
    const options = await getClientOptionsWithEndpointType(EndpointType.Rpc)
    if (!options) return undefined
    const apolloClient = new ApolloClient(options)

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const { /* result, refetch, fetchMore, */ stop, onResult, onError } =
      provideApolloClient(apolloClient)(() =>
        useSubscription(NOTIFICATIONS, {
          chainId
        })
      )

    onError((error) => {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      console.log(`Fail subscribe to ${chainId}: ${error}`)
    })

    onResult((res) => {
      const notifications = (
        graphqlResult.rootData(res) as NotificationsSubscription
      ).notifications as unknown
      const reason = graphqlResult.keyValue(notifications, 'reason')
      const newBlock = graphqlResult.keyValue(reason, 'NewBlock')
      if (newBlock) {
        onNewBlock?.(graphqlResult.keyValue(newBlock, 'hash') as string)
      }
      const newIncomingBundle = graphqlResult.keyValue(
        reason,
        'NewIncomingBundle'
      )
      if (newIncomingBundle) {
        onNewIncomingBundle?.()
      }
    })

    return stop
  }

  static getBlockWithHash = async (
    chainId: string,
    hash?: string
  ): Promise<ConfirmedBlock | undefined> => {
    const options = await getClientOptionsWithEndpointType(EndpointType.Rpc)
    if (!options) return undefined
    const apolloClient = new ApolloClient(options)

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const { /* result, refetch, fetchMore, */ onResult, onError } =
      provideApolloClient(apolloClient)(() =>
        useQuery(
          BLOCK,
          {
            chainId,
            hash
          },
          {
            fetchPolicy: 'network-only'
          }
        )
      )

    return new Promise((resolve, reject) => {
      onResult((res) => {
        resolve(
          (graphqlResult.rootData(res) as BlockQuery).block as ConfirmedBlock
        )
      })

      onError((error) => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        reject(new Error(`Get block: ${error}`))
      })
    })
  }
}
