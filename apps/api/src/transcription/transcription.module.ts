import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TranscriptionController } from './transcription.controller';
import { TranscriptionService } from './transcription.service';

@Module({
  imports: [DatabaseModule],
  controllers: [TranscriptionController],
  providers: [TranscriptionService],
})
export class TranscriptionModule {}
