import { Bytes, BigInt, BigDecimal, Address, dataSource, ethereum } from '@graphprotocol/graph-ts'
import { ERC20 } from '../types/ACOFactory/ERC20'
import { Token, Transaction, ACOTokenSituation, AggregatorProxy, AggregatorInterface, ACOAssetConverterHelper } from '../types/schema'
import { ACOAssetConverterHelper as ACOAssetConverterHelperContract } from '../types/templates/ACOAssetConverterHelper/ACOAssetConverterHelper'
import { AggregatorProxy as AggregatorProxyContract } from '../types/templates/AggregatorProxy/AggregatorProxy'
import { AggregatorInterface as AggregatorInterfaceContract } from '../types/templates/AggregatorInterface/AggregatorInterface'
import { ACOAssetConverterHelper as AssetConverterTemplate, AggregatorProxy as AggregatorProxyTemplate, AggregatorInterface as AggregatorInterfaceTemplate } from '../types/templates'

let network = dataSource.network()

let WBTC = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'
let USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
let AUC = '0xc12d099be31567add4e4e4d0d45691c3f58f5663'
let ACO_FACTORY = '0x176b98ab38d1ae8ff3f30bf07f9b93e26f559c17'
let ACO_POOL_FACTORY = '0xe28520ddb1b419ac37ecdbb2c0f97c8cf079ccc3'
let ZRX_EXCHANGE = '0x61935cbdd02287b511119ddb11aeb42f1593b7ef'
let ZRX_V4_EXCHANGE = '0xdef1c0ded9bec7f1a1670819833240f027b25eff'
let BUYER = '0xdd43b83af3bbf093d2c323f065a8169fd2e39265'
let BUYER_V2 = '0xa52c8ee8f328a478d8efcba9c4177bd9ba6f9710'
let WRITER = '0xe7597f774fd0a15a617894dc39d45a28b97afa4f'
let WRITER_V2 = '0x977ce0d7f56197a0440a93fa9563e11c509babba'
let VAULT_V1 = '0x5d28b41bbad874b5efeee0b4158bc50d0af5f637'
let VAULT_V2 = '0xad45001fc1f10e348a41e871901f936992d80f79'
let ACO_OTC_V1 = '0x4e91baee70d392b74f40565bba451638aa777ff0'
let ACO_OTC_V2 = '0x7ebe3599ba37fd20dda884010d38e6dd75982d81'
let ACO_POOL_BLOCK = 11511139
let ACO_POOL_IMPLEMENTATION_V1 = '0x68153d392966d38b7ae4415bd5778d02a579a437'
let ACO_POOL_IMPLEMENTATION_V2 = '0x1275c3070bba4c88031a726ab2cbd2f31605226a'
let ACO_POOL_IMPLEMENTATION_V3 = '0xb4f28d9aa4ae8070ba1dea1f2fd888a64b45aa17'
let ACO_POOL_IMPLEMENTATION_V4 = '0x366a6677fe197e3f1e76eb0f7cd2aaf35939d51a'
let ACO_POOL_IMPLEMENTATION_V5 = '0x6bdbd1adbf93d24ef55fb35d23d695c8f82c6d6a'

