import { Address, BigDecimal, BigInt, Bytes, ethereum, log } from '@graphprotocol/graph-ts'
import { 
  ACOToken, 
  Transaction, 
  Token, 
  ACOSwap, 
  ACOPool2,
  PoolSwap,
  PoolAccount,
  CollateralRestore,
  ACORedeem,
  ACOAmount,
  Withdrawal,
  Deposit,
  ACOCreatorPermission,
  ACOOnPool,
  ACOPoolPermission,
  ACOPoolBaseVolatility,
  ACOPoolStrategy,
  ACOPoolAdmin,
  AggregatorInterface,
  PoolDynamicData,
  ACOPoolDynamicData,
  ACOPoolFactory2,
  PoolHistoricalShare
} from '../types/schema'
import { 
  Swap, 
  Transfer,
  RestoreCollateral,
  ACORedeem as ACORedeemEvent,
  Deposit as DepositEvent,
  Withdraw,
  SetStrategy,
  SetBaseVolatility,
  SetValidAcoCreator,
  SetPoolAdmin,
  SetForbiddenAcoCreator,
  SetAcoPermissionConfig,
  SetProtocolConfig,
  SetLendingPoolReferral,
  SetPoolDataForAcoPermission,
  SetFeeData,
  SetAssetConverter,
  SetTolerancePriceAbove,
  SetTolerancePriceBelow,
  SetMinExpiration,
  SetMaxExpiration,
  SetWithdrawOpenPositionPenalty,
  SetUnderlyingPriceAdjustPercentage,
  SetMaximumOpenAco,
  SetFee,
  SetFeeDestination,
  SetImplementation,
  SetAcoPermissionConfigV2
} from '../types/templates/ACOPool2/ACOPool2'
import {
  getToken,
  getTransaction,
  ONE_BI,
  ONE_BD,
  convertTokenToDecimal,
  ZERO_BD,
  ADDRESS_ZERO,
  getCollateralAmount,
  ZERO_BI,
  setAssetConverterHelper,
  ACO_POOL_IMPL_V1_ADDRESS,
  ACO_POOL_IMPL_V2_ADDRESS,
  MINIMUM_POOL_COLLATERAL_VALUE,
  convertDecimalToToken,
  getAggregatorInterface,
  ACO_POOL_FACTORY_ADDRESS,
  MINIMUM_POOL_SHARE_UPDATE
} from './helpers'
import { ACOPool2 as ACOPool2Contract } from '../types/templates/ACOPool2/ACOPool2'
import { ACOToken as ACOTokenContract } from '../types/templates/ACOPool2/ACOToken'
import { ACOPoolStrategy as ACOPoolStrategyContract, ACOPoolStrategy__quoteInputQuoteDataStruct } from '../types/templates/ACOPool2/ACOPoolStrategy'

export function handleImplementationChange(event: SetImplementation): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  pool.implementation = event.params.newImplementation
  pool.save()
}

export function handleTransfer(event: Transfer): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  let tokenAmount = convertTokenToDecimal(event.params.value, pool.decimals)

  if (tokenAmount.gt(ZERO_BD)) {

    let isMint = event.params.from.toHexString() == ADDRESS_ZERO
    let isBurn = event.params.to.toHexString() == ADDRESS_ZERO

    if (isMint) {
      pool.totalSupply = pool.totalSupply.plus(tokenAmount)
      pool.save()
    } else {
      let from = getPoolAccount(pool, event.params.from) as PoolAccount
      from.balance = from.balance.minus(tokenAmount)
      if (from.balance.equals(ZERO_BD)) {
        pool.holdersCount = pool.holdersCount.minus(ONE_BI)
        pool.save()
      }
      from.save()
    }

    if (isBurn) {
      pool.totalSupply = pool.totalSupply.minus(tokenAmount)
      pool.save()
    } else {
      let to = getPoolAccount(pool, event.params.to) as PoolAccount
      if (to.balance.equals(ZERO_BD)) {
        pool.holdersCount = pool.holdersCount.plus(ONE_BI)
        pool.save()
      }
      to.balance = to.balance.plus(tokenAmount)
      to.save()
    }

    updatePoolDynamicData(event, pool)
  }
}

