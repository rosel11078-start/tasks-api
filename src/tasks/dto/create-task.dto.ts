import { TaskStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateTaskDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  assignee: string;

  // Fecha límite sin hora (YYYY-MM-DD); strict rechaza fechas imposibles como 2026-02-30.
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dueDate must be a date in YYYY-MM-DD format' })
  @IsISO8601({ strict: true })
  dueDate: string;
}
