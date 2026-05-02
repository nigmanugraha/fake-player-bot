import { pathfinder, Movements } from 'mineflayer-pathfinder'
import * as mineflayer from 'mineflayer'
import { Vec3 } from 'vec3'
import { log } from 'console'
import { BotWrapper } from '../bot.service'
import { hasItem, getItemFromChest, gotoBlock, breakWithRetry, isBlock } from '../utils/common.util'
import { PosXYZ, PosXZ } from '../utils/dto'
import { depositToStorageUnit } from '../skills/storage-unit'

export interface ConfigFarming {
  cropName: string
  direction: number // 1 for go to positive axis, -1 for go to negative axis
  start: PosXZ
  end: PosXZ
  y: number
  depositTo?: PosXYZ
}

// =======================
// 🚀 MAIN FARMING
// =======================
export async function startFarming(
  botData: BotWrapper,
  config: ConfigFarming,
  loop: boolean = true
) {
  const { end, start } = config
  const bot = botData.bot
  bot.loadPlugin(pathfinder)

  const startZ = start.z
  const endZ = end.z

  botData.profile.isWorking = true
  bot.chat('/sell all')

  const lanes = getGrassLanes(startZ, endZ)
  const toolName = '_axe'

  if (!loop) {
    await processFarm(botData, config, lanes, toolName)
    bot.chat('/sell all')
    return
  }

  while (botData.profile.isWorking) {
    await processFarm(botData, config, lanes, toolName)
  }
  bot.chat('/sell all')

  log('move', '🏁 Farming finished')
}

async function processFarm(
  botData: BotWrapper,
  config: ConfigFarming,
  lanes: number[],
  toolName: string
) {
  const { cropName, end, start, y, depositTo } = config
  let { direction } = config
  const side = direction
  const startX = start.x
  const endX = end.x

  const bot = botData.bot
  bot.chat(`/is warp ${cropName}`)
  await bot.waitForTicks(20)

  if (!hasItem(bot, toolName)) {
    log('move', 'Take axe from chest')
    await getItemFromChest(bot, toolName, 1)
  }

  for (let i = 0; i < lanes.length; i++) {
    if (!botData.profile.isWorking) break

    const z = lanes[i] + 0.5
    log('move', `🛣️ Lane ${i + 1} Z=${z}`)

    const xStart = direction === 1 ? startX : endX
    const xEnd = direction === 1 ? endX : startX
    const offsetX = 0.5 * direction * -1

    for (let x = xStart; direction === 1 ? x < xEnd : x >= xEnd; x += direction) {
      if (!botData.profile.isWorking) break

      log('move', `📍 X=${x}`)

      const current = new Vec3(x + offsetX, y, z)
      const next = new Vec3(x + offsetX + direction, y, z)

      const sideZ = z - side // ubah ke z-1 kalau mau sisi lain

      await moveStep(bot, current, next, direction, cropName, toolName, sideZ)

      const emptySlotCount = bot.inventory.emptySlotCount()
      if (emptySlotCount === 0 && depositTo) {
        const depositPos = new Vec3(depositTo.x, depositTo.y, depositTo.z)
        const depoistBlock = bot.blockAt(depositPos)
        if (depoistBlock) {
          await bot.waitForTicks(20)
          bot.chat('/is')
          await bot.waitForTicks(20)
          await depositToStorageUnit(bot, depositPos)
          await bot.waitForTicks(20)
          return await processFarm(botData, config, lanes, toolName)
        }
      }
    }

    // pindah lane
    if (i < lanes.length - 1) {
      const nextZ = lanes[i + 1] + 0.5
      const edgeX = direction === 1 ? endX : startX
      const turnPos = new Vec3(edgeX + offsetX, y, nextZ)

      log('move', `🔁 Switch lane`)

      try {
        const movements = new Movements(bot)
        movements.canDig = true
        bot.pathfinder.setMovements(movements)

        await gotoBlock(bot, turnPos)
      } catch {}

      direction *= -1
    }
  }
}

// =======================
// 🚶 MOVE + SWEEP
// =======================
async function moveStep(
  bot: mineflayer.Bot,
  current: Vec3,
  next: Vec3,
  direction: number,
  cropName: string,
  toolName: string,
  sideZ?: number
) {
  const mainPos = next
  const sidePos = sideZ !== undefined ? new Vec3(next.x, next.y, sideZ) : null

  log('move', `➡️ Step ${current} → ${next}`)

  await breakWithRetry(bot, mainPos, toolName, cropName, true)
  if (sidePos) await breakWithRetry(bot, sidePos, toolName, cropName, true)

  let stuckTick = 0
  let lastDist = Infinity
  let reached = false
  while (true) {
    const pos = bot.entity.position
    const dist = pos.distanceTo(mainPos)

    if (direction === 1) {
      // jalan ke arah +X
      reached = pos.x >= mainPos.x - 0.2
    } else {
      // jalan ke arah -X
      reached = pos.x <= mainPos.x + 0.2
    }

    if (reached || dist < 0.5) {
      log('move', `✅ Arrived/Passed ${pos} : ${mainPos}`)
      break
    }
    log('move', `Move to ${mainPos} : ${Math.abs(dist - lastDist)}`)
    // detect stuck
    if (Math.abs(dist - lastDist) < 0.05) {
      stuckTick++
    }

    lastDist = dist

    if (stuckTick > 10) {
      await bot.waitForTicks(2)
      bot.setControlState('forward', false)
      bot.chat('/spawn')
      await bot.waitForTicks(100)
      bot.chat('/back')
      await bot.waitForTicks(100)

      const block = bot.findBlock({
        matching: block => isBlock(block, cropName),
        maxDistance: 1
      })
      if (block) {
        log('stuck', `⚠️ Stuck → retry clear ${block?.position}`)
        await breakWithRetry(bot, block.position, toolName, cropName, true)
        stuckTick = 0
      }
    }

    const block = bot.blockAt(mainPos)
    if (block && block.name !== 'air') {
      log('dig', `🚧 Block reappeared ${block.name}`)
      await breakWithRetry(bot, mainPos, toolName, cropName, true)
      continue
    }

    if (sidePos) {
      const sideBlock = bot.blockAt(sidePos)
      if (sideBlock && sideBlock.name !== 'air') {
        log('dig', `🌽 Side block at ${sidePos}`)
        await breakWithRetry(bot, sidePos, toolName, cropName, true)
      }
    }

    bot.lookAt(mainPos.offset(0.5 * direction, 1, 0.5), true)
    bot.setControlState('forward', true)

    await bot.waitForTicks(1)
  }

  bot.setControlState('forward', false)
}

function getGrassLanes(startZ: number, endZ: number, anchor: number = 7825): number[] {
  const steps = [4, 5]

  const min = Math.min(startZ, endZ)
  const max = Math.max(startZ, endZ)

  const lanes: number[] = []

  let z = anchor
  let i = 0

  // generate dari anchor ke bawah
  while (z >= min) {
    if (z <= max) {
      lanes.push(z)
    }

    z -= steps[i % 2]
    i++
  }

  // sesuaikan arah hasil (biar start → end)
  if (startZ < endZ) {
    lanes.reverse()
  }

  return lanes
}
