import { bexBackground } from 'quasar/wrappers'
import * as process from 'process'
import { Buffer as BufferPolyfill } from 'buffer'
import { engine } from './engine'
import { BexBridge, BexConnection } from '@quasar/app-vite'
import { setupLineraSubscription } from './middleware/rpcimpl/lineragraphqldo'
import { sentinel, block } from './microchain'
import InstallationManager from './manager/installationmanager'

globalThis.Buffer = BufferPolyfill
globalThis.process = process

const installationManager = new InstallationManager()
let keepaliveInterval

const keepalive = (bridge: BexBridge, allActiveConnections: {
  [connectionId: string]: {
    app?: BexConnection;
    contentScript?: BexConnection;
  }
}) => {
  if (keepaliveInterval !== undefined) return
  keepaliveInterval = setInterval(() => {
    Object.keys(allActiveConnections).forEach((key) => {
      const connection = allActiveConnections[key]
      if (connection.app?.connected) return
      if (connection.contentScript?.connected) return
      delete allActiveConnections[key]
    })
    for (const key of Object.keys(bridge.getEvents())) {
      if (key.startsWith('ping.') && key.endsWith('.result')) {
        bridge.removeAllListeners(key)
      }
    }
    void bridge.send('ping')
  }, 3000)
}

export default bexBackground(
  (bridge: BexBridge, allActiveConnections: {
    [connectionId: string]: {
      app?: BexConnection;
      contentScript?: BexConnection;
    }
  }) => {
    engine.DataHandler.run(bridge)
    keepalive(bridge, allActiveConnections)
  }
)

installationManager.initializeOnInstalledListener()

sentinel.Sentinel.run()
block.BlockSigner.run()
void setupLineraSubscription()
