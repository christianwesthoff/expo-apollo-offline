import { gql } from "@apollo/client";
import { getMainDefinition } from "@apollo/client/utilities";
import { DocumentNode, OperationTypeNode } from "graphql";

export function getDocumentBody(document: DocumentNode) {
  return document.loc?.source?.body;
}

export function getDocumentType(document: DocumentNode) {
  const { kind, operation } = getMainDefinition(document) as any;
  return kind === "OperationDefinition"
    ? (operation as OperationTypeNode)
    : undefined;
}

export function compileDocument(document: string) {
  return gql`
    ${document}
  `;
}

export function changeDocumentType(
  document: DocumentNode,
  type: OperationTypeNode
) {
  const docType = getDocumentType(document);
  if (!docType) return undefined;
  const docString = getDocumentBody(document);
  if (!docString) return undefined;
  const newDocString = docString.replace(new RegExp(docType), type);
  return compileDocument(newDocString);
}
