import type { JsonRpcParams, JsonRpcRequest } from '@metamask/utils'

export enum RpcMethod {
  ADD_ETHEREUM_CHAIN = 'wallet_addEthereumChain',
  ETH_ACCOUNTS = 'eth_accounts',
  ETH_DECRYPT = 'eth_decrypt',
  ETH_CHAIN_ID = 'eth_chainId',
  ETH_GET_ENCRYPTION_PUBLIC_KEY = 'eth_getEncryptionPublicKey',
  ETH_GET_BLOCK_BY_NUMBER = 'eth_getBlockByNumber',
  ETH_REQUEST_ACCOUNTS = 'eth_requestAccounts',
  ETH_SIGN = 'eth_sign',
  ETH_SIGN_TRANSACTION = 'eth_signTransaction',
  ETH_SIGN_TYPED_DATA = 'eth_signTypedData',
  ETH_SIGN_TYPED_DATA_V1 = 'eth_signTypedData_v1',
  ETH_SIGN_TYPED_DATA_V3 = 'eth_signTypedData_v3',
  ETH_SIGN_TYPED_DATA_V4 = 'eth_signTypedData_v4',
  GET_PROVIDER_STATE = 'metamask_getProviderState',
  LOG_WEB3_SHIM_USAGE = 'metamask_logWeb3ShimUsage',
  PERSONAL_SIGN = 'personal_sign',
  SEND_METADATA = 'metamask_sendDomainMetadata',
  SWITCH_ETHEREUM_CHAIN = 'wallet_switchEthereumChain',
  TRANSACTION = 'transaction',
  WALLET_REQUEST_PERMISSIONS = 'wallet_requestPermissions',
  WATCH_ASSET = 'wallet_watchAsset',
  CHECKO_PING = 'checko_ping',
  LINERA_SUBSCRIBE = 'linera_subscribe',
  LINERA_UNSUBSCRIBE = 'linera_unsubscribe',
  LINERA_GRAPHQL_MUTATION = 'linera_graphqlMutation',
  LINERA_GRAPHQL_QUERY = 'linera_graphqlQuery',

  ETH_GET_BALANCE = 'eth_getBalance'
}

export const RpcMethods = Object.values(RpcMethod)

export interface RpcRequest {
  origin: string
  name: string,
  favicon: string,
  request: JsonRpcRequest<JsonRpcParams>
}

export type MiddlewareImplHandler = (req: RpcRequest) => Promise<string | undefined>

export enum PopupRequestType {
  CONFIRMATION = 'confirmation'
}

export interface OriginRpcAuth {
  publicKey: string
  chainId: string
  methods: RpcMethod[]
}
