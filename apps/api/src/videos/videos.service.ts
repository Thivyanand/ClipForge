import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { execFile } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

@Injectable()
export class VideosService {
  constructor(private readonly prisma: PrismaService) {}

  async inspectAndSave(file: Express.Multer.File) {
    let metadata: {
      format?: { duration?: string; format_name?: string };
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        width?: number;
        height?: number;
        avg_frame_rate?: string;
      }>;
    };

    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-show_entries',
        'format=duration,format_name:stream=codec_type,codec_name,width,height,avg_frame_rate',
        '-of', 'json',
        file.path,
      ]);
      metadata = JSON.parse(stdout);
    } catch {
      await unlink(file.path).catch(() => undefined);
      throw new BadRequestException('Invalid or unsupported video file.');
    }

    const video = metadata.streams?.find(
      (stream) => stream.codec_type === 'video',
    );
    if (!video) {
      await unlink(file.path).catch(() => undefined);
      throw new BadRequestException('No valid video stream found.');
    }

    const [numerator, denominator] = (
      video.avg_frame_rate ?? '0/1'
    ).split('/').map(Number);
    const frameRate =
      denominator && numerator
        ? Number((numerator / denominator).toFixed(3))
        : null;

    try {
      const saved = await this.prisma.video.create({
        data: {
          originalName: file.originalname,
          storageKey: file.filename,
          size: file.size,
          mimeType: file.mimetype,
          durationSeconds: Number(metadata.format?.duration ?? 0),
          width: video.width ?? null,
          height: video.height ?? null,
          codec: video.codec_name ?? null,
          frameRate,
          format: metadata.format?.format_name ?? null,
        },
      });

      return this.toResponse(saved);
    } catch {
      await unlink(file.path).catch(() => undefined);
      throw new InternalServerErrorException(
        'The video was processed but could not be saved. Please try again.',
      );
    }
  }

  async findAll() {
    const videos = await this.prisma.video.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return videos.map((video) => this.toResponse(video));
  }

  async findOne(id: string) {
    const video = await this.prisma.video.findUnique({ where: { id } });
    if (!video) throw new NotFoundException('Video not found.');
    return this.toResponse(video);
  }

  private toResponse(video: {
    id: string;
    originalName: string;
    storageKey: string;
    size: number;
    mimeType: string;
    durationSeconds: number;
    width: number | null;
    height: number | null;
    codec: string | null;
    frameRate: number | null;
    format: string | null;
    status: string;
    transcriptionStatus: string;
    transcriptionError: string | null;
    createdAt: Date;
  }) {
    return {
      id: video.id,
      originalName: video.originalName,
      storageKey: video.storageKey,
      size: video.size,
      mimeType: video.mimeType,
      durationSeconds: video.durationSeconds,
      width: video.width,
      height: video.height,
      codec: video.codec,
      frameRate: video.frameRate,
      format: video.format,
      status: video.status,
      transcriptionStatus: video.transcriptionStatus,
      transcriptionError: video.transcriptionError,
      createdAt: video.createdAt,
    };
  }
}
