import { Controller, Get } from '@nestjs/common';
import { ProjectsService } from './settings/projects.service';

/**
 * Deliberately separate from AdminController: that controller's class-level
 * settings:access requirement would otherwise apply here too. Any authenticated user needs to
 * see project names to tag a file at upload time or pick the active project in the view builder,
 * not just RBAC admins.
 */
@Controller('projects')
export class ProjectsLookupController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list() {
    return this.projectsService.list();
  }
}
