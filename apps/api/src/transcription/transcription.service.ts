import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { PrismaService } from '../database/prisma.service';

const QUEUE_KEY = 'clipforge:transcription:jobs';

@Injectable()
export class TranscriptionService implements OnModuleInit, OnModuleDestroy {
  private redis: RedisClientType;

  constructor(private readonly prisma: PrismaService) {
    this.redis = createClient({
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    });
    this.redis.on('error', (error) => {
      console.error('ClipForge transcription Redis error:', error.message);
    });
  }

  async onModuleInit() {
    await this.redis.connect();
  }

  async onModuleDestroy() {
    if (this.redis.isOpen) await this.redis.quit();
  }

  async enqueue(videoId: string) {
    const video = await this.prisma.video.findUnique({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video not found.');

    if (video.transcriptionStatus === 'queued' || video.transcriptionStatus === 'processing') {
      return { videoId, status: video.transcriptionStatus, message: 'Transcription is already in progress.' };
    }

    try {
      await this.redis.lPush(QUEUE_KEY, JSON.stringify({
        videoId: video.id,
        storageKey: video.storageKey,
      }));
    } catch {
      throw new ServiceUnavailableException('The transcription queue is unavailable. Please try again.');
    }

    await this.prisma.video.update({
      where: { id: videoId },
      data: { transcriptionStatus: 'queued' },
    });

    return { videoId, status: 'queued', message: 'Video added to the transcription queue.' };
  }

  async getTranscript(videoId: string) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, transcriptionStatus: true },
    });
    if (!video) throw new NotFoundException('Video not found.');

    const transcript = await this.prisma.transcript.findUnique({
      where: { videoId },
      include: { segments: { orderBy: { startSeconds: 'asc' } } },
    });

    return {
      videoId,
      status: video.transcriptionStatus,
      transcript,
    };
  }
}
