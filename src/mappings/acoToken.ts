import { BigDecimal, BigInt, Bytes, Address, ethereum } from '@graphprotocol/graph-ts'
import { ACOToken, Token, Exercise, Transaction, ACOTokenSituation, ACOAccount, Mint, Burn, ACOSwap, ExercisedAccount, AccountRedeem } from '../types/schema'
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
  getToken, 
  WRITER_V2_ADDRESS,
  convertDecimalToToken,
  BUYER_V2_ADDRESS,
  ZRX_V4_EXCHANGE_ADDRESS,
  parseHexNumToBigInt,
  parseHexNumToI32
} from './helpers'

export function handleMint(event: CollateralDeposit): void {
  let aco = ACOToken.load(event.address.toHexString()) as ACOToken
  let collateral = Token.load(aco.collateral) as Token
  let acoTokenSituation = ACOTokenSituation.load(aco.situation) as ACOTokenSituation
  let account = getACOAccount(aco, event.params.account) as ACOAccount
  let accountAcoTokenSituation = ACOTokenSituation.load(account.situation) as ACOTokenSituation
  
  let tokenAmount = getTokenAmount(event.params.amount, aco.isCall, aco.strikePrice, collateral.decimals)

  // the balances (totalSupply and account balance) are handled on the `transfer´ event

  accountAcoTokenSituation.collateralizedTokens = accountAcoTokenSituation.collateralizedTokens.plus(tokenAmount)
  setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, account.balance, accountAcoTokenSituation, event)
  
  acoTokenSituation.collateralizedTokens = acoTokenSituation.collateralizedTokens.plus(tokenAmount)
  setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, aco.totalSupply, acoTokenSituation, event)

  let tx = getTransaction(event) as Transaction
  let mint = new Mint(event.address.toHexString() + "-" + event.params.account.toHexString() + "-" + event.transaction.hash.toHexString()) as Mint
  mint.aco = aco.id
  mint.account = event.params.account
  mint.collateralAmount = convertTokenToDecimal(event.params.amount, collateral.decimals)
  mint.tokenAmount = tokenAmount
  mint.tx = tx.id
  mint.save()
  aco.mintsCount = aco.mintsCount.plus(ONE_BI)
  aco.lastMintId = mint.id
  aco.save()
}

export function handleCollateralWithdraw(event: CollateralWithdraw): void {
  let aco = ACOToken.load(event.address.toHexString()) as ACOToken
  let collateral = Token.load(aco.collateral) as Token
  let acoTokenSituation = ACOTokenSituation.load(aco.situation) as ACOTokenSituation
  let account = getACOAccount(aco, event.params.account) as ACOAccount
  let accountAcoTokenSituation = ACOTokenSituation.load(account.situation) as ACOTokenSituation
  let exercise = Exercise.load(event.address.toHexString() + "-" + event.params.account.toHexString() + "-" + event.transaction.hash.toHexString()) as Exercise

  let totalCollateral = event.params.amount.plus(event.params.fee)
  let tokenAmount = getTokenAmount(totalCollateral, aco.isCall, aco.strikePrice, collateral.decimals)

  // the balances (totalSupply and account balance) are handled on the `transfer´ event

  if (exercise == null) {
    accountAcoTokenSituation.collateralizedTokens = accountAcoTokenSituation.collateralizedTokens.minus(tokenAmount)

    let tx = getTransaction(event) as Transaction
    if (event.block.timestamp.lt(aco.expiryTime)) {
      // it is a burn operation
      let burn = new Burn(event.address.toHexString() + "-" + event.params.account.toHexString() + "-" + event.transaction.hash.toHexString()) as Burn
      burn.aco = aco.id
      burn.account = event.params.account
      burn.collateralAmount = convertTokenToDecimal(totalCollateral, collateral.decimals)
      burn.tokenAmount = tokenAmount
      burn.tx = tx.id
      burn.save()
      aco.burnsCount = aco.burnsCount.plus(ONE_BI)
      aco.lastBurnId = burn.id
      aco.save()
    } else {
      // it is a redeem operation
      let redeem = new AccountRedeem(event.address.toHexString() + "-" + event.params.account.toHexString() + "-" + event.transaction.hash.toHexString()) as AccountRedeem
      redeem.aco = aco.id
      redeem.account = event.params.account
      redeem.collateralAmount = convertTokenToDecimal(totalCollateral, collateral.decimals)
      redeem.tx = tx.id
      redeem.save()
      aco.accountRedeemsCount = aco.accountRedeemsCount.plus(ONE_BI)
      aco.lastAccountRedeemId = redeem.id
      aco.save()
    }
  } else {
    // it is an exercise operation
    let feeAmount = convertTokenToDecimal(event.params.fee, collateral.decimals)
    accountAcoTokenSituation.exerciseFee = accountAcoTokenSituation.exerciseFee.plus(feeAmount)
    acoTokenSituation.exerciseFee = acoTokenSituation.exerciseFee.plus(feeAmount)
  }

  acoTokenSituation.collateralizedTokens = acoTokenSituation.collateralizedTokens.minus(tokenAmount)

  setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, account.balance, accountAcoTokenSituation, event)
  setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, aco.totalSupply, acoTokenSituation, event)
}

