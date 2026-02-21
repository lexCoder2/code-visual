import type { ProjectSummary } from "../../types/graph";

type ProjectControlProps = {
  activeProjectId: string;
  projects: ProjectSummary[];
  disabled: boolean;
  onSelectProject: (projectId: string) => void;
};

export function ProjectControl(props: ProjectControlProps) {
  const { activeProjectId, projects, disabled, onSelectProject } = props;

  return (
    <label className="control-item project-control" htmlFor="project-select">
      <span>Project</span>
      <select
        id="project-select"
        value={activeProjectId}
        onChange={(event) => {
          onSelectProject(event.target.value);
        }}
        disabled={disabled}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </label>
  );
}
