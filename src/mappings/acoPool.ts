import { Address } from '@graphprotocol/graph-ts'
import { ACOToken, Transaction, Token, Swap } from '../types/schema'
import { Swap as SwapEvent } from '../types/templates/ACOPool2/ACOPool2'
import {
  getToken,
  getTransaction,
  ONE_BI,
  convertTokenToDecimal
} from './helpers'

export function handlePoolSwap(event: SwapEvent): void {
  let aco = ACOToken.load(event.params.acoToken.toHexString()) as ACOToken
  let strikeAsset = getToken(Address.fromString(aco.strikeAsset)) as Token

  let price = convertTokenToDecimal(event.params.price, strikeAsset.decimals)
  let acoAmount = convertTokenToDecimal(event.params.tokenAmount, aco.decimals)

  let tx = getTransaction(event) as Transaction
  let swap = new Swap(event.params.acoToken.toHexString() + "-" + event.address.toHexString() + "-" + event.params.account.toHexString() + event.transaction.hash.toHexString()) as Swap
  swap.aco = aco.id
  swap.seller = event.address
  swap.buyer = event.params.account
  swap.taker = event.params.account
  swap.type = "Pool"
  swap.paymentToken = strikeAsset.id
  swap.paymentAmount = price
  swap.acoAmount = acoAmount
  swap.tx = tx.id
  swap.save()
  aco.swapsCount = aco.swapsCount.plus(ONE_BI)
  let swaps = aco.swaps
  aco.swaps = swaps.concat([swap.id])
  aco.save()
}
