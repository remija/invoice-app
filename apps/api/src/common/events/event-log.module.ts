import { Global, Module } from '@nestjs/common';
import { EventLogService } from './event-log.handler';

@Global()
@Module({
  providers: [EventLogService],
  exports: [EventLogService],
})
export class EventLogModule {}
