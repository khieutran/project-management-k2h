import type { ProjectMember } from '../project.types';
import { ProjectAccessBadge } from './ProjectAccessBadge';

export function ProjectMemberRow({ member }: { member: ProjectMember }) {
  return (
    <li className="project-member-row">
      <div className="project-member-identity">
        <strong>{member.user.displayName}</strong>
        <span>{member.user.email}</span>
      </div>
      <ProjectAccessBadge accessRole={member.role} />
    </li>
  );
}
