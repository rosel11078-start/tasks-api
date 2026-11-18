import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Task } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from './tasks.service';

const task: Task = {
  id: '6f1c2c1e-7d0a-4a8e-9a43-1d2f3b4c5d6e',
  title: 'Write README',
  description: '',
  status: 'pending',
  assignee: 'Ana',
  dueDate: new Date('2026-12-01'),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('TasksService', () => {
  const prisma = {
    task: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  };
  const service = new TasksService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('translates filters and page into a Prisma query and reports the page count', async () => {
    prisma.task.findMany.mockResolvedValue([task]);
    prisma.task.count.mockResolvedValue(45);

    const page = await service.findAll({ status: 'pending', assignee: 'ana', page: 3, limit: 20 });

    const where = { status: 'pending', assignee: { equals: 'ana', mode: 'insensitive' } };
    expect(prisma.task.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 40, take: 20 }));
    expect(prisma.task.count).toHaveBeenCalledWith({ where });
    expect(page.meta).toEqual({ page: 3, limit: 20, total: 45, totalPages: 3 });
    expect(page.data[0].dueDate).toBe('2026-12-01');
  });

  it('throws NotFoundException when the task does not exist', async () => {
    prisma.task.findUnique.mockResolvedValue(null);
    await expect(service.findOne(task.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an update with no fields without touching the database', async () => {
    await expect(service.update(task.id, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });
});