export function handleTransferCollateralOwnership(event: TransferCollateralOwnership): void {
  let aco = ACOToken.load(event.address.toHexString()) as ACOToken

  let tokenAmount = convertTokenToDecimal(event.params.tokenCollateralizedAmount, aco.decimals)

  let from = getACOAccount(aco, event.params.from) as ACOAccount
  let fromAcoTokenSituation = ACOTokenSituation.load(from.situation) as ACOTokenSituation
  fromAcoTokenSituation.collateralizedTokens = fromAcoTokenSituation.collateralizedTokens.minus(tokenAmount)
  setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, from.balance, fromAcoTokenSituation, event)

  let to = getACOAccount(aco, event.params.to) as ACOAccount
  let toAcoTokenSituation = ACOTokenSituation.load(to.situation) as ACOTokenSituation
  toAcoTokenSituation.collateralizedTokens = toAcoTokenSituation.collateralizedTokens.plus(tokenAmount)
  setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, to.balance, toAcoTokenSituation, event)
}

export function handleExerciseAssignment(event: Assigned): void {
  let aco = ACOToken.load(event.address.toHexString()) as ACOToken
  let acoTokenSituation = ACOTokenSituation.load(aco.situation) as ACOTokenSituation
  let underlying = Token.load(aco.underlying) as Token

  let tokenAmount = convertTokenToDecimal(event.params.tokenAmount, aco.decimals)
  let collateralAmount = (aco.isCall ? tokenAmount : tokenAmount.times(aco.strikePrice))

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
    exercise.collateralAmount = ZERO_BD
    exercise.tx = tx.id
    exercise.exercisedAccountsCount = ZERO_BI
  }
  exercise.paidAmount = exercise.paidAmount.plus(paidAmount)
  exercise.tokenAmount = exercise.tokenAmount.plus(tokenAmount)
  exercise.collateralAmount = exercise.collateralAmount.plus(collateralAmount)

  let exercisedAccount = new ExercisedAccount(event.address.toHexString() + "-" + event.params.from.toHexString() + "-" + event.params.to.toHexString() + "-" + event.transaction.hash.toHexString()) as ExercisedAccount
  exercisedAccount.exercise = exercise.id
  exercisedAccount.account = event.params.from
  exercisedAccount.paymentReceived = paidAmount
  exercisedAccount.exercisedTokens = tokenAmount
  exercisedAccount.collateralAmount = collateralAmount
    
  let account = getACOAccount(aco, event.params.from) as ACOAccount
  let accountAcoTokenSituation = ACOTokenSituation.load(account.situation) as ACOTokenSituation
  accountAcoTokenSituation.exercisedPayment = accountAcoTokenSituation.exercisedPayment.plus(paidAmount)
  accountAcoTokenSituation.exercisedTokens = accountAcoTokenSituation.exercisedTokens.plus(tokenAmount)
  accountAcoTokenSituation.collateralizedTokens = accountAcoTokenSituation.collateralizedTokens.minus(tokenAmount)
  setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, account.balance, accountAcoTokenSituation, event)

  exercisedAccount.save()

  exercise.exercisedAccountsCount = exercise.exercisedAccountsCount.plus(ONE_BI)
  exercise.save()

  acoTokenSituation.exercisedPayment = acoTokenSituation.exercisedPayment.plus(paidAmount)
  acoTokenSituation.exercisedTokens = acoTokenSituation.exercisedTokens.plus(tokenAmount)
  acoTokenSituation.save()

  if (isNew) {
    aco.exercisesCount = aco.exercisesCount.plus(ONE_BI)
    aco.lastExerciseId = exercise.id
    aco.save()
  }
}

