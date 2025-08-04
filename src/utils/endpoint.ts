import { useSettingStore } from 'src/localstores/setting/persistent'
import * as constant from 'src/const'

export const faucetWsSchema = (() => {
  const _setting = useSettingStore()
  return _setting.persistentSetting?.faucetWSSchema || constant.WSSchema.WS
})()

export const faucetSchema = (() => {
  const _setting = useSettingStore()
  return _setting.persistentSetting?.faucetSchema || constant.HTTPSchema.HTTP
})()

export const faucetHost = (() => {
  const _setting = useSettingStore()
  return _setting.persistentSetting?.faucetHost || '172.16.31.73' // 'faucet.devnet.linera.net'
})()

export const faucetPort = (() => {
  const _setting = useSettingStore()
  return _setting.persistentSetting?.faucetPort || 8080
})()

export const faucetUrl = constant.toUrl(faucetSchema, faucetHost, faucetPort)

export const rpcWsSchema = (() => {
  const _setting = useSettingStore()
  return _setting.persistentSetting?.rpcWSSchema || constant.WSSchema.WS
})()

export const rpcSchema = (() => {
  const _setting = useSettingStore()
  return _setting.persistentSetting?.rpcSchema || constant.HTTPSchema.HTTP
})()

export const rpcHost = (() => {
  const _setting = useSettingStore()
  return _setting.persistentSetting?.rpcHost || '172.16.31.73' // 'faucet.devnet.linera.net'
})()

export const rpcPort = (() => {
  const _setting = useSettingStore()
  return _setting.persistentSetting?.rpcPort || 30080
})()

export const rpcUrl = constant.toUrl(rpcSchema, rpcHost, rpcPort)