export function handleSwap(event: Swap): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  let aco = ACOToken.load(event.params.acoToken.toHexString()) as ACOToken
  let strikeAsset = getToken(Address.fromString(aco.strikeAsset)) as Token
  let acoOnPool = ACOOnPool.load(event.address.toHexString() + "-" + event.params.acoToken.toHexString()) as ACOOnPool

  let price = convertTokenToDecimal(event.params.price, strikeAsset.decimals) as BigDecimal
  let acoAmount = convertTokenToDecimal(event.params.tokenAmount, aco.decimals) as BigDecimal
  let collateralAmount = getCollateralAmount(acoAmount, aco.isCall, aco.strikePrice) as BigDecimal
  let fee = convertTokenToDecimal(event.params.protocolFee, strikeAsset.decimals) as BigDecimal
  let volatility = convertTokenToDecimal(event.params.volatility, BigInt.fromI32(5)) as BigDecimal
  let underlyingPrice = convertTokenToDecimal(event.params.underlyingPrice, strikeAsset.decimals) as BigDecimal

  let tx = getTransaction(event) as Transaction
  let acoSwap = new ACOSwap(event.params.acoToken.toHexString() + "-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString() + "-0") as ACOSwap
  acoSwap.aco = aco.id
  acoSwap.seller = event.address
  acoSwap.buyer = event.params.account
  acoSwap.taker = event.params.account
  acoSwap.type = "Pool"
  acoSwap.paymentToken = strikeAsset.id
  acoSwap.paymentAmount = price
  acoSwap.acoAmount = acoAmount
  acoSwap.tx = tx.id
  acoSwap.save()
  aco.swapsCount = aco.swapsCount.plus(ONE_BI)
  aco.lastSwapId = acoSwap.id
  aco.save()

  let poolSwap = new PoolSwap(event.address.toHexString() + "-" + event.params.account.toHexString() + "-" + event.transaction.hash.toHexString()) as PoolSwap
  poolSwap.aco = aco.id
  poolSwap.pool = pool.id
  poolSwap.account = event.params.account
  poolSwap.acoAmount = acoAmount
  poolSwap.paymentAmount = price
  poolSwap.protocolFee = fee
  poolSwap.underlyingPrice = underlyingPrice
  poolSwap.volatility = volatility
  poolSwap.collateralLocked = (aco.isCall ? acoAmount : acoAmount.times(aco.strikePrice))
  poolSwap.tx = tx.id
  poolSwap.save()

  if (acoOnPool == null) {
    acoOnPool = new ACOOnPool(event.address.toHexString() + "-" + event.params.acoToken.toHexString()) as ACOOnPool
    acoOnPool.pool = pool.id
    acoOnPool.aco = aco.id
    acoOnPool.isOpen = true
    acoOnPool.acoAmount = acoAmount
    acoOnPool.collateralLocked = collateralAmount
    acoOnPool.valueSold = price.minus(fee)
    acoOnPool.collateralRedeemed = ZERO_BD
    pool.openAcosCount = pool.openAcosCount.plus(ONE_BI)
    pool.acosCount = pool.acosCount.plus(ONE_BI)
    pool.lastAcoId = acoOnPool.id
  } else {
    acoOnPool.acoAmount = acoOnPool.acoAmount.plus(acoAmount)
    acoOnPool.collateralLocked = acoOnPool.collateralLocked.plus(collateralAmount)
    acoOnPool.valueSold = acoOnPool.valueSold.plus(price.minus(fee))
  }
  acoOnPool.save()
  pool.swapsCount = pool.swapsCount.plus(ONE_BI)
  pool.lastSwapId = poolSwap.id
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleRestoreCollateral(event: RestoreCollateral): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  let strikeAsset = getToken(Address.fromString(pool.strikeAsset)) as Token
  let underlying = getToken(Address.fromString(pool.underlying)) as Token

  let collateralDecimals = ZERO_BI as BigInt
  let soldAssetDecimals = ZERO_BI as BigInt
  if (pool.isCall == true) {
    collateralDecimals = underlying.decimals
    soldAssetDecimals = strikeAsset.decimals
  } else {
    collateralDecimals = strikeAsset.decimals
    soldAssetDecimals = underlying.decimals
  }

  let tx = getTransaction(event) as Transaction
  let collateralRestore = new CollateralRestore(event.address.toHexString() + "-" + event.transaction.hash.toHexString()) as CollateralRestore
  collateralRestore.pool = pool.id
  collateralRestore.caller = event.transaction.from
  collateralRestore.tx = tx.id
  collateralRestore.amountSold = convertTokenToDecimal(event.params.amountOut, soldAssetDecimals)
  collateralRestore.collateralRestored = convertTokenToDecimal(event.params.collateralRestored, collateralDecimals)
  collateralRestore.save()
  pool.collateralRestoresCount = pool.collateralRestoresCount.plus(ONE_BI)
  pool.lastCollateralRestoreId = collateralRestore.id
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleACORedeem(event: ACORedeemEvent): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  let aco = ACOToken.load(event.params.acoToken.toHexString()) as ACOToken
  let acoOnPool = ACOOnPool.load(event.address.toHexString() + "-" + event.params.acoToken.toHexString()) as ACOOnPool
  let collateral = getToken(Address.fromString(pool.collateral)) as Token

  let collateralRedeemed = convertTokenToDecimal(event.params.collateralRedeemed, collateral.decimals)

  let tx = getTransaction(event) as Transaction
  let acoRedeem = new ACORedeem(event.address.toHexString() + "-" + event.params.acoToken.toHexString() + "-" + event.transaction.hash.toHexString()) as ACORedeem
  acoRedeem.pool = pool.id
  acoRedeem.aco = aco.id
  acoRedeem.caller = event.transaction.from
  acoRedeem.tx = tx.id
  acoRedeem.collateralRedeemed = collateralRedeemed
  acoRedeem.save()
  acoOnPool.isOpen = false
  acoOnPool.collateralRedeemed = collateralRedeemed
  acoOnPool.save()
  pool.openAcosCount = pool.openAcosCount.minus(ONE_BI)
  pool.acoRedeemsCount = pool.acoRedeemsCount.plus(ONE_BI)
  pool.lastAcoRedeemId = acoRedeem.id
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleDeposit(event: DepositEvent): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  let collateral = getToken(Address.fromString(pool.collateral)) as Token

  let tx = getTransaction(event) as Transaction
  let deposit = new Deposit(event.address.toHexString() + "-" + event.params.account.toHexString() + "-" + event.transaction.hash.toHexString()) as Deposit
  deposit.pool = pool.id
  deposit.account = event.params.account
  deposit.tx = tx.id
  deposit.shares = convertTokenToDecimal(event.params.shares, pool.decimals)
  deposit.collateralAmount = convertTokenToDecimal(event.params.collateralAmount, collateral.decimals)
  deposit.save()
  pool.depositsCount = pool.depositsCount.plus(ONE_BI)
  pool.lastDepositId = deposit.id
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleWithdraw(event: Withdraw): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  let underlying = getToken(Address.fromString(pool.underlying)) as Token
  let strikeAsset = getToken(Address.fromString(pool.strikeAsset)) as Token

  let tx = getTransaction(event) as Transaction
  let withdrawal = new Withdrawal(event.address.toHexString() + "-" + event.params.account.toHexString() + "-" + event.transaction.hash.toHexString()) as Withdrawal
  withdrawal.pool = pool.id
  withdrawal.account = event.params.account
  withdrawal.tx = tx.id
  withdrawal.shares = convertTokenToDecimal(event.params.shares, pool.decimals)
  withdrawal.noLocked = event.params.noLocked
  withdrawal.underlyingWithdrawn = convertTokenToDecimal(event.params.underlyingWithdrawn, underlying.decimals)
  withdrawal.strikeAssetWithdrawn = convertTokenToDecimal(event.params.strikeAssetWithdrawn, strikeAsset.decimals)
  withdrawal.openAcosCount = BigInt.fromI32(event.params.acos.length)
  withdrawal.save()
  if (event.params.acos.length > 0) {
    let acos = event.params.acos.reverse() as Address[]
    let amounts = event.params.acosAmount.reverse() as BigInt[]
    for (let i = 0 as i32; i < acos.length; ++i) {
      let acoAmount = new ACOAmount(event.address.toHexString() + "-" + event.params.account.toHexString() + "-" + acos[i].toHexString() + "-" + event.transaction.hash.toHexString()) as ACOAmount
      acoAmount.withdrawal = withdrawal.id
      acoAmount.aco = acos[i].toHexString()
      acoAmount.amount = convertTokenToDecimal(amounts[i], pool.decimals)
      acoAmount.save()
    }
  }
  pool.withdrawalsCount = pool.withdrawalsCount.plus(ONE_BI)
  pool.lastWithdrawalId = withdrawal.id
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleNewStrategy(event: SetStrategy): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  let tx = getTransaction(event) as Transaction
  let historyId = setAcoPoolStrategyHistory(event.address, event.params.newStrategy, event.transaction, tx)
  pool.strategiesHistoryCount = pool.strategiesHistoryCount.plus(ONE_BI) 
  pool.lastStrategyHistoryId = historyId
  pool.strategy = event.params.newStrategy
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleNewBaseVolatility(event: SetBaseVolatility): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  let baseVolatility = convertTokenToDecimal(event.params.newBaseVolatility, BigInt.fromI32(5))
  let tx = getTransaction(event) as Transaction
  let historyId = setAcoPoolBaseVolatilityHistory(event.address, baseVolatility, event.transaction, tx)
  pool.baseVolatilitiesHistoryCount = pool.baseVolatilitiesHistoryCount.plus(ONE_BI) 
  pool.lastBaseVolatilityHistoryId = historyId
  pool.baseVolatility = baseVolatility
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleValidAcoCreator(event: SetValidAcoCreator): void {
  setAcoCreatorPermission(event, event.address, event.params.creator, event.params.newPermission, null as boolean)
}

export function handleForbiddenAcoCreator(event: SetForbiddenAcoCreator): void {
  setAcoCreatorPermission(event, event.address, event.params.creator, null as boolean, event.params.newStatus)
}

export function handleNewPoolAdmin(event: SetPoolAdmin): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  let tx = getTransaction(event) as Transaction
  let historyId = setAcoPoolAdminHistory(event.address, event.params.newAdmin, event.transaction, tx)
  pool.poolAdminsHistoryCount = pool.poolAdminsHistoryCount.plus(ONE_BI) 
  pool.lastPoolAdminHistoryId = historyId
  pool.poolAdmin = event.params.newAdmin
  pool.save()
}

