/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { Injectable, OnModuleInit } from '@nestjs/common'
import * as mineflayer from 'mineflayer'

type FakePlayerProfile = {
  name: string
}

type BotWrapper = {
  bot: mineflayer.Bot
  profile: FakePlayerProfile
}

type TimelineEvent = {
  time: string // "HH:mm:ss"
  type: 'conversation' | 'logout' | 'login'
  data?: {
    messages?: string[]
    initiator?: string
    responder?: string
    actor?: string
  }
}

type Team = {
  name: string
  members: string[]
  timeline: TimelineEvent[]
}

@Injectable()
export class BotService implements OnModuleInit {
  private bots: Record<string, BotWrapper> = {}

  private readonly HOST = 'localhost'
  private readonly PORT = 25565

  private players: FakePlayerProfile[] = [{ name: 'Arka' }, { name: 'Zenix' }]

  private teams: Team[] = [
    {
      name: 'MinerTeam',
      members: ['Arka', 'Zenix'],
      timeline: [
        // ===== START SOON =====
        {
          time: '15:00:10',
          type: 'conversation',
          data: {
            initiator: 'Arka',
            responder: 'Zenix',
            messages: [
              'bro {target} lagi dimana?',
              'lagi di mine',
              'dapet apa?',
              'iron sama coal doang',
              'yah gas lanjut'
            ]
          }
        },

        // ===== FOLLOW UP =====
        {
          time: '15:00:40',
          type: 'conversation',
          data: {
            initiator: 'Zenix',
            responder: 'Arka',
            messages: ['lu di layer berapa?', 'sekitar 11', 'aman gak?', 'aman sih sejauh ini']
          }
        },

        // ===== SMALL GAP (biar natural) =====
        {
          time: '15:01:30',
          type: 'conversation',
          data: {
            initiator: 'Arka',
            responder: 'Zenix',
            messages: ['eh tadi nemu lava', 'serius?', 'iya dikit lagi kena', 'hati2 woi']
          }
        },

        // ===== PRE-OFF SIGNAL =====
        {
          time: '15:02:20',
          type: 'conversation',
          data: {
            initiator: 'Zenix',
            responder: 'Arka',
            messages: ['gw bentar lagi off deh', 'lah kenapa', 'capek', 'yaudah santai']
          }
        },

        // ===== LOGOUT =====
        {
          time: '15:02:50',
          type: 'logout',
          data: { actor: 'Zenix' }
        },

        // ===== SOLO MOMENT =====
        {
          time: '15:03:30',
          type: 'conversation',
          data: {
            initiator: 'Arka',
            responder: 'Arka',
            messages: ['sendiri lagi...', 'lanjut mining aja deh']
          }
        },

        // ===== RELOGIN =====
        {
          time: '15:04:30',
          type: 'login',
          data: { actor: 'Zenix' }
        },

        // ===== REJOIN CHAT =====
        {
          time: '15:04:50',
          type: 'conversation',
          data: {
            initiator: 'Zenix',
            responder: 'Arka',
            messages: ['balik lagi gw', 'cepet amat', 'gak jadi tidur wkwk']
          }
        }
      ]
    }
  ]

  onModuleInit() {
    this.start()
  }

  start() {
    this.players.forEach(p => this.createBot(p))

    this.runAllTeamsSequential()
  }

  // ===== BOT =====
  private createBot(profile: FakePlayerProfile) {
    const bot = mineflayer.createBot({
      host: this.HOST,
      port: this.PORT,
      username: profile.name
    })

    this.bots[profile.name] = { bot, profile }

    bot.on('login', () => {
      console.log(`[BOT] ${profile.name} joined`)
    })
  }

  private logoutBot(name: string) {
    const bot = this.bots[name]
    if (!bot) return

    console.log(`[BOT] ${name} logout`)
    bot.bot.quit()
    delete this.bots[name]
  }

  private loginBot(name: string) {
    if (this.bots[name]) return

    const profile = this.players.find(p => p.name === name)
    if (!profile) return

    console.log(`[BOT] ${name} login`)
    this.createBot(profile)
  }

  // ===== CORE: SEQUENTIAL TIMELINE =====
  private async runAllTeamsSequential() {
    this.teams.forEach(team => {
      this.runTeamTimeline(team)
    })
  }

  private async runTeamTimeline(team: Team) {
    // sort by time
    const timeline = [...team.timeline].sort(
      (a, b) => this.parseTime(a.time) - this.parseTime(b.time)
    )

    for (let i = 0; i < timeline.length; i++) {
      const event = timeline[i]

      const delay = this.getDelayFromNow(event.time)

      // ⏳ tunggu sampai waktunya
      await this.sleep(delay)

      // 🚫 pastikan tidak overlap (event selesai dulu)
      await this.executeEvent(event)
    }
  }

  // ===== EVENT EXECUTION =====
  private async executeEvent(event: TimelineEvent) {
    if (event.type === 'conversation') {
      await this.runConversation(event)
    }

    if (event.type === 'logout') {
      this.logoutBot(event.data?.actor!)
    }

    if (event.type === 'login') {
      this.loginBot(event.data?.actor!)
    }
  }

  // ===== MULTI TURN (WAIT UNTIL DONE) =====
  private async runConversation(event: TimelineEvent) {
    const { initiator, responder, messages } = event.data!

    const botA = this.bots[initiator!]
    const botB = this.bots[responder!]

    if (!botA || !botB) return

    for (let i = 0; i < messages!.length; i++) {
      const isEven = i % 2 === 0
      const sender = isEven ? botA : botB
      const target = isEven ? botB : botA

      const msg = this.format(messages![i], target.profile.name)

      await this.sleep(this.humanDelay())

      sender.bot.chat(msg)
    }
  }

  // ===== UTIL =====
  private parseTime(time: string) {
    const [h, m, s] = time.split(':').map(Number)
    return h * 3600 + m * 60 + s
  }

  private getDelayFromNow(time: string) {
    const [h, m, s] = time.split(':').map(Number)

    const now = new Date()
    const target = new Date()

    target.setHours(h, m, s, 0)

    if (target < now) {
      target.setDate(target.getDate() + 1)
    }

    return target.getTime() - now.getTime()
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private format(text: string, target: string) {
    return text.replace('{target}', target)
  }

  private humanDelay() {
    return Math.floor(Math.random() * 4000) + 2000
  }
}
