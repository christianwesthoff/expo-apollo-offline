import React from "react";
import { FlatList, Text } from "react-native";

import { gql } from "@apollo/client";
import useSubscriptionWithFallback from "../extensions/useSubscriptionWithFallback";

export const QUERY_POSTS = gql`
  subscription queryPosts {
    posts {
      id
      text
    }
  }
`;

type Data = {
  posts: {
    text: string;
    id: number;
  }[];
};

const PostList: React.FC<{ mode: boolean }> = ({ mode }) => {
  const { data } = useSubscriptionWithFallback<Data>(QUERY_POSTS, {}, mode);
  // if (loading) return <Text>Loading...</Text>;
  // if (error) return <Text>Error:{error}</Text>;
  if (!data) return <Text>No Data</Text>;
  return (
    <FlatList
      data={data.posts}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <Text>{item.text}</Text>}
    />
  );
};

export default PostList;
