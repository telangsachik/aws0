import { UAParser } from 'ua-parser-js'
import CryptoJS, { AES, enc } from 'crypto-js'
import { sha3 } from 'hash-wasm'
// TODO: replace with web3.js utils
import { _hex } from 'src/utils'
import Identicon from 'identicon.js'
import { lineraLogo } from 'src/assets'
import { OriginRpcAuth } from 'app/src-bex/middleware/types'

export interface MicrochainOwner {
  id?: number
  microchain: string
  owner: string
}

export interface Microchain {
  id?: number
  microchain: string
  messageId: string
  certificateHash: string
  name: string
  default: boolean
  imported: boolean // If it's imported in selected network
}

export const microchainAvatar = (microchain: Microchain) => {
  return (
    'data:image/png;base64,' +
    new Identicon(microchain.microchain, 420).toString()
  )
}

export interface Application {
  id?: number
  applicationId: string
  creationMicrochain: string
  creationHeight: number
  applicationIndex: number
}

export const ownerFromPublicKey = async (publicKey: string) => {
  const publicKeyBytes = _hex.toBytes(publicKey)
  const typeNameBytes = new TextEncoder().encode('PublicKey::')
  const bytes = new Uint8Array([...typeNameBytes, ...publicKeyBytes])
  return await sha3(bytes, 256)
}

export interface Owner {
  id?: number
  address: string
  owner: string
  privateKey: string
  salt: string
  name: string
  selected: boolean
}

export const DEFAULT_ACCOUNT_NAME = 'Account'

export const buildOwner = async (
  publicKey: string,
  privateKey: string,
  password: string,
  name: string
) => {
  const owner = await ownerFromPublicKey(publicKey)
  const salt = CryptoJS.lib.WordArray.random(16).toString(enc.Base64)
  const key = CryptoJS.SHA256(salt + password + salt).toString()
  const _privateKey = AES.encrypt(privateKey, key).toString()
  return {
    address: publicKey,
    owner,
    privateKey: _privateKey,
    salt,
    name,
    selected: true
  } as Owner
}

export const ownerAvatar = (owner: Owner) => {
  return 'data:image/png;base64,' + new Identicon(owner.address, 420).toString()
}

export const privateKey = (owner: Owner, password: string) => {
  const key = CryptoJS.SHA256(owner.salt + password + owner.salt).toString()
  return AES.decrypt(owner.privateKey, key).toString(enc.Utf8)
}

export enum HTTPSchema {
  HTTP = 'http',
  HTTPS = 'https'
}

export enum WSSchema {
  WS = 'ws',
  WSS = 'wss'
}

export interface Network {
  id?: number
  icon: string
  name: string
  faucetUrl: string
  rpcSchema: HTTPSchema
  wsSchema: WSSchema
  host: string
  port: number
  path: string
  selected: boolean
  preset: boolean
}

export const defaultNetwork = {
  icon: 'https://github.com/respeer-ai/linera-wallet/blob/master/src/assets/LineraLogo.png?raw=true',
  name: 'Linera Testnet',
  faucetUrl: 'http://172.16.31.73:40080',
  rpcSchema: HTTPSchema.HTTP,
  wsSchema: WSSchema.WS,
  host: '172.16.31.73',
  port: 30080,
  path: '',
  selected: true,
  preset: true
} as Network

export const rpcUrl = (network: Network) => {
  if (
    !network.rpcSchema?.length ||
    !network.host?.length ||
    network.port === undefined
  )
    return ''
  return `${network.rpcSchema}://${network.host}:${network.port}${
    network.path?.length > 1 ? '/' + network.path : ''
  }`
}

export const wsUrl = (network: Network) => {
  if (
    !network.wsSchema?.length ||
    !network.host?.length ||
    network.port === undefined
  )
    return ''
  return `${network.wsSchema}://${network.host}:${network.port}${
    network.path?.length > 1 ? '/ws/' + network.path : '/ws'
  }`
}

export interface Password {
  id?: number
  password: string
  salt: string
  createdAt: number
  active: boolean
}

const deviceFingerPrint = (): string => {
  const parser = new UAParser()
  return `${parser.getBrowser().name || ''},
          ${parser.getCPU().architecture || ''},
          ${parser.getDevice().model || ''},
          ${parser.getDevice().type || ''},
          ${parser.getDevice().vendor || ''},
          ${parser.getEngine().name || ''},
          ${parser.getOS().name || ''}`
}

