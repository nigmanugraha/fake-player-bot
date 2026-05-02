import { Vec3 } from 'vec3'
import { goals, Movements, pathfinder } from 'mineflayer-pathfinder'
import { Bot } from 'mineflayer'
import { BotWrapper } from '../bot.service'
import { gotoBlock, log } from '../utils/common.util'


export async function expandIslandNew(botData: BotWrapper, blockName: string) {
  const bot = botData.bot
  const mcData = require('minecraft-data')(bot.version)
  const blockItem = mcData.itemsByName[blockName]
  const movement = new Movements(bot)
  movement.canDig = false
  bot.loadPlugin(pathfinder)
  bot.pathfinder.setMovements(movement)

  if (!blockItem) throw new Error('Invalid block')
  bot.loadPlugin(pathfinder)
  bot.chat('/is warp expand')
  const minX = -7824
  const maxX = -7774
  const minZ = 7825
  const maxZ = 7775
  const y = 81

  const lanes: number[] = []
  for (let i = minZ; i >= maxZ; i--) {
    lanes.push(i)
  }

  while (true) {
    await bot.waitForTicks(20)

    let direction = 1

    for (let i = 0; i < lanes.length; i++) {
      const z = lanes[i] + 0.5
      log('move', `🛣️ Lane ${i + 1} Z=${z}`)

      const xStart = direction === 1 ? minX : maxX
      const xEnd = direction === 1 ? maxX : minX
      const offsetX = 0.5 * direction * -1

      for (let x = xStart; direction === 1 ? x < xEnd : x >= xEnd; x += direction) {
        log('move', `📍 X=${x}`)
        const next = new Vec3(x + offsetX + direction, y, z)
        // cek inventory
        if (bot.inventory.count(blockItem.id, null) === 0) {
          console.log('Block habis, refill...')
          await bot.waitForTicks(20)
          await refillFromChest(bot, blockItem.name)
          await bot.waitForTicks(20)
          bot.chat('/is warp expand')
          await bot.waitForTicks(100)
          console.log('Balik kerja...')
        }
        await gotoBlock(bot, next)
      }

      // pindah lane
      if (i < lanes.length - 1) {
        const nextZ = lanes[i + 1] + 0.5
        const edgeX = direction === 1 ? maxX : minX
        const turnPos = new Vec3(edgeX + offsetX, y, nextZ)

        log('move', `🔁 Switch lane`)

        try {
          await gotoBlock(bot, turnPos)
        } catch {}

        direction *= -1
      }
    }
  }

  log('move', '🏁 Farming finished')
}

async function refillFromChest(bot: Bot, blockName: string) {
  const mcData = require('minecraft-data')(bot.version)
  const item = mcData.itemsByName[blockName]

  if (!item) throw new Error('Invalid item')

  // 1. warp ke chest
  bot.chat('/is warp chest')

  await bot.waitForTicks(20) // tunggu teleport

  // 2. cari chest terdekat
  const chestBlock = bot.findBlock({
    matching: block => block.name.includes('chest'),
    maxDistance: 6
  })

  if (!chestBlock) throw new Error('Chest tidak ditemukan')

  // 3. buka chest
  const chest = await bot.openChest(chestBlock)

  const items = chest.containerItems()

  const targetItem = items.find(i => i.name === blockName)

  if (!targetItem) {
    chest.close()
    throw new Error('Item di chest habis')
  }

  // 4. ambil sebanyak mungkin (atau limit)
  await chest.withdraw(targetItem.type, null, targetItem.count)

  chest.close()

  await bot.waitForTicks(20)
}
