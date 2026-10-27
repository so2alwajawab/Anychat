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
import {
  CreateWorkflowDto,
  PublishWorkflowDto,
  TestRunDto,
  UpdateWorkflowDraftDto,
} from './dto.js';
import { WorkflowsService } from './workflows.service.js';

@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get()
  async list() {
    return this.workflows.list();
  }

  @Post()
  async create(@Body() dto: CreateWorkflowDto, @Req() req: Request) {
    const ownerId = req.session?.ownerId;
    return this.workflows.create(dto, ownerId);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.workflows.getById(id);
  }

  @Put(':id')
  async updateDraft(
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDraftDto,
    @Req() req: Request,
  ) {
    const ownerId = req.session?.ownerId;
    return this.workflows.updateDraft(id, dto, ownerId);
  }

  @Post(':id/publish')
  @HttpCode(200)
  async publish(
    @Param('id') id: string,
    @Body() dto: PublishWorkflowDto,
    @Req() req: Request,
  ) {
    const ownerId = req.session?.ownerId;
    return this.workflows.publish(id, dto, ownerId);
  }

  @Post(':id/pause')
  @HttpCode(200)
  async pause(@Param('id') id: string, @Req() req: Request) {
    const ownerId = req.session?.ownerId;
    return this.workflows.pause(id, ownerId);
  }

  @Post(':id/resume')
  @HttpCode(200)
  async resume(@Param('id') id: string, @Req() req: Request) {
    const ownerId = req.session?.ownerId;
    return this.workflows.resume(id, ownerId);
  }

  @Delete(':id')
  @HttpCode(200)
  async delete(@Param('id') id: string, @Req() req: Request) {
    const ownerId = req.session?.ownerId;
    return this.workflows.delete(id, ownerId);
  }

  @Get(':id/versions')
  async listVersions(@Param('id') id: string) {
    return this.workflows.listVersions(id);
  }

  @Post(':id/test-run')
  @HttpCode(200)
  async testRun(@Param('id') id: string, @Body() dto: TestRunDto) {
    return this.workflows.testRun(id, dto);
  }
}
