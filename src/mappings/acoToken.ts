import { BigDecimal, BigInt, Bytes, Address, ethereum } from '@graphprotocol/graph-ts'
import { ACOToken, Token, Exercise, Transaction, ACOTokenSituation, Account, Mint, Burn, Swap, ExercisedAccount } from '../types/schema'
import { CollateralDeposit, CollateralWithdraw, TransferCollateralOwnership, Assigned, Transfer } from '../types/templates/ACOToken/ACOToken'
import { 
  ADDRESS_ZERO,
  ZERO_BD,
  ZERO_BI,
  ONE_BI,
  ZRX_EXCHANGE_ADDRESS,
  WRITER_ADDRESS,
  getTokenAmount, 
  getCollateralAmount,
  getTransaction, 
  getAcoTokenSituation,
  convertTokenToDecimal, 
  ACO_OTC_V1_ADDRESS,
  ACO_OTC_V2_ADDRESS,
  getToken } from './helpers'

export function handleMint(event: CollateralDeposit): void {
  let aco = ACOToken.load(event.address.toHexString()) as ACOToken
  let underlying = Token.load(aco.underlying) as Token
  let collateral = Token.load(aco.collateral) as Token
  let acoTokenSituation = ACOTokenSituation.load(aco.situation) as ACOTokenSituation
  let account = getAccount(aco, event.params.account) as Account
  let accountAcoTokenSituation = ACOTokenSituation.load(account.situation) as ACOTokenSituation
  
  let tokenAmount = getTokenAmount(event.params.amount, aco.isCall, aco.strikePrice, underlying.decimals)

  // the balances (totalSupply and account balance) are handled on the `transfer´ event

  accountAcoTokenSituation.collateralizedTokens = accountAcoTokenSituation.collateralizedTokens.plus(tokenAmount)
  setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, underlying.decimals, account.balance, accountAcoTokenSituation, event)
  
  acoTokenSituation.collateralizedTokens = acoTokenSituation.collateralizedTokens.plus(tokenAmount)
  setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, underlying.decimals, aco.totalSupply, acoTokenSituation, event)

  let tx = getTransaction(event) as Transaction
  let mint = new Mint(event.address.toHexString() + "-" + event.params.account.toHexString() + "-" + event.transaction.hash.toHexString()) as Mint
  mint.aco = aco.id
  mint.account = event.params.account
  mint.collateralAmount = convertTokenToDecimal(event.params.amount, collateral.decimals)
  mint.tokenAmount = tokenAmount
  mint.tx = tx.id
  mint.save()
  aco.mintsCount = aco.mintsCount.plus(ONE_BI)
  let mints = aco.mints
  aco.mints = mints.concat([mint.id])
  aco.save()
}

export function handleCollateralWithdraw(event: CollateralWithdraw): void {
  let aco = ACOToken.load(event.address.toHexString()) as ACOToken
  let underlying = Token.load(aco.underlying) as Token
  let collateral = Token.load(aco.collateral) as Token
  let acoTokenSituation = ACOTokenSituation.load(aco.situation) as ACOTokenSituation
  let account = getAccount(aco, event.params.account) as Account
  let accountAcoTokenSituation = ACOTokenSituation.load(account.situation) as ACOTokenSituation
  let exercise = Exercise.load(event.address.toHexString() + "-" + event.params.account.toHexString() + "-" + event.transaction.hash.toHexString()) as Exercise

  let totalCollateral = event.params.amount.plus(event.params.fee)
  let tokenAmount = getTokenAmount(totalCollateral, aco.isCall, aco.strikePrice, underlying.decimals)

  // the balances (totalSupply and account balance) are handled on the `transfer´ event

  if (exercise == null) {
    accountAcoTokenSituation.collateralizedTokens = accountAcoTokenSituation.collateralizedTokens.minus(tokenAmount)

    if (event.block.timestamp.lt(aco.expiryTime)) {
      // it is a burn operation
      let tx = getTransaction(event) as Transaction
      let burn = new Burn(event.address.toHexString() + "-" + event.params.account.toHexString() + "-" + event.transaction.hash.toHexString()) as Burn
      burn.aco = aco.id
      burn.account = event.params.account
      burn.collateralAmount = convertTokenToDecimal(totalCollateral, collateral.decimals)
      burn.tokenAmount = tokenAmount
      burn.tx = tx.id
      burn.save()
      aco.burnsCount = aco.burnsCount.plus(ONE_BI)
      let burns = aco.burns
      aco.burns = burns.concat([burn.id])
      aco.save()
    } // the else would be a redeem operation
  } else {
    // it is an exercise operation
    let feeAmount = convertTokenToDecimal(event.params.fee, collateral.decimals)
    accountAcoTokenSituation.exerciseFee = accountAcoTokenSituation.exerciseFee.plus(feeAmount)
    acoTokenSituation.exerciseFee = acoTokenSituation.exerciseFee.plus(feeAmount)
  }

  acoTokenSituation.collateralizedTokens = acoTokenSituation.collateralizedTokens.minus(tokenAmount)

  setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, underlying.decimals, account.balance, accountAcoTokenSituation, event)
  setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, underlying.decimals, aco.totalSupply, acoTokenSituation, event)
}

