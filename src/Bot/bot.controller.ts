import { Body, Controller, Post } from '@nestjs/common'
import * as botService from './bot.service'

@Controller('bot')
export class BotController {
  constructor(private readonly botService: botService.BotService) {}

  @Post('login')
  async login(@Body() body: { name: string }) {
    this.botService.login(body)
  }

  @Post('chat')
  async chat(@Body() body: botService.ChatRequest) {
    this.botService.sendChat(body)
  }

  @Post('command')
  async move(@Body() body: botService.CommandRequest) {
    this.botService.command(body)
  }

  // @Post('mining')
  // async mining(@Body() body: botService.MiningRequest) {
  //   this.botService.startAFKMining(body)
  // }

  @Post('farm')
  async farm(@Body() body: { name: string }) {
    this.botService.startFarm(body)
  }

  // @Post('chest')
  // async chest(@Body() body: botService.ChestRequest) {
  //   this.botService.storeToChest(body)
  // }
}
