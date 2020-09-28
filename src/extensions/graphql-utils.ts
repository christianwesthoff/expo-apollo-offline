import { gql } from "@apollo/client";
import { DocumentNode, OperationTypeNode } from "graphql";

export function changeDocumentType(
  document: DocumentNode,
  type: OperationTypeNode
) {
  const docType = getDocumentType(document);
  const query = document.loc?.source.body.replace(docType, type);
  return gql`
    ${query}
  `;
}

export function getDocumentType(document: DocumentNode) {
  return (document.definitions[0] as any)["operation"] as OperationTypeNode;
}