export function handleTransferCollateralOwnership(event: TransferCollateralOwnership): void {
  let aco = ACOToken.load(event.address.toHexString()) as ACOToken
  let underlying = Token.load(aco.underlying) as Token

  let tokenAmount = convertTokenToDecimal(event.params.tokenCollateralizedAmount, aco.decimals)

  let from = getAccount(aco, event.params.from) as Account
  let fromAcoTokenSituation = ACOTokenSituation.load(from.situation) as ACOTokenSituation
  fromAcoTokenSituation.collateralizedTokens = fromAcoTokenSituation.collateralizedTokens.minus(tokenAmount)
  setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, underlying.decimals, from.balance, fromAcoTokenSituation, event)

  let to = getAccount(aco, event.params.to) as Account
  let toAcoTokenSituation = ACOTokenSituation.load(to.situation) as ACOTokenSituation
  toAcoTokenSituation.collateralizedTokens = toAcoTokenSituation.collateralizedTokens.plus(tokenAmount)
  setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, underlying.decimals, to.balance, toAcoTokenSituation, event)
}

export function handleExerciseAssignment(event: Assigned): void {
  let aco = ACOToken.load(event.address.toHexString()) as ACOToken
  let acoTokenSituation = ACOTokenSituation.load(aco.situation) as ACOTokenSituation
  let underlying = Token.load(aco.underlying) as Token

  let tokenAmount = convertTokenToDecimal(event.params.tokenAmount, aco.decimals)

  // the balances (totalSupply and the exercising account balance) are handled on the `transfer´ event
  // the exercise fees are handle on the `CollateralWithdraw´ event

  let paidDecimals = underlying.decimals
  if (aco.isCall) {
    let strikeAsset = Token.load(aco.strikeAsset) as Token
    paidDecimals = strikeAsset.decimals
  }

  let paidAmount = convertTokenToDecimal(event.params.paidAmount, paidDecimals)

  let id = event.address.toHexString() + "-" + event.params.to.toHexString() + "-" + event.transaction.hash.toHexString()
  let exercise = Exercise.load(id) as Exercise
  let isNew = false
  if (exercise == null) {
    isNew = true
    let tx = getTransaction(event) as Transaction
    exercise = new Exercise(id) as Exercise
    exercise.aco = aco.id
    exercise.account = event.params.to
    exercise.paidAmount = ZERO_BD
    exercise.tokenAmount = ZERO_BD
    exercise.tx = tx.id
    exercise.exercisedAccountsCount = ZERO_BI
    exercise.exercisedAccounts = []
  }
  exercise.paidAmount = exercise.paidAmount.plus(paidAmount)
  exercise.tokenAmount = exercise.tokenAmount.plus(tokenAmount)

  let exercisedAccount = new ExercisedAccount(event.address.toHexString() + "-" + event.params.from.toHexString() + "-" + event.params.to.toHexString() + "-" + event.transaction.hash.toHexString()) as ExercisedAccount
  exercisedAccount.exercise = id
  exercisedAccount.account = event.params.from
  exercisedAccount.paymentReceived = paidAmount
  exercisedAccount.exercisedTokens = tokenAmount
    
  let account = getAccount(aco, event.params.from) as Account
  let accountAcoTokenSituation = ACOTokenSituation.load(account.situation) as ACOTokenSituation
  accountAcoTokenSituation.exercisedPayment = accountAcoTokenSituation.exercisedPayment.plus(paidAmount)
  accountAcoTokenSituation.exercisedTokens = accountAcoTokenSituation.exercisedTokens.plus(tokenAmount)
  accountAcoTokenSituation.collateralizedTokens = accountAcoTokenSituation.collateralizedTokens.minus(tokenAmount)
  setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, underlying.decimals, account.balance, accountAcoTokenSituation, event)

  exercise.exercisedAccountsCount = exercise.exercisedAccountsCount.plus(ONE_BI)
  let exercisedAccounts = exercise.exercisedAccounts
  exercise.exercisedAccounts = exercisedAccounts.concat([exercisedAccount.id])
  exercise.save()

  acoTokenSituation.exercisedPayment = acoTokenSituation.exercisedPayment.plus(paidAmount)
  acoTokenSituation.exercisedTokens = acoTokenSituation.exercisedTokens.plus(tokenAmount)
  acoTokenSituation.save()

  if (isNew) {
    let exercises = aco.exercises
    aco.exercises = exercises.concat([exercise.id])
    aco.save()
  }
}