// the transfer event is responsible to handle the `swap´ (for ZRX and OTC) and setting all balances values and it must not change the `collaterized´ values
export function handleTransfer(event: Transfer): void {
  let aco = ACOToken.load(event.address.toHexString()) as ACOToken
  let tokenAmount = convertTokenToDecimal(event.params.value, aco.decimals)

  if (tokenAmount.gt(ZERO_BD)) {

    let isMint = event.params.from.toHexString() == ADDRESS_ZERO
    let isBurn = event.params.to.toHexString() == ADDRESS_ZERO

    if (isMint) {
      let acoTokenSituation = ACOTokenSituation.load(aco.situation) as ACOTokenSituation
      aco.totalSupply = aco.totalSupply.plus(tokenAmount)
      setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, aco.totalSupply, acoTokenSituation, event)
      aco.save()
    } else {
      let from = getACOAccount(aco, event.params.from) as ACOAccount
      let fromAcoTokenSituation = ACOTokenSituation.load(from.situation) as ACOTokenSituation
      from.balance = from.balance.minus(tokenAmount)
      if (from.balance.equals(ZERO_BD)) {
        aco.holdersCount = aco.holdersCount.minus(ONE_BI)
        aco.save()
      }
      setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, from.balance, fromAcoTokenSituation, event)
      from.save()
    }

    if (isBurn) {
      let acoTokenSituation = ACOTokenSituation.load(aco.situation) as ACOTokenSituation
      aco.totalSupply = aco.totalSupply.minus(tokenAmount)
      setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, aco.totalSupply, acoTokenSituation, event)
      aco.save()
    } else {
      let to = getACOAccount(aco, event.params.to) as ACOAccount
      if (to.balance.equals(ZERO_BD)) {
        aco.holdersCount = aco.holdersCount.plus(ONE_BI)
        aco.save()
      }
      let toAcoTokenSituation = ACOTokenSituation.load(to.situation) as ACOTokenSituation
      to.balance = to.balance.plus(tokenAmount)
      setAcoTokenSituation(aco.isCall, aco.strikePrice, aco.expiryTime, to.balance, toAcoTokenSituation, event)
      to.save()
    }

    handleSwapOnZrxOrOtc(tokenAmount, aco, event)
  }
}

