import { type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import type { Project } from '../project.types';
import { ProjectAccessBadge } from './ProjectAccessBadge';

const TRUCK_HUES = ['0deg', '190deg', '83deg', '204deg', '160deg', '10deg', '246deg'];
const TRUCK_COLORS = ['#e96024', '#276796', '#738b45', '#314963', '#278a91', '#dc792e', '#755ca2'];
const STATUS_LABELS = { PLANNING: 'Lập kế hoạch', ACTIVE: 'Đang thực hiện', COMPLETED: 'Hoàn thành' };

type ProjectYardProps = {
  projects: Project[];
  page: number;
  showOwner: boolean;
  enteringProjectId?: string;
};

function Truck({ hue }: { hue: string }) {
  return (
    <span className="yard-truck" style={{ '--truck-hue': hue } as CSSProperties} aria-hidden="true" />
  );
}

export function ProjectYard({ projects, page, showOwner, enteringProjectId }: ProjectYardProps) {
  return (
    <section className="cargo-yard" aria-label={`Bãi ${page}`}>
      <div className="yard-caption">
        <div><span className="yard-caption-kicker">K2H-PM</span><h2>Bãi {page}</h2></div>
        <span>{projects.length} / 7 vị trí đang sử dụng</span>
      </div>
      <div className="yard-lot">
        <div className="yard-parking-row yard-parking-row-top">
          {Array.from({ length: 4 }, (_, index) => renderSlot(index))}
        </div>
        <div className="yard-road" aria-hidden="true"><span>ĐƯỜNG NỘI BỘ</span></div>
        <div className="yard-parking-row yard-parking-row-bottom">
          {Array.from({ length: 3 }, (_, index) => renderSlot(index + 4))}
        </div>
      </div>
      <div className="yard-mobile-list">
        {projects.map((project, index) => (
          <Link className="yard-mobile-project" key={project.id} to={`/projects/${project.id}`}>
            <span className="yard-mobile-index">{String((page - 1) * 7 + index + 1).padStart(2, '0')}</span>
            <span><strong>{project.name}</strong><small>{project.key} · {STATUS_LABELS[project.status]}</small></span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
        {projects.length < 7 ? <Link className="yard-mobile-create" to="/projects/new">+ Tạo dự án</Link> : null}
      </div>
    </section>
  );

  function renderSlot(index: number) {
    const project = projects[index];
    const slot = (page - 1) * 7 + index + 1;
    return (
      <div className="yard-slot" data-testid="yard-slot" key={slot}>
        <span className="yard-slot-number" aria-hidden="true">{String(slot).padStart(2, '0')}</span>
        {project ? (
          <Link className={`yard-project${project.id === enteringProjectId ? ' is-arriving' : ''}`} style={{ '--truck-color': TRUCK_COLORS[index] ?? '#e96024' } as CSSProperties} to={`/projects/${project.id}`} aria-label={`${project.name}, ${STATUS_LABELS[project.status]}`}>
            <Truck hue={TRUCK_HUES[index] ?? '0deg'} />
            <span className="yard-project-label">
              <strong><i aria-hidden="true" />{project.name}</strong>
              <span className="yard-project-meta"><span>{project.key}</span><span className={`yard-project-status is-${project.status.toLowerCase()}`}>{STATUS_LABELS[project.status]}</span></span>
              {showOwner ? <span>{project.owner.displayName}</span> : null}
              {showOwner ? <ProjectAccessBadge accessRole={project.accessRole} /> : null}
            </span>
          </Link>
        ) : index === projects.length ? (
          <Link className="yard-new-project" to="/projects/new" aria-label="Tạo dự án">
            <span className="yard-new-outline" aria-hidden="true"><span>+</span></span>
            <strong>Tạo dự án</strong>
          </Link>
        ) : null}
      </div>
    );
  }
}
