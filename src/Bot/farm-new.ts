import { pathfinder, Movements, goals } from 'mineflayer-pathfinder'
import * as mineflayer from 'mineflayer'
const { GoalBlock } = goals
import { Vec3 } from 'vec3'
import { BotWrapper } from './bot.service'
import { Block } from 'prismarine-block'
import { emptyHand, gotoBlock } from './utils/common.util'

// =======================
// 🔧 DEBUG CONFIG
// =======================
const DEBUG = {
  enabled: true,
  move: true,
  dig: true,
  scan: true,
  stuck: true
}

function log(type: keyof typeof DEBUG, msg: string) {
  if (!DEBUG.enabled) return
  if (!DEBUG[type]) return

  const time = new Date().toISOString()
  console.log(`[${type.toUpperCase()}][${time}] ${msg}`)
}

// =======================
function isPumpkin(block: Block) {
  return block && block.name === 'pumpkin'
}

// =======================
// 🔥 CLEAR (ANTI RESPAWN)
// =======================
async function clearWithRetry(bot: mineflayer.Bot, pos: Vec3) {
  let attempt = 0
  while (true) {
    await ensureAxeInHotbar(bot)
    const block = bot.blockAt(pos)

    if (!block || block.name === 'air') {
      log('scan', `✅ Clear at ${pos}`)
      break
    }

    if (!block.diggable) {
      log('scan', `❌ Not diggable ${block.name} at ${pos}`)
      break
    }

    if (!isPumpkin(block)) {
      log('scan', `⏭ Skip ${block.name}`)
      break
    }

    attempt++
    log('dig', `🎃 Dig attempt ${attempt} at ${pos}`)

    try {
      bot.setControlState('sneak', true)
      await bot.dig(block)
      bot.setControlState('sneak', false)
    } catch (err: any) {
      bot.setControlState('sneak', false)
      log('dig', `💥 Dig failed: ${err.message}`)
    }

    await bot.waitForTicks(2)

    if (attempt > 5) {
      log('dig', `⚠️ Too many retries at ${pos}`)
      break
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
  sideZ?: number
) {
  const mainPos = next
  const sidePos = sideZ !== undefined ? new Vec3(next.x, next.y, sideZ) : null

  log('move', `➡️ Step ${current} → ${next}`)

  await clearWithRetry(bot, mainPos)
  if (sidePos) await clearWithRetry(bot, sidePos)

  let stuckTick = 0
  let lastDist = Infinity
  let reached = false
  while (true) {
    await bot.waitForTicks(2)
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
    log('move', `Move to ${mainPos} : ${pos} :  ${Math.abs(dist - lastDist)}`)
    // detect stuck
    if (Math.abs(dist - lastDist) < 0.05) {
      console.log(stuckTick)
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
        matching: block => isPumpkin(block),
        maxDistance: 4
      })
      if (block) {
        log('stuck', `⚠️ Stuck → retry clear ${block?.position}`)
        await clearWithRetry(bot, block.position)
        stuckTick = 0
      }
    }

    const block = bot.blockAt(mainPos)
    if (block && block.name !== 'air') {
      log('dig', `🚧 Block reappeared ${block.name}`)
      await clearWithRetry(bot, mainPos)
      continue
    }

    if (sidePos) {
      const sideBlock = bot.blockAt(sidePos)
      if (sideBlock && sideBlock.name !== 'air') {
        log('dig', `🌽 Side block at ${sidePos}`)
        await clearWithRetry(bot, sidePos)
      }
    }

    bot.lookAt(mainPos.offset(0.5 * direction, 1, 0.5), true)
    bot.setControlState('forward', true)
  }

  bot.setControlState('forward', false)
}

// =======================
// 🌱 LANE CONFIG
// =======================
function getGrassLanes() {
  return [7825, 7821, 7816, 7812, 7807, 7803, 7798, 7794, 7789, 7785, 7780, 7776]
}