if (network == 'kovan') {
  WBTC = '0x4000132b399b6c85e465b60c9d897b6745149fee'
  USDC = '0xe22da380ee6b445bb8273c81944adeb6e8450422'
  AUC = '0xa24cbf0e7596b3601b01045791a73897b39068e4'
  ACO_FACTORY = '0x53661cec8d21b1c5f362b05f682070f3f6116c55'
  ACO_POOL_FACTORY = '0xd5f37ae12385184752a9cecdbe57f12253c973b9'
  ZRX_EXCHANGE = '0x4eacd0af335451709e1e7b570b8ea68edec8bc97'
  ZRX_V4_EXCHANGE = '0xdef1c0ded9bec7f1a1670819833240f027b25eff'
  BUYER = '0x75761a6afa36c3a68c1803caa12228ae738df189'
  BUYER_V2 = '0x57830677a9221fd2eaf53d4fe9e10cdc89fa584b'
  WRITER = '0x436abbb990a73ea35cf9aafce581bb0db15f9e22'
  WRITER_V2 = '0x817020d326ac4ab9e17f228879b3b4aabe0685b3'
  VAULT_V1 = '0x0e76b8cc3b16a3f1dd286550d05d489b5cf00456'
  VAULT_V2 = '0x49a98a7547fcae51744e14fbe23cc60520a9fff5'
  ACO_OTC_V1 = '0x17ee535ede5495c48116030f7e09c09c49ab03fc'
  ACO_OTC_V2 = '0xd81d59562f6564db5d31e9fb0ce7209d8977b83c'
  ACO_POOL_BLOCK = 22704460
  ACO_POOL_IMPLEMENTATION_V1 = '0x77ad4ffe20f32b88d3bf915450c0b4a2ede59a81'
  ACO_POOL_IMPLEMENTATION_V2 = '0x65b83b913d0f0a4f6d82d0903de09c31f5e2e56c'
  ACO_POOL_IMPLEMENTATION_V3 = '0xea0c6266863209d045de9dfee1b5438e595e739b'
  ACO_POOL_IMPLEMENTATION_V4 = '0x3ef80891533f9a4bd249a672ddb000c431c82751'
  ACO_POOL_IMPLEMENTATION_V5 = '0xbaddef2fa825ec4cbddf45e4ff52213131d69be0'
} else if (network == 'ropsten') {
  WBTC = '0xc778417e063141139fce010982780140aa0cd5ab'
  USDC = '0x0f3aaa63538ea7098d0778264d6d136821c3ca1e'
  AUC = '0xdbb4f48b103e68273efd4a653949f020bda0aeaf'
  ACO_FACTORY = '0xf44e41ef2487dff9db6449e299ac8f7c07f7f3ca'
  ACO_POOL_FACTORY = '0x7fec33c33a9b9a3a3521ee2eed7196372edb5f00'
  ZRX_EXCHANGE = 'na'
  ZRX_V4_EXCHANGE = '0xdef1c0ded9bec7f1a1670819833240f027b25eff'
  BUYER = 'na'
  BUYER_V2 = '0x313c2658574626b75b58b4b2948e7d14c6226f4f'
  WRITER = 'na'
  WRITER_V2 = '0x6abfce87d849ea772244ebb2cdbc6410d3796baf'
  VAULT_V1 = 'na'
  VAULT_V2 = '0x258f4b8c6b93221fb9f035d4c8d0cb010f56674c'
  ACO_OTC_V1 = 'na'
  ACO_OTC_V2 = '0x122fbb55c8cdda2a9f2d5b68a7f84bf6041c57fc'
  ACO_POOL_BLOCK = 10216558
  ACO_POOL_IMPLEMENTATION_V1 = 'na'
  ACO_POOL_IMPLEMENTATION_V2 = 'na'
  ACO_POOL_IMPLEMENTATION_V3 = 'na'
  ACO_POOL_IMPLEMENTATION_V4 = '0xdb0528bfb418c1fe75cbdc14f3eeefe6149ade7e'
  ACO_POOL_IMPLEMENTATION_V5 = '0x1ef8047564e0a795247c0f270f71d11e7210b4ed'
} else if (network == 'arbitrum-rinkeby') {
  WBTC = '0xf57c505f9882052ddeb24bc3ab7f1b017690277a'
  USDC = '0x5cdf2373a02362fef0e035edfc64292cb7ea33ea'
  AUC = '0x4995ab1dc70edf55a12aa65996c090cd58ca939e'
  ACO_FACTORY = '0x4027c2f9ddf0edd831cb70c043d53ec6217a48eb'
  ACO_POOL_FACTORY = '0xae7a8e93a6f9dab37b92b65d3d6d8536da9f6db5'
  ZRX_EXCHANGE = 'na'
  ZRX_V4_EXCHANGE = 'todo'
  BUYER = 'na'
  BUYER_V2 = '0xaefb48218fc50606b1ea85ebffa17663796528c7'
  WRITER = 'na'
  WRITER_V2 = 'todo'
  VAULT_V1 = 'na'
  VAULT_V2 = 'na'
  ACO_OTC_V1 = 'na'
  ACO_OTC_V2 = '0xe0377b3eab4b2788897adb5a70dfcbfaf7d3cf1f'
  ACO_POOL_BLOCK = 32291
  ACO_POOL_IMPLEMENTATION_V1 = 'na'
  ACO_POOL_IMPLEMENTATION_V2 = 'na'
  ACO_POOL_IMPLEMENTATION_V3 = 'na'
  ACO_POOL_IMPLEMENTATION_V4 = 'na'
  ACO_POOL_IMPLEMENTATION_V5 = '0x132c2615d52c3c3d185ef365ad11f65bc9f620d4'
}

