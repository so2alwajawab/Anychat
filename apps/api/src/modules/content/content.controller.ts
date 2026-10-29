import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ContentService } from './content.service.js';
import type { ListCommentsQuery, ListContentQuery, SyncContentDto } from './dto.js';

@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('posts')
  async listPosts(@Query() query: ListContentQuery) {
    return this.content.listPosts(query);
  }

  @Get('comments')
  async listComments(@Query() query: ListCommentsQuery) {
    return this.content.listComments(query);
  }

  @Get('comments/:id')
  async getComment(@Param('id') id: string) {
    return this.content.getComment(id);
  }

  @Post('sync')
  @HttpCode(200)
  async sync(@Body() body: SyncContentDto) {
    return this.content.sync(body.assetId);
  }

  @Post('post/metadata')
  @HttpCode(200)
  async savePostMetadata(
    @Body() body: { postId?: string; customerName?: string; imageUrl?: string },
  ) {
    return this.content.savePostMetadata(body);
  }

  @Get('post/metadata')
  async getPostMetadata(@Query('postId') postId?: string) {
    return this.content.getPostMetadata(postId);
  }
}