async function processFarm(botData: BotWrapper, minX: number, maxX: number, y: number) {
  const bot = botData.bot
  bot.chat('/sell all')
  bot.chat('/is warp pumpkin')
  await bot.waitForTicks(20)

  if (!hasAxe(bot)) {
    log('move', 'Take axe from chest')
    await getAxeFromChest(bot)
  }

  if (!handIsAxe(bot)) {
    log('move', 'Move axe to hand')
    await ensureAxeInHotbar(bot)
  }

  const lanes = getGrassLanes()
  let direction = 1

  for (let i = 0; i < lanes.length; i++) {
    if (!botData.profile.isWorking) break

    const z = lanes[i] + 0.5
    log('move', `🛣️ Lane ${i + 1} Z=${z}`)

    const xStart = direction === 1 ? minX : maxX
    const xEnd = direction === 1 ? maxX : minX
    const offsetX = 0.5 * direction * -1

    for (let x = xStart; direction === 1 ? x < xEnd : x >= xEnd; x += direction) {
      if (!botData.profile.isWorking) break

      log('move', `📍 X=${x}`)

      const current = new Vec3(x + offsetX, y, z)
      const next = new Vec3(x + offsetX + direction, y, z)

      const sideZ = z - 1 // ubah ke z-1 kalau mau sisi lain

      await moveStep(bot, current, next, direction, sideZ)
    }

    // pindah lane
    if (i < lanes.length - 1) {
      const nextZ = lanes[i + 1] + 0.5
      const edgeX = direction === 1 ? maxX : minX
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
// 🚀 MAIN FARMING
// =======================
export async function startFarmingNew(botData: BotWrapper, loop: boolean = true) {
  const bot = botData.bot
  bot.loadPlugin(pathfinder)

  const minX = -7824
  const maxX = -7774
  const y = 85

  botData.profile.isWorking = true
  let chestEmpty = false

  if (!loop) {
    await processFarm(botData, minX, maxX, y)
    bot.chat('/sell all')
    return
  }

  while (botData.profile.isWorking) {
    await processFarm(botData, minX, maxX, y)
  }

  log('move', '🏁 Farming finished')
}

// =======================
// 🧰 UTIL
// =======================
async function moveMagnet(bot: mineflayer.Bot) {
  const magnet = bot.inventory
    .items()
    .find(i => getItemCustomName(i)?.toLowerCase().includes('magnet'))
  if (!magnet) return
  await bot.moveSlotItem(magnet.slot, 9)
}

function getItemCustomName(item) {
  const components = item.components.find(c => c.type === 'custom_name')
  return components?.data?.value?.extra?.value?.value[0]?.text?.value
}

async function ensureAxeInHotbar(bot: mineflayer.Bot) {
  const axe = getAxe(bot)
  if (!axe) return emptyHand(bot)

  await bot.moveSlotItem(axe.slot, 36)
  bot.setQuickBarSlot(0)
  return true
}

function hasAxe(bot: mineflayer.Bot) {
  return bot.inventory.items().some(i => i.name.includes('_axe'))
}

function getAxe(bot: mineflayer.Bot) {
  return bot.inventory.items().find(i => i.name.includes('_axe'))
}

function handIsAxe(bot: mineflayer.Bot) {
  return bot.heldItem && bot.heldItem.name.includes('_axe')
}

async function getAxeFromChest(bot: mineflayer.Bot) {
  const chestBlock = bot.findBlock({
    matching: block => block.name.includes('chest'),
    maxDistance: 6
  })

  if (!chestBlock) return false

  try {
    const chest = await bot.openChest(chestBlock)
    let found = false

    for (const item of chest.slots) {
      if (!item?.name.includes('_axe')) continue

      try {
        await chest.withdraw(item.type, null, 1)
        found = true
        break
      } catch {}
    }

    chest.close()
    return !found
  } catch {
    return false
  }
}
