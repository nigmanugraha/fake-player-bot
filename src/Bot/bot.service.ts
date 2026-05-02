/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { Injectable, OnModuleInit } from '@nestjs/common'
import * as mineflayer from 'mineflayer'
import { Vec3 } from 'vec3'
import minecraftData from 'minecraft-data'
import { startFarmingNew } from './farm-new'
import { Block } from 'prismarine-block'
import { getAdjustedDigTime } from './utils/mining-engine'
import { startChestProcessor } from './work/chest-mining-processor'
import { computeFace, emptyHand, placeBlockInFront, sleep } from './utils/common.util'
import { pathfinder } from 'mineflayer-pathfinder'
import * as mineflayerViewer from 'prismarine-viewer'
import { expandIslandNew } from './work/expand-island'
import { ConfigFarming, startFarming } from './work/farm'
import { ConfigMining, startMining } from './work/mining'
import { ConfigStoreChest, storeToChest } from './skills/store-to-chest'
import { ConfigService } from '@nestjs/config'

export enum CommandEnum {
  FARM = 'farm',
  SORTING_CHEST = 'sorting_chest',
  MINE = 'mine',
  EXPAND = 'expand',
  FARM_CHEST = 'farm_chest',
  STORE_TO_CHEST = 'store_to_chest'
}

export type BotWrapper = {
  bot: mineflayer.Bot
  profile: Profile
}

type ProfileOld = {
  name: string
  password: string
  isPremium: boolean
  isSpawned: boolean
  isLogingIn: boolean
  mining: boolean
  farming: boolean
  listenChat: boolean
  clickSequence: number
  chestMineWorker?: boolean
  dustWorker?: boolean
  tasKFlow?: boolean
}
type Profile = {
  name: string
  password: string
  isPremium: boolean
  listenChat?: boolean
  isWorking?: boolean
}

export type ChatRequest = {
  name: string
  chat: string
}

export type CommandRequest = {
  name: string
  config: ConfigFarming | ConfigMining | ConfigStoreChest
  command: CommandEnum
}

export type MiningRequest = {
  name: string
  cursor: boolean
  x: number
  y: number
  z: number
}

export type ChestRequest = {
  name: string
  all?: boolean
}

@Injectable()
export class BotService {
  private readonly HOST: string
  constructor(private readonly configService: ConfigService) {
    this.HOST = this.configService.get<string>('SERVER_URL') || 'localhost:25565'
  }
  private bots: Record<string, BotWrapper> = {}

  private players: Profile[] = [
    {
      name: 'Jeson',
      password: 'rZKZS666vhhU',
      isPremium: false,
      listenChat: false
    },
    {
      name: 'Jemessss',
      password: 'rZKZS666vhhS',
      isPremium: false,
      listenChat: false
    }
  ]

  async login(data: { name: string }) {
    const player = this.players.find(p => p.name === data.name)
    if (!player) return 'player not found'
    await this.createBot(player)
  }

  async sendChat(data: ChatRequest) {
    const bot = this.bots[data.name]?.bot
    if (!bot) return `Bot with name ${data.name} not found`

    bot.chat(data.chat)
    return 'Chat sent'
  }

  async command(data: CommandRequest) {
    const botData = this.bots[data.name]
    if (!botData) return `Bot with name ${data.name} not found`

    // if (data.command === 'stop') {
    //   botData.bot.clearControlStates()
    //   botData.profile.isWorking = false
    // }
    // if (data.command === 'listen') {
    //   botData.profile.listenChat = !botData.profile.listenChat
    //   return botData.profile.listenChat
    // }
    // if (data.command === 'inventory') {
    //   this.checkInventory({ name: data.name })
    // }
    if (data.command === CommandEnum.FARM) {
      const config = data.config as ConfigFarming
      await startFarming(botData, config)
    }
    if (data.command === CommandEnum.MINE) {
      const config = data.config as ConfigMining
      await startMining(botData, config)
    }
    if (data.command === CommandEnum.SORTING_CHEST) {
      await startChestProcessor(botData)
    }
    if (data.command === CommandEnum.EXPAND) {
      const center = new Vec3(-7799, 81, 7800)
      await expandIslandNew(botData, 'dirt')
    }
    if (data.command === CommandEnum.STORE_TO_CHEST) {
      const config = data.config as ConfigStoreChest
      await storeToChest(botData, config)
    }
    if (data.command === CommandEnum.FARM_CHEST) {
      botData.profile.isWorking = true
      while (botData.profile.isWorking) {
        botData.bot.chat('/sell all')
        await botData.bot.waitForTicks(2)
        await startChestProcessor(botData, false)
        await botData.bot.waitForTicks(20)
        await startFarmingNew(botData, false)
        await botData.bot.waitForTicks(20)
      }
    }
    // if (data.command === 'test') {
    //   botData.bot.loadPlugin(pathfinder)
    //   const packetName = [
    //     'entity_move_look',
    //     'map_chunk',
    //     'entity_head_rotation',
    //     'player_info',
    //     'window_items',
    //     'teams',
    //     'scoreboard_score',
    //     'held_item_slot',
    //     'window_click',
    //     'position',
    //     'block_break_animation',
    //     'animation',
    //     'sound_effect',
    //     'rel_entity_move',
    //     'bundle_delimiter',
    //     'spawn_entity',
    //     'entity_metadata',
    //     'world_event',
    //     'multi_block_change',
    //     'sync_entity_position',
    //     'entity_equipment',
    //     'entity_look',
    //     'keep_alive'
    //   ]
    //   mineflayerViewer.mineflayer(botData.bot, { firstPerson: true, port: 3005 })
    //   const callback = (data: any, meta: any) => {
    //     if (packetName.includes(meta.name)) return
    //     console.log(`[PACKET OUT] ${meta.name}:`, JSON.stringify(data, null, 2))
    //   }
    //   const orig = botData.bot._client.write.bind(botData.bot._client)
    //   botData.bot._client.write = (name: string, data: any) => {
    //     if (packetName.includes(name)) return orig(name, data)
    //     // if (name !== 'block_place') return orig(name, data)
    //     console.log(`[PACKET OUT] ${name}:`, JSON.stringify(data, null, 2))
    //     return orig(name, data)
    //   }
    //   botData.bot._client.on('packet', (data: any, meta: any) => {
    //     if (['block_change', 'acknowledge_player_digging', 'block_action'].includes(meta.name)) {
    //       console.log(`[PACKET IN] ${meta.name}:`, JSON.stringify(data, null, 2))
    //     }
    //   })
    //   console.log('Activated')
    // }
  }