export let ACO_FACTORY_ADDRESS = ACO_FACTORY
export let ACO_POOL_FACTORY_ADDRESS = ACO_POOL_FACTORY
export let ZRX_EXCHANGE_ADDRESS = ZRX_EXCHANGE
export let ZRX_V4_EXCHANGE_ADDRESS = ZRX_V4_EXCHANGE
export let BUYER_ADDRESS = BUYER
export let WRITER_ADDRESS = WRITER
export let BUYER_V2_ADDRESS = BUYER_V2
export let WRITER_V2_ADDRESS = WRITER_V2
export let VAULT_V1_ADDRESS = VAULT_V1
export let VAULT_V2_ADDRESS = VAULT_V2
export let ACO_OTC_V1_ADDRESS = ACO_OTC_V1
export let ACO_OTC_V2_ADDRESS = ACO_OTC_V2
export let ACO_POOL_START = ACO_POOL_BLOCK
export let ACO_POOL_IMPL_V1_ADDRESS = ACO_POOL_IMPLEMENTATION_V1
export let ACO_POOL_IMPL_V2_ADDRESS = ACO_POOL_IMPLEMENTATION_V2
export let ACO_POOL_IMPL_V3_ADDRESS = ACO_POOL_IMPLEMENTATION_V3
export let ACO_POOL_IMPL_V4_ADDRESS = ACO_POOL_IMPLEMENTATION_V4
export let ACO_POOL_IMPL_V5_ADDRESS = ACO_POOL_IMPLEMENTATION_V5

export let MINIMUM_POOL_COLLATERAL_VALUE = BigDecimal.fromString('1000')
export let MINIMUM_POOL_SHARE_UPDATE = BigInt.fromI32(1200)
export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let ZERO_BD = BigDecimal.fromString('0')
export let ONE_BD = BigDecimal.fromString('1')

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
  let value = tokenAmount.toBigDecimal()
  if (value < ZERO_BD) {
    return value
  }
  return value.div(exponentToBigDecimal(decimals))
}

export function convertDecimalToToken(value: BigDecimal, decimals: BigInt): BigInt {
  if (decimals == ZERO_BI) {
    return BigInt.fromString(value.toString())
  }
  return BigInt.fromString((value.times(exponentToBigDecimal(decimals))).toString().split('.')[0])
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
    totalSupplyValue = totalSupplyResult.value as BigInt
  }
  return totalSupplyValue
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
  return getTransactionByData(event.transaction, event.block, event.logIndex)
}

export function getTransactionByCall(call: ethereum.Call): Transaction {
  return getTransactionByData(call.transaction, call.block, null)
}

