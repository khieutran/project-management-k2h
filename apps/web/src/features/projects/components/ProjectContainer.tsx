import type { Project } from '../project.types';
import { Link } from 'react-router-dom';

import type { WorkItem, WorkItemType } from '../../work-items/work-item.types';

const SHELVES = [
  { label: 'Tasks', type: 'TASK', add: 'Thêm task', color: 'blue', description: 'Chưa có task.' },
  { label: 'Bugs', type: 'BUG', add: 'Thêm bug', color: 'rust', description: 'Chưa có bug.' },
  { label: 'Tests', type: 'TEST', add: 'Thêm test', color: 'teal', description: 'Chưa có test.' },
] as const;

const STATUS_LABELS = { TODO: 'Cần làm', IN_PROGRESS: 'Đang làm', REVIEW: 'Đang duyệt', DONE: 'Hoàn thành' };

type ProjectContainerProps = {
  project: Project;
  items?: WorkItem[];
  canWrite?: boolean;
  onAdd?: (type: WorkItemType) => void;
};

export function ProjectContainer({ project, items = [], canWrite = false, onAdd }: ProjectContainerProps) {
  return (
    <section className="project-container-scene" aria-label={`Container ${project.name}`}>
      <div className="project-container-scene-heading">
        <span>Hàng hóa dự án</span>
        <p>Mỗi công việc sẽ là một kiện hàng trong container.</p>
      </div>
      <div className="project-truck">
        <div className="project-truck-cab" aria-hidden="true">
          <span className="project-truck-windshield" />
          <span className="project-truck-door" />
          <span className="project-truck-wheel project-truck-wheel-front" />
        </div>
        <div className="project-truck-trailer">
          <div className="project-truck-container">
            {SHELVES.map((shelf) => (
              <div className="project-cargo-shelf" role="region" aria-label={shelf.label} key={shelf.label}>
                <div className={`project-cargo-shelf-name is-${shelf.color}`}><h2>{shelf.label}</h2><span>{items.filter((item) => item.type === shelf.type).length}</span></div>
                <div className="project-cargo-scroll" tabIndex={0} aria-label={`Cuộn ${shelf.label}`}>
                  {items.filter((item) => item.type === shelf.type).length ? items.filter((item) => item.type === shelf.type).map((item) => (
                    <Link className="project-cargo-item" key={item.id} to={`?item=${item.id}`} aria-label={`${item.title}, ${STATUS_LABELS[item.status]}`}>
                      <span className="project-cargo-item-code">{shelf.type[0]}-{item.id.slice(0, 6).toUpperCase()}</span>
                      <strong>{item.title}</strong>
                      <span className={`project-cargo-status is-${item.status.toLowerCase()}`}>{STATUS_LABELS[item.status]}</span>
                    </Link>
                  )) : <div className="project-cargo-empty"><span className="project-cargo-parcel" aria-hidden="true" /><p>{shelf.description}</p></div>}
                </div>
                {canWrite && onAdd ? <button className="project-cargo-add" type="button" onClick={() => onAdd(shelf.type)}>{shelf.add}</button> : null}
              </div>
            ))}
          </div>
          <span className="project-truck-wheel project-truck-wheel-rear-one" aria-hidden="true" />
          <span className="project-truck-wheel project-truck-wheel-rear-two" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
