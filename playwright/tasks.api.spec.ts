import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// Each test works with its own assignee, so tests never see each other's data and need no DB cleanup.
const someone = () => `qa-${randomUUID().slice(0, 8)}`;

test('a task goes through its whole life: create, read, update, list and delete', async ({ request }) => {
  const assignee = someone();

  const created = await request.post('/tasks', { data: { title: 'Release notes', assignee, dueDate: '2026-12-15' } });
  expect(created.status()).toBe(201);
  const task = await created.json();
  expect(task).toMatchObject({ title: 'Release notes', status: 'pending', assignee, dueDate: '2026-12-15' });

  expect(await (await request.get(`/tasks/${task.id}`)).json()).toEqual(task);

  const updated = await request.patch(`/tasks/${task.id}`, { data: { status: 'done', description: 'Published' } });
  expect(updated.status()).toBe(200);
  expect(await updated.json()).toMatchObject({ status: 'done', description: 'Published', title: 'Release notes' });

  const done = await (await request.get('/tasks', { params: { assignee, status: 'done' } })).json();
  expect(done.data.map((t: { id: string }) => t.id)).toEqual([task.id]);

  expect((await request.delete(`/tasks/${task.id}`)).status()).toBe(204);
  expect((await request.get(`/tasks/${task.id}`)).status()).toBe(404);
});

test('pages through a filtered list in due date order', async ({ request }) => {
  const assignee = someone();
  for (const day of ['05', '01', '03', '04', '02']) {
    await request.post('/tasks', { data: { title: `Day ${day}`, assignee, dueDate: `2026-12-${day}` } });
  }

  const titles: string[] = [];
  for (let page = 1; page <= 3; page++) {
    const res = await request.get('/tasks', { params: { assignee, page, limit: 2 } });
    const body = await res.json();
    expect(body.meta).toEqual({ page, limit: 2, total: 5, totalPages: 3 });
    titles.push(...body.data.map((t: { title: string }) => t.title));
  }
  expect(titles).toEqual(['Day 01', 'Day 02', 'Day 03', 'Day 04', 'Day 05']);
});

test('answers bad requests with the right status codes', async ({ request }) => {
  const invalid = await request.post('/tasks', { data: { title: '', assignee: someone(), dueDate: 'tomorrow' } });
  expect(invalid.status()).toBe(400);
  expect((await invalid.json()).message).toEqual(
    expect.arrayContaining(['title should not be empty', 'dueDate must be a date in YYYY-MM-DD format']),
  );

  expect((await request.get('/tasks/not-a-uuid')).status()).toBe(400);
  expect((await request.get('/tasks', { params: { status: 'archived' } })).status()).toBe(400);
  expect((await request.patch(`/tasks/${randomUUID()}`, { data: { status: 'done' } })).status()).toBe(404);
});
