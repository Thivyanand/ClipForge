import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { VideosService } from './videos.service';

const uploadDirectory = resolve(
  process.cwd(),
  '../../storage/uploads',
);
const allowedExtensions = ['.mp4', '.mov', '.webm'];

@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          mkdirSync(uploadDirectory, { recursive: true });
          callback(null, uploadDirectory);
        },
        filename: (_req, file, callback) => {
          callback(
            null,
            `${randomUUID()}${extname(file.originalname).toLowerCase()}`,
          );
        },
      }),
      limits: { fileSize: 500 * 1024 * 1024, files: 1 },
      fileFilter: (_req, file, callback) => {
        const extension = extname(file.originalname).toLowerCase();
        if (!allowedExtensions.includes(extension)) {
          return callback(
            new BadRequestException('Only MP4, MOV and WebM are allowed.'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Please provide a video file.');
    }

    return {
      message: 'Video uploaded successfully.',
      video: await this.videosService.inspectAndSave(file),
    };
  }

  @Get()
  async findAll() {
    return { videos: await this.videosService.findAll() };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { video: await this.videosService.findOne(id) };
  }
}
