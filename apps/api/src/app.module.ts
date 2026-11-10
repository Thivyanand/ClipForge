import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { VideosModule } from './videos/videos.module';
import { TranscriptionModule } from './transcription/transcription.module';

@Module({
  imports: [DatabaseModule, VideosModule, TranscriptionModule],
  controllers: [AppController],
})
export class AppModule {}
