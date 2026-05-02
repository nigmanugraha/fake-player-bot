import { goals } from 'mineflayer-pathfinder'
import { Block } from 'prismarine-block'
import { Vec3 } from 'vec3'
import { Item } from 'prismarine-item'
import { Bot } from 'mineflayer'
import { PosXYZ } from './dto'

const DEBUG = {
  enabled: true,
  move: true,
  dig: true,
  scan: true,
  stuck: true
}

export function log(type: keyof typeof DEBUG, msg: string) {
  if (!DEBUG.enabled) return
  if (!DEBUG[type]) return

  const time = new Date().toISOString()
  console.log(`[${type.toUpperCase()}][${time}] ${msg}`)
}

/**
 * Switch quickbar ke slot kosong.
 * Jika hotbar penuh, cari item di inventory dan swap ke hotbar slot yang paling tidak penting.
 * Returns true jika berhasil, false jika benar-benar tidak ada slot kosong sama sekali.
 */
export async function emptyHand(bot: Bot): Promise<void> {
  if (!bot.heldItem) return
  const HOTBAR_SIZE = 9
  const HOTBAR_START = 36 // offset slot hotbar di inventory window

  // 1. Cari slot hotbar yang kosong dulu
  for (let hotbarIndex = 0; hotbarIndex < HOTBAR_SIZE; hotbarIndex++) {
    const slot = bot.inventory.slots[HOTBAR_START + hotbarIndex]
    if (slot !== null && slot !== undefined) continue

    bot.setQuickBarSlot(hotbarIndex)
    console.log(`[emptyHand] Switched to empty hotbar slot: ${hotbarIndex}`)
    return
  }

  // 2. Hotbar penuh — cari item di inventory utama (slot 9–35) yang bisa dipindah ke hotbar
  // Strategi: ambil hotbar slot terakhir yang dipakai, swap dengan item dari inventory
  const INVENTORY_START = 9
  const INVENTORY_END = 35

  let inventoryItemSlot: number | null = null

  for (let i = INVENTORY_START; i <= INVENTORY_END; i++) {
    const slot = bot.inventory.slots[i]
    if (slot === null || slot === undefined) {
      inventoryItemSlot = i
      break
    }
  }

  if (inventoryItemSlot === null) {
    console.warn('[emptyHand] Inventory juga penuh, tidak ada slot kosong.')
    return
  }

  // Pilih hotbar slot target untuk di-swap (pakai slot terakhir hotbar supaya tidak ganggu slot aktif)
  const targetHotbarIndex = HOTBAR_SIZE - 1
  const targetHotbarSlot = HOTBAR_START + targetHotbarIndex

  console.log(
    `[emptyHand] Memindahkan item dari inventory slot ${inventoryItemSlot} ke hotbar slot ${targetHotbarIndex}`
  )

  // Swap: pindahkan item dari inventory ke hotbar slot target
  await bot.moveSlotItem(inventoryItemSlot, targetHotbarSlot)

  bot.setQuickBarSlot(targetHotbarIndex)
  console.log(`[emptyHand] Switched to now-empty hotbar slot: ${targetHotbarIndex}`)
  return
}

export async function gotoNear(bot: Bot, pos: Vec3, range: number) {
  await bot.pathfinder.goto(new goals.GoalNear(pos.x, pos.y, pos.z, range))
}
export async function gotoBlock(bot: Bot, pos: Vec3) {
  await bot.pathfinder.goto(new goals.GoalBlock(pos.x, pos.y, pos.z))
}

export function computeFace(bot: Bot, blockPos: Vec3): Vec3 {
  const eye = bot.entity.position.offset(0, bot.entity.height, 0)

  const dx = eye.x - (blockPos.x + 0.5)
  const dy = eye.y - (blockPos.y + 0.5)
  const dz = eye.z - (blockPos.z + 0.5)

  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  const az = Math.abs(dz)

  if (ay >= ax && ay >= az) return dy > 0 ? new Vec3(0, 1, 0) : new Vec3(0, -1, 0)
  if (az >= ax) return dz > 0 ? new Vec3(0, 0, 1) : new Vec3(0, 0, -1)
  return dx > 0 ? new Vec3(1, 0, 0) : new Vec3(-1, 0, 0)
}

