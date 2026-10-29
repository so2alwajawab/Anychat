import { describe, it, expect } from "vitest";
import { autoLayoutNodes } from "./auto-layout";
import type { Node, Edge } from "@xyflow/react";

describe("autoLayoutNodes", () => {
  it("returns empty array when nodes array is empty", () => {
    const result = autoLayoutNodes([], []);
    expect(result).toEqual([]);
  });

  it("calculates positions for a simple root node", () => {
    const nodes: Node[] = [
      { id: "node-1", type: "trigger.comment", position: { x: 0, y: 0 }, data: {} },
    ];
    const result = autoLayoutNodes(nodes, []);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("node-1");
    expect(result[0]!.position.y).toBe(40);
  });

  it("orders child nodes hierarchically below parent nodes", () => {
    const nodes: Node[] = [
      { id: "trigger", type: "trigger.comment", position: { x: 0, y: 0 }, data: {} },
      { id: "action-1", type: "action.public_reply", position: { x: 0, y: 0 }, data: {} },
      { id: "action-2", type: "action.private_reply", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "trigger", target: "action-1" },
      { id: "e2", source: "trigger", target: "action-2" },
    ];

    const result = autoLayoutNodes(nodes, edges);
    expect(result).toHaveLength(3);

    const triggerNode = result.find((n) => n.id === "trigger")!;
    const action1Node = result.find((n) => n.id === "action-1")!;
    const action2Node = result.find((n) => n.id === "action-2")!;

    expect(triggerNode.position.y).toBeLessThan(action1Node.position.y);
    expect(triggerNode.position.y).toBeLessThan(action2Node.position.y);
    expect(action1Node.position.y).toBe(action2Node.position.y);
    // Should have horizontal spacing
    expect(Math.abs(action1Node.position.x - action2Node.position.x)).toBeGreaterThanOrEqual(300);
  });

  it("handles deep multi-level branches gracefully", () => {
    const nodes: Node[] = [
      { id: "n1", position: { x: 0, y: 0 }, data: {} },
      { id: "n2", position: { x: 0, y: 0 }, data: {} },
      { id: "n3", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
    ];

    const result = autoLayoutNodes(nodes, edges);
    const n1 = result.find((n) => n.id === "n1")!;
    const n2 = result.find((n) => n.id === "n2")!;
    const n3 = result.find((n) => n.id === "n3")!;

    expect(n1.position.y).toBeLessThan(n2.position.y);
    expect(n2.position.y).toBeLessThan(n3.position.y);
  });
});
