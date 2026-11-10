import { BadRequestException, Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

@Injectable()
export class VideosService {
  async inspect(file: Express.Multer.File) {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-show_entries',
        'format=duration,format_name:stream=codec_type,codec_name,width,height,avg_frame_rate',
        '-of', 'json',
        file.path,
      ]);

      const metadata = JSON.parse(stdout) as {
        format?: {
          duration?: string;
          format_name?: string;
        };
        streams?: Array<{
          codec_type?: string;
          codec_name?: string;
          width?: number;
          height?: number;
          avg_frame_rate?: string;
        }>;
      };

      const video = metadata.streams?.find(
        (stream) => stream.codec_type === 'video',
      );

      if (!video) {
        throw new BadRequestException('No valid video stream found.');
      }

      const [numerator, denominator] = (
        video.avg_frame_rate ?? '0/1'
      ).split('/').map(Number);

      const frameRate =
        denominator && numerator
          ? Number((numerator / denominator).toFixed(3))
          : null;

      return {
        id: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        durationSeconds: Number(metadata.format?.duration ?? 0),
        width: video.width ?? null,
        height: video.height ?? null,
        codec: video.codec_name ?? null,
        frameRate,
        format: metadata.format?.format_name ?? null,
        status: 'uploaded',
      };
    } catch {
      await unlink(file.path).catch(() => undefined);
      throw new BadRequestException(
        'Invalid or unsupported video file.',
      );
    }
  }
}