// the transfer event is responsible to handle the `swap´ (for ZRX and OTC) and setting all balances values and it must not change the `collaterized´ values
export function handleTransfer(event: Transfer): void {
  let aco = ACOToken.load(event.address.toHexString()) as ACOToken
  let tokenAmount = convertTokenToDecimal(event.params.value, aco.decimals)

  if (tokenAmount.gt(ZERO_BD)) {

    let underlying = Token.load(aco.underlying) as Token
    let isMint = event.params.from.toHexString() == ADDRESS_ZERO
    let isBurn = event.params.to.toHexString() == ADDRESS_ZERO

    if (isMint) {
      let acoTokenSituation = ACOTokenSituation.load(aco.situation) as ACOTokenSituation
      aco.totalSupply = aco.totalSupply.plus(tokenAmount)
      setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, underlying.decimals, aco.totalSupply, acoTokenSituation, event)
      aco.save()
    } else {
      let from = getAccount(aco, event.params.from) as Account
      let fromAcoTokenSituation = ACOTokenSituation.load(from.situation) as ACOTokenSituation
      from.balance = from.balance.minus(tokenAmount)
      setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, underlying.decimals, from.balance, fromAcoTokenSituation, event)
      from.save()
    }

    if (isBurn) {
      let acoTokenSituation = ACOTokenSituation.load(aco.situation) as ACOTokenSituation
      aco.totalSupply = aco.totalSupply.minus(tokenAmount)
      setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, underlying.decimals, aco.totalSupply, acoTokenSituation, event)
      aco.save()
    } else {
      let to = getAccount(aco, event.params.to) as Account
      let toAcoTokenSituation = ACOTokenSituation.load(to.situation) as ACOTokenSituation
      to.balance = to.balance.plus(tokenAmount)
      setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, underlying.decimals, to.balance, toAcoTokenSituation, event)
      to.save()
    }

    handleSwapOnZrxOrOtc(tokenAmount, aco, event)
  }
}

