import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Task } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQuery } from './dto/list-tasks.query';
import { UpdateTaskDto } from './dto/update-task.dto';

/** dueDate goes out in the same YYYY-MM-DD format it comes in, not as a midnight UTC timestamp. */
export type TaskResponse = Omit<Task, 'dueDate'> & { dueDate: string };
const toResponse = (task: Task): TaskResponse => ({ ...task, dueDate: task.dueDate.toISOString().slice(0, 10) });

export interface Page<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTaskDto): Promise<TaskResponse> {
    return toResponse(await this.prisma.task.create({ data: { ...dto, dueDate: new Date(dto.dueDate) } }));
  }

  async findAll({ status, assignee, page, limit }: ListTasksQuery): Promise<Page<TaskResponse>> {
    const where: Prisma.TaskWhereInput = {
      ...(status && { status }),
      ...(assignee && { assignee: { equals: assignee, mode: 'insensitive' } }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);
    return { data: data.map(toResponse), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string): Promise<TaskResponse> {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return toResponse(task);
  }

  async update(id: string, dto: UpdateTaskDto): Promise<TaskResponse> {
    if (Object.keys(dto).length === 0) throw new BadRequestException('Nothing to update');
    // A missing id makes Prisma throw P2025, which PrismaExceptionFilter turns into a 404 (one query, no race).
    return toResponse(await this.prisma.task.update({
      where: { id },
      data: { ...dto, ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }) },
    }));
  }

  async remove(id: string): Promise<void> {
    await this.prisma.task.delete({ where: { id } });
  }
}
