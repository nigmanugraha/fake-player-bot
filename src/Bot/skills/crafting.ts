// import MinecraftData from 'minecraft-data'
// import { Bot } from 'mineflayer'
// import { PosXYZ } from '../utils/dto'

// export interface ConfigCrafting {
//   storage_post: PosXYZ
//   chest_material_pos: PosXYZ
//   craftin_table_pos?: PosXYZ
// }

// export async function craftPickaxe(bot: Bot) {
//   const mcData = MinecraftData(bot.version)

//   const pickaxe = mcData.itemsByName.stone_pickaxe
//   const craftingTable = bot.findBlock({
//     matching: block => block.name.toLowerCase() === 'crafting_table',
//     maxDistance: 6
//   })
//   if (!craftingTable) {
//     console.log('No crafting table!')
//     return
//   }

//   if (!hasPickaxeMaterials(bot)) {
//     console.log('Kurang bahan, ambil dari chest...')
//     await takeMissingFromChest(bot)
//   }

//   const recipe = bot.recipesFor(pickaxe.id, null, 1, craftingTable)[0]
//   if (!recipe) {
//     console.log('No recipe for pickaxe')
//     return
//   }

//   try {
//     await bot.craft(recipe, 1, craftingTable)
//     console.log('Pickaxe crafted')
//   } catch (err: any) {
//     console.log('Craft failed:', err.message)
//     throw err
//   }
// }

// function hasPickaxeMaterials(bot: Bot) {
//   const cobble = bot.inventory.count(bot.registry.itemsByName.cobblestone.id, null)
//   const stick = bot.inventory.count(bot.registry.itemsByName.stick.id, null)

//   return cobble >= 3 && stick >= 2
// }

// async function takeMissingFromChest(bot: Bot) {
//   const mcData = bot.registry

//   const cobbleId = mcData.itemsByName.cobblestone.id
//   const stickId = mcData.itemsByName.stick.id

//   const chestBlock = bot.findBlock({
//     matching: block => block.name.includes('chest'),
//     maxDistance: 6
//   })

//   if (!chestBlock) return false

//   const chest = await this.openChest(bot, chestBlock)

//   try {
//     // ==== COBBLESTONE ====
//     const cobbleCurrent = bot.inventory.count(cobbleId, null)
//     const cobbleNeed = Math.max(0, 3 - cobbleCurrent)
//     console.log(`[RECIPE] Cobblestone: ${cobbleNeed}`)
//     if (cobbleNeed > 0) {
//       for (let i = 0; i < cobbleNeed; i++) {
//         try {
//           await chest.withdraw(cobbleId, null, 1)
//           await bot.waitForTicks(2)
//         } catch (e) {
//           console.log('Fail withdraw:', cobbleId)
//           throw e
//         }
//       }
//     }

//     // ==== STICK ====
//     const stickCurrent = bot.inventory.count(stickId, null)
//     const stickNeed = Math.max(0, 2 - stickCurrent)
//     console.log(`[RECIPE] Stick: ${stickNeed}`)
//     if (stickNeed > 0) {
//       for (let i = 0; i < stickNeed; i++) {
//         try {
//           await chest.withdraw(stickId, null, 1)
//           await bot.waitForTicks(2)
//         } catch (e) {
//           console.log('Fail withdraw:', stickId)
//           throw e
//         }
//       }
//     }

//     return true
//   } catch (e) {
//     console.log('Gagal ambil dari chest')
//     return false
//   } finally {
//     chest.close()
//   }
// }
