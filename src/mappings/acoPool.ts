import { Address, BigDecimal, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts'
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
  ACOPoolAdmin
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
  SetFeeDestination
} from '../types/templates/ACOPool2/ACOPool2'
import {
  getToken,
  getTransaction,
  ONE_BI,
  convertTokenToDecimal,
  ZERO_BD,
  ADDRESS_ZERO,
  getCollateralAmount,
  ZERO_BI
} from './helpers'

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
      let to = getPoolAccount(pool, event.params.from) as PoolAccount
      if (to.balance.equals(ZERO_BD)) {
        pool.holdersCount = pool.holdersCount.plus(ONE_BI)
        pool.save()
      }
      to.balance = to.balance.plus(tokenAmount)
      to.save()
    }
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
  let acoSwap = new ACOSwap(event.params.acoToken.toHexString() + "-" + event.address.toHexString() + "-" + event.params.account.toHexString() + "-" + event.transaction.hash.toHexString()) as ACOSwap
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
  } else {
    acoOnPool.acoAmount = acoOnPool.acoAmount.plus(acoAmount)
    acoOnPool.collateralLocked = acoOnPool.collateralLocked.plus(collateralAmount)
    acoOnPool.valueSold = acoOnPool.valueSold.plus(price.minus(fee))
  }
  acoOnPool.save()
  pool.swapsCount = pool.swapsCount.plus(ONE_BI)
  pool.save()
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
  pool.save()
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
  pool.save()
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
  pool.save()
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
  for (let i = 0 as number; i < event.params.acos.length; ++i) {
    setAcoAmount(event, i, withdrawal.id, pool.decimals)
  }
  pool.withdrawalsCount = pool.withdrawalsCount.plus(ONE_BI)
  pool.save()
}

export function handleNewStrategy(event: SetStrategy): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  let tx = getTransaction(event) as Transaction
  setAcoPoolStrategyHistory(event.address, event.params.newStrategy, event.transaction, tx)
  pool.strategiesHistoryCount = pool.strategiesHistoryCount.plus(ONE_BI) 
  pool.strategy = event.params.newStrategy
  pool.save()
}

export function handleNewBaseVolatility(event: SetBaseVolatility): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  let baseVolatility = convertTokenToDecimal(event.params.newBaseVolatility, BigInt.fromI32(5))
  let tx = getTransaction(event) as Transaction
  setAcoPoolBaseVolatilityHistory(event.address, baseVolatility, event.transaction, tx)
  pool.baseVolatilitiesHistoryCount = pool.baseVolatilitiesHistoryCount.plus(ONE_BI) 
  pool.baseVolatility = baseVolatility
  pool.save()
}

export function handleValidAcoCreator(event: SetValidAcoCreator): void {
  setAcoCreatorPermission(event.address, event.params.creator, event.params.newPermission, null as boolean)
}

export function handleForbiddenAcoCreator(event: SetForbiddenAcoCreator): void {
  setAcoCreatorPermission(event.address, event.params.creator, null as boolean, event.params.newStatus)
}

export function handleNewPoolAdmin(event: SetPoolAdmin): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  let tx = getTransaction(event) as Transaction
  setAcoPoolAdminHistory(event.address, event.params.newAdmin, event.transaction, tx)
  pool.poolAdminsHistoryCount = pool.poolAdminsHistoryCount.plus(ONE_BI) 
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
  setAcoPoolPermissionHistory(event.address, tolerancePriceBelowMin, tolerancePriceBelowMax, tolerancePriceAboveMin, tolerancePriceAboveMax, minExpiration, maxExpiration, event.transaction, tx)

  pool.acoPoolPermissionsHistoryCount = pool.acoPoolPermissionsHistoryCount.plus(ONE_BI) 
  pool.maxExpiration = maxExpiration
  pool.minExpiration = minExpiration
  pool.tolerancePriceAboveMax = tolerancePriceAboveMax
  pool.tolerancePriceAboveMin = tolerancePriceAboveMin
  pool.tolerancePriceBelowMax = tolerancePriceBelowMax
  pool.tolerancePriceBelowMin = tolerancePriceBelowMin
  pool.save()
}

