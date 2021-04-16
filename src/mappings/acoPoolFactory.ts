import { Transaction, Token, ACOPool2 } from '../types/schema'
import { NewAcoPool } from '../types/templates/ACOPoolFactory2/ACOPoolFactory2'
import { ACOPool2 as ACOPoolTemplate } from '../types/templates'
import {
  fetchTokenSymbol,
  fetchTokenName,
  fetchTokenDecimals,
  getToken,
  getTransaction
} from './helpers'

export function handleNewAcoPool(event: NewAcoPool): void {
  let tx = getTransaction(event) as Transaction

  let underlying = getToken(event.params.underlying) as Token
  let strikeAsset = getToken(event.params.strikeAsset) as Token

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

  ACOPoolTemplate.create(event.params.acoPool)
  acoPool.save()
}
