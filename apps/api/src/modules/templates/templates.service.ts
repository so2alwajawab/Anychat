import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES, apiError, validateTemplateVariables, extractTemplateVariables } from '@anychat/shared';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import type { CreateTemplateDto, UpdateTemplateDto } from './dto.js';

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    return this.prisma.messageTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const template = await this.prisma.messageTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException('القالب غير موجود');
    }
    return template;
  }

  async create(dto: CreateTemplateDto, actorId?: string) {
    const varErrors = validateTemplateVariables(dto.body);
    if (varErrors.length > 0) {
      throw new HttpException(
        apiError(400, ERROR_CODES.VALIDATION_ERROR, varErrors[0]?.message),
        400,
      );
    }

    const existing = await this.prisma.messageTemplate.findUnique({
      where: { name: dto.name.trim() },
    });
    if (existing) {
      throw new HttpException(
        apiError(409, ERROR_CODES.CONFLICT, 'يوجد قالب آخر يحمل نفس الاسم'),
        409,
      );
    }

    const allowedVariables = extractTemplateVariables(dto.body);

    const template = await this.prisma.messageTemplate.create({
      data: {
        name: dto.name.trim(),
        body: dto.body,
        allowedVariables,
        version: 1,
      },
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.TEMPLATE_CREATED,
      actorId,
      entity: 'message_template',
      entityId: template.id,
      meta: { name: template.name },
    });

    return template;
  }

  async update(id: string, dto: UpdateTemplateDto, actorId?: string) {
    const template = await this.getById(id);

    if (dto.body) {
      const varErrors = validateTemplateVariables(dto.body);
      if (varErrors.length > 0) {
        throw new HttpException(
          apiError(400, ERROR_CODES.VALIDATION_ERROR, varErrors[0]?.message),
          400,
        );
      }
    }

    if (dto.name && dto.name.trim() !== template.name) {
      const existing = await this.prisma.messageTemplate.findUnique({
        where: { name: dto.name.trim() },
      });
      if (existing && existing.id !== id) {
        throw new HttpException(
          apiError(409, ERROR_CODES.CONFLICT, 'يوجد قالب آخر يحمل نفس الاسم'),
          409,
        );
      }
    }

    const newBody = dto.body ?? template.body;
    const allowedVariables = extractTemplateVariables(newBody);

    const updated = await this.prisma.messageTemplate.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : template.name,
        body: newBody,
        allowedVariables,
        version: template.version + 1,
      },
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.TEMPLATE_UPDATED,
      actorId,
      entity: 'message_template',
      entityId: updated.id,
      meta: { name: updated.name, version: updated.version },
    });

    return updated;
  }

  async delete(id: string, actorId?: string) {
    const template = await this.getById(id);
    await this.prisma.messageTemplate.delete({ where: { id } });

    await this.audit.record({
      action: AUDIT_ACTIONS.TEMPLATE_DELETED,
      actorId,
      entity: 'message_template',
      entityId: id,
      meta: { name: template.name },
    });

    return { success: true };
  }
}