function handleSwapOnZrxOrOtc(tokenAmount: BigDecimal, aco: ACOToken, event: Transfer): void {
  if (event.transaction.to != null 
    && event.params.from.toHexString() != ADDRESS_ZERO 
    && event.params.to.toHexString() != ADDRESS_ZERO) {
      
    let input = event.transaction.input.toHexString() as string
    let baseMethod = input.substring(2, 10) as string
    let data = new AcoSwapToSave()

    if (event.transaction.to.toHexString() == ZRX_EXCHANGE_ADDRESS
      || event.transaction.to.toHexString() == WRITER_ADDRESS) {
      data.swapType = "ZRX"
      let method = null as string
      let maker = null as Bytes
      if (event.transaction.to.toHexString() == WRITER_ADDRESS) {
        data.buyer = event.params.to
        data.seller = event.transaction.from
        data.taker = event.transaction.from
        maker = event.params.to
        method = input.substring(330, 338)
      } else {
        data.buyer = event.params.to
        data.seller = event.params.from
        method = baseMethod
        if (method == "8bc8efb3") {
          data.taker = event.params.to
          maker = event.params.from
        } else if (method == "a6c3bf33") {
          data.taker = event.params.from
          maker = event.params.to
        }
      }
      if (maker != null) {
        let searchValue = maker.toHexString().substring(2) as string
        let indexValue = input.indexOf(searchValue)
        let indexToken = input.indexOf("f47261b0000000000000000000000000")
        let val1 = parseHexNumToBigInt(input.substring(indexValue + 232, indexValue + 296))
        let val2 = parseHexNumToBigInt(input.substring(indexValue + 296, indexValue + 360))
        if (method == "8bc8efb3") {
          data.swapPaidAmount = event.params.value.times(val2).div(val1)
          data.swapToken = getToken(Address.fromString("0x" + input.substring(indexToken + 224, indexToken + 264))) as Token
        } else if (method == "a6c3bf33") {
          data.swapPaidAmount = event.params.value.times(val1).div(val2)
          data.swapToken = getToken(Address.fromString("0x" + input.substring(indexToken + 32, indexToken + 72))) as Token
        }
      }
    } else if (event.transaction.to.toHexString() == ZRX_V4_EXCHANGE_ADDRESS
      || event.transaction.to.toHexString() == WRITER_V2_ADDRESS
      || event.params.from.toHexString() == BUYER_V2_ADDRESS) {

      data.swapType = "ZRX"
      data.buyer = event.params.to

      let zrxInputData = null as string
      let startOrderIndex = 0 as i32
      let startSizeIndex = 0 as i32

      if (event.transaction.to.toHexString() == WRITER_V2_ADDRESS && baseMethod == "dd2a42fe") {
      
        data.seller = event.transaction.from
        data.taker = event.transaction.from
  
        zrxInputData = input.substring(266) as string
        startOrderIndex = 328 as i32
        startSizeIndex = (parseHexNumToI32(zrxInputData.substring(136, 200)) * 2 + 8 + 64) as i32

      } else if (event.transaction.to.toHexString() == ZRX_V4_EXCHANGE_ADDRESS) {
        zrxInputData = input.toString() as string
        if (baseMethod == "1baaa00b") {
          startOrderIndex = 330 as i32
          startSizeIndex = (parseHexNumToI32(input.substring(138, 202)) * 2 + 10 + 64) as i32
        } else if (baseMethod == "9240529c" || baseMethod == "f6274f66") {
          startOrderIndex = 10 as i32
          startSizeIndex = 1034 as i32
        }
      } else if (event.params.from.toHexString() == BUYER_V2_ADDRESS && baseMethod == "eb7a7eb3") {

        data.taker = event.params.to

        let baseIndex = input.indexOf("000000000000000000000000" + ZRX_V4_EXCHANGE_ADDRESS.substring(2)) as i32
        if (baseIndex > 0) {
          let endIndex = (parseHexNumToI32(input.substring((baseIndex + 192), (baseIndex + 256))) * 2) as i32
          let startIndex = (baseIndex + 256) as i32
          endIndex = (startIndex + endIndex) as i32
          zrxInputData = input.substring(startIndex, endIndex) as string
          startOrderIndex = 328 as i32
          startSizeIndex = (parseHexNumToI32(zrxInputData.substring(136, 200)) * 2 + 8 + 64) as i32
        }
      }
      if (zrxInputData != null && startSizeIndex > 0) {

        let makerTokenHex = ("0x" + zrxInputData.substring((startOrderIndex + 24), (startOrderIndex + 64))) as string
        let takerTokenHex = ("0x" + zrxInputData.substring((startOrderIndex + 88), (startOrderIndex + 128))) as string
        let isBuy = (makerTokenHex == aco.id) as boolean
        let swapTokenHex = (isBuy ? takerTokenHex : makerTokenHex) as string

        data.swapToken = getToken(Address.fromString(swapTokenHex)) as Token

        let zrxData = getZrxData(aco, zrxInputData, startSizeIndex, data.swapToken as Token, isBuy, takerTokenHex) as Array<ZrxData>

        let maker = null as string
        for (let i = 0 as i32; i < zrxData.length; ++i) {
          if (event.params.from.toHexString() == BUYER_V2_ADDRESS) {
            let toSave = new AcoSwapToSave()
            toSave.buyer = data.buyer as Bytes
            toSave.taker = data.taker as Bytes
            toSave.swapType = data.swapType as string
            toSave.swapToken = data.swapToken as Token
            toSave.seller = Address.fromString(zrxData[i].maker)
            toSave.swapPaidAmount = convertDecimalToToken(zrxData[i].takerSize as BigDecimal, data.swapToken.decimals)
            createAcoSwap(zrxData[i].makerSize as BigDecimal, aco, event, toSave, i)
          } else {
            if (isBuy) {
              if (tokenAmount.equals(zrxData[i].makerSize as BigDecimal)) {
                maker = zrxData[i].maker as string
                data.swapPaidAmount = convertDecimalToToken(zrxData[i].takerSize as BigDecimal, data.swapToken.decimals)
                break
              }
            } else {
              if (zrxData[i].maker == data.buyer.toHexString() && tokenAmount.equals(zrxData[i].takerSize as BigDecimal)) {
                data.swapPaidAmount = convertDecimalToToken(zrxData[i].makerSize as BigDecimal, data.swapToken.decimals)
                break
              }
            }
          }
        }
        if (event.params.from.toHexString() != BUYER_V2_ADDRESS && data.swapPaidAmount != null) {
          if (isBuy) {
            if (data.seller == null) {
              data.seller = Address.fromString(maker)
            }
            if (data.taker == null) {
              data.taker = data.buyer
            }
          } else {
            if (data.seller == null) {
              data.seller = event.transaction.from
            }
            if (data.taker == null) {
              data.taker = data.seller
            }
          }
        }
      }
    } else if (event.transaction.to.toHexString() == ACO_OTC_V1_ADDRESS
      || event.transaction.to.toHexString() == ACO_OTC_V2_ADDRESS) {
      data.swapType = "OTC"
      data.taker = event.transaction.from
      data.buyer = event.params.to
      if (baseMethod == "7da22e76") {
        data.seller = Address.fromString("0x" + input.substring(162, 202))
        data.swapPaidAmount = parseHexNumToBigInt(input.substring(650, 714))
        data.swapToken = getToken(Address.fromString("0x" + input.substring(738, 778)))
      } else if (baseMethod == "538df066") {
        data.seller = event.transaction.from
        data.swapPaidAmount = parseHexNumToBigInt(input.substring(202, 266))
        data.swapToken = getToken(Address.fromString("0x" + input.substring(290, 330)))
      }
    }

    createAcoSwap(tokenAmount, aco, event, data, 0)
  }
}

