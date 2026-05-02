function getEfficiencyLevel(item) {
  const ench = item?.components?.find(c => c.type === 'enchantments')?.data?.enchantments || []

  const eff = ench.find(e => e.id === 8) // 8 = efficiency
  return eff ? eff.level : 0
}

export function getAdjustedDigTime(bot, block) {
  const base = bot.digTime(block) // tanpa enchant
  const item = bot.heldItem

  const eff = getEfficiencyLevel(item)

  if (eff === 0) return base

  const multiplier = 1 + eff * eff
  return base / multiplier
}
