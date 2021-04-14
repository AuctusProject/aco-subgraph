import { Bytes, BigInt, BigDecimal, Address, dataSource, ethereum } from '@graphprotocol/graph-ts'
import { ERC20 } from '../types/ACOFactory/ERC20'
import { Token, Transaction, ACOTokenSituation } from '../types/schema'

let network = dataSource.network()

let WBTC = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'
let USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
let AUC = '0xc12d099be31567add4e4e4d0d45691c3f58f5663'
let ACO_FACTORY = '0x176b98ab38d1ae8ff3f30bf07f9b93e26f559c17'
let ACO_POOL_FACTORY = '0xe28520ddb1b419ac37ecdbb2c0f97c8cf079ccc3'
let ZRX_EXCHANGE = '0x61935cbdd02287b511119ddb11aeb42f1593b7ef'
let BUYER = '0xdd43b83af3bbf093d2c323f065a8169fd2e39265'
let WRITER = '0xe7597f774fd0a15a617894dc39d45a28b97afa4f'
let VAULT_V1 = '0x5d28b41bbad874b5efeee0b4158bc50d0af5f637'
let VAULT_V2 = '0xad45001fc1f10e348a41e871901f936992d80f79'
let ACO_OTC_V1 = '0x4e91baee70d392b74f40565bba451638aa777ff0'
let ACO_OTC_V2 = '0x7ebe3599ba37fd20dda884010d38e6dd75982d81'
let ACO_POOL_BLOCK = 11511139

if (network == 'kovan') {
  WBTC = '0x4000132b399b6c85e465b60c9d897b6745149fee'
  USDC = '0xe22da380ee6b445bb8273c81944adeb6e8450422'
  AUC = '0xa24cbf0e7596b3601b01045791a73897b39068e4'
  ACO_FACTORY = '0x53661cec8d21b1c5f362b05f682070f3f6116c55'
  ACO_POOL_FACTORY = '0xd5f37ae12385184752a9cecdbe57f12253c973b9'
  ZRX_EXCHANGE = '0x4eacd0af335451709e1e7b570b8ea68edec8bc97'
  BUYER = '0x75761a6afa36c3a68c1803caa12228ae738df189'
  WRITER = '0x436abbb990a73ea35cf9aafce581bb0db15f9e22'
  VAULT_V1 = '0x0e76b8cc3b16a3f1dd286550d05d489b5cf00456'
  VAULT_V2 = '0x49a98a7547fcae51744e14fbe23cc60520a9fff5'
  ACO_OTC_V1 = '0x17ee535ede5495c48116030f7e09c09c49ab03fc'
  ACO_OTC_V2 = '0xd81d59562f6564db5d31e9fb0ce7209d8977b83c'
  ACO_POOL_BLOCK = 22704460
}

export let ACO_FACTORY_ADDRESS = ACO_FACTORY
export let ACO_POOL_FACTORY_ADDRESS = ACO_POOL_FACTORY
export let ZRX_EXCHANGE_ADDRESS = ZRX_EXCHANGE
export let BUYER_ADDRESS = BUYER
export let WRITER_ADDRESS = WRITER
export let VAULT_V1_ADDRESS = VAULT_V1
export let VAULT_V2_ADDRESS = VAULT_V2
export let ACO_OTC_V1_ADDRESS = ACO_OTC_V1
export let ACO_OTC_V2_ADDRESS = ACO_OTC_V2
export let ACO_POOL_START = ACO_POOL_BLOCK

export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let ZERO_BD = BigDecimal.fromString('0')

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = BigDecimal.fromString('1')
  for (let i = ZERO_BI; i.lt(decimals as BigInt); i = i.plus(ONE_BI)) {
    bd = bd.times(BigDecimal.fromString('10'))
  }
  return bd
}

export function convertTokenToDecimal(tokenAmount: BigInt, decimals: BigInt): BigDecimal {
  if (decimals == ZERO_BI) {
    return tokenAmount.toBigDecimal()
  }
  return tokenAmount.toBigDecimal().div(exponentToBigDecimal(decimals))
}

export function convertDecimalToToken(value: BigDecimal, decimals: BigInt): BigInt {
  if (decimals == ZERO_BI) {
    return BigInt.fromString(value.toString())
  }
  return BigInt.fromString((value.times(exponentToBigDecimal(decimals))).toString())
}

export function equalToZero(value: BigDecimal): boolean {
  const formattedVal = parseFloat(value.toString())
  const zero = parseFloat(ZERO_BD.toString())
  if (zero == formattedVal) {
    return true
  }
  return false
}

export function isNullEthValue(value: string): boolean {
  return value == '0x0000000000000000000000000000000000000000000000000000000000000001'
}

