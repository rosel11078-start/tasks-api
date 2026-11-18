import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup';

describe('/tasks (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const valid = { title: 'Prepare demo', description: 'Slides and data', assignee: 'Ana', dueDate: '2026-12-01' };
  const missingId = '00000000-0000-4000-8000-000000000000';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(() => prisma.task.deleteMany());

  afterAll(() => app.close());

  it('creates a task with status pending by default (201)', async () => {
    const res = await request(app.getHttpServer()).post('/tasks').send(valid).expect(201);
    expect(res.body).toMatchObject({ ...valid, status: 'pending' });
    expect(res.body.id).toEqual(expect.any(String));
  });

  it('rejects invalid data with 400 and says what is wrong', async () => {
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .send({ title: '  ', assignee: 'Ana', dueDate: '2026-02-30', status: 'archived', priority: 'high' })
      .expect(400);
    const messages = (res.body.message as string[]).join(' | ');
    expect(messages).toMatch(/title should not be empty/);
    expect(messages).toMatch(/dueDate/);
    expect(messages).toMatch(/status must be one of/);
    expect(messages).toMatch(/property priority should not exist/);
  });

  it('answers 400 for a malformed id and 404 for an unknown one', async () => {
    await request(app.getHttpServer()).get('/tasks/123').expect(400);
    await request(app.getHttpServer()).get(`/tasks/${missingId}`).expect(404);
    await request(app.getHttpServer()).patch(`/tasks/${missingId}`).send({ status: 'done' }).expect(404);
    await request(app.getHttpServer()).delete(`/tasks/${missingId}`).expect(404);
  });

  it('filters by status and assignee and paginates the result', async () => {
    const server = app.getHttpServer();
    for (let day = 1; day <= 3; day++) {
      await request(server).post('/tasks').send({ ...valid, title: `Ana ${day}`, dueDate: `2026-12-0${day}` }).expect(201);
    }
    await request(server).post('/tasks').send({ ...valid, title: 'Ana done', status: 'done' }).expect(201);
    await request(server).post('/tasks').send({ ...valid, title: 'Luis', assignee: 'Luis' }).expect(201);

    const res = await request(server).get('/tasks?status=pending&assignee=ana&page=2&limit=2').expect(200);

    expect(res.body.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(res.body.data.map((t: { title: string }) => t.title)).toEqual(['Ana 3']);
    await request(server).get('/tasks?limit=101').expect(400);
  });

  it('updates part of a task and deletes it (204)', async () => {
    const server = app.getHttpServer();
    const { body: created } = await request(server).post('/tasks').send(valid).expect(201);

    const { body: updated } = await request(server).patch(`/tasks/${created.id}`).send({ status: 'in_progress' }).expect(200);
    expect(updated).toMatchObject({ ...valid, status: 'in_progress' });

    await request(server).delete(`/tasks/${created.id}`).expect(204);
    await request(server).get(`/tasks/${created.id}`).expect(404);
  });
});