export const decryptPassword = (password: Password): string => {
  const fingerPrint = deviceFingerPrint()
  const now = password.createdAt
  const salt = password.salt
  const key = CryptoJS.SHA256(fingerPrint + now.toString() + salt).toString()
  const decrypted = AES.decrypt(password.password, key).toString(enc.Utf8)
  return decrypted
}

export const buildPassword = (password: string): Password | undefined => {
  const fingerPrint = deviceFingerPrint()
  const now = Date.now()
  const salt = CryptoJS.lib.WordArray.random(16).toString()
  const key = CryptoJS.SHA256(fingerPrint + now.toString() + salt).toString()
  const encrypted = AES.encrypt(password, key).toString()
  return {
    password: encrypted,
    salt,
    createdAt: now,
    active: true
  }
}

export enum TokenType {
  Fungible = 'Fungible',
  NFT = 'NFT',
  Native = 'Native'
}

export interface Token {
  id?: number
  name: string
  description: string
  ticker: string
  tokenType: TokenType
  logo: string
  applicationId?: string
  native: boolean
  usdCurrency: number
  mono: boolean
  discord: string
  telegram: string
  twitter: string
  website: string
  github: string
}

export const lineraToken = {
  name: 'Linera',
  description:
    'The first L1 blockchain infrastructure optimized for real-time applications',
  ticker: 'TLINERA',
  tokenType: TokenType.Native,
  logo: lineraLogo,
  native: true,
  mono: true,
  discord: 'https://discord.com/invite/linera',
  telegram: 'http://t.me/linera_official',
  twitter: 'https://x.com/linera_io',
  website: 'https://linera.io',
  github: 'https://github.com/linera-io/linera-protocol'
} as Token

export interface MicrochainFungibleTokenBalance {
  id?: number
  microchain: string
  tokenId: number
  balance: number
}

export interface MicrochainOwnerFungibleTokenBalance {
  id?: number
  microchain: string
  owner: string
  tokenId: number
  balance: number
}

export interface NFT {
  id?: number
  collectionId: string
  tokenId: number
  uri: string
  microchain: string
  owner: string
}

export interface Activity {
  id?: number
  sourceChain: string
  sourceAddress?: string
  targetChain: string
  targetAddress?: string
  amount: string
  blockHeight: number
  timestamp: number
  certificateHash: string
  grant: string
}

export interface LoginTimestamp {
  id?: number
  timestamp: number
}

export interface RpcAuth extends OriginRpcAuth {
  id?: number
}

export interface OriginRpcMicrochain {
  id?: number
  origin: string
  publicKey: string
  microchain: string
}

export enum ApplicationType {
  SWAP,
  WLINERA,
  ERC20
}

export interface NamedApplication {
  id?: number
  applicationType: ApplicationType
  name: string
  applicationId: string
  creatorChain: string
}

export const defaultNamedApplications = [
  {
    applicationType: ApplicationType.SWAP,
    name: 'swap',
    applicationId:
      'd72927687ef4e4501336d030291190c3efcd714a8ecfcb551d03da68938b58f2096ae7794f1fc97b4b8f6b29a7f4bef6f3d98402be87da8c5eefa2745ab4538e1cab8114d56a7388ce39e42a08ccfb8a6198d109b63cdc23cf20815a6df89ef2010000000000000000000000',
    creatorChain:
      '1cab8114d56a7388ce39e42a08ccfb8a6198d109b63cdc23cf20815a6df89ef2'
  },
  {
    applicationType: ApplicationType.WLINERA,
    name: 'wlinera',
    applicationId:
      '7f5f35725a130873e8d8a3aa1e1c596e9bd2482961ac6046564b7670449630fa98886d18b99722f4e4c74ee7e9ee53defea69f1f7b62f63933c38b745c30b0d1717b3ce25477861f9960357f4a070749553f2382a9353e8c2d813d54e9ed80d3010000000000000000000000',
    creatorChain:
      '717b3ce25477861f9960357f4a070749553f2382a9353e8c2d813d54e9ed80d3'
  }
] as NamedApplication[]

export interface ApplicationCreatorChainSubscription {
  id?: number
  applicationId: string
  microchain: string
}