export function handleNewAcoPermissionConfig(event: SetAcoPermissionConfig): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  
  let tolerancePriceAboveMax = convertTokenToDecimal(event.params.newConfig.tolerancePriceAboveMax, BigInt.fromI32(5))
  let tolerancePriceAboveMin = convertTokenToDecimal(event.params.newConfig.tolerancePriceAboveMin, BigInt.fromI32(5))
  let tolerancePriceBelowMax = convertTokenToDecimal(event.params.newConfig.tolerancePriceBelowMax, BigInt.fromI32(5))
  let tolerancePriceBelowMin = convertTokenToDecimal(event.params.newConfig.tolerancePriceBelowMin, BigInt.fromI32(5))
  let minExpiration = event.params.newConfig.minExpiration
  let maxExpiration = event.params.newConfig.maxExpiration

  let tx = getTransaction(event) as Transaction
  let historyId = setAcoPoolPermissionHistory(event.address, tolerancePriceBelowMin, tolerancePriceBelowMax, tolerancePriceAboveMin, tolerancePriceAboveMax, ZERO_BD, ZERO_BD, minExpiration, maxExpiration, event.transaction, tx)

  pool.acoPoolPermissionsHistoryCount = pool.acoPoolPermissionsHistoryCount.plus(ONE_BI) 
  pool.lastAcoPoolPermissionHistoryId = historyId
  pool.maxExpiration = maxExpiration
  pool.minExpiration = minExpiration
  pool.tolerancePriceAboveMax = tolerancePriceAboveMax
  pool.tolerancePriceAboveMin = tolerancePriceAboveMin
  pool.tolerancePriceBelowMax = tolerancePriceBelowMax
  pool.tolerancePriceBelowMin = tolerancePriceBelowMin
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleNewAcoPermissionConfigV2(event: SetAcoPermissionConfigV2): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  let strikeAsset = Token.load(pool.strikeAsset) as Token
  
  let tolerancePriceAboveMax = convertTokenToDecimal(event.params.newConfig.tolerancePriceAboveMax, BigInt.fromI32(5))
  let tolerancePriceAboveMin = convertTokenToDecimal(event.params.newConfig.tolerancePriceAboveMin, BigInt.fromI32(5))
  let tolerancePriceBelowMax = convertTokenToDecimal(event.params.newConfig.tolerancePriceBelowMax, BigInt.fromI32(5))
  let tolerancePriceBelowMin = convertTokenToDecimal(event.params.newConfig.tolerancePriceBelowMin, BigInt.fromI32(5))
  let minStrikePrice = convertTokenToDecimal(event.params.newConfig.minStrikePrice as BigInt, strikeAsset.decimals)
  let maxStrikePrice = convertTokenToDecimal(event.params.newConfig.maxStrikePrice as BigInt, strikeAsset.decimals)
  let minExpiration = event.params.newConfig.minExpiration
  let maxExpiration = event.params.newConfig.maxExpiration

  let tx = getTransaction(event) as Transaction
  let historyId = setAcoPoolPermissionHistory(event.address, tolerancePriceBelowMin, tolerancePriceBelowMax, tolerancePriceAboveMin, tolerancePriceAboveMax, minStrikePrice, maxStrikePrice, minExpiration, maxExpiration, event.transaction, tx)

  pool.acoPoolPermissionsHistoryCount = pool.acoPoolPermissionsHistoryCount.plus(ONE_BI) 
  pool.lastAcoPoolPermissionHistoryId = historyId
  pool.maxExpiration = maxExpiration
  pool.minExpiration = minExpiration
  pool.minStrikePrice = minStrikePrice
  pool.maxStrikePrice = maxStrikePrice
  pool.tolerancePriceAboveMax = tolerancePriceAboveMax
  pool.tolerancePriceAboveMin = tolerancePriceAboveMin
  pool.tolerancePriceBelowMax = tolerancePriceBelowMax
  pool.tolerancePriceBelowMin = tolerancePriceBelowMin
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleNewProtocolConfig(event: SetProtocolConfig): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  if (pool.assetConverter.toHexString() != event.params.newConfig.assetConverter.toHexString()) {
    setAssetConverterHelper(event.transaction, event.block, event.logIndex, event.params.newConfig.assetConverter, Address.fromString(pool.underlying), Address.fromString(pool.strikeAsset))
  } 
  pool.assetConverter = event.params.newConfig.assetConverter
  pool.maximumOpenAco = event.params.newConfig.maximumOpenAco
  pool.lendingPoolReferral = event.params.newConfig.lendingPoolReferral as BigInt
  pool.feeDestination = event.params.newConfig.feeDestination
  pool.fee = convertTokenToDecimal(event.params.newConfig.fee, BigInt.fromI32(5))
  pool.underlyingPriceAdjustPercentage = convertTokenToDecimal(event.params.newConfig.underlyingPriceAdjustPercentage, BigInt.fromI32(5))
  pool.withdrawOpenPositionPenalty = convertTokenToDecimal(event.params.newConfig.withdrawOpenPositionPenalty, BigInt.fromI32(5))
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleNewLendingPoolReferral(event: SetLendingPoolReferral): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  pool.lendingPoolReferral = event.params.newLendingPoolReferral
  pool.save()
}

