import { DocumentNode } from "graphql";

export function changeDocumentType(
  document: DocumentNode,
  type: "query" | "subscription" | "mutation"
) {
  (document.definitions[0] as any)["operation"] = type;
  return document;
}
