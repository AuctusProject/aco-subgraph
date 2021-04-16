import { BigInt, Address, ethereum } from '@graphprotocol/graph-ts'
import { ACOToken, Transaction, Token, ACOTokenSituation, ACOPoolFactory2 } from '../types/schema'
import { NewAcoToken, NewAcoTokenData } from '../types/ACOFactory/ACOFactory'
import { ACOToken as ACOContract } from '../types/ACOFactory/ACOToken'
import { ACOToken as ACOTemplate, ACOPoolFactory2 as ACOPoolFactoryTemplate } from '../types/templates'
import {
  ZERO_BD,
  ZERO_BI,
  fetchTokenSymbol,
  fetchTokenName,
  fetchTokenDecimals,
  getToken,
  getTransaction,
  getAcoTokenSituation,
  convertTokenToDecimal,
  ACO_POOL_FACTORY_ADDRESS,
  ACO_POOL_START
} from './helpers'

export function handleNewACODeprecated(event: NewAcoToken): void {
  createACOPoolFactoryWithNecessary(event)
  let tx = getTransaction(event) as Transaction
  setAco(
    event.params.underlying, 
    event.params.strikeAsset, 
    event.params.isCall, 
    event.params.strikePrice, 
    event.params.expiryTime, 
    event.params.acoToken, 
    event.params.acoTokenImplementation, 
    null,
    tx)
}

export function handleNewACO(event: NewAcoTokenData): void {
  createACOPoolFactoryWithNecessary(event)
  let tx = getTransaction(event) as Transaction
  setAco(
    event.params.underlying, 
    event.params.strikeAsset, 
    event.params.isCall, 
    event.params.strikePrice, 
    event.params.expiryTime, 
    event.params.acoToken, 
    event.params.acoTokenImplementation, 
    event.params.creator,
    tx)
}

function createACOPoolFactoryWithNecessary(event: ethereum.Event): void {
  let acoPoolFactory = ACOPoolFactory2.load(ACO_POOL_FACTORY_ADDRESS) as ACOPoolFactory2
  if (acoPoolFactory == null && event.block.number.ge(BigInt.fromI32(ACO_POOL_START))) {
    acoPoolFactory = new ACOPoolFactory2(ACO_POOL_FACTORY_ADDRESS) as ACOPoolFactory2
    ACOPoolFactoryTemplate.create(Address.fromString(ACO_POOL_FACTORY_ADDRESS))
    acoPoolFactory.save()
  }
}

function setAco(
  underlying: Address, 
  strikeAsset: Address,
  isCall: boolean,
  strikePrice: BigInt,
  expiryTime: BigInt,
  acoToken: Address,
  acoTokenImplementation: Address,
  creator: Address,
  tx: Transaction
): void {
  let underlyingToken = getToken(underlying) as Token
  let strikeAssetToken = getToken(strikeAsset) as Token

  let acoContract = ACOContract.bind(acoToken)
  let aco = new ACOToken(acoToken.toHexString()) as ACOToken

  let maxExercisedAccounts = null as BigInt
  let maxExercisedAccountsResult = acoContract.try_maxExercisedAccounts() 
  if (!maxExercisedAccountsResult.reverted) {
    maxExercisedAccounts = maxExercisedAccountsResult.value as BigInt
  }

  aco.underlying = underlyingToken.id
  aco.strikeAsset = strikeAssetToken.id
  aco.collateral = (isCall == true ? underlyingToken.id : strikeAssetToken.id)
  aco.symbol = fetchTokenSymbol(acoToken)
  aco.name = fetchTokenName(acoToken)
  aco.decimals = fetchTokenDecimals(acoToken)
  aco.isCall = isCall
  aco.strikePrice = convertTokenToDecimal(strikePrice, strikeAssetToken.decimals)
  aco.expiryTime = expiryTime
  aco.totalSupply = ZERO_BD
  aco.fee = convertTokenToDecimal(acoContract.acoFee(), BigInt.fromI32(5))
  aco.feeDestination = acoContract.feeDestination()
  aco.maxExercisedAccounts = maxExercisedAccounts
  aco.creator = creator
  aco.implementation = acoTokenImplementation
  aco.tx = tx.id
  aco.mintsCount = ZERO_BI
  aco.burnsCount = ZERO_BI
  aco.exercisesCount = ZERO_BI
  aco.accountsCount = ZERO_BI
  aco.swapsCount = ZERO_BI
  let acoTokenSituation = getAcoTokenSituation(acoToken, null) as ACOTokenSituation
  aco.situation = acoTokenSituation.id

  ACOTemplate.create(acoToken)

  aco.save()
}
