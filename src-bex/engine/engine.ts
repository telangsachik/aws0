import { BexBridge, BexPayload } from '@quasar/app-vite'
import { confirmation, rpc, rpcPreInterceptor, types } from '../middleware'
import {
  PopupRequestType,
  RpcGraphqlQuery,
  RpcMethod,
  RpcMethods,
  RpcRequest
} from '../middleware/types'
import { sharedStore } from '../store'
import type { PendingJsonRpcResponse, Json } from '@metamask/utils'
import { basebridge } from '../event'
import { commontypes } from '../../src/types'

export class Engine {
  middlewareHandlers = [] as Array<types.MiddlewareImplHandler>
  preInterceptorHandlers = [] as Array<types.MiddlewareInterceptorHandler>

  constructor() {
    this.middlewareHandlers = [confirmation.confirmationHandler]
    this.preInterceptorHandlers = [rpcPreInterceptor.accountInterceptorHandler]
  }

  rpcPreInterceptorExec(
    interceptorIndex: number,
    req: RpcRequest,
    done: () => void,
    error: (e: Error) => void
  ) {
    if (this.preInterceptorHandlers.length <= interceptorIndex) {
      return done()
    }
    this.preInterceptorHandlers[interceptorIndex](req)
      .then(() => {
        this.rpcPreInterceptorExec(interceptorIndex + 1, req, done, error)
      })
      .catch((e: Error) => {
        error(e)
      })
  }

  rpcRecursiveExec(
    middlewareIndex: number,
    req: RpcRequest,
    done: (message: string | undefined) => void,
    error: (e: Error) => void,
    message: string | undefined
  ) {
    if (this.middlewareHandlers.length <= middlewareIndex) {
      return done(message)
    }
    this.middlewareHandlers[middlewareIndex](req)
      .then((message: string | undefined) => {
        this.rpcRecursiveExec(middlewareIndex + 1, req, done, error, message)
      })
      .catch((e: Error) => {
        error(e)
      })
  }

  async rpcExec(req: RpcRequest): Promise<unknown> {
    if (!RpcMethods.includes(req.request.method as RpcMethod)) {
      return Promise.reject(new Error('Invalid rpc method'))
    }
    if (!req.request.params) req.request.params = {}

    switch (req.request.method) {
      case RpcMethod.LINERA_SUBSCRIBE:
      case RpcMethod.LINERA_GRAPHQL_MUTATION: {
        const query = req.request.params as unknown as RpcGraphqlQuery
        if (query.publicKey === undefined) {
          const accounts = await sharedStore.getOriginPublicKeys(req.origin)
          if (accounts.length > 0) {
            query.publicKey = accounts[0]
          }
        }
        break
      }
    }
    return new Promise((resolve, reject) => {
      this.rpcPreInterceptorExec(
        0,
        req,
        () => {
          this.rpcRecursiveExec(
            0,
            req,
            (message: string | undefined) => {
              switch (req.request.method) {
                case RpcMethod.ETH_SIGN:
                  resolve(message)
                  return
              }
              rpc
                .rpcHandler(req)
                .then((res) => {
                  if (
                    RpcMethod.LINERA_GRAPHQL_MUTATION === req.request.method &&
                    !req.silent
                  ) {
                    basebridge.EventBus.bridge
                      ?.send('popup.update', {
                        type: PopupRequestType.EXECUTION,
                        request: req,
                        privData: res
                      })
                      .then(
                        (
                          _res: BexPayload<commontypes.PopupResponse, unknown>
                        ) => {
                          if (_res.data.code !== 0) {
                            return reject(new Error(_res.data.message))
                          }
                          resolve(res)
                        }
                      )
                      .catch((e: Error) => {
                        reject(e)
                      })
                    return
                  }
                  resolve(res)
                })
                .catch((e: Error) => {
                  if (
                    RpcMethod.LINERA_GRAPHQL_MUTATION === req.request.method &&
                    !req.silent
                  ) {
                    basebridge.EventBus.bridge
                      ?.send('popup.update', {
                        type: PopupRequestType.EXECUTION,
                        request: req
                      })
                      .then(() => {
                        reject(e)
                      })
                      .catch((e: Error) => {
                        reject(e)
                      })
                    return
                  }
                  reject(e)
                })
            },
            (e) => {
              reject(e)
            },
            undefined
          )
        },
        (e) => {
          reject(e)
        }
      )
    })
  }
}

export class DataHandler {
  public static run(bridge: BexBridge) {
    basebridge.EventBus.instance.setBridge(bridge)

    const _engine = new Engine()
    bridge.on('data', (payload: BexPayload<RpcRequest, unknown>) => {
      const res = {} as PendingJsonRpcResponse<Json>
      _engine
        .rpcExec(payload.data)
        .then((rc) => {
          res.result = rc as Json
          void payload.respond(res)
        })
        .catch((e: Error) => {
          res.error = {
            code: -1,
            message: e.message || JSON.stringify(e)
          }
          void payload.respond(res)
        })
    })
  }
}
