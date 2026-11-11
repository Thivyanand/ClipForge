import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { PrismaService } from '../database/prisma.service';

const QUEUE_KEY = 'clipforge:transcription:jobs';
const execFileAsync = promisify(execFile);
const UPLOADS_DIR = resolve(process.env.UPLOADS_DIR ?? 'storage/uploads');

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

    const mediaPath = resolve(UPLOADS_DIR, video.storageKey);
    if (!mediaPath.startsWith(`${UPLOADS_DIR}/`)) {
      throw new BadRequestException('Invalid uploaded media path.');
    }
    try {
      await access(mediaPath);
    } catch {
      throw new BadRequestException('The uploaded video file is missing from storage.');
    }

    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-select_streams', 'a',
        '-show_entries', 'stream=index',
        '-of', 'csv=p=0',
        mediaPath,
      ]);
      if (!stdout.trim()) {
        throw new BadRequestException('This video has no audio stream and cannot be transcribed.');
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException('Could not inspect the video audio stream. Ensure FFprobe is installed.');
    }

    await this.prisma.video.update({
      where: { id: videoId },
      data: { transcriptionStatus: 'queued', transcriptionError: null },
    });

    try {
      await this.redis.lPush(QUEUE_KEY, JSON.stringify({
        videoId: video.id,
        storageKey: video.storageKey,
      }));
    } catch {
      await this.prisma.video.update({
        where: { id: videoId },
        data: { transcriptionStatus: 'failed', transcriptionError: 'The transcription queue is unavailable.' },
      });
      throw new ServiceUnavailableException('The transcription queue is unavailable. Please try again.');
    }

    return { videoId, status: 'queued', message: 'Video added to the transcription queue.' };
  }

  async getTranscript(videoId: string) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, transcriptionStatus: true, transcriptionError: true },
    });
    if (!video) throw new NotFoundException('Video not found.');

    const transcript = await this.prisma.transcript.findUnique({
      where: { videoId },
      include: { segments: { orderBy: { startSeconds: 'asc' } } },
    });

    return {
      videoId,
      status: video.transcriptionStatus,
      error: video.transcriptionError,
      transcript,
    };
  }
}
