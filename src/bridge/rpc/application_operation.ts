import { DocumentNode } from 'graphql'
import { rpc, db } from 'src/model'
import { graphqlResult } from 'src/utils'
import {
  SUBSCRIBE_CREATOR_CHAIN,
  LEGACY_REQUEST_SUBSCRIBE,
  SUBSCRIBED_CREATOR_CHAIN
} from 'src/graphql'
import { v4 as uuidv4 } from 'uuid'
import * as dbBridge from '../db'
import { Operation } from './operation'
import { EndpointType, getClientOptionsWithEndpointType } from 'src/apollo'
import { ApolloClient } from '@apollo/client/core'
import { provideApolloClient, useQuery } from '@vue/apollo-composable'
import axios from 'axios'
import { Application } from './application'

export class ApplicationOperation {
  static existChainApplication = async (
    chainId: string,
    applicationId: string
  ): Promise<boolean> => {
    return (
      (await Application.microchainApplications(chainId)).findIndex(
        (el) => el.id === applicationId
      ) >= 0
    )
  }

  static waitExistChainApplication = async (
    chainId: string,
    applicationId: string,
    timeoutSeconds: number
  ): Promise<boolean> => {
    if (
      (await Application.microchainApplications(chainId)).findIndex(
        (el) => el.id === applicationId
      ) >= 0
    ) {
      return true
    }
    if (timeoutSeconds <= 0) {
      return Promise.reject('Wait timeout')
    }
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        ApplicationOperation.waitExistChainApplication(
          chainId,
          applicationId,
          timeoutSeconds - 1
        )
          .then((exists) => {
            resolve(exists)
          })
          .catch((e) => {
            reject(e)
          })
      }, 1000)
    })
  }

  static subscribedCreatorChain = async (
    chainId: string,
    applicationId: string
  ): Promise<boolean> => {
    const options = await getClientOptionsWithEndpointType(
      EndpointType.Rpc,
      chainId,
      applicationId
    )
    const apolloClient = new ApolloClient(options)

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const { /* result, refetch, fetchMore, */ onResult, onError } =
      provideApolloClient(apolloClient)(() =>
        useQuery(
          SUBSCRIBED_CREATOR_CHAIN,
          {},
          {
            fetchPolicy: 'network-only'
          }
        )
      )

    return new Promise((resolve, reject) => {
      onResult((res) => {
        const subscribed = graphqlResult.data(
          res,
          'subscribedCreatorChain'
        ) as boolean
        resolve(subscribed)
      })

      onError((e) => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        reject(new Error(`Query chain application: ${e}`))
      })
    })
  }

  static queryApplication = async (
    chainId: string,
    applicationId: string,
    query: DocumentNode,
    operationName: string,
    variables?: Record<string, unknown>
  ): Promise<Uint8Array | undefined> => {
    const network = (await dbBridge.Network.selected()) as db.Network
    if (!network) return

    // TODO: we can serialize locally

    variables = variables || {}
    variables.checko_query_only = true

    const applicationUrl = process.env.DEV
      ? `/rpc/chains/${chainId}/applications/${applicationId}`
      : `http://${network?.host}:${network?.port}/rpc/chains/${chainId}/applications/${applicationId}`
    return new Promise((resolve, reject) => {
      axios
        .post(applicationUrl, {
          query: query.loc?.source.body,
          variables,
          operationName
        })
        .then((res) => {
          const data = graphqlResult.data(res, 'data')
          const bytes = graphqlResult.keyValue(
            data,
            operationName
          ) as Uint8Array
          resolve(bytes)
        })
        .catch((e) => {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          console.log(`Failed query application: ${e}`)
          reject(e)
        })
    })
  }

  static subscribeCreatorChain = async (
    chainId: string,
    applicationId: string,
    applicationType: db.ApplicationType
  ) => {
    if (
      await ApplicationOperation.subscribedCreatorChain(chainId, applicationId)
    ) {
      console.log(`${applicationId} already subscribed on ${chainId}`)
      return
    }

    if (
      await dbBridge.ChainOperation.exists(
        chainId,
        db.OperationType.SUBSCRIBE_CREATOR_CHAIN,
        applicationId,
        [
          db.OperationState.CREATED,
          db.OperationState.EXECUTING,
          db.OperationState.EXECUTED,
          db.OperationState.CONFIRMED
        ],
        undefined,
        Date.now() - 120000
      )
    ) {
      console.log(`${applicationId} subscribe operation exists on ${chainId}`)
      return
    }

    try {
      const queryRespBytes = await ApplicationOperation.queryApplication(
        chainId,
        applicationId,
        SUBSCRIBE_CREATOR_CHAIN,
        'subscribeCreatorChain'
      )
      const operationId = uuidv4()

      const operation = {
        operationType: db.OperationType.SUBSCRIBE_CREATOR_CHAIN,
        operationId,
        microchain: chainId,
        applicationId,
        applicationType,
        operation: JSON.stringify({
          User: {
            application_id: applicationId,
            bytes: queryRespBytes
          }
        } as rpc.Operation),
        graphqlQuery: SUBSCRIBE_CREATOR_CHAIN.loc?.source?.body
      } as db.ChainOperation
      await dbBridge.ChainOperation.create({ ...operation })

      await Operation.waitOperation(operationId)
    } catch (e) {
      return Promise.reject(e)
    }
  }

  static requestSubscribe = async (chainId: string, applicationId: string) => {
    const queryRespBytes = await ApplicationOperation.queryApplication(
      chainId,
      applicationId,
      LEGACY_REQUEST_SUBSCRIBE,
      'requestSubscribe'
    )

    const operation = {
      operationType: db.OperationType.LEGACY_REQUEST_SUBSCRIBE,
      operationId: uuidv4(),
      microchain: chainId,
      applicationId,
      applicationType: db.ApplicationType.ANONYMOUS,
      operation: JSON.stringify({
        User: {
          application_id: applicationId,
          bytes: queryRespBytes || []
        }
      } as rpc.Operation),
      graphqlQuery: LEGACY_REQUEST_SUBSCRIBE.loc?.source?.body
    } as db.ChainOperation
    await dbBridge.ChainOperation.create({ ...operation })
  }
}
