import { defineStore } from 'pinia'
import { Account, Activity, Microchain } from './types'
import localforage from 'localforage'
import { sha3 } from 'hash-wasm'
import { _hex } from 'src/utils'

export const useWalletStore = defineStore('checko-wallet', {
  state: () => ({
    accounts: new Map<string, Account>(),
    currentAddress: undefined as unknown as string,
    activities: [] as Array<Activity>,
    password: undefined as unknown as string,
    walletStorage: localforage.createInstance({
      name: 'checko-wallet'
    }),
    loaded: false
  }),
  getters: {
    publicKeys (): Array<string> {
      return Array.from(this.accounts.keys())
    },
    displayAddress (): (publicKey: string) => string {
      return (publicKey: string) => {
        return this.accounts.get(publicKey)?.ownerAddress || publicKey
      }
    },
    displayAddresses (): Array<string> {
      const addrs = [] as Array<string>
      this.accounts.forEach((account: Account, publicKey: string) => {
        addrs.push(account.ownerAddress || publicKey)
      })
      return addrs
    },
    chainPublicKeys (): Map<string, Array<string>> {
      const chainPublicKeys = new Map<string, Array<string>>()
      this.accounts.forEach((account: Account, publicKey: string) => {
        account.microchains.forEach((_, chainId: string) => {
          let publicKeys = chainPublicKeys.get(chainId)
          if (!publicKeys) {
            publicKeys = []
          }
          publicKeys.push(publicKey)
          chainPublicKeys.set(chainId, publicKeys)
        })
      })
      return chainPublicKeys
    },
    chainIds (): Array<string> {
      const chainIds = [] as Array<string>
      this.accounts.forEach((account: Account) => {
        chainIds.push(...Array.from(account.microchains.keys()))
      })
      return chainIds
    },
    currentAccount (): Account | undefined {
      return this.accounts.get(this.currentAddress)
    },
    currentChains (): Map<string, Microchain> {
      return this.accountChains(this.currentAddress)
    },
    accountChains (): (publicKey: string) => Map<string, Microchain> {
      return (publicKey: string) => {
        return this.accounts.get(publicKey)?.microchains || new Map<string, Microchain>()
      }
    },
    account (): (publicKey: string) => Account | undefined {
      return (publicKey: string) => {
        return this.accounts.get(publicKey)
      }
    },
    chainBalance (): (publicKey: string | undefined, chainId: string) => number {
      return (publicKey: string | undefined, chainId: string) => {
        return this.accounts.get(publicKey || this.currentAddress)?.microchains.get(chainId)?.chain_balance || 0
      }
    },
    accountBalance (): (publicKey: string | undefined, chainId: string | undefined) => number {
      return (publicKey: string | undefined, chainId: string | undefined) => {
        if (chainId) {
          return this.accounts.get(publicKey || this.currentAddress)?.microchains.get(chainId)?.account_balance || 0
        }
        let balance = 0
        this.accounts.get(publicKey || this.currentAddress)?.microchains.forEach((microchain) => {
          balance += microchain.account_balance + microchain.chain_balance
        })
        return balance
      }
    },
    chains (): Map<string, Microchain> {
      const chains = new Map<string, Microchain>()
      this.accounts.forEach((account) => {
        account.microchains.forEach((microchain, chainId) => {
          chains.set(chainId, microchain)
        })
      })
      return chains
    },
    publicKeyFromOwner (): (owner: string | undefined, done: (publicKey: string | undefined) => void) => void {
      return (owner: string | undefined, done: (publicKey: string | undefined) => void) => {
        if (!owner) {
          done(undefined)
          return
        }
        this.accounts.forEach((_, publicKey) => {
          const publicKeyBytes = _hex.toBytes(publicKey)
          const typeNameBytes = new TextEncoder().encode('PublicKey::')
          const bytes = new Uint8Array([...typeNameBytes, ...publicKeyBytes])
          sha3(bytes, 256).then((hash) => {
            if (hash === owner) {
              done(publicKey)
            }
          }).catch(() => {
            // TODO
          })
        })
      }
    },
    publicKeyToOwner (): (publicKey: string, done: (owner: string) => void) => void {
      return (publicKey: string, done: (owner: string) => void) => {
        const publicKeyBytes = _hex.toBytes(publicKey)
        const typeNameBytes = new TextEncoder().encode('PublicKey::')
        const bytes = new Uint8Array([...typeNameBytes, ...publicKeyBytes])
        sha3(bytes, 256).then((hash) => {
          done(hash)
        }).catch(() => {
          // TODO
        })
      }
    },
    _activities (): Array<Activity> {
      return this.activities
    },
    accountActivities (): (publicKey: string) => Array<Activity> {
      return (publicKey: string) => {
        return this.activities.filter((el) => {
          return el.sourceAddress === publicKey ||
                 el.targetAddress === publicKey ||
                 this.accounts.get(publicKey)?.microchains?.has(el.sourceChain) ||
                 this.accounts.get(publicKey)?.microchains?.has(el.targetChain)
        })
      }
    },
    currentAccountActivities (): Array<Activity> {
      return this.accountActivities(this.currentAddress)
    },
    existPublicKey (): (publicKey: string) => boolean {
      return (publicKey: string) => {
        return this.accounts.has(publicKey)
      }
    }
  },
  actions: {
    reset () {
      void this.walletStorage.setItem('accounts', '{}')
      void this.walletStorage.setItem('activities', '[]')

      this.accounts.clear()
      this.currentAddress = undefined as unknown as string
      this.activities = []
    },
    loadAccounts (listener?: () => void) {
      this.walletStorage.getItem('accounts')
        .then((accounts) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment
          const _accounts = JSON.parse(accounts as string)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          Object.keys(_accounts).forEach((k: string) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const account = _accounts[k] as Record<string, unknown>
            const _account = {
              privateKey: account.privateKey,
              microchains: new Map<string, Microchain>()
            } as Account
            const microchains = account.microchains as Record<string, unknown>
            Object.keys(microchains).forEach((k1: string) => {
              _account.microchains.set(k1, {
                chain_balance: Number((microchains[k1] as Microchain).chain_balance),
                account_balance: Number((microchains[k1] as Microchain).account_balance),
                message_id: (microchains[k1] as Microchain).message_id,
                faucet_url: (microchains[k1] as Microchain).faucet_url
              })
            })
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            this.accounts.set(k, _account)
          })
          listener?.()
        })
        .catch((e) => {
          console.log('Load accounts', e)
        })
    },
    loadCurrentAddress (listener?: () => void) {
      this.walletStorage.getItem('current-address')
        .then((currentAddress) => {
          this.currentAddress = currentAddress as string
          listener?.()
        })
        .catch((e) => {
          console.log('Load current address', e)
        })
    },
    loadActivities (listener?: () => void) {
      this.walletStorage.getItem('activities')
        .then((activites) => {
          this.activities = JSON.parse(activites as string) as Array<Activity> || []
          this.activities.sort((a, b) => b.timestamp - a.timestamp)
          listener?.()
        })
        .catch((e) => {
          console.log('Load activities', e)
        })
    },
    loadPassword (listener?: () => void) {
      this.walletStorage.getItem('password')
        .then((password) => {
          this.password = password as string
          listener?.()
        })
        .catch((e) => {
          console.log('Load password', e)
        })
    },
    load (listener?: () => void) {
      if (this.loaded) {
        return listener?.()
      }
      this.loadPassword(() => {
        this.loadAccounts(() => {
          this.loadCurrentAddress(() => {
            this.loadActivities(listener)
            this.loaded = true
          })
        })
      })
    },
    storeReady (ready: () => void) {
      if (this.loaded) {
        ready()
        return
      }
      setTimeout(() => {
        this.storeReady(ready)
      }, 100)
    },
    saveAccount () {
      this.storeReady(() => {
        const obj = {} as Record<string, unknown>
        this.accounts.forEach((account, publicKey) => {
          obj[publicKey] = {
            microchains: Object.fromEntries(account.microchains),
            privateKey: account.privateKey
          }
        })
        this.walletStorage.setItem('accounts', JSON.stringify(obj))
          .catch((e) => {
            console.log(e)
          })
      })
    },
    addAccount (publicKey: string, privateKey: string) {
      this.publicKeyToOwner(publicKey, (owner: string) => {
        this.accounts.set(publicKey, {
          privateKey,
          microchains: new Map<string, Microchain>(),
          ownerAddress: owner
        })
        this.saveAccount()
      })
    },
    saveCurrentAddress () {
      this.storeReady(() => {
        this.walletStorage.setItem('current-address', this.currentAddress)
          .catch((e) => {
            console.log(e)
          })
      })
    },
    selectAddress (publicKey: string) {
      this.currentAddress = publicKey
      this.saveCurrentAddress()
    },
    deleteAddress (publicKey: string) {
      this.accounts.delete(publicKey)
    },
    addChain (publicKey: string, chainId: string, messageId: string, faucetUrl: string) {
      const account = this.accounts.get(publicKey)
      if (!account) {
        throw Error('Invalid account public key')
      }
      if (account.microchains.has(chainId)) return
      account.microchains.set(chainId, {
        chain_balance: 0,
        account_balance: 0,
        message_id: messageId,
        faucet_url: faucetUrl
      })
      this.accounts.set(publicKey, account)
      this.saveAccount()
    },
    setAccountBalance (publicKey: string, chainId: string, balance: number) {
      const account = this.accounts.get(publicKey)
      if (!account) {
        throw Error('Invalid account public key')
      }
      const microchain = account.microchains.get(chainId)
      if (!microchain) {
        throw Error('Invalid microchain')
      }
      microchain.account_balance = Number(balance)
      account.microchains.set(chainId, microchain)
      this.accounts.set(publicKey, account)
      this.saveAccount()
    },
    setChainBalance (publicKey: string, chainId: string, balance: number) {
      const account = this.accounts.get(publicKey)
      if (!account) {
        throw Error('Invalid account public key')
      }
      const microchain = account.microchains.get(chainId)
      if (!microchain) {
        throw Error('Invalid microchain')
      }
      microchain.chain_balance = Number(balance)
      account.microchains.set(chainId, microchain)
      this.accounts.set(publicKey, account)
      this.saveAccount()
    },
    saveActivities () {
      this.storeReady(() => {
        this.walletStorage.setItem('activities', JSON.stringify(this.activities))
          .catch((e) => {
            console.log(e)
          })
      })
    },
    addActivity (fromChainId: string, fromPublicKey: string | undefined, toChainId: string, toPublicKey: string | undefined, amount: string, blockHeight: number, timestamp: number, certificateHash: string, grant: string) {
      if ((fromPublicKey && !this.existPublicKey(fromPublicKey)) && (toPublicKey && !this.existPublicKey(toPublicKey))) {
        throw Error('Invalid account')
      }
      this.activities.splice(0, 0, {
        sourceChain: fromChainId,
        sourceAddress: fromPublicKey,
        targetChain: toChainId,
        targetAddress: toPublicKey,
        amount,
        blockHeight,
        timestamp,
        certificateHash,
        grant
      })
      this.saveActivities()
    }
  }
})
