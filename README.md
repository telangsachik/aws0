![image](src/assets/CheCko.png)

### CheCko: Another browser wallet for Linera blockchain by ResPeer

[![Test](https://github.com/respeer-ai/linera-wallet/actions/workflows/test.yml/badge.svg?branch=master)](https://github.com/respeer-ai/linera-wallet/actions/workflows/test.yml)

#### CheCko Wallet

In Linera design, the whole microchain will be run in the browser extension. That's a pretty cool idea that users do not need to depend on operators who run blockchain nodes to provide blockchain API service. But user won't run their brower extension forever. When they leave their computer, they will shut down their browser. After they come back, they have to synchronize microchain data from validators again. With time flying, there will be more applications run on Linera, and the microchain data may grow day by day. The microchain data will be huge someday. As we know, large storage in the browser may cause it to crash and lose data. So, ResPeer has an idea to separate the wallet client and Linera Node Service.

#### Linera Node Service

Linera Node Service is actually the wallet system of Linera. It will hold the keys of accounts, run microchains of the wallet, and will be run in browser extensions in the future. Microchain owner extends their microchain blocks by call operation to Node Service, then Node Service will pack operations into new blocks with incoming messages.

#### How it Works

We probably need to let Node Service not generate new blocks automatically, and let the wallet client be able to get data to be signed to sign and then submit to Node Service for execution. In that way, Linera Node Service won't store account private keys and sign blocks anymore. Browser wallet client will subscribe to Node Service for new messages notifications. Of course, if the Node Service do not have a microchain for the local account, it could create one with its public key, and keep the private key in wallet client keystore locally.

#### About CheCko

Basically, CheCko is the wallet login system of ResPeer. But for a stable web3 application service, we think it deserves to have a microchain cluster to provide stable service for ResPeer users. So we create CheCko with such a `Microchain as a Service` architecture. And for the Linera ecosystem, we think of that other applications can also use this architecture to simplify their application development.

#### Call CheCko from Web Application

```
const web3 = new Web3(window.linera)
web3.eth.requestAccounts().then((accounts) => {
  console.log(accounts)
}).catch((error) => {
  console.log(error)
})
```

#### Todo

- [x] Construct block with rust
- [x] Move block signer to background
- [x] Implement web3.js apis
- [x] Remove request application (depends on linera-protocol implementation)
- [ ] Implement load chain, then we can query chain state from RPC directly
- [x] Remove subscribe creator chain, just keep application state on creator chain
- [x] Event driven implementation of message process
- [ ] Multiple popup implementation and accurate popup closing
- [ ] Dynamic loading of application bytecode to serialize and deserialize application operations
- [x] Serialize application operation locally
- [x] Refactor architecture of block process

### Note

- `curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh`