export function fetchTokenSymbol(tokenAddress: Address): string {
  if (tokenAddress.toHexString() == ADDRESS_ZERO) {
    return 'ETH'
  }
  if (tokenAddress.toHexString() == WBTC) {
    return 'WBTC'
  }
  if (tokenAddress.toHexString() == USDC) {
    return 'USDC'
  }
  if (tokenAddress.toHexString() == AUC) {
    return 'AUC'
  }

  let contract = ERC20.bind(tokenAddress)
  let symbolValue = 'unknown'
  let symbolResult = contract.try_symbol()
  if (!symbolResult.reverted) {
    symbolValue = symbolResult.value
  }
  return symbolValue
}

export function fetchTokenName(tokenAddress: Address): string {
  if (tokenAddress.toHexString() == ADDRESS_ZERO) {
    return 'Ethereum'
  }
  if (tokenAddress.toHexString() == WBTC) {
    return 'Wrapped BTC'
  }
  if (tokenAddress.toHexString() == USDC) {
    return 'USD Coin'
  }
  if (tokenAddress.toHexString() == AUC) {
    return 'Auctus Token'
  }

  let contract = ERC20.bind(tokenAddress)
  let nameValue = 'unknown'
  let nameResult = contract.try_name()
  if (!nameResult.reverted) {
    nameValue = nameResult.value
  }
  return nameValue
}

export function fetchTokenDecimals(tokenAddress: Address): BigInt {
  if (tokenAddress.toHexString() == ADDRESS_ZERO) {
    return BigInt.fromI32(18)
  }
  if (tokenAddress.toHexString() == WBTC) {
    return BigInt.fromI32(8)
  }
  if (tokenAddress.toHexString() == USDC) {
    return BigInt.fromI32(6)
  }
  if (tokenAddress.toHexString() == AUC) {
    return BigInt.fromI32(18)
  }

  let contract = ERC20.bind(tokenAddress)
  let decimalValue = null
  let decimalResult = contract.try_decimals()
  if (!decimalResult.reverted) {
    decimalValue = decimalResult.value
  }
  return BigInt.fromI32(decimalValue as i32)
}

export function fetchTokenTotalSupply(tokenAddress: Address): BigInt {
  let contract = ERC20.bind(tokenAddress)
  let totalSupplyValue = null
  let totalSupplyResult = contract.try_totalSupply()
  if (!totalSupplyResult.reverted) {
    totalSupplyValue = totalSupplyResult as i32
  }
  return BigInt.fromI32(totalSupplyValue as i32)
}

export function getToken(tokenAddress: Address): Token {
  let token = Token.load(tokenAddress.toHexString()) as Token
  if (token == null) {
    token = new Token(tokenAddress.toHexString())
    token.symbol = fetchTokenSymbol(tokenAddress)
    token.name = fetchTokenName(tokenAddress)
    token.decimals = fetchTokenDecimals(tokenAddress)
    token.save()
  }
  return token
}

export function getTransaction(event: ethereum.Event): Transaction {
  let tx = Transaction.load(event.transaction.hash.toHexString()) as Transaction
  if (tx == null) {
    tx = new Transaction(event.transaction.hash.toHexString()) as Transaction
    tx.block = event.block.number
    tx.timestamp = event.block.timestamp
    tx.save()
  }
  return tx
}

export function getAcoTokenSituation(aco: Bytes, account: Bytes): ACOTokenSituation {
  let id = aco.toHexString()
  if (account != null) {
    id = id + "-" + account.toHexString()
  }
  let acoTokenSituation = ACOTokenSituation.load(id) as ACOTokenSituation
  if (acoTokenSituation == null) {
    acoTokenSituation = new ACOTokenSituation(id) as ACOTokenSituation
    acoTokenSituation.collateralizedTokens = ZERO_BD
    acoTokenSituation.assignableTokens = ZERO_BD
    acoTokenSituation.unassignableTokens = ZERO_BD
    acoTokenSituation.collateralAmount = ZERO_BD
    acoTokenSituation.assignableCollateral = ZERO_BD
    acoTokenSituation.unassignableCollateral = ZERO_BD
    acoTokenSituation.exercisedTokens = ZERO_BD
    acoTokenSituation.exercisedPayment = ZERO_BD
    acoTokenSituation.exerciseFee = ZERO_BD
    acoTokenSituation.save()
  }
  return acoTokenSituation
}

export function getTokenAmount(
  collateralAmount: BigInt, 
  isCall: boolean, 
  strikePrice: BigDecimal, 
  underlyingDecimals: BigInt): BigDecimal {
  if (isCall == true) {
    return collateralAmount.toBigDecimal()
  } else {
    return collateralAmount.toBigDecimal().times(exponentToBigDecimal(underlyingDecimals)).div(strikePrice)
  }
}

export function getCollateralAmount(
  tokenAmount: BigDecimal, 
  isCall: boolean, 
  strikePrice: BigDecimal, 
  underlyingDecimals: BigInt): BigDecimal {
  if (isCall == true) {
    return tokenAmount
  } else {
    return tokenAmount.times(strikePrice).div(exponentToBigDecimal(underlyingDecimals))
  }
}