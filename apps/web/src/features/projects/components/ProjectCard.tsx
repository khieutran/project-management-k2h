import { Link } from 'react-router-dom';

import type { Project } from '../project.types';
import { ProjectStatusBadge } from './ProjectStatusBadge';

export function ProjectCard({ project, showOwner }: { project: Project; showOwner: boolean }) {
  return (
    <article className="project-card">
      <div className="project-card-heading"><span className="project-key">{project.key}</span><ProjectStatusBadge status={project.status} /></div>
      <h2><Link to={`/projects/${project.id}${project.deletedAt ? '?includeDeleted=true' : ''}`}>{project.name}</Link></h2>
      <p>{project.description || 'Chưa có mô tả.'}</p>
      {showOwner ? <p className="project-owner">Chủ dự án: <strong>{project.owner.displayName}</strong></p> : null}
    </article>
  );
}