export function handleNewPoolDataForAcoPermission(event: SetPoolDataForAcoPermission): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  let newTolerancePriceAbove = convertTokenToDecimal(event.params.newTolerancePriceAbove, BigInt.fromI32(5))
  let newTolerancePriceBelow = convertTokenToDecimal(event.params.newTolerancePriceBelow, BigInt.fromI32(5))
  pool.minExpiration = event.params.newMinExpiration
  pool.maxExpiration = event.params.newMaxExpiration
  if (newTolerancePriceAbove.equals(ZERO_BD) && newTolerancePriceBelow.equals(ZERO_BD)) {
    pool.tolerancePriceAboveMax = ZERO_BD
    pool.tolerancePriceAboveMin = ZERO_BD
    pool.tolerancePriceBelowMin = ZERO_BD
    pool.tolerancePriceBelowMax = ZERO_BD
  } else if (newTolerancePriceAbove.gt(ZERO_BD) && newTolerancePriceBelow.gt(ZERO_BD)) {
    pool.tolerancePriceAboveMax = newTolerancePriceAbove
    pool.tolerancePriceAboveMin = ZERO_BD
    pool.tolerancePriceBelowMin = ZERO_BD
    pool.tolerancePriceBelowMax = newTolerancePriceBelow
  } else if (newTolerancePriceAbove.gt(ZERO_BD)) {
    pool.tolerancePriceAboveMax = ZERO_BD
    pool.tolerancePriceAboveMin = newTolerancePriceAbove
    pool.tolerancePriceBelowMin = ZERO_BD
    pool.tolerancePriceBelowMax = ZERO_BD
  } else {
    pool.tolerancePriceAboveMax = ZERO_BD
    pool.tolerancePriceAboveMin = ZERO_BD
    pool.tolerancePriceBelowMin = newTolerancePriceBelow
    pool.tolerancePriceBelowMax = ZERO_BD
  }
  let tx = getTransaction(event) as Transaction
  let historyId = setAcoPoolPermissionHistory(event.address, pool.tolerancePriceBelowMin, pool.tolerancePriceBelowMax, pool.tolerancePriceAboveMin, pool.tolerancePriceAboveMax, ZERO_BD, ZERO_BD, pool.minExpiration, pool.maxExpiration, event.transaction, tx)
  pool.acoPoolPermissionsHistoryCount = pool.acoPoolPermissionsHistoryCount.plus(ONE_BI) 
  pool.lastAcoPoolPermissionHistoryId = historyId
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleNewFeeData(event: SetFeeData): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  pool.fee = convertTokenToDecimal(event.params.newFee, BigInt.fromI32(5))
  pool.feeDestination = event.params.newFeeDestination
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleNewAssetConverter(event: SetAssetConverter): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  if (pool.assetConverter.toHexString() != event.params.newAssetConverter.toHexString()) {
    setAssetConverterHelper(event.transaction, event.block, event.logIndex, event.params.newAssetConverter, Address.fromString(pool.underlying), Address.fromString(pool.strikeAsset))
  } 
  pool.assetConverter = event.params.newAssetConverter
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleNewTolerancePriceAbove(event: SetTolerancePriceAbove): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  let newValue = convertTokenToDecimal(event.params.newTolerancePriceAbove, BigInt.fromI32(5))
  if (newValue.equals(ZERO_BD)) {
    if (pool.tolerancePriceBelowMax.gt(ZERO_BD)) {
      pool.tolerancePriceBelowMin = pool.tolerancePriceBelowMax
      pool.tolerancePriceBelowMax = ZERO_BD
    }
    pool.tolerancePriceAboveMin = ZERO_BD
    pool.tolerancePriceAboveMax = ZERO_BD
  } else if (pool.tolerancePriceBelowMax.equals(ZERO_BD) && pool.tolerancePriceBelowMin.equals(ZERO_BD)) {
    pool.tolerancePriceAboveMin = newValue
    pool.tolerancePriceAboveMax = ZERO_BD
  } else {
    if (pool.tolerancePriceBelowMin.gt(ZERO_BD)) {
      pool.tolerancePriceBelowMax = pool.tolerancePriceBelowMin
    }
    pool.tolerancePriceAboveMax = newValue
    pool.tolerancePriceAboveMin = ZERO_BD
    pool.tolerancePriceBelowMin = ZERO_BD
  }
  let tx = getTransaction(event) as Transaction
  let historyId = setAcoPoolPermissionHistory(event.address, pool.tolerancePriceBelowMin, pool.tolerancePriceBelowMax, pool.tolerancePriceAboveMin, pool.tolerancePriceAboveMax, ZERO_BD, ZERO_BD, pool.minExpiration, pool.maxExpiration, event.transaction, tx)
  pool.acoPoolPermissionsHistoryCount = pool.acoPoolPermissionsHistoryCount.plus(ONE_BI) 
  pool.lastAcoPoolPermissionHistoryId = historyId
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleNewTolerancePriceBelow(event: SetTolerancePriceBelow): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  let newValue = convertTokenToDecimal(event.params.newTolerancePriceBelow, BigInt.fromI32(5))
  if (newValue.equals(ZERO_BD)) {
    if (pool.tolerancePriceAboveMax.gt(ZERO_BD)) {
      pool.tolerancePriceAboveMin = pool.tolerancePriceAboveMax
      pool.tolerancePriceAboveMax = ZERO_BD
    }
    pool.tolerancePriceBelowMin = ZERO_BD
    pool.tolerancePriceBelowMax = ZERO_BD
  } else if (pool.tolerancePriceAboveMax.equals(ZERO_BD) && pool.tolerancePriceAboveMin.equals(ZERO_BD)) {
    pool.tolerancePriceBelowMin = newValue
    pool.tolerancePriceBelowMax = ZERO_BD
  } else {
    if (pool.tolerancePriceAboveMin.gt(ZERO_BD)) {
      pool.tolerancePriceAboveMax = pool.tolerancePriceAboveMin
    }
    pool.tolerancePriceBelowMax = newValue
    pool.tolerancePriceBelowMin = ZERO_BD
    pool.tolerancePriceAboveMin = ZERO_BD
  }
  let tx = getTransaction(event) as Transaction
  let historyId = setAcoPoolPermissionHistory(event.address, pool.tolerancePriceBelowMin, pool.tolerancePriceBelowMax, pool.tolerancePriceAboveMin, pool.tolerancePriceAboveMax, ZERO_BD, ZERO_BD, pool.minExpiration, pool.maxExpiration, event.transaction, tx)
  pool.acoPoolPermissionsHistoryCount = pool.acoPoolPermissionsHistoryCount.plus(ONE_BI) 
  pool.lastAcoPoolPermissionHistoryId = historyId
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleNewMinExpiration(event: SetMinExpiration): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  pool.minExpiration = event.params.newMinExpiration
  let tx = getTransaction(event) as Transaction
  let historyId = setAcoPoolPermissionHistory(event.address, pool.tolerancePriceBelowMin, pool.tolerancePriceBelowMax, pool.tolerancePriceAboveMin, pool.tolerancePriceAboveMax, ZERO_BD, ZERO_BD, pool.minExpiration, pool.maxExpiration, event.transaction, tx)
  pool.acoPoolPermissionsHistoryCount = pool.acoPoolPermissionsHistoryCount.plus(ONE_BI) 
  pool.lastAcoPoolPermissionHistoryId = historyId
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleNewMaxExpiration(event: SetMaxExpiration): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  pool.maxExpiration = event.params.newMaxExpiration
  let tx = getTransaction(event) as Transaction
  let historyId = setAcoPoolPermissionHistory(event.address, pool.tolerancePriceBelowMin, pool.tolerancePriceBelowMax, pool.tolerancePriceAboveMin, pool.tolerancePriceAboveMax, ZERO_BD, ZERO_BD, pool.minExpiration, pool.maxExpiration, event.transaction, tx)
  pool.acoPoolPermissionsHistoryCount = pool.acoPoolPermissionsHistoryCount.plus(ONE_BI) 
  pool.lastAcoPoolPermissionHistoryId = historyId
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleNewWithdrawOpenPositionPenalty(event: SetWithdrawOpenPositionPenalty): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  pool.withdrawOpenPositionPenalty = convertTokenToDecimal(event.params.newWithdrawOpenPositionPenalty, BigInt.fromI32(5))
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleNewUnderlyingPriceAdjustPercentage(event: SetUnderlyingPriceAdjustPercentage): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  pool.underlyingPriceAdjustPercentage = convertTokenToDecimal(event.params.newUnderlyingPriceAdjustPercentage, BigInt.fromI32(5))
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleNewMaximumOpenAco(event: SetMaximumOpenAco): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  pool.maximumOpenAco = event.params.newMaximumOpenAco
  pool.save()
}