  async checkInventory(data: { name: string }) {
    const botData = this.bots[data.name]
    if (!botData) return `Bot with name ${data.name} not found`

    const bot = botData.bot

    bot.inventory.slots.forEach((slot, idx) => {
      console.log(`Slot[${idx}]: ${slot?.name}:${slot?.count}`)
    })
  }

  async startFarm(data: { name: string }) {
    const botData = this.bots[data.name]
    if (!botData) return `Bot with name ${data.name} not found`

    // await startFarming(botData)
  }

  private async start() {
    // await this.createBot(this.players[0])
    // await this.sleep(60000)
    // await this.createBot(this.players[1])
  }

  // ===== BOT =====
  private async createBot(profile: Profile) {
    console.log(profile.name)
    const baseOpt: mineflayer.BotOptions = {
      host: this.HOST,
      username: profile.name,
      auth: 'offline',
      version: '1.21.6'
    }

    const bot = mineflayer.createBot(baseOpt)

    this.bots[profile.name] = { bot, profile }

    if (profile.listenChat) {
      bot.on('chat', (username, message) => {
        console.log(`[Chat ${profile.name}] - ${username}: ${message}`)
      })
    }

    bot.once('login', async () => {
      console.log(`[BOT] ${profile.name} joined`)
      // stop semua movement
      bot.clearControlStates()

      // tunggu physics settle
      await bot.waitForTicks(20) // ±1 detik

      console.log('✅ Physics stabilized')
    })

    bot.on('spawn', async () => {
      console.log(`[BOT] ${profile.name} spawned`)

      if (!profile.isWorking) {
        const password = this.bots[profile.name].profile.password
        console.log(`[BOT] ${profile.name} Typing register with password: ${password}`)
        bot.chat(`/register ${password}`)
        await sleep(3000)
        console.log(`[BOT] ${profile.name} Typing login with password: ${password}`)
        bot.chat(`/login ${password}`)
        console.log(`[BOT] ${profile.name} logged in`)

        await sleep(3000)
        console.log(`[BOT] ${profile.name} Typing /server oneblock`)
        bot.chat('/server oneblock')

        await sleep(2000)
        console.log(`[BOT] ${profile.name} Typing /is`)
        bot.chat('/is')
      }
    })

    bot.on('kicked', (reason: string, loggedIn: boolean) => {
      console.log(`[BOT] ${profile.name} kicked | ${loggedIn} | ${reason}`)
      console.log(JSON.stringify(reason))
      if (this.bots[profile.name]) {
        delete this.bots[profile.name]
      }
    })
  }

  private miningChest() {
    return [
      {
        x: -7797.5,
        y: 89.5,
        z: 7799.5
      },
      {
        x: -7797.5,
        y: 89.5,
        z: 7798.5
      },
      {
        x: -7797.5,
        y: 89.5,
        z: 7797.5
      },
      {
        x: -7797.5,
        y: 89.5,
        z: 7796.5
      },
      {
        x: -7797.5,
        y: 89.5,
        z: 7795.5
      }
    ]
  }

  private storageUnitLocation() {
    return [
      {
        type: 'raw_iron',
        pos: {
          x: -7794.5,
          y: 89.5,
          z: 7799.5
        }
      },
      {
        type: 'raw_copper',
        pos: {
          x: -7794.5,
          y: 89.5,
          z: 7798.5
        }
      },
      {
        type: 'coal',
        pos: {
          x: -7794.5,
          y: 89.5,
          z: 7797.5
        }
      },
      {
        type: 'cobblestone',
        pos: {
          x: -7794.5,
          y: 90.5,
          z: 7799.5
        }
      },
      {
        type: 'diamond',
        pos: {
          x: -7794.5,
          y: 90.5,
          z: 7798.5
        }
      }
    ]
  }
}
