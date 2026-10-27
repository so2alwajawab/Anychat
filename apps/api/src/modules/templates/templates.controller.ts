import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CreateTemplateDto, UpdateTemplateDto } from './dto.js';
import { TemplatesService } from './templates.service.js';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  async list() {
    return this.templates.list();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.templates.getById(id);
  }

  @Post()
  async create(@Body() dto: CreateTemplateDto, @Req() req: Request) {
    const ownerId = req.session?.ownerId;
    return this.templates.create(dto, ownerId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @Req() req: Request,
  ) {
    const ownerId = req.session?.ownerId;
    return this.templates.update(id, dto, ownerId);
  }

  @Delete(':id')
  @HttpCode(200)
  async delete(@Param('id') id: string, @Req() req: Request) {
    const ownerId = req.session?.ownerId;
    return this.templates.delete(id, ownerId);
  }
}