export function handleNewFee(event: SetFee): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  pool.fee = convertTokenToDecimal(event.params.newFee, BigInt.fromI32(5))
  pool.save()

  updatePoolDynamicData(event, pool)
}

export function handleNewFeeDestination(event: SetFeeDestination): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  pool.feeDestination = event.params.newFeeDestination
  pool.save()
}

function getPoolAccount(pool: ACOPool2, account: Bytes): PoolAccount {
  let id = pool.id + "-" + account.toHexString()
  let acc = PoolAccount.load(id) as PoolAccount
  if (acc == null) {
    acc = new PoolAccount(id) as PoolAccount
    acc.account = account
    acc.pool = pool.id
    acc.balance = ZERO_BD
    acc.save()
    pool.accountsCount = pool.accountsCount.plus(ONE_BI)
    pool.lastAccountId = acc.id
    pool.save()
  }
  return acc
}

function setAcoCreatorPermission(event: ethereum.Event, poolAddress: Address, creator: Address, isValid: boolean, isForbidden: boolean): void {
  let pool = ACOPool2.load(poolAddress.toHexString()) as ACOPool2
  let acoCreatorPermission = ACOCreatorPermission.load(poolAddress.toHexString() + "-" + creator.toHexString()) as ACOCreatorPermission
  if (acoCreatorPermission == null) {
    acoCreatorPermission = new ACOCreatorPermission(poolAddress.toHexString() + "-" + creator.toHexString()) as ACOCreatorPermission
    acoCreatorPermission.pool = pool.id
    acoCreatorPermission.creator = creator
    acoCreatorPermission.isValid = false
    acoCreatorPermission.isForbidden = false
    pool.acoCreatorsPermissionCount = pool.acoCreatorsPermissionCount.plus(ONE_BI)
    pool.lastAcoCreatorPermissionId = acoCreatorPermission.id
    pool.save()
  }
  if (isValid != null) {
    acoCreatorPermission.isValid = isValid
  }
  if (isForbidden != null) {
    acoCreatorPermission.isForbidden = isForbidden
  }
  acoCreatorPermission.save()
  
  updatePoolDynamicData(event, pool)
}

