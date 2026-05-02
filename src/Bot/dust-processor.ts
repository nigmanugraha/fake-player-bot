// import { Vec3 } from 'vec3'
// import { pathfinder, Movements, goals } from 'mineflayer-pathfinder'
// import { BotWrapper } from './bot.service'
// import * as mineflayer from 'mineflayer'

// export async function runDustProcessor(botWrapper: BotWrapper) {
//   botWrapper.bot.loadPlugin(pathfinder)

//   const movement = new Movements(botWrapper.bot)
//   movement.canDig = false
//   botWrapper.bot.pathfinder.setMovements(movement)
//   botWrapper.profile.isWorking = true

//   while (botWrapper.profile.isWorking) {
//     try {
//       console.log('Start Grindstone')
//       await grindStone(botWrapper)
//       console.log('start Panning')
//       await panningMachine(botWrapper)
//       console.log('start wash')
//       await oreWasher(botWrapper)
//     } catch (e) {
//       console.error('[DUST ERROR]', e)
//       await sleep(2000)
//     }
//   }
// }

// /* ================= POSITIONS ================= */

// const POS = {
//   grind: {
//     container: new Vec3(-7803.5, 89.5, 7807.5),
//     trigger: new Vec3(-7803.5, 90.5, 7807.5),
//     output: new Vec3(-7803.5, 89.5, 7806.5)
//   },
//   panning: {
//     trigger: new Vec3(-7803.5, 90.5, 7807.5),
//     output: new Vec3(-7803.5, 89.5, 7806.5)
//   },
//   washer: {
//     container: new Vec3(-7803.5, 91.5, 7811.5),
//     trigger: new Vec3(-7803.5, 90.5, 7811.5),
//     output: new Vec3(-7804.5, 91.5, 7811.5)
//   },
//   storage: new Vec3(-7794.5, 90.5, 7799.5)
// }

// /* ================= CORE ================= */

// async function grindStone(botData: BotWrapper) {
//   const bot = botData.bot
//   await takeCobble(bot)
//   console.log('After take cobble')
//   await goto(bot, POS.grind.container, 2)
//   const dispenser = await openContainer(bot, POS.grind.container)
//   if (!dispenser) {
//     console.log('dispenser null')
//     return
//   }

//   const total = bot.inventory.count(bot.registry.itemsByName['cobblestone'].id, null)
//   if (total === 0) {
//     console.log('total 0')
//     return
//   }

//   for (const item of bot.inventory.items()) {
//     if (item.name === 'cobblestone') {
//       await trySilent(() => dispenser.deposit(item.type, null, item.count))
//     }
//   }
//   dispenser.close()

//   await goto(bot, POS.grind.trigger, 2)
//   await spamRightClick(botData, POS.grind.trigger, total)
// }

// async function panningMachine(botData: BotWrapper) {
//   const bot = botData.bot
//   await goto(bot, POS.grind.output, 2)
//   const chest = await openContainer(bot, POS.grind.output)
//   if (!chest) return

//   for (const item of chest.containerItems()) {
//     if (getName(item) === 'gravel') {
//       await trySilent(() => chest.withdraw(item.type, null, item.count))
//     }
//   }
//   chest.close()

//   const gravel = bot.inventory.items().find(i => getName(i) === 'gravel')
//   if (!gravel) return

//   await bot.equip(gravel, 'hand')

//   await goto(bot, POS.panning.trigger, 2)
//   await spamRightClick(botData, POS.panning.trigger, gravel.count)

//   await trashItems(bot, ['flint', 'clay ball'])
// }

// async function oreWasher(botData: BotWrapper) {
//   const bot = botData.bot
//   await goto(bot, POS.panning.output, 2)
//   const chest = await openContainer(bot, POS.panning.output)
//   if (!chest) return

//   for (const item of chest.containerItems()) {
//     if (getName(item) === 'sifted ore') {
//       await trySilent(() => chest.withdraw(item.type, null, item.count))
//     }
//   }
//   chest.close()

//   await goto(bot, POS.washer.container, 3)
//   const dispenser = await openContainer(bot, POS.washer.container)
//   if (!dispenser) return

//   for (const item of bot.inventory.items()) {
//     if (getName(item) === 'sifted ore') {
//       await trySilent(() => dispenser.deposit(item.type, null, item.count))
//     }
//   }
//   dispenser.close()

