import { gql } from "@apollo/client";

export const ADD_POST = gql`
  mutation addPost($text: String!) {
    insert_posts(objects: { text: $text }) {
      affected_rows
    }
  }
`;

export const QUERY_POSTS = gql`
  subscription queryPosts {
    posts {
      id
      text
    }
  }
`;
