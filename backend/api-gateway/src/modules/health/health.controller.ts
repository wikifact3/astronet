import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'powerlink-api-gateway',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
