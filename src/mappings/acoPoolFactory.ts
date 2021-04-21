import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts'
import { Transaction, Token, ACOPool2, ACOPoolFactory2 } from '../types/schema'
import { NewAcoPool } from '../types/templates/ACOPoolFactory2/ACOPoolFactory2'
import { ACOPool2 as ACOPoolContract, ACOPool2__acoPermissionConfigResult, ACOPool2__protocolConfigResult } from '../types/templates/ACOPoolFactory2/ACOPool2'
import { ACOPool2 as ACOPoolTemplate, ACOPoolFactory2 as ACOPoolFactoryTemplate } from '../types/templates'
import {
  fetchTokenSymbol,
  fetchTokenName,
  fetchTokenDecimals,
  getToken,
  getTransaction,
  ZERO_BD,
  ZERO_BI,
  convertTokenToDecimal,
  ACO_POOL_IMPL_V1_ADDRESS,
  ACO_POOL_IMPL_V2_ADDRESS,
  ACO_POOL_IMPL_V3_ADDRESS,
  ONE_BI,
  setAssetConverterHelper,
  ACO_POOL_FACTORY_ADDRESS
} from './helpers'
import { setAcoPoolAdminHistory, setAcoPoolBaseVolatilityHistory, setAcoPoolPermissionHistory, setAcoPoolStrategyHistory } from './acoPool'

