import { Bot } from 'mineflayer'
import { Vec3 } from 'vec3'
import { emptyHand, gotoBlock, waitWindow } from '../utils/common.util'
// =======================
// ⚙️ CONFIG
// =======================
const CLICK_DELAY_TICK = 6
const STORAGE_CLICK_REPEAT = 6
const STORAGE_SLOT = 22

export async function depositToStorageUnit(bot: Bot, pos: Vec3) {
  await emptyHand(bot)
  await gotoBlock(bot, pos)

  const block = bot.blockAt(pos)
  if (!block) return

  try {
    await bot.activateBlock(block)

    const window = await waitWindow(bot)
    await bot.waitForTicks(2)

    for (let i = 0; i < STORAGE_CLICK_REPEAT; i++) {
      try {
        await bot.clickWindow(STORAGE_SLOT, 0, 1)
      } catch {}

      await bot.waitForTicks(CLICK_DELAY_TICK)
    }

    bot.closeWindow(window)
    await bot.waitForTicks(CLICK_DELAY_TICK)
  } catch {}
}