//   const total = bot.inventory.items().reduce((a, b) => a + b.count, 0)
//   if (total === 0) return

//   await goto(bot, POS.washer.trigger, 2)
//   await spamRightClick(botData, POS.washer.trigger, total)

//   await trashItems(bot, ['stone chunk'])
// }

// /* ================= PACKET CORE ================= */

// /**
//  * Sequence counter untuk 1.19+ (server butuh ini untuk ACK mekanik)
//  */

// /**
//  * Kirim packet block_place (use_item_on) ke posisi block — ini yang trigger
//  * PlayerInteractEvent RIGHT_CLICK_BLOCK di plugin server, BUKAN placeBlock.
//  *
//  * Perbedaan dengan bot.placeBlock():
//  *  - placeBlock → server anggap bot mau naruh block → consume item di tangan
//  *  - block_place packet langsung → server trigger interact event saja
//  *
//  * @param bot     mineflayer Bot instance
//  * @param pos     posisi block yang di-klik (center .5 sudah di-handle di bawah)
//  * @param hand    0 = MainHand, 1 = OffHand
//  */
// function sendUseItemOn(bot: mineflayer.Bot, block): void {
//   bot.activateBlock(block)
// }

// /**
//  * Spam RMB ke block di posisi `pos` sebanyak `count` kali.
//  * Bot akan lookAt dulu tiap iterasi supaya server valid.
//  */
// async function spamRightClick(
//   botData: BotWrapper,
//   pos: Vec3,
//   count: number,
//   delayMs: number = 120
// ): Promise<void> {
//   const bot = botData.bot
//   const block = bot.blockAt(pos)
//   if (!block) throw new Error(`[spamRightClick] Block not found at ${pos}`)

//   // Hentikan pathfinder dulu supaya bot tidak gerak saat klik
//   bot.pathfinder.setGoal(null)
//   bot.clearControlStates()

//   // Look ke block sekali dulu (tidak perlu tiap tick kalau posisi sama)
//   await bot.lookAt(pos.offset(0, -0.2, 0), true)
//   const face = computeFace(bot, pos)

//   for (let i = 0; i < count; i++) {
//     // sendUseItemOn(bot, block)
//     bot._client.write('block_place', {
//       location: pos.floored(),
//       direction: face,
//       hand: 0,
//       cursorX: 0.5,
//       cursorY: 0.3,
//       cursorZ: 0.5,
//       insideBlock: false,
//       sequence: nextSeq(botData), // ← increment tiap klik
//       worldBorderHit: false
//     })
//     console.log(`[RightClick] ${i + 1}/${count} → ${pos} | ${block.name}`)
//     await sleep(delayMs)
//   }
// }

// /* ================= HELPERS ================= */

// /**
//  * Hitung face index berdasarkan posisi bot relative ke block.
//  *
//  * Face index (vanilla protocol):
//  *   0 = -Y (bottom)  1 = +Y (top)
//  *   2 = -Z (north)   3 = +Z (south)
//  *   4 = -X (west)    5 = +X (east)
//  *
//  * Kita cari sisi mana yang menghadap bot (sisi yang "kena" raycast).
//  */

// function nextSeq(botData: BotWrapper): number {
//   return botData.profile.clickSequence++
// }
// function computeFace(bot: mineflayer.Bot, blockPos: Vec3): number {
//   const eye = bot.entity.position.offset(0, bot.entity.height, 0)

//   // Vektor dari center block ke posisi mata bot
//   const dx = eye.x - (blockPos.x + 0.5)
//   const dy = eye.y - (blockPos.y + 0.5)
//   const dz = eye.z - (blockPos.z + 0.5)

//   const ax = Math.abs(dx)
//   const ay = Math.abs(dy)
//   const az = Math.abs(dz)

//   if (ay >= ax && ay >= az) return dy > 0 ? 1 : 0 // top / bottom
//   if (az >= ax) return dz > 0 ? 3 : 2 // south / north
//   return dx > 0 ? 5 : 4 // east / west
// }

// async function takeCobble(bot: mineflayer.Bot) {
//   try {
//     await goto(bot, POS.storage, 2)

//     const block = bot.blockAt(POS.storage)
//     if (!block) return

//     await bot.activateBlock(block)

