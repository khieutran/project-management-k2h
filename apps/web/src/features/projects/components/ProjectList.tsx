import type { Project } from '../project.types';
import { ProjectCard } from './ProjectCard';

export function ProjectList({ projects, showOwner }: { projects: Project[]; showOwner: boolean }) {
  return <div className="project-grid">{projects.map((project) => <ProjectCard key={project.id} project={project} showOwner={showOwner} />)}</div>;
}