function getZrxData(
  aco: ACOToken,
  zrxInputData: string, 
  startSizeIndex: i32,
  swapToken: Token,
  isBuy: boolean,
  takerTokenHex: string): Array<ZrxData> {

  let data = new Array<ZrxData>()
  let zrxInputValues = zrxInputData.split("000000000000000000000000" + takerTokenHex.substring(2)) as string[]

  for (let i = 1 as i32; i < zrxInputValues.length; ++i) {
    let zrx = new ZrxData()
    let makerAmount = parseHexNumToBigInt(zrxInputValues[i].substring(0, 64))
    let takerAmount = parseHexNumToBigInt(zrxInputValues[i].substring(64, 128))
    let size = parseHexNumToBigInt(zrxInputData.substring(startSizeIndex + (64 * (i - 1)), startSizeIndex + (64 * i)))
    zrx.maker = ("0x" + zrxInputValues[i].substring(216, 256)) as string
    
    let makerTotalSize = convertTokenToDecimal(makerAmount, (isBuy ? aco.decimals : swapToken.decimals))
    let takerTotalSize = convertTokenToDecimal(takerAmount, (isBuy ? swapToken.decimals : aco.decimals))
    let price = (isBuy ? takerTotalSize.div(makerTotalSize) : makerTotalSize.div(takerTotalSize))
    zrx.takerSize = convertTokenToDecimal(size, (isBuy ? swapToken.decimals : aco.decimals))
    zrx.makerSize = (isBuy ? zrx.takerSize.div(price) : zrx.takerSize.times(price))
    data.push(zrx)
  }
  return data
}

