import { UAParser } from 'ua-parser-js'
import CryptoJS, { AES, enc } from 'crypto-js'
import { sha3 } from 'hash-wasm'
// TODO: replace with web3.js utils
import { _hex } from 'src/utils'

export interface MicrochainOwner {
  id?: number
  microchain: string
  owner: string
  balance: number
}

export interface Microchain {
  id?: number
  microchain: string
  balance: number
  messageId: string
  certificateHash: string
  faucetUrl: string
  name: string
  default: boolean
  selected: boolean
}

const ownerFromPublicKey = async (publicKey: string) => {
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

export const buildOwner = async (publicKey: string, privateKey: string, password: string, name: string) => {
  const owner = await ownerFromPublicKey(publicKey)
  const salt = CryptoJS.lib.WordArray.random(16).toString()
  const _password = AES.encrypt(password, salt).toString()
  const _privateKey = AES.encrypt(privateKey, _password).toString()
  return {
    address: publicKey,
    owner,
    privateKey: _privateKey,
    salt,
    name,
    selected: true
  } as Owner
}

export const privateKey = (owner: Owner, password: string) => {
  const _password = AES.encrypt(password, owner.salt).toString()
  return AES.decrypt(owner.privateKey, _password).toString()
}

enum HTTPSchema {
  HTTP = 'http',
  HTTPS = 'https'
}

enum WSPSchema {
  WS = 'ws',
  WSS = 'wss'
}

export interface Network {
  id?: number
  icon: string
  name: string
  faucetUrl: string
  rpcSchema: HTTPSchema
  wsSchema: WSPSchema
  host: string
  port: number
  path: string
  selected: boolean
}

export const defaultNetwork = {
  icon: 'https://github.com/respeer-ai/linera-wallet/blob/master/src/assets/LineraLogo.png?raw=true',
  name: 'Linera Testnet',
  faucetUrl: 'http://172.16.31.73:8080',
  rpcSchema: HTTPSchema.HTTP,
  wsSchema: WSPSchema.WS,
  host: '172.16.31.73',
  port: 30080,
  path: '',
  selected: true
} as Network

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
          ${parser.getOS().name || ''},
          ${parser.getUA()}`
}

export const decryptPassword = (password: Password): string => {
  const fingerPrint = deviceFingerPrint()
  const now = password.createdAt
  const salt = password.salt
  const key = CryptoJS.SHA256(fingerPrint + now.toString() + salt.toString()).toString()
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
