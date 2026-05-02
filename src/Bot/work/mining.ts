import { Vec3 } from 'vec3'
import { BotWrapper } from '../bot.service'
import { PosXYZ } from '../utils/dto'
import { breakWithRetry, sleep } from '../utils/common.util'
import { startChestProcessor } from './chest-mining-processor'

export interface ConfigMining extends PosXYZ {
  cursor: boolean
}

export async function startMining(botData: BotWrapper, config: ConfigMining) {
  const { x, y, z, cursor } = config
  const targetLoc = new Vec3(x, y, z)
  const bot = botData.bot
  bot.chat('/is warp mine')

  const toolName = '_pickaxe'

  botData.profile.isWorking = true
  while (botData.profile.isWorking) {
    try {
      let emptySlotCount = bot.inventory.emptySlotCount()
      if (emptySlotCount === 0) {
        console.log(`[MINING ${botData.profile.name}] Inventory full → storing...`)
        await startChestProcessor(botData, false)
        await bot.waitForTicks(2)
        bot.chat('/is warp mine')
        await bot.waitForTicks(20)
        continue
      }

      await bot.lookAt(targetLoc, false)
      const block = cursor ? bot.blockAtCursor(5) : bot.blockAt(targetLoc)

      if (block) {
        await breakWithRetry(bot, block.position, toolName)
      }
    } catch (err: any) {
      console.log('[MINING ERROR]', err.message)
      botData.profile.isWorking = false
      throw err
    }

    await sleep(50)
  }
}
