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

type Segment = { startSeconds: number; endSeconds: number; text: string };

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

  async discoverClips(videoId: string) {
    const video = await this.prisma.video.findUnique({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video not found.');
    if (video.transcriptionStatus !== 'completed') {
      throw new BadRequestException('Complete the video transcript before discovering clips.');
    }

    const transcript = await this.prisma.transcript.findUnique({
      where: { videoId },
      include: { segments: { orderBy: { startSeconds: 'asc' } } },
    });
    if (!transcript?.segments.length) {
      throw new BadRequestException('No transcript speech segments are available for this video.');
    }

    const candidates = this.buildClipCandidates(transcript.segments);
    const ranked = candidates
      .map((candidate) => ({ ...candidate, score: this.scoreClip(candidate.text) }))
      .sort((a, b) => b.score - a.score || a.startSeconds - b.startSeconds)
      .slice(0, 5)
      .sort((a, b) => a.startSeconds - b.startSeconds);

    await this.prisma.$transaction([
      this.prisma.clipSuggestion.deleteMany({ where: { videoId } }),
      ...(ranked.length
        ? [this.prisma.clipSuggestion.createMany({
            data: ranked.map((clip) => ({
              videoId,
              title: this.makeClipTitle(clip.text),
              startSeconds: clip.startSeconds,
              endSeconds: clip.endSeconds,
              score: clip.score,
              reason: this.explainScore(clip.text, clip.score),
            })),
          })]
        : []),
    ]);

    return {
      videoId,
      count: ranked.length,
      message: ranked.length
        ? 'Clip suggestions generated from transcript moments.'
        : 'No strong clip moments were found in this transcript.',
      clips: await this.getClipSuggestions(videoId),
    };
  }

  async getClipSuggestions(videoId: string) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true },
    });
    if (!video) throw new NotFoundException('Video not found.');
    return this.prisma.clipSuggestion.findMany({
      where: { videoId },
      orderBy: [{ score: 'desc' }, { startSeconds: 'asc' }],
    });
  }

  private buildClipCandidates(segments: Segment[]) {
    const candidates: Array<{ startSeconds: number; endSeconds: number; text: string }> = [];
    let group: Segment[] = [];
    let start = 0;

    for (const segment of segments) {
      if (!group.length) start = segment.startSeconds;
      const elapsed = segment.endSeconds - start;
      if (group.length && elapsed > 45) {
        this.pushCandidate(candidates, group);
        group = [];
        start = segment.startSeconds;
      }
      group.push(segment);
      if (segment.endSeconds - start >= 24) {
        this.pushCandidate(candidates, group);
        group = [];
      }
    }
    if (group.length) this.pushCandidate(candidates, group);
    return candidates;
  }

  private pushCandidate(
    candidates: Array<{ startSeconds: number; endSeconds: number; text: string }>,
    segments: Segment[],
  ) {
    if (!segments.length) return;
    const text = segments.map((segment) => segment.text.trim()).filter(Boolean).join(' ');
    const startSeconds = segments[0].startSeconds;
    const endSeconds = segments[segments.length - 1].endSeconds;
    if (text.split(/\s+/).filter(Boolean).length >= 12 && endSeconds - startSeconds >= 8) {
      candidates.push({ startSeconds, endSeconds, text });
    }
  }

  private scoreClip(text: string) {
    const normalized = text.toLowerCase();
    const words = normalized.split(/\s+/).filter(Boolean);
    const hookTerms = ['imagine', 'secret', 'mistake', 'truth', 'why', 'how', 'never', 'always', 'finally', 'suddenly', 'impossible', 'surprising', 'best', 'worst', 'because'];
    const hookCount = hookTerms.filter((term) => new RegExp(`\\b${term}\\b`).test(normalized)).length;
    const hasQuestion = /\?/.test(text);
    const hasNumber = /\b\d+\b/.test(text);
    const hasEmphasis = /!|—|:/.test(text);
    const density = Math.min(15, Math.floor(words.length / 8));
    return Math.min(100, 35 + hookCount * 8 + (hasQuestion ? 10 : 0) + (hasNumber ? 7 : 0) + (hasEmphasis ? 5 : 0) + density);
  }

  private makeClipTitle(text: string) {
    const clean = text.replace(/\s+/g, ' ').trim();
    const words = clean.split(' ');
    return words.slice(0, 9).join(' ') + (words.length > 9 ? '…' : '');
  }

  private explainScore(text: string, score: number) {
    const reasons: string[] = [];
    if (/\?/.test(text)) reasons.push('contains a question that can create curiosity');
    if (/\b(imagine|secret|mistake|truth|never|always|impossible|suddenly|finally)\b/i.test(text)) {
      reasons.push('uses attention-grabbing language');
    }
    if (/\b\d+\b/.test(text)) reasons.push('includes a specific number or fact');
    if (!reasons.length) reasons.push('has a concise, self-contained transcript passage');
    return `Heuristic score ${score}/100: ${reasons.join('; ')}. Review the moment before publishing.`;
  }
}
