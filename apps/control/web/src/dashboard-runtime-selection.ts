import type { DashboardData } from "./api-client.js";

type NodeHealth = DashboardData["nodeHealth"][number];

export interface RuntimeSelectionRecord<Item> {
  node: NodeHealth;
  item: Item;
  key: string;
}

export function selectRuntimeRecord<Item>(
  records: RuntimeSelectionRecord<Item>[],
  focus: string | undefined
): RuntimeSelectionRecord<Item> | undefined {
  return (
    records.find((record) => record.key === focus) ??
    (focus ? records.find((record) => record.node.nodeId === focus) : undefined) ??
    records[0]
  );
}

export function isRuntimeRecordSelected<Item>(
  record: RuntimeSelectionRecord<Item>,
  selectedRecord: RuntimeSelectionRecord<Item> | undefined
): boolean {
  return selectedRecord?.key === record.key;
}