export function handleNewAcoPool(event: NewAcoPool): void {
  setACOPoolFactory(event.params.acoPool)

  let tx = getTransaction(event) as Transaction

  let underlying = getToken(event.params.underlying) as Token
  let strikeAsset = getToken(event.params.strikeAsset) as Token

  let acoPoolContract = ACOPoolContract.bind(event.params.acoPool)
  let acoPool = new ACOPool2(event.params.acoPool.toHexString()) as ACOPool2

  acoPool.underlying = underlying.id
  acoPool.strikeAsset = strikeAsset.id
  acoPool.collateral = (event.params.isCall == true ? underlying.id : strikeAsset.id)
  acoPool.symbol = fetchTokenSymbol(event.params.acoPool)
  acoPool.name = fetchTokenName(event.params.acoPool)
  acoPool.decimals = fetchTokenDecimals(event.params.acoPool)
  acoPool.isCall = event.params.isCall
  acoPool.implementation = event.params.acoPoolImplementation
  acoPool.tx = tx.id
  acoPool.totalSupply = ZERO_BD
  acoPool.openAcosCount = ZERO_BI
  acoPool.holdersCount = ZERO_BI
  acoPool.acosCount = ZERO_BI
  acoPool.acoCreatorsPermissionCount = ZERO_BI
  acoPool.swapsCount = ZERO_BI
  acoPool.depositsCount = ZERO_BI
  acoPool.withdrawalsCount = ZERO_BI
  acoPool.acoRedeemsCount = ZERO_BI
  acoPool.collateralRestoresCount = ZERO_BI
  acoPool.accountsCount = ZERO_BI
  acoPool.strategiesHistoryCount = ONE_BI
  acoPool.baseVolatilitiesHistoryCount = ONE_BI
  acoPool.acoPoolPermissionsHistoryCount = ONE_BI
  acoPool.acosDynamicDataCount = ZERO_BI
  acoPool.historicalSharesCount = ZERO_BI
  acoPool.lastHistoricalShareUpdate = ZERO_BI
  acoPool.gasToken = acoPoolContract.chiToken() as Address
  acoPool.strategy = acoPoolContract.strategy() as Address
  acoPool.baseVolatility = convertTokenToDecimal(acoPoolContract.baseVolatility() as BigInt, BigInt.fromI32(5))
  
  let protocolConfig = null as ACOPool2__protocolConfigResult
  let implementation = event.params.acoPoolImplementation.toHexString()
  if (implementation == ACO_POOL_IMPL_V1_ADDRESS || implementation == ACO_POOL_IMPL_V2_ADDRESS || implementation == ACO_POOL_IMPL_V3_ADDRESS) {
    acoPool.assetConverter = acoPoolContract.assetConverter()
    acoPool.feeDestination = acoPoolContract.feeDestination()
    acoPool.maximumOpenAco = acoPoolContract.maximumOpenAco()
    acoPool.minExpiration = acoPoolContract.minExpiration()
    acoPool.maxExpiration = acoPoolContract.maxExpiration()
    acoPool.withdrawOpenPositionPenalty = convertTokenToDecimal(acoPoolContract.withdrawOpenPositionPenalty() as BigInt, BigInt.fromI32(5))
    acoPool.underlyingPriceAdjustPercentage = convertTokenToDecimal(acoPoolContract.underlyingPriceAdjustPercentage() as BigInt, BigInt.fromI32(5))
    acoPool.fee = convertTokenToDecimal(acoPoolContract.fee() as BigInt, BigInt.fromI32(5))
    let tolerancePriceAbove = convertTokenToDecimal(acoPoolContract.tolerancePriceAbove() as BigInt, BigInt.fromI32(5))
    let tolerancePriceBelow = convertTokenToDecimal(acoPoolContract.tolerancePriceBelow() as BigInt, BigInt.fromI32(5))
    if (tolerancePriceAbove.equals(ZERO_BD) && tolerancePriceBelow.equals(ZERO_BD)) {
      acoPool.tolerancePriceAboveMax = ZERO_BD
      acoPool.tolerancePriceAboveMin = ZERO_BD
      acoPool.tolerancePriceBelowMin = ZERO_BD
      acoPool.tolerancePriceBelowMax = ZERO_BD
    } else if (tolerancePriceAbove.gt(ZERO_BD) && tolerancePriceBelow.gt(ZERO_BD)) {
      acoPool.tolerancePriceAboveMax = tolerancePriceAbove
      acoPool.tolerancePriceAboveMin = ZERO_BD
      acoPool.tolerancePriceBelowMin = ZERO_BD
      acoPool.tolerancePriceBelowMax = tolerancePriceBelow
    } else if (tolerancePriceAbove.gt(ZERO_BD)) {
      acoPool.tolerancePriceAboveMax = ZERO_BD
      acoPool.tolerancePriceAboveMin = tolerancePriceAbove
      acoPool.tolerancePriceBelowMin = ZERO_BD
      acoPool.tolerancePriceBelowMax = ZERO_BD
    } else {
      acoPool.tolerancePriceAboveMax = ZERO_BD
      acoPool.tolerancePriceAboveMin = ZERO_BD
      acoPool.tolerancePriceBelowMin = tolerancePriceBelow
      acoPool.tolerancePriceBelowMax = ZERO_BD
    }
  } else {
    protocolConfig = acoPoolContract.protocolConfig() as ACOPool2__protocolConfigResult
    acoPool.withdrawOpenPositionPenalty = convertTokenToDecimal(protocolConfig.value1 as BigInt, BigInt.fromI32(5))
    acoPool.underlyingPriceAdjustPercentage = convertTokenToDecimal(protocolConfig.value2 as BigInt, BigInt.fromI32(5))
    acoPool.fee = convertTokenToDecimal(protocolConfig.value3 as BigInt, BigInt.fromI32(5))
    acoPool.maximumOpenAco = protocolConfig.value4 as BigInt
    acoPool.feeDestination = protocolConfig.value5 as Address
    acoPool.assetConverter = protocolConfig.value6 as Address
    let acoPermissionConfig = acoPoolContract.acoPermissionConfig() as ACOPool2__acoPermissionConfigResult
    acoPool.tolerancePriceBelowMin = convertTokenToDecimal(acoPermissionConfig.value0 as BigInt, BigInt.fromI32(5))
    acoPool.tolerancePriceBelowMax = convertTokenToDecimal(acoPermissionConfig.value1 as BigInt, BigInt.fromI32(5))
    acoPool.tolerancePriceAboveMin = convertTokenToDecimal(acoPermissionConfig.value2 as BigInt, BigInt.fromI32(5))
    acoPool.tolerancePriceAboveMax = convertTokenToDecimal(acoPermissionConfig.value3 as BigInt, BigInt.fromI32(5))
    acoPool.minExpiration = acoPermissionConfig.value4 as BigInt
    acoPool.maxExpiration = acoPermissionConfig.value5 as BigInt
  }

  if (implementation != ACO_POOL_IMPL_V1_ADDRESS) {
    acoPool.lendingPool = acoPoolContract.lendingPool()
    if (implementation == ACO_POOL_IMPL_V2_ADDRESS || implementation == ACO_POOL_IMPL_V3_ADDRESS) {
      acoPool.lendingPoolReferral = BigInt.fromI32(acoPoolContract.lendingPoolReferral() as i32)
    } else {
      acoPool.lendingPoolReferral = BigInt.fromI32(protocolConfig.value0 as i32)
    }
  }
  if (implementation == ACO_POOL_IMPL_V3_ADDRESS) {
    let poolAdmin = acoPoolContract.try_admin()
    if (!poolAdmin.reverted) {
      acoPool.poolAdmin = poolAdmin.value as Address
    }
  } else if (implementation != ACO_POOL_IMPL_V1_ADDRESS && implementation != ACO_POOL_IMPL_V2_ADDRESS) {
    let poolAdmin = acoPoolContract.try_poolAdmin()
    if (!poolAdmin.reverted) {
      acoPool.poolAdmin = poolAdmin.value as Address
    }
  }
  if (acoPool.poolAdmin != null) {
    acoPool.poolAdminsHistoryCount = ONE_BI
  } else {
    acoPool.poolAdminsHistoryCount = ZERO_BI
  }

  setAssetConverterHelper(event.transaction, event.block, acoPool.assetConverter, event.params.underlying, event.params.strikeAsset)

  ACOPoolTemplate.create(event.params.acoPool)
  acoPool.save()

  acoPool.lastStrategyHistoryId = setAcoPoolStrategyHistory(event.params.acoPool, acoPool.strategy, event.transaction, tx)
  acoPool.lastBaseVolatilityHistoryId = setAcoPoolBaseVolatilityHistory(event.params.acoPool, acoPool.baseVolatility, event.transaction, tx)
  acoPool.lastAcoPoolPermissionHistoryId = setAcoPoolPermissionHistory(event.params.acoPool, acoPool.tolerancePriceBelowMin, acoPool.tolerancePriceBelowMax, acoPool.tolerancePriceAboveMin, acoPool.tolerancePriceAboveMax, acoPool.minExpiration, acoPool.maxExpiration, event.transaction, tx)
  if (acoPool.poolAdmin != null) {
    acoPool.lastPoolAdminHistoryId = setAcoPoolAdminHistory(event.params.acoPool, acoPool.poolAdmin as Bytes, event.transaction, tx)
  }
  acoPool.save()
}

function setACOPoolFactory(pool: Address): void {
  let acoPoolFactory = ACOPoolFactory2.load(ACO_POOL_FACTORY_ADDRESS) as ACOPoolFactory2
  if (acoPoolFactory == null) {
    acoPoolFactory = new ACOPoolFactory2(ACO_POOL_FACTORY_ADDRESS) as ACOPoolFactory2
    acoPoolFactory.pools = [pool.toHexString()]
    acoPoolFactory.activeAcos = []
    ACOPoolFactoryTemplate.create(Address.fromString(ACO_POOL_FACTORY_ADDRESS))
    acoPoolFactory.save()
  } else {
    let pools = acoPoolFactory.pools
    acoPoolFactory.pools = pools.concat([pool.toHexString()])
    acoPoolFactory.save()
  }
}