export function setAcoPoolPermissionHistory(
  poolAddress: Address, 
  tolerancePriceBelowMin: BigDecimal,
  tolerancePriceBelowMax: BigDecimal,
  tolerancePriceAboveMin: BigDecimal,
  tolerancePriceAboveMax: BigDecimal,
  minStrikePrice: BigDecimal,
  maxStrikePrice: BigDecimal,
  minExpiration: BigInt,
  maxExpiration: BigInt,
  eventTx: ethereum.Transaction, 
  tx: Transaction): string {
  let permission = new ACOPoolPermission(poolAddress.toHexString() + "-" + eventTx.hash.toHexString()) as ACOPoolPermission
  permission.pool = poolAddress.toHexString()
  permission.caller = eventTx.from
  permission.tx = tx.id
  permission.tolerancePriceBelowMin = tolerancePriceBelowMin
  permission.tolerancePriceBelowMax = tolerancePriceBelowMax
  permission.tolerancePriceAboveMin = tolerancePriceAboveMin
  permission.tolerancePriceAboveMax = tolerancePriceAboveMax
  permission.minStrikePrice = minStrikePrice
  permission.maxStrikePrice = maxStrikePrice
  permission.minExpiration = minExpiration
  permission.maxExpiration = maxExpiration
  permission.save()
  return permission.id
}

export function setAcoPoolBaseVolatilityHistory(
  poolAddress: Address, 
  baseVolatility: BigDecimal,
  eventTx: ethereum.Transaction, 
  tx: Transaction): string {
  let bv = new ACOPoolBaseVolatility(poolAddress.toHexString() + "-" + eventTx.hash.toHexString()) as ACOPoolBaseVolatility
  bv.pool = poolAddress.toHexString()
  bv.caller = eventTx.from
  bv.tx = tx.id
  bv.baseVolatility = baseVolatility
  bv.save()
  return bv.id
}

export function setAcoPoolStrategyHistory(
  poolAddress: Address, 
  strategy: Bytes,
  eventTx: ethereum.Transaction, 
  tx: Transaction): string {
  let strg = new ACOPoolStrategy(poolAddress.toHexString() + "-" + eventTx.hash.toHexString()) as ACOPoolStrategy
  strg.pool = poolAddress.toHexString()
  strg.caller = eventTx.from
  strg.tx = tx.id
  strg.strategy = strategy
  strg.save()
  return strg.id
}

export function setAcoPoolAdminHistory(
  poolAddress: Address, 
  admin: Bytes,
  eventTx: ethereum.Transaction, 
  tx: Transaction): string {
  let adm = new ACOPoolAdmin(poolAddress.toHexString() + "-" + eventTx.hash.toHexString()) as ACOPoolAdmin
  adm.pool = poolAddress.toHexString()
  adm.caller = eventTx.from
  adm.tx = tx.id
  adm.poolAdmin = admin
  adm.save()
  return adm.id
}