export function handleNewProtocolConfig(event: SetProtocolConfig): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  pool.assetConverter = event.params.newConfig.assetConverter
  pool.maximumOpenAco = event.params.newConfig.maximumOpenAco
  pool.lendingPoolReferral = event.params.newConfig.lendingPoolReferral as BigInt
  pool.feeDestination = event.params.newConfig.feeDestination
  pool.fee = convertTokenToDecimal(event.params.newConfig.fee, BigInt.fromI32(5))
  pool.underlyingPriceAdjustPercentage = convertTokenToDecimal(event.params.newConfig.underlyingPriceAdjustPercentage, BigInt.fromI32(5))
  pool.withdrawOpenPositionPenalty = convertTokenToDecimal(event.params.newConfig.withdrawOpenPositionPenalty, BigInt.fromI32(5))
  pool.save()
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
  setAcoPoolPermissionHistory(event.address, pool.tolerancePriceBelowMin, pool.tolerancePriceBelowMax, pool.tolerancePriceAboveMin, pool.tolerancePriceAboveMax, pool.minExpiration, pool.maxExpiration, event.transaction, tx)
  pool.acoPoolPermissionsHistoryCount = pool.acoPoolPermissionsHistoryCount.plus(ONE_BI) 
  pool.save()
}

export function handleNewFeeData(event: SetFeeData): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  pool.fee = convertTokenToDecimal(event.params.newFee, BigInt.fromI32(5))
  pool.feeDestination = event.params.newFeeDestination
  pool.save()
}

export function handleNewAssetConverter(event: SetAssetConverter): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  pool.assetConverter = event.params.newAssetConverter
  pool.save()
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
  setAcoPoolPermissionHistory(event.address, pool.tolerancePriceBelowMin, pool.tolerancePriceBelowMax, pool.tolerancePriceAboveMin, pool.tolerancePriceAboveMax, pool.minExpiration, pool.maxExpiration, event.transaction, tx)
  pool.acoPoolPermissionsHistoryCount = pool.acoPoolPermissionsHistoryCount.plus(ONE_BI) 
  pool.save()
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
  setAcoPoolPermissionHistory(event.address, pool.tolerancePriceBelowMin, pool.tolerancePriceBelowMax, pool.tolerancePriceAboveMin, pool.tolerancePriceAboveMax, pool.minExpiration, pool.maxExpiration, event.transaction, tx)
  pool.acoPoolPermissionsHistoryCount = pool.acoPoolPermissionsHistoryCount.plus(ONE_BI) 
  pool.save()
}

export function handleNewMinExpiration(event: SetMinExpiration): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  pool.minExpiration = event.params.newMinExpiration
  let tx = getTransaction(event) as Transaction
  setAcoPoolPermissionHistory(event.address, pool.tolerancePriceBelowMin, pool.tolerancePriceBelowMax, pool.tolerancePriceAboveMin, pool.tolerancePriceAboveMax, pool.minExpiration, pool.maxExpiration, event.transaction, tx)
  pool.acoPoolPermissionsHistoryCount = pool.acoPoolPermissionsHistoryCount.plus(ONE_BI) 
  pool.save()
}

export function handleNewMaxExpiration(event: SetMaxExpiration): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  pool.maxExpiration = event.params.newMaxExpiration
  let tx = getTransaction(event) as Transaction
  setAcoPoolPermissionHistory(event.address, pool.tolerancePriceBelowMin, pool.tolerancePriceBelowMax, pool.tolerancePriceAboveMin, pool.tolerancePriceAboveMax, pool.minExpiration, pool.maxExpiration, event.transaction, tx)
  pool.acoPoolPermissionsHistoryCount = pool.acoPoolPermissionsHistoryCount.plus(ONE_BI) 
  pool.save()
}

export function handleNewWithdrawOpenPositionPenalty(event: SetWithdrawOpenPositionPenalty): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  pool.withdrawOpenPositionPenalty = convertTokenToDecimal(event.params.newWithdrawOpenPositionPenalty, BigInt.fromI32(5))
  pool.save()
}

export function handleNewUnderlyingPriceAdjustPercentage(event: SetUnderlyingPriceAdjustPercentage): void {
  let pool = ACOPool2.load(event.address.toHexString()) as ACOPool2
  pool.underlyingPriceAdjustPercentage = convertTokenToDecimal(event.params.newUnderlyingPriceAdjustPercentage, BigInt.fromI32(5))
  pool.save()
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
    pool.save()
  }
  return acc
}