export async function placeBlockInFront(bot: Bot): Promise<void> {
  // Ambil posisi depan-bawah bot berdasarkan arah look
  const yaw = bot.entity.yaw
  const frontX = Math.round(bot.entity.position.x - Math.sin(yaw))
  const frontY = Math.floor(bot.entity.position.y)
  const frontZ = Math.round(bot.entity.position.z - Math.cos(yaw))

  const targetPos = new Vec3(frontX, frontY - 1, frontZ)

  // Reference block = block yang ada di sebelahnya (lantai bawah bot)
  const referenceBlock = bot.blockAt(targetPos.offset(0, -1, 0))
  if (!referenceBlock) throw new Error('Tidak ada block referensi di bawah target')

  const heldItem = bot.heldItem
  if (!heldItem) throw new Error('Bot tidak memegang item')

  await bot.lookAt(targetPos, true)
  await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0))
}

export function hasItem(bot: Bot, itemName: string, exact: boolean = false) {
  if (exact) return bot.inventory.items().some(i => i.name === itemName)
  return bot.inventory.items().some(i => i.name.includes(itemName))
}

export function isBlock(block: Block, blockName: string) {
  return block && block.name === blockName
}

export function getBlock(bot: Bot, blockName?: string, pos?: PosXYZ) {
  if (!pos) return null
  const posVector = new Vec3(pos.x, pos.y, pos.z)
  const block = bot.blockAt(posVector)
  if (!blockName) return block
  return block?.name.toLowerCase() === blockName.toLowerCase() ? block : null
}

export function getItem(bot: Bot, itemName: string, exact: boolean = false) {
  if (exact) return bot.inventory.items().find(i => i.name === itemName)
  return bot.inventory.items().find(i => i.name.includes(itemName))
}

export function isItem(itemName: string, item: Item | null, exact: boolean = false) {
  if (exact) item?.name === itemName ? item : null
  return item?.name.includes(itemName) ? item : null
}

async function ensureItemInHand(bot: Bot, itemName?: string) {
  if (!itemName) return emptyHand(bot)

  const axe = getItem(bot, itemName)
  if (!axe) return emptyHand(bot)

  await bot.equip(axe, 'hand')
}

export async function breakWithRetry(
  bot: Bot,
  pos: Vec3,
  toolName?: string,
  blockName?: string,
  withSneak: boolean = false
) {
  let attempt = 0
  while (true) {
    await ensureItemInHand(bot, toolName)
    const block = bot.blockAt(pos)

    if (!block || block.name === 'air') {
      log('scan', `✅ Clear at ${pos}`)
      break
    }

    if (!block.diggable) {
      log('scan', `❌ Not diggable ${block.name} at ${pos}`)
      break
    }

    if (blockName && !isBlock(block, blockName)) {
      log('scan', `⏭ Skip ${block.name}`)
      break
    }

    attempt++
    log('dig', `🎃 Dig attempt ${attempt} at ${pos}`)

    try {
      await bot.dig(block)
      if (withSneak) {
        bot.setControlState('sneak', true)
        await bot.waitForTicks(2)
        bot.setControlState('sneak', false)
      }
    } catch (err: any) {
      log('dig', `💥 Dig failed: ${err.message}`)
    }

    await bot.waitForTicks(2)

    if (attempt > 5) {
      log('dig', `⚠️ Too many retries at ${pos}`)
      break
    }
  }
}
export async function getItemFromChest(
  bot: Bot,
  itemName: string,
  amount: number = 1,
  exact: boolean = false
) {
  const chestBlock = bot.findBlock({
    matching: block => block.name.includes('chest'),
    maxDistance: 6
  })

  if (!chestBlock) return false

  try {
    const chest = await bot.openChest(chestBlock)
    let found = false

    for (const item of chest.slots) {
      const checkedItem = isItem(itemName, item, exact)
      if (!checkedItem) continue

      try {
        await chest.withdraw(checkedItem.type, null, amount)
        found = true
        break
      } catch (err: any) {
        throw new Error(`[Get Item] Failed get item from chest: ${err.message}`)
      }
    }

    chest.close()
    return !found
  } catch (err) {
    console.log(err)
    return false
  }
}
export async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function getNearbyBlock(bot: Bot, blockName: string, radius: number) {
  return bot.findBlock({
    matching: block => block.name.toLowerCase() === blockName,
    maxDistance: radius
  })
}

export async function waitWindow(bot: Bot) {
  return new Promise<any>(resolve => {
    bot.once('windowOpen', resolve)
  })
}