class ZrxData {
  makerSize: BigDecimal | null
  takerSize: BigDecimal | null
  maker: string | null
}

class AcoSwapToSave {
  swapType: string | null
  taker: Bytes | null
  seller: Bytes | null
  buyer: Bytes | null
  swapPaidAmount: BigInt | null
  swapToken: Token | null
}

function createAcoSwap(
  tokenAmount: BigDecimal, 
  aco: ACOToken, 
  event: Transfer,
  data: AcoSwapToSave,
  index: i32): void {
  if (data != null && data.swapType != null && data.taker != null && data.seller != null && data.buyer != null && data.swapPaidAmount != null && data.swapToken != null) {
    let tx = getTransaction(event) as Transaction
    let swap = new ACOSwap(event.address.toHexString() + "-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString() + "-" + index.toString()) as ACOSwap
    swap.aco = aco.id
    swap.seller = data.seller as Bytes
    swap.buyer = data.buyer as Bytes
    swap.taker = data.taker as Bytes
    swap.type = data.swapType as string
    swap.paymentToken = data.swapToken.id
    swap.paymentAmount = convertTokenToDecimal(data.swapPaidAmount as BigInt, data.swapToken.decimals)
    swap.acoAmount = tokenAmount
    swap.tx = tx.id
    swap.save()
    aco.swapsCount = aco.swapsCount.plus(ONE_BI)
    aco.lastSwapId = swap.id
    aco.save()
  }
}

function setAcoTokenSituation(
  isCall: boolean,
  strikePrice: BigDecimal,
  expiryTime: BigInt,
  tokenBalance: BigDecimal, 
  acoTokenSituation: ACOTokenSituation, 
  event: ethereum.Event): void {
  
  let assignableTokens = assignableAmount(tokenBalance, acoTokenSituation.collateralizedTokens, expiryTime, event)
  let unassignableTokens = unassignableAmount(tokenBalance, acoTokenSituation.collateralizedTokens, expiryTime, event)
  acoTokenSituation.assignableTokens = assignableTokens
  acoTokenSituation.unassignableTokens = unassignableTokens
  acoTokenSituation.collateralAmount = getCollateralAmount(acoTokenSituation.collateralizedTokens, isCall, strikePrice)
  acoTokenSituation.assignableCollateral = getCollateralAmount(assignableTokens, isCall, strikePrice)
  acoTokenSituation.unassignableCollateral = getCollateralAmount(unassignableTokens, isCall, strikePrice)
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

function getACOAccount(aco: ACOToken, account: Bytes): ACOAccount {
  let id = aco.id + "-" + account.toHexString()
  let acc = ACOAccount.load(id) as ACOAccount
  if (acc == null) {
    acc = new ACOAccount(id) as ACOAccount
    acc.account = account
    acc.aco = aco.id
    acc.balance = ZERO_BD
    let accSituation = getAcoTokenSituation(Address.fromString(aco.id), account) as ACOTokenSituation
    acc.situation = accSituation.id
    acc.save()
    aco.accountsCount = aco.accountsCount.plus(ONE_BI)
    aco.lastAccountId = acc.id
    aco.save()
  }
  return acc
}