import { Controller, Get, Param, Post } from '@nestjs/common';
import { TranscriptionService } from './transcription.service';

@Controller('videos/:id')
export class TranscriptionController {
  constructor(private readonly transcriptionService: TranscriptionService) {}

  @Post('transcribe')
  transcribe(@Param('id') id: string) {
    return this.transcriptionService.enqueue(id);
  }

  @Get('transcript')
  getTranscript(@Param('id') id: string) {
    return this.transcriptionService.getTranscript(id);
  }

  @Post('clips/discover')
  discoverClips(@Param('id') id: string) {
    return this.transcriptionService.discoverClips(id);
  }

  @Get('clips')
  getClipSuggestions(@Param('id') id: string) {
    return this.transcriptionService.getClipSuggestions(id);
  }
}
