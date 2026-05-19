import { Node } from 'cc';

export function applyLayerRecursive(root: Node, layer: number): void {
  root.layer = layer;

  for (const child of root.children) {
    applyLayerRecursive(child, layer);
  }
}
