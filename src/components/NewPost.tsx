import React, { useState } from "react";
import { TextInput } from "react-native";
import { v4 as uuidv4 } from "uuid";
import { useOfflineMutation } from "../extensions/useOfflineMutation";
import { ADD_POST, QUERY_POSTS } from "./operations";

const NewPost: React.FC = () => {
  const [addPost] = useOfflineMutation(ADD_POST, {
    offlineUpdate: [
      {
        query: QUERY_POSTS,
        updateQuery: (data, variables) => ({
          posts: [
            ...(data?.posts || []),
            {
              __typename: "posts",
              id: `optimistic-${uuidv4()}`,
              text: variables?.text,
            },
          ],
        }),
      },
    ],
    offlineReturn: {
      createResponse: (variables) => {
        return {
          data: {
            insert_posts: {
              affected_rows: 1,
              __typename: "posts_mutation_response",
            },
          },
          variables,
        };
      },
      statusSubscribe: (fetchResult, error) =>
        !error
          ? console.log("DONE SUBMITTING UPDATE!", fetchResult)
          : console.error(error),
    },
  });
  const [text, setText] = useState("");

  const onSubmit = async () => {
    var response = await addPost({
      variables: { text },
    });
    console.log("OPTIMISTIC RESPONSE!", response);
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