//     const window = await waitWindowTimeout(bot, 3000)
//     if (!window) {
//       console.warn('[takeCobble] Window tidak terbuka, skip')
//       return
//     }

//     await bot.waitForTicks(2)

//     // RMB click slot 22 sebanyak 9x (ambil 9 stack)
//     for (let i = 0; i < 9; i++) {
//       await bot.clickWindow(22, 1, 0)
//       await sleep(80)
//     }

//     await sleep(300)
//     bot.closeWindow(window)
//   } catch (error) {
//     console.log('[Take cobble] Error: ', error)
//   }
// }

// async function trashItems(bot: mineflayer.Bot, names: string[]) {
//   const dustbin = bot.inventory.items().find(i => getCustomName(i) === 'Portable Dustbin')
//   if (!dustbin) return

//   // Simpan item yang dipegang sebelumnya
//   const prevItem = bot.heldItem

//   await bot.equip(dustbin, 'hand')
//   await bot.activateItem()
//   await sleep(400)

//   // Pindahkan item yang mau di-trash ke slot 0 (drag ke dustbin GUI)
//   for (const item of bot.inventory.items()) {
//     if (names.includes(getName(item))) {
//       await trySilent(() => bot.moveSlotItem(item.slot, 0))
//     }
//   }

//   if (bot.currentWindow) {
//     bot.closeWindow(bot.currentWindow)
//   }
//   await sleep(200)

//   // Kembalikan item sebelumnya kalau masih ada
//   if (prevItem && prevItem !== dustbin) {
//     await trySilent(() => bot.equip(prevItem, 'hand'))
//   } else {
//     // Equip item lain yang bukan dustbin
//     const fallback = bot.inventory
//       .items()
//       .find(i => i.slot >= 9 && i.slot <= 35 && getCustomName(i) !== 'Portable Dustbin')

//     if (fallback) await trySilent(() => bot.equip(fallback, 'hand'))
//   }
// }

// /* ================= UTILS ================= */

// function getName(item: any): string {
//   return getCustomName(item) || item.name || ''
// }

// /**
//  * Parse custom name dari item component (kompatibel 1.20.5+)
//  * Struktur bisa berbeda tergantung server/versi, jadi kita coba beberapa path.
//  */
// function getCustomName(item: any): string | undefined {
//   if (!item?.components) return undefined

//   // Format array of components
//   if (Array.isArray(item.components)) {
//     const comp = item.components.find((c: any) => c.type === 'custom_name')
//     const raw = comp?.data?.value?.extra?.value?.value?.[0]?.text?.value ?? comp?.data?.text
//     return typeof raw === 'string' ? raw : undefined
//   }

//   // Format object map (beberapa versi protokol)
//   const raw = item.components['custom_name']
//   if (!raw) return undefined
//   if (typeof raw === 'string') return raw
//   return raw?.extra?.[0]?.text ?? raw?.text ?? undefined
// }

// async function goto(bot: mineflayer.Bot, pos: Vec3, range: number) {
//   try {
//     console.log('goto')
//     await bot.pathfinder.goto(new goals.GoalNear(pos.x, pos.y, pos.z, range))
//     console.log('arrived')
//   } catch (error) {
//     console.log('[GOTO] Error: ', error)
//   }
// }

// async function openContainer(bot: mineflayer.Bot, pos: Vec3) {
//   const block = bot.blockAt(pos)
//   if (!block) return null
//   console.log(`[openContainer] ${block.name} @ ${pos}`)
//   return bot.openContainer(block)
// }

// /**
//  * waitWindow dengan timeout supaya tidak hang selamanya
//  */
// function waitWindowTimeout(bot: mineflayer.Bot, timeoutMs: number): Promise<any | null> {
//   return new Promise(resolve => {
//     const timer = setTimeout(() => {
//       bot.removeListener('windowOpen', onOpen)
//       resolve(null)
//     }, timeoutMs)

//     function onOpen(window: any) {
//       clearTimeout(timer)
//       resolve(window)
//     }

//     bot.once('windowOpen', onOpen)
//   })
// }

// async function trySilent(fn: () => Promise<any>) {
//   try {
//     await fn()
//   } catch {
//     /* silent */
//   }
// }

// function sleep(ms: number): Promise<void> {
//   return new Promise(res => setTimeout(res, ms))
// }
