import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { VideosModule } from './videos/videos.module';

@Module({
  imports: [VideosModule],
  controllers: [AppController],
})
export class AppModule {}