function updatePoolDynamicData(event: ethereum.Event, pool: ACOPool2): void {
  if (pool.implementation.toHexString() != ACO_POOL_IMPL_V1_ADDRESS && pool.implementation.toHexString() != ACO_POOL_IMPL_V2_ADDRESS) {
    let agg = getAggregatorInterface(event, pool.assetConverter, Address.fromString(pool.underlying), Address.fromString(pool.strikeAsset))
    if (agg != null) {
      let poolFactory = ACOPoolFactory2.load(ACO_POOL_FACTORY_ADDRESS) as ACOPoolFactory2
      let poolAcos = new Array<ACOToken>()
      let expiredIndexes = new Array<i32>()
      let acos = poolFactory.activeAcos
      for (let i = 0 as i32; i < acos.length; ++i) {
        let aco = ACOToken.load(acos[i]) as ACOToken
        if (event.block.timestamp.ge(aco.expiryTime)) {
          expiredIndexes.push(i)
        }
        if (aco.underlying == pool.underlying && aco.strikeAsset == pool.strikeAsset && aco.isCall == pool.isCall) {
          poolAcos.push(aco)
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
      setPoolDynamicData(event.block.timestamp, agg, pool, poolAcos.reverse())
    }
  }
}

export function setPoolDynamicData(timestamp: BigInt, agg: AggregatorInterface, pool: ACOPool2, acos: ACOToken[]): void {
  if (pool.implementation.toHexString() != ACO_POOL_IMPL_V1_ADDRESS && pool.implementation.toHexString() != ACO_POOL_IMPL_V2_ADDRESS) {
    let poolDynamicData = PoolDynamicData.load(pool.id) as PoolDynamicData
    if (poolDynamicData == null) {
      poolDynamicData = new PoolDynamicData(pool.id) as PoolDynamicData
    }
    poolDynamicData.underlyingPrice = agg.price
    poolDynamicData.tx = agg.tx

    let strikeAsset = Token.load(pool.strikeAsset) as Token
    let underlying = Token.load(pool.underlying) as Token
    let hasMinimalCollateral = false

    if (pool.totalSupply.gt(ZERO_BD)) {
      
      let poolContract = ACOPool2Contract.bind(Address.fromString(pool.id)) as ACOPool2Contract
      let generalData = poolContract.try_getGeneralData()
      if (generalData.reverted) {
        log.warning("getGeneralData: {}, {}", [pool.id,agg.tx])
        return
      }
      let notCollateralValue = ZERO_BD
      let collateralValue = ZERO_BD
      let totalSupply = convertTokenToDecimal(generalData.value.value5, pool.decimals) as BigDecimal
      
      poolDynamicData.collateralLocked = convertTokenToDecimal(generalData.value.value2, pool.decimals) as BigDecimal
      poolDynamicData.collateralOnOpenPosition = convertTokenToDecimal(generalData.value.value3, pool.decimals) as BigDecimal
      poolDynamicData.collateralLockedRedeemable = convertTokenToDecimal(generalData.value.value4, pool.decimals) as BigDecimal

      if (totalSupply.gt(ZERO_BD)) {

        poolDynamicData.underlyingBalance = convertTokenToDecimal(generalData.value.value0, underlying.decimals) as BigDecimal
        poolDynamicData.strikeAssetBalance = convertTokenToDecimal(generalData.value.value1, strikeAsset.decimals) as BigDecimal

        if (pool.isCall) {
          notCollateralValue = poolDynamicData.strikeAssetBalance
          collateralValue = agg.price.times(poolDynamicData.underlyingBalance)

          let underlyingTotalShare = poolDynamicData.underlyingBalance.plus(poolDynamicData.collateralLocked).minus(poolDynamicData.collateralOnOpenPosition.times(ONE_BD.plus(pool.withdrawOpenPositionPenalty)))
          poolDynamicData.collateralLockedValue = agg.price.times(poolDynamicData.collateralLocked)
          poolDynamicData.openPositionOptionsValue = agg.price.times(poolDynamicData.collateralOnOpenPosition).times(ONE_BD.minus(pool.underlyingPriceAdjustPercentage))
          poolDynamicData.underlyingPerShare = underlyingTotalShare.div(totalSupply)
          poolDynamicData.strikeAssetPerShare = notCollateralValue.div(totalSupply)
          poolDynamicData.underlyingTotalShare = underlyingTotalShare
          poolDynamicData.strikeAssetTotalShare = notCollateralValue
        } else {
          notCollateralValue = agg.price.times(poolDynamicData.underlyingBalance)
          collateralValue = poolDynamicData.strikeAssetBalance

          let strikeAssetTotalShare = poolDynamicData.strikeAssetBalance.plus(poolDynamicData.collateralLocked).minus(poolDynamicData.collateralOnOpenPosition.times(ONE_BD.plus(pool.withdrawOpenPositionPenalty)))
          poolDynamicData.collateralLockedValue = poolDynamicData.collateralLocked
          poolDynamicData.openPositionOptionsValue = poolDynamicData.collateralOnOpenPosition
          poolDynamicData.underlyingPerShare = poolDynamicData.underlyingBalance.div(totalSupply)
          poolDynamicData.strikeAssetPerShare = strikeAssetTotalShare.div(totalSupply)
          poolDynamicData.underlyingTotalShare = poolDynamicData.underlyingBalance
          poolDynamicData.strikeAssetTotalShare = strikeAssetTotalShare
        }
        poolDynamicData.netValue = poolDynamicData.collateralLockedValue.minus(poolDynamicData.openPositionOptionsValue)
        poolDynamicData.totalValue = collateralValue.plus(notCollateralValue).plus(poolDynamicData.netValue)
        poolDynamicData.save()

        hasMinimalCollateral = collateralValue.ge(MINIMUM_POOL_COLLATERAL_VALUE)
      } else {
        setZeroPoolDynamicData(poolDynamicData)
      }
    } else {
      setZeroPoolDynamicData(poolDynamicData)
    }
    pool.dynamicData = poolDynamicData.id
    
    setPoolHistoricalShare(timestamp, agg.tx, poolDynamicData, pool)

    setAcoPoolDynamicData(hasMinimalCollateral, timestamp, strikeAsset, underlying, agg, pool, acos)

    pool.save()
  }
}

function setZeroPoolDynamicData(poolDynamicData: PoolDynamicData): void {
  poolDynamicData.strikeAssetBalance = ZERO_BD
  poolDynamicData.underlyingBalance = ZERO_BD
  poolDynamicData.underlyingPerShare = ZERO_BD
  poolDynamicData.strikeAssetPerShare = ZERO_BD
  poolDynamicData.underlyingTotalShare = ZERO_BD
  poolDynamicData.strikeAssetTotalShare = ZERO_BD
  poolDynamicData.collateralOnOpenPosition = ZERO_BD
  poolDynamicData.collateralLockedRedeemable = ZERO_BD
  poolDynamicData.collateralLocked = ZERO_BD
  poolDynamicData.collateralLockedValue = ZERO_BD
  poolDynamicData.openPositionOptionsValue = ZERO_BD
  poolDynamicData.netValue = ZERO_BD
  poolDynamicData.totalValue = ZERO_BD
  poolDynamicData.save()
}

function setAcoPoolDynamicData(
  hasMinimalCollateral: boolean, 
  timestamp: BigInt, 
  strikeAsset: Token,
  underlying: Token,
  agg: AggregatorInterface, 
  pool: ACOPool2, 
  acos: ACOToken[]): void {

  let poolContract = ACOPool2Contract.bind(Address.fromString(pool.id)) as ACOPool2Contract

  for (let i = 0 as i32; i < acos.length; ++i) {
    let aco = acos[i] as ACOToken
    
    let acoDynamicDataId = aco.id + "-" + pool.id
    let acoDynamicData = ACOPoolDynamicData.load(acoDynamicDataId) as ACOPoolDynamicData

    let price = null as BigDecimal
    let isNew = false

    let acoContract = ACOTokenContract.bind(Address.fromString(aco.id)) as ACOTokenContract
    let collaterizedTokens = acoContract.try_currentCollateralizedTokens(Address.fromString(pool.id))
    
    if (!collaterizedTokens.reverted && collaterizedTokens.value.gt(ZERO_BI)) {
      let tokenAmount = convertTokenToDecimal(collaterizedTokens.value, underlying.decimals)
      if (tokenAmount.gt(ZERO_BD)) {
        if (acoDynamicData == null) {
          isNew = true
          acoDynamicData = new ACOPoolDynamicData(acoDynamicDataId) as ACOPoolDynamicData
          acoDynamicData.pool = pool.id
          acoDynamicData.aco = aco.id
        }
        if (timestamp.ge(aco.expiryTime)) {
          acoDynamicData.openPositionOptionsValue = ZERO_BD
          acoDynamicData.collateralLocked = ZERO_BD
          acoDynamicData.acoAmount = ZERO_BD
          acoDynamicData.collateralLockedValue = ZERO_BD
          acoDynamicData.acoOnExpire = tokenAmount
        } else {
          acoDynamicData.acoAmount = tokenAmount
          if (aco.isCall) {
            acoDynamicData.collateralLocked = tokenAmount
            acoDynamicData.collateralLockedValue = tokenAmount.times(agg.price)
          } else {
            acoDynamicData.collateralLocked = tokenAmount.times(aco.strikePrice)
            acoDynamicData.collateralLockedValue = acoDynamicData.collateralLocked
          }
          price = getPoolStrategyPrice(agg, pool, aco, strikeAsset)
          if (price != null) {
            let priceWithFee = price.times(ONE_BD.plus(pool.fee))
            acoDynamicData.openPositionOptionsValue = tokenAmount.times(priceWithFee)
          } else {
            acoDynamicData.openPositionOptionsValue = ZERO_BD
          }
        }
      } else if (acoDynamicData != null) {
        acoDynamicData.collateralLocked = ZERO_BD
        acoDynamicData.acoAmount = ZERO_BD
        acoDynamicData.collateralLockedValue = ZERO_BD
        acoDynamicData.openPositionOptionsValue = ZERO_BD
        if (timestamp.ge(aco.expiryTime)) {
          acoDynamicData.acoOnExpire = ZERO_BD
        }
      }
    } else if (acoDynamicData != null) {
      acoDynamicData.collateralLocked = ZERO_BD
      acoDynamicData.acoAmount = ZERO_BD
      acoDynamicData.collateralLockedValue = ZERO_BD
      acoDynamicData.openPositionOptionsValue = ZERO_BD
      if (timestamp.ge(aco.expiryTime)) {
        acoDynamicData.acoOnExpire = ZERO_BD
      }
    }

    if (hasMinimalCollateral && timestamp.lt(aco.expiryTime)) {
      let canSwapResult = poolContract.try_canSwap(Address.fromString(aco.id))
      if (!canSwapResult.reverted && canSwapResult.value) {
        if (price == null) {
          price = getPoolStrategyPrice(agg, pool, aco, strikeAsset)
        }
        if (price != null && acoDynamicData == null) {
          isNew = true
          acoDynamicData = new ACOPoolDynamicData(acoDynamicDataId) as ACOPoolDynamicData
          acoDynamicData.pool = pool.id
          acoDynamicData.aco = aco.id
          acoDynamicData.collateralLocked = ZERO_BD
          acoDynamicData.acoAmount = ZERO_BD
          acoDynamicData.collateralLockedValue = ZERO_BD
          acoDynamicData.openPositionOptionsValue = ZERO_BD
        }
      } else {
        price = null as BigDecimal
      }
    } else {
      price = null as BigDecimal
    }
    
    if (acoDynamicData != null) {
      if (isNew) {
        pool.acosDynamicDataCount = pool.acosDynamicDataCount.plus(ONE_BI)
        pool.lastAcoDynamicDataId = acoDynamicData.id
      }
      acoDynamicData.netValue = acoDynamicData.collateralLockedValue.minus(acoDynamicData.openPositionOptionsValue)
      acoDynamicData.price = price
      acoDynamicData.tx = agg.tx
      acoDynamicData.save()
    }
  }
}

function getPoolStrategyPrice(agg: AggregatorInterface, pool: ACOPool2, aco: ACOToken, strikeAsset: Token): BigDecimal {
  let strategy = ACOPoolStrategyContract.bind(Address.fromString(pool.strategy.toHexString())) as ACOPoolStrategyContract
  let input = new Array<ethereum.Value>()
  input.push(ethereum.Value.fromUnsignedBigInt(convertDecimalToToken(agg.price, strikeAsset.decimals)))
  input.push(ethereum.Value.fromAddress(Address.fromString(aco.underlying)))
  input.push(ethereum.Value.fromAddress(Address.fromString(aco.strikeAsset)))
  input.push(ethereum.Value.fromBoolean(aco.isCall))
  input.push(ethereum.Value.fromUnsignedBigInt(convertDecimalToToken(aco.strikePrice, strikeAsset.decimals)))
  input.push(ethereum.Value.fromUnsignedBigInt(aco.expiryTime))
  input.push(ethereum.Value.fromUnsignedBigInt(convertDecimalToToken(pool.baseVolatility, BigInt.fromI32(5))))
  input.push(ethereum.Value.fromUnsignedBigInt(ZERO_BI))
  input.push(ethereum.Value.fromUnsignedBigInt(ONE_BI))
  let quoteData = input as ACOPoolStrategy__quoteInputQuoteDataStruct
  let quote = strategy.try_quote(quoteData)
  if (!quote.reverted) {
    return convertTokenToDecimal(quote.value.value0, strikeAsset.decimals) as BigDecimal
  }
  return null as BigDecimal
}

function setPoolHistoricalShare(timestamp: BigInt, txHash: string, poolDynamicData: PoolDynamicData, pool: ACOPool2): void {
  if ((timestamp.minus(pool.lastHistoricalShareUpdate)).ge(MINIMUM_POOL_SHARE_UPDATE)) {
    if (pool.lastHistoricalShareId != null) {
      let last = PoolHistoricalShare.load(pool.lastHistoricalShareId) as PoolHistoricalShare
      if (last != null && last.underlyingPerShare.equals(poolDynamicData.underlyingPerShare) && 
        last.strikeAssetPerShare.equals(poolDynamicData.strikeAssetPerShare) &&
        last.underlyingPrice.equals(poolDynamicData.underlyingPrice)) {
        return
      }
    } 
    if (pool.lastHistoricalShareId != null || poolDynamicData.underlyingPerShare.gt(ZERO_BD) 
      || poolDynamicData.strikeAssetPerShare.gt(ZERO_BD)) {
      let historicalShare = new PoolHistoricalShare(pool.id + "-" + txHash) as PoolHistoricalShare
      historicalShare.pool = pool.id
      historicalShare.tx = txHash
      historicalShare.underlyingPerShare = poolDynamicData.underlyingPerShare
      historicalShare.strikeAssetPerShare = poolDynamicData.strikeAssetPerShare
      historicalShare.underlyingPrice = poolDynamicData.underlyingPrice
      historicalShare.save()
      
      pool.historicalSharesCount = pool.historicalSharesCount.plus(ONE_BI)
      pool.lastHistoricalShareUpdate = timestamp
      pool.lastHistoricalShareId = historicalShare.id
    }
  }
}