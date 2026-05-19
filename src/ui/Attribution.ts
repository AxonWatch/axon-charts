import { IChart } from '../types/index.js';

const CSS = `
a#aw-attribution {
  position: absolute;
  left: 45px;
  bottom: 45px;
  height: 32px;
  min-width: 32px;
  background: #000;
  display: flex;
  align-items: center;
  z-index: 20;
  border: 2px solid #fff;
  cursor: pointer;
  text-decoration: none;
  opacity: 1;
  border-radius: 16px;
  overflow: hidden;
  max-width: 32px;
  transition: max-width 0.35s cubic-bezier(0.23, 1, 0.32, 1);
}
a#aw-attribution:hover {
  max-width: 200px;
}
a#aw-attribution .logo-accent {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 16px;
  font-weight: 700;
  font-style: italic;
  color: #00d4aa;
  text-shadow: 0 0 10px rgba(0, 212, 170, 0.3);
  margin-left: 8px;
  margin-right: 0;
  flex-shrink: 0;
  line-height: 32px;
  user-select: none;
}
a#aw-attribution .logo-rest {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 12px;
  font-weight: 800;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  max-width: 0;
  padding-right: 0;
  transition:
    max-width 0.35s cubic-bezier(0.23, 1, 0.32, 1),
    padding-right 0.35s cubic-bezier(0.23, 1, 0.32, 1);
  line-height: 32px;
  user-select: none;
}
a#aw-attribution:hover .logo-rest {
  max-width: 120px;
  padding-right: 8px;
}
`;

/**
 * Attribution widget — displays a stylized "A" in a black circle
 * that expands on hover to reveal "xon.Watch", linking to axon.watch.
 *
 * Injected as a DOM overlay above all canvas layers via z-index.
 * Zero per-frame performance cost — uses CSS transitions only.
 */
export class Attribution {
  private chart: IChart;
  private element: HTMLAnchorElement | null = null;
  private styleElement: HTMLStyleElement | null = null;

  constructor(chart: IChart) {
    this.chart = chart;
    this.render();
  }

  public update(): void {
    this.render();
  }

  public removeElement(): void {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
  }

  private render(): void {
    const options = this.chart.options.attribution;

    if (!options?.show) {
      this.removeElement();
      return;
    }

    if (this.element) return;

    this.styleElement = document.createElement('style');
    this.styleElement.textContent = CSS;
    this.chart.container.appendChild(this.styleElement);

    this.element = document.createElement('a');
    this.element.id = 'aw-attribution';
    this.element.href = 'https://axon.watch';
    this.element.target = '_blank';
    this.element.rel = 'noopener noreferrer';
    this.element.title = 'Axon Charts';

    const accent = document.createElement('span');
    accent.className = 'logo-accent';
    accent.textContent = 'A';
    this.element.appendChild(accent);

    const rest = document.createElement('span');
    rest.className = 'logo-rest';
    rest.textContent = 'xon.Watch';
    this.element.appendChild(rest);

    this.chart.container.appendChild(this.element);
  }
}
