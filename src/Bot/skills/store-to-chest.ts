import { BotWrapper } from '../bot.service'
import { emptyHand, getBlock, getNearbyBlock } from '../utils/common.util'
import { PosXYZ } from '../utils/dto'

export interface ConfigStoreChest {
  nearby: boolean
  pos?: PosXYZ
  exclude?: string[]
  include?: string[]
}

export async function storeToChest(botData: BotWrapper, config: ConfigStoreChest) {
  const { include, exclude = [], pos, nearby = true } = config
  const bot = botData.bot
  await emptyHand(botData.bot)
  await botData.bot.waitForTicks(20)
  const chestName = 'chest'
  const chestBlock = nearby ? getNearbyBlock(bot, chestName, 6) : getBlock(bot, chestName, pos)

  if (!chestBlock) {
    console.log('Chest not found')
    return 'Chest not found'
  }

  const chest = await botData.bot.openChest(chestBlock)

  for (const item of botData.bot.inventory.items()) {
    if (exclude.includes(item.name)) continue
    if (include && !include.includes(item.name)) continue

    for (let i = 0; i < item.count; i++) {
      try {
        await chest.deposit(item.type, null, item.count)
        await botData.bot.waitForTicks(2)
        console.log(`${item.name} : ${item.count}`)
      } catch (e) {
        console.log('Fail deposit:', item.name)
        break
      }
    }
  }

  chest.close()
  return 'Inventory berhasil dipindahkan'
}
