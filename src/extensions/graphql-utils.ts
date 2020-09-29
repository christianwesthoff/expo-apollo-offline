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

export function compileQuery(query: string) {
  return gql`
    ${query}
  `;
}

export function changeDocumentType(
  document: DocumentNode,
  type: OperationTypeNode
) {
  const docType = getDocumentType(document);
  if (!docType) return undefined;
  const queryString = getDocumentBody(document);
  if (!queryString) return undefined;
  const newQueryString = queryString.replace(new RegExp(docType), type);
  return compileQuery(newQueryString);
}
