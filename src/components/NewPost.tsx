import React, { useContext, useState } from "react";
import { TextInput } from "react-native";
import { v4 as uuidv4 } from "uuid";
import {
  getApolloContext,
  gql,
  InMemoryCache,
  useMutation,
} from "@apollo/client";
import { useMutationWithFallback } from "../useMutationWithFallback";

const ADD_POST = gql`
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

const NewPost: React.FC<{ mode: boolean }> = ({ mode }) => {
  const [addPost] = useMutationWithFallback(ADD_POST, undefined, mode, {
    query: QUERY_POSTS,
    offlineUpdate: (data, variables) => ({
      posts: [
        ...data.posts,
        { __typename: "posts", id: uuidv4(), text: variables.text },
      ],
    }),
  });
  const [text, setText] = useState("");

  const onSubmit = () => {
    addPost({
      variables: { text },
    });
    setText("");
  };
  return (
    <TextInput
      style={{ height: 40, borderColor: "gray", borderWidth: 1 }}
      placeholder="Enter text..."
      onSubmitEditing={onSubmit}
      onChangeText={setText}
      value={text}
    />
  );
};

export default NewPost;
