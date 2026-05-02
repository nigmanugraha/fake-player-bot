import { Bot } from 'mineflayer'
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder'
import { Vec3 } from 'vec3'
import { BotWrapper } from '../bot.service'
import { emptyHand } from '../utils/common.util'
import { depositToStorageUnit } from '../skills/storage-unit'

const { GoalBlock } = goals

// =======================
// ⚙️ CONFIG
// =======================
const LOOP_DELAY_MS = 5000
const CLICK_DELAY_TICK = 6

// =======================
// 📦 POSITIONS
// =======================
function miningChest() {
  return [
    new Vec3(-7797.5, 89.5, 7800.5),
    new Vec3(-7797.5, 89.5, 7799.5),
    new Vec3(-7797.5, 89.5, 7798.5),
    new Vec3(-7797.5, 89.5, 7797.5),
    new Vec3(-7797.5, 89.5, 7796.5),
    new Vec3(-7797.5, 89.5, 7795.5)
  ]
}

function storageUnitLocation() {
  return [
    new Vec3(-7794.5, 89.5, 7799.5),
    new Vec3(-7794.5, 89.5, 7798.5),
    new Vec3(-7794.5, 89.5, 7797.5),
    new Vec3(-7794.5, 89.5, 7796.5),
    new Vec3(-7794.5, 89.5, 7795.5),
    new Vec3(-7794.5, 90.5, 7799.5),
    new Vec3(-7794.5, 90.5, 7798.5),
    new Vec3(-7794.5, 90.5, 7797.5),
    new Vec3(-7794.5, 90.5, 7796.5),
    new Vec3(-7794.5, 90.5, 7795.5)
  ]
}

// =======================
// 🧰 UTILS
// =======================
function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms))
}

function emptySlotCount(bot: Bot) {
  // return bot.inventory.firstEmptyInventorySlot()
  return bot.inventory.emptySlotCount()
  // return bot.inventory.emptySlotCount() <= 2
}

async function gotoBlock(bot: Bot, pos: Vec3) {
  try {
    await bot.pathfinder.goto(new goals.GoalNear(pos.x, pos.y, pos.z, 2))
  } catch {}
}

async function waitWindow(bot: Bot) {
  return new Promise<any>(resolve => {
    bot.once('windowOpen', resolve)
  })
}

// =======================
// 📦 CHEST
// =======================
async function takeAllFromChest(bot: Bot, block, storages: Vec3[]) {
  let chest = await bot.openChest(block)
  let hasItem = false
  let emptySlotCount = bot.inventory.emptySlotCount()

  for (const item of chest.containerItems()) {
    if (!item) continue

    hasItem = true
    await bot.waitForTicks(2)
    // 🔥 CEK FULL SEBELUM AMBIL
    console.log(`[Check Inventory] ${emptySlotCount}`)
    if (emptySlotCount === 0) {
      console.log('[BOT] Inventory full → deposit')

      chest.close()
      await bot.waitForTicks(2)

      for (const pos of storages) {
        await depositToStorageUnit(bot, pos)
      }

      bot.chat('/sell all')

      // buka ulang chest
      chest = await bot.openChest(block)
      await bot.waitForTicks(2)
      emptySlotCount = bot.inventory.emptySlotCount()
    }

    try {
      await chest.withdraw(item.type, null, item.count)
      await bot.waitForTicks(CLICK_DELAY_TICK)
      emptySlotCount--
    } catch (err) {
      console.log(`[Take From Chest] Error: `, err)
      break
    }
  }
  chest.close()
  return hasItem
}

async function processChest(bot: Bot, pos: Vec3, storages: Vec3[]) {
  await emptyHand(bot)
  await gotoBlock(bot, pos)

  const block = bot.blockAt(pos)
  if (!block) return false

  try {
    await bot.waitForTicks(2)
    const hasItem = await takeAllFromChest(bot, block, storages)

    await bot.waitForTicks(CLICK_DELAY_TICK)

    return hasItem
  } catch {
    return false
  }
}

async function processOnce(botData: BotWrapper, chests: Vec3[], storages: Vec3[]) {
  const bot = botData.bot
  let foundAnyItem = false

  // === LOOT CHESTS ===
  for (const pos of chests) {
    const hasItem = await processChest(bot, pos, storages)
    if (hasItem) foundAnyItem = true
  }

  // === DEPOSIT SISA ITEM ===
  if (emptySlotCount(bot) < 2) {
    // optional: kalau masih ada item di inventory
    for (const pos of storages) {
      await depositToStorageUnit(bot, pos)
    }
  }

  bot.chat('/sell all')

  // === DELAY JIKA KOSONG ===
  if (!foundAnyItem) {
    console.log('[BOT] All chest empty → waiting...')
    await sleep(LOOP_DELAY_MS)
  }
}

// =======================
// 🔁 MAIN LOOP
// =======================
export async function startChestProcessor(botData: BotWrapper, loop: boolean = true) {
  const bot = botData.bot
  bot.chat('/is')
  bot.loadPlugin(pathfinder)

  const movements = new Movements(bot)
  movements.canDig = false
  movements.allow1by1towers = false
  movements.allowParkour = false
  bot.pathfinder.setMovements(movements)

  const chests = miningChest()
  const storages = storageUnitLocation()

  botData.profile.isWorking = true

  if (!loop) {
    await processOnce(botData, chests, storages)
    return
  }

  while (botData.profile.isWorking) {
    await processOnce(botData, chests, storages)
  }
}

function waitForInventoryUpdate(bot: Bot, timeout = 1000): Promise<boolean> {
  return new Promise(resolve => {
    let resolved = false

    const handler = () => {
      if (resolved) return
      resolved = true
      clearTimeout(timer)
      bot.inventory.off('updateSlot', handler)
      resolve(true)
    }

    const timer = setTimeout(() => {
      if (resolved) return
      resolved = true
      bot.inventory.off('updateSlot', handler)
      resolve(false) // timeout
    }, timeout)

    bot.inventory.on('updateSlot', handler)
  })
}