function handleSwapOnZrxOrOtc(tokenAmount: BigDecimal, aco: ACOToken, event: Transfer): void {
  let swapType = null as string
  let taker = null as Bytes
  let seller = null as Bytes
  let buyer = null as Bytes
  let swapPaidAmount = null as BigInt
  let swapToken = null as Token
  if (event.transaction.to != null 
    && event.params.from.toHexString() != ADDRESS_ZERO 
    && event.params.to.toHexString() != ADDRESS_ZERO) {

    if (event.transaction.to.toHexString() == ZRX_EXCHANGE_ADDRESS
      || event.transaction.to.toHexString() == WRITER_ADDRESS) {
      swapType = "ZRX"
      let input = event.transaction.input.toHexString()
      let method = null as string
      let maker = null as Bytes
      if (event.transaction.to.toHexString() == WRITER_ADDRESS) {
        buyer = event.params.to
        seller = event.transaction.from
        taker = event.transaction.from
        maker = event.params.to
        method = input.substring(330, 338)
      } else {
        buyer = event.params.to
        seller = event.params.from
        method = input.substring(2, 10)
        if (method == "8bc8efb3") {
          taker = event.params.to
          maker = event.params.from
        } else if (method == "a6c3bf33") {
          taker = event.params.from
          maker = event.params.to
        }
      }
      if (maker != null) {
        let searchValue = maker.toHexString().substring(2) as string
        let indexValue = input.indexOf(searchValue)
        let indexToken = input.indexOf("f47261b0000000000000000000000000")
        let val1 = BigInt.fromString("0x" + input.substring(indexValue + 232, indexValue + 296))
        let val2 = BigInt.fromString("0x" + input.substring(indexValue + 296, indexValue + 360))
        if (method == "8bc8efb3") {
          swapPaidAmount = event.params.value.times(val2).div(val1)
          swapToken = getToken(Address.fromString("0x" + input.substring(indexToken + 224, indexToken + 264))) as Token
        } else if (method == "a6c3bf33") {
          swapPaidAmount = event.params.value.times(val1).div(val2)
          swapToken = getToken(Address.fromString("0x" + input.substring(indexToken + 32, indexToken + 72))) as Token
        }
      }
    } else if (event.transaction.to.toHexString() == ACO_OTC_V1_ADDRESS
      || event.transaction.to.toHexString() == ACO_OTC_V2_ADDRESS) {
      swapType = "OTC"
      taker = event.transaction.from
      buyer = event.params.to
      let input = event.transaction.input.toHexString()
      let method = input.substring(2, 10)
      if (method == "7da22e76") {
        seller = Address.fromString("0x" + input.substring(162, 202))
        swapPaidAmount = BigInt.fromString("0x" + input.substring(650, 714))
        swapToken = getToken(Address.fromString("0x" + input.substring(738, 778)))
      } else if (method == "538df066") {
        seller = event.transaction.from
        swapPaidAmount = BigInt.fromString("0x" + input.substring(202, 266))
        swapToken = getToken(Address.fromString("0x" + input.substring(290, 330)))
      }
    }

    if (swapType != null && taker != null && seller != null && buyer != null && swapPaidAmount != null && swapToken != null) {
      let tx = getTransaction(event) as Transaction
      let swap = new Swap(event.address.toHexString() + "-" + seller.toHexString() + "-" + buyer.toHexString() + event.transaction.hash.toHexString()) as Swap
      swap.aco = aco.id
      swap.seller = seller
      swap.buyer = buyer
      swap.taker = taker
      swap.type = swapType
      swap.paymentToken = swapToken.id
      swap.paymentAmount = convertTokenToDecimal(swapPaidAmount, swapToken.decimals)
      swap.acoAmount = tokenAmount
      swap.tx = tx.id
      swap.save()
      aco.swapsCount = aco.swapsCount.plus(ONE_BI)
      let swaps = aco.swaps
      aco.swaps = swaps.concat([swap.id])
      aco.save()
    }
  }
}

function setAcoTokenSituation(
  isCall: boolean,
  strikePrice: BigDecimal,
  expiryTime: BigInt,
  underlyingDecimals: BigInt,
  tokenBalance: BigDecimal, 
  acoTokenSituation: ACOTokenSituation, 
  event: ethereum.Event): void {
  
  let assignableTokens = assignableAmount(tokenBalance, acoTokenSituation.collateralizedTokens, expiryTime, event)
  let unassignableTokens = unassignableAmount(tokenBalance, acoTokenSituation.collateralizedTokens, expiryTime, event)
  acoTokenSituation.assignableTokens = assignableTokens
  acoTokenSituation.unassignableTokens = unassignableTokens
  acoTokenSituation.collateralAmount = getCollateralAmount(acoTokenSituation.collateralizedTokens, isCall, strikePrice, underlyingDecimals)
  acoTokenSituation.assignableCollateral = getCollateralAmount(assignableTokens, isCall, strikePrice, underlyingDecimals)
  acoTokenSituation.unassignableCollateral = getCollateralAmount(unassignableTokens, isCall, strikePrice, underlyingDecimals)
  acoTokenSituation.save()
}

function unassignableAmount(
  balance: BigDecimal, 
  collaterized: BigDecimal, 
  expiryTime: BigInt, 
  event: ethereum.Event): BigDecimal {
  if (event.block.timestamp.ge(expiryTime) || balance.lt(collaterized)) {
    return balance
  } else {
    return collaterized
  }
}

function assignableAmount(
  balance: BigDecimal, 
  collaterized: BigDecimal, 
  expiryTime: BigInt, 
  event: ethereum.Event): BigDecimal {
  if (event.block.timestamp.ge(expiryTime) || balance.ge(collaterized)) {
    return ZERO_BD
  } else {
    return collaterized.minus(balance)
  }
}

function getAccount(aco: ACOToken, account: Bytes): Account {
  let id = aco.id + "-" + account.toHexString()
  let acc = Account.load(id) as Account
  if (acc == null) {
    acc = new Account(id) as Account
    acc.balance = ZERO_BD
    let accSituation = getAcoTokenSituation(Address.fromString(aco.id), account) as ACOTokenSituation
    acc.situation = accSituation.id
    acc.save()
    aco.accountsCount = aco.accountsCount.plus(ONE_BI)
    let accounts = aco.accounts
    aco.accounts = accounts.concat([acc.id])
    aco.save()
  }
  return acc
}