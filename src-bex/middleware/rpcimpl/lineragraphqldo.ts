import { sharedStore } from '../../../src-bex/store'
import axios from 'axios'
import { RpcMethod, RpcRequest } from '../types'
import { SubscriptionClient } from 'graphql-subscriptions-client'
import { basebridge } from '../../../src-bex/event'
import { subscription } from '../../subscription'
import type { Json } from '@metamask/utils'

interface GraphqlQuery {
  operationName: string
  query: string
  variables: Record<string, unknown>
}

interface RpcGraphqlQuery {
  applicationId?: string
  query: GraphqlQuery
}

interface RpcRequestAttr {
  needChainId: boolean
}

const RpcRequestAttrs: Map<RpcMethod, RpcRequestAttr> = new Map<RpcMethod, RpcRequestAttr>(
  [
    [RpcMethod.ETH_SIGN, {
      needChainId: false
    }]
  ]
)

const lineraGraphqlDoHandler = async (request?: RpcRequest) => {
  if (!request) {
    return await Promise.reject('Invalid request')
  }
  const auth = await sharedStore.getRpcAuth(request.origin)
  if (!auth) {
    return await Promise.reject('Mutation not authenticated')
  }
  const query = request.request.params as unknown as RpcGraphqlQuery
  if (!query || !query.query) {
    return await Promise.reject('Invalid query')
  }
  if (!query.query.variables) {
    query.query.variables = {}
  }
  const attr = RpcRequestAttrs.get(request.request.method as RpcMethod)
  if (!attr || attr.needChainId) {
    query.query.variables.chainId = auth.chainId
  }
  let graphqlUrl: string
  try {
    graphqlUrl = await sharedStore.getRpcEndpoint()
  } catch (e) {
    return await Promise.reject(e)
  }
  if (!graphqlUrl) {
    return await Promise.reject('Invalid graphql endpoint')
  }
  if (query.applicationId) {
    graphqlUrl += '/checko/chains/' + auth.chainId + '/applications/' + query.applicationId
  }
  return new Promise((resolve, reject) => {
    axios({
      method: 'post',
      url: graphqlUrl,
      data: (request.request.params as unknown as RpcGraphqlQuery)?.query
    }).then((res) => {
      if (!res.data) {
        return reject('Invalid response')
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if ((res.data.errors as unknown[])?.length) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return reject(new Error(JSON.stringify(res.data.errors)))
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      resolve(res.data.data)
    }).catch((e) => {
      reject(e)
    })
  })
}

export const lineraGraphqlMutationHandler = async (request?: RpcRequest) => {
  return lineraGraphqlDoHandler(request)
}

export const lineraGraphqlQueryHandler = async (request?: RpcRequest) => {
  return lineraGraphqlDoHandler(request)
}

export const lineraGraphqlSubscribeHandler = async (request?: RpcRequest) => {
  if (!request) {
    return await Promise.reject('Invalid request')
  }
  const origin = request.origin
  const subscriptionId = subscription.Subscription.subscribe(
    request.request.params as string[],
    async (subscriptionId: string, data: unknown) => {
      const auth = await sharedStore.getRpcAuth(origin)
      const _data = data as Record<string, Record<string, Record<string, string>>>
      if (auth?.chainId !== _data.data.notifications.chain_id) {
        return
      }
      void basebridge.EventBus.bridge?.send(
        'linera_subscription',
        {
          subscriptionId,
          payload: _data.data
        } as subscription.SubscriptionPayload
      )
    }
  )
  return await Promise.resolve(subscriptionId)
}

export const lineraGraphqlUnsubscribeHandler = async (request?: RpcRequest) => {
  if (!request) {
    return await Promise.reject('Invalid request')
  }
  const subscriptionId = (request.request.params?.length ? (request.request.params as Json[])[0] : undefined) as string
  if (!subscriptionId) {
    return await Promise.reject(new Error('Invalid subscription id'))
  }
  subscription.Subscription.unsubscribe(subscriptionId)
  return await Promise.resolve(subscriptionId)
}

export const setupLineraSubscription = async () => {
  const subscriptionEndpoint = await sharedStore.getSubscriptionEndpoint()
  const client = new SubscriptionClient(subscriptionEndpoint, {
    reconnect: true,
    lazy: true,
    connectionCallback: (e) => {
      if (e) {
        console.log('Subscribed', e)
      }
    }
  })
  const microchains = await sharedStore.getMicrochains()
  microchains.forEach((microchain) => {
    client.request({
      query: `subscription notifications($chainId: String!) {
        notifications(chainId: $chainId)
      }`,
      variables: {
        chainId: microchain
      }
    }).subscribe({
      next (data: unknown) {
        subscription.Subscription.handle(data)
      }
    })
  })
}
