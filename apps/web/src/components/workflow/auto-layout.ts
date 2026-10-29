import type { Node, Edge } from "@xyflow/react";

/**
 * Performs a hierarchical tree layout on ReactFlow nodes and edges.
 * Arranges nodes vertically from top to bottom with appropriate horizontal spacing.
 */
export function autoLayoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return [];

  // Find root nodes (nodes with 0 incoming edges, typically trigger.comment)
  const incomingCounts = new Map<string, number>();
  const childrenMap = new Map<string, string[]>();

  for (const n of nodes) {
    incomingCounts.set(n.id, 0);
    childrenMap.set(n.id, []);
  }

  for (const e of edges) {
    if (incomingCounts.has(e.target)) {
      incomingCounts.set(e.target, (incomingCounts.get(e.target) ?? 0) + 1);
    }
    if (childrenMap.has(e.source)) {
      childrenMap.get(e.source)!.push(e.target);
    }
  }

  const rootNodes = nodes.filter((n) => (incomingCounts.get(n.id) ?? 0) === 0);
  if (rootNodes.length === 0 && nodes.length > 0) {
    // Fallback if there is a cycle: treat first node as root
    rootNodes.push(nodes[0]!);
  }

  // BFS / Level assignment
  const levels = new Map<string, number>();
  const visited = new Set<string>();
  const queue: Array<{ id: string; level: number }> = rootNodes.map((r) => ({ id: r.id, level: 0 }));

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    levels.set(id, level);

    const children = childrenMap.get(id) ?? [];
    for (const childId of children) {
      if (!visited.has(childId)) {
        queue.push({ id: childId, level: level + 1 });
      }
    }
  }

  // For any unvisited nodes, assign them to next level
  for (const n of nodes) {
    if (!levels.has(n.id)) {
      levels.set(n.id, (Math.max(0, ...Array.from(levels.values())) + 1));
    }
  }

  // Group nodes by level
  const levelGroups = new Map<number, string[]>();
  for (const [nodeId, lvl] of levels.entries()) {
    if (!levelGroups.has(lvl)) {
      levelGroups.set(lvl, []);
    }
    levelGroups.get(lvl)!.push(nodeId);
  }

  const VERTICAL_GAP = 180;
  const HORIZONTAL_GAP = 320;
  const CENTER_X = 400;

  const newPositions = new Map<string, { x: number; y: number }>();

  for (const [lvl, nodeIds] of levelGroups.entries()) {
    const count = nodeIds.length;
    const startX = CENTER_X - ((count - 1) * HORIZONTAL_GAP) / 2;
    const y = 40 + lvl * VERTICAL_GAP;

    nodeIds.forEach((nodeId, idx) => {
      newPositions.set(nodeId, {
        x: Math.round(startX + idx * HORIZONTAL_GAP),
        y,
      });
    });
  }

  return nodes.map((node) => {
    const pos = newPositions.get(node.id) ?? node.position;
    return {
      ...node,
      position: pos,
    };
  });
}