export function getTransactionByData(transaction: ethereum.Transaction, block: ethereum.Block, logIndex: BigInt): Transaction {
  let id = transaction.hash.toHexString()
  if (logIndex != null) {
    id = id + "-" + logIndex.toString()
  }
  let tx = Transaction.load(id) as Transaction
  if (tx == null) {
    tx = new Transaction(id) as Transaction
    tx.block = block.number
    tx.timestamp = block.timestamp
    tx.index = transaction.index
    tx.logIndex = logIndex
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
  collateralDecimals: BigInt): BigDecimal {
  let collateralValue = convertTokenToDecimal(collateralAmount, collateralDecimals)
  if (isCall == true) {
    return collateralValue
  } else {
    return collateralValue.div(strikePrice)
  }
}

export function getCollateralAmount(
  tokenAmount: BigDecimal, 
  isCall: boolean, 
  strikePrice: BigDecimal): BigDecimal {
  if (isCall == true) {
    return tokenAmount
  } else {
    return tokenAmount.times(strikePrice)
  }
}

export function getAggregatorInterface(event: ethereum.Event, assetConverter: Bytes, baseAsset: Bytes, quoteAsset: Bytes): AggregatorInterface {
  let acContract = ACOAssetConverterHelperContract.bind(Address.fromString(assetConverter.toHexString())) as ACOAssetConverterHelperContract
  let pairDataResult = acContract.try_getPairData(Address.fromString(baseAsset.toHexString()), Address.fromString(quoteAsset.toHexString()))
  if (!pairDataResult.reverted && pairDataResult.value.value0.toHexString() != ADDRESS_ZERO) {
    let proxy = AggregatorProxy.load(pairDataResult.value.value0.toHexString()) as AggregatorProxy
    let tx = null as Transaction
    let isNew = false
    if (proxy == null) {
      isNew = true
      tx = getTransaction(event) as Transaction
      proxy = new AggregatorProxy(pairDataResult.value.value0.toHexString()) as AggregatorProxy
      proxy.assetConverter = assetConverter.toHexString()
      proxy.baseAsset = baseAsset
      proxy.quoteAsset = quoteAsset
      proxy.tx = tx.id
      let proxyContract = AggregatorProxyContract.bind(pairDataResult.value.value0) as AggregatorProxyContract
      let aggResult = proxyContract.try_aggregator()
      if (!aggResult.reverted && aggResult.value.toHexString() != ADDRESS_ZERO) {
        proxy.aggregator = aggResult.value.toHexString()
      } else {
        return null as AggregatorInterface
      }
    }
    let aggContract = AggregatorInterfaceContract.bind(Address.fromString(proxy.aggregator)) as AggregatorInterfaceContract
    let agg = AggregatorInterface.load(proxy.aggregator) as AggregatorInterface
    if (agg == null) {
      agg = new AggregatorInterface(proxy.aggregator) as AggregatorInterface
      agg.proxy = pairDataResult.value.value0.toHexString()
      let decimalsResult = aggContract.try_decimals()
      if (!decimalsResult.reverted) {
        agg.decimals = BigInt.fromI32(decimalsResult.value)
      } else {
        return null as AggregatorInterface
      }
    } else if (agg.proxy != pairDataResult.value.value0.toHexString()) {
      agg.proxy = pairDataResult.value.value0.toHexString()
    }
    let answer = aggContract.try_latestAnswer()
    let timestamp = aggContract.try_latestTimestamp()
    if (!answer.reverted && !timestamp.reverted) {
      if (tx == null) {
        tx = getTransaction(event) as Transaction
      }
      agg.price = convertTokenToDecimal(answer.value, agg.decimals)
      agg.oracleUpdatedAt = timestamp.value
      agg.tx = tx.id
      agg.save()
      if (isNew) {
        proxy.save()
      }
      return agg
    }
  }
  return null as AggregatorInterface
}

export function setAssetConverterHelper(
  transaction: ethereum.Transaction, 
  block: ethereum.Block, 
  logIndex: BigInt,
  assetConverter: Bytes, 
  baseAsset: Bytes, 
  quoteAsset: Bytes): AggregatorInterface {
  let agg = null as AggregatorInterface
  if (assetConverter != null) {
    let ac = ACOAssetConverterHelper.load(assetConverter.toHexString()) as ACOAssetConverterHelper
    if (ac == null) {
      ac = new ACOAssetConverterHelper(assetConverter.toHexString()) as ACOAssetConverterHelper
      AssetConverterTemplate.create(Address.fromString(assetConverter.toHexString()))
      ac.save()
    }
    let acContract = ACOAssetConverterHelperContract.bind(Address.fromString(assetConverter.toHexString())) as ACOAssetConverterHelperContract
    let pairDataResult = acContract.try_getPairData(Address.fromString(baseAsset.toHexString()), Address.fromString(quoteAsset.toHexString()))
    if (!pairDataResult.reverted && pairDataResult.value.value0.toHexString() != ADDRESS_ZERO) {
      agg = setAggregatorProxy(transaction, block, logIndex, assetConverter, pairDataResult.value.value0, baseAsset, quoteAsset)
    }
  }
  return agg
}

export function setAggregatorProxy(
  transaction: ethereum.Transaction, 
  block: ethereum.Block, 
  logIndex: BigInt,
  assetConverter: Bytes,
  proxyAddress: Bytes, 
  baseAsset: Bytes, 
  quoteAsset: Bytes): AggregatorInterface {
  if (baseAsset != null && quoteAsset != null && baseAsset.toHexString() != quoteAsset.toHexString()) {
    let proxy = AggregatorProxy.load(proxyAddress.toHexString()) as AggregatorProxy
    let isNew = false
    if (proxy == null) {
      isNew = true
      proxy = new AggregatorProxy(proxyAddress.toHexString()) as AggregatorProxy
    }
    let tx = getTransactionByData(transaction, block, logIndex) as Transaction
    proxy.tx = tx.id
    proxy.quoteAsset = quoteAsset
    proxy.baseAsset = baseAsset
    proxy.assetConverter = assetConverter.toHexString()

    let proxyContract = AggregatorProxyContract.bind(Address.fromString(proxyAddress.toHexString())) as AggregatorProxyContract
    let aggResult = proxyContract.try_aggregator()
    if (!aggResult.reverted && aggResult.value.toHexString() != ADDRESS_ZERO) {
      let agg = setAggregatorInterface(transaction, block, logIndex, proxyAddress, aggResult.value)
      proxy.aggregator = agg.id

      if (isNew) {    
        AggregatorProxyTemplate.create(Address.fromString(proxyAddress.toHexString()))
      }
      proxy.save()
      return agg
    }
  }
  return null as AggregatorInterface
}

export function setAggregatorInterface(
  transaction: ethereum.Transaction, 
  block : ethereum.Block, 
  logIndex: BigInt,
  proxy: Bytes, 
  aggregator: Bytes): AggregatorInterface {
  let aggContract = AggregatorInterfaceContract.bind(Address.fromString(aggregator.toHexString())) as AggregatorInterfaceContract
  let agg = AggregatorInterface.load(aggregator.toHexString()) as AggregatorInterface
  let isNew = false
  if (agg == null) {
    isNew = true
    let decimals = aggContract.decimals()
    agg = new AggregatorInterface(aggregator.toHexString()) as AggregatorInterface
    agg.proxy = proxy.toHexString()
    agg.decimals = BigInt.fromI32(decimals)
  } else if (proxy.toHexString() != agg.proxy) {
    agg.proxy = proxy.toHexString()
  }
  let answer = aggContract.latestAnswer()
  let timestamp = aggContract.latestTimestamp()
  let tx = getTransactionByData(transaction, block, logIndex) as Transaction
  agg.price = convertTokenToDecimal(answer, agg.decimals)
  agg.oracleUpdatedAt = timestamp
  agg.tx = tx.id
  if (isNew) {
    AggregatorInterfaceTemplate.create(Address.fromString(aggregator.toHexString()))
  }
  agg.save()
  return agg
}

export function parseHexNumToBigInt(input: string): BigInt {
  if (!input.startsWith("0x")) {
    input = "0x" + input
  }
  return BigInt.fromUnsignedBytes((Bytes.fromHexString(input) as Bytes).reverse() as Bytes)
}

export function parseHexNumToI32(input: string): i32 {
  let bigInt = parseHexNumToBigInt(input)
  return bigInt.toI32()
}