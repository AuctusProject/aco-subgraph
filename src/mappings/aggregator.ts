import { ethereum, BigInt } from '@graphprotocol/graph-ts'
import { SetAggregator } from '../types/templates/ACOAssetConverterHelper/ACOAssetConverterHelper'
import { ConfirmAggregatorCall } from '../types/templates/AggregatorProxy/AggregatorProxy'
import { AnswerUpdated } from '../types/templates/AggregatorInterface/AggregatorInterface'
import { getTransaction, convertTokenToDecimal, setAggregatorProxy, setAggregatorInterface, ACO_POOL_FACTORY_ADDRESS } from './helpers'
import { Transaction, AggregatorInterface, AggregatorProxy, ACOPoolFactory2, ACOToken, ACOPool2 } from '../types/schema'
import { setPoolDynamicData } from './acoPool'

export function handleNewProxyAggregator(event: SetAggregator): void {
  let agg = setAggregatorProxy(event.transaction, event.block, event.address, event.params.newAggregator, event.params.baseAsset, event.params.quoteAsset) as AggregatorInterface
  setNewPriceAggregator(event.block.timestamp, agg)
}

export function handleNewAggregator(call: ConfirmAggregatorCall): void {
  let agg = setAggregatorInterface(call.transaction, call.block, call.to, call.inputs._aggregator) as AggregatorInterface
  setNewPriceAggregator(call.block.timestamp, agg)
}

export function handleNewAggregatorAnswer(event: AnswerUpdated): void {
  let agg = setAggregatorInterfaceNewValue(event, event.params.current, event.params.updatedAt) as AggregatorInterface
  setNewPriceAggregator(event.block.timestamp, agg)
}

function setAggregatorInterfaceNewValue(event: ethereum.Event, value: BigInt, timestamp: BigInt): AggregatorInterface {
  let agg = AggregatorInterface.load(event.address.toHexString()) as AggregatorInterface
  if (agg != null) {
    let tx = getTransaction(event) as Transaction
    agg.price = convertTokenToDecimal(value, agg.decimals)
    agg.oracleUpdatedAt = timestamp
    agg.tx = tx.id
    agg.save()
    return agg
  }
  return null as AggregatorInterface
}

function setNewPriceAggregator(timestamp: BigInt, agg: AggregatorInterface): void {
  if (agg != null) {
    let poolFactory = ACOPoolFactory2.load(ACO_POOL_FACTORY_ADDRESS) as ACOPoolFactory2
    let proxy = AggregatorProxy.load(agg.proxy) as AggregatorProxy
    let base = proxy.baseAsset.toHexString()
    let quote = proxy.quoteAsset.toHexString()
    let callAcos = new Array<ACOToken>()
    let putAcos = new Array<ACOToken>()
    let expiredIndexes = new Array<i32>()
    let acos = poolFactory.activeAcos
    for (let i = 0 as i32; i < acos.length; ++i) {
      let aco = ACOToken.load(acos[i]) as ACOToken
      if (timestamp.ge(aco.expiryTime)) {
        expiredIndexes.push(i)
      }
      if (aco.underlying == base && aco.strikeAsset == quote) {
        if (aco.isCall) {
          callAcos.push(aco)
        } else {
          putAcos.push(aco)
        }
      }
    }
    let toRemove = expiredIndexes.reverse() as i32[]
    if (toRemove.length > 0) {
      for (let k = 0 as i32; k < toRemove.length; ++k) {
        let lastIndex = (acos.length - 1) as i32
        acos[toRemove[k]] = acos[lastIndex] as string
        acos.pop()
      }
      poolFactory.activeAcos = acos
      poolFactory.save()
    }
    let pools = poolFactory.pools
    for (let j = 0 as i32; j < pools.length; ++j) {
      let pool = ACOPool2.load(pools[j]) as ACOPool2
      if (pool.underlying == base && pool.strikeAsset == quote) {
        if (pool.isCall) {
          setPoolDynamicData(timestamp, agg, pool, callAcos.reverse())
        } else {
          setPoolDynamicData(timestamp, agg, pool, putAcos.reverse())
        }
      }
    } 
  }
}