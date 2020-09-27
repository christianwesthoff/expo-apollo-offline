import { DocumentNode, OperationTypeNode } from "graphql";

export function changeDocumentType(
  document: DocumentNode,
  type: OperationTypeNode
) {
  (document.definitions[0] as any)["operation"] = type;
  return document;
}

export function getDocumentType(document: DocumentNode) {
  return (document.definitions[0] as any)["operation"] as OperationTypeNode;
}
