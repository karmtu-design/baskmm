declare module "frappe-gantt" {
  export type GanttTask = { id: string; name: string; start: string; end: string; progress?: number; custom_class?: string; description?: string };
  type Popup = { task: GanttTask & { _start: Date; _end: Date }; set_title: (t: string) => void; set_subtitle: (t: string) => void; set_details: (t: string) => void };
  export default class Gantt {
    constructor(el: HTMLElement | string, tasks: GanttTask[], options?: Record<string, unknown> & { popup?: (p: Popup) => void; on_click?: (t: GanttTask) => void });
    change_view_mode(mode: string): void;
    refresh(tasks: GanttTask[]): void;
  }
}
