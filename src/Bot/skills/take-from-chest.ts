import { Bot } from 'mineflayer'
import { Vec3 } from 'vec3'
import { Block } from 'prismarine-block'

export interface DesiredItem {
  name: string
  amount: number
}

export interface ConfigTakeFromChest {
  chestBlock: Block
  desiredItems?: DesiredItem[]
  exclude?: string[]
  callback<T>(data: any): T | Promise<T>
}

export async function takeItemFromChest(bot: Bot, config: ConfigTakeFromChest) {
  const { chestBlock, exclude = [], callback, desiredItems } = config
  let chest = await bot.openChest(chestBlock)
  let hasItem = false
  let emptySlotCount = bot.inventory.emptySlotCount()

  for (const item of chest.containerItems()) {
    if (!item) continue
    if (exclude.includes(item.name)) continue
    if (desiredItems && desiredItems.some(i => i.name === item.name)) continue

    hasItem = true
    await bot.waitForTicks(2)
    console.log(`[Check Inventory] ${emptySlotCount}`)
    emptySlotCount = await callback<number>({ emptySlotCount })
    await bot.waitForTicks(2)

    try {
      const amount = desiredItems?.find(i => i.name === item.name)?.amount || item.count
      await chest.withdraw(item.type, null, amount)
      await bot.waitForTicks(6)
      emptySlotCount--
    } catch (err) {
      console.log(`[Take From Chest] Error: `, err)
      break
    }
  }
  chest.close()
  return hasItem
}
