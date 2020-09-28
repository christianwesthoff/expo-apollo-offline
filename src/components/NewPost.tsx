import React, { useState } from "react";
import { TextInput } from "react-native";
import { v4 as uuidv4 } from "uuid";
import { useMutationWithFallback } from "../extensions/useMutationWithFallback";
import { ADD_POST, QUERY_POSTS } from "./operations";

const NewPost: React.FC<{ mode: boolean }> = ({ mode }) => {
  const [addPost] = useMutationWithFallback(ADD_POST, {}, mode, {
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
      placeholder="Search"
      onSubmitEditing={onSubmit}
      onChangeText={setText}
      value={text}
    />
  );
};

export default NewPost;