function setAcoAmount(event: Withdraw, index: number, withdrawalId: string, poolDecimals: BigInt): void {
  let aco = event.params.acos.filter((e: Address, i: i32) => index == i)[0] as Address
  let amount = event.params.acosAmount.filter((e: BigInt, i: i32) => index == i)[0] as BigInt
  let acoAmount = new ACOAmount(event.address.toHexString() + "-" + event.params.account.toHexString() + "-" + aco.toHexString() + "-" + event.transaction.hash.toHexString()) as ACOAmount
  acoAmount.withdrawal = withdrawalId
  acoAmount.aco = aco.toHexString()
  acoAmount.amount = convertTokenToDecimal(amount, poolDecimals)
  acoAmount.save()
}

function setAcoCreatorPermission(poolAddress: Address, creator: Address, isValid: boolean, isForbidden: boolean): void {
  let pool = ACOPool2.load(poolAddress.toHexString()) as ACOPool2
  let acoCreatorPermission = ACOCreatorPermission.load(poolAddress.toHexString() + "-" + creator.toHexString()) as ACOCreatorPermission
  if (acoCreatorPermission == null) {
    acoCreatorPermission = new ACOCreatorPermission(poolAddress.toHexString() + "-" + creator.toHexString()) as ACOCreatorPermission
    acoCreatorPermission.pool = pool.id
    acoCreatorPermission.creator = creator
    acoCreatorPermission.isValid = false
    acoCreatorPermission.isForbidden = false
    pool.acoCreatorsPermissionCount = pool.acoCreatorsPermissionCount.plus(ONE_BI)
    pool.save()
  }
  if (isValid != null) {
    acoCreatorPermission.isValid = isValid
  }
  if (isForbidden != null) {
    acoCreatorPermission.isForbidden = isForbidden
  }
  acoCreatorPermission.save()
}

export function setAcoPoolPermissionHistory(
  poolAddress: Address, 
  tolerancePriceBelowMin: BigDecimal,
  tolerancePriceBelowMax: BigDecimal,
  tolerancePriceAboveMin: BigDecimal,
  tolerancePriceAboveMax: BigDecimal,
  minExpiration: BigInt,
  maxExpiration: BigInt,
  eventTx: ethereum.Transaction, 
  tx: Transaction): void {
  let permission = new ACOPoolPermission(poolAddress.toHexString() + "-" + eventTx.hash.toHexString()) as ACOPoolPermission
  permission.pool = poolAddress.toHexString()
  permission.caller = eventTx.from
  permission.tx = tx.id
  permission.tolerancePriceBelowMin = tolerancePriceBelowMin
  permission.tolerancePriceBelowMax = tolerancePriceBelowMax
  permission.tolerancePriceAboveMin = tolerancePriceAboveMin
  permission.tolerancePriceAboveMax = tolerancePriceAboveMax
  permission.minExpiration = minExpiration
  permission.maxExpiration = maxExpiration
  permission.save()
}

export function setAcoPoolBaseVolatilityHistory(
  poolAddress: Address, 
  baseVolatility: BigDecimal,
  eventTx: ethereum.Transaction, 
  tx: Transaction): void {
  let bv = new ACOPoolBaseVolatility(poolAddress.toHexString() + "-" + eventTx.hash.toHexString()) as ACOPoolBaseVolatility
  bv.pool = poolAddress.toHexString()
  bv.caller = eventTx.from
  bv.tx = tx.id
  bv.baseVolatility = baseVolatility
  bv.save()
}

export function setAcoPoolStrategyHistory(
  poolAddress: Address, 
  strategy: Bytes,
  eventTx: ethereum.Transaction, 
  tx: Transaction): void {
  let strg = new ACOPoolStrategy(poolAddress.toHexString() + "-" + eventTx.hash.toHexString()) as ACOPoolStrategy
  strg.pool = poolAddress.toHexString()
  strg.caller = eventTx.from
  strg.tx = tx.id
  strg.strategy = strategy
  strg.save()
}

export function setAcoPoolAdminHistory(
  poolAddress: Address, 
  admin: Bytes,
  eventTx: ethereum.Transaction, 
  tx: Transaction): void {
  let adm = new ACOPoolAdmin(poolAddress.toHexString() + "-" + eventTx.hash.toHexString()) as ACOPoolAdmin
  adm.pool = poolAddress.toHexString()
  adm.caller = eventTx.from
  adm.tx = tx.id
  adm.poolAdmin = admin
  adm.save()
}